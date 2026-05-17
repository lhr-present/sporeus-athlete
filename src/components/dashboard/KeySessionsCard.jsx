// ─── KeySessionsCard.jsx — Standalone surface for eliteProgramKeySessions ───
//
// Surfaces the pure-fn library `src/lib/athlete/eliteProgramKeySessions.js`
// (Daniels 2014 / Coggan 2010 / Pfitzinger 2014 / Maglischo 2003 / Rønnestad
// 2020) directly on the Dashboard from `profile.primarySport`.
//
// Behaviour:
//   - Renders NULL when `profile?.primarySport` is missing or unsupported.
//   - For run / bike / swim / rowing → calls `getKeySessionsBySport(sport)`.
//   - For triathlon → calls `buildTriathlonKeySessions(phase)` per phase and
//     merges swim + bike + run sessions, tagging each with its discipline.
//   - Groups sessions by phase (Base / Build / Peak / Taper) and shows each
//     row with a session-type chip (threshold / VO2 / intervals / long /
//     tempo / strength / recovery) plus the bilingual name.
//   - KEY_SESSION_CITATION rendered in muted small text at the bottom.
//
// Pure presentation — no localStorage, no side effects.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  getKeySessionsBySport,
  buildTriathlonKeySessions,
  KEY_SESSION_CITATION,
} from '../../lib/athlete/eliteProgramKeySessions.js'

const MONO = "'IBM Plex Mono', monospace"
const PHASES = ['Base', 'Build', 'Peak', 'Taper']

// Match the lenient mapping pattern used by MultiPeakSeasonCard so common
// capitalised / English profile values resolve to the lower-case sport keys
// that the pure-fn understands.
const SPORT_FROM_PROFILE = {
  Running: 'run', running: 'run', run: 'run',
  Cycling: 'bike', cycling: 'bike', bike: 'bike', biking: 'bike',
  Swimming: 'swim', swimming: 'swim', swim: 'swim',
  Triathlon: 'triathlon', triathlon: 'triathlon', tri: 'triathlon',
  Rowing: 'rowing', rowing: 'rowing', row: 'rowing',
}

const PHASE_LABEL_TR = {
  Base: 'Temel',
  Build: 'Yapılanma',
  Peak: 'Tepe',
  Taper: 'Dinçlenme',
}

const PHASE_COLOR = {
  Base: '#666666',
  Build: '#0064ff',
  Peak: '#ff6600',
  Taper: '#f5c542',
}

const DISCIPLINE_LABEL = {
  run: { en: 'run', tr: 'koşu' },
  bike: { en: 'bike', tr: 'bisiklet' },
  swim: { en: 'swim', tr: 'yüzme' },
  tri: { en: 'brick', tr: 'brick' },
}

const DISCIPLINE_COLOR = {
  run: '#ff6600',
  bike: '#0064ff',
  swim: '#5bc25b',
  tri: '#a566ff',
}

// Session-type taxonomy (threshold / VO2 / intervals / long / etc.).
// Inferred from the session `key` slug — every entry in the pure-fn library
// follows a `<sport>-<phase>-<type>-<details>` slug convention so this is
// a stable read.
const TYPE_LABEL = {
  threshold:    { en: 'threshold', tr: 'eşik' },
  vo2:          { en: 'VO2max',    tr: 'VO2max' },
  intervals:    { en: 'intervals', tr: 'interval' },
  long:         { en: 'long',      tr: 'uzun' },
  tempo:        { en: 'tempo',     tr: 'tempo' },
  cruise:       { en: 'cruise',    tr: 'cruise' },
  hill:         { en: 'hill',      tr: 'tepe' },
  strides:      { en: 'strides',   tr: 'adım' },
  progression:  { en: 'progression', tr: 'aşamalı' },
  brick:        { en: 'brick',     tr: 'brick' },
  race:         { en: 'race-pace', tr: 'yarış-tempo' },
  shakeout:     { en: 'shakeout',  tr: 'açılış' },
  recovery:     { en: 'recovery',  tr: 'toparlanma' },
  sweetspot:    { en: 'sweet-spot', tr: 'sweet-spot' },
  z2:           { en: 'Z2',        tr: 'Z2' },
  technique:    { en: 'technique', tr: 'teknik' },
  css:          { en: 'CSS',       tr: 'CSS' },
  steady:       { en: 'steady',    tr: 'sabit' },
  primer:       { en: 'primer',    tr: 'açılış' },
  other:        { en: 'key',       tr: 'anahtar' },
}

const TYPE_COLOR = {
  threshold:   '#0064ff',
  vo2:         '#ff6600',
  intervals:   '#ff6600',
  long:        '#5bc25b',
  tempo:       '#0064ff',
  cruise:      '#0064ff',
  hill:        '#a566ff',
  strides:     '#888888',
  progression: '#5bc25b',
  brick:       '#a566ff',
  race:        '#e03030',
  shakeout:    '#888888',
  recovery:    '#5bc25b',
  sweetspot:   '#0064ff',
  z2:          '#5bc25b',
  technique:   '#888888',
  css:         '#0064ff',
  steady:      '#5bc25b',
  primer:      '#f5c542',
  other:       '#888888',
}

function inferType(session) {
  const k = String(session?.key || '').toLowerCase()
  if (k.includes('threshold')) return 'threshold'
  if (k.includes('vo2')) return 'vo2'
  if (k.includes('lactate-clearance')) return 'threshold'
  if (k.includes('cruise')) return 'cruise'
  if (k.includes('hill')) return 'hill'
  if (k.includes('stride')) return 'strides'
  if (k.includes('progression')) return 'progression'
  if (k.includes('brick')) return 'brick'
  if (k.includes('race-sim') || k.includes('race-pace') || k.includes('race-simulation')) return 'race'
  if (k.includes('shakeout')) return 'shakeout'
  if (k.includes('recovery')) return 'recovery'
  if (k.includes('sweetspot') || k.includes('sweet-spot')) return 'sweetspot'
  if (k.includes('tempo')) return 'tempo'
  if (k.includes('long')) return 'long'
  if (k.includes('z2')) return 'z2'
  if (k.includes('technique') || k.includes('drill')) return 'technique'
  if (k.includes('css')) return 'css'
  if (k.includes('steady')) return 'steady'
  if (k.includes('primer')) return 'primer'
  if (k.includes('interval')) return 'intervals'
  return 'other'
}

function isSupported(sportKey) {
  return sportKey === 'run' || sportKey === 'bike' || sportKey === 'swim'
    || sportKey === 'triathlon' || sportKey === 'rowing'
}

export default function KeySessionsCard({ profile }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const raw = profile?.primarySport
  const sport = raw ? SPORT_FROM_PROFILE[raw] : null

  const byPhase = useMemo(() => {
    if (!sport || !isSupported(sport)) return null
    if (sport === 'triathlon') {
      const out = {}
      for (const phase of PHASES) {
        const tri = buildTriathlonKeySessions(phase)
        out[phase] = [
          ...(tri.swim || []).map(s => ({ ...s, discipline: 'swim' })),
          ...(tri.bike || []).map(s => ({ ...s, discipline: 'bike' })),
          ...(tri.run  || []).map(s => ({ ...s, discipline: 'run'  })),
        ]
      }
      return out
    }
    return getKeySessionsBySport(sport)
  }, [sport])

  if (!sport || !isSupported(sport) || !byPhase) return null

  const title = isTR ? 'ANAHTAR SEANS KÜTÜPHANESİ' : 'KEY SESSION LIBRARY'
  const ariaLabel = isTR ? 'Anahtar seans kütüphanesi' : 'Key session library'
  const subTitle = isTR
    ? 'Faz başına temel antrenmanlar — yarış hazırlığının iskeleti.'
    : 'Core workouts per phase — the skeleton of race preparation.'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-key-sessions-card={sport}
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
      <div style={{ marginBottom: 6 }}>
        <span style={{ color: '#ff6600', marginRight: 6 }}>◆</span>
        <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8, fontSize: 10 }}>
          · {(isTR ? 'spor: ' : 'sport: ') + sport}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
        {subTitle}
      </div>

      {PHASES.map(phase => {
        const sessions = byPhase[phase] || []
        if (sessions.length === 0) return null
        const phaseColor = PHASE_COLOR[phase] || '#888'
        const phaseLabel = isTR ? PHASE_LABEL_TR[phase] : phase
        return (
          <div
            key={phase}
            data-key-session-phase={phase}
            style={{ marginBottom: 10 }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
              borderBottom: `1px solid ${phaseColor}55`, paddingBottom: 2,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: 2,
                background: `${phaseColor}55`, border: `1px solid ${phaseColor}`,
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700, color: phaseColor,
                letterSpacing: '0.05em',
              }}>
                {phaseLabel.toUpperCase()}
              </span>
              <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 4 }}>
                · {sessions.length}
              </span>
            </div>

            {sessions.map((s, idx) => {
              const type = inferType(s)
              const typeColor = TYPE_COLOR[type] || '#888'
              const typeLbl = (isTR ? TYPE_LABEL[type]?.tr : TYPE_LABEL[type]?.en) || type
              const name = isTR ? s?.name?.tr : s?.name?.en
              const purpose = isTR ? s?.purpose?.tr : s?.purpose?.en
              const intensity = isTR ? s?.intensity?.tr : s?.intensity?.en
              const discipline = s?.discipline
              const discLbl = discipline
                ? (isTR ? DISCIPLINE_LABEL[discipline]?.tr : DISCIPLINE_LABEL[discipline]?.en)
                : null
              const discColor = discipline ? DISCIPLINE_COLOR[discipline] : null
              return (
                <div
                  key={s?.key || `${phase}-${idx}`}
                  data-key-session-type={type}
                  data-key-session-key={s?.key}
                  style={{
                    padding: '6px 4px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    flexWrap: 'wrap', marginBottom: 2,
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      padding: '1px 6px', borderRadius: 2,
                      background: `${typeColor}22`,
                      color: typeColor,
                      border: `1px solid ${typeColor}55`,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}>
                      {typeLbl}
                    </span>
                    {discLbl ? (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        padding: '1px 6px', borderRadius: 2,
                        background: `${discColor}22`,
                        color: discColor,
                        border: `1px solid ${discColor}55`,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}>
                        {discLbl}
                      </span>
                    ) : null}
                    <span style={{
                      fontSize: 11, color: 'var(--text)', fontWeight: 600,
                    }}>
                      {name || s?.key}
                    </span>
                  </div>
                  {purpose ? (
                    <div style={{
                      fontSize: 10, color: 'var(--muted)', lineHeight: 1.45,
                      marginBottom: 2,
                    }}>
                      {purpose}
                    </div>
                  ) : null}
                  {intensity ? (
                    <div style={{
                      fontSize: 10, color: 'var(--text)', lineHeight: 1.45,
                      opacity: 0.85,
                    }}>
                      <span style={{ color: 'var(--muted)' }}>
                        {isTR ? 'şiddet: ' : 'intensity: '}
                      </span>
                      {intensity}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}

      <div
        data-key-sessions-citation
        style={{
          marginTop: 8,
          fontSize: 9,
          color: '#555',
          fontStyle: 'italic',
          lineHeight: 1.4,
        }}
      >
        {KEY_SESSION_CITATION}
      </div>
    </div>
  )
}
