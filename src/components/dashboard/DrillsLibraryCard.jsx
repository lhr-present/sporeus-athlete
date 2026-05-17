// ─── DrillsLibraryCard.jsx — Sport-specific technique drills per phase ──────
//
// Surfaces `buildDrillsLibrary` from src/lib/athlete/eliteProgramDrills.js,
// which is grounded in Daniels 2014, Pfitzinger 2014, Maglischo 2003,
// Counsilman 1968, Coggan & Allen 2010 (plus Nolte 2005 for rowing).
//
// The pure-fn shipped with the v9.9.0 elite-program work but had no
// standalone Dashboard surface — this card renders it grouped by phase
// (Base / Build / Peak / Taper) for the athlete's primary sport.
//
// Behaviour:
//   - Renders NULL if profile.primarySport is missing or unsupported.
//   - Groups drills by phase; each phase block lists drills with their
//     uppercased name, purpose, dose (structure), and a short cue.
//   - Bilingual EN/TR section headers via LangCtx; drill copy itself is
//     pulled directly from the pure-fn (EN+TR objects already inside it).
//   - DRILLS_CITATION rendered as muted small text at the bottom.
//   - The drill list is collapsible to keep the dashboard tidy on small
//     screens; the first drill row is always present in the DOM so tests
//     and screen readers can inspect it without expanding.

import { useContext, useMemo, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  buildDrillsLibrary,
  DRILLS_CITATION,
} from '../../lib/athlete/eliteProgramDrills.js'

const MONO = "'IBM Plex Mono', monospace"

// Strict whitelist — the pure-fn's `LIBRARY` keys plus the `triathlon`
// merge special case. Anything else → render null per spec.
const SPORT_FROM_PROFILE = {
  Running: 'run',   running: 'run',   run: 'run',
  Cycling: 'bike',  cycling: 'bike',  bike: 'bike',
  Swimming: 'swim', swimming: 'swim', swim: 'swim',
  Triathlon: 'triathlon', triathlon: 'triathlon',
  Rowing: 'rowing', rowing: 'rowing', row: 'rowing',
}

const ALL_PHASES = [
  { phase: 'Base' },
  { phase: 'Build' },
  { phase: 'Peak' },
  { phase: 'Taper' },
]

const PHASE_LABEL = {
  Base:  { en: 'BASE',  tr: 'TEMEL' },
  Build: { en: 'BUILD', tr: 'YAPILANMA' },
  Peak:  { en: 'PEAK',  tr: 'TEPE' },
  Taper: { en: 'TAPER', tr: 'DİNÇLENME' },
}

const PHASE_COLOR = {
  Base:  '#666666',
  Build: '#0064ff',
  Peak:  '#ff6600',
  Taper: '#f5c542',
}

const DISCIPLINE_COLOR = {
  run:  '#ff6600',
  bike: '#0064ff',
  swim: '#5bc25b',
  tri:  '#e03030',
}

export default function DrillsLibraryCard({ profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const sport = useMemo(() => {
    const raw = profile?.primarySport || profile?.sport
    if (!raw) return null
    return SPORT_FROM_PROFILE[raw] || null
  }, [profile?.primarySport, profile?.sport])

  const library = useMemo(() => {
    if (!sport) return null
    return buildDrillsLibrary({ sport, phases: ALL_PHASES })
  }, [sport])

  const totalDrills = useMemo(() => {
    if (!library) return 0
    return ['Base', 'Build', 'Peak', 'Taper']
      .reduce((sum, p) => sum + (library[p]?.length || 0), 0)
  }, [library])

  const [expanded, setExpanded] = useState(false)

  // Render nothing for unsupported / missing sport, or if the pure-fn
  // surprised us with an empty library.
  if (!sport || !library || totalDrills === 0) return null

  const title = isTR ? 'TEKNİK DRİL KÜTÜPHANESİ' : 'DRILLS LIBRARY'
  const ariaLabel = isTR
    ? 'Spora özel teknik drilleri'
    : 'Sport-specific technique drills library'
  const subtitle = isTR
    ? `${totalDrills} dril · ${sport}`
    : `${totalDrills} drills · ${sport}`
  const purposeLabel = isTR ? 'Amaç' : 'Purpose'
  const doseLabel    = isTR ? 'Doz'  : 'Dose'
  const cueLabel     = isTR ? 'İpucu' : 'Cue'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-drills-library-card={expanded ? 'expanded' : 'collapsed'}
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
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
        style={{
          background: 'transparent', border: 'none', color: 'var(--text)',
          cursor: 'pointer', fontFamily: MONO, fontSize: 12,
          letterSpacing: '0.06em', padding: 0, textAlign: 'left', width: '100%',
        }}
      >
        <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
        <span style={{ fontWeight: 700 }}>{title}</span>
        <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8, fontSize: 10 }}>
          · {subtitle} {expanded ? '▾' : '▸'}
        </span>
      </button>

      <div
        style={{
          marginTop: 12,
          maxHeight: expanded ? 'none' : 220,
          overflowY: expanded ? 'visible' : 'auto',
        }}
      >
        {['Base', 'Build', 'Peak', 'Taper'].map(phase => {
          const drills = library[phase] || []
          if (drills.length === 0) return null
          const color = PHASE_COLOR[phase] || '#888'
          const labelEN = PHASE_LABEL[phase].en
          const labelTR = PHASE_LABEL[phase].tr
          return (
            <div
              key={phase}
              data-drills-phase={phase}
              style={{ marginBottom: 14 }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  color,
                  fontWeight: 700,
                  borderBottom: `1px solid ${color}55`,
                  paddingBottom: 4,
                  marginBottom: 8,
                }}
              >
                {isTR ? labelTR : labelEN}
                <span
                  style={{
                    color: 'var(--muted)',
                    fontWeight: 400,
                    fontSize: 9,
                    marginLeft: 6,
                    letterSpacing: 'normal',
                  }}
                >
                  ({drills.length})
                </span>
              </div>

              {drills.map((d, idx) => {
                const name      = isTR ? d.name.tr      : d.name.en
                const purpose   = isTR ? d.purpose.tr   : d.purpose.en
                const structure = isTR ? d.structure.tr : d.structure.en
                const discColor = d.discipline ? DISCIPLINE_COLOR[d.discipline] : null
                return (
                  <div
                    key={`${phase}-${d.key}-${idx}`}
                    data-drill-name={d.key}
                    data-drill-phase={phase}
                    style={{
                      padding: '8px 10px',
                      marginBottom: 6,
                      background: 'var(--surface, #141414)',
                      border: '1px solid var(--border, #222)',
                      borderLeft: `3px solid ${discColor || color}`,
                      borderRadius: 3,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          color: 'var(--text)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {name}
                      </div>
                      {d.discipline ? (
                        <span
                          data-drill-discipline={d.discipline}
                          style={{
                            fontSize: 8,
                            padding: '1px 5px',
                            borderRadius: 2,
                            background: `${discColor}22`,
                            border: `1px solid ${discColor}66`,
                            color: discColor,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {d.discipline}
                        </span>
                      ) : null}
                      <span
                        style={{
                          fontSize: 9,
                          color: 'var(--muted)',
                          marginLeft: 'auto',
                        }}
                      >
                        ×{d.frequencyPerWeek}/wk
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text)',
                        lineHeight: 1.5,
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ color: 'var(--muted)', marginRight: 4 }}>
                        {purposeLabel}:
                      </span>
                      {purpose}
                    </div>

                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text)',
                        lineHeight: 1.5,
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ color: 'var(--muted)', marginRight: 4 }}>
                        {doseLabel}:
                      </span>
                      {structure}
                    </div>

                    {d.citation ? (
                      <div
                        style={{
                          fontSize: 9,
                          color: 'var(--muted)',
                          fontStyle: 'italic',
                        }}
                      >
                        <span style={{ marginRight: 4 }}>{cueLabel}:</span>
                        {d.citation}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div
        style={{
          fontSize: 9,
          color: '#555',
          fontStyle: 'italic',
          marginTop: 6,
          lineHeight: 1.5,
        }}
      >
        {DRILLS_CITATION}
      </div>
    </div>
  )
}
