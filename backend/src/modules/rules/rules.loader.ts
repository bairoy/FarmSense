// src/modules/rules/rules.loader.ts

import fs from "node:fs";

/**
 * Loads a region calibration file, e.g. 'siraha'.
 *
 * Region configs hold everything that is location-specific: FAO-56 Kc values,
 * GDD phase boundaries, base temperatures, root depths, and paddy geometry.
 * They are the only place those constants live.
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
