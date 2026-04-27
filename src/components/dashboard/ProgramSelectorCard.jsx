// src/components/dashboard/ProgramSelectorCard.jsx — E92
// Browse curated static programs matched to athlete's current VDOT and goal distance.
// Submits selected program for coach review (or self-confirms in solo mode).
// HARDCODED RULE: every plan must pass through this card before becoming active.
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { PROGRAMS } from '../../lib/athlete/trainingPrograms.js'
import { detectVdotFromLog } from '../../lib/athlete/vdotTracker.js'
import { analyzeRaceGoal, parseMmSs } from '../../lib/athlete/raceGoalEngine.js'
import {
  LS_KEY, STATUS, createDraft, submitForReview, isPlanConfirmed,
} from '../../lib/athlete/coachConfirmFlow.js'
import { S } from '../../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const BLUE   = '#4a90d9'
const DIM    = '#444'
const DIMMER = '#2a2a2a'

const DIST_LABEL = { 5000:'5K', 10000:'10K', 21097:'HM', 42195:'Marathon' }

function programScore(prog, vdot, goalDistM) {
  // Higher = better match. 0 = incompatible.
  if (goalDistM && prog.distanceM !== goalDistM) return 0
  if (vdot < prog.vdotMin - 3 || vdot > prog.vdotMax + 3) return 0
  // Perfect VDOT fit
  const midVdot = (prog.vdotMin + prog.vdotMax) / 2
  return 100 - Math.abs(vdot - midVdot)
}

export default function ProgramSelectorCard({ log = [], profile = {}, isTR }) {
  const [saved]           = useLocalStorage('sporeus-race-goal-v2', null)
  const [confirmRecord, setConfirmRecord] = useLocalStorage(LS_KEY, null)
  const [selected, setSelected] = useState(null)
  const [showDetail, setShowDetail] = useState(null)

  const today    = new Date().toISOString().slice(0, 10)
  const myCoach  = profile?.coachId || null
  const isSolo   = !myCoach

  const detectedVdot = useMemo(() => detectVdotFromLog(log, 90, today)?.vdot || 0, [log, today])

  const analysis = useMemo(() => {
    if (!saved) return null
    const cSec = parseMmSs(saved.currentTime)
    const gSec = parseMmSs(saved.goalTime)
    return analyzeRaceGoal(cSec, gSec, saved.distM || 10000, profile, log)
  }, [saved, profile, log])

  const currentVdot  = analysis?.currentVdot || detectedVdot
  const goalDistM    = saved?.distM || null

  const matches = useMemo(() => {
    if (!currentVdot) return []
    return Object.values(PROGRAMS)
      .map(p => ({ ...p, score: programScore(p, currentVdot, goalDistM) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [currentVdot, goalDistM])

  // Already confirmed — show compact status only
  if (isPlanConfirmed(confirmRecord)) return null

  if (!currentVdot) return (
    <div style={{ ...S.card, fontFamily: MONO }}>
      <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em', marginBottom: '8px' }}>◈ {isTR ? 'PROGRAM SEÇ' : 'SELECT PROGRAM'}</div>
      <div style={{ fontSize: '9px', color: DIMMER }}>
        {isTR ? 'Program önermek için VDOT verisi gerekli. Koşu günlüğüne mesafeli antrenman ekle veya Yarış Hedefi belirle.' : 'VDOT data needed to suggest programs. Log a run with distance, or set a Race Goal.'}
      </div>
    </div>
  )

  function handleSelectProgram(prog) {
    setSelected(prog.id === selected ? null : prog.id)
  }

  function handleSubmit() {
    if (!selected) return
    const prog = PROGRAMS[selected]
    if (!prog) return
    const planStart = saved?.planStart || today
    const draft = createDraft(selected, planStart)
    const submitted = submitForReview(draft, isSolo)
    setConfirmRecord(submitted)
  }

  const selectedProg = selected ? PROGRAMS[selected] : null

  return (
    <div style={{ ...S.card, fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em' }}>
          ◈ {isTR ? 'ANTRENMAN PROGRAMI SEÇ' : 'SELECT TRAINING PROGRAM'}
        </div>
        <div style={{ fontSize: '8px', color: DIMMER }}>VDOT {currentVdot}</div>
      </div>

      {/* Coach gate notice */}
      <div style={{ fontSize: '8px', color: AMBER, padding: '5px 8px', background: '#1a1200', borderRadius: '3px', borderLeft: `2px solid ${AMBER}`, marginBottom: '12px', lineHeight: 1.5 }}>
        {isTR
          ? isSolo
            ? '▲ Program başlamadan önce kendin inceleyip onaylamalısın (koç atanmamış).'
            : '▲ Program koç onayı olmadan aktifleşmez — ZORUNLU KURAL.'
          : isSolo
            ? '▲ You must self-review and confirm before the plan activates (no coach assigned).'
            : '▲ Plan cannot activate without coach confirmation — HARDCODED RULE.'}
      </div>

      {/* Program list */}
      {matches.length === 0 ? (
        <div style={{ fontSize: '9px', color: DIMMER }}>
          {isTR ? 'VDOT aralığına uygun program bulunamadı.' : 'No programs match your current VDOT range.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {matches.map(prog => {
            const isSelected = selected === prog.id
            const isExpanded = showDetail === prog.id
            return (
              <div key={prog.id}
                style={{
                  background: isSelected ? '#1a1a1a' : '#0a0a0a',
                  border: `1px solid ${isSelected ? ORANGE : '#1a1a1a'}`,
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                {/* Program row */}
                <div
                  onClick={() => handleSelectProgram(prog)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: isSelected ? ORANGE : '#aaa' }}>
                      {isTR ? prog.nameTR : prog.name}
                    </div>
                    <div style={{ fontSize: '8px', color: DIM, marginTop: '2px' }}>
                      {DIST_LABEL[prog.distanceM] || prog.distanceM/1000+'K'} · {prog.weeks} {isTR ? 'Hafta' : 'Weeks'} · VDOT {prog.vdotMin}–{prog.vdotMax}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {isSelected && <span style={{ fontSize: '8px', color: GREEN }}>✓</span>}
                    <button
                      onClick={e => { e.stopPropagation(); setShowDetail(isExpanded ? null : prog.id) }}
                      style={{ background: 'none', border: `1px solid ${DIM}`, color: DIM, borderRadius: '3px', padding: '2px 6px', fontSize: '7px', cursor: 'pointer', letterSpacing: '0.05em' }}>
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded description */}
                {isExpanded && (
                  <div style={{ padding: '8px 10px', borderTop: `1px solid #1a1a1a`, background: '#0d0d0d' }}>
                    <div style={{ fontSize: '8px', color: '#666', lineHeight: 1.6, marginBottom: '6px' }}>
                      {isTR ? prog.descTR : prog.descEN}
                    </div>
                    {prog.coachNote && (
                      <div style={{ fontSize: '8px', color: AMBER, lineHeight: 1.5, padding: '4px 6px', background: '#1a1200', borderRadius: '2px' }}>
                        ◈ {isTR ? 'Koç notu: ' : 'Coach note: '}{prog.coachNote}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Submit button */}
      {selected && (
        <div>
          <div style={{ fontSize: '8px', color: DIMMER, marginBottom: '8px' }}>
            {isTR
              ? `"${PROGRAMS[selected]?.nameTR}" seçildi. ${isSolo ? 'İnceleyip onaylamak' : 'Koç onayına göndermek'} için tıkla.`
              : `"${PROGRAMS[selected]?.name}" selected. Click to ${isSolo ? 'self-review and confirm' : 'submit for coach review'}.`}
          </div>
          <button
            onClick={handleSubmit}
            style={{ background: isSolo ? BLUE : ORANGE, color: '#fff', border: 'none', borderRadius: '3px', padding: '8px 16px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', fontFamily: MONO, width: '100%' }}>
            {isTR
              ? isSolo ? 'İncele ve Onayla →' : 'Koç Onayına Gönder →'
              : isSolo ? 'Self-Review & Confirm →' : 'Submit for Coach Review →'}
          </button>
        </div>
      )}
    </div>
  )
}
