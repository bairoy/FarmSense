import { readFileSync, writeFileSync } from "node:fs";
import { stepPaddy, initialPaddyState, defaultPaddyConfig } from "../src/modules/rules/paddy.model.ts";
const OUT = new URL("./results", import.meta.url).pathname;
const rice: any[] = JSON.parse(readFileSync(OUT + "/e3_seasons.json", "utf8")).filter((x: any) => x.season.crop === "rice");
const run = (tl: any[], policy: "none" | "refill") => {
  let s = initialPaddyState(), applied = 0, dry = 0, dryFlower = 0, events = 0, overflow = 0;
  tl.forEach((d) => {
    let irr = 0;
    if (policy === "refill" && s.pondedDepthMm < 20) { irr = defaultPaddyConfig.targetDepthMm - s.pondedDepthMm; applied += irr; events++; }
    s = stepPaddy(s, d.etc, d.rain, irr, defaultPaddyConfig);
    overflow += s.overflowMm; if (!s.flooded) { dry++; if (d.phase === "flowering") dryFlower++; }
  });
  return { applied: Math.round(applied), events, unfloodedDays: dry, unfloodedFlowering: dryFlower, overflowMm: Math.round(overflow) };
};
const out = rice.map((r) => ({ point: r.point.id, none: run(r.timeline, "none"), refill: run(r.timeline, "refill") }));
writeFileSync(OUT + "/e3d.json", JSON.stringify(out));
console.log(JSON.stringify(out));
