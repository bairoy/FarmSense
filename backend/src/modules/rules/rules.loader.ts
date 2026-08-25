// src/modules/rules/rules.loader.ts

import fs from "node:fs";

/**
 * Loads a region calibration file, e.g. 'gorakhpur'.
 *
 * Region configs hold everything that is location-specific: FAO-56 Kc values,
 * GDD phase boundaries, base temperatures, root depths, paddy geometry, and
 * the customary land-unit ladder. They are the only place those constants live.
 *
 * Moving to a new district means adding a file here and pointing
 * DEFAULT_REGION at it - not editing code. Constants that vary by place must
 * never be inlined elsewhere, because the failure mode is silent: a bigha in
 * one district is 2.7x a bigha in another, and every fertilizer dose derived
 * from the wrong one is wrong by that factor without anything erroring.
 *
 * This replaced `agronomic.rules.json`, which keyed thresholds on
 * (crop, phase) using a 0-100 soil moisture scale. That scale is meaningless
 * for a flooded paddy, and the phase boundaries were calendar-based rather
 * than thermal - both superseded by the region config plus the water models.
 *
 * Cached per region: these files are small, read-only, and re-reading them on
 * every timeline recompute would put a synchronous disk read in a hot path.
 */
const cache = new Map<string, any>();

export function loadRegionConfig(regionName: string) {
  const cached = cache.get(regionName);
  if (cached) return cached;

  const filePath = new URL(`./regions/${regionName}.json`, import.meta.url);
  const config = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  cache.set(regionName, config);
  return config;
}

/**
 * The region the server is currently calibrated for.
 *
 * Read straight from process.env rather than through config/env.ts, which
 * throws on a missing Supabase key - the region config must stay loadable by a
 * unit test with no environment at all.
 */
export const activeRegionName = (): string =>
  process.env.DEFAULT_REGION ?? "gorakhpur";

export const loadActiveRegion = () => loadRegionConfig(activeRegionName());
