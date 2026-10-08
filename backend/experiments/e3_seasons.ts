import "dotenv/config";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { computeCropTimeline } from "../src/modules/crop-state/timeline.engine.ts";
import { getHistoricalWeather } from "../src/utils/weather.service.ts";

const OUT = new URL("./results", import.meta.url).pathname;
const points = [
  { id: "P1", name: "Gorakhpur centre", latitude: 26.76, longitude: 83.37 },
  { id: "P2", name: "South-west", latitude: 26.40, longitude: 83.10 },
  { id: "P3", name: "North-east", latitude: 27.00, longitude: 83.70 },
];
const seasons = [
  { crop: "rice", sowing: "2025-07-01", days: 140 },
  { crop: "wheat", sowing: "2025-11-15", days: 150 },
];
const results: any[] = [];
for (const p of points) for (const s of seasons) {
  const crop = { id: randomUUID(), crop_type: s.crop, sowing_date: s.sowing, field_id: randomUUID(),
    fields: { id: randomUUID(), latitude: p.latitude, longitude: p.longitude, boundary: null, area_sqm: 5000 } };
  try {
    let r: any = await computeCropTimeline(crop);
    for (let t = 0; t < 4 && r.soil?.source !== 'soilgrids'; t++) { await new Promise(res => setTimeout(res, 4000)); r = await computeCropTimeline(crop); }
    const tl = r.timeline.slice(0, s.days);
    const end = tl[tl.length - 1].date;
    const wx = await getHistoricalWeather(p.latitude, p.longitude, s.sowing, end);
    const pairs = tl.map((d: any) => ({ date: d.date, ours: d.eto, om: wx.get(d.date)?.et0_openmeteo, method: d.eto_method }))
      .filter((x: any) => x.om && x.om > 0);
    results.push({ point: p, season: s, soil: r.soil, water_model: r.water_model, timeline: tl.map((d: any) => ({
      date: d.date, day: d.day_number, gdd: d.cumulative_gdd, phase: d.phase, kc: d.kc, eto: d.eto, etc: d.etc, eta: d.eta, method: d.eto_method,
      rain: d.rainfall, dep: d.soil_depletion, taw: d.TAW, raw: d.RAW, ks: d.Ks, pond: d.ponded_depth_mm, flooded: d.flooded, health: d.health_score, status: d.status,
      tmax: d.temp_max, tmin: d.temp_min })), eto_pairs: pairs });
    console.log(p.id, s.crop, "ok", tl.length, "days; pairs", pairs.length, "soil", r.soil?.source);
  } catch (e: any) { console.log(p.id, s.crop, "FAILED", e.message); }
}
writeFileSync(OUT + "/e3_seasons.json", JSON.stringify(results));
