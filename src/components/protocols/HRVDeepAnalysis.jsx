// ─── HRVDeepAnalysis — HRV readiness, DFA-α1 threshold, 30-day RMSSD trend ──
import { useData } from '../../contexts/DataContext.jsx'
import { computeHRVReadiness, getAerobicThresholdFromDFA } from '../../lib/hrv.js'
import { S } from '../../styles.js'

export default function HRVDeepAnalysis() {
  const { recovery } = useData()
  const recoveryArr = Array.isArray(recovery) ? recovery : []

  // A1 — HRV Readiness
  const recent = [...recoveryArr].sort((a, b) => b.date > a.date ? 1 : -1)
  const recentRMSSD = recent[0]?.rmssd ?? recent[0]?.hrv ?? null
  const baseline28 = recent.slice(0, 28).map(r => r.rmssd ?? r.hrv ?? 0).filter(v => v > 0)
  const baselineRMSSD = baseline28.length ? baseline28.reduce((s, v) => s + v, 0) / baseline28.length : null
  const baselineSD = baseline28.length > 1
    ? Math.sqrt(baseline28.reduce((s, v) => s + (v - baselineRMSSD) ** 2, 0) / baseline28.length)
    : 0
  const readiness = computeHRVReadiness(recentRMSSD, baselineRMSSD, baselineSD)

  // A2 — DFA-α1 aerobic threshold
  const dfaSeries = recoveryArr
    .filter(r => typeof r.dfa1 === 'number' && typeof r.hrv === 'number')
    .sort((a, b) => a.hrv - b.hrv)
    .map(r => ({ hr: r.hrv, dfa1: r.dfa1 }))
  const dfaThreshold = getAerobicThresholdFromDFA(dfaSeries)

  // A3 — 30-day RMSSD sparkline data
  const rmssdRows = [...recoveryArr]
    .filter(r => (r.rmssd ?? r.hrv) != null)
    .sort((a, b) => a.date > b.date ? 1 : -1)
    .slice(-30)
  const hasSparkline = rmssdRows.length >= 5

  if (!readiness && !dfaThreshold && !hasSparkline) return null

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      <div style={S.cardTitle}>HRV DEEP ANALYSIS</div>

      {/* A1 — Readiness card */}
      {readiness && (() => {
        const bandColor = readiness.band === 'High' ? '#5bc25b' : readiness.band === 'Normal' ? '#f5c542' : '#e03030'
        return (
          <div style={{ marginBottom: '14px', padding: '10px 14px', border: `1px solid ${bandColor}44`, borderRadius: '5px', background: `${bandColor}11` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ ...S.mono, fontSize: '42px', fontWeight: 700, color: bandColor, lineHeight: 1 }}>{readiness.score}</span>
              <div>
                <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: bandColor }}>{readiness.band.toUpperCase()} READINESS</div>
                <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', marginTop: '3px' }}>{readiness.advice}</div>
                {readiness.sdBand && (
                  <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginTop: '2px' }}>
                    Baseline: {baselineRMSSD != null ? baselineRMSSD.toFixed(1) : '—'} ±{baselineSD.toFixed(1)} ms (28-day SD band: {readiness.sdBand.lower}–{readiness.sdBand.upper})
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* A2 — DFA aerobic threshold card */}
      {dfaThreshold && (
        <div style={{ marginBottom: '14px', padding: '8px 12px', border: '1px solid #0064ff44', borderRadius: '5px', background: '#0064ff0d' }}>
          <div style={{ ...S.mono, fontSize: '11px', color: '#0064ff', marginBottom: '3px', fontWeight: 700 }}>DFA-α1 AEROBIC THRESHOLD</div>
          <div style={{ ...S.mono, fontSize: '12px' }}>
            {dfaThreshold.threshold_hr} bpm
            <span style={{ ...S.mono, fontSize: '10px', color: dfaThreshold.confidence === 'high' ? '#5bc25b' : '#f5c542', marginLeft: '8px' }}>
              ({dfaThreshold.confidence} confidence)
            </span>
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginTop: '3px' }}>DFA-α1 method (Gronwald 2020) · threshold = first HR where α₁ &lt; 0.75</div>
        </div>
      )}

      {/* A3 — 30-day RMSSD sparkline */}
      {hasSparkline && (() => {
        const vals = rmssdRows.map(r => r.rmssd ?? r.hrv ?? 0)
        const minV = Math.min(...vals)
        const maxV = Math.max(...vals)
        const range = maxV - minV || 1
        const W = 320; const H = 60
        const pad = { l: 4, r: 4, t: 6, b: 6 }
        const cW = W - pad.l - pad.r
        const cH = H - pad.t - pad.b
        const px = i => pad.l + (i / Math.max(vals.length - 1, 1)) * cW
        const py = v => pad.t + cH - ((v - minV) / range) * cH
        const pts = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')

        // 7-day rolling mean
        const rollMean = vals.map((_, i) => {
          const window = vals.slice(Math.max(0, i - 6), i + 1)
          return window.reduce((s, x) => s + x, 0) / window.length
        })
        const rollPts = rollMean.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')

        return (
          <div>
            <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginBottom: '4px', letterSpacing: '0.08em' }}>30-DAY RMSSD TREND</div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: H, display: 'block', overflow: 'visible' }}>
              <polyline fill="none" stroke="#0064ff" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7" points={pts} />
              <polyline fill="none" stroke="#ff8c00" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 2" points={rollPts} />
              {/* End-point dot */}
              <circle cx={px(vals.length - 1).toFixed(1)} cy={py(vals[vals.length - 1]).toFixed(1)} r="3" fill="#0064ff" />
            </svg>
            <div style={{ display: 'flex', gap: '14px', marginTop: '3px' }}>
              <span style={{ ...S.mono, fontSize: '9px', color: '#0064ff' }}>— RMSSD</span>
              <span style={{ ...S.mono, fontSize: '9px', color: '#ff8c00' }}>- - 7-day mean</span>
              <span style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginLeft: 'auto' }}>{rmssdRows.length} entries</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
