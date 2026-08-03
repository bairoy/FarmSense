import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateEto,
  calculateEtoHargreaves,
  saturationVapourPressure,
  vapourPressureSlope,
  psychrometricConstant,
  extraterrestrialRadiation,
  dayOfYear,
} from "../modules/rules/eto.ts";

/**
 * FAO-56 Penman-Monteith.
 *
 * The first three tests check against the worked examples in FAO-56 itself,
 * which is the only way to know the implementation is right rather than just
 * self-consistent. Getting ETo wrong by 20% means every irrigation volume this
 * system recommends is wrong by 20%, and nothing downstream would notice.
 */

test("saturation vapour pressure matches FAO-56 Example 3", () => {
  // FAO-56 Example 3: at 24.5C, e(T) = 3.075 kPa
  assert.ok(Math.abs(saturationVapourPressure(24.5) - 3.075) < 0.005);
  // at 15C, e(T) = 1.705 kPa
  assert.ok(Math.abs(saturationVapourPressure(15) - 1.705) < 0.005);
});

test("vapour pressure slope matches FAO-56 Example 5", () => {
  // FAO-56 Example 5: at 30C, delta = 0.2445 kPa/degC
  assert.ok(Math.abs(vapourPressureSlope(30) - 0.2445) < 0.002);
});

test("psychrometric constant matches FAO-56 Example 2", () => {
  // FAO-56 Example 2: at 1800m elevation, gamma = 0.054 kPa/degC
  assert.ok(Math.abs(psychrometricConstant(1800) - 0.054) < 0.001);
  // At sea level it is ~0.0674
  assert.ok(Math.abs(psychrometricConstant(0) - 0.0674) < 0.001);
});

test("extraterrestrial radiation matches FAO-56 Example 8", () => {
  // FAO-56 Example 8: 3 September (day 246) at latitude -20 deg, Ra = 32.2
  const ra = extraterrestrialRadiation(-20, 246);
  assert.ok(Math.abs(ra - 32.2) < 0.5, `expected ~32.2, got ${ra}`);
});

test("ETo for a hot dry Terai day sits in the expected range", () => {
  // Siraha in late April: hot, moderate humidity, decent radiation.
  const eto = calculateEto({
    tempMaxC: 38,
    tempMinC: 24,
    humidityPct: 45,
    windSpeed2m: 2.0,
    solarRadiationMj: 22,
    latitude: 26.65,
    elevationM: 100,
    dayOfYear: 115,
  });

  // Published ETo for the Terai pre-monsoon runs roughly 5-8 mm/day.
  assert.ok(eto > 4.5 && eto < 9, `expected 4.5-9 mm/day, got ${eto}`);
});

test("ETo for a cool humid winter day is much lower", () => {
  // Siraha in January - the wheat season.
  const eto = calculateEto({
    tempMaxC: 22,
    tempMinC: 8,
    humidityPct: 80,
    windSpeed2m: 1.2,
    solarRadiationMj: 13,
    latitude: 26.65,
    elevationM: 100,
    dayOfYear: 15,
  });

  assert.ok(eto > 0.8 && eto < 3.5, `expected 0.8-3.5 mm/day, got ${eto}`);
});

test("higher wind raises ETo at fixed temperature and radiation", () => {
  const base = {
    tempMaxC: 32,
    tempMinC: 20,
    humidityPct: 50,
    solarRadiationMj: 20,
    latitude: 26.65,
    elevationM: 100,
    dayOfYear: 100,
  };

  // This is the aerodynamic term doing its job. The old heuristic
  // (`evap = tempMax * 0.2`) could not represent this at all: a still day and
  // a windy day at the same temperature had identical modelled water loss.
  const still = calculateEto({ ...base, windSpeed2m: 0.5 });
  const windy = calculateEto({ ...base, windSpeed2m: 5.0 });

  assert.ok(windy > still, `windy ${windy} should exceed still ${still}`);
});

test("higher humidity lowers ETo", () => {
  const base = {
    tempMaxC: 32,
    tempMinC: 20,
    windSpeed2m: 2,
    solarRadiationMj: 20,
    latitude: 26.65,
    elevationM: 100,
    dayOfYear: 100,
  };

  assert.ok(
    calculateEto({ ...base, humidityPct: 90 }) <
      calculateEto({ ...base, humidityPct: 30 })
  );
});

test("ETo is never negative", () => {
  // A cold overcast day can drive the radiation term negative. Physically that
  // means no evaporation, not water we get to bank against tomorrow.
  const eto = calculateEto({
    tempMaxC: 5,
    tempMinC: -2,
    humidityPct: 95,
    windSpeed2m: 0.5,
    solarRadiationMj: 1,
    latitude: 26.65,
    elevationM: 100,
    dayOfYear: 1,
  });

  assert.ok(eto >= 0, `ETo must not be negative, got ${eto}`);
});

test("Hargreaves fallback lands in the same ballpark as Penman-Monteith", () => {
  const pm = calculateEto({
    tempMaxC: 35,
    tempMinC: 22,
    humidityPct: 55,
    windSpeed2m: 2,
    solarRadiationMj: 21,
    latitude: 26.65,
    elevationM: 100,
    dayOfYear: 150,
  });

  const hs = calculateEtoHargreaves(35, 22, 26.65, 150);

  // Hargreaves is the degraded path used when radiation/wind are missing. It
  // should be close enough to be useful but is expected to differ - which is
  // exactly why a day computed this way lowers the reported confidence.
  assert.ok(Math.abs(pm - hs) < 3, `PM ${pm} vs HS ${hs} diverge too far`);
});

test("dayOfYear handles boundaries", () => {
  assert.equal(dayOfYear(new Date("2026-01-01T00:00:00Z")), 1);
  assert.equal(dayOfYear(new Date("2026-12-31T00:00:00Z")), 365);
});
