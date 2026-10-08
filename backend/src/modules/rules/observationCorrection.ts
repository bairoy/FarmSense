/**
 * Turning a farmer's answer into a correction of the simulated state.
 *
 * This is the "correct" half of predict -> observe -> correct, for the one
 * observation channel that needs no instrument: the person standing in the
 * field. A satellite measures canopy vigour every few days at best, and not at
 * all through monsoon cloud. The farmer can answer "is there standing water"
 * every day, for free, and is never wrong about it in the way a 10m pixel can
 * be.
 *
 * `checkin.service.ts` already decides WHAT a given answer implies - that is a
 * deliberate separation, because the mapping from "the soil is cracked" to
 * "depletion is at least 90% of TAW" is agronomy, and belongs next to the
 * questions. This module decides HOW HARD to apply that implication to a
 * running simulation, which is estimation, not agronomy.
 *
 * Three properties the design has to have:
 *
 *   1. **Qualitative answers become bounds, not point values.** "Cracked soil"
 *      does not mean depletion is exactly 0.9 x TAW; it means it is at least
 *      that. Writing a point value would invent precision the farmer never
 *      supplied, and would *lower* the estimate for a field that was drier
 *      still.
 *
 *   2. **Confidence scales the pull.** The stored corrections carry their own
 *      confidence - 0.95 for a farmer confirming flowering they can see, 0.7
 *      for inferring depletion from a dry-looking surface. A correction should
 *      move the state in proportion to how much the answer actually pins it
 *      down, so a hedged observation nudges and a certain one effectively sets.
 *
 *   3. **Nothing is clamped silently.** Every function reports how far it moved
 *      the state, so the engine can tell the confidence model that an
 *      observation disagreed with the simulation - which is exactly the
 *      situation where the estimate deserves a wider band.
 *
 * All functions here are pure. The engine holds the loop-carried state; this
 * module only answers "given this state and this answer, what should the state
 * become".
 */

/**
 * The shape `interpretAnswer` stores on an answered check-in.
 *
 * Every field is optional because each question produces only the keys relevant
 * to it - a flooding answer carries no opinion about health score.
 */
export type ObservationCorrection = {
  /** Rice: the farmer reports standing water of about this depth. */
  set_ponded_depth_mm?: number;

  /** Wheat: depletion is at least / at most this fraction of TAW. */
  depletion_at_least_fraction_of_TAW?: number;
  depletion_at_most_fraction_of_TAW?: number;

  /** Visible crop condition bounds the health score from above / below. */
  health_score_ceiling?: number;
  health_score_floor?: number;

  /** Phenology re-anchoring. */
  confirm_phase?: string;
  phase_not_reached?: string;

  /** A parameter, not a state, is wrong. See `recalibration.ts`. */
  recalibrate?: string;

  /** How much the answer pins the value down, 0-1. */
  confidence?: number;

  /**
   * Where the observation came from. A photo is an instrument reading, not a
   * person's statement, so it is worded differently and is only acted on when
   * it disagrees with the simulation by more than its own noise.
   */
  origin?: "photo";
  /** Ignore the bound unless it differs from the simulation by more than this (health points). */
  min_discrepancy?: number;

  note?: string;
};

/** What a correction did, so the caller can report and audit it. */
export type CorrectionEffect<T> = {
  value: T;
  /** Absolute magnitude of the change. Zero means the observation agreed. */
  moved: number;
  note: string | null;
};

const none = <T>(value: T): CorrectionEffect<T> => ({
  value,
  moved: 0,
  note: null,
});

/**
 * Default pull for a correction that did not record its own confidence.
 *
 * Deliberately not 1.0. A correction with no stated confidence is one whose
 * author did not think about how certain it was, and that is not grounds for
 * overwriting a physical simulation outright.
 */
const DEFAULT_CONFIDENCE = 0.8;

const pull = (correction: ObservationCorrection): number =>
  Math.max(0, Math.min(1, correction.confidence ?? DEFAULT_CONFIDENCE));

/**
 * Move `current` toward `target` in proportion to confidence.
 *
 * At confidence 1 the observation wins outright; at 0 the simulation is left
 * alone. The linear interpolation between is the simplest rule that behaves
 * correctly at both ends, and - unlike a Kalman gain - needs no variance
 * estimate for a simulator whose error is not characterised.
 */
export const blendToward = (
  current: number,
  target: number,
  confidence: number
): number => current + (target - current) * Math.max(0, Math.min(1, confidence));

/**
 * Rice: the farmer says how much standing water there is.
 *
 * This is the highest-value observation in the whole system. Ponded depth *is*
 * the paddy model's state, and percolation - the largest unknown in it - is
 * only observable through how fast that depth falls.
 */
export const applyPondedDepth = (
  currentMm: number,
  correction: ObservationCorrection
): CorrectionEffect<number> => {
  const target = correction.set_ponded_depth_mm;
  if (target === undefined) return none(currentMm);

  const value = Math.max(0, blendToward(currentMm, target, pull(correction)));
  const moved = Math.abs(value - currentMm);

  return {
    value,
    moved,
    note:
      moved < 1
        ? null
        : `Farmer reported ${target} mm standing water; simulation had ${currentMm.toFixed(0)} mm.`,
  };
};

/**
 * Wheat: bound root-zone depletion from what the soil surface looks like.
 *
 * A bound, never an assignment. If the farmer reports cracked soil and the
 * simulation is already drier than the implied floor, the simulation is not
 * contradicted and must be left alone - it may well be right, and pulling it
 * *down* to the bound would make the estimate worse using an observation that
 * agreed with it.
 */
export const applyDepletionBound = (
  currentMm: number,
  tawMm: number,
  correction: ObservationCorrection
): CorrectionEffect<number> => {
  const atLeast = correction.depletion_at_least_fraction_of_TAW;
  const atMost = correction.depletion_at_most_fraction_of_TAW;

  if (atLeast === undefined && atMost === undefined) return none(currentMm);
  if (tawMm <= 0) return none(currentMm);

  let value = currentMm;
  let reason: string | null = null;

  if (atLeast !== undefined) {
    const floor = atLeast * tawMm;
    if (currentMm < floor) {
      value = blendToward(currentMm, floor, pull(correction));
      reason = `Field observation implies depletion of at least ${floor.toFixed(0)} mm (${(atLeast * 100).toFixed(0)}% of TAW); simulation had ${currentMm.toFixed(0)} mm.`;
    }
  }

  if (atMost !== undefined) {
    const ceiling = atMost * tawMm;
    if (value > ceiling) {
      value = blendToward(value, ceiling, pull(correction));
      reason = `Field observation implies depletion of at most ${ceiling.toFixed(0)} mm (${(atMost * 100).toFixed(0)}% of TAW); simulation had ${currentMm.toFixed(0)} mm.`;
    }
  }

  // Depletion is physically bounded by the soil's capacity to hold water.
  value = Math.max(0, Math.min(tawMm, value));

  return { value, moved: Math.abs(value - currentMm), note: reason };
};

/**
 * Bound the health score by what the farmer can see.
 *
 * The simulation infers health from water and heat stress. It cannot see
 * nitrogen deficiency, pest damage, or a waterlogged corner - all of which the
 * farmer reports as "most of the field looks bad". A ceiling lets that
 * observation cap an optimistic simulation without pretending to know the cause.
 */
export const applyHealthBounds = (
  score: number,
  correction: ObservationCorrection
): CorrectionEffect<number> => {
  const ceiling = correction.health_score_ceiling;
  const floor = correction.health_score_floor;

  if (ceiling === undefined && floor === undefined) return none(score);

  let value = score;
  let reason: string | null = null;

  if (
    ceiling !== undefined &&
    value > ceiling &&
    value - ceiling > (correction.min_discrepancy ?? 0)
  ) {
    value = blendToward(value, ceiling, pull(correction));
    reason =
      correction.origin === "photo"
        ? `A dated crop photo shows disease the weather-driven model did not predict; health lowered from ${score.toFixed(0)} to ${value.toFixed(0)}.`
        : `Farmer reports visible stress the weather-driven model did not predict; health capped from ${score.toFixed(0)}.`;
  }

  if (floor !== undefined && value < floor) {
    value = blendToward(value, floor, pull(correction));
    reason = `Farmer reports the crop looks healthy; simulated health of ${score.toFixed(0)} raised toward ${floor}.`;
  }

  value = Math.max(0, Math.min(100, value));
  return { value, moved: Math.abs(value - score), note: reason };
};

export type Phase = { name: string; gdd_start: number; gdd_end: number };

/**
 * Re-anchor thermal time against an observed phenological event.
 *
 * GDD phase boundaries are varietal averages. A real crop in a real field
 * reaches flowering when it reaches it, and the farmer can see that happen.
 * Because every later boundary and every Kc value is indexed off cumulative
 * GDD, a confirmation here re-anchors the entire remaining season - which makes
 * it the highest-leverage correction available, and the reason
 * `flowering_confirm` carries a 0.95 confidence.
 *
 * Returns a GDD offset for the engine to carry forward, rather than mutating
 * the accumulator, so the underlying thermal sum stays a pure function of
 * weather and the correction stays inspectable.
 */
export const phaseAnchorOffset = (
  cumulativeGdd: number,
  phases: Phase[],
  correction: ObservationCorrection
): CorrectionEffect<number> => {
  const confirmed = correction.confirm_phase;
  const notReached = correction.phase_not_reached;

  if (!confirmed && !notReached) return none(0);

  const target = phases.find((p) => p.name === (confirmed ?? notReached));
  if (!target) return none(0);

  if (confirmed) {
    // The farmer sees the phase; the model has not reached it. Advance thermal
    // time to the boundary. If the model is already past it, it agrees - and
    // pulling it *back* would discard correct accumulated heat.
    if (cumulativeGdd >= target.gdd_start) return none(0);

    const offset = blendToward(0, target.gdd_start - cumulativeGdd, pull(correction));
    return {
      value: offset,
      moved: offset,
      note: `Farmer confirms ${target.name} has begun; thermal time advanced ${offset.toFixed(0)} GDD to re-anchor the phenology model.`,
    };
  }

  // The model claims the phase; the farmer says not yet. Hold thermal time
  // just below the boundary.
  if (cumulativeGdd < target.gdd_start) return none(0);

  const offset = blendToward(0, target.gdd_start - 1 - cumulativeGdd, pull(correction));
  return {
    value: offset,
    moved: Math.abs(offset),
    note: `Farmer reports ${target.name} has not started; the GDD model was running ahead and has been held back ${Math.abs(offset).toFixed(0)} GDD.`,
  };
};
