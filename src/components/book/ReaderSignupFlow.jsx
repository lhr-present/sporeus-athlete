// src/components/book/ReaderSignupFlow.jsx — E16: book-to-app funnel
// Onboarding variant for EŞİK/THRESHOLD book readers.
// Skips the introductory welcome step — starts directly at sport picker (step 2 of E9 flow).
// Offers "Load THRESHOLD templates" one-click after signup.

import { useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

const F = "'IBM Plex Mono', monospace"

const SPORTS = [
  { key: 'Running',   emoji: '🏃', label: { en: 'Running', tr: 'Koşu' } },
  { key: 'Cycling',   emoji: '🚴', label: { en: 'Cycling', tr: 'Bisiklet' } },
  { key: 'Triathlon', emoji: '🏊', label: { en: 'Triathlon', tr: 'Triatlon' } },
  { key: 'Swimming',  emoji: '🏊', label: { en: 'Swimming', tr: 'Yüzme' } },
  { key: 'Rowing',    emoji: '🚣', label: { en: 'Rowing', tr: 'Kürek' } },
  { key: 'Other',     emoji: '⚡', label: { en: 'Other', tr: 'Diğer' } },
]

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: '#0a0a0a',
    zIndex: 10020,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: F,
  },
  card: {
    width: 'min(480px, 100%)',
    background: '#111',
    border: '1px solid #ff6600',
    borderRadius: '4px',
    padding: '28px',
  },
  badge: {
    display: 'inline-block',
    background: '#ff6600',
    color: '#fff',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    padding: '2px 8px',
    borderRadius: '2px',
    marginBottom: '12px',
  },
  heading: { fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' },
  sub: { fontSize: '11px', color: '#888', marginBottom: '20px', lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '20px' },
  sportBtn: (selected) => ({
    background: selected ? 'rgba(255,102,0,0.15)' : '#0d0d0d',
    border: `1px solid ${selected ? '#ff6600' : '#222'}`,
    color: selected ? '#ff6600' : '#ccc',
    borderRadius: '3px',
    padding: '12px 8px',
    cursor: 'pointer',
    fontFamily: F,
    fontSize: '11px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  }),
  emoji: { fontSize: '20px' },
  templatesBox: {
    background: '#0d1a0d',
    border: '1px solid #1a3a1a',
    borderRadius: '3px',
    padding: '12px 16px',
    marginBottom: '16px',
  },
  templatesLabel: { fontSize: '10px', color: '#4CAF50', fontWeight: 700, marginBottom: '6px' },
  templatesList: { fontSize: '11px', color: '#aaa', lineHeight: 1.8 },
  loadBtn: {
    display: 'block',
    width: '100%',
    background: '#ff6600',
    border: 'none',
    color: '#fff',
    fontFamily: F,
    fontSize: '12px',
    fontWeight: 700,
    padding: '12px',
    borderRadius: '2px',
    cursor: 'pointer',
    marginBottom: '8px',
  },
  skipBtn: {
    display: 'block',
    width: '100%',
    background: 'transparent',
    border: '1px solid #222',
    color: '#666',
    fontFamily: F,
    fontSize: '11px',
    padding: '10px',
    borderRadius: '2px',
    cursor: 'pointer',
  },
}

// The 5 reader-exclusive templates (named from book chapters)
const READER_TEMPLATES = [
  { key: 'polarized_week',  title: { en: 'Polarized Week (Ch.8)',          tr: 'Polarize Hafta (Böl.8)'         } },
  { key: 'mito_block',      title: { en: 'Mitochondrial Density Block (Ch.9)', tr: 'Mitokondriyal Blok (Böl.9)'   } },
  { key: 'taper_3wk',       title: { en: '3-Week Classic Taper (Ch.14)',    tr: '3 Haftalık Düşüş (Böl.14)'      } },
  { key: 'recovery_week',   title: { en: 'Recovery Week (Ch.17)',           tr: 'Toparlanma Haftası (Böl.17)'    } },
  { key: 'prerace_routine', title: { en: 'Pre-Race 48h Routine (Ch.22)',    tr: 'Yarış Öncesi 48s (Böl.22)'      } },
]

/**
 * ReaderSignupFlow — shown to book readers who just signed up.
 * Skips intro, starts at sport picker, offers THRESHOLD template pack.
 *
 * @param {Object}   props
 * @param {string}   props.lang         — 'en' | 'tr'
 * @param {string}   [props.chapterId]  — entry chapter from QR code
 * @param {Function} props.onFinish     — called with { sport, templatesLoaded }
 */
export default function ReaderSignupFlow({ lang = 'tr', chapterId = null, onFinish }) {
  const [sport, setSport] = useState(null)
  const [step, setStep]   = useState('sport') // 'sport' | 'templates'
  const [, setBookAttribution] = useLocalStorage('sporeus-book-attribution', null)

  // Persist attribution so it can be synced to Supabase after auth
  function saveAttribution(chId) {
    if (!chId) return
    setBookAttribution({
      chapter_id:   chId,
      utm_source:   'esik_book',
      utm_medium:   'qr',
      utm_campaign: 'launch_2026',
      at:           new Date().toISOString(),
    })
  }

  function handleSportNext() {
    if (!sport) return
    saveAttribution(chapterId)
    setStep('templates')
  }

  function handleLoadTemplates() {
    // Emit event — App.jsx / TrainingLog listens and pre-loads reader templates
    window.dispatchEvent(new CustomEvent('sporeus:load-reader-templates', {
      detail: { sport, templates: READER_TEMPLATES.map(t => t.key) }
    }))
    onFinish({ sport, templatesLoaded: true, source: 'book_reader', chapterId })
  }

  function handleSkipTemplates() {
    onFinish({ sport, templatesLoaded: false, source: 'book_reader', chapterId })
  }

  if (step === 'sport') {
    return (
      <div style={S.overlay}>
        <div style={S.card}>
          <div style={S.badge}>EŞİK / THRESHOLD {lang === 'tr' ? 'OKUYUCUSU' : 'READER'}</div>
          <div style={S.heading}>
            {lang === 'tr' ? 'Ana sporunu seç' : 'Pick your primary sport'}
          </div>
          <div style={S.sub}>
            {lang === 'tr'
              ? 'Kitaptaki formüller ve antrenman şablonları sporuna göre uyarlanacak.'
              : 'Book formulas and training templates will adapt to your sport.'}
          </div>

          <div style={S.grid}>
            {SPORTS.map(s => (
              <button
                key={s.key}
                style={S.sportBtn(sport === s.key)}
                onClick={() => setSport(s.key)}
              >
                <span style={S.emoji}>{s.emoji}</span>
                {s.label[lang] ?? s.label.en}
              </button>
            ))}
          </div>

          <button
            style={{ ...S.loadBtn, opacity: sport ? 1 : 0.4 }}
            onClick={handleSportNext}
            disabled={!sport}
          >
            {lang === 'tr' ? 'Devam →' : 'Continue →'}
          </button>
        </div>
      </div>
    )
  }

  // step === 'templates'
  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={S.badge}>EŞİK / THRESHOLD {lang === 'tr' ? 'OKUYUCUSU' : 'READER'}</div>
        <div style={S.heading}>
          {lang === 'tr' ? 'THRESHOLD şablonlarını yükle' : 'Load THRESHOLD templates'}
        </div>
        <div style={S.sub}>
          {lang === 'tr'
            ? 'Kitapta anlatılan 5 antrenman bloğu Sporeus antrenman günlüğüne hazır olarak yüklensin mi?'
            : 'Load the 5 training blocks from the book into your Sporeus log, ready to use?'}
        </div>

        <div style={S.templatesBox}>
          <div style={S.templatesLabel}>
            {lang === 'tr' ? '5 THRESHOLD ŞABLONU' : '5 THRESHOLD TEMPLATES'}
          </div>
          <ul style={{ ...S.templatesList, listStyle: 'none', padding: 0, margin: 0 }}>
            {READER_TEMPLATES.map(t => (
              <li key={t.key}>▸ {t.title[lang] ?? t.title.en}</li>
            ))}
          </ul>
        </div>

        <button style={S.loadBtn} onClick={handleLoadTemplates}>
          {lang === 'tr' ? 'Şablonları Yükle →' : 'Load Templates →'}
        </button>
        <button style={S.skipBtn} onClick={handleSkipTemplates}>
          {lang === 'tr' ? 'Şimdi değil, boş başla' : 'Skip for now, start empty'}
        </button>
      </div>
    </div>
  )
}
