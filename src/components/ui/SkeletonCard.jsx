// ─── SkeletonCard.jsx — Generic loading skeleton for AsyncBoundary fallback ───
// Props:
//   height  — total height of the skeleton area in px (default 80)
//   lines   — number of skeleton lines to render (default 3)

export default function SkeletonCard({ height = 80, lines = 3 }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 6, padding: 16, marginBottom: 16,
    }}>
      <div style={{ height, overflow: 'hidden' }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} style={{
            height: 8, borderRadius: 3, background: 'var(--border)',
            marginBottom: 10,
            width: i === lines - 1 ? '55%' : '100%',
            opacity: Math.max(0.15, 0.5 - i * 0.1),
          }} />
        ))}
      </div>
    </div>
  )
}
