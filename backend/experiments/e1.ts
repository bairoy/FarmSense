import { calculateEto, saturationVapourPressure, vapourPressureSlope, psychrometricConstant, extraterrestrialRadiation } from "../src/modules/rules/eto.ts";
const es = (saturationVapourPressure(21.5) + saturationVapourPressure(12.3)) / 2;
const ea = (saturationVapourPressure(12.3) * 0.84 + saturationVapourPressure(21.5) * 0.63) / 2;
console.log("Uccle: es", es.toFixed(3), "ea", ea.toFixed(3), "RHmean", (100 * ea / es).toFixed(1));
console.log("ETo Uccle (Rs 22.07):", calculateEto({ tempMaxC: 21.5, tempMinC: 12.3, humidityPct: 100 * ea / es, windSpeed2m: 2.078, solarRadiationMj: 22.07, latitude: 50.8, elevationM: 100, dayOfYear: 187 }));
console.log("es(24.5)", saturationVapourPressure(24.5).toFixed(3), "delta(30)", vapourPressureSlope(30).toFixed(4), "gamma(1800m)", psychrometricConstant(1800).toFixed(4), "Ra(-20,doy246)", extraterrestrialRadiation(-20, 246).toFixed(2));
