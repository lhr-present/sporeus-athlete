// CoachOnboardingWizard.jsx — E9: 3-step first-run modal for new coaches
import { useState, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useAuth } from '../../hooks/useAuth.js'

const TOTAL_STEPS = 3

// ── Inline styles ──────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.82)',
  zIndex: 9000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '16px',
}

const modal = {
  background: '#0a0a0a',
  border: '1px solid #ff660044',
  borderRadius: '10px',
  padding: '32px 28px 24px',
  width: '100%',
  maxWidth: '480px',
  position: 'relative',
  boxShadow: '0 8px 40px rgba(255,102,0,0.15)',
}

const stepDot = active => ({
  width: '10px', height: '10px',
  borderRadius: '50%',
  background: active ? '#ff6600' : '#333',
  border: active ? 'none' : '1px solid #444',
  transition: 'background 0.2s',
  display: 'inline-block',
})

const stepCounter = {
  ...S.mono,
  fontSize: '10px',
  color: '#ff6600',
  letterSpacing: '0.12em',
  marginBottom: '6px',
  textTransform: 'uppercase',
}

const _title = {
  ...S.mono,
  fontSize: '13px',
  fontWeight: 700,
  color: '#e5e5e5',
  letterSpacing: '0.06em',
  marginBottom: '12px',
}

const body = {
  ...S.mono,
  fontSize: '12px',
  color: '#aaaaaa',
  lineHeight: '1.6',
  marginBottom: '20px',
}

const inviteBox = {
  background: '#111',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '10px 14px',
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: '20px',
}

const inviteCode = {
  ...S.mono,
  fontSize: '11px',
  color: '#ff6600',
  flex: '1 1 160px',
  wordBreak: 'break-all',
}

const planPointer = {
  background: '#111',
  border: '1px solid #0064ff44',
  borderRadius: '6px',
  padding: '12px 14px',
  marginBottom: '20px',
}

const timezoneBox = {
  background: '#111',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '10px 14px',
  marginBottom: '20px',
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CoachOnboardingWizard({ open, onClose }) {
  const { t, lang } = useContext(LangCtx)
  const { profile } = useAuth()
  const [step, setStep] = useState(1)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  function handleComplete() {
    localStorage.setItem('sporeus-coach-onboarded', 'true')
    onClose?.()
  }

  function handleSkip() {
    localStorage.setItem('sporeus-coach-onboarded', 'true')
    onClose?.()
  }

  const inviteCode_ = profile?.invite_code || profile?.coachId || '—'
  const timezone    = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  function handleCopy() {
    const val = inviteCode_
    if (val && val !== '—') {
      navigator.clipboard.writeText(val).catch(() => {})
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Step content ─────────────────────────────────────────────────────────────
  function renderStep() {
    if (step === 1) {
      return (
        <>
          <div style={stepCounter}>{t('coachWizardStep1Title')}</div>
          <div style={body}>{t('coachWizardStep1Body')}</div>
          <div style={inviteBox}>
            <span style={inviteCode}>{inviteCode_}</span>
            <button
              style={{ ...S.btnSec, fontSize: '10px', padding: '4px 12px', minHeight: '32px' }}
              onClick={handleCopy}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <button style={{ ...S.btn, width: '100%' }} onClick={() => setStep(2)}>
            {lang === 'tr' ? 'İleri →' : 'Next →'}
          </button>
        </>
      )
    }

    if (step === 2) {
      return (
        <>
          <div style={stepCounter}>{t('coachWizardStep2Title')}</div>
          <div style={body}>{t('coachWizardStep2Body')}</div>
          <div style={planPointer}>
            <div style={{ ...S.mono, fontSize: '11px', color: '#0064ff', marginBottom: '6px', fontWeight: 700 }}>
              {lang === 'tr' ? '⚡ PLAN sekmesine git' : '⚡ Go to the PLAN tab'}
            </div>
            <div style={{ ...S.mono, fontSize: '11px', color: '#888' }}>
              {lang === 'tr'
                ? 'Bir plan oluşturun, ardından sporcunun profilinden "Push Plan" butonunu kullanın.'
                : 'Build a plan in the PLAN tab, then use "Push Plan" from the athlete\'s profile card.'}
            </div>
          </div>
          <button style={{ ...S.btn, width: '100%' }} onClick={() => setStep(3)}>
            {lang === 'tr' ? 'İleri →' : 'Next →'}
          </button>
        </>
      )
    }

    // step === 3
    return (
      <>
        <div style={stepCounter}>{t('coachWizardStep3Title')}</div>
        <div style={body}>{t('coachWizardStep3Body')}</div>
        <div style={timezoneBox}>
          <div style={{ ...S.mono, fontSize: '10px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {lang === 'tr' ? 'Saat dilimi' : 'Timezone'}
          </div>
          <div style={{ ...S.mono, fontSize: '13px', color: '#e5e5e5', fontWeight: 600 }}>
            {timezone}
          </div>
        </div>
        <button style={{ ...S.btn, width: '100%' }} onClick={handleComplete}>
          {t('coachWizardDone')}
        </button>
      </>
    )
  }

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label={t('coachWizardTitle')}>
      <div style={modal}>
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: '#ff6600', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
            {t('coachWizardTitle')}
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[1, 2, 3].map(n => (
              <span key={n} style={stepDot(step === n)} />
            ))}
            <span style={{ ...S.mono, fontSize: '10px', color: '#555', marginLeft: '6px' }}>
              {step}/{TOTAL_STEPS}
            </span>
          </div>
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Skip */}
        <div style={{ textAlign: 'right', marginTop: '14px' }}>
          <button
            onClick={handleSkip}
            style={{ ...S.mono, background: 'transparent', border: 'none', cursor: 'pointer', color: '#555', fontSize: '11px', padding: '4px 0' }}
          >
            {t('coachWizardSkip')}
          </button>
        </div>
      </div>
    </div>
  )
}
