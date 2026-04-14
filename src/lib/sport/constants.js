// src/lib/sport/constants.js
// Single-source-of-truth for all sport science constants.
// Each group is frozen to prevent accidental mutation.

export const BANISTER = Object.freeze({
  TAU_CTL: 42,           // Fitness time constant (days) — Banister & Calvert 1980
  TAU_ATL: 7,            // Fatigue time constant (days) — Banister & Calvert 1980
  K_CTL: 1 - Math.exp(-1 / 42),  // EWMA coefficient for CTL
  K_ATL: 1 - Math.exp(-1 / 7),   // EWMA coefficient for ATL
})

export const ACWR = Object.freeze({
  OPTIMAL_MIN: 0.8,
  OPTIMAL_MAX: 1.3,
  CAUTION_MAX: 1.5,
  // Hulin et al. (2016) injury risk zones
})

export const ROWING = Object.freeze({
  PAULS_LAW_EXPONENT: 1.07,  // Paul (1969)
  STROKE_RATE_MIN: 16,
  STROKE_RATE_MAX: 44,
})

export const DANIELS = Object.freeze({
  // Daniels & Gilbert (1979) VDOT formula coefficients
  VO2_INTERCEPT: -4.60,
  VO2_V_COEF: 0.182258,
  VO2_V2_COEF: 0.000104,
  PCT_VO2MAX_A: -4.60,
  PCT_VO2MAX_B: 0.182258,
  PCT_VO2MAX_C: 0.000104,
  PCT_VO2MAX_D:  0.8,
  PCT_VO2MAX_E:  0.1894393,
  PCT_VO2MAX_F: -0.012778,
  PCT_VO2MAX_G:  0.2989558,
  PCT_VO2MAX_H: -0.1932605,
})

export const LACTATE = Object.freeze({
  DMAX_FIT_DEGREE: 3,      // Cheng et al. (1992) cubic polynomial
  LT1_FIXED_MMOL: 2.0,     // Fixed LT1 threshold (mmol/L)
  LT2_FIXED_MMOL: 4.0,     // Fixed LT2 threshold (mmol/L)
})
