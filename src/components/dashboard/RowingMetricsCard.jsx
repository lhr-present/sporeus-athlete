// RowingMetricsCard — renders for sessions with sport_type='rowing' (last 30 days)
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  splitPer500m, formatSplit,
  strokeEfficiency, classifyStrokeRate,
  rowingEfficiencyFactor,
  predict2000m, concept2VO2max,  // ADD THESE
} from '../../lib/sport/rowing.js'

const ZONE_COLORS = {
  recovery:  '#4caf50',
  steady:    '#2196f3',
  threshold: '#ff9800',
  race:      '#f44336',
  sprint:    '#9c27b0',
}

export default function RowingMetricsCard({ log = [], profile = {} }) {
  const { lang, t } = useContext(LangCtx)

  const rowingData = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const sessions = log
      .filter(s => s && s.sport_type === 'rowing' && s.date >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date))
    return sessions
  }, [log])

  const last = rowingData[0]

  // 2000m prediction and VO2max — hoisted before early return to satisfy Rules of Hooks
  const pred2k = useMemo(() => {
    if (!last) return null
    // If session is already ~2000m, use directly; otherwise predict
    const timeSec = last.duration
    const distM   = last.distance
    if (!timeSec || !distM) return null
    const predicted = Math.abs(distM - 2000) < 200
      ? timeSec                              // close enough to 2000m
      : predict2000m(timeSec, distM)         // Paul's Law projection
    if (!predicted) return null
    const bw = parseFloat(profile?.weight_kg || profile?.weight || 0)
    const vo2 = bw > 0 ? concept2VO2max(predicted, bw) : null
    // v9.51.0 — W/kg from predicted 2k split.
    // Concept2 power formula: P (W) = 2.80 / (split_sec / 500)^3
    // Benchmarks (Mikulic 2008, Kerr 2007 AIS rowing):
    //   ≥6.4 elite HW men · ≥5.4 university D1/Henley men · ≥4.4 club · <3.5 recreational
    let wkg = null, wkgBand = null
    if (bw > 0) {
      const splitSec = predicted / 4
      const powerW = 2.80 / Math.pow(splitSec / 500, 3)
      wkg = Math.round((powerW / bw) * 100) / 100
      if (wkg >= 6.4) wkgBand = { en: 'World class',  tr: 'Dünya sınıfı', color: '#f5c542' }
      else if (wkg >= 5.4) wkgBand = { en: 'University', tr: 'Üniversite',   color: '#ff6600' }
      else if (wkg >= 4.4) wkgBand = { en: 'Club',       tr: 'Kulüp',        color: '#5bc25b' }
      else if (wkg >= 3.5) wkgBand = { en: 'Competitive', tr: 'Rekabetçi',  color: '#4a90d9' }
      else                 wkgBand = { en: 'Recreational', tr: 'Rekreasyon', color: '#888' }
    }
    const mm = Math.floor(predicted / 60)
    const ss = String(Math.round(predicted % 60)).padStart(2, '0')
    return { timeStr: `${mm}:${ss}`, isProjection: Math.abs(distM - 2000) >= 200, vo2, wkg, wkgBand }
  }, [last, profile])

  if (!last) return (
    <div style={{ ...S.card, marginBottom: 16, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {lang === 'tr' ? 'Kürek Metrikleri' : 'Rowing Metrics'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
        {lang === 'tr' ? 'Son 30 günde kürek antrenmanı yok.' : 'No rowing sessions in the last 30 days.'}
      </div>
    </div>
  )

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
            <div style={labelStyle} title="Efficiency Factor: metres per second per heartbeat">{t('rowingEF') || 'Rowing EF'}</div>
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

      {pred2k && (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 6 }}>
            {lang === 'tr' ? '◈ 2000m TAHMİNİ' : '◈ 2000m PREDICTION'}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                {pred2k.isProjection ? (lang === 'tr' ? 'TAHMİN (Paul Yasası)' : 'PROJECTED (Paul\'s Law)') : (lang === 'tr' ? 'ÖLÇÜLEN' : 'MEASURED')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.1 }}>
                {pred2k.timeStr}
              </div>
            </div>
            {pred2k.vo2 && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  VO2max (Concept2)
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0064ff', fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.1 }}>
                  {pred2k.vo2}
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", marginTop: 2 }}>mL/kg/min</div>
              </div>
            )}
            {pred2k.wkg && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  W/kg (2k erg)
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: pred2k.wkgBand.color, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.1 }}>
                  {pred2k.wkg}
                </div>
                <div style={{ fontSize: 9, color: pred2k.wkgBand.color, fontFamily: "'IBM Plex Mono',monospace", marginTop: 2, fontWeight: 600 }}>
                  {pred2k.wkgBand[lang] || pred2k.wkgBand.en}
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 9, color: '#333', marginTop: 8 }}>
            ℹ Paul (1969) · Concept2 VO2max formula · Mikulic 2008 / Kerr 2007 W/kg bands
          </div>
        </div>
      )}
    </div>
  )
}
