// ─── CyclePhaseCard.jsx — Standalone cycle-phase forecast (v9.187.0) ────────
//
// v9.182.0 introduced `CyclePhaseBlock` inside `EliteProgramCard`, which
// only surfaces when the athlete has an active elite program. Most
// athletes (newcomers; athletes doing free training; athletes between
// programs) won't see cycle guidance at all under that surface.
//
// This card renders the same gate output (`buildCyclePhaseGate`) as a
// standalone dashboard card so cycle-aware athletes get phase context
// in the daily flow regardless of program state.
//
// Privacy contract is identical: `isCycleGateAvailable(profile)` returns
// false → this card returns null. Non-female / non-opted-in athletes
// see NO cycle UI anywhere.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  buildCyclePhaseGate,
  isCycleGateAvailable,
} from '../../lib/athlete/cyclePhaseGate.js'

const MONO = "'IBM Plex Mono', monospace"

const CYCLE_PHASE_LABEL = {
  menstruation: { en: 'Menstruation', tr: 'Adet' },
  follicular:   { en: 'Follicular',   tr: 'Foliküler' },
  ovulation:    { en: 'Ovulation',    tr: 'Ovülasyon' },
  luteal:       { en: 'Luteal',       tr: 'Luteal' },
}
const CYCLE_PHASE_COLOR = {
  menstruation: '#e0457b',
  follicular:   '#5bc25b',
  ovulation:    '#0064ff',
  luteal:       '#b87bd8',
}

export default function CyclePhaseCard({ profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  // Hooks must run unconditionally; gate inside the memo so non-female /
  // non-opted-in profiles never trigger any cycle math. Privacy contract
  // is preserved either way (gate returns null + we render null).
  const gate = useMemo(() => (
    isCycleGateAvailable(profile) ? buildCyclePhaseGate(profile) : null
  ), [profile])

  if (!gate || !Array.isArray(gate.weeks) || gate.weeks.length === 0) return null

  const wk0 = gate.weeks[0]
  const phase0 = wk0.dominantPhase
  const color = CYCLE_PHASE_COLOR[phase0] || '#888'
  const phaseLbl = CYCLE_PHASE_LABEL[phase0]?.[isTR ? 'tr' : 'en'] || phase0
  const mult = wk0.tssMultiplier
  const multPct = Math.round((mult - 1) * 100)
  const multStr = multPct > 0 ? `+${multPct}%` : `${multPct}%`
  const aria = isTR ? 'Döngü fazı önerisi' : 'Cycle phase guidance'
  const title = isTR ? 'DÖNGÜ FAZI' : 'CYCLE PHASE'

  return (
    <div
      role="region"
      aria-label={aria}
      data-cycle-phase-card={phase0}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: '0.08em', fontWeight: 700, color, marginBottom: 8 }}>
        ◐ {title} · {phaseLbl.toUpperCase()} · TSS {multStr}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.55, marginBottom: 8 }}>
        {isTR ? wk0.note.tr : wk0.note.en}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {gate.weeks.map((w, i) => {
          const c = CYCLE_PHASE_COLOR[w.dominantPhase] || '#888'
          const lbl = CYCLE_PHASE_LABEL[w.dominantPhase]?.[isTR ? 'tr' : 'en'] || w.dominantPhase
          const pct = Math.round((w.tssMultiplier - 1) * 100)
          return (
            <div key={i} style={{
              flex: '1 1 90px', minWidth: 90,
              padding: '6px 8px',
              background: `${c}22`,
              border: `1px solid ${c}55`,
              borderRadius: 3,
              fontSize: 9,
            }}>
              <div style={{ color: c, fontWeight: 700, letterSpacing: '0.05em' }}>
                {isTR ? `H${w.weekIdx}` : `W${w.weekIdx}`}
              </div>
              <div style={{ color: 'var(--text)', marginTop: 2 }}>{lbl}</div>
              <div style={{ color: 'var(--muted)', marginTop: 1 }}>
                {pct > 0 ? `+${pct}%` : `${pct}%`}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 4 }}>
        {isTR ? gate.privacyNote.tr : gate.privacyNote.en}
      </div>
      <div style={{ fontSize: 9, color: '#555' }}>
        {gate.citation}
      </div>
    </div>
  )
}
