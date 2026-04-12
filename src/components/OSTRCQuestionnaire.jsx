// src/components/OSTRCQuestionnaire.jsx — IOC OSTRC-Q2 weekly injury surveillance
// Clarsen et al. (2020), 4 questions × 0–25, total 0–100. Weekly gate.
import { useState } from 'react'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { ostrcScore, ostrcRisk, isoWeekKey } from '../lib/ostrc.js'

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const YELLOW = '#f5c542'
const RED    = '#e03030'
const GREY   = '#555'

const Q_EN = [
  'Difficulties participating in normal training or competition due to injury or illness?',
  'To what extent have you reduced your training volume?',
  'To what extent has injury or illness affected your sport performance?',
  'To what extent have you experienced symptoms?',
]
const Q_TR = [
  'Sakatlık veya hastalık nedeniyle normal antrenman ya da yarışa katılımda zorluk?',
  'Antrenman hacminizi ne ölçüde azalttınız?',
  'Sakatlık veya hastalık performansınızı ne ölçüde etkiledi?',
  'Ne ölçüde belirti ya da ağrı yaşadınız?',
]

const OPTS_EN = [
  { v: 0,  l: 'Full / None'  },
  { v: 6,  l: 'Minor'        },
  { v: 13, l: 'Moderate'     },
  { v: 19, l: 'Severe'       },
  { v: 25, l: 'Unable'       },
]
const OPTS_TR = [
  { v: 0,  l: 'Tam / Yok'        },
  { v: 6,  l: 'Hafif'            },
  { v: 13, l: 'Orta'             },
  { v: 19, l: 'Şiddetli'         },
  { v: 25, l: 'Katılamıyorum'    },
]

const RISK_META = {
  none:        { color: GREEN,  en: 'NO PROBLEM',    tr: 'SORUN YOK'    },
  minor:       { color: YELLOW, en: 'MINOR',         tr: 'HAFİF'        },
  moderate:    { color: ORANGE, en: 'MODERATE',      tr: 'ORTA'         },
  substantial: { color: RED,    en: 'SUBSTANTIAL',   tr: 'CİDDİ'        },
}

export default function OSTRCQuestionnaire() {
  const [lang]      = useLocalStorage('sporeus-lang', 'en')
  const [responses, setResponses] = useLocalStorage('sporeus-ostrc', [])
  const [expanded,  setExpanded]  = useState(false)
  const [answers,   setAnswers]   = useState([null, null, null, null])
  const [submitted, setSubmitted] = useState(false)

  const thisWeek = isoWeekKey()
  const thisResp = responses.find(r => r.week === thisWeek)
  const questions = lang === 'tr' ? Q_TR : Q_EN
  const opts      = lang === 'tr' ? OPTS_TR : OPTS_EN
  const last8     = [...responses].sort((a, b) => a.week > b.week ? 1 : -1).slice(-8)

  function setAnswer(qi, val) {
    setAnswers(prev => { const a = [...prev]; a[qi] = val; return a })
    setSubmitted(false)
  }

  function submit() {
    const filled = answers.filter(a => a !== null)
    if (filled.length < 4) return
    const total = ostrcScore(answers)
    const entry = {
      week: thisWeek,
      date: new Date().toISOString().slice(0, 10),
      answers: [...answers],
      total,
    }
    setResponses([...responses.filter(r => r.week !== thisWeek), entry])
    setSubmitted(true)
  }

  function riskMeta(score) {
    return RISK_META[ostrcRisk(score)] || RISK_META.none
  }

  const allAnswered = answers.every(a => a !== null)

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(x => !x)}
        style={{
          fontFamily: MONO, width: '100%', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: 0, color: 'var(--text)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          OSTRC MONITORING
          <span style={{ fontFamily: MONO, fontSize: 8, color: ORANGE, border: `1px solid ${ORANGE}55`, borderRadius: 2, padding: '1px 5px', letterSpacing: '0.08em' }}>
            IOC-Q2
          </span>
          {thisResp && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: riskMeta(thisResp.total).color, border: `1px solid ${riskMeta(thisResp.total).color}55`, borderRadius: 2, padding: '1px 5px' }}>
              {thisResp.total}/100
            </span>
          )}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          {/* This week already done */}
          {thisResp && !submitted && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                padding: '10px 14px', borderRadius: 4,
                background: `${riskMeta(thisResp.total).color}11`,
                border: `1px solid ${riskMeta(thisResp.total).color}44`,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 2 }}>
                    {thisResp.week} · {lang === 'tr' ? 'bu hafta tamamlandı' : 'this week complete'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: riskMeta(thisResp.total).color, lineHeight: 1 }}>
                    {thisResp.total}
                    <span style={{ fontSize: 10, marginLeft: 4, fontWeight: 400 }}>/100</span>
                  </div>
                </div>
                <span style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  color: riskMeta(thisResp.total).color,
                  padding: '4px 10px', border: `1px solid ${riskMeta(thisResp.total).color}55`, borderRadius: 3,
                }}>
                  {lang === 'tr' ? riskMeta(thisResp.total).tr : riskMeta(thisResp.total).en}
                </span>
              </div>

              {/* Coach flag if substantial */}
              {thisResp.total > 50 && (
                <div style={{ fontFamily: MONO, fontSize: 10, color: RED, marginTop: 8, padding: '6px 10px', background: '#e0303011', borderRadius: 3 }}>
                  ⚠ {lang === 'tr' ? 'Antrenörünüze bildirin — ciddi yük sorunu var.' : 'Flag to your coach — substantial health problem detected.'}
                </div>
              )}
            </div>
          )}

          {/* Success flash after fresh submission */}
          {submitted && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN, marginBottom: 12 }}>
              ✓ {lang === 'tr' ? 'Kaydedildi.' : 'Saved.'}
            </div>
          )}

          {/* Question form — show even if done, to allow correction */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 10, letterSpacing: '0.08em' }}>
              {thisResp
                ? (lang === 'tr' ? 'GÜNCELLE:' : 'UPDATE THIS WEEK:')
                : (lang === 'tr' ? 'BU HAFTA OSTRC:' : 'THIS WEEK\'S CHECK:')}
            </div>
            {questions.map((q, qi) => (
              <div key={qi} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: '#bbb', marginBottom: 6, lineHeight: 1.4 }}>
                  <span style={{ color: ORANGE }}>{qi + 1}.</span> {q}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {opts.map(o => {
                    const sel = answers[qi] === o.v
                    return (
                      <button
                        key={o.v}
                        onClick={() => setAnswer(qi, o.v)}
                        style={{
                          fontFamily: MONO, fontSize: 9, cursor: 'pointer',
                          padding: '4px 10px', borderRadius: 2,
                          background: sel ? ORANGE : 'transparent',
                          border: `1px solid ${sel ? ORANGE : '#333'}`,
                          color: sel ? '#111' : '#888',
                          fontWeight: sel ? 700 : 400,
                          transition: 'all 0.1s',
                        }}
                      >
                        {o.v} — {o.l}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <button
              onClick={submit}
              disabled={!allAnswered}
              style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                padding: '7px 16px', borderRadius: 3, cursor: allAnswered ? 'pointer' : 'not-allowed',
                background: allAnswered ? ORANGE : 'transparent',
                border: `1px solid ${allAnswered ? ORANGE : '#333'}`,
                color: allAnswered ? '#111' : '#444',
                marginTop: 4,
              }}
            >
              {lang === 'tr' ? 'KAYDET' : 'SUBMIT'}
            </button>
          </div>

          {/* 8-week history */}
          {last8.length > 0 && (
            <div style={{ borderTop: '1px solid #222', paddingTop: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 8, letterSpacing: '0.08em' }}>
                {lang === 'tr' ? 'GEÇMİŞ (8 HAFTA)' : '8-WEEK HISTORY'}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {last8.map(r => {
                  const meta = riskMeta(r.total)
                  const h = Math.max(12, Math.round(r.total / 100 * 40))
                  return (
                    <div key={r.week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: meta.color }}>{r.total}</span>
                      <div style={{ width: 14, height: h, background: meta.color, borderRadius: 2, opacity: 0.7 }} />
                      <span style={{ fontFamily: MONO, fontSize: 7, color: GREY }}>
                        {r.week.slice(-3)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: '#444', marginTop: 8 }}>
                0 = {lang === 'tr' ? 'sorun yok' : 'no problem'} · 100 = {lang === 'tr' ? 'katılamıyor' : 'unable to participate'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
