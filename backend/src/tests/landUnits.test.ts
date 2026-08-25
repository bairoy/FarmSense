import test from "node:test";
import assert from "node:assert/strict";
import {
  toSquareMetres,
  fromSquareMetres,
  formatLocalArea,
  polygonAreaSqm,
  polygonCentroid,
  describeArea,
  sqmPerUnit,
  LAND_UNITS,
  UNIT_KEYS,
} from "../utils/landUnits.ts";

/**
 * Land units carry a fertilizer dose and an irrigation volume. A 2% area error
 * is a 2% chemical error across an entire field, so these constants are worth
 * pinning down exactly.
 *
 * Two separate things are tested here: that the ladder maths is correct for
 * ANY region (the generic behaviour), and that the numbers currently loaded
 * are the ones Gorakhpur actually uses (the calibration).
 */

const BIGHA = sqmPerUnit("bigha");
const KATHA = sqmPerUnit("katha");
const DHUR = sqmPerUnit("dhur");

test("the loaded region declares the UP pucca bigha ladder", () => {
  assert.equal(LAND_UNITS.system, "bigha-katha-dhur");
  assert.deepEqual(UNIT_KEYS, ["bigha", "katha", "dhur"]);

  // 1 pucca bigha = 3025 sq yd = 27,225 sq ft = 0.625 acre.
  // This is NOT the Nepal Terai bigha (6772 m2) the project previously used.
  assert.ok(Math.abs(BIGHA - 2529.285264) < 1e-6, `bigha = ${BIGHA}`);
  assert.ok(Math.abs(BIGHA / 4046.8564224 - 0.625) < 1e-4, "should be 0.625 acre");
});

test("the ladder is internally consistent", () => {
  assert.ok(Math.abs(KATHA - DHUR * 20) < 1e-9);
  assert.ok(Math.abs(BIGHA - KATHA * 20) < 1e-9);
});

test("levels are ordered largest first regardless of file order", () => {
  const sqms = LAND_UNITS.levels.map((l) => l.sqm);
  assert.deepEqual(sqms, [...sqms].sort((a, b) => b - a));
});

test("customary units convert to square metres", () => {
  assert.equal(toSquareMetres({ bigha: 1 }), BIGHA);
  assert.equal(toSquareMetres({ katha: 20 }), BIGHA);
  assert.equal(toSquareMetres({ dhur: 400 }), BIGHA);

  const mixed = toSquareMetres({ bigha: 2, katha: 5, dhur: 10 });
  assert.equal(mixed, 2 * BIGHA + 5 * KATHA + 10 * DHUR);
});

test("an unknown unit is rejected rather than silently ignored", () => {
  // Silently dropping an unrecognised component would under-report the area,
  // and under-report every dose derived from it.
  assert.throws(() => toSquareMetres({ kattha: 5 }), /Unknown land unit/);
  assert.throws(() => toSquareMetres({ biswa: 1 }), /Unknown land unit/);
});

test("conversion round-trips without drift", () => {
  // Round-tripping is what farmers actually see: they type an area, it is
  // stored in m2, and shown back to them. Drift here looks like the app
  // "changing" their land.
  for (const input of [
    { bigha: 3, katha: 12, dhur: 7 },
    { bigha: 0, katha: 1, dhur: 0 },
    { bigha: 10, katha: 0, dhur: 19 },
  ]) {
    assert.deepEqual(fromSquareMetres(toSquareMetres(input)), input);
  }
});

test("a whole sub-unit is never shown as a full carry of the one below", () => {
  // Regression. Subtracting square metres one level at a time drifts: 2 bigha
  // 5 katha left 4.9999999999999964 katha, floored to 4, and displayed the
  // farmer's own input back to them as "2 bigha 4 katha 20 dhur".
  assert.deepEqual(fromSquareMetres(toSquareMetres({ bigha: 2, katha: 5 })), {
    bigha: 2,
    katha: 5,
    dhur: 0,
  });
  assert.equal(formatLocalArea(toSquareMetres({ bigha: 2, katha: 5 })), "2 bigha 5 katha");
});

test("every whole combination on the ladder round-trips exactly", () => {
  // The three hand-picked cases above passed while the carry bug was live.
  // Sweep the space instead: any (bigha, katha, dhur) a farmer could type
  // must come back as the same three numbers.
  for (let bigha = 0; bigha <= 12; bigha++) {
    for (let katha = 0; katha < 20; katha++) {
      for (let dhur = 0; dhur < 20; dhur++) {
        const input = { bigha, katha, dhur };
        assert.deepEqual(
          fromSquareMetres(toSquareMetres(input)),
          input,
          `${bigha} bigha ${katha} katha ${dhur} dhur did not round-trip`
        );
      }
    }
  }
});

test("no component ever equals or exceeds its carry threshold", () => {
  // Independent of round-tripping: a displayed value with 20 katha in it is
  // wrong however it was produced, because 20 katha is 1 bigha.
  const levels = LAND_UNITS.levels;

  for (let i = 1; i < levels.length; i++) {
    const perParent = levels[i - 1].sqm / levels[i].sqm;
    for (const sqm of [0, 1, 6.3, 5690.891844, 10_000, 123_456.789]) {
      const value = fromSquareMetres(sqm)[levels[i].key];
      assert.ok(
        value < perParent,
        `${sqm} m2 gave ${value} ${levels[i].key}, which is a whole ${levels[i - 1].key}`
      );
    }
  }
});

test("negative areas are rejected", () => {
  assert.throws(() => toSquareMetres({ bigha: -1 }));
  assert.throws(() => fromSquareMetres(-5));
});

test("formatting omits zero components but never returns empty", () => {
  assert.equal(formatLocalArea(BIGHA), "1 bigha");
  assert.equal(formatLocalArea(KATHA), "1 katha");
  assert.equal(formatLocalArea(BIGHA + 3 * KATHA), "1 bigha 3 katha");
  // A plot smaller than one dhur still deserves an honest answer, not "".
  assert.ok(formatLocalArea(1).length > 0);
});

test("describeArea exposes every unit the system needs", () => {
  const described = describeArea(BIGHA);

  assert.equal(described.units.bigha, 1);
  assert.equal(described.area_label, "1 bigha");
  assert.equal(described.unit_system, "bigha-katha-dhur");
  assert.ok(Math.abs(described.hectares - 0.2529) < 0.001);
  assert.ok(Math.abs(described.acres - 0.625) < 0.001);
});

test("polygon area is correct for a known square", () => {
  // A 100m x 100m square = 1 hectare. Centred on Gorakhpur.
  const dLat = 100 / 111_320;
  const dLon = 100 / (111_320 * Math.cos((26.76 * Math.PI) / 180));

  const ring: [number, number][] = [
    [83.37, 26.76],
    [83.37 + dLon, 26.76],
    [83.37 + dLon, 26.76 + dLat],
    [83.37, 26.76 + dLat],
    [83.37, 26.76],
  ];

  const area = polygonAreaSqm(ring);
  // Within 2% of 10,000 m2 - well inside the error of a hand-traced boundary.
  assert.ok(Math.abs(area - 10_000) / 10_000 < 0.02, `got ${area} m2`);
});

test("polygon winding direction does not change the area", () => {
  // Farmers will trace boundaries in both directions.
  const ring: [number, number][] = [
    [83.37, 26.76],
    [83.371, 26.76],
    [83.371, 26.761],
    [83.37, 26.761],
  ];

  assert.equal(polygonAreaSqm(ring), polygonAreaSqm([...ring].reverse()));
});

test("degenerate polygons return zero rather than NaN", () => {
  assert.equal(polygonAreaSqm([]), 0);
  assert.equal(polygonAreaSqm([[83.37, 26.76]]), 0);
  assert.equal(
    polygonAreaSqm([
      [83.37, 26.76],
      [83.371, 26.76],
    ]),
    0
  );
});

test("centroid falls inside the polygon", () => {
  const centroid = polygonCentroid([
    [83.37, 26.76],
    [83.372, 26.76],
    [83.372, 26.762],
    [83.37, 26.762],
    [83.37, 26.76],
  ]);

  // The centroid, not a dropped pin, is what we hand to the weather and soil
  // APIs - it is guaranteed to be inside the plot.
  assert.ok(centroid.longitude > 83.37 && centroid.longitude < 83.372);
  assert.ok(centroid.latitude > 26.76 && centroid.latitude < 26.762);
});
