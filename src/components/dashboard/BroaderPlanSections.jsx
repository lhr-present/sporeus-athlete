// src/components/dashboard/BroaderPlanSections.jsx
// v9.2.0 — broader plan content layers rendered as 6 collapsible sections.
// Consumed by EliteProgramCard and ProgramView to surface key sessions,
// strength, fueling, recovery, race-week, and substitution content.
//
// All bilingual via the `isTR` prop. Pure presentational — no orchestrator
// calls, just renders fields off `result` from buildEliteProgram.

import { useState } from 'react'
import { S } from '../../styles.js'

// ── Visual tokens (v9.4.0) — phase + intensity color coding ──────────────────
// Phase colors mirror PHASE_COLORS in eliteProgram.js so coach + athlete
// + calendar surfaces stay aligned.
const PHASE_COLOR = {
  Base:  '#0064ff',   // blue   — aerobic foundation
  Build: '#00aa66',   // green  — threshold work
  Peak:  '#ff6600',   // orange — VO2max + race-pace
  Taper: '#9966cc',   // purple — neural priming
}
// Intensity tokens mapped from the structure/intensity strings.
// Used for compact chips that an athlete can scan.
const INTENSITY_TOKENS = [
  { match: /VO2|@I-pace|I-pace|Z5|95-100% HRmax|115%|VO2max/i, label: 'VO2',  bg: '#dc3545', fg: '#fff' },
  { match: /Threshold|@T-pace|T-pace|Z4 |sweet[- ]spot|95-105% FTP|88-92% HRmax|cruise/i, label: 'THR',  bg: '#ff6600', fg: '#fff' },
  { match: /Tempo|@M-pace|M-pace|76-85% FTP|80-89% HRmax|Z3/i, label: 'TMP',  bg: '#0064ff', fg: '#fff' },
  { match: /CSS\b|threshold pace|critical swim/i,             label: 'CSS',  bg: '#ff6600', fg: '#fff' },
  { match: /Easy|E-pace|@E|Z2|Z1-Z2|recovery|Z1\b|Long aerobic|Long Z2|conversational/i, label: 'EASY', bg: '#00aa66', fg: '#fff' },
  { match: /Long\b|long-run/i,                                 label: 'LONG', bg: '#0a8a8a', fg: '#fff' },
  { match: /Strides|R-pace|@R|stride/i,                        label: 'R',    bg: '#9966cc', fg: '#fff' },
  { match: /Strength|max-strength|power|hypertrophy|squat|deadlift/i, label: 'STR', bg: '#7d4a00', fg: '#fff' },
  { match: /Race|race-pace|race day|goal pace|goal race/i,     label: 'RACE', bg: '#dc3545', fg: '#fff' },
  { match: /Rest|Off|Dinlenme/i,                               label: 'REST', bg: '#666',    fg: '#fff' },
]

function intensityChip(text) {
  if (!text || typeof text !== 'string') return null
  for (const t of INTENSITY_TOKENS) {
    if (t.match.test(text)) return t
  }
  return null
}

function IntensityChip({ chip, isTR: _isTR }) {
  if (!chip) return null
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.06em',
      background: chip.bg,
      color: chip.fg,
      borderRadius: 2,
      marginRight: 6,
      verticalAlign: 'baseline',
    }}>{chip.label}</span>
  )
}

function Disclosure({ title, count, accent, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const accentColor = accent || '#666'
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 4,
      marginBottom: 8,
      background: open ? `linear-gradient(90deg, ${accentColor}10, transparent 14%)` : undefined,
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${title} ${open ? 'collapse' : 'expand'}`}
        style={{
          ...S.mono,
          width: '100%',
          textAlign: 'left',
          padding: '14px 14px',
          minHeight: 44,
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
        <span>
          <span style={{ color: accentColor, marginRight: 6 }}>{open ? '▼' : '▶'}</span>
          {title}
          {typeof count === 'number' ? (
            <span style={{ marginLeft: 6, color: accentColor, fontWeight: 700 }}>· {count}</span>
          ) : null}
        </span>
      </button>
      {open ? <div style={{ padding: '0 12px 12px' }}>{children}</div> : null}
    </div>
  )
}

function PhaseHeader({ phase, isTR }) {
  const c = PHASE_COLOR[phase] || '#666'
  return (
    <div style={{
      ...S.mono,
      fontSize: 10,
      color: '#fff',
      letterSpacing: '0.08em',
      marginTop: 12,
      marginBottom: 6,
      background: c,
      padding: '3px 8px',
      borderRadius: 3,
      display: 'inline-block',
      fontWeight: 700,
    }}>
      {isTR ? `FAZ · ${phase.toUpperCase()}` : `PHASE · ${phase.toUpperCase()}`}
    </div>
  )
}

function bil(field, isTR) {
  if (!field) return ''
  return isTR ? (field.tr || field.en || '') : (field.en || '')
}

// v9.6.0 — discipline chip for triathlon key sessions.
// v9.14.0 — added 'tri' for brick workouts (multi-discipline).
const DISCIPLINE_META = {
  swim: { icon: '🏊', label: { en: 'SWIM', tr: 'YÜZME' },     color: '#0064ff' },
  bike: { icon: '🚴', label: { en: 'BIKE', tr: 'BİSİKLET' },  color: '#28a745' },
  run:  { icon: '🏃', label: { en: 'RUN',  tr: 'KOŞU' },      color: '#ff6600' },
  tri:  { icon: '🔁', label: { en: 'BRICK', tr: 'BRICK' },    color: '#7d4a00' },
}
function DisciplineChip({ discipline, isTR }) {
  if (!discipline || !DISCIPLINE_META[discipline]) return null
  const m = DISCIPLINE_META[discipline]
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      marginRight: 6,
      background: m.color,
      color: '#fff',
      borderRadius: 3,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.06em',
    }}>
      {m.icon} {isTR ? m.label.tr : m.label.en}
    </span>
  )
}

// v9.11.0 — cohort badge on cohort-personalized sessions.
const COHORT_META = {
  beginner:     { color: '#0064ff', label: { en: 'BEGINNER',     tr: 'BAŞLANGIÇ' } },
  intermediate: { color: '#7d4a00', label: { en: 'INTERMEDIATE', tr: 'ORTA' } },
  elite:        { color: '#dc3545', label: { en: 'ELITE',        tr: 'ELİT' } },
}
function CohortChip({ cohort, isTR }) {
  if (!cohort || !COHORT_META[cohort]) return null
  const m = COHORT_META[cohort]
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      marginRight: 6,
      background: 'transparent',
      color: m.color,
      border: `1px solid ${m.color}`,
      borderRadius: 3,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.06em',
    }}>
      {isTR ? m.label.tr : m.label.en}
    </span>
  )
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
      accent="#ff6600"
      defaultOpen={defaultOpen}
    >
      {phases.map(phase => (
        <div key={phase}>
          <PhaseHeader phase={phase} isTR={isTR} />
          {keySessionLibrary[phase].map(s => {
            const chip = intensityChip(`${bil(s.intensity, isTR)} ${bil(s.structure, isTR)} ${bil(s.name, isTR)}`)
            return (
              <div key={s.key} style={{
                ...S.mono,
                fontSize: 11,
                lineHeight: 1.55,
                padding: '8px 10px',
                borderLeft: `3px solid ${PHASE_COLOR[phase] || '#666'}`,
                marginBottom: 6,
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '0 3px 3px 0',
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  <DisciplineChip discipline={s.discipline} isTR={isTR} />
                  <CohortChip cohort={s.cohort} isTR={isTR} />
                  <IntensityChip chip={chip} isTR={isTR} />
                  <span>{bil(s.name, isTR)}</span>
                </div>
                <div style={{ color: 'var(--muted)', marginBottom: 4, fontStyle: 'italic' }}>{bil(s.purpose, isTR)}</div>
                <div style={{ marginBottom: 2 }}><strong style={{ color: PHASE_COLOR[phase] || '#666' }}>{isTR ? 'YAPISI' : 'STRUCTURE'}</strong> · {bil(s.structure, isTR)}</div>
                <div style={{ marginBottom: 2 }}><strong style={{ color: '#00aa66' }}>{isTR ? 'ISINMA' : 'WARM-UP'}</strong> · {bil(s.warmup, isTR)}</div>
                <div style={{ marginBottom: 2 }}><strong style={{ color: '#0064ff' }}>{isTR ? 'SOĞUMA' : 'COOL-DOWN'}</strong> · {bil(s.cooldown, isTR)}</div>
                <div style={{ marginBottom: 2 }}><strong style={{ color: '#dc3545' }}>{isTR ? 'ŞİDDET' : 'INTENSITY'}</strong> · {bil(s.intensity, isTR)}</div>
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
            )
          })}
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
      accent="#7d4a00"
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
              {Array.isArray(p.prehab) && p.prehab.length > 0 ? (
                <>
                  <div style={{ marginTop: 6, marginBottom: 4, fontWeight: 700, color: '#0064ff' }}>
                    {isTR ? 'PREHAB (5-8 dk)' : 'PREHAB (5-8 min)'}
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                    {p.prehab.map((m, i) => (
                      <li key={i} style={{ marginBottom: 3 }}>
                        <strong>{bil(m.name, isTR)}</strong> — {m.sets}×{m.reps}
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{bil(m.notes, isTR)}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <div style={{ marginTop: 6, marginBottom: 4, fontWeight: 700 }}>{isTR ? 'HAREKETLER' : 'MOVEMENTS'}</div>
              <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                {p.movements.map((m, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <strong>{bil(m.name, isTR)}</strong> — {m.sets}×{m.reps} @ {bil(m.intensity, isTR)}
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{bil(m.notes, isTR)}</div>
                  </li>
                ))}
              </ul>
              {Array.isArray(p.core) && p.core.length > 0 ? (
                <>
                  <div style={{ marginTop: 6, marginBottom: 4, fontWeight: 700, color: '#28a745' }}>
                    {isTR ? 'CORE / GÖVDE' : 'CORE'}
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                    {p.core.map((m, i) => (
                      <li key={i} style={{ marginBottom: 3 }}>
                        <strong>{bil(m.name, isTR)}</strong> — {m.sets}×{m.reps}
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{bil(m.notes, isTR)}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {p.minimumDose ? (
                <div style={{ marginTop: 8, padding: 6, background: 'rgba(40,167,69,0.10)', borderLeft: '2px solid #28a745', fontSize: 10 }}>
                  <strong>{isTR ? 'MİN DOZ (yarış haftası)' : 'MINIMUM DOSE (race week)'}:</strong> {bil(p.minimumDose, isTR)}
                </div>
              ) : null}
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
      accent="#28a745"
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
              {p.hydrationMlPerHr ? (
                <div><strong>{isTR ? 'SIVI ALIMI' : 'HYDRATION'}:</strong> {p.hydrationMlPerHr[0]}-{p.hydrationMlPerHr[1]} mL/h</div>
              ) : null}
              {p.sodiumMgPerHr ? (
                <div><strong>{isTR ? 'SODYUM' : 'SODIUM'}:</strong> {p.sodiumMgPerHr[0]}-{p.sodiumMgPerHr[1]} mg/h</div>
              ) : null}
              {p.sweatRateProtocol ? (
                <div style={{ marginTop: 6, padding: '8px 10px', background: '#28a74511', border: '1px solid #28a74533', borderRadius: 4, fontSize: 10, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{isTR ? 'TERLEME ORANI TESTİ' : 'SWEAT-RATE TEST'}</div>
                  {bil(p.sweatRateProtocol, isTR)}
                </div>
              ) : null}
              {p.ironGuidance ? (
                <div style={{ marginTop: 6, padding: '8px 10px', background: '#a8410011', border: '1px solid #a8410033', borderRadius: 4, fontSize: 10, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{isTR ? 'DEMİR / FERRİTİN (KADIN)' : 'IRON / FERRITIN (FEMALE)'}</div>
                  {bil(p.ironGuidance, isTR)}
                </div>
              ) : null}
              {/* v9.39.0 — RED-S as tickable checklist (preface + 5 boxes + action). */}
              {p.redsChecklist ? (
                <div style={{ marginTop: 6, padding: '8px 10px', background: '#e0303011', border: '1px solid #e0303044', borderRadius: 4, fontSize: 10, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#a01818' }}>{isTR ? 'RED-S TARAMASI' : 'RED-S SCREENING'}</div>
                  <div style={{ marginBottom: 6 }}>{bil(p.redsChecklist.preface, isTR)}</div>
                  <ul style={{ margin: '0 0 6px 0', padding: 0, listStyle: 'none' }}>
                    {(p.redsChecklist.signs?.[isTR ? 'tr' : 'en'] || []).map((sign, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>
                        <label style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" style={{ marginTop: 2 }} aria-label={sign} />
                          <span>{sign}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#a01818' }}>{bil(p.redsChecklist.action, isTR)}</div>
                </div>
              ) : p.redsScreening ? (
                <div style={{ marginTop: 6, padding: '8px 10px', background: '#e0303011', border: '1px solid #e0303044', borderRadius: 4, fontSize: 10, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#a01818' }}>{isTR ? 'RED-S TARAMASI' : 'RED-S SCREENING'}</div>
                  {bil(p.redsScreening, isTR)}
                </div>
              ) : null}
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
      accent="#0064ff"
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
      accent="#dc3545"
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
          <div style={{ fontWeight: 700, color: '#ff6600', marginBottom: 6, letterSpacing: '0.06em' }}>
            {isTR ? '⚡ YARIŞ GÜNÜ' : '⚡ RACE DAY'}
            {r.raceDay.distanceTier ? (
              <span style={{ marginLeft: 8, padding: '1px 6px', background: '#7d4a00', color: '#fff', fontSize: 9, borderRadius: 3, letterSpacing: '0.06em' }}>
                {r.raceDay.distanceTier.toUpperCase()}
              </span>
            ) : null}
          </div>
          <div><strong>{isTR ? 'UYANIŞ' : 'WAKE-UP'}:</strong> {bil(r.raceDay.wakeUp, isTR)}</div>
          <div><strong>{isTR ? 'KAHVALTI' : 'BREAKFAST'}:</strong> {bil(r.raceDay.breakfast, isTR)}</div>
          <div><strong>{isTR ? 'ISINMA' : 'WARM-UP'}:</strong> {bil(r.raceDay.warmup, isTR)}</div>
          {r.raceDay.warmupTierNote ? (
            <div style={{ marginTop: 2, padding: 4, background: 'rgba(125,74,0,0.10)', borderLeft: '2px solid #7d4a00', fontSize: 10 }}>
              ↳ {bil(r.raceDay.warmupTierNote, isTR)}
            </div>
          ) : null}
          <div><strong>{isTR ? 'TEMPOLAMA' : 'PACING'}:</strong> {bil(r.raceDay.pacing, isTR)}</div>
          {r.raceDay.pacingTierNote ? (
            <div style={{ marginTop: 2, padding: 4, background: 'rgba(125,74,0,0.10)', borderLeft: '2px solid #7d4a00', fontSize: 10 }}>
              ↳ {bil(r.raceDay.pacingTierNote, isTR)}
            </div>
          ) : null}
          <div><strong>{isTR ? 'BESLENME' : 'FUELING'}:</strong> {bil(r.raceDay.fueling, isTR)}</div>
          {r.raceDay.preRaceMealsTierNote ? (
            <div style={{ marginTop: 2, padding: 4, background: 'rgba(125,74,0,0.10)', borderLeft: '2px solid #7d4a00', fontSize: 10 }}>
              ↳ {bil(r.raceDay.preRaceMealsTierNote, isTR)}
            </div>
          ) : null}
          <div><strong>{isTR ? 'ZİHİN' : 'MENTAL'}:</strong> {bil(r.raceDay.mental, isTR)}</div>
          {r.raceDay.raceDelayedContingency ? (
            <div style={{ marginTop: 8, padding: 6, background: 'rgba(220,53,69,0.08)', borderLeft: '2px solid #dc3545', fontSize: 10 }}>
              <strong>{isTR ? 'GECİKME KONTENJANSI' : 'RACE-DELAYED CONTINGENCY'}:</strong> {bil(r.raceDay.raceDelayedContingency, isTR)}
            </div>
          ) : null}
          {r.raceDay.bonkWallContingency ? (
            <div style={{ marginTop: 4, padding: 6, background: 'rgba(220,53,69,0.08)', borderLeft: '2px solid #dc3545', fontSize: 10 }}>
              <strong>{isTR ? 'DUVAR KONTENJANSI' : 'WALL CONTINGENCY'}:</strong> {bil(r.raceDay.bonkWallContingency, isTR)}
            </div>
          ) : null}
          {r.raceDay.morningReadinessCheck ? (
            <div style={{ marginTop: 8, padding: 6, background: 'rgba(0,100,255,0.08)', borderLeft: '2px solid #0064ff', fontSize: 10 }}>
              <strong>{isTR ? '⚡ HAZIRLIK KONTROLÜ' : '⚡ READINESS CHECK'}:</strong> {bil(r.raceDay.morningReadinessCheck, isTR)}
            </div>
          ) : null}
          {r.raceDay.preRaceAnxietyReframe ? (
            <div style={{ marginTop: 4, padding: 6, background: 'rgba(40,167,69,0.08)', borderLeft: '2px solid #28a745', fontSize: 10 }}>
              <strong>{isTR ? '🧠 ANKSİYETE YENİDEN ÇERÇEVELEME' : '🧠 ANXIETY REFRAME'}:</strong> {bil(r.raceDay.preRaceAnxietyReframe, isTR)}
            </div>
          ) : null}
          {r.raceDay.motorImagery ? (
            <div style={{ marginTop: 4, padding: 6, background: 'rgba(40,167,69,0.08)', borderLeft: '2px solid #28a745', fontSize: 10 }}>
              <strong>{isTR ? '🎯 MOTOR İMGELEM' : '🎯 MOTOR IMAGERY'}:</strong> {bil(r.raceDay.motorImagery, isTR)}
            </div>
          ) : null}
          {r.raceDay.caffeineSafetyFlags ? (
            <div style={{ marginTop: 4, padding: 6, background: 'rgba(125,74,0,0.10)', borderLeft: '2px solid #7d4a00', fontSize: 10 }}>
              <strong>{isTR ? '☕ KAFEİN GÜVENLİK' : '☕ CAFFEINE SAFETY'}:</strong> {bil(r.raceDay.caffeineSafetyFlags, isTR)}
            </div>
          ) : null}
          {/* v9.35.0 — last 3 nights sleep hygiene (Czeisler 2005 + Mah 2011) */}
          {r.raceDay.last3NightsSleepHygiene ? (
            <div style={{ marginTop: 4, padding: 6, background: 'rgba(0,100,255,0.06)', borderLeft: '2px solid #0064ff', fontSize: 10 }}>
              <strong>{isTR ? '🌙 SON 3 GECE UYKU HİJYENİ' : '🌙 LAST 3 NIGHTS SLEEP HYGIENE'}:</strong> {bil(r.raceDay.last3NightsSleepHygiene, isTR)}
            </div>
          ) : null}
          {/* v9.35.0 — DNF triage decision tree (Bahr 2016 + Noakes 2000 + Sawka 2007).
              v9.38.0 — restructured into 3 severity-tiered callouts for readability. */}
          {Array.isArray(r.raceDay.dnfTriageBuckets) && r.raceDay.dnfTriageBuckets.length > 0 ? (
            <div style={{ marginTop: 4, fontSize: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{isTR ? '🚨 DNF KARAR AĞACI' : '🚨 DNF DECISION TREE'}</div>
              {r.raceDay.dnfTriageBuckets.map(bucket => {
                const palette = bucket.severity === 'stop'
                  ? { bg: 'rgba(220,53,69,0.15)', bd: '#dc3545' }
                  : bucket.severity === 'exit'
                    ? { bg: 'rgba(255,102,0,0.12)', bd: '#ff6600' }
                    : { bg: 'rgba(0,100,255,0.10)', bd: '#0064ff' }
                const items = bucket.items?.[isTR ? 'tr' : 'en'] || []
                return (
                  <div key={bucket.severity} style={{ marginTop: 4, padding: 6, background: palette.bg, borderLeft: `2px solid ${palette.bd}` }}>
                    <strong>{bil(bucket.title, isTR)}</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {items.map((it, i) => <li key={i} style={{ marginBottom: 2 }}>{it}</li>)}
                    </ul>
                  </div>
                )
              })}
            </div>
          ) : r.raceDay.dnfTriageDecisionTree ? (
            <div style={{ marginTop: 4, padding: 6, background: 'rgba(220,53,69,0.10)', borderLeft: '2px solid #dc3545', fontSize: 10 }}>
              <strong>{isTR ? '🚨 DNF KARAR AĞACI' : '🚨 DNF DECISION TREE'}:</strong> {bil(r.raceDay.dnfTriageDecisionTree, isTR)}
            </div>
          ) : null}
          {/* v9.29.0 — sport-specific caffeine dose (different from universal safety flags above) */}
          {r.raceDay.caffeine ? (
            <div style={{ marginTop: 4, padding: 6, background: 'rgba(125,74,0,0.06)', borderLeft: '2px solid #7d4a00', fontSize: 10 }}>
              <strong>{isTR ? '☕ KAFEİN DOZU' : '☕ CAFFEINE DOSING'}:</strong> {bil(r.raceDay.caffeine, isTR)}
            </div>
          ) : null}
          {/* v9.30.0 — triathlon-only blocks: T1/T2 layout + post-swim refuel window */}
          {r.raceDay.transitionLayout ? (
            <div style={{ marginTop: 4, padding: 6, background: 'rgba(0,100,255,0.08)', borderLeft: '2px solid #0064ff', fontSize: 10 }}>
              <strong>{isTR ? '🔁 GEÇİŞ DÜZENİ (T1/T2)' : '🔁 TRANSITION LAYOUT (T1/T2)'}:</strong> {bil(r.raceDay.transitionLayout, isTR)}
            </div>
          ) : null}
          {r.raceDay.brickRefuelWindow ? (
            <div style={{ marginTop: 4, padding: 6, background: 'rgba(220,53,69,0.08)', borderLeft: '2px solid #dc3545', fontSize: 10 }}>
              <strong>{isTR ? '⚠️ BRICK YAKIT PENCERESİ' : '⚠️ BRICK REFUEL WINDOW'}:</strong> {bil(r.raceDay.brickRefuelWindow, isTR)}
            </div>
          ) : null}
        </div>

        {/* v9.29.0 — pre-race meal examples (4-5 concrete templates per sport, was data-only) */}
        {Array.isArray(r.raceDay.preRaceMeals?.en) && r.raceDay.preRaceMeals.en.length > 0 ? (
          <details style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
            <summary style={{ ...S.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', padding: '4px 0', minHeight: 44, display: 'flex', alignItems: 'center' }}>
              🍽 {isTR ? 'YARIŞ ÖNCESİ ÖRNEK ÖĞÜNLER' : 'PRE-RACE MEAL EXAMPLES'} <span style={{ marginLeft: 6, color: 'var(--muted)', fontSize: 9 }}>({(isTR ? r.raceDay.preRaceMeals.tr : r.raceDay.preRaceMeals.en).length})</span>
            </summary>
            <ul style={{ ...S.mono, fontSize: 10, lineHeight: 1.55, margin: '4px 0 0 0', paddingLeft: 18 }}>
              {(isTR ? r.raceDay.preRaceMeals.tr : r.raceDay.preRaceMeals.en).map((meal, i) => (
                <li key={i} style={{ marginBottom: 3 }}>{meal}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {/* v9.29.0 — sport-specific mental rehearsal scripts (Vealey 2007; Bull 1996) */}
        {Array.isArray(r.raceDay.mentalRehearsal?.en) && r.raceDay.mentalRehearsal.en.length > 0 ? (
          <details style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
            <summary style={{ ...S.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', padding: '4px 0', minHeight: 44, display: 'flex', alignItems: 'center' }}>
              🎬 {isTR ? 'ZİHİNSEL PROVA' : 'MENTAL REHEARSAL'} <span style={{ marginLeft: 6, color: 'var(--muted)', fontSize: 9 }}>({(isTR ? r.raceDay.mentalRehearsal.tr : r.raceDay.mentalRehearsal.en).length})</span>
            </summary>
            <ul style={{ ...S.mono, fontSize: 10, lineHeight: 1.55, margin: '4px 0 0 0', paddingLeft: 18 }}>
              {(isTR ? r.raceDay.mentalRehearsal.tr : r.raceDay.mentalRehearsal.en).map((script, i) => (
                <li key={i} style={{ marginBottom: 3 }}>{script}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {/* v9.33.0 — universal post-race recovery first 48h (Stellingwerff 2014 +
            Macaluso 2012 + Banister 1997). Always present in raceDay output. */}
        {r.raceDay.postRaceRecovery48h ? (
          <details style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
            <summary style={{ ...S.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', padding: '4px 0', minHeight: 44, display: 'flex', alignItems: 'center', color: '#0064ff' }}>
              🔄 {isTR ? 'YARIŞ SONRASI 48 SAAT TOPARLANMA' : 'POST-RACE 48H RECOVERY'}
            </summary>
            <div style={{ ...S.mono, fontSize: 10, lineHeight: 1.55, marginTop: 6 }}>
              <div style={{ marginBottom: 6 }}><strong>{isTR ? 'SAAT 0-2' : 'HOUR 0-2'}:</strong> {bil(r.raceDay.postRaceRecovery48h.hour0to2, isTR)}</div>
              <div style={{ marginBottom: 6 }}><strong>{isTR ? 'SAAT 2-4' : 'HOUR 2-4'}:</strong> {bil(r.raceDay.postRaceRecovery48h.hour2to4, isTR)}</div>
              <div style={{ marginBottom: 6 }}><strong>{isTR ? '1. GÜN' : 'DAY 1'}:</strong> {bil(r.raceDay.postRaceRecovery48h.day1, isTR)}</div>
              <div style={{ marginBottom: 6 }}><strong>{isTR ? '2. GÜN' : 'DAY 2'}:</strong> {bil(r.raceDay.postRaceRecovery48h.day2, isTR)}</div>
              <div style={{ marginBottom: 6 }}><strong>{isTR ? '3. GÜN+' : 'DAY 3+'}:</strong> {bil(r.raceDay.postRaceRecovery48h.day3plus, isTR)}</div>
              <div style={{ marginTop: 8, padding: 6, background: 'rgba(220,53,69,0.08)', borderLeft: '2px solid #dc3545' }}>
                <strong>{isTR ? '⚠ TIBBİ İNCELEME GEREKEN BELİRTİLER' : '⚠ WARNING SIGNS NEEDING MEDICAL REVIEW'}:</strong> {bil(r.raceDay.postRaceRecovery48h.warningSigns, isTR)}
              </div>
            </div>
          </details>
        ) : null}

        {/* v9.29.0 — conditional environmental protocols (travel/altitude/heat) — data
            was being computed but never rendered. Each is null when threshold not crossed
            (timeZone <3h, altitude <1500m, heat <25°C). */}
        {r.travel ? (
          <RaceWeekConditional title={isTR ? '✈️ SEYAHAT (JET LAG)' : '✈️ TRAVEL (JET LAG)'} accent="#9966cc" data={r.travel} isTR={isTR} />
        ) : null}
        {r.altitude ? (
          <RaceWeekConditional title={isTR ? '⛰ RAKIM' : '⛰ ALTITUDE'} accent="#ff6600" data={r.altitude} isTR={isTR} />
        ) : null}
        {r.heat ? (
          <RaceWeekConditional title={isTR ? '🌡 SICAK HAVA' : '🌡 HEAT'} accent="#dc3545" data={r.heat} isTR={isTR} />
        ) : null}
        {r.cold ? (
          <RaceWeekConditional title={isTR ? '❄️ SOĞUK HAVA' : '❄️ COLD WEATHER'} accent="#0064ff" data={r.cold} isTR={isTR} />
        ) : null}

        <div style={{ marginTop: 6, fontSize: 9, color: 'var(--muted)', fontStyle: 'italic' }}>{r.citation}</div>
      </div>
    </Disclosure>
  )
}

// v9.29.0 — Shared renderer for travel/altitude/heat protocol blocks. They have
// the same overall shape: { summary, acclimatization|sleep, pacing, fueling }
// (each bilingual). Renders as a colored callout panel with labelled rows.
function RaceWeekConditional({ title, accent, data, isTR }) {
  const accentBg = accent + '14' // ~8% opacity hex suffix
  return (
    <div style={{ marginTop: 10, padding: 10, background: accentBg, borderLeft: `3px solid ${accent}`, borderRadius: 4 }}>
      <div style={{ ...S.mono, fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.06em', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ ...S.mono, fontSize: 10, lineHeight: 1.55 }}>
        {data.summary ? <div style={{ marginBottom: 4 }}>{bil(data.summary, isTR)}</div> : null}
        {data.acclimatization ? <div><strong>{isTR ? 'ADAPTASYON' : 'ACCLIMATIZATION'}:</strong> {bil(data.acclimatization, isTR)}</div> : null}
        {data.sleep ? <div><strong>{isTR ? 'UYKU' : 'SLEEP'}:</strong> {bil(data.sleep, isTR)}</div> : null}
        {data.pacing ? <div><strong>{isTR ? 'TEMPOLAMA' : 'PACING'}:</strong> {bil(data.pacing, isTR)}</div> : null}
        {data.fueling ? <div><strong>{isTR ? 'BESLENME' : 'FUELING'}:</strong> {bil(data.fueling, isTR)}</div> : null}
      </div>
    </div>
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
      accent="#9966cc"
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

// v9.9.0 — Drills section (sport-specific neuromuscular work)
export function DrillsSection({ drillsLibrary, isTR, defaultOpen = false }) {
  if (!drillsLibrary) return null
  const phases = ['Base', 'Build', 'Peak', 'Taper'].filter(p =>
    Array.isArray(drillsLibrary[p]) && drillsLibrary[p].length > 0
  )
  if (phases.length === 0) return null
  const totalDrills = phases.reduce((acc, p) => acc + drillsLibrary[p].length, 0)
  return (
    <Disclosure
      title={isTR ? 'DRİLLER & NÖROMUSKÜLER' : 'DRILLS & NEUROMUSCULAR'}
      count={totalDrills}
      accent="#00aa66"
      defaultOpen={defaultOpen}
    >
      {phases.map(phase => (
        <div key={phase}>
          <PhaseHeader phase={phase} isTR={isTR} />
          {drillsLibrary[phase].map(d => (
            <div key={d.key} style={{
              ...S.mono,
              fontSize: 11,
              lineHeight: 1.55,
              padding: '6px 10px',
              borderLeft: `3px solid ${PHASE_COLOR[phase] || '#666'}`,
              marginBottom: 5,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '0 3px 3px 0',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                <DisciplineChip discipline={d.discipline} isTR={isTR} />
                <span>{bil(d.name, isTR)}</span>
                <span style={{
                  marginLeft: 8, fontSize: 9, color: 'var(--muted)',
                  fontWeight: 400,
                }}>
                  {d.frequencyPerWeek}× / {isTR ? 'hafta' : 'wk'}
                </span>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 2, fontStyle: 'italic' }}>{bil(d.purpose, isTR)}</div>
              <div style={{ fontSize: 10 }}>{bil(d.structure, isTR)}</div>
              <div style={{ marginTop: 2, fontSize: 9, color: 'var(--muted)', fontStyle: 'italic' }}>{d.citation}</div>
            </div>
          ))}
        </div>
      ))}
    </Disclosure>
  )
}

// v9.9.0 — Contingency scripts (illness / life-event / travel)
export function ContingencySection({ contingencyMap, isTR, defaultOpen = false }) {
  if (!contingencyMap) return null
  const blocks = Object.entries(contingencyMap)
  if (blocks.length === 0) return null
  return (
    <Disclosure
      title={isTR ? 'ACİL DURUMLAR (hastalık/yaşam/seyahat)' : 'CONTINGENCY (illness/life/travel)'}
      count={blocks.length}
      accent="#dc3545"
      defaultOpen={defaultOpen}
    >
      {blocks.map(([key, block]) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <div style={{ ...S.mono, fontSize: 11, fontWeight: 700, marginBottom: 4, letterSpacing: '0.04em', color: '#dc3545' }}>
            {bil(block.title, isTR)}
          </div>
          <div style={{ ...S.mono, fontSize: 10, lineHeight: 1.55 }}>
            {Object.entries(block).filter(([k]) => !['title', 'citation'].includes(k)).map(([subKey, val]) => (
              <div key={subKey} style={{ marginBottom: 3 }}>
                <strong>{subKey.replace(/([A-Z])/g, ' $1').toUpperCase()}:</strong> {bil(val, isTR)}
              </div>
            ))}
            {block.citation ? (
              <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)', fontStyle: 'italic' }}>{block.citation}</div>
            ) : null}
          </div>
        </div>
      ))}
    </Disclosure>
  )
}

/**
 * Renders all broader-plan content sections in a single container.
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
      <DrillsSection drillsLibrary={result.drillsLibrary} isTR={isTR} />
      <StrengthSection strengthProgram={result.strengthProgram} isTR={isTR} />
      <FuelingSection fuelingProgram={result.fuelingProgram} isTR={isTR} />
      <RecoverySection recoveryProgram={result.recoveryProgram} isTR={isTR} />
      <RaceWeekSection raceWeekProtocol={result.raceWeekProtocol} isTR={isTR} />
      <SubstitutionsSection substitutionMap={result.substitutionMap} isTR={isTR} />
      <ContingencySection contingencyMap={result.contingencyMap} isTR={isTR} />
    </div>
  )
}
