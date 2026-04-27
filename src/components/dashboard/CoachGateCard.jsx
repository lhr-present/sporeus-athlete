// src/components/dashboard/CoachGateCard.jsx — E93
// Mandatory plan-status gate — always rendered above training cards.
// HARDCODED RULE: training cards stay hidden until plan is CONFIRMED or ACTIVE.
import { useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import {
  LS_KEY, STATUS, activatePlan, isPlanConfirmed, statusColor,
} from '../../lib/athlete/coachConfirmFlow.js'
import { PROGRAMS } from '../../lib/athlete/trainingPrograms.js'
import { S } from '../../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const BLUE   = '#4a90d9'
const DIM    = '#444'

export default function CoachGateCard({ isTR }) {
  const [confirmRecord, setConfirmRecord] = useLocalStorage(LS_KEY, null)
  const today = new Date().toISOString().slice(0, 10)

  const prog   = confirmRecord?.programId ? PROGRAMS[confirmRecord.programId] : null
  const status = confirmRecord?.status || STATUS.NONE

  const weekNum = useMemo(() => {
    if (status !== STATUS.ACTIVE || !confirmRecord?.planStart) return null
    const diff = Math.floor(
      (Date.parse(today) - Date.parse(confirmRecord.planStart)) / (7 * 86400 * 1000)
    )
    return Math.min(Math.max(1, diff + 1), prog?.weeks || 999)
  }, [status, confirmRecord?.planStart, prog?.weeks, today])

  function handleActivate() {
    if (!confirmRecord) return
    setConfirmRecord(activatePlan(confirmRecord))
  }

  const progName = prog ? (isTR ? prog.nameTR : prog.name) : (confirmRecord?.programId || '')

  // ── ACTIVE ────────────────────────────────────────────────────────────────────
  if (status === STATUS.ACTIVE) {
    return (
      <div style={{ ...S.card, fontFamily: MONO, borderLeft: `3px solid ${GREEN}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em', marginBottom: '4px' }}>
              ◈ {isTR ? 'AKTİF PLAN' : 'ACTIVE PLAN'}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: GREEN }}>{progName}</div>
            {confirmRecord?.coachName && (
              <div style={{ fontSize: '8px', color: DIM, marginTop: '3px' }}>
                {isTR ? 'Koç: ' : 'Coach: '}{confirmRecord.coachName}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: GREEN, lineHeight: 1 }}>{weekNum}</div>
            <div style={{ fontSize: '8px', color: DIM }}>/ {prog?.weeks || '?'} {isTR ? 'HAFTA' : 'WK'}</div>
          </div>
        </div>
      </div>
    )
  }

  // ── CONFIRMED / MODIFIED ──────────────────────────────────────────────────────
  if (status === STATUS.CONFIRMED || status === STATUS.MODIFIED) {
    const modCount = Object.keys(confirmRecord?.modifiedWeeks || {}).length
    return (
      <div style={{ ...S.card, fontFamily: MONO, borderLeft: `3px solid ${GREEN}` }}>
        <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em', marginBottom: '8px' }}>
          ◈ {isTR ? 'PLAN ONAYLANDI' : 'PLAN CONFIRMED'}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: GREEN, marginBottom: '6px' }}>{progName}</div>
        {confirmRecord?.coachName && (
          <div style={{ fontSize: '8px', color: DIM, marginBottom: '3px' }}>
            {isTR ? 'Koç: ' : 'Coach: '}{confirmRecord.coachName}
          </div>
        )}
        {confirmRecord?.coachNotes && (
          <div style={{ fontSize: '8px', color: AMBER, padding: '4px 6px', background: '#1a1200', borderRadius: '2px', marginBottom: '6px', lineHeight: 1.5 }}>
            "{confirmRecord.coachNotes}"
          </div>
        )}
        {modCount > 0 && (
          <div style={{ fontSize: '8px', color: AMBER, marginBottom: '6px' }}>
            ◈ {modCount} {isTR ? 'hafta koç tarafından düzenlendi' : `week${modCount > 1 ? 's' : ''} modified by coach`}
          </div>
        )}
        {confirmRecord?.planStart && (
          <div style={{ fontSize: '8px', color: DIM, marginBottom: '10px' }}>
            {isTR ? 'Başlangıç: ' : 'Plan start: '}{confirmRecord.planStart}
          </div>
        )}
        <button
          onClick={handleActivate}
          style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: '3px', padding: '8px 16px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', fontFamily: MONO, width: '100%' }}>
          {isTR ? 'Plana Başla →' : 'Start Plan →'}
        </button>
        <div style={{ fontSize: '8px', color: DIM, marginTop: '6px', textAlign: 'center' }}>
          {isTR ? 'Başlatınca antrenman planı görünür hale gelir.' : 'This unlocks your training plan cards.'}
        </div>
      </div>
    )
  }

  // ── PENDING ───────────────────────────────────────────────────────────────────
  if (status === STATUS.PENDING) {
    return (
      <div style={{ ...S.card, fontFamily: MONO, borderLeft: `3px solid ${AMBER}` }}>
        <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em', marginBottom: '8px' }}>
          ◈ {isTR ? 'KOÇ ONAYI BEKLENİYOR' : 'AWAITING COACH REVIEW'}
        </div>
        <div style={{ fontSize: '10px', color: AMBER, marginBottom: '4px' }}>⏳ {progName}</div>
        {confirmRecord?.submittedAt && (
          <div style={{ fontSize: '8px', color: DIM, marginBottom: '8px' }}>
            {isTR ? 'Gönderildi: ' : 'Submitted: '}{confirmRecord.submittedAt}
          </div>
        )}
        <div style={{ fontSize: '8px', color: '#555', lineHeight: 1.6, padding: '6px 8px', background: '#0d0d0d', borderRadius: '3px' }}>
          {isTR
            ? 'Koçun planı inceleyip onaylaması bekleniyor. Onay sonrası antrenman planın açılacak.'
            : 'Waiting for your coach to review and confirm. Training cards unlock after confirmation.'}
        </div>
      </div>
    )
  }

  // ── DRAFT ────────────────────────────────────────────────────────────────────
  if (status === STATUS.DRAFT) {
    return (
      <div style={{ ...S.card, fontFamily: MONO, borderLeft: `3px solid ${BLUE}` }}>
        <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em', marginBottom: '8px' }}>
          ◈ {isTR ? 'TASLAK — GÖNDERİLMEDİ' : 'DRAFT — NOT SUBMITTED'}
        </div>
        <div style={{ fontSize: '10px', color: BLUE, marginBottom: '8px' }}>{progName}</div>
        <div style={{ fontSize: '8px', color: '#555', lineHeight: 1.6 }}>
          {isTR
            ? 'Program seçildi ama koç onayına gönderilmedi. Yukarıdaki Program Seç kartından gönder.'
            : 'Program selected but not yet submitted for review. Use the Program Selector card above to submit.'}
        </div>
      </div>
    )
  }

  // ── NONE / null — no program yet ─────────────────────────────────────────────
  return (
    <div style={{ ...S.card, fontFamily: MONO, borderLeft: `3px solid ${DIM}` }}>
      <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em', marginBottom: '8px' }}>
        ◈ {isTR ? 'ANTRENMAN PLANI' : 'TRAINING PLAN'}
      </div>
      <div style={{ fontSize: '8px', color: '#2a2a2a', lineHeight: 1.6 }}>
        {isTR
          ? 'Henüz program seçilmedi. Yukarıdaki Program Seç kartından hedefine uygun bir plan seç.'
          : 'No program selected yet. Use the Program Selector card above to choose a plan that matches your goal.'}
      </div>
    </div>
  )
}
