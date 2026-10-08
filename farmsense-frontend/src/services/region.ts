import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * The active region's calibration, fetched from the backend.
 *
 * The unit ladder used to be duplicated in the frontend as three constants with
 * a comment asking whoever changed one to remember the other. That survives
 * exactly until someone changes districts: a bigha is 2529 m2 in Gorakhpur and
 * 6772 m2 in the Nepal Terai, and a stale copy here would show the farmer a
 * live area preview 2.7x off the value the backend actually stores.
 *
 * One source of truth, served from the region config the engine itself reads.
 */

export type LandUnitLevel = {
  key: string;
  label: string;
  /** The same label in the local script, shown alongside the English one. */
  label_local: string;
  sqm: number;
};

export type Region = {
  key: string;
  name: string;
  coordinates: { latitude: number; longitude: number };
  bounds?: { south: number; north: number; west: number; east: number };
  land_units: {
    system: string;
    description: string;
    /** Largest unit first. */
    levels: LandUnitLevel[];
  };
  crops: {
    key: string;
    variety: string;
    season: string;
    water_model: string;
  }[];
};

/**
 * Module-level cache. The region never changes within a session, and several
 * screens need it, so this resolves once per page load rather than once per
 * component mount.
 */
let cached: Promise<Region> | null = null;

export const fetchRegion = (): Promise<Region> => {
  if (!cached) {
    cached = api
      .get<Region>("/region")
      .then((res) => res.data)
      .catch((err) => {
        // Clear the cache so a transient failure does not poison every later
        // caller for the rest of the session.
        cached = null;
        throw err;
      });
  }
  return cached;
};

export function useRegion() {
  const [region, setRegion] = useState<Region | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchRegion()
      .then((r) => active && setRegion(r))
      .catch(() => active && setError("Could not load region settings."));

    return () => {
      active = false;
    };
  }, []);

  return { region, error, loading: region === null && error === null };
}

/** Customary units -> square metres, using the ladder the backend published. */
export const areaToSqm = (
  value: Record<string, number>,
  levels: LandUnitLevel[]
): number =>
  levels.reduce((total, level) => total + (value[level.key] || 0) * level.sqm, 0);

/** A zeroed value object with one entry per unit in the ladder. */
export const emptyArea = (levels: LandUnitLevel[]): Record<string, number> =>
  Object.fromEntries(levels.map((level) => [level.key, 0]));
