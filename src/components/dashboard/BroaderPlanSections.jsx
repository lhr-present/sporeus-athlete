// src/components/dashboard/BroaderPlanSections.jsx
// v9.2.0 — broader plan content layers rendered as 6 collapsible sections.
// Consumed by EliteProgramCard and ProgramView to surface key sessions,
// strength, fueling, recovery, race-week, and substitution content.
//
// All bilingual via the `isTR` prop. Pure presentational — no orchestrator
// calls, just renders fields off `result` from buildEliteProgram.

import { useState } from 'react'
import { S } from '../../styles.js'

function Disclosure({ title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 4, marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          ...S.mono,
          width: '100%',
          textAlign: 'left',
          padding: '10px 12px',
          background: 'transparent',
          color: 'var(--text)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 11,
          letterSpacing: '0.06em',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{open ? '▼' : '▶'} {title}{typeof count === 'number' ? ` · ${count}` : ''}</span>
      </button>
      {open ? <div style={{ padding: '0 12px 12px' }}>{children}</div> : null}
    </div>
  )
}

function PhaseHeader({ phase, isTR }) {
  return (
    <div style={{ ...S.mono, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6 }}>
      {isTR ? `FAZ · ${phase.toUpperCase()}` : `PHASE · ${phase.toUpperCase()}`}
    </div>
  )
}

function bil(field, isTR) {
  if (!field) return ''
  return isTR ? (field.tr || field.en || '') : (field.en || '')
}

// ── Key Sessions ─────────────────────────────────────────────────────────────
export function KeySessionsSection({ keySessionLibrary, isTR, defaultOpen = false }) {
  if (!keySessionLibrary) return null
  const phases = ['Base', 'Build', 'Peak', 'Taper'].filter(p =>
    Array.isArray(keySessionLibrary[p]) && keySessionLibrary[p].length > 0
  )
  if (phases.length === 0) return null
  const totalSessions = phases.reduce((acc, p) => acc + keySessionLibrary[p].length, 0)
  return (
    <Disclosure
      title={isTR ? 'ANAHTAR ANTRENMANLAR' : 'KEY WORKOUTS'}
      count={totalSessions}
      defaultOpen={defaultOpen}
    >
      {phases.map(phase => (
        <div key={phase}>
          <PhaseHeader phase={phase} isTR={isTR} />
          {keySessionLibrary[phase].map(s => (
            <div key={s.key} style={{ ...S.mono, fontSize: 11, lineHeight: 1.55, padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{bil(s.name, isTR)}</div>
              <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{bil(s.purpose, isTR)}</div>
              <div style={{ marginBottom: 2 }}><strong>{isTR ? 'YAPISI' : 'STRUCTURE'}:</strong> {bil(s.structure, isTR)}</div>
              <div style={{ marginBottom: 2 }}><strong>{isTR ? 'ISINMA' : 'WARM-UP'}:</strong> {bil(s.warmup, isTR)}</div>
              <div style={{ marginBottom: 2 }}><strong>{isTR ? 'SOĞUMA' : 'COOL-DOWN'}:</strong> {bil(s.cooldown, isTR)}</div>
              <div style={{ marginBottom: 2 }}><strong>{isTR ? 'ŞİDDET' : 'INTENSITY'}:</strong> {bil(s.intensity, isTR)}</div>
              {Array.isArray(s.alternates) && s.alternates.length > 0 ? (
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>
                  <strong>{isTR ? 'ALTERNATİF' : 'ALTERNATES'}:</strong>
                  <ul style={{ margin: '2px 0 0 16px', padding: 0 }}>
                    {s.alternates.map((alt, i) => <li key={i}>{bil(alt, isTR)}</li>)}
                  </ul>
                </div>
              ) : null}
              <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)', fontStyle: 'italic' }}>{s.citation}</div>
            </div>
          ))}
        </div>
      ))}
    </Disclosure>
  )
}

// ── Strength ─────────────────────────────────────────────────────────────────
export function StrengthSection({ strengthProgram, isTR, defaultOpen = false }) {
  if (!strengthProgram || Object.keys(strengthProgram).length === 0) return null
  const phases = ['Base', 'Build', 'Peak', 'Taper'].filter(p => strengthProgram[p])
  return (
    <Disclosure
      title={isTR ? 'KUVVET PROGRAMI' : 'STRENGTH PROGRAM'}
      count={phases.length}
      defaultOpen={defaultOpen}
    >
      {phases.map(phase => {
        const p = strengthProgram[phase]
        return (
          <div key={phase}>
            <PhaseHeader phase={phase} isTR={isTR} />
            <div style={{ ...S.mono, fontSize: 11, lineHeight: 1.55 }}>
              <div style={{ marginBottom: 4 }}><strong>{isTR ? 'ODAK' : 'EMPHASIS'}:</strong> {bil(p.emphasis, isTR)}</div>
              <div style={{ marginBottom: 4 }}><strong>{isTR ? 'HAFTALIK SIKLIK' : 'FREQUENCY'}:</strong> {p.frequencyPerWeek}× / {isTR ? 'hafta' : 'week'} · {p.sessionDurationMin} {isTR ? 'dk' : 'min'}</div>
              <div style={{ marginTop: 6, marginBottom: 4, fontWeight: 700 }}>{isTR ? 'HAREKETLER' : 'MOVEMENTS'}</div>
              <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                {p.movements.map((m, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <strong>{bil(m.name, isTR)}</strong> — {m.sets}×{m.reps} @ {bil(m.intensity, isTR)}
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{bil(m.notes, isTR)}</div>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 8, padding: 6, background: 'rgba(255,153,0,0.08)', borderLeft: '2px solid #f90', fontSize: 10 }}>
                <strong>{isTR ? 'UYARI' : 'WARNING'}:</strong> {bil(p.warning, isTR)}
              </div>
              <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)', fontStyle: 'italic' }}>{p.citation}</div>
            </div>
          </div>
        )
      })}
    </Disclosure>
  )
}

// ── Fueling ──────────────────────────────────────────────────────────────────
export function FuelingSection({ fuelingProgram, isTR, defaultOpen = false }) {
  if (!fuelingProgram || Object.keys(fuelingProgram).length === 0) return null
  const phases = ['Base', 'Build', 'Peak', 'Taper'].filter(p => fuelingProgram[p])
  return (
    <Disclosure
      title={isTR ? 'BESLENME HEDEFLERİ' : 'FUELING TARGETS'}
      count={phases.length}
      defaultOpen={defaultOpen}
    >
      {phases.map(phase => {
        const p = fuelingProgram[phase]
        const choAbs = p.dailyCHO_g ? ` (${p.dailyCHO_g[0]}-${p.dailyCHO_g[1]} g)` : ''
        const protAbs = p.dailyProtein_g ? ` (${p.dailyProtein_g} g)` : ''
        return (
          <div key={phase}>
            <PhaseHeader phase={phase} isTR={isTR} />
            <div style={{ ...S.mono, fontSize: 11, lineHeight: 1.55 }}>
              <div><strong>CHO:</strong> {p.chodailyPerKg[0]}-{p.chodailyPerKg[1]} g/kg/{isTR ? 'gün' : 'day'}{choAbs}</div>
              <div><strong>{isTR ? 'PROTEİN' : 'PROTEIN'}:</strong> {p.proteindailyPerKg} g/kg/{isTR ? 'gün' : 'day'}{protAbs}</div>
              <div><strong>{isTR ? 'YAĞ' : 'FAT'}:</strong> {p.fatPctOfKcal[0]}-{p.fatPctOfKcal[1]}% kcal</div>
              <div style={{ marginTop: 4 }}><strong>{isTR ? 'SEANS İÇİ' : 'DURING SESSION'}:</strong> {p.duringSession.hardSessionGPerHr[0]}-{p.duringSession.hardSessionGPerHr[1]} g CHO/h</div>
              <div><strong>{isTR ? 'SEANS ÖNCESİ' : 'PRE-SESSION'}:</strong> {p.preSession.gPerKg} g/kg, {p.preSession.timingMin} {isTR ? 'dk önce' : 'min before'}</div>
              <div><strong>{isTR ? 'SEANS SONRASI' : 'POST-SESSION'}:</strong> {p.postSession.gPerKg} g/kg CHO + {p.postSession.proteinG} g {isTR ? 'protein' : 'protein'}, {p.postSession.timingMin} {isTR ? 'dk içinde' : 'min window'}</div>
              <div style={{ marginTop: 6, color: 'var(--muted)' }}>{bil(p.rationale, isTR)}</div>
              <div style={{ marginTop: 4, fontSize: 10 }}><strong>{isTR ? 'NOT' : 'NOTE'}:</strong> {bil(p.notes, isTR)}</div>
              <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)', fontStyle: 'italic' }}>{p.citation}</div>
            </div>
          </div>
        )
      })}
    </Disclosure>
  )
}

// ── Recovery ─────────────────────────────────────────────────────────────────
export function RecoverySection({ recoveryProgram, isTR, defaultOpen = false }) {
  if (!recoveryProgram || Object.keys(recoveryProgram).length === 0) return null
  const phases = ['Base', 'Build', 'Peak', 'Taper'].filter(p => recoveryProgram[p])
  return (
    <Disclosure
      title={isTR ? 'TOPARLANMA REÇETESİ' : 'RECOVERY PRESCRIPTION'}
      count={phases.length}
      defaultOpen={defaultOpen}
    >
      {phases.map(phase => {
        const p = recoveryProgram[phase]
        return (
          <div key={phase}>
            <PhaseHeader phase={phase} isTR={isTR} />
            <div style={{ ...S.mono, fontSize: 11, lineHeight: 1.55 }}>
              <div><strong>{isTR ? 'UYKU HEDEFİ' : 'SLEEP TARGET'}:</strong> {p.sleepHoursTarget[0]}-{p.sleepHoursTarget[1]} {isTR ? 'sa' : 'h'}</div>
              <div><strong>{isTR ? 'KOLAY GÜN HR ÜST SINIRI' : 'EASY-DAY HR CAP'}:</strong> {p.easyDayPaceCapPctOfHRmax}% HRmax</div>
              <div><strong>{isTR ? 'HRV TETİKLEME' : 'HRV TRIGGER'}:</strong> {isTR ? `>${p.hrvDropTriggerPct}% düşüş 3+ gün → şiddeti azalt` : `>${p.hrvDropTriggerPct}% drop sustained 3+ days → reduce intensity`}</div>
              <div><strong>{isTR ? 'DELOAD ARALIĞI' : 'DELOAD CADENCE'}:</strong> {p.deloadEvery > 0 ? (isTR ? `Her ${p.deloadEvery}. hafta` : `Every ${p.deloadEvery}th week`) : (isTR ? 'Yarış haftası' : 'Race week')}</div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{isTR ? 'YÖNTEMLER' : 'MODALITIES'}</div>
              <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                {p.modalities.map((m, i) => <li key={i}>{bil(m, isTR)}</li>)}
              </ul>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{isTR ? 'UYARI İŞARETLERİ' : 'WARNING SIGNS'}</div>
              <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                {p.warningSigns.map((w, i) => <li key={i}>{bil(w, isTR)}</li>)}
              </ul>
              <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)', fontStyle: 'italic' }}>{p.citation}</div>
            </div>
          </div>
        )
      })}
    </Disclosure>
  )
}

// ── Race Week ────────────────────────────────────────────────────────────────
export function RaceWeekSection({ raceWeekProtocol, isTR, defaultOpen = false }) {
  if (!raceWeekProtocol) return null
  const r = raceWeekProtocol
  return (
    <Disclosure
      title={isTR ? 'YARIŞ HAFTASI PROTOKOLÜ' : 'RACE-WEEK PROTOCOL'}
      count={r.schedule?.length || 0}
      defaultOpen={defaultOpen}
    >
      <div style={{ ...S.mono, fontSize: 11, lineHeight: 1.55 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: 4, fontSize: 10, color: 'var(--muted)' }}>{isTR ? 'GÜN' : 'DAY'}</th>
              <th style={{ textAlign: 'left', padding: 4, fontSize: 10, color: 'var(--muted)' }}>{isTR ? 'SEANS' : 'SESSION'}</th>
              <th style={{ textAlign: 'left', padding: 4, fontSize: 10, color: 'var(--muted)' }}>{isTR ? 'BESLENME' : 'FUELING'}</th>
            </tr>
          </thead>
          <tbody>
            {r.schedule.map(d => (
              <tr key={d.tMinus} style={{ borderBottom: '1px dashed var(--border)' }}>
                <td style={{ padding: 4, fontWeight: 700, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{d.day}</td>
                <td style={{ padding: 4, verticalAlign: 'top' }}>{bil(d.session, isTR)}<div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{bil(d.notes, isTR)}</div></td>
                <td style={{ padding: 4, verticalAlign: 'top', fontSize: 10 }}>{bil(d.fueling, isTR)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '2px solid #ff6600', paddingTop: 8, marginTop: 8 }}>
          <div style={{ fontWeight: 700, color: '#ff6600', marginBottom: 6, letterSpacing: '0.06em' }}>{isTR ? '⚡ YARIŞ GÜNÜ' : '⚡ RACE DAY'}</div>
          <div><strong>{isTR ? 'UYANIŞ' : 'WAKE-UP'}:</strong> {bil(r.raceDay.wakeUp, isTR)}</div>
          <div><strong>{isTR ? 'KAHVALTI' : 'BREAKFAST'}:</strong> {bil(r.raceDay.breakfast, isTR)}</div>
          <div><strong>{isTR ? 'ISINMA' : 'WARM-UP'}:</strong> {bil(r.raceDay.warmup, isTR)}</div>
          <div><strong>{isTR ? 'TEMPOLAMA' : 'PACING'}:</strong> {bil(r.raceDay.pacing, isTR)}</div>
          <div><strong>{isTR ? 'BESLENME' : 'FUELING'}:</strong> {bil(r.raceDay.fueling, isTR)}</div>
          <div><strong>{isTR ? 'ZİHİN' : 'MENTAL'}:</strong> {bil(r.raceDay.mental, isTR)}</div>
        </div>
        <div style={{ marginTop: 6, fontSize: 9, color: 'var(--muted)', fontStyle: 'italic' }}>{r.citation}</div>
      </div>
    </Disclosure>
  )
}

// ── Substitutions ────────────────────────────────────────────────────────────
export function SubstitutionsSection({ substitutionMap, isTR, defaultOpen = false }) {
  if (!substitutionMap || Object.keys(substitutionMap).length === 0) return null
  const intents = Object.keys(substitutionMap)
  return (
    <Disclosure
      title={isTR ? 'ALTERNATİFLER (kapalı/sakat/kaçırılan)' : 'SUBSTITUTIONS (indoor/injured/missed)'}
      count={intents.length}
      defaultOpen={defaultOpen}
    >
      {intents.map(intent => {
        const set = substitutionMap[intent]
        return (
          <div key={intent} style={{ marginBottom: 12 }}>
            <div style={{ ...S.mono, fontSize: 11, fontWeight: 700, marginBottom: 4, letterSpacing: '0.04em' }}>
              {intent.toUpperCase()}
            </div>
            <div style={{ ...S.mono, fontSize: 10, lineHeight: 1.55 }}>
              <div><strong>{isTR ? 'KAPALI' : 'INDOOR'}:</strong> {bil(set.indoor, isTR)}</div>
              <div><strong>{isTR ? 'ÇAPRAZ' : 'CROSS-TRAIN'}:</strong> {bil(set.crossTrain, isTR)}</div>
              <div><strong>{isTR ? 'SAKAT' : 'INJURED'}:</strong> {bil(set.injured, isTR)}</div>
              <div><strong>{isTR ? 'HAVA' : 'WEATHER'}:</strong> {bil(set.weather, isTR)}</div>
              <div><strong>{isTR ? 'KAÇIRDIM' : 'MISSED → MAKE-UP'}:</strong> {bil(set.missedMakeup, isTR)}</div>
            </div>
          </div>
        )
      })}
    </Disclosure>
  )
}

/**
 * Renders all 6 broader-plan content sections in a single container.
 * Pass the full `result` object from buildEliteProgram.
 */
export default function BroaderPlanSections({ result, isTR }) {
  if (!result) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...S.mono, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 8 }}>
        {isTR ? 'GENİŞLETİLMİŞ PROGRAM İÇERİĞİ' : 'BROADER PROGRAM CONTENT'}
      </div>
      <KeySessionsSection keySessionLibrary={result.keySessionLibrary} isTR={isTR} />
      <StrengthSection strengthProgram={result.strengthProgram} isTR={isTR} />
      <FuelingSection fuelingProgram={result.fuelingProgram} isTR={isTR} />
      <RecoverySection recoveryProgram={result.recoveryProgram} isTR={isTR} />
      <RaceWeekSection raceWeekProtocol={result.raceWeekProtocol} isTR={isTR} />
      <SubstitutionsSection substitutionMap={result.substitutionMap} isTR={isTR} />
    </div>
  )
}
