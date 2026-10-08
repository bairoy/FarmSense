import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { soilCapacity, stepWaterBalance, effectiveRainfall } from "../src/modules/rules/waterBalance.ts";
import { applyDepletionBound } from "../src/modules/rules/observationCorrection.ts";
import { interpretAnswer } from "../src/modules/checkin/checkin.service.ts";

const OUT = new URL("./results", import.meta.url).pathname;
// deterministic PRNG (mulberry32) so every number in the paper is reproducible
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------------- E2: mass-balance closure and bounds, 10^5 random days ----------------
{
  const r = rng(42); let n = 0, clipped = 0, maxRes = 0, boundViol = 0, ksBad = 0, maxViol = 0;
  for (let i = 0; i < 100000; i++) {
    const taw = 40 + r() * 200, p = 0.3 + r() * 0.3;
    const cap = { TAW: taw, RAW: p * taw, p, rootDepthM: 1 };
    const dep0 = r() * taw, etc = r() * 9, rain = r() < 0.3 ? r() * 90 : 0, irr = r() < 0.1 ? r() * 60 : 0;
    const s = stepWaterBalance(dep0, etc, rain, irr, cap);
    const pEff = effectiveRainfall(rain);
    const unclipped = dep0 + s.ETa - pEff - irr + s.deepPercolation;
    n++;
    if (s.depletion < 0 || s.depletion > taw + 1e-9) { boundViol++; maxViol = Math.max(maxViol, s.depletion - taw, -s.depletion); }
    if (s.Ks < 0 || s.Ks > 1) ksBad++;
    if (Math.abs(s.depletion - taw) < 0.011 && unclipped > taw + 0.02) { clipped++; continue; }
    maxRes = Math.max(maxRes, Math.abs(unclipped - s.depletion));
  }
  writeFileSync(OUT + "/e2.json", JSON.stringify({ n, clipped, maxResidualMm: maxRes, boundViolations: boundViol, maxViolationMm: maxViol, ksViolations: ksBad }));
  console.log("E2", { n, clipped, maxRes, boundViol, maxViol, ksBad });
}

// ---------------- E3b: irrigation scheduling policies on real weather ----------------
const seasons: any[] = JSON.parse(readFileSync(OUT + "/e3_seasons.json", "utf8")).filter((x: any) => x.season.crop === "wheat");
const ICAR_DAS = [21, 45, 65, 85, 105, 120];
const runPolicy = (tl: any[], policy: "none" | "mad" | "icar", netMm = 50) => {
  let dep = 0, applied = 0, sumEta = 0, sumEtc = 0, stressDays = 0; const events: number[] = [];
  tl.forEach((d, i) => {
    const cap = { TAW: d.taw, RAW: d.raw, p: 0.55, rootDepthM: 1 };
    let irr = 0;
    if (policy === "mad" && dep >= d.raw) irr = Math.min(dep, d.taw);            // refill to field capacity at management-allowed depletion
    if (policy === "icar" && ICAR_DAS.includes(i + 1)) irr = netMm;
    if (irr > 0) { applied += irr; events.push(i + 1); }
    const s = stepWaterBalance(dep, d.etc, d.rain, irr, cap);
    dep = s.depletion; sumEta += s.ETa; sumEtc += d.etc; if (s.Ks < 1) stressDays++;
  });
  return { applied: Math.round(applied), events, relET: sumEta / sumEtc, stressDays };
};
const e3b = seasons.map((s) => ({ point: s.point.id, soil: s.soil.source, taw_mm_per_m: s.soil.tawMmPerM,
  none: runPolicy(s.timeline, "none"), mad: runPolicy(s.timeline, "mad"), icar: runPolicy(s.timeline, "icar") }));
writeFileSync(OUT + "/e3b.json", JSON.stringify(e3b));
console.log("E3b", JSON.stringify(e3b.map((x) => ({ p: x.point, none: [x.none.applied, x.none.relET.toFixed(3), x.none.stressDays], mad: [x.mad.applied, x.mad.relET.toFixed(3), x.mad.stressDays, x.mad.events.join(",")], icar: [x.icar.applied, x.icar.relET.toFixed(3), x.icar.stressDays] }))));

// ---------------- E4: does farmer-observation correction reduce drift? (simulation study) ----------------
// Truth: the field is irrigated on the ICAR calendar. The twin only knows a fraction of those irrigations
// (the rest are 'unlogged'), and optionally receives noisy soil-dryness check-ins.
type Cond = { name: string; logProb: number; every: number | null };
const conds: Cond[] = [
  { name: "A no logs, no check-ins", logProb: 0, every: null },
  { name: "B 50% logged, no check-ins", logProb: 0.5, every: null },
  { name: "C 50% logged + check-in /14 d", logProb: 0.5, every: 14 },
  { name: "D 50% logged + check-in /7 d", logProb: 0.5, every: 7 },
  { name: "E 50% logged + check-in /3 d", logProb: 0.5, every: 3 },
  { name: "F no logs + check-in /7 d", logProb: 0, every: 7 },
];
const answerFor = (trueDep: number, taw: number, r: () => number, noise: number) => {
  const ratio = trueDep / taw;
  let a = ratio >= 0.85 ? "cracked" : ratio >= 0.55 ? "dry" : "moist";
  if (r() < noise) { const others = ["cracked", "dry", "moist"].filter((x) => x !== a); a = others[Math.floor(r() * 2)]; }
  return a;
};
const SEEDS = 300, NOISE = 0.15;
const e4: any[] = [];
for (const c of conds) {
  const rmse: number[] = [], mae: number[] = [], agree: number[] = [], stressF: number[] = [];
  for (const s of seasons) for (let seed = 0; seed < SEEDS; seed++) {
    const r = rng(1000 * seed + c.name.length);
    const tl = s.timeline; let tDep = 0, wDep = 0; let se = 0, ae = 0, ag = 0, nStress = 0, n = 0;
    tl.forEach((d: any, i: number) => {
      const cap = { TAW: d.taw, RAW: d.raw, p: 0.55, rootDepthM: 1 };
      const truthIrr = ICAR_DAS.includes(i + 1) ? 50 : 0;
      const logged = truthIrr > 0 && r() < c.logProb ? truthIrr : 0;
      const t = stepWaterBalance(tDep, d.etc, d.rain, truthIrr, cap); tDep = t.depletion;
      const w = stepWaterBalance(wDep, d.etc, d.rain, logged, cap); wDep = w.depletion;
      if (c.every && (i + 1) % c.every === 0) {
        const ans = answerFor(tDep, d.taw, r, NOISE);
        const corr: any = interpretAnswer("soil_dry", ans);
        wDep = applyDepletionBound(wDep, d.taw, corr).value;
      }
      se += (wDep - tDep) ** 2; ae += Math.abs(wDep - tDep); n++;
      const ts = tDep > d.raw, ws = wDep > d.raw; if (ts === ws) ag++; 
    });
    rmse.push(Math.sqrt(se / n)); mae.push(ae / n); agree.push(ag / n);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  e4.push({ name: c.name, rmse_mean: mean(rmse), rmse_sd: sd(rmse), mae_mean: mean(mae), agree_mean: mean(agree), agree_sd: sd(agree), runs: rmse.length });
}
writeFileSync(OUT + "/e4.json", JSON.stringify(e4));
console.log("E4"); for (const x of e4) console.log(x.name.padEnd(34), "RMSE", x.rmse_mean.toFixed(1), "±", x.rmse_sd.toFixed(1), "MAE", x.mae_mean.toFixed(1), "stress-state agreement", (100 * x.agree_mean).toFixed(1) + "%");

// ---------------- E4b: sensitivity to farmer answer error ----------------
const e4b: any[] = [];
for (const noise of [0, 0.05, 0.15, 0.30]) for (const c of [conds[0], conds[1], conds[3], conds[5]]) {
  const rmse: number[] = [], agree: number[] = [];
  for (const s of seasons) for (let seed = 0; seed < SEEDS; seed++) {
    const r = rng(7000 * seed + c.name.length + Math.round(noise * 100));
    let tDep = 0, wDep = 0, se = 0, ag = 0, n = 0;
    s.timeline.forEach((d: any, i: number) => {
      const cap = { TAW: d.taw, RAW: d.raw, p: 0.55, rootDepthM: 1 };
      const truthIrr = ICAR_DAS.includes(i + 1) ? 50 : 0;
      const logged = truthIrr > 0 && r() < c.logProb ? truthIrr : 0;
      tDep = stepWaterBalance(tDep, d.etc, d.rain, truthIrr, cap).depletion;
      wDep = stepWaterBalance(wDep, d.etc, d.rain, logged, cap).depletion;
      if (c.every && (i + 1) % c.every === 0) wDep = applyDepletionBound(wDep, d.taw, interpretAnswer("soil_dry", answerFor(tDep, d.taw, r, noise)) as any).value;
      se += (wDep - tDep) ** 2; n++; if ((tDep > d.raw) === (wDep > d.raw)) ag++;
    });
    rmse.push(Math.sqrt(se / n)); agree.push(ag / n);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  e4b.push({ noise, cond: c.name, rmse: mean(rmse), agree: mean(agree) });
}
writeFileSync(OUT + "/e4b.json", JSON.stringify(e4b));
console.log("E4b"); for (const x of e4b) console.log(String(x.noise).padEnd(5), x.cond.padEnd(34), x.rmse.toFixed(1), (100 * x.agree).toFixed(1) + "%");

// ---------------- E3c: sensitivity of model-triggered irrigation to effective root-zone depth ----------------
const e3c: any[] = [];
for (const zmax of [0.6, 0.9, 1.2, 1.5]) for (const s of seasons) {
  const tl = s.timeline.map((d: any) => ({ ...d, taw: d.taw * (zmax / 1.5), raw: d.raw * (zmax / 1.5) }));
  const m = runPolicy(tl, "mad"), n0 = runPolicy(tl, "none");
  e3c.push({ zmax, point: s.point.id, events: m.events, applied: m.applied, relET_none: n0.relET, stress_mad: m.stressDays });
}
writeFileSync(OUT + "/e3c.json", JSON.stringify(e3c));
console.log("E3c"); for (const x of e3c) console.log(x.zmax, x.point, "events", x.events.join(",") || "-", "applied", x.applied, "relET(no irr)", x.relET_none.toFixed(3));
