// ─── RaceStrategyCard.jsx — Standalone race-day strategy (v9.188.0) ─────────
//
// v9.183.0 surfaced `buildRaceStrategy` inside `EliteProgramCard` as
// `RaceStrategyBlock`. That works for athletes who have generated a
// program — but not for newcomers, athletes between programs, or
// athletes doing free training. They have a race coming up and want
// pacing/opener/closer/fueling/gear guidance independent of any plan.
//
// This standalone card mirrors the in-program block but derives sport
// from `profile.primarySport` and does not require a program. Race-
// format selection persists per-sport to localStorage. The selection
// key is the SAME (`sporeus-eliteProgram-raceStrategy`) so an athlete
// who picks "road" here sees it pre-selected when they later open the
// in-program block — and vice-versa.

import { useContext, useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { buildRaceStrategy, RACE_TYPES } from '../../lib/athlete/raceStrategy.js'

const STORAGE_KEY = 'sporeus-eliteProgram-raceStrategy'
const MONO = "'IBM Plex Mono', monospace"

const SPORT_FROM_PROFILE = {
  Running: 'run', running: 'run', run: 'run',
  Cycling: 'bike', cycling: 'bike', bike: 'bike',
  Swimming: 'swim', swimming: 'swim', swim: 'swim',
  Triathlon: 'triathlon', triathlon: 'triathlon',
  Rowing: 'rowing', rowing: 'rowing',
}

const RACE_TYPE_LABEL = {
  // run
  track: { en: 'Track', tr: 'Pist' },
  road:  { en: 'Road',  tr: 'Yol' },
  trail: { en: 'Trail', tr: 'Patika' },
  ultra: { en: 'Ultra', tr: 'Ultra' },
  xc:    { en: 'XC',    tr: 'XC' },
  // bike
  tt:           { en: 'Time Trial',  tr: 'Zaman Denemesi' },
  crit:         { en: 'Criterium',   tr: 'Kriteryum' },
  'gran-fondo': { en: 'Gran Fondo',  tr: 'Gran Fondo' },
  mtb:          { en: 'MTB',         tr: 'MTB' },
  // swim
  pool:         { en: 'Pool',        tr: 'Havuz' },
  'open-water': { en: 'Open Water',  tr: 'Açık Su' },
  // triathlon
  sprint:       { en: 'Sprint',      tr: 'Sprint' },
  olympic:      { en: 'Olympic',     tr: 'Olimpik' },
  '70.3':       { en: 'Half (70.3)', tr: 'Yarım (70.3)' },
  ironman:      { en: 'Ironman',     tr: 'Ironman' },
  // rowing
  '2k':         { en: '2k',          tr: '2k' },
  'head-race':  { en: 'Head Race',   tr: 'Head Race' },
}

export default function RaceStrategyCard({ profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const sport = useMemo(() => {
    const raw = profile?.primarySport || profile?.sport
    return SPORT_FROM_PROFILE[raw] || 'run'
  }, [profile?.primarySport, profile?.sport])

  const [stored, setStored] = useLocalStorage(STORAGE_KEY, {})
  const types = sport ? RACE_TYPES[sport] : null
  if (!sport || !Array.isArray(types) || types.length === 0) return null

  const raceType = stored?.[sport] || ''
  const strategy = raceType ? buildRaceStrategy({ sport, raceType }) : null
  const valid = strategy && !strategy._rejected
  const setRaceType = (rt) => setStored({ ...(stored || {}), [sport]: rt })

  const accent = '#0064ff'
  const title = isTR ? 'YARIŞ GÜNÜ STRATEJİSİ' : 'RACE-DAY STRATEGY'
  const aria = isTR ? 'Yarış stratejisi' : 'Race strategy'

  return (
    <div
      role="region"
      aria-label={aria}
      data-race-strategy-card={raceType || 'unselected'}
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
      <div style={{ fontSize: 11, letterSpacing: '0.08em', fontWeight: 700, color: accent, marginBottom: 8 }}>
        ◇ {title} · {sport.toUpperCase()}
      </div>
      <div style={{ marginBottom: 10 }}>
        <label htmlFor="race-strategy-format" style={{ fontSize: 10, color: 'var(--muted)', marginRight: 6 }}>
          {isTR ? 'Yarış formatı:' : 'Race format:'}
        </label>
        <select
          id="race-strategy-format"
          aria-label={isTR ? 'Yarış formatı seç' : 'Select race format'}
          value={raceType}
          onChange={e => setRaceType(e.target.value)}
          style={{
            fontFamily: MONO, fontSize: 11, padding: '4px 8px',
            background: 'var(--input-bg)', color: 'var(--text)',
            border: '1px solid var(--input-border)', borderRadius: 3,
          }}
        >
          <option value="">{isTR ? '— seç —' : '— select —'}</option>
          {types.map(rt => (
            <option key={rt} value={rt}>
              {RACE_TYPE_LABEL[rt]?.[isTR ? 'tr' : 'en'] || rt}
            </option>
          ))}
        </select>
      </div>
      {valid ? (
        <div data-race-strategy-card-output style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['pacing', isTR ? 'Tempolama' : 'Pacing'],
            ['opener', isTR ? 'Açılış'    : 'Opener'],
            ['closer', isTR ? 'Kapanış'   : 'Closer'],
            ['fueling',isTR ? 'Beslenme'  : 'Fueling'],
            ['gear',   isTR ? 'Ekipman'   : 'Gear'],
          ].map(([key, label]) => (
            <div key={key} style={{ fontSize: 10, lineHeight: 1.55 }}>
              <span style={{ fontWeight: 700, color: accent, marginRight: 6 }}>{label}:</span>
              <span style={{ color: 'var(--text)' }}>{isTR ? strategy[key].tr : strategy[key].en}</span>
            </div>
          ))}
          {Array.isArray(strategy.warnings) && strategy.warnings.length > 0 ? (
            <div style={{ marginTop: 4, padding: 6, background: '#ff660014', border: '1px solid #ff660055', borderRadius: 3 }}>
              {strategy.warnings.map(w => (
                <div key={w.code} style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.5 }}>
                  ⚠ {isTR ? w.tr : w.en}
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ marginTop: 4, fontSize: 9, color: '#555', fontStyle: 'italic' }}>
            {strategy.citation}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
          {isTR
            ? 'Yarış formatını seç — tempolama, açılış, kapanış, beslenme ve ekipman önerileri görünecek.'
            : 'Select a race format — pacing, opener, closer, fueling, and gear guidance will appear.'}
        </div>
      )}
    </div>
  )
}
