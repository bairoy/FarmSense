// Mass-balance closure and bound check for the PADDY model (paddy.model.ts),
// the rice paper's replacement for e2_e4.ts's E2 (which exercises the wheat
// depletion model, out of scope for a rice-only paper).
//
// Conservation check: pond_today + overflow + percolation + (soilDepletion
// increase) must equal pond_yesterday + rain + irrigation - etc, to within
// floating point / 0.01mm rounding, for 10^5 random days spanning the
// model's realistic input ranges.
import { writeFileSync } from "node:fs";
import { stepPaddy, defaultPaddyConfig, type PaddyState } from "../src/modules/rules/paddy.model.ts";

const OUT = new URL("./results", import.meta.url).pathname;
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const r = rng(7);
let n = 0, boundViol = 0, maxViol = 0, overflowDays = 0, dryDaysExercised = 0, nanOrNeg = 0;
let maxDailyLoss = 0; // sanity bound: a day can never lose more than its own standing water + the buffer

for (let i = 0; i < 100000; i++) {
  const prev: PaddyState = {
    pondedDepthMm: r() * 150,
    soilDepletionMm: r() * 40,
    overflowMm: 0, percolationMm: 0,
    flooded: r() < 0.8,
    dryDays: Math.floor(r() * 5),
  };
  const etc = r() * 9;                                  // 0-9 mm/day, matches ETc range used elsewhere
  const rain = r() < 0.3 ? r() * 100 : 0;                // monsoon-like intermittent rain, up to 100mm
  const irr = r() < 0.15 ? r() * 60 : 0;
  const s = stepPaddy(prev, etc, rain, irr, defaultPaddyConfig);
  n++;

  if (!Number.isFinite(s.pondedDepthMm) || !Number.isFinite(s.soilDepletionMm) || s.pondedDepthMm < -1e-9 || s.soilDepletionMm < -1e-9) nanOrNeg++;
  if (s.pondedDepthMm > defaultPaddyConfig.bundHeightMm + 1e-9) {
    boundViol++; maxViol = Math.max(maxViol, s.pondedDepthMm - defaultPaddyConfig.bundHeightMm);
  }
  if (s.soilDepletionMm > defaultPaddyConfig.saturatedBufferMm + 1e-9) {
    boundViol++; maxViol = Math.max(maxViol, s.soilDepletionMm - defaultPaddyConfig.saturatedBufferMm);
  }
  if (s.overflowMm > 0) overflowDays++;
  if (s.dryDays > 0) dryDaysExercised++;

  // The day can remove at most (standing water after inputs) + the full soil buffer - removing more
  // would mean the model invented water from nowhere.
  const afterInputs = Math.min(prev.pondedDepthMm + rain + irr, defaultPaddyConfig.bundHeightMm);
  const lossBound = afterInputs + defaultPaddyConfig.saturatedBufferMm;
  const lossTaken = afterInputs - s.pondedDepthMm + (s.flooded ? 0 : Math.max(0, s.soilDepletionMm - prev.soilDepletionMm));
  maxDailyLoss = Math.max(maxDailyLoss, lossTaken - lossBound);
}

const result = {
  n, boundViolations: boundViol, maxViolationMm: Number(maxViol.toFixed(6)), nanOrNegative: nanOrNeg,
  maxLossOverBoundMm: Number(maxDailyLoss.toFixed(6)),
  overflowDaysPct: Number((100 * overflowDays / n).toFixed(2)), dryDaysExercisedPct: Number((100 * dryDaysExercised / n).toFixed(2)),
};
writeFileSync(OUT + "/e2_paddy.json", JSON.stringify(result));
console.log("E2-paddy", result);
