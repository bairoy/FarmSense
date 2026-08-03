# 05 — Penman-Monteith from scratch: how much water does the air pull out?

## The problem

The old model said:

```ts
const evap = tempMax * 0.2;
```

At 35°C this claims 7mm/day. At 20°C it claims 4mm/day. Both are roughly the
right order of magnitude, which is exactly what makes it dangerous — it's wrong
in ways that are invisible.

It cannot represent:
- A **windy** 30°C day vs a **still** 30°C day (wind can change ETo by 40%)
- An **overcast** day vs a **clear** day at the same temperature
- A **humid** monsoon day vs a **dry** pre-monsoon day

Those are not edge cases. In Siraha, a humid 32°C monsoon day and a dry 32°C
April day have genuinely different water demand, and the whole point of the
system is to tell a farmer which one they're in.

## The concept

**Reference evapotranspiration (ETo)** is the water demand of a standardised
reference surface: grass, 0.12m tall, surface resistance 70 s/m, albedo 0.23. It
depends only on weather — never on the crop. The crop enters afterwards, as a
multiplier:

```
ETc = ETo × Kc
```

This separation is the reason FAO-56 is useful. Meteorologists compute ETo;
agronomists publish Kc tables per crop and growth stage. You don't need to
re-derive the physics per crop.

### The equation (FAO-56 eq. 6)

```
         0.408 · Δ · (Rn − G)  +  γ · (900/(T+273)) · u₂ · (e_s − e_a)
ETo =  ──────────────────────────────────────────────────────────────────
                        Δ  +  γ · (1 + 0.34 · u₂)
```

Intimidating, but it's two physical stories added together:

**Numerator, left half — the radiation term.** `Rn` is net radiation: energy
arriving at the surface. Evaporating water takes energy (~2.45 MJ per kg). This
term asks: *how much energy is available to do the evaporating?*

**Numerator, right half — the aerodynamic term.** `(e_s − e_a)` is the vapour
pressure deficit — how "thirsty" the air is. `u₂` is wind at 2m. This term asks:
*how fast can the air carry that vapour away?*

You need both. A hot still day in 100% humidity evaporates almost nothing —
there's energy, but nowhere for the vapour to go. A windy dry day at 20°C
evaporates a lot. **A temperature-only heuristic cannot see either of these.**

**Denominator** is the normalising term that balances the two, using Δ (slope of
the vapour pressure curve) and γ (the psychrometric constant).

## The decision

### Why implement this instead of using Open-Meteo's `et0_fao_evapotranspiration`

Open-Meteo does return an ETo value, and we still fetch it. But it is not the
source of truth here, for three reasons:

1. **It's a black box.** I cannot unit-test it, and I cannot tell you which
   radiation dataset went into it. The tests in `src/tests/eto.test.ts` check my
   implementation against the worked examples printed in FAO-56 itself. That's
   the only way to know it's right rather than merely self-consistent.

2. **The forecast path needs it.** The "irrigate now or wait for rain?" decision
   runs on forecast days, and I need ETo computed the same way on both sides of
   today. Mixing two ETo methods across the decision boundary would put a
   discontinuity exactly where the decision is made.

3. **Better inputs are available.** NASA POWER gives radiation and **2-metre
   wind**, purpose-built for agro-climatology. Most weather APIs report 10m wind.
   Feeding a 10m wind value into eq. 6 without the log-profile correction
   overstates ETo by roughly 15–25%. Having better inputs is pointless if you
   then hand them to someone else's opaque formula.

We keep Open-Meteo's value as a **cross-check**: a large divergence means one of
my inputs is wrong.

### Details that are easy to get wrong

**Saturation vapour pressure must be averaged from the daily extremes, not
computed from the mean temperature:**

```ts
const es = (saturationVapourPressure(tempMaxC) + saturationVapourPressure(tempMinC)) / 2;
```

The `e_s(T)` curve is convex (exponential), so `e_s(T_mean) < mean(e_s(T))`.
FAO-56 eq. 12 is explicit about this. Using `e_s(T_mean)` systematically
underestimates the deficit, and therefore ETo.

**Wind has a floor of 0.5 m/s:**

```ts
const u2 = Math.max(0.5, input.windSpeed2m);
```

FAO-56 §3.4. A daily-mean wind of zero is unphysical, and it collapses the whole
aerodynamic term to nothing.

**The `acos` in extraterrestrial radiation must be clamped:**

```ts
const tanProduct = Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta)));
const omega = Math.acos(tanProduct);
```

At high latitudes during polar day/night the argument leaves [−1, 1] and `acos`
returns `NaN`. Siraha is at 26°N so this never fires here — but a `NaN` would
propagate silently through the entire water balance, and a guard costs one line.

**ETo is clamped at zero.** On a cold overcast day the radiation term can go
slightly negative. Physically that means "no evaporation", not "condensation you
can bank against tomorrow's demand".

### The Hargreaves fallback

When radiation or wind is missing (typically forecast days beyond NASA POWER's
horizon), we fall back to Hargreaves-Samani (FAO-56 eq. 52), which needs only
temperature and latitude:

```ts
ETo ≈ 0.0023 · (T_mean + 17.8) · √(T_max − T_min) · Ra · 0.408
```

It's less accurate. **That's why the day is tagged**, and why the share of
Hargreaves days feeds directly into the confidence score:

```ts
weatherCompleteness: penmanDays / totalDays
```

A degraded input must produce a visibly less confident output. Silently
substituting a worse method is how a system lies without anyone writing a lie.

## What breaks if you get this wrong

| Mistake | Consequence |
|---|---|
| Temperature-only heuristic | Water demand wrong by up to 40% on windy or humid days. Irrigation volumes wrong by the same margin. |
| 10m wind in eq. 6 | ETo overstated 15–25% all season. Farmer over-irrigates and burns fuel. |
| `e_s(T_mean)` instead of the average | Systematic underestimate of ETo. Crop dries faster than the model thinks. |
| Unclamped `acos` | `NaN` propagates through the water balance; every downstream number becomes `NaN` with no error thrown. |
| Silent Hargreaves fallback | Degraded estimates presented with full confidence. |

## Code

`backend/src/modules/rules/eto.ts` — implementation, one function per FAO-56
equation with the equation number in the comment.

`backend/src/tests/eto.test.ts` — validated against FAO-56 worked examples 2, 3,
5 and 8.
