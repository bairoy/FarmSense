# 07 — Satellite grounding: seeing the field without going there

## The problem

The simulation needs to be checked against reality. We have no sensors. But
there are two European satellites passing over Siraha every few days, and the
data is free.

The catch: **rice grows in the monsoon.** Optical satellites cannot see through
cloud, and Siraha in July can be overcast for weeks. So "just use NDVI" fails
for exactly the crop that matters most.

## The concept

### Sentinel-2 (optical) — the wheat channel

Wheat grows Nov–Apr in the dry winter. Clear skies, so optical works.

```
NDVI = (NIR − Red) / (NIR + Red)     canopy greenness / biomass
NDWI = (NIR − SWIR) / (NIR + SWIR)   canopy water content
```

Healthy vegetation reflects strongly in near-infrared and absorbs red (that's
what chlorophyll does), so NDVI rises as the canopy fills in.

**NDWI is the early-warning channel.** A crop closes its stomata and loses leaf
water content *days before* it starts visibly yellowing. NDWI responds to that;
NDVI responds later.

### Sentinel-1 (SAR) — the rice channel

Synthetic Aperture Radar is an **active** sensor: it emits its own microwave
pulse and measures what comes back. At C-band, cloud is transparent. It works at
night. It works through the monsoon.

The signal we exploit is beautiful:

```
VH backscatter (dB)
  -14 ┤ ╲                            ╱────  canopy developed
  -18 ┤   ╲                      ╱
  -22 ┤     ╲                ╱             ← flooding threshold
  -26 ┤       ╲____________╱
      └──────────┬──────────────────────
              transplant
```

**Why it drops:** standing water is a *smooth* surface at radar wavelengths. It
reflects the pulse away from the satellite (specular reflection) instead of
scattering it back. Backscatter collapses to −22 dB or below.

**Why it recovers:** as rice stems and leaves grow, volume scattering in the
canopy builds the return signal back up.

That V shape is well-established enough that automated rice-mapping methods
(e.g. ARM-SARFS) are built directly around detecting it.

**What it buys us:** an independent, physical confirmation of the **actual
transplant date**. Farmers report sowing approximately — "sometime in the second
week of Ashadh". Every GDD accumulation, every phase boundary, every Kc value
and every fertilizer timing is anchored to that date. A two-week error in the
anchor is a two-week error in the entire season.

## The decision

### Copernicus Data Space Ecosystem, not Google Earth Engine

GEE is the obvious tool and I deliberately did not use it. **Its free tier is
restricted to research and nonprofit use; operational or commercial use requires
a paid commercial licence.** FarmSense is a product. Building on the GEE free
tier would mean building on a licence we're not entitled to — a dependency that
breaks the day it succeeds.

CDSE is ESA's own distribution, free, and OAuth2 client-credentials
authenticated.

### Constellation note (matters for cadence planning)

Sentinel-1A was retired on **29 June 2026**. The operational constellation is now
**S1C + S1D**, giving a **6-day** nominal revisit. The correction cadence and the
`STEP_DAYS = 6` sampling in `observeRiceTransplant` are planned around that, not
around the old 12-day single-satellite figure.

### Compute the average server-side

We request a **1×1 pixel output covering the whole field polygon**. Sentinel Hub
then averages every pixel inside the boundary for us:

```ts
output: { width: 1, height: 1, responses: [...] }
```

We transfer a handful of bytes instead of an image we'd have to decode and
average ourselves.

**This is why field boundaries had to be built first.** Averaging over a real
polygon gives you a crop signal. Sampling one pixel at a dropped map pin gives
you whatever happened to be under that pin — often a bund, a farm track, or the
neighbour's plot. A 10m Sentinel-2 pixel centred on a road reports a low NDVI
that has nothing to do with the crop.

### Cloud masking is not optional

```js
const badScl = [3, 8, 9, 10, 11];   // shadow, cloud x3, snow
const isValid = sample.dataMask === 1 && badScl.indexOf(sample.SCL) < 0;
if (!isValid) return [0, 0, 0, 0];
```

Averaging a cloud into the field mean produces a nonsense NDVI that looks
exactly like a sudden crop collapse — the single most damaging false alarm this
system could generate.

The 4th band counts valid pixels, so we can recover the true mean over only the
pixels that survived the mask, and know what fraction that was.

### Record failed observations too

```ts
const usable = validFraction > 0.3;
return { ndvi: usable ? ... : NaN, cloudFraction: 1 - validFraction, usable };
```

An unusable observation is returned, not swallowed. **The fusion step needs to
know we tried and couldn't see**, so it widens uncertainty rather than assuming
no news is good news.

### The V-detector requires all three conditions

```ts
const detected = belowThreshold && drop >= minDropDb && recovery >= minRecoveryDb;
```

1. A minimum below −22 dB — the field was flooded
2. A meaningful **drop** into it — it wasn't always wet
3. A meaningful **recovery** after it — a canopy grew

**Condition 3 is the one people forget.** Without it the detector happily reports
a pond, a flooded road, or a permanently waterlogged field as a rice transplant.
There's a test for exactly this (`"a permanently wet surface is not reported as a
transplant"`).

We also reject a minimum sitting at either end of the window — a V needs a
descent *and* an ascent that you can actually see.

### Report the discrepancy, don't silently rewrite

```ts
suggestion: Math.abs(offsetDays) >= 7
  ? `Radar suggests the field was flooded ${...} days ${...} the recorded sowing date. ...`
  : null
```

Changing the sowing date shifts every phase boundary for the whole season. That
should be an explicit, visible decision by the farmer — not something the system
does behind their back.

## What breaks if you get this wrong

| Mistake | Consequence |
|---|---|
| Optical-only | Rice gets essentially no grounding — maybe 1 usable image per monsoon. |
| No boundary polygon | You measure a road, a bund, or a neighbour's field. |
| No cloud mask | A cloud reads as a crop collapse. False critical alerts. |
| Silently dropping unusable passes | "No observation" gets treated as "everything's fine". |
| V-detector without the recovery check | Ponds and waterlogged fields reported as rice crops. |
| Auto-rewriting the sowing date | Every phase boundary silently shifts; the farmer has no idea why the advice changed. |
| Building on GEE's free tier | Licence violation the moment the product is commercial. |

## Code

- `satellite/cdse.client.ts` — OAuth2 + the 1×1 statistical request pattern
- `satellite/sentinel2.service.ts` — NDVI/NDWI evalscript + expected-NDVI curve
- `satellite/sentinel1.service.ts` — VH backscatter + `detectTransplant`
- `satellite/satellite.service.ts` — persistence, separate from `crop_states`
