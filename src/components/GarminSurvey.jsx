// src/components/GarminSurvey.jsx — E10: Garmin spike (PROTOTYPE)
// In-app survey to gauge Garmin connect interest before full implementation.
// Shows for users who have ≥5 sessions and no Garmin connection.
// Non-blocking: dismissable, stores response in localStorage only.

import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'

// Survey questions
const QUESTIONS = {
  device: {
    en: 'Do you use a Garmin device?',
    tr: 'Garmin cihazı kullanıyor musunuz?',
    options: {
      en: ['Yes, primarily', 'Yes, but not my main device', 'No'],
      tr: ['Evet, ana cihazım', 'Evet ama ana cihazım değil', 'Hayır'],
    },
  },
  connect: {
    en: 'Would you connect your Garmin to auto-import activities?',
    tr: 'Antrenmanları otomatik aktarmak için Garmin\'inizi bağlar mıydınız?',
    options: {
      en: ['Yes, absolutely', 'Maybe', 'No, I prefer manual'],
      tr: ['Evet, kesinlikle', 'Belki', 'Hayır, manuel tercih ederim'],
    },
  },
  value: {
    en: 'Which Garmin data would you most want in Sporeus?',
    tr: 'Sporeus\'ta en çok hangi Garmin verisini isterdiniz?',
    options: {
      en: ['Body Battery & HRV', 'TSS & Training Effect', 'HR zones & Power', 'All of it'],
      tr: ['Vücut Pili & HRV', 'TSS & Antrenman Etkisi', 'KAH zonları & Güç', 'Hepsi'],
    },
  },
}

const S = {
  overlay: {
    position: 'fixed',
    bottom: '80px',
    right: '16px',
    zIndex: 1000,
    width: '320px',
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    padding: '16px',
    fontFamily: 'IBM Plex Mono, monospace',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#ff6600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  dismiss: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 4px',
  },
  question: {
    fontSize: '12px',
    color: 'var(--text)',
    marginBottom: '10px',
    lineHeight: 1.5,
  },
  optionBtn: (selected) => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: selected ? 'rgba(255,102,0,0.15)' : 'var(--surface)',
    border: `1px solid ${selected ? '#ff6600' : 'var(--border)'}`,
    color: selected ? '#ff6600' : 'var(--text)',
    borderRadius: '2px',
    padding: '6px 10px',
    marginBottom: '6px',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12px',
  },
  nextBtn: {
    background: '#ff6600',
    border: 'none',
    color: '#fff',
    borderRadius: '2px',
    padding: '6px 14px',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
  },
  muted: {
    fontSize: '10px',
    color: 'var(--muted)',
  },
  thanks: {
    fontSize: '12px',
    color: 'var(--text)',
    lineHeight: 1.6,
    textAlign: 'center',
    padding: '8px 0',
  },
  progress: {
    fontSize: '10px',
    color: 'var(--muted)',
  },
}

const STEPS = ['device', 'connect', 'value']

/**
 * GarminSurvey — shows after 5+ sessions, gauges Garmin connect interest.
 *
 * @param {Object}  props
 * @param {number}  props.sessionCount   — total training log entries
 * @param {string}  props.lang           — 'en' | 'tr'
 * @param {boolean} [props.garminConnected] — hide if already connected
 */
export default function GarminSurvey({ sessionCount = 0, lang = 'en', garminConnected = false }) {
  const [surveyState, setSurveyState] = useLocalStorage('sporeus-garmin-survey', null)
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState({})
  const [done, setDone]       = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Conditions to show: ≥5 sessions, not connected, not yet responded/dismissed
  const shouldShow = (
    sessionCount >= 5 &&
    !garminConnected &&
    !surveyState &&
    !dismissed
  )

  if (!shouldShow) return null

  function handleDismiss() {
    setSurveyState({ dismissed: true, at: new Date().toISOString() })
    setDismissed(true)
  }

  function handleSelect(key, idx) {
    setAnswers(prev => ({ ...prev, [key]: idx }))
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      // Save final responses to localStorage for product analytics
      const result = {
        device:    QUESTIONS.device.options[lang][answers.device ?? 0],
        connect:   QUESTIONS.connect.options[lang][answers.connect ?? 0],
        value:     QUESTIONS.value.options[lang][answers.value ?? 0],
        at:        new Date().toISOString(),
        lang,
      }
      setSurveyState(result)
      setDone(true)
    }
  }

  const currentKey  = STEPS[step]
  const currentQ    = QUESTIONS[currentKey]
  const options     = currentQ.options[lang]
  const question    = currentQ[lang]
  const selectedIdx = answers[currentKey] ?? null

  if (done) {
    return (
      <div style={S.overlay} role="dialog" aria-label="Garmin survey complete">
        <div style={S.header}>
          <span style={S.title}>◈ SPOREUS</span>
          <button style={S.dismiss} onClick={handleDismiss} aria-label="Close">×</button>
        </div>
        <div style={S.thanks}>
          {lang === 'tr'
            ? 'Teşekkürler! Garmin entegrasyonu değerlendirme aşamasında.'
            : 'Thanks! Garmin integration is under evaluation.'}
        </div>
        <div style={{ ...S.muted, marginTop: '8px', textAlign: 'center' }}>
          {lang === 'tr' ? 'İlgilenirseniz e-posta ile bilgilendireceğiz.' : "We'll notify you if it ships."}
        </div>
      </div>
    )
  }

  return (
    <div style={S.overlay} role="dialog" aria-label="Garmin interest survey">
      <div style={S.header}>
        <span style={S.title}>
          {lang === 'tr' ? 'Garmin Anketi' : 'Garmin Survey'}
        </span>
        <button style={S.dismiss} onClick={handleDismiss} aria-label="Dismiss survey">×</button>
      </div>

      <div style={S.question}>{question}</div>

      {options.map((label, idx) => (
        <button
          key={idx}
          style={S.optionBtn(selectedIdx === idx)}
          onClick={() => handleSelect(currentKey, idx)}
        >
          {selectedIdx === idx ? '▶ ' : '  '}{label}
        </button>
      ))}

      <div style={S.nav}>
        <span style={S.progress}>
          {step + 1} / {STEPS.length}
        </span>
        <button
          style={{ ...S.nextBtn, opacity: selectedIdx === null ? 0.4 : 1 }}
          onClick={handleNext}
          disabled={selectedIdx === null}
        >
          {step < STEPS.length - 1
            ? (lang === 'tr' ? 'İleri →' : 'Next →')
            : (lang === 'tr' ? 'Gönder ✓' : 'Submit ✓')}
        </button>
      </div>

      <div style={{ ...S.muted, marginTop: '8px' }}>
        {lang === 'tr'
          ? '2 dk sürer · ürün kararı için'
          : '2 min · informs product decision'}
      </div>
    </div>
  )
}
