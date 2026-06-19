// ─── SeasonAnchorCard.jsx ─────────────────────────────────────────────────
// Surfaces `analyzeSeasonAnchor` (Hägglund 2013; Bompa 2018) — the
// athlete's lowest 4-week-rolling TSS sum in the last 6 months ("season
// anchor") and how far they've climbed from it. Distinct from absolute
// fitness cards (CTL/ACWR): this is the *relative* macrocycle frame.
//
// Render rules:
//   - Returns null when the pure-fn returns null (insufficient history).
//   - Otherwise renders for all five bands.
//
// Bilingual EN/TR via LangCtx.
// Test anchors:
//   data-card="season-anchor", data-anchor-band, data-anchor-4w-tss,
//   data-current-last-4w-tss, data-ramp-ratio, data-days-since-anchor,
//   data-peak-4w-tss, data-anchor-date, data-peak-date.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeSeasonAnchor } from '../../lib/athlete/seasonAnchor.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  AT_ANCHOR:     '#888888', // muted — nadir
  EARLY_RAMP:    '#0064ff', // blue  — gentle re-ignition
  BUILDING:      '#5bc25b', // green — sustainable build
  PEAK_BLOCK:    '#ff6600', // orange — near all-time peak
  ABOVE_HISTORY: '#ff0066', // hot pink — new high
}

const BAND_LABEL_EN = {
  AT_ANCHOR:     'AT ANCHOR',
  EARLY_RAMP:    'EARLY RAMP',
  BUILDING:      'BUILDING',
  PEAK_BLOCK:    'PEAK BLOCK',
  ABOVE_HISTORY: 'NEW HIGH',
}
const BAND_LABEL_TR = {
  AT_ANCHOR:     'DEMİR ATIŞTA',
  EARLY_RAMP:    'ERKEN RAMPA',
  BUILDING:      'İNŞA',
  PEAK_BLOCK:    'ZİRVE BLOĞU',
  ABOVE_HISTORY: 'YENİ ZİRVE',
}

const HINT_EN = {
  AT_ANCHOR:
    'You are essentially at your 6-month low. Either a planned base reset, or time to start ramping.',
  EARLY_RAMP:
    'Early build phase — load is rising off the floor. Watch ACWR; this is when ramp-rate injuries cluster.',
  BUILDING:
    'Mid-macrocycle build — well clear of the nadir but not yet at peak load. Sustainable territory.',
  PEAK_BLOCK:
    'Peak block — within 5% of your 6-month peak 4-week load. Plan a deload soon and protect recovery.',
  ABOVE_HISTORY:
    'New 4-week-load high for this season. Audit ACWR and recovery before adding more.',
}
const HINT_TR = {
  AT_ANCHOR:
    '6 ayın en düşüğündesin. Ya planlı bir temel sıfırlama, ya da rampaya başlama vakti.',
  EARLY_RAMP:
    'Erken yapı fazı — yük tabandan yükseliyor. ACWR’yi izle; rampa hızı sakatlıkları burada yoğunlaşır.',
  BUILDING:
    'Makrosiklus ortası inşa — demir atıştan açıkça uzaklaştın ama henüz zirve yükünde değilsin. Sürdürülebilir bölge.',
  PEAK_BLOCK:
    'Zirve bloğu — 6 aylık 4-haftalık yük zirvenin %5 yakınındasın. Yakında bir azaltma planla ve toparlanmayı koru.',
  ABOVE_HISTORY:
    'Bu sezonun yeni 4-haftalık yük zirvesi. Daha fazla eklemeden önce ACWR ve toparlanmayı denetle.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

// Compute the rolling 4-week TSS series for the chart. Mirrors the
// pure-fn's logic but returns the daily series for plotting. Kept local
// to the card so the pure fn stays slim. If insufficient data, returns
// an empty array.
function buildRollingSeries(log, today, lookbackDays = 180) {
  const ROLL = 28
  if (!Array.isArray(log) || log.length === 0) return []
  const map = Object.create(null)
  let earliest = null
  for (const e of log) {
    if (!e || !e.date) continue
    const k = String(e.date).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue
    const t = Number(e.tss)
    if (!Number.isFinite(t)) continue
    map[k] = (map[k] || 0) + t
    if (earliest === null || k < earliest) earliest = k
  }
  if (!earliest) return []

  const todayD = new Date(today + 'T00:00:00Z')
  const earliestD = new Date(earliest + 'T00:00:00Z')
  // earliestValid = earliest + 27 days.
  const earliestValid = new Date(earliestD)
  earliestValid.setUTCDate(earliestValid.getUTCDate() + (ROLL - 1))

  const windowStart = new Date(todayD)
  windowStart.setUTCDate(windowStart.getUTCDate() - (lookbackDays - 1))

  const walkStart = windowStart > earliestValid ? windowStart : earliestValid
  if (walkStart > todayD) return []

  // Seed rolling: sum [walkStart-27 .. walkStart-1].
  let rolling = 0
  for (let i = ROLL - 1; i >= 1; i--) {
    const d = new Date(walkStart)
    d.setUTCDate(d.getUTCDate() - i)
    const iso = d.toISOString().slice(0, 10)
    rolling += map[iso] || 0
  }

  const out = []
  const cur = new Date(walkStart)
  while (cur <= todayD) {
    const iso = cur.toISOString().slice(0, 10)
    rolling += map[iso] || 0
    out.push({ date: iso, value: rolling })
    const drop = new Date(cur)
    drop.setUTCDate(drop.getUTCDate() - (ROLL - 1))
    const dropIso = drop.toISOString().slice(0, 10)
    rolling -= map[dropIso] || 0
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

// ─── Mini line chart ─────────────────────────────────────────────────────

function MiniSeriesChart({ series, anchorDate, peakDate, color }) {
  if (!Array.isArray(series) || series.length < 2) return null
  const W = 280
  const H = 60
  const PAD = 4
  const xs = series.map((_, i) => i)
  const ys = series.map(s => s.value)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const yRange = maxY - minY || 1
  const xRange = xs.length - 1 || 1

  const x = i => PAD + (i / xRange) * (W - PAD * 2)
  const y = v => PAD + (1 - (v - minY) / yRange) * (H - PAD * 2)

  const path = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(s.value).toFixed(2)}`)
    .join(' ')

  const anchorIdx = series.findIndex(s => s.date === anchorDate)
  const peakIdx   = series.findIndex(s => s.date === peakDate)

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
      data-mini-chart="season-anchor"
      style={{ display: 'block', marginTop: 10 }}
    >
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
      {anchorIdx >= 0 ? (
        <circle
          cx={x(anchorIdx)}
          cy={y(series[anchorIdx].value)}
          r="3"
          fill="#888"
          data-anchor-marker
        />
      ) : null}
      {peakIdx >= 0 ? (
        <circle
          cx={x(peakIdx)}
          cy={y(series[peakIdx].value)}
          r="3"
          fill="#ff6600"
          data-peak-marker
        />
      ) : null}
    </svg>
  )
}

function SeasonAnchorCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => todayIso(), [])

  const result = useMemo(
    () => analyzeSeasonAnchor({ log, today, lookbackDays: 180 }),
    [log, today]
  )

  const series = useMemo(
    () => (result ? buildRollingSeries(log, today, 180) : []),
    [log, today, result]
  )

  if (!result) return null

  const {
    band,
    anchorDate,
    anchor4wTss,
    currentLast4wTss,
    daysSinceAnchor,
    rampRatio,
    peak4wTss,
    peakDate,
    citation,
  } = result

  const color     = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint      = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'SEZON DEMİR ATIŞI' : 'SEASON ANCHOR'
  const ariaLabel = isTR
    ? 'Sezon demir atışı: son 6 ayın en düşük 4-haftalık TSS pencereleri (Hägglund 2013; Bompa 2018)'
    : 'Season anchor: lowest 4-week TSS in the last 6 months (Hägglund 2013; Bompa 2018)'

  const anchorLbl  = isTR ? 'Demir Atış' : 'Anchor'
  const nowLbl     = isTR ? 'Şimdi'      : 'Now'
  const tssUnit    = 'TSS · 4w'
  const sinceLbl   = isTR
    ? `${daysSinceAnchor} gün önce demir atış (${anchorDate})`
    : `${daysSinceAnchor}d since anchor (${anchorDate})`
  const peakLbl    = isTR
    ? `Sezon zirvesi: ${peak4wTss} · ${peakDate}`
    : `Season peak: ${peak4wTss} · ${peakDate}`
  const rampText   = isTR
    ? `${rampRatio.toFixed(2)}× demir atıştan beri`
    : `${rampRatio.toFixed(2)}× since anchor`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="season-anchor"
      data-anchor-band={band}
      data-anchor-4w-tss={anchor4wTss}
      data-current-last-4w-tss={currentLast4wTss}
      data-ramp-ratio={rampRatio}
      data-days-since-anchor={daysSinceAnchor}
      data-peak-4w-tss={peak4wTss}
      data-anchor-date={anchorDate}
      data-peak-date={peakDate}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Title + band badge */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
          color: 'var(--text, #ccc)',
        }}>
          {title}
        </div>
        <div
          data-band-label
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            color, padding: '2px 8px',
            border: `1px solid ${color}`, borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Two stats side-by-side */}
      <div style={{
        display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 110px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)' }}>
            {anchorLbl}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #ccc)', lineHeight: 1.2 }}>
            {anchor4wTss}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>
            {tssUnit} · {anchorDate}
          </div>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)' }}>
            {nowLbl}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.2 }}>
            {currentLast4wTss}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>
            {tssUnit}
          </div>
        </div>
      </div>

      {/* Big ramp ratio */}
      <div style={{ marginTop: 10 }}>
        <div
          data-ramp-display
          style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}
        >
          {rampText}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 4 }}>
          {sinceLbl}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
          {peakLbl}
        </div>
      </div>

      {/* Mini chart */}
      <MiniSeriesChart
        series={series}
        anchorDate={anchorDate}
        peakDate={peakDate}
        color={color}
      />

      {/* Band-coloured interpretation strip */}
      <div style={{
        marginTop: 10, padding: '6px 8px',
        background: 'var(--surface, #111)', borderRadius: 4,
        borderLeft: `2px solid ${color}`,
        fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
      }}>
        ↗ {hint}
      </div>

      {/* Citation */}
      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(SeasonAnchorCard)
