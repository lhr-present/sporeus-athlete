// ─── dashboard/FitnessGainRateCard.jsx — E124: Fitness Gain Rate (28d CTL) ───
// Surfaces detectFitnessGainRate(): linear regression of CTL over the last 28
// days, classifying the trajectory as detraining / maintaining / building /
// spiking. Sits next to StaleZones / WorkoutDensity / SessionVariety in the
// coaching-insights cluster.
// Citation: Banister 1991; Coggan PMC.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectFitnessGainRate } from '../../lib/athlete/fitnessGainRate.js'

const BAND_COLORS = {
  detraining:  '#e03030',
  maintaining: '#888',
  building:    '#5bc25b',
  spiking:     '#f5c542',
}

const BAND_LABEL = {
  detraining:  { en: 'DETRAINING',  tr: 'GERİLEME' },
  maintaining: { en: 'MAINTAINING', tr: 'KORUMA' },
  building:    { en: 'BUILDING',    tr: 'GELİŞİM' },
  spiking:     { en: 'SPIKING',     tr: 'ANİ YÜKSELİŞ' },
}

// Format a slope with sign + 2 decimals (matches the lib's display style).
function fmtSlope(v) {
  const n = (Math.round(v * 100) / 100).toFixed(2)
  return v > 0 ? `+${n}` : n
}

function FitnessGainRateCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectFitnessGainRate(log), [log])

  // ─── Empty / unreliable state ──────────────────────────────────────────────
  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Form kazanım oranı — yetersiz veri' : 'Fitness gain rate — not enough data'}
        style={{ ...S.card, animationDelay: '225ms' }}
      >
        <div style={S.cardTitle}>
          {isTR ? 'FORM KAZANIM ORANI — 28G' : 'FITNESS GAIN RATE — 28D'}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', textAlign: 'center', padding: '14px 0', lineHeight: 1.7 }}>
          {isTR
            ? 'Form trajektorisini görmek için 21+ gün antrenman kaydet'
            : 'Log 21+ days of training to see fitness trajectory'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Reliable render ───────────────────────────────────────────────────────
  const color = BAND_COLORS[result.band] || BAND_COLORS.maintaining
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()
  const slopeStr = fmtSlope(result.slope)
  const unit = isTR ? 'CTL/hafta' : 'CTL/week'
  const slopeAria = isTR
    ? `${bandLbl} ${slopeStr} CTL haftada`
    : `${bandLbl} ${slopeStr} CTL per week`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Form kazanım oranı' : 'Fitness gain rate'}
      style={{ ...S.card, animationDelay: '225ms', borderLeft: `3px solid ${color}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'FORM KAZANIM ORANI — 28G' : 'FITNESS GAIN RATE — 28D'}
      </div>

      {/* Slope number + band badge ------------------------------------------ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '4px 0 8px',
        }}
      >
        <div
          aria-label={slopeAria}
          style={{
            ...S.mono,
            fontSize: '24px',
            fontWeight: 700,
            color,
            lineHeight: 1.1,
          }}
        >
          {slopeStr}
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginLeft: '6px' }}>
            {unit}
          </span>
        </div>
        <div
          style={{
            ...S.mono,
            fontSize: '10px',
            fontWeight: 700,
            color,
            background: `${color}18`,
            border: `1px solid ${color}55`,
            borderRadius: '3px',
            padding: '3px 8px',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {bandLbl}
        </div>
      </div>

      {/* CTL endpoints + R² ------------------------------------------------- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)' }}>
          CTL: {result.ctl28dStart}
          <span style={{ color: 'var(--muted)', margin: '0 6px' }}>→</span>
          {result.ctl28dEnd}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--muted)' }}>
          {isTR ? `Uyum kalitesi: ${result.r2.toFixed(2)}` : `Fit quality: ${result.r2.toFixed(2)}`}
        </div>
      </div>

      {/* Bilingual message -------------------------------------------------- */}
      <div
        aria-live="polite"
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${color}`,
          marginBottom: '8px',
        }}
      >
        {result.message[isTR ? 'tr' : 'en']}
      </div>

      {/* Citation footer ---------------------------------------------------- */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(FitnessGainRateCard)
