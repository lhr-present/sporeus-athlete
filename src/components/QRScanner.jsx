// ─── QRScanner.jsx — Camera-based QR scanner for session check-in ─────────────
import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { logger } from '../lib/logger.js'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'

/**
 * Parse a sporeus check-in QR payload.
 * @param {string} raw - decoded QR string
 * @returns {string|null} sessionId if valid, else null
 */
export function parseCheckinPayload(raw) {
  if (typeof raw !== 'string') return null
  const prefix = 'sporeus:checkin:'
  if (!raw.startsWith(prefix)) return null
  const id = raw.slice(prefix.length).trim()
  // Basic UUID format check
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return id
}

/**
 * QRScanner — opens the device camera and decodes QR codes in real time.
 * Calls onScan(sessionId) when a valid check-in QR is found.
 *
 * @param {{ onScan: (sessionId: string) => void, onClose: Function, lang?: string }} props
 */
export default function QRScanner({ onScan, onClose, lang = 'en' }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const streamRef = useRef(null)
  const panelRef  = useRef(null)

  const [status, setStatus] = useState('starting') // starting | scanning | denied | unsupported | found
  const [found,  setFound]  = useState(false)
  const isTR = lang === 'tr'

  const stopStream = () => {
    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        if (!cancelled) setStatus('scanning')
        scan(cancelled)
      } catch (e) {
        logger.warn('camera:', e.message)
        if (!cancelled) setStatus(e.name === 'NotAllowedError' ? 'denied' : 'unsupported')
      }
    }

    async function scan(cancelledRef) {
      const { default: jsQR } = await import('jsqr').catch(e => {
        logger.error('jsQR load:', e.message)
        return { default: null }
      })
      if (!jsQR) { setStatus('unsupported'); return }

      const canvas = canvasRef.current
      const ctx    = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      function tick() {
        if (cancelledRef) return
        const video = videoRef.current
        if (!video || video.readyState !== 4) { rafRef.current = requestAnimationFrame(tick); return }

        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })

        if (code?.data) {
          const sessionId = parseCheckinPayload(code.data)
          if (sessionId) {
            stopStream()
            setFound(true)
            setStatus('found')
            onScan(sessionId)
            return
          }
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    }

    startCamera()
    return () => {
      cancelled = true
      stopStream()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = () => {
    stopStream()
    onClose()
  }
  useFocusTrap(panelRef, { onEscape: handleClose })

  const STATUS_MSG = {
    starting:    isTR ? 'Kamera başlatılıyor…'       : 'Starting camera…',
    scanning:    isTR ? 'QR kodu tarayın'             : 'Aim at the QR code',
    denied:      isTR ? 'Kamera izni reddedildi'      : 'Camera permission denied',
    unsupported: isTR ? 'Kamera bu tarayıcıda çalışmıyor' : 'Camera not supported in this browser',
    found:       isTR ? '✓ Onaylandı!'                : '✓ Confirmed!',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10400 }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isTR ? 'QR Kod Tarayıcı' : 'QR Code Scanner'}
        style={{
          position: 'fixed', top: '8vh', left: '50%', transform: 'translateX(-50%)',
          width: 'min(360px, 94vw)', zIndex: 10401,
          background: '#0a0a0a', border: '1px solid #ff660044',
          borderRadius: '8px', overflow: 'hidden',
          fontFamily: MONO, boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontSize: '10px', color: ORANGE, letterSpacing: '0.12em', fontWeight: 700 }}>
            {isTR ? '▣ QR TARAYICI' : '▣ QR SCANNER'}
          </div>
          <button
            onClick={handleClose}
            aria-label={isTR ? 'Kapat' : 'Close'}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px' }}
          >×</button>
        </div>

        {/* Video preview */}
        <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'scanning' ? 'block' : 'none' }}
          />
          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Viewfinder overlay */}
          {status === 'scanning' && !found && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: '180px', height: '180px',
                border: `2px solid ${ORANGE}`,
                borderRadius: '8px',
                boxShadow: `0 0 0 4000px rgba(0,0,0,0.4)`,
              }} />
            </div>
          )}

          {/* Status overlays */}
          {(status !== 'scanning' || found) && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.7)', gap: '12px',
            }}>
              {status === 'found' ? (
                <div style={{ fontSize: '40px' }}>✓</div>
              ) : status === 'denied' || status === 'unsupported' ? (
                <div style={{ fontSize: '28px', color: '#e03030' }}>⊘</div>
              ) : (
                <div style={{ fontSize: '14px', color: ORANGE }}>◈</div>
              )}
              <div style={{ fontSize: '11px', color: status === 'found' ? '#5bc25b' : status === 'denied' || status === 'unsupported' ? '#e03030' : '#aaa', textAlign: 'center', padding: '0 20px' }}>
                {STATUS_MSG[status]}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: '9px', color: '#444', textAlign: 'center' }}>
            {isTR ? 'Antrenörünüzün QR kodunu çerçeve içine yerleştirin' : 'Frame your coach\'s QR code inside the bracket'}
          </div>
        </div>
      </div>
    </>
  )
}
