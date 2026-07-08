// ─── Input validation / sanitization ──────────────────────────────────────────
import { normalizeAthleteLevel, normalizeSport } from './constants.js'
import { vdotToThresholdStr } from './athlete/vo2maxToPace.js'
import { normalizeTrainingDow } from './plan/trainingDays.js'
import { newId } from './newId.js'
// v9.480 — MMP-vector shape validation (pure, cycle-free)
import { sanitizePowerPeaks } from './athlete/powerPeaks.js'

/**
 * @typedef {Object} LogEntry
 * @property {string} id
 * @property {string} date - ISO date YYYY-MM-DD
 * @property {string} type - session type key
 * @property {number} duration - minutes
 * @property {number} tss - Training Stress Score
 * @property {number} rpe - Rate of Perceived Exertion 1–10
 * @property {number[]} [zones] - time in each HR zone (minutes)
 * @property {string} [notes]
 * @property {string} source - 'manual' | 'strava' | 'fit'
 */

/**
 * @typedef {Object} ProfileData
 * @property {string} [name]
 * @property {string} [sport]
 * @property {number} [age]
 * @property {number} [weight] - kg
 * @property {number} [height] - cm
 * @property {number} [maxhr] - max heart rate bpm
 * @property {number} [ftp] - Functional Threshold Power watts
 * @property {number} [vo2max] - mL/kg/min
 * @property {string} [threshold] - threshold pace mm:ss/km
 * @property {string} [goal]
 * @property {number} [dragFactor] - Concept2 erg drag factor (80-220)
 */

/**
 * @param {*} s - value to sanitize
 * @param {number} [maxLen=200] - maximum string length
 * @returns {string} trimmed string within maxLen
 */
export function sanitizeString(s, maxLen = 200) {
  if (typeof s !== 'string') return s != null ? String(s).trim().slice(0, maxLen) : ''
  return s.trim().slice(0, maxLen)
}

/**
 * @param {*} n - value to sanitize
 * @param {number} [min=0] - minimum allowed value
 * @param {number} [max=99999] - maximum allowed value
 * @returns {number} clamped numeric value (0 if invalid)
 */
export function sanitizeNumber(n, min = 0, max = 99999) {
  const v = parseFloat(n)
  if (isNaN(v) || !isFinite(v)) return 0
  return Math.max(min, Math.min(max, v))
}

/**
 * @param {*} d - value to parse as date
 * @returns {string} ISO date YYYY-MM-DD or today's date on parse failure
 */
export function sanitizeDate(d) {
  if (d == null) return new Date().toISOString().slice(0, 10)
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
    return date.toISOString().slice(0, 10)
  } catch { return new Date().toISOString().slice(0, 10) }
}

/**
 * @param {Object} e - raw log entry object
 * @returns {LogEntry} sanitized and clamped log entry
 */
export function sanitizeLogEntry(e) {
  const clamp = (v, lo, hi) => { const n = parseFloat(v); return isNaN(n) ? 0 : Math.max(lo, Math.min(hi, n)) }
  const result = {
    // Preserve a valid string id (the server uuid hydrated by logRowToEntry, or
    // a freshly minted newId()). Keep a legacy positive number id so existing
    // local-only entries still edit/delete in place (the one-time
    // migrateLogIdsToUuid pass upgrades those to uuids). Else mint a uuid.
    // Pre-fix this CLOBBERED a valid uuid back to Date.now(), corrupting synced
    // entries on every edit and breaking the diff-by-id sync.
    id: (typeof e.id === 'string' && e.id)
      ? e.id
      : (typeof e.id === 'number' && e.id > 0) ? e.id : newId(),
    date: sanitizeDate(e.date),
    type: sanitizeString(e.type, 50) || 'Easy Run',
    duration: clamp(e.duration, 0, 1440),
    // v9.469 — missing rpe stays null (clamp(null)→0 was a SECOND, conflicting
    // fabrication: hydration said 5, an edit/import through here said 0).
    // v9.472 (audit LOW-1) — non-numeric garbage (NaN from parseInt('null'),
    // 'x' imports) is also treated as "no signal", not clamped to 0.
    rpe: e.rpe == null || e.rpe === '' || isNaN(parseFloat(e.rpe)) ? null : clamp(e.rpe, 0, 10),
    tss: clamp(e.tss, 0, 2000),
    notes: sanitizeString(e.notes, 500),
  }
  if (Array.isArray(e.zones)) {
    result.zones = e.zones.slice(0, 5).map(v => clamp(v, 0, 1440))
  }
  if (e.wPrimeExhausted === true) result.wPrimeExhausted = true
  if (typeof e.source === 'string' && e.source) result.source = e.source.slice(0, 20)
  if (e.hasPower === true) result.hasPower = true
  // v9.152.0 — Rest-type and improvised-session classification flags.
  // restDayMarked + sickDay + correctiveRest established by v9.111/139/144;
  // improvisedSession + plannedType added by Prompt 10. Each carries a
  // distinct adherence signal — preserve through sanitization for analysis.
  if (e.restDayMarked === true) result.restDayMarked = true
  if (e.sickDay === true) result.sickDay = true
  if (e.correctiveRest === true) result.correctiveRest = true
  if (e.improvisedSession === true) result.improvisedSession = true
  if (typeof e.plannedType === 'string' && e.plannedType) result.plannedType = e.plannedType.slice(0, 50)
  // Fields required by vo2max.js estimateVO2maxTrend — must survive sanitization.
  // Number.isFinite (not !isNaN) so Infinity from a bad import (parseFloat of
  // '1e999' / 'Infinity') can't leak into stored numeric fields — isNaN() returns
  // false for Infinity, which would corrupt downstream load/pace/VO2max math.
  const distM = parseFloat(e.distanceM); if (Number.isFinite(distM) && distM > 0) result.distanceM = distM
  const dist  = parseFloat(e.distance);  if (Number.isFinite(dist)  && dist  > 0) result.distance  = dist
  // distanceKm survives sanitization too — QuickAddModal writes it for manual
  // run logging, and predictRacePerformance's fallback reads it (km). Without
  // this it was stripped, leaving the race predictor dead for manual entries.
  const distKm = parseFloat(e.distanceKm); if (Number.isFinite(distKm) && distKm > 0) result.distanceKm = distKm
  const durSec = parseFloat(e.durationSec); if (Number.isFinite(durSec) && durSec > 0) result.durationSec = durSec
  // Physiological bounds so a bad import can't store an implausible HR/cadence
  // that then skews EF / HR-fraction / cadence-band math.
  // Accept both casings: QuickAddModal emits `avgHr` (lowercase), the FIT
  // importer + storage contract use `avgHR` (uppercase). Pre-fix only avgHR was
  // read, so a manually-entered Avg HR was silently dropped. Canonical out = avgHR.
  const avgHR = parseInt(e.avgHR ?? e.avgHr ?? e.avg_hr);  if (Number.isFinite(avgHR) && avgHR >= 30 && avgHR <= 250) result.avgHR = avgHR
  const cadence = parseInt(e.avgCadence); if (Number.isFinite(cadence) && cadence >= 0 && cadence <= 200) result.avgCadence = cadence
  // Normalized Power (Coggan 2003) — computed by the FIT importer (fileImport.js
  // parseFIT) when a ride carries a ≥30s power series. Pre-fix it was stripped
  // here, so cyclingNpTrend.js read `np`/`normalizedPower` on every sanitized
  // entry and got null → the NP-by-duration trend card was dead for all real
  // (sanitized) rides. Accept either field name (FIT writes `np`; Garmin maps
  // `normalizedPower`); clamp to a plausible cycling-power range so a bad import
  // can't skew the duration-bucketed bests. Number.isFinite guards Infinity.
  const np = parseInt(e.np ?? e.normalizedPower); if (Number.isFinite(np) && np > 0 && np <= 2500) result.np = np
  // v9.465.0 — decouplingPct + wPrimeMethod were being STRIPPED here: the FIT
  // import path (TrainingLog.jsx) sanitizes before setLog, so the locally
  // computed Friel decoupling never reached the log (decouplingTrend dead for
  // same-device imports) and the measured/estimated W′ label was lost.
  const dc = parseFloat(e.decouplingPct); if (Number.isFinite(dc) && dc >= -100 && dc <= 100) result.decouplingPct = dc
  if (e.wPrimeMethod === 'measured' || e.wPrimeMethod === 'estimated') result.wPrimeMethod = e.wPrimeMethod
  // v9.465.0 — Strava enrichment fields (hydrated by logRowToEntry; consumers:
  // triLoad avgPower, altitudeStimulus elevationGainM, timeOfDayConsistency
  // startTime). Physiological/plausibility bounds mirror avgHR/np above.
  // v9.487: avg_power = C2 CSV snake alias
  const avgPower = parseInt(e.avgPower ?? e.avg_power); if (Number.isFinite(avgPower) && avgPower > 0 && avgPower <= 2500) result.avgPower = avgPower
  const maxHR = parseInt(e.maxHR ?? e.maxHr); if (Number.isFinite(maxHR) && maxHR >= 30 && maxHR <= 250) result.maxHR = maxHR
  const elev = parseInt(e.elevationGainM); if (Number.isFinite(elev) && elev > 0 && elev <= 15000) result.elevationGainM = elev
  const kj = parseInt(e.kilojoules); if (Number.isFinite(kj) && kj > 0 && kj <= 30000) result.kilojoules = kj
  const ss = parseInt(e.sufferScore); if (Number.isFinite(ss) && ss > 0 && ss <= 1000) result.sufferScore = ss
  const cal = parseInt(e.calories); if (Number.isFinite(cal) && cal > 0 && cal <= 20000) result.calories = cal
  if (typeof e.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(e.startTime)) result.startTime = e.startTime
  if (typeof e.rpeMethod === 'string' && e.rpeMethod) result.rpeMethod = e.rpeMethod.slice(0, 20)
  // v9.473 (E4) — session classification survives sanitization (whitelist).
  if (typeof e.sessionTag === 'string' && e.sessionTag) result.sessionTag = e.sessionTag.slice(0, 30)
  if (typeof e.sessionTagReason === 'string' && e.sessionTagReason) result.sessionTagReason = e.sessionTagReason.slice(0, 200)
  // v9.480 — MMP vector survives sanitization (validated shape, bounded watts).
  if (e.powerPeaks != null) {
    const pk = sanitizePowerPeaks(e.powerPeaks)
    if (pk) result.powerPeaks = pk
  }
  // v9.474 — Concept2 CSV rowing fields (fileImport.js parseC2CSV) were being
  // STRIPPED here, which killed RowingMetricsCard's stroke-rate/drag analysis
  // even for erg imports. Plausibility bounds per Concept2 conventions.
  if ((e.sport_type || '').toLowerCase() === 'rowing') result.sport_type = 'rowing'
  const spm = parseInt(e.avg_spm); if (Number.isFinite(spm) && spm >= 10 && spm <= 60) result.avg_spm = spm
  const df = parseInt(e.drag_factor); if (Number.isFinite(df) && df >= 50 && df <= 250) result.drag_factor = df
  const strokes = parseInt(e.strokes); if (Number.isFinite(strokes) && strokes > 0 && strokes <= 50000) result.strokes = strokes
  return result
}

/**
 * One-time migration: convert any log entry whose `id` is a legacy NUMBER (or
 * otherwise non-uuid) to a fresh uuid, so it matches the server's uuid column
 * and the diff-by-id sync can persist it. Returns the rewritten log plus a
 * remap {oldId -> newId} so the caller can rekey side-channel data (the
 * per-entry `sporeus-power-<id>` localStorage blobs).
 *
 * Pure: does not touch localStorage. Entries that already have a uuid id (or a
 * non-empty string id) are left untouched. Only applies to LOCAL-ONLY / guest
 * entries — server hydration replaces local rows with uuid-keyed rows, so this
 * is a no-op for synced accounts.
 *
 * @param {Array<Object>} log
 * @returns {{ log: Array<Object>, remap: Record<string|number, string> }}
 */
export function migrateLogIdsToUuid(log) {
  if (!Array.isArray(log)) return { log: [], remap: {} }
  const remap = {}
  const out = log.map(e => {
    if (!e || typeof e !== 'object') return e
    // Keep any non-empty string id (uuid or otherwise-stable string).
    if (typeof e.id === 'string' && e.id) return e
    const fresh = newId()
    if (e.id != null) remap[e.id] = fresh
    return { ...e, id: fresh }
  })
  return { log: out, remap }
}

/**
 * @typedef {Object} RecoveryEntry
 * @property {string} date - ISO date YYYY-MM-DD
 * @property {number} [score] - readiness score 0–100
 * @property {number} [hrv] - rMSSD (ms), numeric (DB column numeric(6,2))
 * @property {number} [restingHR] - resting heart rate bpm
 * @property {number} [sleepHrs] - sleep duration hours
 * @property {number} [lactate] - blood lactate mmol/L
 * @property {number} [sleep] - sleep quality 1–5
 * @property {number} [energy] - energy 1–5
 * @property {number} [soreness] - soreness 1–5
 * @property {number} [mood] - mood 1–5
 * @property {number} [stress] - stress 1–5
 */

/**
 * Sanitize a recovery / wellness entry before persistence.
 *
 * The recovery write path historically bypassed sanitization, so HRV was
 * stored as a STRING (`String(Math.round(rmssd))`) and numeric fields were
 * unclamped. Three HRV dashboard cards (HRVAlertCard, HRVSummaryCard,
 * hrvAutonomicBalance) gate on `typeof e.hrv === 'number'`, so a string hrv
 * silently killed them for local/guest users. This mirrors the
 * sanitizeLogEntry style and makes "hrv is a NUMBER" the storage contract
 * (the DB column is numeric(6,2); dataMigration.js reads it via parseFloat).
 *
 * Number.isFinite (NOT isNaN) so Infinity from a bad import can't leak.
 * Unknown fields (rmssd, lnRMSSD, dfaAlpha1, bedtime, wake, source,
 * idempotency_key, hrv_factor, readiness, …) pass through untouched.
 *
 * @param {Object} e - raw recovery entry
 * @returns {RecoveryEntry} sanitized + clamped recovery entry
 */
export function sanitizeRecovery(e) {
  if (!e || typeof e !== 'object') return { date: sanitizeDate(null) }
  // Pass through every field as-is, then overwrite the validated ones below.
  // This preserves rmssd/lnRMSSD/dfaAlpha1/source/bedtime/etc. that other
  // consumers read, without an explicit whitelist that would silently drop
  // new fields.
  const result = { ...e }
  result.date = sanitizeDate(e.date)

  const num = (v, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null }
  const intIn = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null }

  // hrv: coerce to NUMBER, clamp 10–200, drop if not finite/>0.
  if ('hrv' in e) {
    const hrv = num(e.hrv, 10, 200)
    if (hrv != null && hrv > 0) result.hrv = hrv
    else delete result.hrv
  }
  // restingHR: number, clamp 30–120.
  if ('restingHR' in e) {
    const rhr = num(e.restingHR, 30, 120)
    if (rhr != null) result.restingHR = rhr
    else delete result.restingHR
  }
  // sleepHrs: number, clamp 0–24.
  if ('sleepHrs' in e) {
    const sh = num(e.sleepHrs, 0, 24)
    if (sh != null) result.sleepHrs = sh
    else delete result.sleepHrs
  }
  // lactate: number, clamp 0–20 (optional/advanced-only).
  if ('lactate' in e) {
    const lac = num(e.lactate, 0, 20)
    if (lac != null) result.lactate = lac
    else delete result.lactate
  }
  // 1–5 wellness sliders — coerce to int, clamp, only when present.
  for (const k of ['sleep', 'energy', 'soreness', 'mood', 'stress']) {
    if (k in e) {
      const v = intIn(e[k], 1, 5)
      if (v != null) result[k] = v
      else delete result[k]
    }
  }
  // readiness (TodayView quick-tap): 0–100 if present.
  if ('readiness' in e) {
    const r = intIn(e.readiness, 0, 100)
    if (r != null) result.readiness = r
    else delete result.readiness
  }
  // score: 0–100 if present.
  if ('score' in e) {
    const s = intIn(e.score, 0, 100)
    if (s != null) result.score = s
    else delete result.score
  }
  return result
}

// Profile: keeps numeric fields as strings (form inputs expect strings)
/**
 * @param {Object} p - raw profile object
 * @returns {ProfileData} sanitized profile with numeric fields as strings
 */
export function sanitizeProfile(p) {
  const str = (v, max = 100) => sanitizeString(v, max)
  const numStr = (v, lo, hi) => {
    const n = parseFloat(v)
    if (isNaN(n) || !isFinite(n)) return ''
    return String(Math.max(lo, Math.min(hi, n)))
  }
  // v9.62.0 — sport / primarySport collision. ~10 read sites disagree on
  // which field to read: Dashboard.jsx:283/291 reads only primarySport;
  // dailyPrescription.js:92 + QuickAddModal.jsx:107 read only sport;
  // useAppState.js:116 falls back. Result: coach pushes primarySport but
  // onboarding wrote sport → sport gating misfires. Mirror both fields so
  // any read site sees consistent state regardless of which name it checks.
  // v9.78.0 — Normalize to canonical Capitalized form so the codebase's
  // three sport vocabularies converge at the profile tier. Falls back to
  // the trimmed raw string if the input doesn't match a known sport
  // (preserves legacy values like 'Brick (Bike+Run)' from FIT imports).
  const rawSport  = str(p.primarySport, 50) || str(p.sport, 50)
  const normSport = normalizeSport(rawSport) || rawSport

  // v9.159.0 (Prompt E) — Derive threshold pace from VO2max when the
  // athlete has tested VO2max in lab but not entered a threshold pace
  // manually. Pre-fix `profile.vo2max` was collected from 6 protocol
  // tests but consumed by zero downstream code. The derived value goes
  // into a NEW field `thresholdDerived` — the user-entered `threshold`
  // is never overwritten, so the UI can distinguish source ("from
  // VO2max" badge) and the athlete's intentional blank stays blank.
  const userThreshold = str(p.threshold, 20)
  const vo2maxNum = parseFloat(p.vo2max)
  const thresholdDerived = !userThreshold && Number.isFinite(vo2maxNum) && vo2maxNum > 0
    ? (vdotToThresholdStr(vo2maxNum) || '')
    : ''
  // v9.186.0 — `ltPace` ↔ `threshold` mirror. Two read sites
  // (intelligence.js predictRacePerformance, RacePredictionsCard) read
  // `profile.ltPace`, but Profile.jsx writes ONLY `profile.threshold`,
  // so an athlete who entered an LT pace got zero contribution from those
  // sites. Mirror at sanitization (matches the sport↔primarySport and
  // raceDate↔nextRaceDate patterns) so any read site wins. Accepts a
  // legacy ltPace input as a last-resort fall-back. Empty string when
  // nothing is set, so the existing `!profile.ltPace` guards still work.
  const legacyLtPace = str(p.ltPace, 20)
  const ltPace = userThreshold || thresholdDerived || legacyLtPace || ''

  return {
    name:          str(p.name),
    sport:         normSport,
    primarySport:  normSport,
    triathlonType: str(p.triathlonType, 30),
    secondarySports: Array.isArray(p.secondarySports) ? p.secondarySports.slice(0, 10).map(s => str(s, 30)) : [],
    // v9.67.0 — Normalize to LEVEL_CONFIG key. Pre-fix the Onboarding picker
    // stored 'Beginner'/'Intermediate'/'Advanced' (capital) while LEVEL_CONFIG
    // keys are lowercase ATHLETE_LEVELS values. Mismatch caused new "Beginner"
    // users to fall through to the competitive fallback in Dashboard.jsx:152,
    // bypassing the dashSimple simplified branch designed exactly for them.
    athleteLevel:  normalizeAthleteLevel(str(p.athleteLevel, 30)),
    age:           numStr(p.age, 5, 120),
    weight:        numStr(p.weight, 10, 400),
    height:        numStr(p.height, 50, 280),
    gender:        ['male','female'].includes(p.gender) ? p.gender : 'male',
    ftp:           numStr(p.ftp, 0, 3000),
    // v9.494 (design item): 2000m erg TIME as mm:ss (e.g. '7:30'). This is the
    // producer the rowing staleness branch waited for (its profile.split2kSec
    // input is parsed from this at the call site). NOT sec/500m — the mm:ss
    // format makes the 2k-time semantics unambiguous at entry.
    split2k:       typeof p.split2k === 'string' && /^[1-9]?\d:[0-5]\d$/.test(p.split2k.trim()) ? p.split2k.trim() : '',
    vo2max:        numStr(p.vo2max, 0, 100),
    maxhr:         numStr(p.maxhr, 60, 280),
    threshold:     userThreshold,
    thresholdDerived,
    ltPace,
    // v9.100.0 — CSS (Critical Swim Speed) in sec/100m. Pre-fix, this field
    // was set by eliteProgram + onboarding but stripped on every Profile save
    // because the whitelist didn't include it. Stored as a string to match
    // the form-input contract; consumers parse via Number(profile.cssSec).
    // Bounds: 40s (world-class) to 300s (5min/100m beginner).
    cssSec:        p.cssSec == null || p.cssSec === '' ? '' : numStr(p.cssSec, 40, 300),
    // v9.51.0 — Concept2 erg drag factor (rowing). DF norms:
    //   HW men 130-140, LW men 115-130, HW women 120-130 (Concept2, 2019)
    //   World Rowing Indoor cap: 140 men / 130 women (WRIC rulebook 2023)
    // Range 80-220 covers junior/novice (low) through max competition setting.
    dragFactor:    numStr(p.dragFactor, 80, 220),
    goal:          str(p.goal, 200),
    neck:          numStr(p.neck, 10, 100),
    waist:         numStr(p.waist, 30, 250),
    hip:           numStr(p.hip, 30, 250),
    email:         str(p.email, 200),
    weeklyTssGoal: numStr(p.weeklyTssGoal, 0, 2000),
    // v9.181.0 — Menstrual-cycle inputs (female-only, opt-in). Empty string
    // = not tracking. cyclePhaseGate / cyclePlanner gate on gender='female'
    // AND lastPeriodStart truthy, so non-female / non-opted-in users have
    // zero behavioural impact even if these fields exist on the schema.
    lastPeriodStart: typeof p.lastPeriodStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.lastPeriodStart) ? p.lastPeriodStart : '',
    cycleLength:     p.cycleLength == null || p.cycleLength === '' ? '' : numStr(p.cycleLength, 21, 40),
    // v9.60.0 — Race date is read from two field names across 9+ call sites
    // (nextAction reads nextRaceDate; intelligence reads raceDate; etc.).
    // Normalize: accept either input, mirror to both outputs so downstream
    // readers see consistent state regardless of which field they check.
    raceDate:     normalizeRaceDate(p.raceDate, p.nextRaceDate),
    nextRaceDate: normalizeRaceDate(p.raceDate, p.nextRaceDate),
    // Training day-of-week preference (ISO Mon=0…Sun=6), sorted+deduped, or []
    // when not set. Drives plan generation (which weekdays carry sessions) so
    // weekend-training athletes aren't forced to rest Sat/Sun. (weekend-rest fix)
    trainingDow:   normalizeTrainingDow(p.trainingDow) || [],
    // v9.434.0 — trainDays (sessions/week COUNT, distinct from trainingDow which
    // names specific weekdays). The onboarding wizard collects it (step 5) and
    // plan regen reads `Number(profile.trainDays) || 5` (TodayView, starterPlan).
    // Pre-fix it was omitted from the whitelist, so the FIRST Profile save dropped
    // it → a 3-day athlete silently reverted to 5 days/week. Clamp 1–7. Empty
    // string when unset so the `|| 5` fallback still fires.
    trainDays:     p.trainDays == null || p.trainDays === '' ? '' : numStr(p.trainDays, 1, 7),
    // v9.483 (contract sweep A5) — CP-test results were WIPED on every Profile
    // save: Protocols.jsx writes cp/wPrime/powerZones, none whitelisted → the
    // W′ badge silently downgraded measured→estimated and PowerCurve lost the
    // profile CP the next time the athlete touched any profile field.
    cp:            p.cp == null || p.cp === '' ? '' : numStr(p.cp, 30, 2000),
    wPrime:        p.wPrime == null || p.wPrime === '' ? '' : numStr(p.wPrime, 1000, 60000),
    ...(Array.isArray(p.powerZones) ? { powerZones: p.powerZones.slice(0, 8) } : {}),
    // v9.483 (contract sweep A6) — notification prefs reset on any Profile save
    // (written by NotificationSettings/reminders, read by push scheduling).
    ...(p.notifications && typeof p.notifications === 'object' && !Array.isArray(p.notifications) ? { notifications: p.notifications } : {}),
    preferred_checkin_time: typeof p.preferred_checkin_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.preferred_checkin_time) ? p.preferred_checkin_time : '',
    timezone:      str(p.timezone, 60),
  }
}

function normalizeRaceDate(a, b) {
  const re = /^\d{4}-\d{2}-\d{2}$/
  const aOk = typeof a === 'string' && re.test(a)
  const bOk = typeof b === 'string' && re.test(b)
  if (aOk) return a
  if (bOk) return b
  return undefined
}

/**
 * v9.60.0 — Single source of truth for "when is the athlete's next race?"
 * Pure helper. Use this instead of `profile?.raceDate || profile?.nextRaceDate`
 * to avoid the field-name disagreements that propagated through 9 read sites.
 * @returns {string|null} ISO date YYYY-MM-DD or null
 */
export function getProfileRaceDate(profile) {
  return normalizeRaceDate(profile?.raceDate, profile?.nextRaceDate) || null
}
