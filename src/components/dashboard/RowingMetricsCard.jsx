// RowingMetricsCard — renders for sessions with sport_type='rowing' (last 30 days)
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  splitPer500m, formatSplit,
  strokeEfficiency, classifyStrokeRate,
  rowingEfficiencyFactor, fmtSplit,
} from '../../lib/sport/rowing.js'

const ZONE_COLORS = {
  recovery:  '#4caf50',
  steady:    '#2196f3',
  threshold: '#ff9800',
  race:      '#f44336',
  sprint:    '#9c27b0',
}

export default function RowingMetricsCard({ log = [] }) {
  const { lang, t } = useContext(LangCtx)

  const rowingData = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const sessions = log
      .filter(s => s && s.sport_type === 'rowing' && s.date >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date))
    return sessions
  }, [log])

  const last = rowingData[0]
  if (!last) return null

  const split = splitPer500m(last.distance, last.duration)
  const strEff = strokeEfficiency(last.distance, last.strokes)
  const srClass = last.avg_spm ? classifyStrokeRate(last.avg_spm) : null
  const ef = rowingEfficiencyFactor(last.distance, last.duration, last.avg_hr)

  const cardStyle = {
    ...S.card,
    marginBottom: 16,
    padding: '16px 20px',
  }

  const labelStyle = {
    fontSize: 11,
    color: 'var(--muted)',
    fontFamily: "'IBM Plex Mono', monospace",
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 2,
  }

  const valueStyle = {
    fontSize: 26,
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1.1,
  }

  const subStyle = {
    fontSize: 11,
    color: 'var(--muted)',
    fontFamily: "'IBM Plex Mono', monospace",
    marginTop: 2,
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {t('rowingMetrics') || (lang === 'tr' ? 'Kürek Metrikleri' : 'Rowing Metrics')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
          {last.date}
        </span>
      </div>

      {/* Split + Stroke Efficiency */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
        <div>
          <div style={labelStyle}>{t('rowingSplit') || '/500m split'}</div>
          <div style={valueStyle}>{split ? formatSplit(split) : '—'}</div>
          <div style={subStyle}>
            {last.distance ? `${(last.distance / 1000).toFixed(1)} km` : ''}
            {last.duration ? ` · ${Math.round(last.duration / 60)} min` : ''}
          </div>
        </div>

        {strEff && (
          <div>
            <div style={labelStyle}>{t('rowingStrokeEff') || 'm/stroke'}</div>
            <div style={valueStyle}>{strEff.toFixed(1)}</div>
            <div style={subStyle}>{last.strokes ? `${last.strokes} strokes` : ''}</div>
          </div>
        )}

        {ef && (
          <div>
            <div style={labelStyle}>{t('rowingEF') || 'Rowing EF'}</div>
            <div style={valueStyle}>{ef}</div>
            <div style={subStyle}>m·s⁻¹/bpm</div>
          </div>
        )}
      </div>

      {/* Stroke rate zone badge */}
      {srClass && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {t('rowingStrokeRate') || 'Stroke rate'}
          </span>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 600,
            background: ZONE_COLORS[srClass.zone] + '22',
            color: ZONE_COLORS[srClass.zone],
            border: `1px solid ${ZONE_COLORS[srClass.zone]}55`,
          }}>
            {srClass.label[lang] || srClass.label.en}
            {last.avg_spm ? ` · ${last.avg_spm} spm` : ''}
          </span>
        </div>
      )}

      {/* Session count footer */}
      {rowingData.length > 1 && (
        <div style={{ ...subStyle, marginTop: 10 }}>
          {rowingData.length} rowing sessions in last 30 days
        </div>
      )}
    </div>
  )
}
