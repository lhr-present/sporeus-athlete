// ─── KeyboardShortcuts.jsx — keyboard shortcuts reference overlay ─────────────
import { useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { S } from '../styles.js'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'

/**
 * KeyboardShortcuts — modal listing all keyboard shortcuts, triggered by ?.
 * @param {{ open: boolean, onClose: Function, lang?: string }} props
 */
export default function KeyboardShortcuts({ open, onClose, lang = 'en' }) {
  const panelRef = useRef(null)
  useFocusTrap(panelRef, { active: open, onEscape: onClose })

  if (!open) return null

  const isTR = lang === 'tr'

  const GROUPS = [
    {
      label: isTR ? 'GEZİNME' : 'NAVIGATION',
      rows: [
        ['1 – 9',    isTR ? 'Sekmeye atla'              : 'Jump to tab'],
        ['Ctrl+K',   isTR ? 'Arama paletini aç'          : 'Open search'],
        ['?',        isTR ? 'Bu yardımı göster/gizle'     : 'Show/hide this overlay'],
        ['Esc',      isTR ? 'Tüm panelleri kapat'         : 'Close any panel'],
      ],
    },
    {
      label: isTR ? 'EYLEMLER' : 'ACTIONS',
      rows: [
        ['+  /  a',  isTR ? 'Hızlı antrenman kaydet'     : 'Quick-log session'],
        ['L',        isTR ? 'Dil değiştir (TR/EN)'        : 'Toggle language (EN/TR)'],
        ['D',        isTR ? 'Karanlık mod aç/kapat'       : 'Toggle dark mode'],
      ],
    },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 9600, background: 'rgba(0,0,0,0.65)' }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isTR ? 'Klavye kısayolları' : 'Keyboard shortcuts'}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9601,
          background: 'var(--card-bg, #111)',
          border: '1px solid var(--border, #2a2a2a)',
          borderRadius: '6px',
          padding: '20px 24px',
          width: 'min(400px, 94vw)',
          fontFamily: MONO,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>
            ⌨ {isTR ? 'KLAVYE KISAYOLLARI' : 'KEYBOARD SHORTCUTS'}
          </div>
          <button
            onClick={onClose}
            aria-label={isTR ? 'Kapat' : 'Close'}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Groups */}
        {GROUPS.map(({ label, rows }) => (
          <div key={label} style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '8px' }}>
              {label}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <tbody>
                {rows.map(([key, desc]) => (
                  <tr key={key} style={{ borderBottom: '1px solid var(--border, #1e1e1e)' }}>
                    <td style={{ padding: '6px 16px 6px 0', color: ORANGE, fontWeight: 700, whiteSpace: 'nowrap', width: '80px' }}>
                      {key}
                    </td>
                    <td style={{ padding: '6px 0', color: 'var(--text, #e0e0e0)' }}>
                      {desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Footer */}
        <button
          onClick={onClose}
          style={{ ...S.btnSec, marginTop: '6px', fontSize: '11px', padding: '6px 14px' }}
        >
          {isTR ? 'Kapat' : 'Close'}
        </button>
      </div>
    </>
  )
}
