// ─── coach/SessionQRModal.jsx — QR code overlay for session check-in ──────────
import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'

import { logger } from '../../lib/logger.js'

const MONO = "'IBM Plex Mono', monospace"

/**
 * Build the QR payload for a session check-in.
 * @param {string} sessionId
 * @returns {string}
 */
export function buildQrPayload(sessionId) {
  return `sporeus:checkin:${sessionId}`
}

/**
 * SessionQRModal — renders a QR code that athletes scan to auto-confirm attendance.
 * @param {{ session: object, onClose: Function, lang?: string }} props
 */
export default function SessionQRModal({ session, onClose, lang = 'en' }) {
  const canvasRef = useRef(null)
  const panelRef  = useRef(null)
  useFocusTrap(panelRef, { onEscape: onClose })
  const [ready, setReady] = useState(false)
  const [err, setErr]     = useState('')
  const isTR = lang === 'tr'

  useEffect(() => {
    let cancelled = false
    async function generate() {
      try {
        const { default: QRCode } = await import('qrcode')
        if (cancelled || !canvasRef.current) return
        await QRCode.toCanvas(canvasRef.current, buildQrPayload(session.id), {
          width: 240,
          margin: 2,
          color: { dark: '#0a0a0a', light: '#f0f0f0' },
        })
        if (!cancelled) setReady(true)
      } catch (e) {
        logger.error('QR generate:', e.message)
        if (!cancelled) setErr(isTR ? 'QR oluşturulamadı' : 'Failed to generate QR')
      }
    }
    generate()
    return () => { cancelled = true }
  }, [session.id, isTR])

  const fmtDate = (d) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10400 }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isTR ? 'Oturum QR Kodu' : 'Session QR Code'}
        style={{
          position: 'fixed', top: '10vh', left: '50%', transform: 'translateX(-50%)',
          width: 'min(320px, 92vw)', zIndex: 10401,
          background: 'var(--card-bg, #111)', border: '1px solid #ff660044',
          borderRadius: '8px', padding: '24px', textAlign: 'center',
          fontFamily: MONO, boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#ff6600', letterSpacing: '0.12em', fontWeight: 700 }}>
            {isTR ? '▣ GİRİŞ QR KODU' : '▣ CHECK-IN QR'}
          </div>
          <button
            onClick={onClose}
            aria-label={isTR ? 'Kapat' : 'Close'}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px' }}
          >×</button>
        </div>

        {/* Session info */}
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
          {session.title}
        </div>
        <div style={{ fontSize: '9px', color: '#666', marginBottom: '18px' }}>
          {fmtDate(session.session_date)}{session.session_time ? ' · ' + session.session_time : ''}
        </div>

        {/* Canvas */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <canvas
            ref={canvasRef}
            style={{
              borderRadius: '4px',
              opacity: ready ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
          />
        </div>

        {!ready && !err && (
          <div style={{ fontSize: '10px', color: '#555', marginBottom: '14px' }}>
            {isTR ? 'Oluşturuluyor…' : 'Generating…'}
          </div>
        )}
        {err && (
          <div style={{ fontSize: '10px', color: '#e03030', marginBottom: '14px' }}>⚠ {err}</div>
        )}

        <div style={{ fontSize: '9px', color: '#444', lineHeight: 1.6 }}>
          {isTR
            ? 'Sporcular bu QR kodu tarayarak katılımlarını otomatik olarak onaylayabilir.'
            : 'Athletes scan this QR code to automatically confirm their attendance.'}
        </div>
      </div>
    </>
  )
}
