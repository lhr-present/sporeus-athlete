// supabase/functions/_shared/stravaActivity.ts — ONE Strava SummaryActivity →
// training_log row mapper, shared by strava-oauth (action:'sync') and
// strava-backfill-worker. These two previously carried duplicated copies of
// mapStravaType/estimateTSS/estimateZones/resolveProfileMaxHR that had already
// drifted (different estimateZones signatures); every past mapping bug (v9.460
// Rowing→other, maxHR 190, moving_time=0) had to be fixed twice. Single source
// of truth from v9.465 on.
//
// v9.465 enrichment (P0 of docs/audits/strava_data_enhancements_2026_07_03.md):
// persists power (gated on device_watts), elevation, kilojoules, activity max
// HR, suffer score, session clock time, and an HONEST derived RPE — and uses
// Coggan power-TSS as the headline TSS when NP + FTP are known (the exact
// FIT-import precedent, src/lib/fileImport.js v9.58).

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export function mapStravaType(sportType: string): string {
  const m: Record<string, string> = {
    Run: "run", TrailRun: "run", VirtualRun: "run",
    // GravelRide was in the client map but missing here (audit 2026-07-04 MED-3)
    // → gravel rides typed 'other', excluded from every cycling gate/card.
    Ride: "bike", EBikeRide: "bike", VirtualRide: "bike", MountainBikeRide: "bike", GravelRide: "bike",
    Swim: "swim", OpenWaterSwim: "swim",
    Walk: "walk", Hike: "walk",
    WeightTraining: "strength", Yoga: "other", Workout: "other",
    // "row" matches the app's rowing vocabulary: /row/i is what the sport-gating
    // detectors test on entry.type (rowingSplitConsistency, derivedSessionTargets,
    // goalActivityMismatch) and normalizeSport maps row→Rowing.
    Rowing: "row", Kayaking: "row", Canoeing: "row",
    Crossfit: "strength",
  }
  return m[sportType] || "other"
}

// TRIMP-based TSS estimate — no LTHR needed, uses max HR.
// maxHR may be null (no real activity max + no profile max) → duration-only fallback.
export function estimateTSS(durationS: number, avgHR: number | null, maxHR: number | null): number {
  if (!avgHR || !maxHR || maxHR <= 0) return Math.round(durationS / 3600 * 50)
  const hrFrac = Math.min(avgHR / maxHR, 1)
  const trimp  = (durationS / 60) * hrFrac * 0.64 * Math.exp(1.92 * hrFrac)
  return Math.round(trimp * 1.2)
}

// Coggan 2003 power TSS — mirrors computePowerTSS in src/lib/formulas.js:153.
export function computePowerTSS(np: number, durationS: number, ftp: number): number | null {
  if (!np || !ftp || !durationS) return null
  const IF = np / ftp
  return Math.round((durationS * np * IF) / (ftp * 3600) * 100)
}

// Estimate zone distribution from HR fraction. maxHR null → return null (honest
// "unknown") rather than a fabricated distribution off a made-up max.
export function estimateZones(avgHR: number | null, maxHR: number | null): number[] | null {
  if (!avgHR || !maxHR) return null
  const pct = avgHR / maxHR
  if (pct < 0.70) return [60, 35, 5, 0, 0]
  if (pct < 0.80) return [20, 55, 20, 5, 0]
  if (pct < 0.88) return [5, 20, 45, 25, 5]
  if (pct < 0.94) return [0, 5, 15, 55, 25]
  return [0, 0, 5, 25, 70]
}

// Honest RPE derivation (was rpe:null, which logRowToEntry hydrates into a
// FABRICATED neutral 5 that silently passed every RPE-gated science check —
// rowingSplitConsistency 4–7 gate, decouplingTrend rpe≤6, classifySession,
// monotony). Method is persisted (rpe_method) so coach-facing views can
// distinguish estimates from reported effort — same lesson as wPrimeMethod.
//   1. %HRmax bands (ACSM intensity classification ↔ CR-10 correspondence)
//   2. suffer-score (Strava Relative Effort, TRIMP-like → normalize per hour)
//   3. null (client default applies; no honest basis to guess)
export function deriveRPE(
  avgHR: number | null,
  maxHR: number | null,
  sufferScore: number | null,
  durationS: number,
): { rpe: number | null; method: string | null } {
  if (avgHR && maxHR && maxHR > 0) {
    const f = Math.min(avgHR / maxHR, 1)
    const rpe = f < 0.60 ? 2 : f < 0.70 ? 3 : f < 0.75 ? 4 : f < 0.80 ? 5
              : f < 0.85 ? 6 : f < 0.90 ? 7 : f < 0.95 ? 8 : 9
    return { rpe, method: "derived_hr" }
  }
  if (sufferScore && sufferScore > 0 && durationS > 0) {
    const perHour = sufferScore / (durationS / 3600)
    const rpe = perHour < 20 ? 2 : perHour < 40 ? 3 : perHour < 65 ? 4 : perHour < 95 ? 5
              : perHour < 135 ? 6 : perHour < 185 ? 7 : perHour < 250 ? 8 : 9
    return { rpe, method: "derived_suffer" }
  }
  return { rpe: null, method: null }
}

export interface ProfilePhysiology {
  maxHR:  number | null
  ftp:    number | null
  // Critical Power + W′ for the exhaustion check (v9.466 streams enrichment).
  // Mirrors src/lib/formulas.js resolveCPWPrime: measured CP test values win,
  // else estimated from FTP (0.95×FTP + 15 kJ default), else null.
  cp:            number | null
  wPrime:        number | null
  wPrimeMethod:  "measured" | "estimated" | null
}

// Read the athlete's max HR + FTP + CP/W′ from profiles.profile_data JSONB
// (flat { maxhr, age, ftp, cp, wPrime }). maxHR falls back to 220−age, then
// null (honest "unknown" — estimateTSS uses its duration-only fallback,
// estimateZones/deriveRPE return null). FTP null ⇒ power-TSS never computed
// (guardrail: stored watts alone must not fabricate a load number).
export async function resolveProfilePhysiology(
  sb: ReturnType<typeof createClient>,
  userId: string,
): Promise<ProfilePhysiology> {
  const none: ProfilePhysiology = { maxHR: null, ftp: null, cp: null, wPrime: null, wPrimeMethod: null }
  try {
    const { data: prof } = await sb
      .from("profiles")
      .select("profile_data")
      .eq("id", userId)
      .maybeSingle()
    const pd = (prof?.profile_data ?? {}) as Record<string, unknown>

    let maxHR: number | null = null
    const rawMax = Number(pd.maxhr)
    if (Number.isFinite(rawMax) && rawMax >= 60 && rawMax <= 280) maxHR = Math.round(rawMax)
    else {
      const age = Number(pd.age)
      if (Number.isFinite(age) && age >= 5 && age <= 120) maxHR = Math.round(220 - age)
    }

    const rawFtp = Number(pd.ftp)
    const ftp = Number.isFinite(rawFtp) && rawFtp >= 30 && rawFtp <= 2000 ? Math.round(rawFtp) : null

    const rawCp = Number(pd.cp)
    const rawWp = Number(pd.wPrime)
    let cp: number | null = null, wPrime: number | null = null
    let wPrimeMethod: ProfilePhysiology["wPrimeMethod"] = null
    if (Number.isFinite(rawCp) && rawCp > 0 && Number.isFinite(rawWp) && rawWp > 0) {
      cp = Math.round(rawCp); wPrime = Math.round(rawWp); wPrimeMethod = "measured"
    } else if (ftp) {
      cp = Math.round(ftp * 0.95); wPrime = 15000; wPrimeMethod = "estimated"
    }

    return { maxHR, ftp, cp, wPrime, wPrimeMethod }
  } catch {
    return none
  }
}

// ── Streams-enrichment qualification (v9.466 P1) ─────────────────────────────
// An activity is worth 2 extra API calls (streams + detail) only when it can
// yield something: an HR stream (zones/decoupling) or real power (NP/W′).
// Manual entries have NO streams — skip. The caller must also check that the
// row's stream_enriched_at is still null (idempotence across webhook re-imports).
export function qualifiesForStreamEnrichment(a: Record<string, unknown>): boolean {
  if (a.manual === true) return false
  return a.has_heartrate === true || a.device_watts === true
}

// ── HIGH-1 (audit 2026-07-04): summary upserts must not clobber streams-derived
// values. Once an enrich pass ran, zones/np/tss/rpe/rpe_method on the row came
// from the STREAMS payload (true zone distribution, stream NP, athlete-entered
// perceived_exertion) — a later summary re-import (webhook update event, SYNC
// NOW's 30-day window) cannot re-derive them, and stream_enriched_at stays set
// so the row would never be re-enriched. Callers fetch the enriched id-set for
// the page and strip the contested columns from those rows' payloads.
// session_tag(+reason) included: post-enrich the tag reflects the athlete's
// perceived_exertion rpe — a summary re-tag from the derived rpe would drift.
const STREAM_DERIVED_COLS = ["zones", "np", "tss", "rpe", "rpe_method", "session_tag", "session_tag_reason"] as const

export async function fetchStreamEnrichedIds(
  sb: ReturnType<typeof createClient>,
  userId: string,
  activities: Record<string, unknown>[],
): Promise<Set<string>> {
  const ids = activities.filter((a) => a?.id).map((a) => String(a.id))
  if (!ids.length) return new Set()
  const { data } = await sb
    .from("training_log")
    .select("external_id")
    .eq("user_id", userId)
    .in("external_id", ids)
    .not("stream_enriched_at", "is", null)
  return new Set(((data ?? []) as { external_id: string }[]).map((r) => r.external_id))
}

export function stripStreamDerived(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row }
  for (const c of STREAM_DERIVED_COLS) delete out[c]
  return out
}

// After a page of activities upserts, enqueue one 'enrich' message per
// qualifying activity whose row hasn't been stream-enriched yet. Rows skipped
// by buildTrainingLogRow (<3 min) don't exist in training_log, so the .in()
// filter drops them automatically. A pending-but-unprocessed enrich message can
// be duplicated by a webhook re-import inside the same window — harmless
// (recompute is deterministic) and bounded by the webhook per-user throttle.
export async function enqueueStreamEnrichment(
  sb: ReturnType<typeof createClient>,
  userId: string,
  activities: Record<string, unknown>[],
): Promise<number> {
  const candidates = activities.filter(qualifiesForStreamEnrichment).map((a) => String(a.id))
  if (!candidates.length) return 0
  const { data: rows } = await sb
    .from("training_log")
    .select("external_id")
    .eq("user_id", userId)
    .in("external_id", candidates)
    .is("stream_enriched_at", null)
  let enqueued = 0
  for (const r of (rows ?? []) as { external_id: string }[]) {
    const { error } = await sb.rpc("enqueue_strava_backfill", {
      p_payload: {
        kind:        "enrich",
        user_id:     userId,
        external_id: r.external_id,
        enqueued_at: new Date().toISOString(),
      },
    })
    if (!error) enqueued++
  }
  return enqueued
}

const posNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null

// ── Session classification (v9.473 E4) ──────────────────────────────────────
// Port of the PLAN-LESS absolute rules of src/lib/coach/classifySession.js —
// do NOT diverge; the client is the source of truth. The formal-test-type rule
// is omitted only because mapStravaType can never emit a test type name.
// rpe-dependent rules require a real rpe (honest-null: no effort signal must
// not certify a session "easy"). Plan-context tags are client/coach territory.
export function classifySessionTag(
  durationMin: number,
  rpe: number | null,
  tss: number,
): { tag: string; reason: string } {
  const hasRpe = rpe != null && Number.isFinite(rpe)
  if (hasRpe && durationMin < 20 && (rpe as number) < 4) {
    return { tag: "junk", reason: `${durationMin}min at RPE ${rpe} is below adaptation threshold (20min / RPE 4)` }
  }
  if (hasRpe && durationMin < 45 && (rpe as number) <= 4) {
    return { tag: "recovery", reason: `${durationMin}min at RPE ${rpe} — active recovery intensity` }
  }
  if (tss >= 150 || (durationMin >= 120 && hasRpe && (rpe as number) >= 7)) {
    return { tag: "unplanned_high", reason: `High load session (TSS ${tss}, ${durationMin}min) without plan context` }
  }
  return { tag: "moderate", reason: "Normal training session" }
}

// Map one Strava SummaryActivity to a training_log row. Returns null for
// unusable activities (no id/date, <3 min). Deterministic in the payload +
// physiology, so repeated upserts (webhook update events re-import a 2-day
// window) stay idempotent.
export function buildTrainingLogRow(
  a: Record<string, unknown>,
  userId: string,
  physio: ProfilePhysiology,
): Record<string, unknown> | null {
  if (!a.id || !a.start_date) return null
  // Fall back to elapsed_time so moving_time=0 activities aren't dropped.
  const durationS   = (a.moving_time as number) || (a.elapsed_time as number) || 0
  const durationMin = Math.round(durationS / 60)
  if (durationMin < 3) return null

  const avgHR    = a.average_heartrate ? Math.round(a.average_heartrate as number) : null
  // Activity's REAL max HR — persisted as max_hr. For TSS/zones/RPE math prefer
  // it over the profile max (a session that hit 195 is scored against 195).
  const actMaxHR = a.max_heartrate ? Math.round(a.max_heartrate as number) : null
  const effMaxHR = actMaxHR ?? physio.maxHR

  const sType  = mapStravaType((a.sport_type as string) || (a.type as string) || "")
  const distM  = posNum(a.distance)
  const distKm = distM ? (distM / 1000).toFixed(2) : null
  // Running AND walking cadence are per-leg in Strava → double to full steps/min;
  // bikes (rpm) unchanged. (walk added per audit 2026-07-04 LOW-7.)
  const rawCad = posNum(a.average_cadence)
  const avgCadence = rawCad != null ? Math.round(rawCad * (/run|walk/i.test(sType) ? 2 : 1)) : null

  // ── Power (QW1) — device_watts=false means Strava-ESTIMATED power: never
  // persist or score it (guardrail #2 of the enrichment proposal).
  const deviceWatts = a.device_watts === true
  const rawNp    = posNum(a.weighted_average_watts)
  const rawAvgW  = posNum(a.average_watts)
  const rawKj    = posNum(a.kilojoules)
  const np         = deviceWatts && rawNp   ? Math.round(rawNp)   : null
  const avgPower   = deviceWatts && rawAvgW ? Math.round(rawAvgW) : null
  const kilojoules = deviceWatts && rawKj   ? Math.round(rawKj)   : null

  // ── Headline TSS: Coggan power-TSS when NP + FTP known (FIT-path precedent
  // fileImport.js v9.58); TRIMP HR estimate otherwise.
  const hrTss    = estimateTSS(durationS, avgHR, effMaxHR)
  const powerTss = np && physio.ftp ? computePowerTSS(np, durationS, physio.ftp) : null
  const tss      = powerTss ?? hrTss

  // ── Honest RPE (QW3)
  const sufferScore = posNum(a.suffer_score) ? Math.round(a.suffer_score as number) : null
  const { rpe, method: rpeMethod } = deriveRPE(avgHR, effMaxHR, sufferScore, durationS)

  // ── Elevation (QW2) + session clock time (QW4)
  const elevationGainM = posNum(a.total_elevation_gain) ? Math.round(a.total_elevation_gain as number) : null
  const startLocal = typeof a.start_date_local === "string" ? a.start_date_local : ""
  const startTime  = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startLocal) ? startLocal.slice(11, 16) : null

  const noteParts = [(a.name as string) || "Strava Activity"]
  if (distKm) noteParts.push(`${distKm} km`)
  if (avgHR)  noteParts.push(`avg HR ${avgHR}`)

  return {
    user_id:      userId,
    date:         ((a.start_date_local as string) || (a.start_date as string)).slice(0, 10),
    type:         sType,
    duration_min: durationMin,
    tss,
    rpe,
    zones:        estimateZones(avgHR, effMaxHR),
    distance_m:   distM,
    avg_hr:       avgHR,
    avg_cadence:  avgCadence,
    notes:        noteParts.join(" · "),
    source:       "strava",
    external_id:  String(a.id),
    // v9.473 (E4) — plan-less classification (coach execution profile reads it)
    ...(() => {
      const { tag, reason } = classifySessionTag(durationMin, rpe, tss)
      return { session_tag: tag, session_tag_reason: reason.slice(0, 200) }
    })(),
    // v9.465 enrichment columns (migration 20260637)
    max_hr:           actMaxHR,
    avg_power:        avgPower,
    np,
    kilojoules,
    elevation_gain_m: elevationGainM,
    suffer_score:     sufferScore,
    start_time:       startTime,
    rpe_method:       rpe != null ? rpeMethod : null,
  }
}
