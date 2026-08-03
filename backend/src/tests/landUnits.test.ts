import test from "node:test";
import assert from "node:assert/strict";
import {
  toSquareMetres,
  fromSquareMetres,
  formatNepaliArea,
  polygonAreaSqm,
  polygonCentroid,
  describeArea,
  SQM_PER_BIGHA,
  SQM_PER_KATTHA,
  SQM_PER_DHUR,
} from "../utils/landUnits.ts";

/**
 * Land units carry a fertilizer dose and an irrigation volume. A 2% area error
 * is a 2% chemical error across an entire field, so these constants are worth
 * pinning down exactly.
 */

test("unit constants follow the Terai system exactly", () => {
  assert.equal(SQM_PER_KATTHA, SQM_PER_DHUR * 20);
  assert.equal(SQM_PER_BIGHA, SQM_PER_KATTHA * 20);
  assert.equal(SQM_PER_DHUR, 16.93);

  // 1 bigha ~ 0.6772 hectares, the figure used across the Terai.
  assert.ok(Math.abs(SQM_PER_BIGHA / 10000 - 0.6772) < 0.001);
});

test("bigha/kattha/dhur converts to square metres", () => {
  assert.equal(toSquareMetres({ bigha: 1 }), SQM_PER_BIGHA);
  assert.equal(toSquareMetres({ kattha: 20 }), SQM_PER_BIGHA);
  assert.equal(toSquareMetres({ dhur: 400 }), SQM_PER_BIGHA);

  const mixed = toSquareMetres({ bigha: 2, kattha: 5, dhur: 10 });
  assert.equal(mixed, 2 * SQM_PER_BIGHA + 5 * SQM_PER_KATTHA + 10 * SQM_PER_DHUR);
});

test("conversion round-trips without drift", () => {
  // Round-tripping is what farmers actually see: they type an area, it is
  // stored in m2, and shown back to them. Drift here looks like the app
  // "changing" their land.
  for (const input of [
    { bigha: 3, kattha: 12, dhur: 7 },
    { bigha: 0, kattha: 1, dhur: 0 },
    { bigha: 10, kattha: 0, dhur: 19 },
  ]) {
    const back = fromSquareMetres(toSquareMetres(input));
    assert.deepEqual(back, {
      bigha: input.bigha,
      kattha: input.kattha,
      dhur: input.dhur,
    });
  }
});

test("negative areas are rejected", () => {
  assert.throws(() => toSquareMetres({ bigha: -1 }));
  assert.throws(() => fromSquareMetres(-5));
});

test("formatting omits zero components but never returns empty", () => {
  assert.equal(formatNepaliArea(SQM_PER_BIGHA), "1 bigha");
  assert.equal(formatNepaliArea(SQM_PER_KATTHA), "1 kattha");
  assert.equal(
    formatNepaliArea(SQM_PER_BIGHA + 3 * SQM_PER_KATTHA),
    "1 bigha 3 kattha"
  );
  // A plot smaller than one dhur still deserves an honest answer, not "".
  assert.ok(formatNepaliArea(5).length > 0);
});

test("describeArea exposes every unit the system needs", () => {
  const described = describeArea(SQM_PER_BIGHA);

  assert.equal(described.nepali.bigha, 1);
  assert.ok(Math.abs(described.hectares - 0.6772) < 0.001);
  assert.ok(described.acres > 1.6 && described.acres < 1.7);
});

test("polygon area is correct for a known square", () => {
  // A 100m x 100m square = 1 hectare. At 26.65N, 100m is about 0.000899 deg
  // latitude and 0.001005 deg longitude.
  const dLat = 100 / 111_320;
  const dLon = 100 / (111_320 * Math.cos((26.65 * Math.PI) / 180));

  const ring: [number, number][] = [
    [86.2, 26.65],
    [86.2 + dLon, 26.65],
    [86.2 + dLon, 26.65 + dLat],
    [86.2, 26.65 + dLat],
    [86.2, 26.65],
  ];

  const area = polygonAreaSqm(ring);
  // Within 2% of 10,000 m2 - well inside the error of a hand-traced boundary.
  assert.ok(Math.abs(area - 10_000) / 10_000 < 0.02, `got ${area} m2`);
});

test("polygon winding direction does not change the area", () => {
  // Farmers will trace boundaries in both directions.
  const ring: [number, number][] = [
    [86.2, 26.65],
    [86.201, 26.65],
    [86.201, 26.651],
    [86.2, 26.651],
  ];

  assert.equal(polygonAreaSqm(ring), polygonAreaSqm([...ring].reverse()));
});

test("degenerate polygons return zero rather than NaN", () => {
  assert.equal(polygonAreaSqm([]), 0);
  assert.equal(polygonAreaSqm([[86.2, 26.65]]), 0);
  assert.equal(
    polygonAreaSqm([
      [86.2, 26.65],
      [86.201, 26.65],
    ]),
    0
  );
});

test("centroid falls inside the polygon", () => {
  const centroid = polygonCentroid([
    [86.2, 26.65],
    [86.202, 26.65],
    [86.202, 26.652],
    [86.2, 26.652],
    [86.2, 26.65],
  ]);

  // The centroid, not a dropped pin, is what we hand to the weather and soil
  // APIs - it is guaranteed to be inside the plot.
  assert.ok(centroid.longitude > 86.2 && centroid.longitude < 86.202);
  assert.ok(centroid.latitude > 26.65 && centroid.latitude < 26.652);
});
