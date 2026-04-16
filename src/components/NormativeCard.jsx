// ─── NormativeCard.jsx — Shows a metric value + percentile bar + category ─────


const MONO = "'IBM Plex Mono', monospace"

function pctColor(pct) {
  if (pct >= 75) return '#5bc25b'
  if (pct >= 50) return '#f5c542'
  if (pct >= 25) return '#ff6600'
  return '#e03030'
}

/**
 * NormativeCard — display a metric with percentile bar and category label.
 * @param {object} props
 * @param {string}  props.label       — metric name (e.g. 'FTP')
 * @param {string}  props.value       — formatted metric value (e.g. '3.4 w/kg')
 * @param {number}  props.percentile  — 0–100
 * @param {string}  props.category    — category label (e.g. 'Trained')
 * @param {string}  [props.context]   — optional sub-label (e.g. 'vs cycling males')
 */
export default function NormativeCard({ label, value, percentile, category, context }) {
  const color = pctColor(percentile)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px',
      padding: '10px 12px', fontFamily: MONO,
    }}>
      {/* Label */}
      <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
      </div>

      {/* Value + category */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
        <span style={{ fontSize: '9px', fontWeight: 600, color, border: `1px solid ${color}44`, padding: '1px 6px', borderRadius: '2px' }}>
          {category}
        </span>
      </div>

      {/* Percentile bar */}
      <div style={{ position: 'relative', height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'visible' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0,
          width: `${Math.max(2, Math.min(100, percentile))}%`,
          height: '100%', background: color, borderRadius: '3px',
          transition: 'width 0.4s ease',
        }} />
        {/* Tick at p50 */}
        <div style={{ position: 'absolute', left: '50%', top: '-2px', width: '1px', height: '10px', background: '#333' }} />
      </div>

      {/* Percentile label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '8px', color: '#444' }}>0</span>
        <span style={{ fontSize: '9px', color, fontWeight: 600 }}>{percentile}th pct</span>
        <span style={{ fontSize: '8px', color: '#444' }}>100</span>
      </div>

      {context && (
        <div style={{ fontSize: '8px', color: '#444', marginTop: '3px' }}>{context}</div>
      )}
    </div>
  )
}
