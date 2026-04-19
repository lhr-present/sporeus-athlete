// src/components/MobileFAB.jsx — E4: Floating action button for mobile
// Always in the thumb zone. Opens QuickAddModal. Hidden on desktop.
// Positioned above the bottom tab bar.

const MONO = "'IBM Plex Mono', monospace"

export default function MobileFAB({ onClick }) {
  function handleClick() {
    // Haptic feedback on click (iOS + Android)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(10) } catch (_) {}
    }
    onClick()
  }

  return (
    <button
      aria-label="Quick log session"
      onClick={handleClick}
      className="sp-mobile-fab"
      style={{
        display: 'none',  // overridden by media query
        position: 'fixed',
        bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        right: 'max(16px, env(safe-area-inset-right, 16px))',
        zIndex: 9001,
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: '#ff6600',
        border: 'none',
        color: '#fff',
        fontFamily: MONO,
        fontSize: '24px',
        fontWeight: 700,
        lineHeight: 1,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(255,102,0,0.45)',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
      onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(255,102,0,0.4)' }}
      onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,102,0,0.45)' }}
      onPointerCancel={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      +
    </button>
  )
}
