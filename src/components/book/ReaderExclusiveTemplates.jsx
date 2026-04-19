// src/components/book/ReaderExclusiveTemplates.jsx — E16: book-to-app funnel
// 5 session templates named from EŞİK/THRESHOLD book chapters.
// Shown in the training log for readers who loaded the template pack.
// Each template pre-fills Quick Add with chapter-specific session data.

import { useState } from 'react'

const F = "'IBM Plex Mono', monospace"

// The 5 exclusive templates — all citation-grounded (citations in chapterBonuses.js)
const TEMPLATES = [
  {
    key: 'polarized_week',
    chapter: 'Ch.8',
    title: { en: 'Polarized Week', tr: 'Polarize Hafta' },
    tagline: { en: '80/20 · 4 Z2 + 1 VO2max', tr: '80/20 · 4 Z2 + 1 VO2maks' },
    sessions: [
      { type: 'Running', duration: 60, rpe: 3, notes: '[THRESHOLD Ch.8] Z2 easy run — aerobic base · Seiler 2010' },
      { type: 'Running', duration: 75, rpe: 3, notes: '[THRESHOLD Ch.8] Z2 long easy — fat oxidation' },
      { type: 'Running', duration: 50, rpe: 7, notes: '[THRESHOLD Ch.8] 5×4 min Z5 intervals, 3 min recovery' },
      { type: 'Running', duration: 45, rpe: 3, notes: '[THRESHOLD Ch.8] Z1 active recovery' },
      { type: 'Running', duration: 90, rpe: 3, notes: '[THRESHOLD Ch.8] Z2 long run — aerobic volume' },
    ],
    color: '#0064ff',
  },
  {
    key: 'mito_block',
    chapter: 'Ch.9',
    title: { en: 'Mitochondrial Density Block', tr: 'Mitokondriyal Yoğunluk Bloğu' },
    tagline: { en: '10–12h/wk Z2 · 4 weeks', tr: '10–12s/hafta Z2 · 4 hafta' },
    sessions: [
      { type: 'Running',  duration: 90, rpe: 3, notes: '[THRESHOLD Ch.9] Mitochondrial block — Z2 threshold session' },
      { type: 'Cycling',  duration: 120, rpe: 3, notes: '[THRESHOLD Ch.9] Cross-training Z2 — easy spin' },
      { type: 'Running',  duration: 75, rpe: 3, notes: '[THRESHOLD Ch.9] Z2 steady — nose breathing check' },
      { type: 'Running',  duration: 150, rpe: 3, notes: '[THRESHOLD Ch.9] Long Z2 run — fat adaptation cue' },
      { type: 'Cycling',  duration: 100, rpe: 3, notes: '[THRESHOLD Ch.9] Active recovery spin' },
    ],
    color: '#4CAF50',
  },
  {
    key: 'taper_3wk',
    chapter: 'Ch.14',
    title: { en: '3-Week Classic Taper', tr: '3 Haftalık Klasik Düşüş' },
    tagline: { en: 'Mujika 2003 · TSB +5 to +15', tr: 'Mujika 2003 · TSB +5 ile +15' },
    sessions: [
      { type: 'Running', duration: 50, rpe: 7, notes: '[THRESHOLD Ch.14] Taper W-3: quality maintained, vol −40%' },
      { type: 'Running', duration: 60, rpe: 3, notes: '[THRESHOLD Ch.14] Taper W-3: easy Z2' },
      { type: 'Running', duration: 40, rpe: 7, notes: '[THRESHOLD Ch.14] Taper W-2: 3×5 min Z4, stay sharp' },
      { type: 'Running', duration: 40, rpe: 3, notes: '[THRESHOLD Ch.14] Taper W-2: easy aerobic' },
      { type: 'Running', duration: 30, rpe: 6, notes: '[THRESHOLD Ch.14] Taper W-1: 2×4 min race pace' },
      { type: 'Running', duration: 25, rpe: 3, notes: '[THRESHOLD Ch.14] Taper W-1: shake-out run' },
    ],
    color: '#ff6600',
  },
  {
    key: 'recovery_week',
    chapter: 'Ch.17',
    title: { en: 'Recovery Week', tr: 'Toparlanma Haftası' },
    tagline: { en: 'Budgett 1998 · vol −40% · Z4+ off', tr: 'Budgett 1998 · hacim −%40 · Z4+ yok' },
    sessions: [
      { type: 'Running', duration: 35, rpe: 3, notes: '[THRESHOLD Ch.17] Recovery week — easy Z1/Z2 only' },
      { type: 'Running', duration: 40, rpe: 3, notes: '[THRESHOLD Ch.17] Recovery week — aerobic maintenance' },
      { type: 'Running', duration: 50, rpe: 3, notes: '[THRESHOLD Ch.17] Recovery week — long easy, no quality' },
    ],
    color: '#888',
  },
  {
    key: 'prerace_routine',
    chapter: 'Ch.22',
    title: { en: 'Pre-Race 48h Routine', tr: 'Yarış Öncesi 48s Rutini' },
    tagline: { en: 'Cotterill 2011 · mental rehearsal', tr: 'Cotterill 2011 · zihinsel prova' },
    sessions: [
      { type: 'Running', duration: 25, rpe: 4, notes: '[THRESHOLD Ch.22] T-2: 20 min easy + 4×30s strides — activation' },
      { type: 'Running', duration: 15, rpe: 3, notes: '[THRESHOLD Ch.22] T-1: 10 min shake-out + mental rehearsal' },
    ],
    color: '#9c27b0',
  },
]

const S = {
  container: { marginBottom: '16px' },
  sectionLabel: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#ff6600',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  badge: {
    background: 'rgba(255,102,0,0.15)',
    border: '1px solid rgba(255,102,0,0.3)',
    borderRadius: '2px',
    padding: '1px 6px',
    fontSize: '8px',
    color: '#ff6600',
  },
  templateCard: (color) => ({
    background: '#0d0d0d',
    border: `1px solid ${color}33`,
    borderRadius: '3px',
    padding: '12px 14px',
    marginBottom: '6px',
    cursor: 'pointer',
    fontFamily: F,
  }),
  templateHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' },
  templateTitle: (color) => ({ fontSize: '12px', fontWeight: 700, color }),
  templateChapter: { fontSize: '9px', color: '#666' },
  templateTagline: { fontSize: '10px', color: '#888' },
  sessionCount: { fontSize: '10px', color: '#555', marginTop: '4px' },
  expandedSessions: {
    marginTop: '10px',
    borderTop: '1px solid #1a1a1a',
    paddingTop: '10px',
  },
  session: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '6px',
    fontSize: '10px',
  },
  sessionLabel: { color: '#888' },
  sessionNote: { color: '#ccc', flex: 1, marginLeft: '8px', fontSize: '10px', lineHeight: 1.4 },
  addBtn: (color) => ({
    background: color,
    border: 'none',
    color: '#fff',
    fontFamily: F,
    fontSize: '10px',
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: '2px',
    cursor: 'pointer',
    marginTop: '8px',
  }),
}

/**
 * ReaderExclusiveTemplates — shows 5 THRESHOLD book templates in the training log.
 *
 * @param {Object}    props
 * @param {string}    [props.lang]      — 'en' | 'tr'
 * @param {Function}  [props.onUseTemplate] — called with first session to pre-fill Quick Add
 */
export default function ReaderExclusiveTemplates({ lang = 'tr', onUseTemplate }) {
  const [expanded, setExpanded] = useState(null)

  function handleToggle(key) {
    setExpanded(prev => prev === key ? null : key)
  }

  function handleUseFirst(template) {
    const first = template.sessions[0]
    if (onUseTemplate) {
      onUseTemplate({
        type:     first.type,
        duration: first.duration,
        rpe:      first.rpe,
        notes:    first.notes,
      })
    }
  }

  return (
    <div style={S.container}>
      <div style={S.sectionLabel}>
        EŞİK / THRESHOLD
        <span style={S.badge}>
          {lang === 'tr' ? 'OKUYUCU ÖZEL' : 'READER EXCLUSIVE'}
        </span>
      </div>

      {TEMPLATES.map(tpl => (
        <div key={tpl.key}>
          <div
            style={S.templateCard(tpl.color)}
            onClick={() => handleToggle(tpl.key)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && handleToggle(tpl.key)}
            aria-expanded={expanded === tpl.key}
          >
            <div style={S.templateHeader}>
              <div style={S.templateTitle(tpl.color)}>{tpl.title[lang] ?? tpl.title.en}</div>
              <div style={S.templateChapter}>{tpl.chapter}</div>
            </div>
            <div style={S.templateTagline}>{tpl.tagline[lang] ?? tpl.tagline.en}</div>
            <div style={S.sessionCount}>
              {tpl.sessions.length} {lang === 'tr' ? 'seans' : 'sessions'} · {expanded === tpl.key ? '▲' : '▼'}
            </div>

            {expanded === tpl.key && (
              <div style={S.expandedSessions}>
                {tpl.sessions.map((s, i) => (
                  <div key={i} style={S.session}>
                    <span style={S.sessionLabel}>{s.type} {s.duration}dk RPE{s.rpe}</span>
                    <span style={S.sessionNote}>{s.notes.replace(/^\[THRESHOLD Ch\.\d+\] /, '')}</span>
                  </div>
                ))}
                <button
                  style={S.addBtn(tpl.color)}
                  onClick={e => { e.stopPropagation(); handleUseFirst(tpl) }}
                  aria-label={`Use ${tpl.title.en} template`}
                >
                  {lang === 'tr' ? 'İlk Seansı Ekle →' : 'Add First Session →'}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
