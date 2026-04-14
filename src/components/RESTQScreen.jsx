// ─── RESTQScreen.jsx — RESTQ-Sport Short Form (19 items) ─────────────────────
import { useState, useCallback } from 'react'
import { S } from '../styles.js'
import { RESTQ_ITEMS, scoreRESTQ } from '../lib/sport/restq.js'

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const RED    = '#e03030'
const AMBER  = '#f5c542'

const SCALE_LABELS = ['Never', 'Almost Never', 'Rarely', 'Sometimes', 'Often', 'Very Often', 'Always']
const SCALE_LABELS_TR = ['Hiçzaman', 'Neredeyse Hiç', 'Nadiren', 'Bazen', 'Sıklıkla', 'Çok Sıklıkla', 'Her Zaman']

const INTERP_COLOR = {
  well_recovered: GREEN,
  adequate: '#0064ff',
  watch: AMBER,
  overreaching_risk: RED,
  incomplete: '#555',
}

function ScaleButton({ value, selected, onChange }) {
  return (
    <button
      onClick={() => onChange(value)}
      title={SCALE_LABELS[value]}
      style={{
        width: 28, height: 28, borderRadius: '50%',
        border: `2px solid ${selected ? ORANGE : '#333'}`,
        background: selected ? ORANGE : 'transparent',
        color: selected ? '#fff' : '#555',
        fontFamily: MONO, fontSize: '10px', fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
      }}
    >
      {value}
    </button>
  )
}

/** Group items by subscale, maintaining order */
function groupItems(items) {
  const groups = []
  const seen = {}
  for (const item of items) {
    if (!seen[item.subscale]) {
      seen[item.subscale] = { subscale: item.subscale, type: item.type, items: [] }
      groups.push(seen[item.subscale])
    }
    seen[item.subscale].items.push(item)
  }
  return groups
}

const GROUPS = groupItems(RESTQ_ITEMS)

export default function RESTQScreen({ lang = 'en', onSave }) {
  const [responses, setResponses] = useState({})
  const [result, setResult]       = useState(null)
  const [saved, setSaved]         = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const answered = Object.keys(responses).length
  const total    = RESTQ_ITEMS.length

  const setResponse = useCallback((id, val) => {
    setResponses(prev => ({ ...prev, [id]: val }))
    setResult(null)
  }, [])

  const handleScore = () => {
    const scored = scoreRESTQ(responses)
    setResult(scored)
  }

  const handleSave = () => {
    if (!result || result.interpretation === 'incomplete') return
    const today   = new Date().toISOString().slice(0, 10)
    const record  = { date: today, ...result, responses }
    try {
      const history = JSON.parse(localStorage.getItem('sporeus-restq-history') || '[]')
      history.push(record)
      localStorage.setItem('sporeus-restq-history', JSON.stringify(history))
    } catch {}
    setSaved(true)
    onSave?.(record)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleReset = () => {
    setResponses({})
    setResult(null)
    setSaved(false)
  }

  const label = (item) => lang === 'tr' ? item.text_tr : item.text_en

  return (
    <div style={{ fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>
            RESTQ-SPORT SHORT FORM
          </div>
          <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
            {lang === 'tr' ? 'Kellmann & Kallus (2001) — Son 7 günü değerlendirin (0=Hiçzaman, 6=Herzaman)' : 'Kellmann & Kallus (2001) — Rate the past 7 days (0=Never, 6=Always)'}
          </div>
        </div>
        <button onClick={() => setCollapsed(c => !c)}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px' }}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Progress */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555', marginBottom: '4px' }}>
              <span>{answered}/{total} {lang === 'tr' ? 'yanıtlandı' : 'answered'}</span>
              <span>{Math.round(answered / total * 100)}%</span>
            </div>
            <div style={{ height: '3px', background: '#1a1a1a', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${answered / total * 100}%`, background: ORANGE, borderRadius: '2px', transition: 'width 0.2s' }} />
            </div>
          </div>

          {/* Subscale groups */}
          {GROUPS.map(group => (
            <div key={group.subscale} style={{ marginBottom: '18px' }}>
              <div style={{
                fontSize: '8px', letterSpacing: '0.12em', color: group.type === 'stress' ? RED : GREEN,
                fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase',
              }}>
                {group.subscale} · {group.type === 'stress' ? (lang === 'tr' ? 'Stres' : 'Stress') : (lang === 'tr' ? 'Toparlanma' : 'Recovery')}
              </div>
              {group.items.map(item => (
                <div key={item.id} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text)', marginBottom: '6px', lineHeight: 1.4 }}>
                    {label(item)}
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {[0,1,2,3,4,5,6].map(v => (
                      <ScaleButton key={v} value={v} selected={responses[item.id] === v}
                        onChange={val => setResponse(item.id, val)} />
                    ))}
                    <span style={{ fontSize: '8px', color: '#444', marginLeft: '4px' }}>
                      {responses[item.id] != null ? (lang === 'tr' ? SCALE_LABELS_TR[responses[item.id]] : SCALE_LABELS[responses[item.id]]) : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Score button */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button onClick={handleScore} disabled={answered < 10}
              style={{ ...S.btn, opacity: answered < 10 ? 0.4 : 1, cursor: answered < 10 ? 'not-allowed' : 'pointer' }}>
              {lang === 'tr' ? '▶ SKORU HESAPLA' : '▶ CALCULATE SCORE'}
            </button>
            <button onClick={handleReset} style={{ ...S.btnSec, fontSize: '10px' }}>
              {lang === 'tr' ? '↺ SIFIRLA' : '↺ RESET'}
            </button>
          </div>

          {/* Results */}
          {result && result.interpretation !== 'incomplete' && (
            <div style={{ background: '#0a0a0a', borderRadius: '6px', padding: '16px', border: `1px solid ${INTERP_COLOR[result.interpretation]}33` }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {[
                  { lbl: lang === 'tr' ? 'STRES SKORU' : 'STRESS SCORE', val: result.overall_stress?.toFixed(1), color: RED },
                  { lbl: lang === 'tr' ? 'TOPARLANMA SKORU' : 'RECOVERY SCORE', val: result.overall_recovery?.toFixed(1), color: GREEN },
                  { lbl: 'BALANCE', val: (result.balance >= 0 ? '+' : '') + result.balance?.toFixed(1), color: INTERP_COLOR[result.interpretation] },
                ].map(({ lbl, val, color }) => (
                  <div key={lbl} style={{ flex: '1 1 90px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.08em', marginBottom: '4px' }}>{lbl}</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Visual bars */}
              {[
                { lbl: lang === 'tr' ? 'Stres' : 'Stress', val: result.overall_stress, color: RED },
                { lbl: lang === 'tr' ? 'Toparlanma' : 'Recovery', val: result.overall_recovery, color: GREEN },
              ].map(({ lbl, val, color }) => (
                <div key={lbl} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555', marginBottom: '3px' }}>
                    <span>{lbl}</span><span>{val?.toFixed(1)} / 6</span>
                  </div>
                  <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: `${(val / 6) * 100}%`, background: color, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}

              {/* Interpretation */}
              <div style={{
                marginTop: '12px', padding: '8px 12px', borderRadius: '4px',
                background: INTERP_COLOR[result.interpretation] + '14',
                border: `1px solid ${INTERP_COLOR[result.interpretation]}44`,
                fontSize: '10px', color: INTERP_COLOR[result.interpretation], lineHeight: 1.5,
              }}>
                {result.interpretationLabel?.[lang] || result.interpretationLabel?.en}
              </div>

              {/* Save */}
              <button onClick={handleSave} disabled={saved}
                style={{ marginTop: '12px', width: '100%', padding: '9px', background: saved ? '#1a1a1a' : ORANGE, color: saved ? '#5bc25b' : '#fff', border: 'none', borderRadius: '4px', fontFamily: MONO, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', cursor: saved ? 'default' : 'pointer' }}>
                {saved ? (lang === 'tr' ? '✓ KAYDEDİLDİ' : '✓ SAVED') : (lang === 'tr' ? '↓ KAYDET' : '↓ SAVE TO HISTORY')}
              </button>
            </div>
          )}

          {result?.interpretation === 'incomplete' && (
            <div style={{ fontSize: '10px', color: AMBER, padding: '8px 0' }}>
              {lang === 'tr' ? '⚠ En az 10 soruyu yanıtlayın.' : '⚠ Answer at least 10 questions to score.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
