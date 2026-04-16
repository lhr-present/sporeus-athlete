// ─── ToastStack — renders toasts from useToasts() ─────────────────────────────
import { TYPE_BG } from '../hooks/useToasts.js'

const MONO = "'IBM Plex Mono', monospace"

/**
 * @param {{ toasts: import('../hooks/useToasts.js').Toast[], dismissToast: Function }} props
 */
export default function ToastStack({ toasts, dismissToast }) {
  if (!toasts.length) return null

  return (
    <div role="status" aria-live="polite" aria-atomic="false" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10002, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className="sp-fade"
          style={{
            background: TYPE_BG[t.type] || TYPE_BG.info,
            color: '#fff',
            fontFamily: MONO,
            fontSize: '11px',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            pointerEvents: 'auto',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            {t.action && (
              <button
                onClick={t.action.onClick}
                style={{ background: '#fff', border: 'none', color: TYPE_BG[t.type] || '#000', padding: '4px 12px', cursor: 'pointer', fontFamily: MONO, fontSize: '10px', fontWeight: 600, borderRadius: '3px' }}>
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', padding: '2px 8px', cursor: 'pointer', fontFamily: MONO, fontSize: '10px' }}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
