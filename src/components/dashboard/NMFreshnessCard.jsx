// src/components/dashboard/NMFreshnessCard.jsx
// E15 — Neuromuscular Freshness Index dashboard card
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeNMFatigue, nmFatigueHistory } from '../../lib/science/neuromuscularFreshness.js'

// ── Classification → color mapping ───────────────────────────────────────────
const CLASSIFICATION_COLOR = {
  fresh:       '#5bc25b',
  normal:      '#ff9800',
  accumulated: '#f44336',
  overreached: '#9c27b0',
}

// ── Classification → i18n key mapping ────────────────────────────────────────
const CLASSIFICATION_KEY = {
  fresh:       'nmFresh',
  normal:      'nmNormal',
  accumulated: 'nmAccumulated',
  overreached: 'nmOverreached',
}

// ── Bar height for sparkline ──────────────────────────────────────────────────
const BAR_H = 40
const BAR_W = 24
const BAR_GAP = 4

export default function NMFreshnessCard({ log }) {
  const { t } = useContext(LangCtx)

  // Return null if log is too short (< 14 sessions minimum context)
  if (!Array.isArray(log) || log.length < 14) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = useMemo(() => computeNMFatigue(log), [log])
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const history = useMemo(() => nmFatigueHistory(log, 8), [log])

  const scoreColor = CLASSIFICATION_COLOR[result.classification] ?? '#888'
  const classLabel = t(CLASSIFICATION_KEY[result.classification]) || result.classification

  // Sparkline: scores that are non-null determine the max for bar height
  const nonNullScores = history.map(w => w.score).filter(s => s !== null)
  const maxScore = nonNullScores.length > 0 ? Math.max(...nonNullScores) : 100

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms', borderLeft: `4px solid ${scoreColor}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
          {t('nmFreshness') || 'Neuromuscular Freshness'}
        </div>
        {/* Classification badge */}
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px',
          color: scoreColor,
          border: `1px solid ${scoreColor}55`,
          borderRadius: '2px',
          padding: '2px 8px',
          letterSpacing: '0.06em',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          {classLabel}
        </div>
      </div>

      {/* Score */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '44px',
          fontWeight: 700,
          color: scoreColor,
          lineHeight: 1,
        }}>
          {result.score}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>
          / 100
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#555', letterSpacing: '0.06em' }}>
          {t('nmFreshnessScore') || 'NM Freshness Score'}
        </div>
      </div>

      {/* Last hard session */}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'var(--muted)', marginBottom: '12px' }}>
        {result.lastHardSessionDaysAgo !== null
          ? `${t('nmLastHard') || 'Last hard session'}: ${result.lastHardSessionDaysAgo}d ago`
          : (t('nmLastHard') ? `${t('nmLastHard')}: —` : 'No recent hard sessions')}
      </div>

      {/* 8-week sparkline */}
      <div style={{ marginBottom: '8px' }}>
        <svg
          width={history.length * (BAR_W + BAR_GAP) - BAR_GAP}
          height={BAR_H + 14}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {history.map((week, i) => {
            const x = i * (BAR_W + BAR_GAP)
            const score = week.score
            const barColor = score === null
              ? '#2a2a2a'
              : CLASSIFICATION_COLOR[
                  score >= 80 ? 'fresh'
                : score >= 60 ? 'normal'
                : score >= 35 ? 'accumulated'
                : 'overreached'
                ] ?? '#555'
            const barH = score !== null && maxScore > 0
              ? Math.max(3, Math.round(score / maxScore * BAR_H))
              : 3
            const y = BAR_H - barH
            return (
              <g key={week.weekStart}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={barH}
                  fill={barColor}
                  rx="2"
                  opacity={score === null ? 0.3 : 0.85}
                />
                {/* Score label inside tall bars */}
                {score !== null && barH >= 16 && (
                  <text
                    x={x + BAR_W / 2}
                    y={y + barH - 4}
                    textAnchor="middle"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', fill: '#fff', fontWeight: 600 }}
                  >
                    {score}
                  </text>
                )}
                {/* Week label below bar */}
                <text
                  x={x + BAR_W / 2}
                  y={BAR_H + 12}
                  textAnchor="middle"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', fill: '#444' }}
                >
                  {`W${i + 1}`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Citation footer */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '8px',
        color: '#333',
        borderTop: '1px solid var(--border)',
        paddingTop: '6px',
        marginTop: '4px',
        lineHeight: 1.5,
      }}>
        {result.citation}
      </div>
    </div>
  )
}
