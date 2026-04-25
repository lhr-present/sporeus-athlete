// ─── FitnessBatteryProgressCard.jsx — Field Test Battery Delta Progress ───────
// Reads stored battery sessions from localStorage (key: 'sporeus-test-battery').
// Compares last 2 sessions to show per-test delta %.
// References: Cooper (1968) · Kasch & Boyer (1970)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { useData } from '../../contexts/DataContext.jsx'
import { loadBatteryHistory, computeBatteryProgress } from '../../lib/athlete/batteryProgress.js'

const CARD = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
}

const TITLE = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#ff6600',
  marginBottom: '4px',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '8px',
}

const SUBTITLE = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '9px',
  color: 'var(--muted)',
  letterSpacing: '0.06em',
  marginBottom: '12px',
}

const LABEL = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '10px',
  color: 'var(--text)',
  flex: 1,
}

const VALUE = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text)',
  minWidth: '80px',
  textAlign: 'right',
}

const FOOTER = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '8px',
  color: '#555',
  letterSpacing: '0.04em',
  marginTop: '12px',
  borderTop: '1px solid var(--border)',
  paddingTop: '8px',
}

function DeltaBadge({ delta_pct }) {
  if (delta_pct === null || delta_pct === undefined) {
    return (
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px',
        color: '#555',
        minWidth: '64px',
        textAlign: 'right',
      }}>—</span>
    )
  }
  if (delta_pct > 0) {
    return (
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px',
        fontWeight: 700,
        color: '#5bc25b',
        background: '#5bc25b22',
        border: '1px solid #5bc25b55',
        borderRadius: '3px',
        padding: '1px 6px',
        minWidth: '64px',
        textAlign: 'center',
      }}>
        ▲ +{delta_pct.toFixed(1)}%
      </span>
    )
  }
  if (delta_pct < 0) {
    return (
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px',
        fontWeight: 700,
        color: '#e03030',
        background: '#e0303022',
        border: '1px solid #e0303055',
        borderRadius: '3px',
        padding: '1px 6px',
        minWidth: '64px',
        textAlign: 'center',
      }}>
        ▼ {delta_pct.toFixed(1)}%
      </span>
    )
  }
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '10px',
      color: '#555',
      minWidth: '64px',
      textAlign: 'right',
    }}>—</span>
  )
}

export default function FitnessBatteryProgressCard() {
  const { t }         = useContext(LangCtx)
  const [lang]        = useLocalStorage('sporeus-lang', 'en')
  const { profile }   = useData()

  // Load once on mount
  const [history]  = useState(() => loadBatteryHistory())
  const progress   = useMemo(() => computeBatteryProgress(history, profile), [history, profile])

  if (!progress) return null

  const { latestDate, prevDate, results, sessionCount } = progress

  const titleText = lang === 'tr' ? t('batteryTitle') : t('batteryTitle')

  const subtitleParts = prevDate
    ? `${lang === 'tr' ? t('batteryLatest') : t('batteryLatest')}: ${latestDate} · vs ${prevDate}`
    : `${lang === 'tr' ? t('batteryLatest') : t('batteryLatest')}: ${latestDate} · ${t('batteryBaseline')}`

  return (
    <div className="sp-card" style={CARD}>
      {/* Title */}
      <div style={TITLE}>◈ {titleText}</div>

      {/* Subtitle */}
      <div style={SUBTITLE}>{subtitleParts}</div>

      {/* Per-test rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {results.map(r => (
          <div
            key={r.testId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              background: '#0d0d0d',
              borderRadius: '4px',
              border: '1px solid var(--border)',
            }}
          >
            {/* Test name */}
            <span style={LABEL}>{r.name}</span>

            {/* Derived value + unit */}
            <span style={VALUE}>
              {typeof r.derived.value === 'number'
                ? r.derived.value.toFixed(r.derived.unit === 'mL/kg/min' ? 1 : r.derived.unit === 'x BW' ? 2 : r.derived.unit === 'm/s' ? 2 : 0)
                : r.derived.value}
              {r.derived.unit ? ` ${r.derived.unit}` : ''}
            </span>

            {/* Delta badge — only shown when prevDate exists */}
            {prevDate && <DeltaBadge delta_pct={r.delta_pct} />}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={FOOTER}>
        <div style={{ marginBottom: '2px' }}>
          {sessionCount} {lang === 'tr' ? 'test bataryası oturumu' : 'battery sessions recorded'}
        </div>
        <div>ℹ Cooper (1968) · Kasch &amp; Boyer (1970) — Field test battery</div>
      </div>
    </div>
  )
}
