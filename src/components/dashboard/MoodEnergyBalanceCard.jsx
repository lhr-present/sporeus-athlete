// ─── MoodEnergyBalanceCard.jsx — 28d mood × energy affect-circumplex card ───
//
// Dashboard surface for `analyzeMoodEnergyBalance` (Russell 1980 circumplex
// model of affect, applied to the Recovery log's `mood` and `energy`
// 1-5 Likert ratings). The card publishes two readouts:
//
//   1. Quadrant (current state) — VIGOROUS / CONTENT / EDGY / FLAT
//      based on the 28-day means of mood and energy.
//   2. Trend (direction)        — RISING / STABLE / DECLINING
//      based on the recent-14d vs early-14d delta averaged across both
//      axes.
//
// Citation: Lane A.M. (2007); Russell J.A. (1980).
//
// The card is rendered for athletes whose Recovery tab has accumulated at
// least 7 entries with BOTH mood and energy in the last 28 days. Below
// that floor the analyzer returns null and the card renders nothing.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeMoodEnergyBalance } from '../../lib/athlete/moodEnergyBalance.js'

const MONO = "'IBM Plex Mono', monospace"

// Trend band → terminal color (matches AerobicDecouplingTrendCard palette).
const TREND_COLOR = {
  RISING:    '#5bc25b', // green
  STABLE:    '#0064ff', // blue
  DECLINING: '#ff6600', // orange
}
const TREND_TR = {
  RISING:    'YÜKSELİYOR',
  STABLE:    'STABİL',
  DECLINING: 'DÜŞÜYOR',
}

const QUADRANT_TR = {
  VIGOROUS: 'COŞKULU',
  CONTENT:  'HUZURLU',
  EDGY:     'GERGİN',
  FLAT:     'DURGUN',
}

const TREND_HINT = {
  RISING: {
    en: 'Affect is improving — training is feeling good, sustain the rhythm.',
    tr: 'Duygulanım iyileşiyor — antrenman iyi hissettiriyor, ritmi sürdür.',
  },
  STABLE: {
    en: 'Affect is steady — neither charging up nor draining.',
    tr: 'Duygulanım sabit — ne yükseliyor ne tükeniyor.',
  },
  DECLINING: {
    en: 'Affect is dropping — consider a recovery week or adjust life-stress load.',
    tr: 'Duygulanım düşüyor — toparlanma haftası ya da yaşam-stres yükünü ayarlamayı düşün.',
  },
}

// Format a +/- delta to one decimal place with a sign, e.g. "+0.2" / "-0.4" / "0.0".
function fmtDelta(d) {
  if (!Number.isFinite(d)) return '0.0'
  if (Math.abs(d) < 0.05) return '0.0'
  const sign = d > 0 ? '+' : '-'
  return `${sign}${Math.abs(d).toFixed(1)}`
}

/**
 * Mini gauge: 1-5 Likert bar with a center value + delta badge.
 *
 * Renders `data-affect-gauge` with `data-affect-name` ("mood"|"energy"),
 * `data-affect-value` (the rounded avg to 2 dp), and `data-affect-delta`
 * (the recent − early delta to 2 dp).
 */
function MiniGauge({ name, label, value, delta, color }) {
  const pct = Math.max(0, Math.min(1, (value - 1) / 4)) * 100
  return (
    <div
      data-affect-gauge
      data-affect-name={name}
      data-affect-value={Number.isFinite(value) ? value.toFixed(2) : ''}
      data-affect-delta={Number.isFinite(delta) ? delta.toFixed(2) : ''}
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
          color,
          fontWeight: 700,
        }}>
          Δ {fmtDelta(delta)}
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
            width: `${pct}%`,
            height: '100%',
            background: color,
          }}
        />
      </div>
    </div>
  )
}

/**
 * @description Dashboard card for the 28-day mood × energy balance.
 * Renders null when the analyzer returns null (insufficient samples).
 *
 * @param {{ recovery: Array }} props
 */
export default function MoodEnergyBalanceCard({ recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeMoodEnergyBalance({ recovery }),
    [recovery],
  )

  if (!analysis) return null

  const color = TREND_COLOR[analysis.trend]
  if (!color) return null

  const trendLabel = isTR ? TREND_TR[analysis.trend] : analysis.trend
  const quadrantLabel = isTR
    ? QUADRANT_TR[analysis.quadrant]
    : analysis.quadrant
  const hint = TREND_HINT[analysis.trend]
  const title = isTR ? 'RUH × ENERJİ · 28G' : 'MOOD × ENERGY · 28D'
  const ariaLabel = isTR ? 'Ruh × enerji dengesi' : 'Mood × energy balance'
  const moodLabel = isTR ? 'RUH' : 'MOOD'
  const energyLabel = isTR ? 'ENERJİ' : 'ENERGY'
  const sampleLabel = isTR
    ? `${analysis.sampleCount} kayıt`
    : `${analysis.sampleCount} entries`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-mood-energy-balance-card
      data-affect-trend={analysis.trend}
      data-affect-quadrant={analysis.quadrant}
      data-avg-mood={analysis.avgMood.toFixed(2)}
      data-avg-energy={analysis.avgEnergy.toFixed(2)}
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
      {/* Header — title + trend badge */}
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
          data-affect-trend-label
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
          {trendLabel}
        </div>
      </div>

      {/* Quadrant chip + sample count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <div
          data-affect-quadrant-label
          style={{
            fontSize: 10,
            letterSpacing: '0.05em',
            fontWeight: 700,
            padding: '3px 8px',
            background: 'var(--surface, #1a1a1a)',
            color: 'var(--text, #ccc)',
            border: '1px solid var(--border, #222)',
            borderRadius: 3,
          }}
        >
          {quadrantLabel}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)' }}>
          · {sampleLabel}
        </div>
      </div>

      {/* Two mini gauges side-by-side */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 10,
      }}>
        <MiniGauge
          name="mood"
          label={moodLabel}
          value={analysis.avgMood}
          delta={analysis.moodDelta}
          color={color}
        />
        <MiniGauge
          name="energy"
          label={energyLabel}
          value={analysis.avgEnergy}
          delta={analysis.energyDelta}
          color={color}
        />
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
        Lane 2007; Russell 1980
      </div>
    </div>
  )
}
