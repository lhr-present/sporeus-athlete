// src/components/MobileBottomBar.jsx — E4: Fixed bottom nav for mobile (≤640px)
// 4 primary tabs in the thumb zone. Top scrollable nav stays for desktop + all 12 tabs.
import { useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'

const MONO = "'IBM Plex Mono', monospace"

// The 4 tabs that matter most on a phone, one-handed, post-workout
const PRIMARY_TABS = [
  { id: 'today',     icon: '\u25c9', labelEn: 'TODAY',     labelTr: 'BUGÜN' },
  { id: 'log',       icon: '\u2261', labelEn: 'LOG',       labelTr: 'KAYIT' },
  { id: 'dashboard', icon: '\u25c8', labelEn: 'DASHBOARD', labelTr: 'PANEL' },
  { id: 'profile',   icon: '\u25cb', labelEn: 'PROFILE',   labelTr: 'PROFİL' },
]

const BAR_HEIGHT = 56  // px, not including safe area

export default function MobileBottomBar({ activeTab, onTabChange }) {
  const { lang } = useContext(LangCtx)

  return (
    <nav
      aria-label="Primary navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
        // Only visible on mobile — desktop hides via CSS class
        display: 'none',         // overridden by .sp-mobile-bottom-bar media query
        height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        background: '#0a0a0a',
        borderTop: '1px solid #333',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className="sp-mobile-bottom-bar"
    >
      <div role="tablist" style={{ display: 'flex', height: `${BAR_HEIGHT}px`, alignItems: 'stretch' }}>
        {PRIMARY_TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                border: 'none',
                background: active ? '#ff660015' : 'transparent',
                color: active ? '#ff6600' : '#666',
                fontFamily: MONO,
                fontSize: '16px',
                lineHeight: 1,
                cursor: 'pointer',
                padding: '8px 4px',
                borderTop: active ? '2px solid #ff6600' : '2px solid transparent',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                minWidth: 44,
                minHeight: 44,
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: '8px', letterSpacing: '0.06em', fontWeight: 700, lineHeight: 1 }}>
                {lang === 'tr' ? tab.labelTr : tab.labelEn}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export { BAR_HEIGHT }
