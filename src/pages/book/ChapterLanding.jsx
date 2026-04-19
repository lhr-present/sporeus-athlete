// src/pages/book/ChapterLanding.jsx — E16: book-to-app funnel
// Route: /b/ch:id — QR-targetable from physical EŞİK/THRESHOLD book.
// No auth required for landing; auth required for simulator-type bonuses.
// Attribution: emits book_chapter_landing event via window.dispatchEvent
// for App.jsx to capture and persist after login.

import { useState } from 'react'
import { getChapter } from '../../lib/book/chapterBonuses.js'

// ── Styles ─────────────────────────────────────────────────────────────────
const F = "'IBM Plex Mono', monospace"
const S = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#e0e0e0',
    fontFamily: F,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
  },
  logo: { fontSize: '13px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.12em', marginBottom: '24px' },
  card: {
    width: 'min(560px, 100%)',
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '4px',
    padding: '24px',
  },
  tag: {
    display: 'inline-block',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    background: '#ff6600',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '2px',
    marginBottom: '12px',
    textTransform: 'uppercase',
  },
  chapterTitle: { fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '4px' },
  bonusTitle: { fontSize: '16px', fontWeight: 700, color: '#ff6600', marginBottom: '8px' },
  desc: { fontSize: '12px', color: '#aaa', lineHeight: 1.6, marginBottom: '20px' },
  citBox: {
    fontSize: '10px',
    color: '#666',
    background: '#0d0d0d',
    border: '1px solid #1a1a1a',
    borderRadius: '2px',
    padding: '8px 12px',
    marginBottom: '20px',
    lineHeight: 1.5,
  },
  row: { display: 'flex', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' },
  input: {
    flex: 1,
    minWidth: '140px',
    background: '#0d0d0d',
    border: '1px solid #333',
    color: '#e0e0e0',
    fontFamily: F,
    fontSize: '12px',
    padding: '8px 10px',
    borderRadius: '2px',
    outline: 'none',
  },
  label: { fontSize: '10px', color: '#888', marginBottom: '4px', display: 'block' },
  calcBtn: {
    background: '#ff6600',
    border: 'none',
    color: '#fff',
    fontFamily: F,
    fontSize: '11px',
    fontWeight: 700,
    padding: '8px 20px',
    borderRadius: '2px',
    cursor: 'pointer',
    marginTop: '4px',
  },
  result: {
    background: '#0d1a0d',
    border: '1px solid #1a3a1a',
    borderRadius: '2px',
    padding: '12px 16px',
    marginTop: '12px',
    fontSize: '13px',
    color: '#4CAF50',
    fontWeight: 700,
  },
  stepList: { listStyle: 'none', padding: 0, margin: 0 },
  step: {
    display: 'flex',
    gap: '10px',
    marginBottom: '10px',
    fontSize: '12px',
    color: '#ccc',
    lineHeight: 1.5,
  },
  stepNum: {
    flexShrink: 0,
    width: '20px',
    height: '20px',
    background: '#ff6600',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 700,
  },
  tableHead: { background: '#1a1a1a', color: '#888', fontSize: '10px', textAlign: 'left', padding: '6px 10px' },
  tableCell: { fontSize: '11px', color: '#ccc', padding: '6px 10px', borderTop: '1px solid #1a1a1a' },
  ctaBox: { marginTop: '24px', borderTop: '1px solid #1a1a1a', paddingTop: '20px' },
  ctaPrimary: {
    display: 'block',
    width: '100%',
    background: '#0064ff',
    border: 'none',
    color: '#fff',
    fontFamily: F,
    fontSize: '12px',
    fontWeight: 700,
    padding: '12px',
    borderRadius: '2px',
    cursor: 'pointer',
    marginBottom: '8px',
    textAlign: 'center',
    textDecoration: 'none',
  },
  ctaSecondary: {
    display: 'block',
    width: '100%',
    background: 'transparent',
    border: '1px solid #333',
    color: '#aaa',
    fontFamily: F,
    fontSize: '11px',
    padding: '10px',
    borderRadius: '2px',
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
  },
  notFound: { textAlign: 'center', padding: '60px 20px', fontSize: '14px', color: '#666' },
}

// ── Calculator widget ───────────────────────────────────────────────────────
function CalculatorWidget({ bonus, lang }) {
  const inputs = bonus.inputs ?? []
  const [vals, setVals] = useState(() =>
    Object.fromEntries(inputs.map(i => [i.key, '']))
  )
  const [result, setResult] = useState(null)

  function handleCompute() {
    const parsed = {}
    for (const inp of inputs) {
      const v = parseFloat(vals[inp.key])
      if (!inp.optional && (isNaN(v) || v < inp.min || v > inp.max)) return
      parsed[inp.key] = isNaN(v) ? undefined : v
    }
    setResult(bonus.compute(parsed))
  }

  return (
    <div>
      {inputs.map(inp => (
        <div key={inp.key} style={{ marginBottom: '12px' }}>
          <label style={S.label}>{inp.label[lang] ?? inp.label.en}</label>
          <input
            style={S.input}
            type="number"
            min={inp.min}
            max={inp.max}
            value={vals[inp.key]}
            onChange={e => setVals(p => ({ ...p, [inp.key]: e.target.value }))}
            placeholder={`${inp.min}–${inp.max}`}
          />
        </div>
      ))}
      <button style={S.calcBtn} onClick={handleCompute}>
        {lang === 'tr' ? 'Hesapla →' : 'Calculate →'}
      </button>
      {result && (
        <div style={S.result}>
          <ResultDisplay result={result} lang={lang} />
        </div>
      )}
    </div>
  )
}

function ResultDisplay({ result, lang }) {
  // Handle zone results (objects with lo/hi)
  const entries = Object.entries(result).filter(([k]) => k !== 'label')
  const label = result.label?.[lang] ?? result.label?.en

  return (
    <>
      {label && <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px' }}>{label}</div>}
      {entries.map(([k, v]) => {
        if (k === 'label') return null
        if (typeof v === 'object' && v !== null && 'lo' in v) {
          return (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#888', fontSize: '11px' }}>{k.toUpperCase()}</span>
              <span>{v.lo}–{v.hi ?? '∞'} </span>
            </div>
          )
        }
        if (typeof v === 'object' && v !== null && ('en' in v || 'tr' in v)) {
          return <div key={k}>{v[lang] ?? v.en}</div>
        }
        if (typeof v === 'number' || typeof v === 'string') {
          return <div key={k}>{k === 'drop_pct' ? `${v}% drop` : v}</div>
        }
        return null
      })}
    </>
  )
}

// ── Protocol widget ─────────────────────────────────────────────────────────
function ProtocolWidget({ bonus, lang }) {
  const steps = bonus.steps ?? []
  return (
    <ol style={S.stepList}>
      {steps.map((step, i) => (
        <li key={i} style={S.step}>
          <span style={S.stepNum}>{i + 1}</span>
          <span>{step[lang] ?? step.en}</span>
        </li>
      ))}
    </ol>
  )
}

// ── Table widget ────────────────────────────────────────────────────────────
function TableWidget({ bonus, lang }) {
  const rows = bonus.rows ?? []
  if (!rows.length) return null
  const keys = Object.keys(rows[0])
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {keys.map(k => (
            <th key={k} style={S.tableHead}>{k}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {keys.map(k => (
              <td key={k} style={S.tableCell}>
                {typeof row[k] === 'object' ? (row[k][lang] ?? row[k].en) : row[k]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Template widget ─────────────────────────────────────────────────────────
function TemplateWidget({ bonus, lang }) {
  const sessions = bonus.sessions ?? []
  return (
    <div>
      {sessions.map((s, i) => (
        <div key={i} style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: '2px', padding: '10px 12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: '#888' }}>{s.day}</span>
            <span style={{ fontSize: '10px', color: '#ff6600' }}>{s.type} · {s.duration}min{s.rpe != null ? ` · RPE ${s.rpe}` : ''}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#ccc' }}>{s.notes}</div>
        </div>
      ))}
      <div style={{ fontSize: '10px', color: '#555', marginTop: '8px' }}>
        {lang === 'tr'
          ? "Sporeus'ta oturum açtıktan sonra şablonu doğrudan kayıt defterine aktarabilirsiniz."
          : 'After signing in to Sporeus, you can import this template directly into your log.'}
      </div>
    </div>
  )
}

// ── Simulator widget ────────────────────────────────────────────────────────
function SimulatorWidget({ bonus: _bonus, lang }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px', background: '#0d0d0d', border: '1px solid #222', borderRadius: '2px' }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔒</div>
      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
        {lang === 'tr' ? 'Bu özellik için giriş gerekli' : 'Sign in required for this feature'}
      </div>
    </div>
  )
}

// ── Main ChapterLanding ────────────────────────────────────────────────────

/**
 * ChapterLanding — renders chapter-specific bonus content.
 * @param {Object}   props
 * @param {string}   props.chapterId  — 'ch1'–'ch22' (from URL pathname)
 * @param {string}   [props.lang]     — 'en' | 'tr' (default 'tr' for Turkish book)
 * @param {Function} [props.onSignup] — called when "Create account" CTA clicked
 */
export default function ChapterLanding({ chapterId, lang = 'tr', onSignup }) {
  const chapter = getChapter(chapterId)

  if (!chapter) {
    return (
      <div style={S.page}>
        <div style={S.logo}>◈ SPOREUS</div>
        <div style={S.notFound}>
          {lang === 'tr' ? 'Bölüm bulunamadı.' : 'Chapter not found.'}<br />
          <span style={{ fontSize: '11px' }}>/b/ch1 — /b/ch22</span>
        </div>
      </div>
    )
  }

  const { bonus } = chapter

  function renderBonus() {
    switch (bonus.type) {
      case 'calculator': return <CalculatorWidget bonus={bonus} lang={lang} />
      case 'protocol':   return <ProtocolWidget   bonus={bonus} lang={lang} />
      case 'table':      return <TableWidget       bonus={bonus} lang={lang} />
      case 'template':   return <TemplateWidget    bonus={bonus} lang={lang} />
      case 'simulator':  return <SimulatorWidget   bonus={bonus} lang={lang} />
      default:           return null
    }
  }

  function handleSignup() {
    // Emit attribution event — App.jsx or booking handler saves it
    window.dispatchEvent(new CustomEvent('sporeus:book-chapter-signup', {
      detail: {
        chapter_id:   chapterId,
        utm_source:   'esik_book',
        utm_medium:   'qr',
        utm_campaign: 'launch_2026',
      }
    }))
    if (onSignup) onSignup({ chapterId })
  }

  return (
    <div style={S.page}>
      <div style={S.logo}>◈ SPOREUS</div>

      <div style={S.card}>
        {/* Chapter tag */}
        <div style={S.tag}>
          EŞİK / THRESHOLD · {chapterId.replace('ch', lang === 'tr' ? 'Bölüm ' : 'Chapter ')}
        </div>

        {/* Titles */}
        <div style={S.chapterTitle}>{chapter.title[lang] ?? chapter.title.en}</div>
        <div style={S.bonusTitle}>{bonus.title[lang] ?? bonus.title.en}</div>

        {/* Description */}
        <div style={S.desc}>{bonus.description[lang] ?? bonus.description.en}</div>

        {/* Bonus content */}
        {renderBonus()}

        {/* Citation */}
        <div style={S.citBox}>
          📚 {bonus.citation}
        </div>

        {/* CTA */}
        <div style={S.ctaBox}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
            {lang === 'tr'
              ? 'Antrenman günlüğünüze, CTL/TSB grafiklerine ve tüm hesaplamalara ücretsiz erişin.'
              : 'Free access to your training log, CTL/TSB charts, and all calculators.'}
          </div>
          <button style={S.ctaPrimary} onClick={handleSignup}>
            {lang === 'tr' ? 'Sporeus\'ta Hesap Oluştur — Ücretsiz →' : 'Create Free Sporeus Account →'}
          </button>
          <a href="/" style={S.ctaSecondary}>
            {lang === 'tr' ? 'Zaten hesabım var → Giriş yap' : 'Already have an account → Sign in'}
          </a>
        </div>

        {/* Fine print */}
        <div style={{ fontSize: '10px', color: '#444', marginTop: '16px', textAlign: 'center' }}>
          {lang === 'tr'
            ? 'EŞİK okuyucusunuz. Bu bonus içerik yalnızca kitap okuyucuları için oluşturulmuştur.'
            : 'You\'re a THRESHOLD reader. This bonus content is created exclusively for book readers.'}
        </div>
      </div>
    </div>
  )
}
