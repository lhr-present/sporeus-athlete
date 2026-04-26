import { S } from '../../styles.js'
import { FormulaPopover } from '../ui/FormulaPopover.jsx'

// ─── ConsistencyDepthCard — E69 ───────────────────────────────────────────────
// Shows CTL reliability level based on total sessions logged (n/84 progress bar).
// Props: log (array), isTR (bool)

const THRESHOLDS = [
  {
    min: 0,  max: 14,
    en: 'Gathering data…',
    tr: 'Veri toplanıyor…',
    color: '#888',
  },
  {
    min: 14, max: 42,
    en: (n) => `CTL forming (${n} sessions)`,
    tr: (n) => `CTL oluşuyor (${n} antrenman)`,
    color: '#f5c542',
  },
  {
    min: 42, max: 84,
    en: 'CTL reliable — trends visible',
    tr: 'CTL güvenilir — eğilimler görünüyor',
    color: '#0064ff',
  },
  {
    min: 84, max: Infinity,
    en: 'CTL stable — VDOT ±1.2 precision',
    tr: 'CTL stabil — VDOT ±1.2 hassasiyet',
    color: '#5bc25b',
  },
]

function getStatus(n, isTR) {
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    const t = THRESHOLDS[i]
    if (n >= t.min) {
      const label = typeof t[isTR ? 'tr' : 'en'] === 'function'
        ? t[isTR ? 'tr' : 'en'](n)
        : t[isTR ? 'tr' : 'en']
      return { label, color: t.color }
    }
  }
  return { label: isTR ? 'Veri toplanıyor…' : 'Gathering data…', color: '#888' }
}

export default function ConsistencyDepthCard({ log, isTR }) {
  const n = (log || []).length
  if (n === 0) return null

  const fill  = Math.min(n / 84, 1) * 100
  const { label, color } = getStatus(n, isTR)

  const title = isTR ? 'ANTRENMAN DERİNLİĞİ' : 'TRAINING DEPTH'

  return (
    <div style={{ ...S.card }}>
      <div style={{ ...S.cardTitle, display: 'flex', alignItems: 'center', gap: '4px' }}>
        {title}
        <FormulaPopover metricKey="ctl" lang={isTR ? 'tr' : 'en'} />
      </div>

      {/* Progress bar */}
      <div style={{
        height: '8px',
        background: 'var(--border)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '10px',
      }}>
        <div style={{
          height: '100%',
          width: `${fill}%`,
          background: '#ff6600',
          borderRadius: '4px',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Labels row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '11px',
          color,
          fontWeight: 600,
          lineHeight: 1.4,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '10px',
          color: 'var(--muted)',
        }}>
          {n} / 84 {isTR ? 'antrenman' : 'sessions'}
        </div>
      </div>

      {/* Milestone markers */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '6px',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '8px',
        color: 'var(--muted)',
        letterSpacing: '0.04em',
      }}>
        <span>0</span>
        <span style={{ color: n >= 14 ? '#f5c542' : 'var(--muted)' }}>14</span>
        <span style={{ color: n >= 42 ? '#0064ff' : 'var(--muted)' }}>42</span>
        <span style={{ color: n >= 84 ? '#5bc25b' : 'var(--muted)' }}>84</span>
      </div>
    </div>
  )
}
