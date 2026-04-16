// ─── ScienceTooltip.jsx — inline ⓘ badge linking to science.md anchors ───────
// No CSS files. Inline styles only. IBM Plex Mono aesthetic, #ff6600 orange.
// Opens /sporeus-athlete/science#{anchor} in a new tab on click.
// Keyboard accessible: Tab to focus, Enter/Space to activate.
import { useState, useId } from 'react'

const MONO = "'IBM Plex Mono', monospace"
const BASE_PATH = '/sporeus-athlete/science'

export default function ScienceTooltip({ anchor, label, short, children }) {
  const [visible, setVisible] = useState(false)
  const tooltipId = useId()

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      window.open(`${BASE_PATH}#${anchor}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', position: 'relative' }}>
      {children}
      <span
        role="button"
        tabIndex={0}
        aria-label={label ? `Science reference: ${label}` : 'Science reference'}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => window.open(`${BASE_PATH}#${anchor}`, '_blank', 'noopener,noreferrer')}
        onKeyDown={handleKey}
        style={{
          fontFamily: MONO,
          fontSize: '9px',
          color: '#ff6600',
          cursor: 'pointer',
          lineHeight: 1,
          userSelect: 'none',
          outline: 'none',
          borderRadius: '2px',
          padding: '0 1px',
        }}
        // Show focus ring via onFocus/onBlur controlling a visual outline
        onMouseDown={e => e.currentTarget.style.outline = 'none'}
      >
        ⓘ
      </span>
      {visible && short && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '0',
            marginBottom: '4px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '2px',
            padding: '4px 8px',
            fontFamily: MONO,
            fontSize: '9px',
            color: '#ccc',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none',
            maxWidth: '240px',
            whiteSpace: 'normal',
            lineHeight: 1.4,
          }}
        >
          {short}
        </span>
      )}
    </span>
  )
}
