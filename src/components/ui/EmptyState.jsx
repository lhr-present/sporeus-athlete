// ─── EmptyState.jsx — Standardized empty / info / warning state ───────────────
// Props:
//   icon     — leading icon or emoji (string, optional)
//   title    — short label in bold (string, optional)
//   body     — descriptive message (string)
//   variant  — 'empty' | 'info' | 'warn' | 'error'  (default 'empty')
//   children — optional CTA slot (e.g. invite code display, action button)

const VARIANT_COLORS = {
  empty: '#888',
  info:  '#4a90d9',
  warn:  '#f5c542',
  error: '#e03030',
}

const MONO = "'IBM Plex Mono',monospace"

export default function EmptyState({ icon, title, body, variant = 'empty', children }) {
  const color = VARIANT_COLORS[variant] ?? VARIANT_COLORS.empty
  return (
    <div style={{
      fontFamily: MONO, fontSize: 10, color,
      padding: '6px 10px', borderRadius: 3, marginBottom: 12,
      background: `${color}0d`, border: `1px solid ${color}44`,
    }}>
      <div>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}
        {title && <strong style={{ letterSpacing: '0.06em' }}>{title}</strong>}
        {(icon || title) && body && <span style={{ margin: '0 5px', opacity: 0.5 }}>—</span>}
        <span>{body}</span>
      </div>
      {children && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  )
}
