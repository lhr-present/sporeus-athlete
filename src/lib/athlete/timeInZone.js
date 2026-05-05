// ─── timeInZone.js — Time-In-Zone Detector (28d, absolute minutes) ───────────
// Returns absolute minutes per zone (Z1..Z5) over a rolling 28-day window and
// compares each zone against polarized minute-targets (Seiler 2010 template).
// Distinct from staleZones (28d *share* %) and trainingDistribution (84d
// polarized-fit pattern) — this surface is for athletes following minute-based
// prescriptions and coaches who set minute targets per zone.
// ─────────────────────────────────────────────────────────────────────────────

export const TIME_IN_ZONE_CITATION = 'Seiler 2010 polarized; Stöggl & Sperlich 2014'

const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

const ZONE_LABELS = {
  Z1: { en: 'Z1 (recovery)', tr: 'Z1 (toparlanma)' },
  Z2: { en: 'Z2 (endurance)', tr: 'Z2 (dayanıklılık)' },
  Z3: { en: 'Z3 (tempo)', tr: 'Z3 (tempo)' },
  Z4: { en: 'Z4 (threshold)', tr: 'Z4 (eşik)' },
  Z5: { en: 'Z5 (VO2max)', tr: 'Z5 (VO2max)' },
}

// Seiler polarized template fractions (Z1=28%, Z2=56%, Z3=7%, Z4=7%, Z5=4%)
const POLARIZED_FRACTIONS = { Z1: 0.28, Z2: 0.56, Z3: 0.07, Z4: 0.07, Z5: 0.04 }

// Default literal minute targets for a 14.5 hr/wk * 4-week block (used only
// as the fallback "shape" template — actual defaults are scaled to the
// athlete's totalMinutes; callers can override with explicit literal targets).
const DEFAULT_LITERAL_TARGETS = { Z1: 240, Z2: 480, Z3: 60, Z4: 60, Z5: 30 }

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Zone parsing (replicated to keep this lib self-contained) ───────────────
function entryZoneMinutes(entry) {
  const out = [0, 0, 0, 0, 0]
  const z = entry?.zones
  if (Array.isArray(z) && z.some(v => Number(v) > 0)) {
    for (let i = 0; i < 5; i++) out[i] = Number(z[i]) || 0
    return out
  }
  if (z && typeof z === 'object') {
    let any = false
    for (let i = 0; i < 5; i++) {
      const key1 = `Z${i + 1}`
      const key2 = `z${i + 1}`
      const v = Number(z[key1] ?? z[key2] ?? 0)
      out[i] = v || 0
      if (v > 0) any = true
    }
    if (any) return out
  }
  const dur = Number(entry?.duration) || 0
  if (dur > 0) {
    const r = Number(entry?.rpe) || 5
    const zi = r <= 3 ? 0 : r <= 5 ? 1 : r <= 7 ? 2 : r === 8 ? 3 : 4
    out[zi] = dur
  }
  return out
}

// ─── Bilingual templates ─────────────────────────────────────────────────────
const TR_DIRECTION = { over: 'üstünde', under: 'altında' }

const MESSAGES = {
  good: {
    en: 'Time-in-zone matches polarized target',
    tr: 'Bölge süreleri polarize hedefiyle uyumlu',
  },
  poor: {
    en: 'Multiple zones off-target — review intensity distribution',
    tr: 'Birden fazla bölge hedef dışı — yoğunluk dağılımını gözden geçir',
  },
}

const RECS = {
  good: { en: '', tr: '' },
  poor: {
    en: 'Rebalance — emphasize Z1/Z2 and add weekly Z4/Z5 dose',
    tr: "Yeniden dengele — Z1/Z2'yi ön plana al, haftalık Z4/Z5 dozu ekle",
  },
}

// ─── detectTimeInZone ────────────────────────────────────────────────────────
/**
 * Aggregate absolute minutes per zone over a 28-day window and compare to
 * polarized minute-targets.
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @param {{Z1?:number,Z2?:number,Z3?:number,Z4?:number,Z5?:number}|null} [targets]
 *   Optional literal minute targets per zone. When omitted, defaults are
 *   derived by applying the polarized template (28/56/7/7/4) to totalMinutes.
 * @returns {{
 *   totalMinutes: number,
 *   minutesPerZone: number[],
 *   sharePerZone: number[],
 *   targets: {Z1:number,Z2:number,Z3:number,Z4:number,Z5:number},
 *   byZone: Array<{zone:string, minutes:number, target:number,
 *                  ratioToTarget:number|null, status:string, deltaMin:number}>,
 *   worstZone: {zone:string, deltaMin:number, status:string}|null,
 *   band: 'good'|'moderate'|'poor',
 *   message: {en:string, tr:string},
 *   recommendation: {en:string, tr:string},
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectTimeInZone(
  log,
  today = new Date().toISOString().slice(0, 10),
  targets = null,
) {
  const empty = {
    totalMinutes: 0,
    minutesPerZone: [0, 0, 0, 0, 0],
    sharePerZone: [0, 0, 0, 0, 0],
    targets: { ...DEFAULT_LITERAL_TARGETS },
    byZone: ZONES.map(z => ({
      zone: z,
      minutes: 0,
      target: DEFAULT_LITERAL_TARGETS[z],
      ratioToTarget: 0,
      status: 'under',
      deltaMin: -DEFAULT_LITERAL_TARGETS[z],
    })),
    worstZone: null,
    band: 'good',
    message: { ...MESSAGES.good },
    recommendation: { ...RECS.good },
    reliable: false,
    citation: TIME_IN_ZONE_CITATION,
  }

  if (!Array.isArray(log) || log.length === 0) return empty

  const start28 = addDaysStr(today, -27)
  const recent = log.filter(e => e?.date && e.date >= start28 && e.date <= today)

  const totals = [0, 0, 0, 0, 0]
  for (const entry of recent) {
    const m = entryZoneMinutes(entry)
    for (let i = 0; i < 5; i++) totals[i] += m[i]
  }
  const totalMinutes = totals.reduce((s, v) => s + v, 0)

  const minutesPerZone = totals.map(v => Math.round(v))
  const sharePerZone = totals.map(v =>
    totalMinutes > 0 ? Math.round((v / totalMinutes) * 10) / 10 : 0,
  )

  const callerProvidedTargets =
    targets && typeof targets === 'object' && Object.keys(targets).length > 0
  const targetMinutes = {}
  if (callerProvidedTargets) {
    for (const z of ZONES) targetMinutes[z] = Number(targets[z]) || 0
  } else {
    for (const z of ZONES) {
      targetMinutes[z] = Math.round(totalMinutes * POLARIZED_FRACTIONS[z])
    }
  }

  const byZone = ZONES.map((zone, i) => {
    const minutes = minutesPerZone[i]
    const target = targetMinutes[zone]
    let ratioToTarget
    let status
    if (target === 0) {
      ratioToTarget = null
      status = minutes === 0 ? 'on-target' : 'over'
    } else {
      ratioToTarget = minutes / target
      if (ratioToTarget < 0.8) status = 'under'
      else if (ratioToTarget > 1.2) status = 'over'
      else status = 'on-target'
    }
    return {
      zone,
      minutes,
      target,
      ratioToTarget,
      status,
      deltaMin: minutes - target,
    }
  })

  const offTarget = byZone.filter(b => b.status !== 'on-target')
  let band
  if (offTarget.length === 0) band = 'good'
  else if (offTarget.length === 1) band = 'moderate'
  else band = 'poor'

  let worstZone = null
  if (offTarget.length > 0) {
    let pick = offTarget[0]
    for (const b of offTarget) {
      if (Math.abs(b.deltaMin) > Math.abs(pick.deltaMin)) pick = b
    }
    worstZone = { zone: pick.zone, deltaMin: pick.deltaMin, status: pick.status }
  }

  let message
  let recommendation
  if (band === 'good') {
    message = { ...MESSAGES.good }
    recommendation = { ...RECS.good }
  } else if (band === 'moderate') {
    const w = offTarget[0]
    const direction = w.status === 'over' ? 'over' : 'under'
    const zoneLabelEn = w.zone
    const zoneLabelTr = w.zone
    message = {
      en: `${zoneLabelEn} ${direction} target`,
      tr: `${zoneLabelTr} hedefin ${TR_DIRECTION[direction]}`,
    }
    if (direction === 'under') {
      const need = Math.max(0, w.target - w.minutes)
      recommendation = {
        en: `Add ${need} minutes of ${w.zone} this week`,
        tr: `Bu hafta ${need} dakika ${w.zone} ekle`,
      }
    } else {
      const absDelta = Math.abs(w.deltaMin)
      recommendation = {
        en: `Reduce ${w.zone} sessions by ${absDelta} minutes`,
        tr: `${w.zone} seanslarını ${absDelta} dakika azalt`,
      }
    }
  } else {
    message = { ...MESSAGES.poor }
    recommendation = { ...RECS.poor }
  }

  return {
    totalMinutes,
    minutesPerZone,
    sharePerZone,
    targets: targetMinutes,
    byZone,
    worstZone,
    band,
    message,
    recommendation,
    reliable: totalMinutes >= 200,
    citation: TIME_IN_ZONE_CITATION,
  }
}
