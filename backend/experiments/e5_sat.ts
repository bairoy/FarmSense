import "dotenv/config";
import { writeFileSync, appendFileSync } from "node:fs";
import { fetchBackscatter, detectTransplant } from "../src/modules/satellite/sentinel1.service.ts";
import { fetchNdvi } from "../src/modules/satellite/sentinel2.service.ts";
const OUT = new URL("./results", import.meta.url).pathname;
const lats = [26.4, 26.6, 26.8, 27.0], lons = [83.2, 83.4, 83.6];   // pre-specified 4x3 grid; no point chosen or dropped after seeing data
const poly = (lat: number, lon: number, d = 0.002): any => ({ type: "Polygon", coordinates: [[[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d],[lon-d,lat-d]]] });
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const windows = (start: string, end: string, step: number) => { const w: [string,string][] = []; for (let t = Date.parse(start); t < Date.parse(end); t += step * 86400000) w.push([iso(t), iso(t + (step - 1) * 86400000)]); return w; };
const pool = async <T,R>(items: T[], n: number, fn: (x: T) => Promise<R>) => { const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; };

const res: any[] = [];
for (const lat of lats) for (const lon of lons) {
  const g = poly(lat, lon);
  const s1w = windows("2025-06-01", "2025-09-16", 6), s2w = windows("2025-11-15", "2026-04-15", 10);
  const s1 = await pool(s1w, 1, async ([a, b]) => { try { return await fetchBackscatter(g, a, b); } catch (e: any) { return { err: e.message } as any; } });
  const s2 = await pool(s2w, 1, async ([a, b]) => { try { return await fetchNdvi(g, a, b, 80); } catch (e: any) { return { err: e.message } as any; } });
  const s1ok = s1.filter((x: any) => x && !x.err);
  const dedup = Array.from(new Map(s1ok.map((x: any) => [x.date, x])).values());
  const det = detectTransplant(dedup as any);
  res.push({ lat, lon, s1: dedup, s1_errors: s1.filter((x: any) => x?.err).length, s1_windows: s1w.length, detection: det, s2, s2_errors: s2.filter((x: any) => x?.err).length });
  appendFileSync(OUT + "/e5_progress.log", `${lat},${lon} done ${new Date().toISOString()}\n`);
  writeFileSync(OUT + "/e5.json", JSON.stringify(res));
  console.log(lat, lon, "S1 obs", dedup.length, "detected", det.detected, det.transplantDate, "minVH", det.minVhDb, "| S2 usable", s2.filter((x: any) => x?.usable).length, "/", s2w.length, "err", s2.filter((x: any) => x?.err).length);
}
writeFileSync(OUT + "/e5.json", JSON.stringify(res));
