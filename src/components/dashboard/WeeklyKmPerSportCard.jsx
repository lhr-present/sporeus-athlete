// ─── WeeklyKmPerSportCard.jsx — Dashboard surface for per-sport weekly km ──
//
// Surfaces `analyzeWeeklyKmPerSport` (src/lib/athlete/weeklyKmPerSport.js):
// this week's km vs the 12-week average, per sport, sorted by the
// 12-week average (biggest sports first). Athletes anchor training
// narratives in per-sport km — sport-agnostic TSS/volume cards miss
// that framing entirely.
//
// Render rules:
//   - Render NULL if the analyzer returns null OR if it returns an
//     empty sports[] (defensive — the analyzer already strips zero-zero
//     sports, but the prop contract is "render nothing if there's
//     nothing to say").
//   - One row per sport. Sport label + thisWeekKm (1dp) + small ref
//     showing the 12wk average + colored delta chip.
//   - Delta chip color bands (vs the 12-week average):
//       GREEN  — deltaPct > +0.10  (above average week)
//       BLUE   — −0.10 ≤ deltaPct ≤ +0.10  (typical week)
//       ORANGE — deltaPct < −0.10  (below average week)
//       MUTED  — deltaPct null (no 12-week history yet)
//
// Citation: Daniels J. (2014) Daniels' Running Formula; Bompa T. (2018)
// Periodization.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeWeeklyKmPerSport } from '../../lib/athlete/weeklyKmPerSport.js'

const MONO = "'IBM Plex Mono', monospace"

const SPORT_LABEL = {
  run:   { en: 'Run',     tr: 'Koşu' },
  bike:  { en: 'Bike',    tr: 'Bisiklet' },
  swim:  { en: 'Swim',    tr: 'Yüzme' },
  row:   { en: 'Row',     tr: 'Kürek' },
  other: { en: 'Other',   tr: 'Diğer' },
}

// Color bands for the per-sport delta vs 12wk average.
const BAND_GREEN  = '#5bc25b'
const BAND_BLUE   = '#0064ff'
const BAND_ORANGE = '#ff6600'
const BAND_MUTED  = '#888'

function bandFor(deltaPct) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return { color: BAND_MUTED, kind: 'NEW' }
  if (deltaPct > 0.10)  return { color: BAND_GREEN,  kind: 'ABOVE' }
  if (deltaPct < -0.10) return { color: BAND_ORANGE, kind: 'BELOW' }
  return { color: BAND_BLUE, kind: 'TYPICAL' }
}

function fmtKm(n) {
  if (!Number.isFinite(n)) return '0.0'
  return n.toFixed(1)
}

function fmtDelta(deltaPct, isTR) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) {
    return isTR ? 'YENİ' : 'NEW'
  }
  const pct = Math.round(deltaPct * 100)
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}

/**
 * @description Surface `analyzeWeeklyKmPerSport` as a Dashboard card.
 *   Renders null when the analyzer returns null or sports[] is empty.
 *
 * @param {{ log: Array }} props
 */
function WeeklyKmPerSportCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(() => analyzeWeeklyKmPerSport({ log }), [log])

  if (!analysis) return null
  if (!Array.isArray(analysis.sports) || analysis.sports.length === 0) return null

  const title = isTR ? 'HAFTALIK KM × SPOR' : 'WEEKLY KM × SPORT'
  const ariaLabel = isTR ? 'Spor başına haftalık km' : 'Weekly km per sport'
  const thisWeekLabel = isTR ? 'BU HAFTA' : 'THIS WEEK'
  const avgLabel = isTR ? '12-HAFTA ORT.' : '12-WK AVG'
  const hint = isTR
    ? 'Spor başına haftalık km, 12-haftalık ortalamana karşı. Sporcular haftalık hacmi vücutlarında spor bazında hisseder.'
    : 'Per-sport weekly km versus your 12-week average. Per-sport progression is how athletes feel weekly volume in their bones.'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-weekly-km-per-sport-card
      data-sport-count={analysis.sports.length}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color: BAND_BLUE, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div style={{
          fontSize: 9,
          color: 'var(--muted, #777)',
          letterSpacing: '0.05em',
        }}>
          {thisWeekLabel} · {avgLabel}
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {analysis.sports.map((row) => {
          const labelObj = SPORT_LABEL[row.key] || SPORT_LABEL.other
          const label = isTR ? labelObj.tr : labelObj.en
          const band = bandFor(row.deltaPct)
          return (
            <div
              key={row.key}
              data-sport-row
              data-sport-key={row.key}
              data-this-week-km={row.thisWeekKm}
              data-avg-12w-km={row.avg12WeekKm}
              data-delta-pct={row.deltaPct == null ? '' : row.deltaPct}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                background: 'var(--surface, #141414)',
                border: '1px solid var(--border, #222)',
                borderRadius: 3,
              }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text)',
              }}>
                {label}
              </div>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtKm(row.thisWeekKm)} km
              </div>
              <div style={{
                fontSize: 9,
                color: 'var(--muted, #777)',
                letterSpacing: '0.03em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                · {avgLabel} {fmtKm(row.avg12WeekKm)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 6px',
                  background: `${band.color}22`,
                  color: band.color,
                  border: `1px solid ${band.color}`,
                  borderRadius: 2,
                  letterSpacing: '0.03em',
                  minWidth: 44,
                  textAlign: 'center',
                }}
              >
                {fmtDelta(row.deltaPct, isTR)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Interpretation hint */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${BAND_BLUE}10`,
        border: `1px solid ${BAND_BLUE}40`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {hint}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Daniels 2014; Bompa 2018
      </div>
    </div>
  )
}

export default memo(WeeklyKmPerSportCard)
