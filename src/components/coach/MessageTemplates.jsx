// src/components/coach/MessageTemplates.jsx — E5: Coach message template manager
// Reduces daily messaging friction: store reusable templates, send with variable substitution.
// Templates saved to localStorage (sporeus-coach-templates) and optionally to coach_message_templates table.
//
// Variables: {athlete_name}, {last_session_tss}, {week_compliance}, {acwr}, {tsb}
import { useState, useContext } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { renderTemplate, TEMPLATE_VARIABLES } from '../../lib/coach/templateUtils.js'

const MONO = "'IBM Plex Mono', monospace"
const VARIABLES = TEMPLATE_VARIABLES

const DEFAULT_TEMPLATES = [
  { id: 'nice', nameEn: 'Nice session', nameTr: 'İyi antrenman', bodyEn: 'Great session today, {athlete_name}! TSS {last_session_tss} is right on target.', bodyTr: 'Bugün harika bir antrenman, {athlete_name}! {last_session_tss} TSS tam hedefe uygun.' },
  { id: 'recovery', nameEn: 'Recovery reminder', nameTr: 'Toparlanma hatırlatması', bodyEn: 'TSB is {tsb} — time to back off. Schedule a rest day tomorrow.', bodyTr: 'TSF {tsb} — geri çekilme zamanı. Yarın bir dinlenme günü planla.' },
  { id: 'check_in', nameEn: 'Weekly check-in', nameTr: 'Haftalık kontrol', bodyEn: "Hi {athlete_name}, this week's compliance was {week_compliance}%. Let's review on Sunday.", bodyTr: 'Merhaba {athlete_name}, bu haftaki uyum {week_compliance}% idi. Pazar günü inceleyelim.' },
  { id: 'acwr', nameEn: 'Load warning', nameTr: 'Yük uyarısı', bodyEn: '{athlete_name}, your ACWR is {acwr} — above the safe zone. Hold off on intensity this week.', bodyTr: '{athlete_name}, AAKÖ değerin {acwr} — güvenli bölgenin üzerinde. Bu hafta yoğunluk ekleme.' },
  { id: 'easy', nameEn: 'Easy day suggestion', nameTr: 'Kolay gün önerisi', bodyEn: 'Add a 30-min recovery session today, {athlete_name}. Keep RPE ≤ 4.', bodyTr: 'Bugün 30 dakikalık toparlanma antrenmanı ekle, {athlete_name}. SSO ≤ 4 tut.' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function MessageTemplates({ athlete, onSend }) {
  const { lang } = useContext(LangCtx)
  const [templates, setTemplates] = useLocalStorage('sporeus-coach-templates', DEFAULT_TEMPLATES)
  const [editing, setEditing] = useState(null)   // template id being edited, or 'new'
  const [draft, setDraft] = useState({ nameEn: '', nameTr: '', bodyEn: '', bodyTr: '' })
  const [expanded, setExpanded] = useState(false)

  const isEn = lang !== 'tr'

  function getName(t) { return isEn ? t.nameEn : (t.nameTr || t.nameEn) }
  function getBody(t) { return isEn ? t.bodyEn : (t.bodyTr || t.bodyEn) }

  function startEdit(t) {
    setDraft({ nameEn: t.nameEn, nameTr: t.nameTr || '', bodyEn: t.bodyEn, bodyTr: t.bodyTr || '' })
    setEditing(t.id)
  }

  function startNew() {
    setDraft({ nameEn: '', nameTr: '', bodyEn: '', bodyTr: '' })
    setEditing('new')
  }

  function saveEdit() {
    if (!draft.nameEn.trim() || !draft.bodyEn.trim()) return
    if (editing === 'new') {
      const id = `custom-${Date.now()}`
      setTemplates(ts => [...ts, { id, ...draft }])
    } else {
      setTemplates(ts => ts.map(t => t.id === editing ? { ...t, ...draft } : t))
    }
    setEditing(null)
  }

  function deleteTemplate(id) {
    setTemplates(ts => ts.filter(t => t.id !== id))
  }

  function handleSend(t) {
    const body = renderTemplate(getBody(t), {
      name: athlete?.name,
      lastSessionTSS: athlete?.lastSessionTSS,
      weekCompliance: athlete?.weekCompliance,
      acwr: athlete?.acwr,
      tsb: athlete?.tsb,
    })
    onSend?.(body, t)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{ ...S.btnSec, fontSize: '10px', padding: '6px 12px' }}
      >
        {isEn ? '◈ Templates' : '◈ Şablonlar'}
      </button>
    )
  }

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px', marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.08em' }}>
          {isEn ? 'MESSAGE TEMPLATES' : 'MESAJ ŞABLONLARI'}
        </span>
        <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</button>
      </div>

      {/* Template list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {templates.map(t => (
          <div key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 700, color: '#888', letterSpacing: '0.06em', marginBottom: 3 }}>
                {getName(t)}
              </div>
              <div style={{ fontFamily: MONO, fontSize: '10px', color: 'var(--text)', lineHeight: 1.5 }}>
                {renderTemplate(getBody(t), athlete ? { name: athlete.name, lastSessionTSS: athlete.lastSessionTSS, weekCompliance: athlete.weekCompliance, acwr: athlete.acwr, tsb: athlete.tsb } : {})}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {onSend && athlete && (
                <button onClick={() => handleSend(t)} style={{ ...S.btn, fontSize: '9px', padding: '5px 8px', minHeight: 'unset' }}>
                  {isEn ? 'Send' : 'Gönder'}
                </button>
              )}
              <button onClick={() => startEdit(t)} style={{ ...S.btnSec, fontSize: '9px', padding: '4px 8px', minHeight: 'unset' }}>
                ✎
              </button>
              <button onClick={() => deleteTemplate(t.id)} style={{ background: 'none', border: '1px solid #333', borderRadius: 3, color: '#555', fontSize: '9px', padding: '4px 8px', cursor: 'pointer', fontFamily: MONO }}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / new form */}
      {editing ? (
        <div style={{ background: 'var(--surface)', borderRadius: 4, padding: '10px 12px', border: '1px solid #444' }}>
          <div style={{ fontFamily: MONO, fontSize: '9px', color: '#ff6600', marginBottom: 8, fontWeight: 700 }}>
            {editing === 'new' ? (isEn ? 'NEW TEMPLATE' : 'YENİ ŞABLON') : (isEn ? 'EDIT TEMPLATE' : 'ŞABLONU DÜZENLE')}
          </div>
          {[
            { field: 'nameEn', label: 'Name (EN)' },
            { field: 'nameTr', label: 'Name (TR)' },
            { field: 'bodyEn', label: `Body (EN) — use ${VARIABLES.join(', ')}` },
            { field: 'bodyTr', label: 'Body (TR)' },
          ].map(({ field, label }) => (
            <div key={field} style={{ marginBottom: 8 }}>
              <label style={{ ...S.label, fontSize: '9px' }}>{label}</label>
              <textarea
                value={draft[field]}
                onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
                rows={field.startsWith('body') ? 2 : 1}
                style={{ ...S.input, resize: 'vertical', fontSize: 'max(16px, 11px)' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveEdit} style={{ ...S.btn, fontSize: '10px', padding: '7px 14px' }}>
              {isEn ? 'Save' : 'Kaydet'}
            </button>
            <button onClick={() => setEditing(null)} style={{ ...S.btnSec, fontSize: '10px', padding: '6px 14px' }}>
              {isEn ? 'Cancel' : 'İptal'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={startNew} style={{ ...S.btnSec, fontSize: '9px', padding: '6px 12px', marginTop: 4 }}>
          + {isEn ? 'New template' : 'Yeni şablon'}
        </button>
      )}
    </div>
  )
}
