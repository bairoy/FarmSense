// Rice analogue of E4/E4b (e2_e4.ts), for the paper's farmer-in-the-loop
// correction study. Wheat's E4 uses the depletion model and ICAR calendar;
// rice has its own state variable (ponded depth) and its own check-in
// ("field_flooded": yes_deep / yes_shallow / no), so it needs its own truth
// model and its own correction call (applyPondedDepth), not a relabelled copy.
//
// Truth: the field is irrigated on the same "refill when pond < 20mm, top up
// to 50mm" policy used in e3d_rice.ts. The twin knows only a fraction of
// those refills (the rest are unlogged, the dominant real-world source of
// drift); optionally it also receives noisy standing-water check-ins.
import { readFileSync, writeFileSync } from "node:fs";
import { stepPaddy, initialPaddyState, defaultPaddyConfig } from "../src/modules/rules/paddy.model.ts";
import { applyPondedDepth } from "../src/modules/rules/observationCorrection.ts";

const OUT = new URL("./results", import.meta.url).pathname;
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const rice: any[] = JSON.parse(readFileSync(OUT + "/e3_seasons.json", "utf8")).filter((x: any) => x.season.crop === "rice");

/** Deterministic truth run: refill whenever the pond drops below 20mm. Returns the full daily series. */
const truthSeries = (tl: any[]) => {
  let s = initialPaddyState();
  return tl.map((d) => {
    const irr = s.pondedDepthMm < 20 ? defaultPaddyConfig.targetDepthMm - s.pondedDepthMm : 0;
    s = stepPaddy(s, d.etc, d.rain, irr, defaultPaddyConfig);
    return { irr, pond: s.pondedDepthMm, flooded: s.flooded, phase: d.phase };
  });
};

/** Farmer's noisy answer to "field_flooded", from the TRUE ponded depth that day. */
const answerFor = (trueDepthMm: number, r: () => number, noise: number) => {
  const truth = trueDepthMm >= 30 ? "yes_deep" : trueDepthMm > 0 ? "yes_shallow" : "no";
  if (r() < noise) {
    const others = ["yes_deep", "yes_shallow", "no"].filter((x) => x !== truth);
    return others[Math.floor(r() * 2)];
  }
  return truth;
};

/** Same mapping as checkin.service.ts's interpretAnswer("field_flooded", ...), kept local so this
 *  script has no dependency on the Express module graph. */
const interpretFloodedAnswer = (answer: string): Record<string, unknown> => {
  if (answer === "yes_deep") return { set_ponded_depth_mm: 50, confidence: 0.9 };
  if (answer === "yes_shallow") return { set_ponded_depth_mm: 15, confidence: 0.85 };
  return { set_ponded_depth_mm: 0, confidence: 0.9 };
};

type Cond = { name: string; logProb: number; every: number | null };
const conds: Cond[] = [
  { name: "A no logs, no check-ins", logProb: 0, every: null },
  { name: "B 50% logged, no check-ins", logProb: 0.5, every: null },
  { name: "C 50% logged + check-in /14 d", logProb: 0.5, every: 14 },
  { name: "D 50% logged + check-in /7 d", logProb: 0.5, every: 7 },
  { name: "E 50% logged + check-in /3 d", logProb: 0.5, every: 3 },
  { name: "F no logs + check-in /7 d", logProb: 0, every: 7 },
];

const SEEDS = 300, NOISE = 0.15;

const runCond = (c: Cond, noise: number) => {
  const rmse: number[] = [], mae: number[] = [], agree: number[] = [];
  for (const s of rice) {
    const truth = truthSeries(s.timeline);
    for (let seed = 0; seed < SEEDS; seed++) {
      const r = rng(1000 * seed + c.name.length + Math.round(noise * 1000));
      let wPond = 0, wFlooded = false, wDry = 0;
      let se = 0, ae = 0, ag = 0, n = 0;
      truth.forEach((t, i) => {
        const d = s.timeline[i];
        const logged = t.irr > 0 && r() < c.logProb ? t.irr : 0;
        const step = stepPaddy({ pondedDepthMm: wPond, soilDepletionMm: 0, overflowMm: 0, percolationMm: 0, flooded: wFlooded, dryDays: wDry }, d.etc, d.rain, logged, defaultPaddyConfig);
        wPond = step.pondedDepthMm; wFlooded = step.flooded; wDry = step.dryDays;
        if (c.every && (i + 1) % c.every === 0) {
          const ans = answerFor(t.pond, r, noise);
          const corr = interpretFloodedAnswer(ans);
          wPond = applyPondedDepth(wPond, corr as any).value;
          wFlooded = wPond > 0;
        }
        se += (wPond - t.pond) ** 2; ae += Math.abs(wPond - t.pond); n++;
        if (wFlooded === t.flooded) ag++;
      });
      rmse.push(Math.sqrt(se / n)); mae.push(ae / n); agree.push(ag / n);
    }
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  return { name: c.name, rmse_mean: mean(rmse), rmse_sd: sd(rmse), mae_mean: mean(mae), agree_mean: mean(agree), agree_sd: sd(agree), runs: rmse.length };
};

// ---- main table at NOISE = 0.15 ----
const e4r = conds.map((c) => runCond(c, NOISE));
writeFileSync(OUT + "/e4_rice.json", JSON.stringify(e4r));
console.log("E4-rice (noise 0.15)");
for (const x of e4r) console.log(x.name.padEnd(34), "RMSE", x.rmse_mean.toFixed(1), "±", x.rmse_sd.toFixed(1), "MAE", x.mae_mean.toFixed(1), "flooded-state agreement", (100 * x.agree_mean).toFixed(1) + "%");

// ---- sweep over farmer answer error ----
const sweepConds = [conds[0], conds[1], conds[3], conds[5]];
const e4br: any[] = [];
for (const noise of [0, 0.05, 0.15, 0.30]) for (const c of sweepConds) {
  const r = runCond(c, noise);
  e4br.push({ noise, cond: c.name, rmse: r.rmse_mean, agree: r.agree_mean });
}
writeFileSync(OUT + "/e4b_rice.json", JSON.stringify(e4br));
console.log("\nE4b-rice (sweep)");
for (const x of e4br) console.log(String(x.noise).padEnd(5), x.cond.padEnd(34), x.rmse.toFixed(1), (100 * x.agree).toFixed(1) + "%");
