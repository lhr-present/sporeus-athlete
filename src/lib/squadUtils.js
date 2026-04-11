// ─── squadUtils.js — Demo squad generator + squad helpers ────────────────────
// generateDemoSquad: seeded LCG → 90-day TSS patterns → PMC metrics
// Returns same schema as get_squad_overview() Postgres function.
import { calculatePMC, calculateACWR } from './trainingLoad.js'

// ── Seeded LCG random ─────────────────────────────────────────────────────────
// Park-Miller variant: reproducible, same seed → same squad every render.
export function makeLCG(seed) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0
    return s / 0xFFFFFFFF
  }
}

// ── Training status from PMC values ──────────────────────────────────────────
export function deriveTrainingStatus(ctl, atl, tsb, ctlWeekAgo, lastSessionDate) {
  if (atl > ctl + 20) return 'Overreaching'
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
  if (!lastSessionDate || lastSessionDate < fiveDaysAgo) return 'Detraining'
  if (ctl > ctlWeekAgo + 3)  return 'Building'
  if (tsb > 15)              return 'Peaking'
  if (ctl < ctlWeekAgo - 3)  return 'Recovering'
  return 'Maintaining'
}

// Map calculateACWR status → squad schema status ('undertraining' → 'low')
export function mapAcwrStatus(status) {
  if (status === 'undertraining' || status === 'insufficient') return 'low'
  return status || 'low'
}

// ── Generate a demo training log (90 entries, varying TSS) ───────────────────
function buildLog(tssForDay, rng) {
  const today = new Date()
  const log = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const baseTss = tssForDay(89 - i)   // 0 = 90d ago, 89 = today
    if (baseTss > 0) {
      const noise = Math.round((rng() - 0.5) * 10)
      log.push({
        date: d.toISOString().slice(0, 10),
        tss:  Math.max(10, baseTss + noise),
        rpe:  Math.min(10, Math.max(1, Math.round(3 + baseTss / 35))),
      })
    }
  }
  return log
}

// ── TSS patterns (index 0 = 90d ago, 89 = today) ─────────────────────────────
const PATTERNS = [
  // Eddy — Overreaching: steady base then 7-day spike above ATL+20 threshold
  i => i < 83 ? 72 : 158,
  // Fausto — Detraining: trained 85 days, then stopped (5+ rest days)
  i => i < 85 ? 64 : 0,
  // Bernard — Building #1: base → step up 14 days ago
  i => i < 76 ? 58 : 88,
  // Miguel — Peaking: high base → taper
  i => i < 75 ? 84 : i < 83 ? 48 : 14,
  // Tadej — Recovering: heavy load then sharp drop
  i => i < 83 ? 88 : 32,
  // Wout — Building #2: slow ramp over 30 days
  i => i < 60 ? 55 : 55 + Math.floor((i - 60) * 1.1),
]

const NAMES = ['Eddy', 'Fausto', 'Bernard', 'Miguel', 'Tadej', 'Wout']

// Predetermined statuses for demo — PMC cold-start skews computed status,
// and the demo's purpose is to show coaches what each status looks like in UI.
const STATUS_TARGETS = [
  'Overreaching', 'Detraining', 'Building', 'Peaking', 'Recovering', 'Building',
]

// ── Main export ───────────────────────────────────────────────────────────────
export function generateDemoSquad(seed = 42) {
  const rng = makeLCG(seed)
  const sixDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)

  return PATTERNS.map((pattern, idx) => {
    const log = buildLog(pattern, rng)

    // PMC (90d lookback, no future) → last entry = today
    const pmc = calculatePMC(log, 90, 0)
    const last   = pmc[pmc.length - 1]   || { ctl: 0, atl: 0, tsb: 0 }

    // ACWR
    const acwrResult = calculateACWR(log)
    const acwr_ratio  = acwrResult.ratio
    const acwr_status = mapAcwrStatus(acwrResult.status)

    // Last session date — Fausto (Detraining) needs to appear inactive
    const lastEntry = log.length ? log[log.length - 1] : null
    const last_session_date = idx === 1 ? sixDaysAgo : (lastEntry?.date || null)

    // Adherence: sessions in last 7 days
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const sessions7 = log.filter(e => e.date >= sevenAgo).length
    const adherence_pct = Math.round(sessions7 / 7 * 100)

    // Simulated HRV (4.5–9 range, seeded)
    const last_hrv_score = Math.round((rng() * 4.5 + 4.5) * 10) / 10

    return {
      athlete_id:         `demo-${NAMES[idx].toLowerCase()}`,
      display_name:       NAMES[idx],
      today_ctl:          Math.round(last.ctl),
      today_atl:          Math.round(last.atl),
      today_tsb:          Math.round(last.tsb),
      acwr_ratio:         acwr_ratio !== null ? Math.round(acwr_ratio * 100) / 100 : null,
      acwr_status,
      last_hrv_score,
      last_session_date,
      missed_sessions_7d: 0,
      training_status:    STATUS_TARGETS[idx],
      adherence_pct,
      _log: log,          // internal: for CTLChart in demo expanded rows
    }
  })
}
