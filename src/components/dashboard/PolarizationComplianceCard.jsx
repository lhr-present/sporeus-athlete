// src/components/dashboard/PolarizationComplianceCard.jsx
// E16 — Week-by-Week Polarization Compliance dashboard card
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  polarizationTrend,
  overallPolarizationCompliance,
} from '../../lib/science/polarizationCompliance.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const BAR_H = 16   // fixed height for each stacked bar row (px)

// Zone segment colours (Seiler palette)
const COLOR_EASY   = '#2196f3'   // blue — low intensity
const COLOR_THRESH = '#ff9800'   // orange — threshold
const COLOR_HARD   = '#f44336'   // red — high intensity

// Model → i18n key
const MODEL_KEY = {
  polarized:         'polPolarized',
  pyramidal:         'polPyramidal',
  threshold:         'polThresholdModel',
  unstructured:      'polUnstructured',
  insufficient_data: 'polInsufficientData',
}

// Overall score → border accent colour
function _scoreColor(score) {
  if (score === null || score === undefined) return '#555'
  if (score >= 80) return '#5bc25b'
  if (score >= 60) return '#ff9800'
  return '#e03030'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PolarizationComplianceCard({ log }) {
  const { t } = useContext(LangCtx)

  const safeLog = Array.isArray(log) ? log : []

  const trend = useMemo(() => polarizationTrend(safeLog, 8), [safeLog])
  const overall = useMemo(() => overallPolarizationCompliance(safeLog, 8), [safeLog])

  // Require at least 3 weeks with usable data before showing the card
  if (overall.weeksAnalyzed < 3) return null

  const { meanScore, weeksAnalyzed } = overall
  const accentColor = _scoreColor(meanScore)

  // Shared monospace font shorthand
  const mono = { fontFamily: "'IBM Plex Mono', monospace" }

  return (
    <div className="sp-card" style={{
      ...S.card,
      animationDelay: '0ms',
      borderLeft: `4px solid ${accentColor}`,
    }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px',
      }}>
        <div style={{
          ...mono,
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {t('polarizationCompliance') || 'Polarization Compliance'}
        </div>

        {/* Overall score badge */}
        {meanScore !== null && (
          <div style={{
            ...mono,
            fontSize: '11px',
            color: accentColor,
            border: `1px solid ${accentColor}55`,
            borderRadius: '3px',
            padding: '2px 8px',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}>
            {meanScore} / 100
          </div>
        )}
      </div>

      {/* ── 8-week stacked bars ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {trend.map((week, idx) => {
          const isInsufficient = week.model === 'insufficient_data'
          const modelLabel = t(MODEL_KEY[week.model]) || week.model

          return (
            <div key={week.weekStart || idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* Week label + date */}
              <div style={{
                ...mono,
                fontSize: '9px',
                color: 'var(--muted)',
                letterSpacing: '0.04em',
              }}>
                {week.weekStart}
              </div>

              {/* Stacked bar */}
              {isInsufficient ? (
                <div style={{
                  height: `${BAR_H}px`,
                  background: '#2a2a2a',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '6px',
                }}>
                  <span style={{ ...mono, fontSize: '9px', color: '#555' }}>—</span>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  height: `${BAR_H}px`,
                  borderRadius: '2px',
                  overflow: 'hidden',
                  background: '#1a1a1a',
                  width: '100%',
                }}>
                  {/* Easy segment */}
                  {week.easyPct > 0 && (
                    <div style={{
                      width: `${week.easyPct}%`,
                      background: COLOR_EASY,
                      height: '100%',
                      transition: 'width 0.3s ease',
                    }} title={`Easy: ${week.easyPct}%`} />
                  )}
                  {/* Threshold segment */}
                  {week.thresholdPct > 0 && (
                    <div style={{
                      width: `${week.thresholdPct}%`,
                      background: COLOR_THRESH,
                      height: '100%',
                      transition: 'width 0.3s ease',
                    }} title={`Threshold: ${week.thresholdPct}%`} />
                  )}
                  {/* Hard segment */}
                  {week.hardPct > 0 && (
                    <div style={{
                      width: `${week.hardPct}%`,
                      background: COLOR_HARD,
                      height: '100%',
                      transition: 'width 0.3s ease',
                    }} title={`Hard: ${week.hardPct}%`} />
                  )}
                </div>
              )}

              {/* Score + model label below each bar */}
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}>
                <span style={{
                  ...mono,
                  fontSize: '9px',
                  color: week.complianceScore !== null
                    ? _scoreColor(week.complianceScore)
                    : '#444',
                  fontWeight: 600,
                }}>
                  {week.complianceScore !== null ? week.complianceScore : '—'}
                </span>
                <span style={{
                  ...mono,
                  fontSize: '8px',
                  color: '#555',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  {modelLabel}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '10px',
        flexWrap: 'wrap',
      }}>
        {[
          { color: COLOR_EASY,   key: 'polEasy',      fallback: 'Easy' },
          { color: COLOR_THRESH, key: 'polThreshold',  fallback: 'Threshold' },
          { color: COLOR_HARD,   key: 'polHard',       fallback: 'Hard' },
        ].map(({ color, key, fallback }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              background: color,
              borderRadius: '2px',
              flexShrink: 0,
            }} />
            <span style={{ ...mono, fontSize: '9px', color: 'var(--muted)' }}>
              {t(key) || fallback}
            </span>
          </div>
        ))}
        <span style={{ ...mono, fontSize: '9px', color: '#444', marginLeft: 'auto' }}>
          {weeksAnalyzed}w data
        </span>
      </div>

      {/* ── Footer / citation ───────────────────────────────────────────────── */}
      <div style={{
        ...mono,
        fontSize: '8px',
        color: '#444',
        letterSpacing: '0.04em',
        borderTop: '1px solid var(--border)',
        paddingTop: '6px',
        lineHeight: 1.5,
      }}>
        {t('polTarget') || 'Target: 80% easy / 20% hard'} · Seiler & Kjerland (2006)
      </div>
    </div>
  )
}
