// ─── dashboard/CoachEditsBanner.jsx — athlete-side coach-edits ingest UI ───
//
// Wave B (v9.3.0). Mounted inside EliteProgramCard (above the result block)
// when the athlete has staged coach edits in localStorage. Lists each edit
// with ACCEPT / REVERT controls and an ACCEPT ALL button. Persists status
// to `sporeus-athlete-coach-edits` localStorage. The plan-result render
// re-applies edits via applyCoachEdits on every render.
//
// Also accepts an `onIngestV2` prop that the parent uses to wire the
// "PASTE COACH v=2 ENVELOPE" textarea into the same store.

import { useContext, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import {
  parseCoachShareEnvelope,
  COACH_SHARE_ERRORS,
} from '../../lib/athlete/coachShareEnvelope.js'
import {
  acceptCoachEdit,
  revertCoachEdit,
  acceptAllCoachEdits,
  summarizeCoachEdits,
} from '../../lib/athlete/coachEditEngine.js'

export const ATHLETE_EDITS_KEY = 'sporeus-athlete-coach-edits'

function bil(field, isTR) {
  if (!field) return ''
  return isTR ? (field.tr || field.en || '') : (field.en || '')
}

export default function CoachEditsBanner({ defaultOpen = false }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [stored, setStored] = useLocalStorage(ATHLETE_EDITS_KEY, null)
  const [pasted, setPasted] = useState('')
  const [errorCode, setErrorCode] = useState(null)
  const [open, setOpen] = useState(defaultOpen)

  const edits = Array.isArray(stored?.edits) ? stored.edits : []
  const summary = summarizeCoachEdits(edits)

  function handleIngest() {
    const r = parseCoachShareEnvelope(pasted)
    if (!r.ok || r.envelope.v !== 2) {
      setErrorCode(r.ok ? 'unsupported-version' : r.error)
      return
    }
    setStored(r.envelope)
    setPasted('')
    setErrorCode(null)
    setOpen(true)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      setErrorCode('invalid-json')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      const text = String(ev.target?.result || '')
      const r = parseCoachShareEnvelope(text)
      if (!r.ok || r.envelope.v !== 2) {
        setErrorCode(r.ok ? 'unsupported-version' : r.error)
      } else {
        setStored(r.envelope)
        setPasted('')
        setErrorCode(null)
        setOpen(true)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleAccept(id) {
    setStored({ ...stored, edits: acceptCoachEdit(edits, id) })
  }

  function handleRevert(id) {
    setStored({ ...stored, edits: revertCoachEdit(edits, id) })
  }

  function handleAcceptAll() {
    setStored({ ...stored, edits: acceptAllCoachEdits(edits) })
  }

  function handleClear() {
    setStored(null)
  }

  if (!stored) {
    return (
      <details data-coach-edits-banner="empty"
        style={{ border: '1px dashed var(--border)', borderRadius: 4, padding: '8px 12px', marginBottom: 12 }}>
        <summary style={{ ...S.mono, fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em' }}>
          {isTR ? 'KOÇ DÜZENLEMESİ İÇE AKTAR (v=2)' : 'IMPORT COACH EDITS (v=2)'}
        </summary>
        <div style={{ marginTop: 10 }}>
          <textarea
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            rows={3}
            placeholder={isTR ? 'Koçtan gelen v=2 JSON\'u buraya yapıştır' : 'Paste v=2 JSON from your coach here'}
            style={{ ...S.input, fontSize: 11, padding: 6, width: '100%', marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleIngest}
              disabled={pasted.trim().length === 0}
              style={{ ...S.btnPrimary, fontSize: 10, padding: '6px 14px', opacity: pasted.trim().length === 0 ? 0.5 : 1 }}>
              {isTR ? 'YÜKLE' : 'INGEST'}
            </button>
            <label style={{ ...S.mono, fontSize: 10, cursor: 'pointer', textDecoration: 'underline', color: 'var(--muted)' }}>
              {isTR ? 'veya dosya yükle' : 'or upload file'}
              <input type="file" accept="application/json,.json" onChange={handleFile}
                style={{ display: 'none' }} />
            </label>
          </div>
          {errorCode ? (
            <div style={{ ...S.mono, fontSize: 11, color: '#dc3545', marginTop: 6 }}>
              {COACH_SHARE_ERRORS[errorCode]?.[isTR ? 'tr' : 'en']
                || (isTR ? 'Geçersiz girdi' : 'Invalid input')}
            </div>
          ) : null}
        </div>
      </details>
    )
  }

  return (
    <div data-coach-edits-banner="loaded"
      style={{
        border: '2px solid #9966cc',
        borderRadius: 4,
        background: 'rgba(153,102,204,0.06)',
        padding: '10px 12px',
        marginBottom: 12,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ ...S.mono, fontSize: 11, fontWeight: 700, color: '#9966cc', letterSpacing: '0.06em' }}>
          {isTR ? 'KOÇ DÜZENLEMESİ ALINDI' : 'COACH EDITS RECEIVED'}
          <span style={{ marginLeft: 8, color: 'var(--muted)', fontWeight: 400 }}>
            · {summary.total} {isTR ? 'toplam' : 'total'}
            {summary.applied > 0 ? ` · ${summary.applied} ${isTR ? 'uygulandı' : 'applied'}` : ''}
            {summary.pending > 0 ? ` · ${summary.pending} ${isTR ? 'bekliyor' : 'pending'}` : ''}
            {summary.rejected > 0 ? ` · ${summary.rejected} ${isTR ? 'reddedildi' : 'rejected'}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {summary.pending > 0 ? (
            <button type="button" onClick={handleAcceptAll}
              style={{ ...S.btnPrimary, fontSize: 10, padding: '4px 10px' }}>
              ✓ {isTR ? 'TÜMÜNÜ KABUL ET' : 'ACCEPT ALL'}
            </button>
          ) : null}
          <button type="button" onClick={() => setOpen(o => !o)}
            style={{ ...S.btnSec, fontSize: 10, padding: '4px 10px' }}>
            {open ? (isTR ? 'GİZLE' : 'HIDE') : (isTR ? 'GÖSTER' : 'SHOW')}
          </button>
          <button type="button" onClick={handleClear}
            aria-label={isTR ? 'Tüm düzenlemeleri temizle' : 'Clear all edits'}
            style={{ ...S.mono, fontSize: 10, padding: '4px 10px', border: '1px solid #dc3545', background: 'transparent', color: '#dc3545', cursor: 'pointer', borderRadius: 3 }}>
            ×
          </button>
        </div>
      </div>

      {stored.coachId || stored.editedAt ? (
        <div style={{ ...S.mono, fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
          {stored.coachId ? `${isTR ? 'koç' : 'coach'}: ${stored.coachId}` : ''}
          {stored.editedAt ? ` · ${stored.editedAt}` : ''}
        </div>
      ) : null}

      {open && edits.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
          {edits.map(e => (
            <li key={e.id} style={{
              ...S.mono, fontSize: 10, padding: '8px 10px',
              borderBottom: '1px dashed var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
              opacity: e.accepted === false ? 0.5 : 1,
            }}>
              <div style={{ flex: 1 }}>
                <div>
                  <strong style={{ color: '#9966cc' }}>{e.type}</strong>
                  <span aria-hidden="true"> · </span>
                  <code>{e.target}</code>
                  {e.type === 'phase-tss-bias' ? <span> → ×{e.next}</span> : null}
                  {e.accepted === true ? <span style={{ marginLeft: 8, color: '#28a745' }}>✓ {isTR ? 'KABUL' : 'ACCEPTED'}</span> : null}
                  {e.accepted === false ? <span style={{ marginLeft: 8, color: '#dc3545' }}>✗ {isTR ? 'RED' : 'REVERTED'}</span> : null}
                </div>
                {bil(e.note, isTR) ? (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>
                    "{bil(e.note, isTR)}"
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {e.accepted !== true ? (
                  <button type="button" onClick={() => handleAccept(e.id)}
                    style={{ ...S.mono, fontSize: 10, padding: '2px 8px', border: '1px solid #28a745', background: 'transparent', color: '#28a745', cursor: 'pointer', borderRadius: 3 }}>
                    ✓
                  </button>
                ) : null}
                {e.accepted !== false ? (
                  <button type="button" onClick={() => handleRevert(e.id)}
                    style={{ ...S.mono, fontSize: 10, padding: '2px 8px', border: '1px solid #dc3545', background: 'transparent', color: '#dc3545', cursor: 'pointer', borderRadius: 3 }}>
                    ✗
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
