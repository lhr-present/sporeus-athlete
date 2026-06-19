// ─── EnergySorenessDivergenceCard.jsx — 28d energy × soreness wellness card ─
//
// Dashboard surface for `analyzeEnergySorenessDivergence` (Hooper 1995 +
// Saw 2016 — the two subjective markers most predictive of overload
// before objective HR/HRV drift shows up). Renders:
//
//   1. Wellness quadrant — THRIVING / RECOVERING / DRAINED / STRUGGLING
//      from the 28-day means of energy (1-5 higher=better) and soreness
//      (1-5 higher=WORSE — reversed).
//   2. Two mini gauges — energy (green-to-red high→low) and soreness
//      (green-low to red-high, inverted).
//   3. `avgIndex` (= energy − soreness, range -4..+4) as a single number
//      with positive/negative coloring.
//
// Citation: Hooper 1995; Saw 2016.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeEnergySorenessDivergence } from '../../lib/athlete/energySorenessDivergence.js'

const MONO = "'IBM Plex Mono', monospace"

const QUADRANT_COLOR = {
  THRIVING:   '#5bc25b', // green
  RECOVERING: '#0064ff', // blue
  DRAINED:    '#ff6600', // orange
  STRUGGLING: '#ff4444', // red
}

const QUADRANT_TR = {
  THRIVING:   'GELİŞİYOR',
  RECOVERING: 'TOPARLANIYOR',
  DRAINED:    'TÜKENMİŞ',
  STRUGGLING: 'ZORLANIYOR',
}

const QUADRANT_HINT = {
  THRIVING: {
    en: 'High energy, low soreness — recovery is paying off. Good window for hard work.',
    tr: 'Yüksek enerji, düşük ağrı — toparlanma karşılığını veriyor. Sert iş için iyi pencere.',
  },
  RECOVERING: {
    en: 'Energy is OK but body is sore — recent stimulus is still being processed.',
    tr: 'Enerji iyi ama vücut ağrılı — son uyaran hâlâ işleniyor.',
  },
  DRAINED: {
    en: 'Low energy without high soreness — usually sleep, stress, or undereating. Address those before adding load.',
    tr: 'Yüksek ağrı olmadan düşük enerji — genellikle uyku, stres veya yetersiz beslenme. Yük eklemeden önce bunları çöz.',
  },
  STRUGGLING: {
    en: 'Low energy AND sore — recovery is incomplete. Insert a rest day or active recovery.',
    tr: 'Düşük enerji VE ağrı — toparlanma tamamlanmamış. Dinlenme veya aktif toparlanma günü ekle.',
  },
}

/**
 * Linear green→red interpolation across the 1-5 Likert scale.
 * @param {number} pct  0..1
 */
function gradientColor(pct) {
  const t = Math.max(0, Math.min(1, pct))
  // 0 = red (#ff4444), 1 = green (#5bc25b)
  const r = Math.round(0xff + (0x5b - 0xff) * t)
  const g = Math.round(0x44 + (0xc2 - 0x44) * t)
  const b = Math.round(0x44 + (0x5b - 0x44) * t)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Mini gauge: 1-5 Likert bar.
 *
 * `inverted=true` flips the colour scale so high values render RED
 * (used for soreness, where 5 = worst).
 *
 * Renders `data-wellness-gauge` with `data-gauge-name` ("energy"|"soreness")
 * and `data-gauge-value` (the avg to 2 dp).
 */
function MiniGauge({ name, label, value, inverted }) {
  const pct = Math.max(0, Math.min(1, (value - 1) / 4))
  // For energy: high pct = good (green). For soreness: high pct = bad (red).
  const colorPct = inverted ? 1 - pct : pct
  const color = gradientColor(colorPct)
  return (
    <div
      data-wellness-gauge
      data-gauge-name={name}
      data-gauge-value={Number.isFinite(value) ? value.toFixed(2) : ''}
      style={{
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 4,
      }}>
        <div style={{
          fontSize: 9,
          letterSpacing: '0.05em',
          color: 'var(--muted, #888)',
          fontWeight: 700,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 9,
          color: 'var(--muted, #888)',
        }}>
          {inverted ? '5=worst' : '5=best'}
        </div>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        marginBottom: 4,
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}>
          {Number.isFinite(value) ? value.toFixed(1) : '—'}
        </div>
        <div style={{
          fontSize: 9,
          color: 'var(--muted, #888)',
        }}>
          / 5
        </div>
      </div>
      <div style={{
        height: 4,
        background: 'var(--surface, #1a1a1a)',
        border: '1px solid var(--border, #222)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            background: color,
          }}
        />
      </div>
    </div>
  )
}

/**
 * Format the avg-index to one decimal place with an explicit sign.
 * 0.0 displayed without a leading "+" or "-".
 */
function fmtIndex(v) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) < 0.05) return '0.0'
  const sign = v > 0 ? '+' : '-'
  return `${sign}${Math.abs(v).toFixed(1)}`
}

/**
 * Dashboard card for the 28-day energy × soreness wellness balance.
 * Renders null when the analyzer returns null (insufficient samples).
 *
 * @param {{ recovery: Array }} props
 */
function EnergySorenessDivergenceCard({ recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeEnergySorenessDivergence({ recovery }),
    [recovery],
  )

  if (!analysis) return null

  const color = QUADRANT_COLOR[analysis.quadrant]
  if (!color) return null

  const quadrantLabel = isTR
    ? QUADRANT_TR[analysis.quadrant]
    : analysis.quadrant
  const hint = QUADRANT_HINT[analysis.quadrant]
  const title = isTR ? 'ENERJİ × AĞRI · 28G' : 'ENERGY × SORENESS · 28D'
  const ariaLabel = isTR
    ? 'Enerji × ağrı dengesi'
    : 'Energy × soreness divergence'
  const energyLabel = isTR ? 'ENERJİ' : 'ENERGY'
  const sorenessLabel = isTR ? 'AĞRI' : 'SORENESS'
  const indexLabel = isTR ? 'İYİ-OLUŞ' : 'WELLNESS'
  const sampleLabel = isTR
    ? `${analysis.sampleCount} kayıt`
    : `${analysis.sampleCount} entries`

  // Positive avgIndex = on the good side (green), negative = bad side (red).
  const indexColor = analysis.avgIndex >= 0 ? '#5bc25b' : '#ff4444'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-energy-soreness-divergence-card
      data-wellness-quadrant={analysis.quadrant}
      data-avg-energy={analysis.avgEnergy.toFixed(2)}
      data-avg-soreness={analysis.avgSoreness.toFixed(2)}
      data-avg-index={analysis.avgIndex.toFixed(2)}
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
      {/* Header — title + quadrant badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-wellness-quadrant-label
          style={{
            fontSize: 10,
            letterSpacing: '0.05em',
            fontWeight: 700,
            padding: '3px 8px',
            background: `${color}22`,
            color,
            border: `1px solid ${color}`,
            borderRadius: 3,
          }}
        >
          {quadrantLabel}
        </div>
      </div>

      {/* Sample count */}
      <div style={{
        fontSize: 10,
        color: 'var(--muted, #888)',
        marginBottom: 12,
      }}>
        {sampleLabel}
      </div>

      {/* Two mini gauges side-by-side */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 12,
      }}>
        <MiniGauge
          name="energy"
          label={energyLabel}
          value={analysis.avgEnergy}
          inverted={false}
        />
        <MiniGauge
          name="soreness"
          label={sorenessLabel}
          value={analysis.avgSoreness}
          inverted={true}
        />
      </div>

      {/* Wellness index single number */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 10,
        padding: '6px 10px',
        background: 'var(--surface, #1a1a1a)',
        border: '1px solid var(--border, #222)',
        borderRadius: 3,
      }}>
        <div style={{
          fontSize: 9,
          letterSpacing: '0.05em',
          color: 'var(--muted, #888)',
          fontWeight: 700,
        }}>
          {indexLabel} (E − S)
        </div>
        <div
          data-wellness-index-value
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: indexColor,
            lineHeight: 1,
          }}
        >
          {fmtIndex(analysis.avgIndex)}
        </div>
      </div>

      {/* Interpretation hint (bilingual) */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${color}10`,
        border: `1px solid ${color}40`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {isTR ? hint.tr : hint.en}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Hooper 1995; Saw 2016
      </div>
    </div>
  )
}

export default memo(EnergySorenessDivergenceCard)
