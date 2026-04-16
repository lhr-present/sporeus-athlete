// ─── coachDashboard/ClubOnboarding.jsx — Club-tier first-run wizard ───────────
import { useState, useRef } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import { S } from '../../styles.js'
import { saveLocalClubProfile, upsertOrgBranding } from '../../lib/db/orgBranding.js'

const MONO  = "'IBM Plex Mono', monospace"
const _BLUE  = '#0064ff'
const ORANGE = '#ff6600'

const PRESET_COLORS = ['#ff6600', '#0064ff', '#5bc25b', '#f5c542', '#e03030', '#9b59b6', '#1abc9c', '#e67e22']

/**
 * ClubOnboarding — 4-step setup wizard for Club-tier coaches.
 * Shown once (controlled by `sporeus-club-onboarded` localStorage key).
 *
 * @param {{ onDone: Function, authUserId?: string, inviteUrl: string, lang?: string }} props
 */
export default function ClubOnboarding({ onDone, authUserId, inviteUrl, lang = 'en' }) {
  const panelRef = useRef(null)
  useFocusTrap(panelRef, { onEscape: onDone })
  const [step, setStep] = useState(0)
  const [orgName, setOrgName]         = useState('')
  const [primaryColor, setPrimColor]  = useState('#ff6600')
  const [saving, setSaving]           = useState(false)
  const [copied, setCopied]           = useState(false)
  const isTR = lang === 'tr'

  const handleSaveBranding = async () => {
    const profile = { orgName: orgName.trim() || (isTR ? 'Kulübüm' : 'My Club'), primaryColor }
    saveLocalClubProfile(profile)
    setSaving(true)
    await upsertOrgBranding(authUserId, profile)
    setSaving(false)
    setStep(s => s + 1)
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const STEPS = [
    // ── Step 0: Welcome ──────────────────────────────────────────────────────
    {
      title: isTR ? 'Kulüp Moduna Hoş Geldiniz' : 'Welcome to Club Mode',
      body: (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {[
              { icon: '⚡', label: isTR ? '999 sporcu kapasitesi' : 'Up to 999 athletes' },
              { icon: '◈', label: isTR ? '500 AI analiz/gün' : '500 AI calls per day' },
              { icon: '▣', label: isTR ? 'QR ile oturum girişi' : 'QR code session check-in' },
              { icon: '⊞', label: isTR ? 'Beyaz etiket: kendi marka renginiz' : 'White-label: your brand colours' },
              { icon: '⌖', label: isTR ? 'Toplu sporcu davet linki' : 'Bulk athlete invite link' },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: MONO, fontSize: '16px', color: ORANGE, width: '22px', flexShrink: 0 }}>{icon}</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--text)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      nextAction: () => setStep(s => s + 1),
      nextLabel: isTR ? 'Devam →' : 'Get started →',
    },

    // ── Step 1: Brand setup ──────────────────────────────────────────────────
    {
      title: isTR ? 'Kulübünüzü Kurun' : 'Set Up Your Club',
      body: (
        <div>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#666', letterSpacing: '0.1em', marginBottom: '6px' }}>
              {isTR ? 'KULÜP ADI' : 'CLUB NAME'}
            </div>
            <input
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder={isTR ? 'örn. Sparta Atletizm' : 'e.g. Sparta Athletics'}
              style={{ ...S.input, width: '100%', fontSize: '12px' }}
              maxLength={60}
            />
          </div>
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#666', letterSpacing: '0.1em', marginBottom: '8px' }}>
              {isTR ? 'ANA RENK' : 'PRIMARY COLOUR'}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setPrimColor(c)}
                  aria-label={`Select colour ${c}`}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%', background: c,
                    border: primaryColor === c ? `3px solid var(--text)` : '3px solid transparent',
                    cursor: 'pointer', padding: 0, outline: 'none',
                    boxShadow: primaryColor === c ? `0 0 0 2px ${c}44` : 'none',
                    transition: 'border 0.15s, box-shadow 0.15s',
                  }}
                />
              ))}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', marginTop: '8px' }}>
              {isTR ? 'Seçili: ' : 'Selected: '}<span style={{ color: primaryColor, fontWeight: 700 }}>{primaryColor}</span>
            </div>
          </div>
        </div>
      ),
      nextAction: handleSaveBranding,
      nextLabel: saving ? '…' : (isTR ? 'Kaydet →' : 'Save →'),
      disableNext: saving,
    },

    // ── Step 2: Invite athletes ──────────────────────────────────────────────
    {
      title: isTR ? 'Sporcu Davet Edin' : 'Invite Athletes',
      body: (
        <div>
          <p style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--sub)', lineHeight: 1.8, marginBottom: '14px' }}>
            {isTR
              ? 'Sporcular aşağıdaki linki kullanarak otomatik olarak sizin kulübünüze bağlanır.'
              : 'Athletes who open this link will automatically connect to your club.'}
          </p>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px 12px', marginBottom: '14px', wordBreak: 'break-all' }}>
            <span style={{ fontFamily: MONO, fontSize: '9px', color: '#888' }}>{inviteUrl}</span>
          </div>
          <button
            onClick={handleCopyInvite}
            style={{ ...S.btn, width: '100%', justifyContent: 'center' }}
          >
            {copied ? '✓ ' + (isTR ? 'Kopyalandı!' : 'Copied!') : (isTR ? '⌖ Linki Kopyala' : '⌖ Copy Invite Link')}
          </button>
          <p style={{ fontFamily: MONO, fontSize: '9px', color: '#555', lineHeight: 1.8, marginTop: '12px' }}>
            {isTR
              ? 'Linki sporcularınıza SMS, e-posta veya whatsapp üzerinden gönderin.'
              : 'Send this link to athletes via SMS, email, or any messaging app.'}
          </p>
        </div>
      ),
      nextAction: () => setStep(s => s + 1),
      nextLabel: isTR ? 'İleri →' : 'Next →',
    },

    // ── Step 3: QR Check-in ──────────────────────────────────────────────────
    {
      title: isTR ? 'QR Oturum Girişi' : 'QR Session Check-in',
      body: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ fontFamily: MONO, fontSize: '48px', color: ORANGE }}>▣</div>
          </div>
          <p style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--sub)', lineHeight: 1.8, marginBottom: '12px' }}>
            {isTR
              ? 'Antrenmanı Oturum Planlayıcı\'dan zamanladıktan sonra antrenörler "QR Göster" düğmesine basarak bir QR kodu oluşturabilir.'
              : 'After scheduling a session in the Session Planner, press "Show QR" to generate a check-in code.'}
          </p>
          <p style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--sub)', lineHeight: 1.8 }}>
            {isTR
              ? 'Sporcular Bugün sekmesindeki "QR Tara" butonuyla kamerasını açarak girişlerini otomatik olarak onaylayabilir.'
              : 'Athletes tap "Scan QR" in the Today tab to auto-confirm their attendance with their camera.'}
          </p>
        </div>
      ),
      nextAction: onDone,
      nextLabel: isTR ? 'Başla ✓' : 'Let\'s go ✓',
    },
  ]

  const current = STEPS[step]

  return (
    <>
      <div aria-hidden="true" onClick={onDone} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10200 }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isTR ? 'Kulüp modu kurulumu' : 'Club mode setup'}
        style={{
          position: 'fixed', top: '10vh', left: '50%', transform: 'translateX(-50%)',
          width: 'min(500px, 94vw)', background: 'var(--card-bg)',
          border: `1px solid ${ORANGE}44`, borderRadius: '8px',
          zIndex: 10201, padding: '28px', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          fontFamily: MONO,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', color: ORANGE, letterSpacing: '0.1em', fontWeight: 700 }}>
            ◈ {isTR ? 'KULÜP MODU' : 'CLUB MODE'} — {isTR ? 'ADIM' : 'STEP'} {step + 1}/{STEPS.length}
          </div>
          <button onClick={onDone} aria-label={isTR ? 'Kapat' : 'Close'} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>

        {/* Title */}
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '18px' }}>
          {current.title}
        </div>

        {/* Body */}
        {current.body}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? '20px' : '8px', height: '8px',
                  borderRadius: '4px',
                  background: i === step ? ORANGE : i < step ? ORANGE + '88' : '#333',
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </div>
          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button style={S.btnSec} onClick={() => setStep(s => s - 1)}>
                {isTR ? '← Geri' : '← Back'}
              </button>
            )}
            <button
              style={{ ...S.btn, opacity: current.disableNext ? 0.6 : 1, cursor: current.disableNext ? 'not-allowed' : 'pointer' }}
              disabled={current.disableNext}
              onClick={current.nextAction}
            >
              {current.nextLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
