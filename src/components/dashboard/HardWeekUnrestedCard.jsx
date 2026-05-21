// ─── HardWeekUnrestedCard.jsx ────────────────────────────────────────────
// Surfaces `analyzeHardWeekUnrested` (Foster 2001; Halson 2014; Bompa 2018):
// counts SPECIFIC OVERREACHING EVENTS in the last 16 weeks where TSS
// spiked ≥120% of the prior 3-week mean AND was NOT followed by a deload
// week.
//
// Render rules:
//   - Returns null when the pure-fn returns null (unresolvable today).
//   - Otherwise renders for all four bands incl. CLEAN.
//   - 16 mini bars (one per week) coloured by classification:
//       rested hard week  → green
//       unrested hard week → red
//       ordinary week     → grey
//   - Up to 3 most-recent unrested events surface as chips.
//
// Bilingual EN/TR via LangCtx.
// Test anchors: data-card="hard-week-unrested", data-band,
//   data-total-hard-weeks, data-unrested-count, data-unrested-rate.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeHardWeekUnrested } from '../../lib/athlete/hardWeekUnrested.js'

const MONO = "'IBM Plex Mono', monospace"
const WINDOW_WEEKS = 16

const BAND_COLOR = {
  CLEAN:                '#5bc25b', // green — no unrested overreaching events
  OCCASIONAL_UNRESTED:  '#0064ff', // blue  — one slip, monitor
  REPEATED_UNRESTED:    '#ff6600', // orange — pattern emerging
  CHRONIC_UNRESTED:     '#e03030', // red    — non-functional overreaching risk
}

const BAND_LABEL_EN = {
  CLEAN:               'CLEAN',
  OCCASIONAL_UNRESTED: 'OCCASIONAL',
  REPEATED_UNRESTED:   'REPEATED',
  CHRONIC_UNRESTED:    'CHRONIC',
}
const BAND_LABEL_TR = {
  CLEAN:               'TEMİZ',
  OCCASIONAL_UNRESTED: 'ARA SIRA',
  REPEATED_UNRESTED:   'TEKRARLAYAN',
  CHRONIC_UNRESTED:    'KRONİK',
}

const HINT_EN = {
  CLEAN:
    'No unrested overreaching events. Every hard week was followed by a real recovery — exactly how supercompensation works.',
  OCCASIONAL_UNRESTED:
    'One hard week without recovery. Productive overreaching needs a deload to convert into adaptation — schedule rest after the next spike.',
  REPEATED_UNRESTED:
    'Repeated hard weeks without recovery. The dose is accumulating into non-functional overreaching territory. Insert a recovery week now.',
  CHRONIC_UNRESTED:
    'Chronic pattern of hard weeks without recovery — overtraining risk. Stop, run a 7–10 day unload, and rebuild the deload cadence.',
}
const HINT_TR = {
  CLEAN:
    'Dinlenmemiş aşırı yüklenme olayı yok. Her sert hafta gerçek bir toparlanma ile takip edildi — süperkompansasyon tam olarak böyle işler.',
  OCCASIONAL_UNRESTED:
    'Toparlanmasız bir sert hafta. Verimli aşırı yüklenme adaptasyona dönüşmek için boşaltma gerektirir — bir sonraki sıçramadan sonra dinlenme planla.',
  REPEATED_UNRESTED:
    'Toparlanmasız sert haftalar tekrarlıyor. Doz fonksiyonel olmayan aşırı yüklenme alanına birikiyor. Şimdi bir toparlanma haftası ekle.',
  CHRONIC_UNRESTED:
    'Toparlanmasız sert hafta kronik deseni — aşırı antrenman riski. Dur, 7–10 günlük yük azaltma uygula ve boşaltma sıklığını yeniden kur.',
}

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
                  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function formatWeekLabel(iso, isTR) {
  if (!iso || iso.length < 10) return ''
  const months = isTR ? MONTH_TR : MONTH_EN
  const m = Number(iso.slice(5, 7)) - 1
  const d = Number(iso.slice(8, 10))
  if (Number.isNaN(m) || Number.isNaN(d) || m < 0 || m > 11) return iso
  return isTR ? `${d} ${months[m]}` : `${months[m]} ${d}`
}

function formatSpikePct(spikePct) {
  const pct = Math.round(spikePct * 1000) / 10 // 1 dp
  if (pct === 0) return '+0%'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}

// ─── Mini-bar timeline (16 bars, oldest left → newest right) ─────────────
function MiniBars({ weekClassifications }) {
  const W = 280
  const H = 30
  const PAD_X = 4
  const GAP = 2
  const barWidth = (W - PAD_X * 2 - GAP * (weekClassifications.length - 1)) /
                   Math.max(weekClassifications.length, 1)

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
      data-mini-chart="hard-week-unrested"
      style={{ display: 'block', marginTop: 8 }}
    >
      {weekClassifications.map((cls, i) => {
        const color =
          cls === 'unrested' ? '#e03030' :
          cls === 'rested'   ? '#5bc25b' :
                               '#3a3a3a' // ordinary
        const x = PAD_X + i * (barWidth + GAP)
        return (
          <rect
            key={i}
            data-mini-bar={cls}
            data-mini-bar-idx={i}
            x={x}
            y={H * 0.2}
            width={barWidth}
            height={H * 0.6}
            fill={color}
            opacity={cls === 'ordinary' ? 0.6 : 1}
            rx="1"
          />
        )
      })}
    </svg>
  )
}

/**
 * @description Surface `analyzeHardWeekUnrested` as a Dashboard card.
 *   Renders null when the analyzer returns null.
 *
 * @param {{ log: Array }} props
 */
export default function HardWeekUnrestedCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => todayIso(), [])

  const analysis = useMemo(
    () => analyzeHardWeekUnrested({ log, today, windowWeeks: WINDOW_WEEKS }),
    [log, today],
  )

  // Build 16-week classification timeline (oldest left → newest right).
  // Each week index maps to one of: 'unrested' | 'rested' | 'ordinary'.
  const weekClassifications = useMemo(() => {
    const arr = new Array(WINDOW_WEEKS).fill('ordinary')
    if (!analysis) return arr
    const todayD = new Date(today + 'T00:00:00Z')
    const dow = (todayD.getUTCDay() + 6) % 7
    todayD.setUTCDate(todayD.getUTCDate() - dow)
    const currentMondayMs = todayD.getTime()
    const idxByStart = Object.create(null)
    for (let i = 0; i < WINDOW_WEEKS; i++) {
      const ms = currentMondayMs - (WINDOW_WEEKS - 1 - i) * 7 * 86400000
      idxByStart[new Date(ms).toISOString().slice(0, 10)] = i
    }
    for (const ev of analysis.events) {
      const idx = idxByStart[ev.hardWeekStart]
      if (idx == null) continue
      arr[idx] = ev.wasRested ? 'rested' : 'unrested'
    }
    return arr
  }, [analysis, today])

  // Most-recent UNRESTED events first (oldest-first → reverse, then slice).
  const recentUnrested = useMemo(() => {
    if (!analysis) return []
    return analysis.events.filter(ev => !ev.wasRested).slice(-3).reverse()
  }, [analysis])

  if (!analysis) return null

  const {
    band,
    totalHardWeeks,
    unrestedCount,
    unrestedRate,
    citation,
  } = analysis

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'DİNLENMEMİŞ SERT HAFTALAR' : 'UNRESTED HARD WEEKS'
  const ariaLabel = isTR
    ? 'Dinlenmemiş sert haftalar: toparlanma takip etmeyen aşırı yüklenme olayları (Foster 2001; Halson 2014; Bompa 2018)'
    : 'Unrested hard weeks: overreaching events without recovery follow-up (Foster 2001; Halson 2014; Bompa 2018)'

  const unrestedRateDisplay = `${Math.round(unrestedRate * 1000) / 10}%`

  const noDeloadLabelEN = 'no deload after'
  const noDeloadLabelTR = 'sonrası boşaltma yok'
  const incompleteLabelEN = 'follow-up incomplete'
  const incompleteLabelTR = 'sonrası eksik'
  const weekSuffixEN = 'week'
  const weekSuffixTR = 'haftası'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="hard-week-unrested"
      data-band={band}
      data-total-hard-weeks={String(totalHardWeeks)}
      data-unrested-count={String(unrestedCount)}
      data-unrested-rate={String(unrestedRate)}
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
        <div
          data-hard-week-title
          style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
            color: 'var(--text, #ccc)',
          }}
        >
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

      {/* Big stat */}
      <div style={{ marginTop: 10 }}>
        <div
          data-unrested-display
          style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}
        >
          {unrestedCount}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 4 }}>
          {isTR
            ? 'toparlanmasız sert hafta'
            : 'hard weeks without recovery'}
          {' · '}
          <span data-total-hard-weeks-label>
            {isTR ? 'toplam sert' : 'total hard'}: {totalHardWeeks}
          </span>
          {' · '}
          <span data-unrested-rate-label>
            {isTR ? 'oran' : 'rate'}: {unrestedRateDisplay}
          </span>
        </div>
      </div>

      {/* 16-bar timeline */}
      <MiniBars weekClassifications={weekClassifications} />

      {/* Recent unrested-event chips (up to 3) */}
      {recentUnrested.length > 0 ? (
        <div
          data-unrested-chips
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10,
          }}
        >
          {recentUnrested.map((ev, i) => {
            const followNote = ev.followUpWeekTss == null
              ? (isTR ? incompleteLabelTR : incompleteLabelEN)
              : (isTR ? noDeloadLabelTR : noDeloadLabelEN)
            const weekTxt = isTR
              ? `${formatWeekLabel(ev.hardWeekStart, true)} ${weekSuffixTR}`
              : `${formatWeekLabel(ev.hardWeekStart, false)} ${weekSuffixEN}`
            return (
              <div
                key={ev.hardWeekStart || i}
                data-unrested-chip
                data-chip-week-start={ev.hardWeekStart}
                style={{
                  fontSize: 9, padding: '3px 6px',
                  border: `1px solid ${color}`, borderRadius: 3,
                  color: 'var(--text, #ccc)',
                  background: 'var(--surface, #111)',
                  lineHeight: 1.4,
                }}
              >
                {weekTxt}, {formatSpikePct(ev.spikePct)}, {followNote}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Band-coloured interpretation strip */}
      <div
        data-band-hint
        style={{
          marginTop: 10, padding: '6px 8px',
          background: 'var(--surface, #111)', borderRadius: 4,
          borderLeft: `2px solid ${color}`,
          fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
        }}
      >
        ↗ {hint}
      </div>

      {/* Citation */}
      <div
        data-hard-week-citation
        style={{
          marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
        }}
      >
        {citation}
      </div>
    </div>
  )
}
