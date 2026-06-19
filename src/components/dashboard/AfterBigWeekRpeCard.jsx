// ─── AfterBigWeekRpeCard.jsx ─────────────────────────────────────────────
// Surfaces `analyzeAfterBigWeekRpe` (Halson 2014; Foster 2001): tracks
// mean session RPE in the week AFTER a high-volume week and compares
// it to RPE in normal weeks across the last 16 weeks.
//
// Bands:
//   NORMAL_RECOVERY      — RPE elevates post-big-week and returns by week 2
//   PROLONGED_ELEVATION  — RPE stays elevated 2+ weeks (accumulating fatigue)
//   NO_RPE_RESPONSE      — RPE doesn't move post-big-week (heroic / noisy)
//   INSUFFICIENT_DATA    — fewer than 3 big weeks in window
//
// Distinct from sibling cards:
//   - RpeStabilityCard       — within-type RPE variance (calibration)
//   - HighRpeLowTssCard      — RPE-TSS mismatch on a single session
//   - SessionRPEDriftCard    — planned-vs-actual RPE drift
//   - HardWeekUnrestedCard   — TSS overreaching events without deload
//
// Bilingual EN/TR via LangCtx.
// Test anchors: data-card="after-big-week-rpe", data-band,
//   data-big-week-count, data-mean-rpe-elevation, data-mean-rpe-week2.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeAfterBigWeekRpe } from '../../lib/athlete/afterBigWeekRpe.js'

const MONO = "'IBM Plex Mono', monospace"
const WINDOW_WEEKS = 16

const BAND_COLOR = {
  NORMAL_RECOVERY:     '#5bc25b', // green — week-1 up, week-2 returning
  NO_RPE_RESPONSE:     '#0064ff', // blue  — RPE doesn't move
  PROLONGED_ELEVATION: '#e03030', // red    — fatigue not resolving
  INSUFFICIENT_DATA:   '#888888', // grey   — not enough big weeks
}

const BAND_LABEL_EN = {
  NORMAL_RECOVERY:     'NORMAL',
  NO_RPE_RESPONSE:     'NO RESPONSE',
  PROLONGED_ELEVATION: 'PROLONGED',
  INSUFFICIENT_DATA:   'INSUFFICIENT',
}
const BAND_LABEL_TR = {
  NORMAL_RECOVERY:     'NORMAL',
  NO_RPE_RESPONSE:     'YANIT YOK',
  PROLONGED_ELEVATION: 'UZAYAN',
  INSUFFICIENT_DATA:   'YETERSİZ',
}

const HINT_EN = {
  NORMAL_RECOVERY:
    'RPE elevates in the week after a big-volume week and returns by week 2 — textbook functional overreaching with healthy recovery.',
  NO_RPE_RESPONSE:
    'RPE does not change after big-volume weeks. Either you are robustly recovered — or RPE logging is too coarse to detect the fatigue signal.',
  PROLONGED_ELEVATION:
    'Post-big-week RPE elevation is NOT returning by week 2 — accumulating fatigue. Insert a longer unload, or reduce next big-week dose.',
  INSUFFICIENT_DATA:
    'Need at least 3 big-volume weeks in the last 16 weeks to detect a post-overreaching RPE pattern.',
}
const HINT_TR = {
  NORMAL_RECOVERY:
    'Büyük hafta sonrası RPE yükseliyor ve 2. haftada normale dönüyor — sağlıklı fonksiyonel aşırı yüklenme deseni.',
  NO_RPE_RESPONSE:
    'Büyük haftadan sonra RPE değişmiyor. Ya gerçekten dayanıklısın — ya da RPE kaydı yorgunluk sinyalini yakalayamayacak kadar kaba.',
  PROLONGED_ELEVATION:
    'Büyük hafta sonrası RPE 2. haftada normale dönmüyor — yorgunluk birikiyor. Daha uzun bir boşaltma uygula veya bir sonraki büyük haftanın dozunu azalt.',
  INSUFFICIENT_DATA:
    'Son 16 haftada en az 3 büyük hacim haftası gerekli — aşırı yüklenme sonrası RPE desenini ölçmek için.',
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

function fmtPct(value) {
  if (!Number.isFinite(value)) return '0%'
  const pct = Math.round(value * 1000) / 10
  if (pct === 0) return '0%'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}

function fmtOne(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(1)
}

/**
 * @description Surface `analyzeAfterBigWeekRpe` as a Dashboard card.
 *   Renders null when the analyzer returns null.
 *
 * @param {{ log: Array }} props
 */
function AfterBigWeekRpeCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => todayIso(), [])

  const analysis = useMemo(
    () => analyzeAfterBigWeekRpe({ log, today, windowWeeks: WINDOW_WEEKS }),
    [log, today],
  )

  // Most-recent big weeks first (analyzer returns oldest-first, so reverse).
  const recentBigWeeks = useMemo(() => {
    if (!analysis) return []
    return analysis.bigWeeks.slice(-3).reverse()
  }, [analysis])

  if (!analysis) return null

  const {
    band,
    bigWeekCount,
    meanRpeElevationPct,
    meanRpeReturnAtWeek2,
    citation,
  } = analysis

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'BÜYÜK HAFTA SONRASI EFOR' : 'POST-BIG-WEEK RPE'
  const ariaLabel = isTR
    ? 'Büyük hacim haftası sonrası ortalama RPE deseni (Halson 2014; Foster 2001)'
    : 'Mean RPE pattern after big-volume weeks (Halson 2014; Foster 2001)'

  const elevationLabelEN = 'wk 1 elevation'
  const elevationLabelTR = '1. hafta artışı'
  const week2LabelEN = 'wk 2 vs base'
  const week2LabelTR = '2. hafta vs taban'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="after-big-week-rpe"
      data-band={band}
      data-big-week-count={String(bigWeekCount)}
      data-mean-rpe-elevation={String(meanRpeElevationPct)}
      data-mean-rpe-week2={String(meanRpeReturnAtWeek2)}
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
          data-after-big-week-title
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

      {/* Big stat: big-week count */}
      <div style={{ marginTop: 10 }}>
        <div
          data-big-week-display
          style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}
        >
          {bigWeekCount}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 4 }}>
          {isTR
            ? 'büyük hacim haftası · son 16 hafta'
            : 'big-volume weeks · last 16 weeks'}
        </div>
      </div>

      {/* Two-stat row: week-1 elevation + week-2 return */}
      <div
        data-rpe-pcts
        style={{
          display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap',
        }}
      >
        <div data-elevation-stat>
          <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
            {fmtPct(meanRpeElevationPct)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)',
            marginTop: 2, letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {isTR ? elevationLabelTR : elevationLabelEN}
          </div>
        </div>
        <div data-week2-stat>
          <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
            {fmtPct(meanRpeReturnAtWeek2)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)',
            marginTop: 2, letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {isTR ? week2LabelTR : week2LabelEN}
          </div>
        </div>
      </div>

      {/* Recent big-week chips (up to 3, newest first) */}
      {recentBigWeeks.length > 0 ? (
        <div
          data-big-week-chips
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12,
          }}
        >
          {recentBigWeeks.map((ev, i) => {
            const base = fmtOne(ev.bigWeekMeanRpe)
            const next = fmtOne(ev.nextWeekMeanRpe)
            const two = fmtOne(ev.twoWeeksOutMeanRpe)
            const weekTxt = formatWeekLabel(ev.weekStart, isTR)
            return (
              <div
                key={ev.weekStart || i}
                data-big-week-chip
                data-chip-week-start={ev.weekStart}
                style={{
                  fontSize: 9, padding: '3px 6px',
                  border: `1px solid ${color}`, borderRadius: 3,
                  color: 'var(--text, #ccc)',
                  background: 'var(--surface, #111)',
                  lineHeight: 1.4,
                }}
              >
                {weekTxt} (rpe {base} → {next} → {two})
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
        data-after-big-week-citation
        style={{
          marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
        }}
      >
        {citation}
      </div>
    </div>
  )
}

export default memo(AfterBigWeekRpeCard)
