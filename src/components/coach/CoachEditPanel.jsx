// ─── coach/CoachEditPanel.jsx — coach-side EDIT mode for v=2 envelope ──────
//
// Wave B (v9.3.0). Mounted inside CoachAthleteProgramCard when the coach
// has loaded an athlete envelope and clicks ENTER EDIT MODE. Lets the coach
// stage edits (phase TSS bias, phase notes, key-session swaps, general
// notes) and export a v=2 envelope for the athlete to ingest.
//
// Edits live in component state (passed up via onChange) — this component
// is purely presentational; persistence is the parent's concern.

import { useContext, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { buildCoachEdit } from '../../lib/athlete/coachEditEngine.js'

const PHASES = ['Base', 'Build', 'Peak', 'Taper']
const PHASE_LABELS = {
  Base:  { en: 'Base',  tr: 'Temel' },
  Build: { en: 'Build', tr: 'Yapı' },
  Peak:  { en: 'Peak',  tr: 'Zirve' },
  Taper: { en: 'Taper', tr: 'Köşeleme' },
}

const EDIT_TYPES = [
  { value: 'phase-tss-bias', en: 'Phase TSS bias',     tr: 'Faz TSS biası' },
  { value: 'phase-note',     en: 'Phase note',         tr: 'Faz notu' },
  { value: 'key-session-swap', en: 'Key-session swap', tr: 'Anahtar seans değişimi' },
  { value: 'general-note',   en: 'General note',       tr: 'Genel not' },
]

function smallBtn(active) {
  return {
    ...S.mono,
    fontSize: 10,
    padding: '4px 10px',
    border: `1px solid ${active ? '#ff6600' : 'var(--border)'}`,
    background: active ? 'rgba(255,102,0,0.12)' : 'transparent',
    color: active ? '#ff6600' : 'var(--text)',
    cursor: 'pointer',
    borderRadius: 3,
    letterSpacing: '0.05em',
  }
}

export default function CoachEditPanel({ envelope, edits, onChange, isTR: isTRProp }) {
  const ctx = useContext(LangCtx)
  const isTR = typeof isTRProp === 'boolean' ? isTRProp : ctx.lang === 'tr'

  const [type, setType] = useState('phase-tss-bias')
  const [phase, setPhase] = useState('Base')
  const [bias, setBias] = useState('1.00')
  const [sessionKey, setSessionKey] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [sessionStructure, setSessionStructure] = useState('')
  const [noteEn, setNoteEn] = useState('')
  const [noteTr, setNoteTr] = useState('')
  const [error, setError] = useState(null)

  const safeEdits = Array.isArray(edits) ? edits : []
  const phasesPresent = Array.isArray(envelope?.phases)
    ? envelope.phases.map(p => p.phase).filter(p => PHASES.includes(p))
    : PHASES

  function handleAddEdit() {
    setError(null)
    let target, prev, next, edit
    if (type === 'phase-tss-bias') {
      target = phase
      const n = parseFloat(bias)
      if (!isFinite(n) || n < 0.5 || n > 1.5) {
        setError(isTR ? 'Bias 0.5-1.5 arasında olmalı.' : 'Bias must be 0.5-1.5.')
        return
      }
      prev = 1.0
      next = n
      edit = buildCoachEdit({ type, target, prev, next, noteEn, noteTr })
    } else if (type === 'phase-note') {
      target = phase
      if (!noteEn && !noteTr) {
        setError(isTR ? 'En az bir dilde not gerekli.' : 'Note required in at least one language.')
        return
      }
      edit = buildCoachEdit({ type, target, prev: null, next: null, noteEn, noteTr })
    } else if (type === 'key-session-swap') {
      if (!phase || !sessionKey || !sessionName || !sessionStructure) {
        setError(isTR
          ? 'Faz, anahtar (key), isim ve yapı zorunlu.'
          : 'Phase, key, name, and structure are required.')
        return
      }
      target = `${phase}/${sessionKey}`
      prev = null
      next = {
        key: sessionKey,
        name: { en: sessionName, tr: sessionName },
        structure: { en: sessionStructure, tr: sessionStructure },
        purpose: { en: '', tr: '' },
        warmup: { en: '15 min easy', tr: '15 dk kolay' },
        cooldown: { en: '10 min easy', tr: '10 dk kolay' },
        intensity: { en: '', tr: '' },
        alternates: [],
        citation: 'Coach swap',
      }
      edit = buildCoachEdit({ type, target, prev, next, noteEn, noteTr })
    } else if (type === 'general-note') {
      if (!noteEn && !noteTr) {
        setError(isTR ? 'En az bir dilde not gerekli.' : 'Note required in at least one language.')
        return
      }
      target = '*'
      edit = buildCoachEdit({ type, target, prev: null, next: null, noteEn, noteTr })
    }
    if (!edit) {
      setError(isTR ? 'Geçersiz düzenleme.' : 'Invalid edit.')
      return
    }
    onChange([...safeEdits, edit])
    setNoteEn('')
    setNoteTr('')
    setSessionKey('')
    setSessionName('')
    setSessionStructure('')
    setBias('1.00')
  }

  function handleRemove(id) {
    onChange(safeEdits.filter(e => e.id !== id))
  }

  function handleExportV2() {
    const v2 = {
      ...envelope,
      v: 2,
      edits: safeEdits,
      coachId: 'coach-anonymous',
      editedAt: new Date().toISOString().slice(0, 10),
    }
    const blob = new Blob([JSON.stringify(v2, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sporeus-coach-edits-${v2.editedAt}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleCopyV2() {
    const v2 = {
      ...envelope,
      v: 2,
      edits: safeEdits,
      coachId: 'coach-anonymous',
      editedAt: new Date().toISOString().slice(0, 10),
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(v2, null, 2))
    } catch {
      // ignore
    }
  }

  return (
    <div data-coach-edit-panel
      style={{ borderTop: '1px dashed var(--border)', paddingTop: 12, marginTop: 12 }}>
      <div style={{ ...S.mono, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 8 }}>
        {isTR ? 'KOÇ DÜZENLEMESİ · v=2' : 'COACH EDIT MODE · v=2'}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {EDIT_TYPES.map(t => (
          <button key={t.value} type="button"
            onClick={() => setType(t.value)}
            style={smallBtn(type === t.value)}>
            {isTR ? t.tr : t.en}
          </button>
        ))}
      </div>

      {(type === 'phase-tss-bias' || type === 'phase-note' || type === 'key-session-swap') ? (
        <div style={{ ...S.mono, fontSize: 11, marginBottom: 8 }}>
          <div style={{ marginBottom: 4 }}>{isTR ? 'Faz' : 'Phase'}</div>
          <select value={phase} onChange={e => setPhase(e.target.value)}
            style={{ ...S.input, fontSize: 11, padding: '4px 8px', width: '100%' }}>
            {phasesPresent.map(p => (
              <option key={p} value={p}>{isTR ? PHASE_LABELS[p].tr : PHASE_LABELS[p].en}</option>
            ))}
          </select>
        </div>
      ) : null}

      {type === 'phase-tss-bias' ? (
        <div style={{ ...S.mono, fontSize: 11, marginBottom: 8 }}>
          <div style={{ marginBottom: 4 }}>{isTR ? 'TSS Bias (0.5-1.5)' : 'TSS Bias (0.5-1.5)'}</div>
          <input type="number" min="0.5" max="1.5" step="0.05" value={bias}
            onChange={e => setBias(e.target.value)}
            style={{ ...S.input, fontSize: 11, padding: '4px 8px', width: '100%' }} />
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
            {isTR ? `Mevcut → ${Math.round(parseFloat(bias || 1) * 100)}% (1.0 = değişiklik yok)` : `Current → ${Math.round(parseFloat(bias || 1) * 100)}% (1.0 = no change)`}
          </div>
        </div>
      ) : null}

      {type === 'key-session-swap' ? (
        <div style={{ ...S.mono, fontSize: 11, marginBottom: 8 }}>
          <div style={{ marginBottom: 4 }}>{isTR ? 'Eski seans anahtarı (key)' : 'Existing session key'}</div>
          <input type="text" value={sessionKey} onChange={e => setSessionKey(e.target.value)}
            placeholder="run-build-vo2-5x4"
            style={{ ...S.input, fontSize: 11, padding: '4px 8px', width: '100%', marginBottom: 6 }} />
          <div style={{ marginBottom: 4 }}>{isTR ? 'Yeni seans adı' : 'New session name'}</div>
          <input type="text" value={sessionName} onChange={e => setSessionName(e.target.value)}
            placeholder={isTR ? 'Cruise interval 4×10' : 'Cruise interval 4×10'}
            style={{ ...S.input, fontSize: 11, padding: '4px 8px', width: '100%', marginBottom: 6 }} />
          <div style={{ marginBottom: 4 }}>{isTR ? 'Yeni yapı' : 'New structure'}</div>
          <textarea rows={2} value={sessionStructure} onChange={e => setSessionStructure(e.target.value)}
            placeholder={isTR ? '15 dk ısınma + 4×10 dk @T-tempo, 90s jog' : '15 min WU + 4×10 min @T-pace, 90s jog'}
            style={{ ...S.input, fontSize: 11, padding: '4px 8px', width: '100%' }} />
        </div>
      ) : null}

      <div style={{ ...S.mono, fontSize: 11, marginBottom: 8 }}>
        <div style={{ marginBottom: 4 }}>{isTR ? 'Not (TR)' : 'Note (EN)'}</div>
        <textarea rows={2}
          value={isTR ? noteTr : noteEn}
          onChange={e => isTR ? setNoteTr(e.target.value) : setNoteEn(e.target.value)}
          placeholder={isTR ? 'Bu sporcunun esnek antrenman penceresi var' : 'This athlete has a flexible training window'}
          style={{ ...S.input, fontSize: 11, padding: '4px 8px', width: '100%' }} />
      </div>

      {error ? (
        <div style={{ ...S.mono, fontSize: 11, color: '#dc3545', marginBottom: 8 }}>{error}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={handleAddEdit}
          style={{ ...S.btnPrimary, fontSize: 10, padding: '6px 14px' }}>
          + {isTR ? 'DÜZENLEMEYİ EKLE' : 'ADD EDIT'}
        </button>
      </div>

      {safeEdits.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ ...S.mono, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 6 }}>
            {isTR ? `BEKLEYEN DÜZENLEMELER · ${safeEdits.length}` : `STAGED EDITS · ${safeEdits.length}`}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {safeEdits.map(e => (
              <li key={e.id} style={{ ...S.mono, fontSize: 10, padding: '6px 8px', borderBottom: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#ff6600' }}>{e.type}</strong> · <code>{e.target}</code>
                  {e.type === 'phase-tss-bias' ? <span> → ×{e.next}</span> : null}
                  {e.note?.en || e.note?.tr ? (
                    <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                      "{isTR ? (e.note.tr || e.note.en) : (e.note.en || e.note.tr)}"
                    </div>
                  ) : null}
                </div>
                <button type="button" onClick={() => handleRemove(e.id)}
                  aria-label={isTR ? 'Düzenlemeyi kaldır' : 'Remove edit'}
                  style={{ ...S.mono, fontSize: 10, padding: '2px 8px', border: '1px solid #dc3545', background: 'transparent', color: '#dc3545', cursor: 'pointer', borderRadius: 3 }}>
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={handleExportV2}
              style={{ ...S.btnPrimary, fontSize: 10, padding: '6px 14px' }}>
              ↓ {isTR ? 'v=2 DOSYA İNDİR' : 'EXPORT v=2 FILE'}
            </button>
            <button type="button" onClick={handleCopyV2}
              style={{ ...S.btnSec, fontSize: 10, padding: '6px 14px' }}>
              📋 {isTR ? 'PANO' : 'COPY'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
