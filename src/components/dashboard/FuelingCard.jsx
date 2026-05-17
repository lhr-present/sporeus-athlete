// ─── FuelingCard.jsx — Surface eliteProgramFueling per-phase prescription ──
//
// Pure-function `buildFuelingProgram` (src/lib/athlete/eliteProgramFueling.js)
// shipped per Burke 2017 / Jeukendrup 2014 / Hawley & Burke 2010 / Areta 2014
// but had no Dashboard surface. This card wraps it.
//
// Inputs: `profile.weight` (kg, REQUIRED — renders null otherwise),
//         `profile.gender` (optional, drives hydration/sodium brackets +
//          iron/RED-S surfacing), `profile.cohort` (optional, shifts CHO
//          range per Burke 2017 Table 3 / Stellingwerff 2019).
//
// Output: per-phase Daily CHO (g/kg + absolute g/day), session CHO (g/h),
//         fluid (mL/h), sodium (mg/h), per-phase rationale + notes,
//         citation footer.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  buildFuelingProgram,
  FUELING_CITATION,
} from '../../lib/athlete/eliteProgramFueling.js'

const MONO = "'IBM Plex Mono', monospace"

const PHASE_LABEL = {
  Base:  { en: 'BASE',  tr: 'TEMEL' },
  Build: { en: 'BUILD', tr: 'YAPI' },
  Peak:  { en: 'PEAK',  tr: 'ZİRVE' },
  Taper: { en: 'TAPER', tr: 'KÖŞELEME' },
}
const PHASE_COLOR = {
  Base:  '#666666',
  Build: '#0064ff',
  Peak:  '#ff6600',
  Taper: '#f5c542',
}
const PHASE_ORDER = ['Base', 'Build', 'Peak', 'Taper']

const T = {
  title:       { en: 'FUELING PROGRAM',           tr: 'BESLENME PROGRAMI' },
  ariaLabel:   { en: 'Fueling program by phase',  tr: 'Faza göre beslenme programı' },
  dailyCHO:    { en: 'Daily CHO',                  tr: 'Günlük KH' },
  dailyPro:    { en: 'Daily Protein',              tr: 'Günlük Protein' },
  sessionCHO:  { en: 'Session CHO (hard)',         tr: 'Antrenman İçi KH (sert)' },
  fluid:       { en: 'Fluid',                      tr: 'Sıvı' },
  sodium:      { en: 'Sodium',                     tr: 'Sodyum' },
  perKg:       { en: 'g/kg/day',                   tr: 'g/kg/gün' },
  perDay:      { en: 'g/day',                      tr: 'g/gün' },
  perHr:       { en: 'g/h',                        tr: 'g/sa' },
  mlPerHr:     { en: 'mL/h',                       tr: 'mL/sa' },
  mgPerHr:     { en: 'mg/h',                       tr: 'mg/sa' },
  rationale:   { en: 'Rationale',                  tr: 'Gerekçe' },
  notes:       { en: 'Notes',                      tr: 'Notlar' },
  legend:      {
    en: 'CHO = carbohydrate. Ranges shift with training phase; hydration & sodium scale with bodyweight + sex.',
    tr: 'KH = karbonhidrat. Aralıklar antrenman fazına göre değişir; sıvı ve sodyum vücut ağırlığı + cinsiyetle ölçeklenir.',
  },
}

const tr = (key, lang) => (T[key] ? T[key][lang] || T[key].en : key)
const fmtRange = (r, unit) => (Array.isArray(r) ? `${r[0]}–${r[1]} ${unit}` : '—')

export default function FuelingCard({ profile }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  // Required input — eliteProgramFueling's absolute-gram path gates on
  // bodyMassKg. Without weight, the card has no useful daily CHO g/day
  // to render, so we render null (the Dashboard convention).
  const bodyMassKg = parseFloat(profile?.weight)
  const hasWeight = Number.isFinite(bodyMassKg) && bodyMassKg > 0

  const program = useMemo(() => {
    if (!hasWeight) return null
    return buildFuelingProgram({
      phases: PHASE_ORDER.map(phase => ({ phase })),
      bodyMassKg,
      gender: profile?.gender,
      cohort: profile?.cohort,
    })
  }, [hasWeight, bodyMassKg, profile?.gender, profile?.cohort])

  if (!hasWeight || !program) return null

  const phasesPresent = PHASE_ORDER.filter(p => program[p])
  if (phasesPresent.length === 0) return null

  return (
    <div
      role="region"
      aria-label={tr('ariaLabel', lang)}
      data-fueling-card
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
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
          color: 'var(--text)',
        }}>
          <span style={{ color: '#ff6600', marginRight: 6 }}>◣</span>
          {tr('title', lang)}
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted)' }}>
          {bodyMassKg} kg{profile?.gender ? ` · ${profile.gender}` : ''}
          {profile?.cohort ? ` · ${profile.cohort}` : ''}
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>
        {tr('legend', lang)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {phasesPresent.map(phaseKey => {
          const p = program[phaseKey]
          const color = PHASE_COLOR[phaseKey]
          const label = isTR ? PHASE_LABEL[phaseKey].tr : PHASE_LABEL[phaseKey].en
          return (
            <div
              key={phaseKey}
              data-fueling-phase={phaseKey}
              style={{
                background: 'var(--surface, #141414)',
                border: '1px solid var(--border, #222)',
                borderLeft: `3px solid ${color}`,
                borderRadius: 3,
                padding: 10,
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 6,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                  color, textTransform: 'uppercase',
                }}>
                  {label}
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)' }}>
                  {p.citation}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 8, marginBottom: 8,
              }}>
                <Metric
                  label={tr('dailyCHO', lang)}
                  primary={fmtRange(p.chodailyPerKg, tr('perKg', lang))}
                  secondary={
                    Array.isArray(p.dailyCHO_g)
                      ? `${p.dailyCHO_g[0]}–${p.dailyCHO_g[1]} ${tr('perDay', lang)}`
                      : null
                  }
                  data-fueling-daily-cho={phaseKey}
                />
                <Metric
                  label={tr('dailyPro', lang)}
                  primary={
                    p.dailyProtein_g != null
                      ? `${p.dailyProtein_g} ${tr('perDay', lang)}`
                      : `${p.proteindailyPerKg} ${tr('perKg', lang)}`
                  }
                  secondary={`${p.proteindailyPerKg} ${tr('perKg', lang)}`}
                />
                <Metric
                  label={tr('sessionCHO', lang)}
                  primary={fmtRange(p.duringSession?.hardSessionGPerHr, tr('perHr', lang))}
                  data-fueling-session-cho={phaseKey}
                />
                <Metric
                  label={tr('fluid', lang)}
                  primary={
                    Array.isArray(p.hydrationMlPerHr)
                      ? fmtRange(p.hydrationMlPerHr, tr('mlPerHr', lang))
                      : '—'
                  }
                  data-fueling-fluid={phaseKey}
                />
                <Metric
                  label={tr('sodium', lang)}
                  primary={
                    Array.isArray(p.sodiumMgPerHr)
                      ? fmtRange(p.sodiumMgPerHr, tr('mgPerHr', lang))
                      : '—'
                  }
                  data-fueling-sodium={phaseKey}
                />
              </div>

              <div style={{ marginBottom: 4 }}>
                <div style={{
                  fontSize: 9, color: 'var(--muted)', letterSpacing: '0.05em',
                  textTransform: 'uppercase', marginBottom: 2,
                }}>
                  {tr('rationale', lang)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.5 }}>
                  {isTR ? p.rationale?.tr : p.rationale?.en}
                </div>
              </div>

              <div>
                <div style={{
                  fontSize: 9, color: 'var(--muted)', letterSpacing: '0.05em',
                  textTransform: 'uppercase', marginBottom: 2,
                }}>
                  {tr('notes', lang)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.5 }}>
                  {isTR ? p.notes?.tr : p.notes?.en}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div
        data-fueling-citation
        style={{
          marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)',
          fontSize: 9, color: '#555', fontStyle: 'italic', lineHeight: 1.5,
        }}
      >
        {FUELING_CITATION}
      </div>
    </div>
  )
}

function Metric({ label, primary, secondary, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        padding: '6px 8px',
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 3,
      }}
    >
      <div style={{
        fontSize: 9, color: 'var(--muted)', letterSpacing: '0.05em',
        textTransform: 'uppercase', marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
        {primary}
      </div>
      {secondary ? (
        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>
          {secondary}
        </div>
      ) : null}
    </div>
  )
}
