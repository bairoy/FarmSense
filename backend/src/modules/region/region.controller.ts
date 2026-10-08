import type { Request, Response } from "../../types/http.ts";
import { activeRegionName, loadActiveRegion } from "../rules/rules.loader.ts";

/**
 * Publishes the parts of the region calibration the client legitimately needs.
 *
 * Chiefly the customary land-unit ladder. Before this existed the frontend
 * carried its own copy of the bigha/katha/dhur constants with a comment asking
 * whoever edited one to remember to edit the other - which is exactly the kind
 * of duplication that survives a district change and then silently mis-sizes
 * every fertilizer dose.
 *
 * Deliberately NOT everything in the file: Kc curves, GDD boundaries and paddy
 * geometry are inputs to the engine, not to the UI, and shipping them would
 * invite a client to start doing agronomy of its own.
 */
export const getRegionHandler = async (_req: Request, res: Response) => {
  const region = loadActiveRegion();

  res.json({
    key: activeRegionName(),
    name: region.region,
    coordinates: region.coordinates,
    bounds: region.bounds,
    land_units: {
      system: region.land_units.system,
      description: region.land_units.description,
      levels: region.land_units.levels.map(
        (level: { key: string; label: string; label_local: string; sqm: number }) => ({
          key: level.key,
          label: level.label,
          label_local: level.label_local,
          sqm: level.sqm,
        })
      ),
    },
    crops: Object.entries(region.crops).map(
      ([key, crop]: [string, any]) => ({
        key,
        variety: crop.variety,
        season: crop.season,
        water_model: crop.water_model,
      })
    ),
  });
};
