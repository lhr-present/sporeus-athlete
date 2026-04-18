// ─── ConfirmModal.jsx — Non-blocking confirmation dialog ──────────────────────
// Replaces window.confirm() for destructive actions.
// Props:
//   open        boolean — controlled visibility
//   title       string  — dialog heading
//   body        string  — descriptive text (optional)
//   confirmLabel string — confirm button label (default "Confirm")
//   cancelLabel  string — cancel button label (default "Cancel")
//   dangerous    boolean — makes confirm button red (default false)
//   onConfirm   () => void
//   onCancel    () => void

const MONO = "'IBM Plex Mono', monospace"

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  dangerous    = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onCancel?.()
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onCancel?.()
    if (e.key === 'Enter')  onConfirm?.()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onKeyDown={handleKeyDown}
      onClick={handleBackdrop}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9000,
        background:     'rgba(0,0,0,0.72)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '20px',
      }}
    >
      <div
        style={{
          background:   'var(--card-bg, #111)',
          border:       '1px solid var(--border, #333)',
          borderRadius: '6px',
          padding:      '20px 24px',
          width:        'min(400px, 95vw)',
          fontFamily:   MONO,
        }}
      >
        <div
          id="confirm-title"
          style={{ fontSize: '12px', fontWeight: 700, color: dangerous ? '#e03030' : 'var(--text, #ccc)', marginBottom: '10px', letterSpacing: '0.06em' }}
        >
          {title}
        </div>

        {body && (
          <div style={{ fontSize: '10px', color: '#888', marginBottom: '18px', lineHeight: 1.6 }}>
            {body}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            autoFocus
            style={{
              fontFamily: MONO, fontSize: '10px', padding: '6px 16px',
              border: '1px solid #333', borderRadius: '3px',
              background: 'transparent', color: '#888', cursor: 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontFamily: MONO, fontSize: '10px', padding: '6px 16px',
              border: `1px solid ${dangerous ? '#e03030' : '#ff6600'}`,
              borderRadius: '3px', background: 'transparent',
              color: dangerous ? '#e03030' : '#ff6600',
              cursor: 'pointer', letterSpacing: '0.06em',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
