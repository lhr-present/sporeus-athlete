// src/components/RTPProtocol.jsx — 5-stage Return-to-Play protocol tracker
// Standard sport medicine RTP ladder (McCrory et al. 2013 / consensus)
import { useState } from 'react'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const BLUE   = '#0064ff'
const GREY   = '#555'
const RED    = '#e03030'

const STAGES = [
  { label: 'COMPLETE REST',      desc: 'Symptom-free rest. No loading.' },
  { label: 'LIGHT AEROBIC',      desc: 'Walking, easy cycling. No sport-specific.' },
  { label: 'SPORT-SPECIFIC',     desc: 'Running drills, sport movements. No contact.' },
  { label: 'NON-CONTACT DRILLS', desc: 'Complex drills, resistance training.' },
  { label: 'FULL PRACTICE',      desc: 'Normal training. Contact OK. Medical clearance recommended.' },
]
const STAGES_TR = [
  { label: 'TAM DİNLENME',       desc: 'Belirtisiz dinlenme. Yük yok.' },
  { label: 'HAFİF AEROBİK',      desc: 'Yürüyüş, hafif bisiklet. Spora özel değil.' },
  { label: 'SPORA ÖZEL',         desc: 'Koşu drilleri, hareketler. Temas yok.' },
  { label: 'TEMASSIZ DRILL',     desc: 'Karmaşık drilleri, kuvvet antrenmanı.' },
  { label: 'TAM ANTRENMAN',      desc: 'Normal antrenman. Temas tamam. Sağlık onayı önerilir.' },
]

const BODY_ZONES = [
  'Head / Neck', 'Shoulder', 'Elbow / Wrist', 'Chest / Upper Back',
  'Abdomen / Lower Back', 'Hip / Groin', 'Thigh / Hamstring',
  'Knee', 'Calf / Shin', 'Ankle / Foot',
]

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000)
}

function stageColor(stage) {
  if (stage === 0) return RED
  if (stage === 4) return GREEN
  if (stage === 5) return GREEN
  return ORANGE
}

export default function RTPProtocol() {
  const [lang]      = useLocalStorage('sporeus-lang', 'en')
  const [protocols, setProtocols] = useLocalStorage('sporeus-rtp', [])
  const [expanded,  setExpanded]  = useState(false)
  const [creating,  setCreating]  = useState(false)
  const [newZone,   setNewZone]   = useState(BODY_ZONES[0])

  const stages    = lang === 'tr' ? STAGES_TR : STAGES
  const today     = new Date().toISOString().slice(0, 10)
  const active    = protocols.filter(p => !p.completed)
  const completed = protocols.filter(p => p.completed)

  function createProtocol() {
    const p = {
      id: Date.now(),
      zone: newZone,
      startDate: today,
      stage: 0,
      stageDate: today,
      completed: false,
    }
    setProtocols([...protocols, p])
    setCreating(false)
  }

  function updateStage(id, delta) {
    setProtocols(protocols.map(p => {
      if (p.id !== id) return p
      const next = Math.max(0, Math.min(4, p.stage + delta))
      return { ...p, stage: next, stageDate: today }
    }))
  }

  function completeProtocol(id) {
    setProtocols(protocols.map(p =>
      p.id === id ? { ...p, stage: 5, completed: true, completedDate: today } : p
    ))
  }

  function deleteProtocol(id) {
    setProtocols(protocols.filter(p => p.id !== id))
  }

  const lbl = {
    en: {
      title: 'RETURN TO PLAY',
      newBtn: '+ NEW RTP PROTOCOL',
      zone: 'INJURY ZONE',
      createBtn: 'START PROTOCOL',
      cancel: 'CANCEL',
      daysAt: 'days at this stage',
      daysSince: 'days since start',
      advance: '→ ADVANCE',
      back: '← BACK',
      complete: '✓ RETURN TO SPORT',
      delete: '× REMOVE',
      completedTitle: 'COMPLETED',
      guideline: 'Spend ≥ 24h symptom-free at each stage before advancing.',
      noActive: 'No active RTP protocols.',
    },
    tr: {
      title: 'SPORA DÖNÜŞ',
      newBtn: '+ YENİ PROTOKOL',
      zone: 'YARALANMA BÖLGESİ',
      createBtn: 'PROTOKOL BAŞLAT',
      cancel: 'İPTAL',
      daysAt: 'gün bu aşamada',
      daysSince: 'toplam gün',
      advance: '→ İLERLE',
      back: '← GERİ',
      complete: '✓ SPORA DÖN',
      delete: '× SİL',
      completedTitle: 'TAMAMLANDI',
      guideline: 'Her aşamada belirtisiz ≥ 24 saat geçirdikten sonra ilerleyin.',
      noActive: 'Aktif RTP protokolü yok.',
    },
  }
  const L = lbl[lang] || lbl.en

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
          {L.title}
          {active.length > 0 && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: ORANGE, border: `1px solid ${ORANGE}55`, borderRadius: 2, padding: '1px 5px' }}>
              {active.length} ACTIVE
            </span>
          )}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          {/* Guideline */}
          <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 12, lineHeight: 1.5 }}>
            {L.guideline}
          </div>

          {/* Active protocols */}
          {active.length === 0 && !creating && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#444', marginBottom: 12 }}>
              {L.noActive}
            </div>
          )}

          {active.map(p => {
            const daysAtStage = daysBetween(p.stageDate, today)
            const daysTotal   = daysBetween(p.startDate, today)
            const pStages     = stages
            const color       = stageColor(p.stage)
            return (
              <div key={p.id} style={{
                background: 'var(--surface)', border: `1px solid #2a2a2a`,
                borderLeft: `3px solid ${color}`, borderRadius: 4, padding: '12px 14px', marginBottom: 10,
              }}>
                {/* Zone + days */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color, marginBottom: 2 }}>
                      {p.zone.toUpperCase()}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: GREY }}>
                      {daysAtStage} {L.daysAt} · {daysTotal} {L.daysSince}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteProtocol(p.id)}
                    style={{ fontFamily: MONO, fontSize: 9, background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 0 }}
                  >
                    {L.delete}
                  </button>
                </div>

                {/* Stage progress bar */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                  {pStages.map((st, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1, height: 5, borderRadius: 2,
                        background: i <= p.stage ? color : '#222',
                        transition: 'background 0.2s',
                      }}
                    />
                  ))}
                </div>

                {/* Stage label + desc */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color, marginBottom: 2 }}>
                    {lang === 'tr' ? 'AŞAMA' : 'STAGE'} {p.stage + 1}/5 — {pStages[p.stage]?.label}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: '#888', lineHeight: 1.4 }}>
                    {pStages[p.stage]?.desc}
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.stage > 0 && (
                    <button
                      onClick={() => updateStage(p.id, -1)}
                      style={{ fontFamily: MONO, fontSize: 9, padding: '4px 10px', background: 'none', border: '1px solid #333', borderRadius: 2, color: '#666', cursor: 'pointer' }}
                    >
                      {L.back}
                    </button>
                  )}
                  {p.stage < 4 && (
                    <button
                      onClick={() => updateStage(p.id, 1)}
                      style={{ fontFamily: MONO, fontSize: 9, padding: '4px 10px', background: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 2, color: '#111', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {L.advance}
                    </button>
                  )}
                  {p.stage === 4 && (
                    <button
                      onClick={() => completeProtocol(p.id)}
                      style={{ fontFamily: MONO, fontSize: 9, padding: '4px 12px', background: GREEN, border: `1px solid ${GREEN}`, borderRadius: 2, color: '#111', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {L.complete}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* New protocol form */}
          {creating ? (
            <div style={{ background: 'var(--surface)', border: '1px solid #2a2a2a', borderRadius: 4, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: ORANGE, marginBottom: 10, letterSpacing: '0.08em' }}>
                {L.newBtn}
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 6 }}>{L.zone}</div>
                <select
                  value={newZone}
                  onChange={e => setNewZone(e.target.value)}
                  style={{ ...S.input, fontFamily: MONO, fontSize: 11 }}
                >
                  {BODY_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createProtocol} style={{ ...S.btn, fontSize: 10, padding: '6px 14px' }}>{L.createBtn}</button>
                <button onClick={() => setCreating(false)} style={{ ...S.btnSec, fontSize: 10, padding: '6px 14px' }}>{L.cancel}</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                padding: '5px 12px', background: 'transparent',
                border: '1px solid #333', borderRadius: 2, color: GREY, cursor: 'pointer', marginBottom: 10,
              }}
            >
              {L.newBtn}
            </button>
          )}

          {/* Completed protocols */}
          {completed.length > 0 && (
            <div style={{ borderTop: '1px solid #222', paddingTop: 10, marginTop: 6 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 8, letterSpacing: '0.08em' }}>
                {L.completedTitle} ({completed.length})
              </div>
              {completed.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #1a1a1a' }}>
                  <div>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN }}>✓ {p.zone}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginLeft: 8 }}>{p.startDate} → {p.completedDate}</span>
                  </div>
                  <button
                    onClick={() => deleteProtocol(p.id)}
                    style={{ fontFamily: MONO, fontSize: 9, background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
