// ─── src/lib/athlete/sleepCtlCorrelation.js ──────────────────────────────────
// Pearson r between daily sleep hours and same-day CTL across a trailing
// `windowDays` window (default 28). Surfaces whether THIS athlete's
// chronic training load tracks their sleep — actionable when r >= 0.4.
//
// References:
//   Halson 2014 — Sleep and the elite athlete
//   Mah 2011    — Effects of sleep extension on athletic performance
//   Walker 2017 — Why We Sleep (recovery/adaptation pathways)
//
// Pairing rule: a day pairs only when (a) the date falls inside the
// trailing window, (b) sleep hours parse to a sane number, and (c) CTL
// has been computed for that date by the EMA walk over `log`. CTL on
// dates earlier than the log's first entry is treated as 0 — those days
// still pair so a fresh athlete's recent sleep history is not silently
// dropped.
//
// Interpretation bands (Halson 2014 framing; correlations are noisy in
// small windows, so we deliberately keep the thresholds conservative):
//   strong   r >= 0.4         — "your CTL gains track your sleep"
//   moderate 0.2 <= r < 0.4   — "directional signal; sleep likely helps"
//   weak     |r| < 0.2 or r negative
//                              — "no clear signal; many recovery
//                                 factors at play". A negative r is
//                                 NEVER framed as "sleep is bad".

export const SLEEP_CTL_CITATION = 'Halson 2014; Mah 2011; Walker 2017'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Pick sleep hours off a recovery entry. Primary field is `sleepHrs`
// (matches Sporeus' existing recovery row shape; see sleepRestingHR.js);
// `sleepHours` is accepted as a fallback so the function tolerates any
// caller that names the field with the long form.
function pickSleepHours(entry) {
  if (!entry) return null
  const raw = entry.sleepHrs ?? entry.sleepHours
  const v = parseFloat(raw)
  if (!Number.isFinite(v)) return null
  if (v <= 0 || v >= 24) return null
  return v
}

// Parse YYYY-MM-DD safely to a UTC Date. Returns null on garbage.
function parseISODate(s) {
  if (typeof s !== 'string' || s.length < 10) return null
  const d = new Date(s.slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function toISO(d) { return d.toISOString().slice(0, 10) }

// Walk daily TSS through an EMA to get CTL per date. Mirrors `calcLoad`
// in src/lib/formulas.js (kC = 2/(42+1)) but exposes the full timeline
// instead of just the last value, so each recovery date can read its
// own day's CTL. We deliberately do not import calcLoad — calling it
// per-day would be O(N²) and we promised to leave it untouched.
function buildCtlByDate(log, endDate) {
  if (!Array.isArray(log) || log.length === 0) return new Map()
  const byDate = {}
  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    byDate[e.date] = (byDate[e.date] || 0) + (Number(e.tss) || 0)
  }
  const dateKeys = Object.keys(byDate).sort()
  if (dateKeys.length === 0) return new Map()
  const start = parseISODate(dateKeys[0])
  const end   = parseISODate(endDate) || new Date()
  if (!start) return new Map()
  const kC = 2 / (42 + 1)
  let ctl = 0
  const map = new Map()
  const cursor = new Date(start.getTime())
  while (cursor <= end) {
    const iso = toISO(cursor)
    const tss = byDate[iso] || 0
    ctl = tss * kC + ctl * (1 - kC)
    map.set(iso, ctl)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return map
}

function pearson(xs, ys) {
  const n = xs.length
  if (n < 2) return 0
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i] }
  const mx = sx / n, my = sy / n
  let num = 0, dxs = 0, dys = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dxs += dx * dx
    dys += dy * dy
  }
  if (dxs === 0 || dys === 0) return 0
  const r = num / Math.sqrt(dxs * dys)
  if (!Number.isFinite(r)) return 0
  return Math.max(-1, Math.min(1, r))
}

function classify(r) {
  if (r >= 0.4) return 'strong'
  if (r >= 0.2 && r < 0.4) return 'moderate'
  return 'weak'
}

function buildInterpretation(r, band) {
  if (band === 'strong') {
    return {
      en: 'Strong positive — your CTL gains track your sleep. Protect 8+ hours on hard days.',
      tr: 'Güçlü pozitif — KTY kazanımların uykunla eşleşiyor. Ağır günlerde 8+ saati koru.',
    }
  }
  if (band === 'moderate') {
    return {
      en: 'Moderate — sleep is a directional signal for your adaptation; keep building the habit.',
      tr: 'Orta düzeyde — uyku adaptasyonun için yönlendirici bir sinyal; alışkanlığı sürdür.',
    }
  }
  // Weak / no signal — explicit caveat that a negative r is NOT
  // evidence against sleep. Halson 2014 + Walker 2017: under-sleep is
  // never the right intervention regardless of personal correlation.
  if (r < 0) {
    return {
      en: 'Weak / no signal — multiple recovery factors at play. A negative correlation here is noise, not evidence against keeping 8+ hours.',
      tr: 'Zayıf / sinyal yok — birden fazla iyileşme etmeni etkili. Negatif korelasyon burada gürültüdür; 8+ saat uyumayı sürdürmenin aleyhine bir kanıt değildir.',
    }
  }
  return {
    en: 'Weak / no signal — multiple recovery factors at play; sleep alone may not be the dominant driver of your CTL.',
    tr: 'Zayıf / sinyal yok — birden fazla iyileşme etmeni etkili; uyku tek başına KTY için baskın etken olmayabilir.',
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the Pearson correlation between same-day sleep hours and CTL
 * over the trailing `windowDays` window.
 *
 * @param {Object} params
 * @param {Array}  params.log        Training log entries (date, tss, ...)
 * @param {Array}  params.recovery   Recovery entries (date, sleepHrs, ...)
 * @param {string} [params.today]    ISO date 'YYYY-MM-DD'; defaults to system today
 * @param {number} [params.windowDays=28]  Trailing days to include
 * @returns {{ r:number, n:number, meanSleep:number, meanCtl:number,
 *             interpretation:{en:string,tr:string}, band:'strong'|'moderate'|'weak',
 *             citation:string, windowDays:number } | null}
 */
export function computeSleepCtlCorrelation({
  log,
  recovery,
  today,
  windowDays = 28,
} = {}) {
  if (!Array.isArray(recovery) || recovery.length === 0) return null

  const windowN = Math.max(1, Math.floor(Number(windowDays) || 28))
  const todayDate = parseISODate(today) || (() => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    return d
  })()
  const todayISO = toISO(todayDate)

  const cutoff = new Date(todayDate.getTime())
  cutoff.setUTCDate(cutoff.getUTCDate() - (windowN - 1))
  const cutoffISO = toISO(cutoff)

  const ctlByDate = buildCtlByDate(Array.isArray(log) ? log : [], todayISO)

  // De-dupe by date: latest entry per date wins (matches the "one
  // recovery row per day" expectation throughout the app).
  const recoveryByDate = new Map()
  for (const r of recovery) {
    if (!r || typeof r.date !== 'string') continue
    const d = r.date.slice(0, 10)
    if (d < cutoffISO || d > todayISO) continue
    recoveryByDate.set(d, r)
  }

  const xs = [] // sleep hours
  const ys = [] // CTL on that date
  for (const [date, entry] of recoveryByDate) {
    const sleep = pickSleepHours(entry)
    if (sleep === null) continue
    // CTL falls back to 0 for dates earlier than the log's start (this
    // is what calcLoad would yield — those days had no recorded load).
    const ctl = ctlByDate.has(date) ? ctlByDate.get(date) : 0
    xs.push(sleep)
    ys.push(ctl)
  }

  if (xs.length < 7) return null

  const rRaw = pearson(xs, ys)
  const r = Math.round(rRaw * 100) / 100
  const band = classify(r)

  const meanSleep = Math.round(
    (xs.reduce((s, v) => s + v, 0) / xs.length) * 10,
  ) / 10
  const meanCtl = Math.round(
    ys.reduce((s, v) => s + v, 0) / ys.length,
  )

  return {
    r,
    n: xs.length,
    meanSleep,
    meanCtl,
    band,
    interpretation: buildInterpretation(r, band),
    citation: SLEEP_CTL_CITATION,
    windowDays: windowN,
  }
}
