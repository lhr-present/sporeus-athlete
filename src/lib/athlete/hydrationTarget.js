// ─── hydrationTarget.js — Daily + per-session hydration targets ─────────────
//
// Surfaces athlete-specific hydration targets grounded in the ACSM Position
// Stand on Exercise and Fluid Replacement (Sawka et al. 2007) with sodium
// guidance per Casa 2000. Distinct from `eliteProgramFueling` — fueling is
// carbohydrate/protein/fat periodisation; this module is fluid + electrolyte
// only. Both can run independently for the same session.
//
// Inputs come from the dashboard scope:
//   - profile.weight (kg) — required; null result if missing
//   - plannedSession   — today's session payload from getTodayPlannedSession
//   - today            — ISO date string (unused for math but passed through
//                        so callers can memoise on the date boundary)
//   - climate          — 'cool' | 'temperate' | 'hot' (default 'temperate')
//
// Returns:
//   {
//     dailyMl, preSessionMl, perHourFluidMl, perHourSodiumMg,
//     postSessionMlPerKgLost, citation, eligibleSession
//   }
// or null when weight is missing / not a positive number.
//
// References:
//   Sawka MN et al. 2007. ACSM Position Stand: Exercise and Fluid
//     Replacement. Med Sci Sports Exerc 39(2):377–390.
//   Casa DJ et al. 2000. NATA Position Statement: Fluid Replacement for
//     Athletes. J Athl Train 35(2):212–224.

export const HYDRATION_TARGET_CITATION =
  'Sawka 2007 ACSM Position Stand; Casa 2000'

const DAILY_ML_PER_KG = 40
const PRE_SESSION_ML = 500
const POST_SESSION_ML_PER_KG_LOST = 1500
const PER_HOUR_FLUID_CAP_ML = 1000

const PER_HOUR_FLUID_BY_CLIMATE = {
  cool: 500,
  temperate: 600,
  hot: 800,
}

const PER_HOUR_SODIUM_BY_CLIMATE = {
  cool: 500,
  temperate: 700,
  hot: 1000,
}

function toPositiveNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * @param {{
 *   profile?: { weight?: number|string },
 *   plannedSession?: { duration?: number, type?: string } | null,
 *   today?: string,
 *   climate?: 'cool'|'temperate'|'hot',
 * }} args
 */
export function computeHydrationTarget({
  profile,
  plannedSession,
  // eslint-disable-next-line no-unused-vars
  today,
  climate = 'temperate',
} = {}) {
  const weightKg = toPositiveNumber(profile?.weight)
  if (!weightKg) return null

  const climateKey = PER_HOUR_FLUID_BY_CLIMATE[climate] != null
    ? climate
    : 'temperate'

  const perHourFluidMl = Math.min(
    PER_HOUR_FLUID_BY_CLIMATE[climateKey],
    PER_HOUR_FLUID_CAP_ML,
  )
  const perHourSodiumMg = PER_HOUR_SODIUM_BY_CLIMATE[climateKey]

  return {
    dailyMl: Math.round(DAILY_ML_PER_KG * weightKg),
    preSessionMl: PRE_SESSION_ML,
    perHourFluidMl,
    perHourSodiumMg,
    postSessionMlPerKgLost: POST_SESSION_ML_PER_KG_LOST,
    citation: HYDRATION_TARGET_CITATION,
    eligibleSession: plannedSession || null,
  }
}

export default computeHydrationTarget
