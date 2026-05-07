// ─── dashboard/TodayProgrammedSessionCard.jsx — daily-answer surface ─────────
// Reads the saved elite program from localStorage and surfaces TODAY's planned
// session at the top of the dashboard. The "what should I do today?" card.
// Source: getTodayProgrammedSession() — Daniels 2014; Bompa 2009; Mujika 2003.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { getTodayProgrammedSession } from '../../lib/athlete/todayProgrammedSession.js'
import { buildEliteProgram } from '../../lib/athlete/eliteProgram.js'

const PROGRAM_KEY = 'sporeus-eliteProgram'
const START_KEY   = 'sporeus-eliteProgramStart'

const PHASE_LBL = {
  Base:  { en: 'Base',  tr: 'Temel' },
  Build: { en: 'Build', tr: 'Yapı' },
  Peak:  { en: 'Peak',  tr: 'Zirve' },
  Taper: { en: 'Taper', tr: 'Köşeleme' },
}

const INTENT_LBL = {
  rest:      { en: 'REST',      tr: 'DİNLENME' },
  easy:      { en: 'EASY',      tr: 'KOLAY' },
  tempo:     { en: 'TEMPO',     tr: 'TEMPO' },
  threshold: { en: 'THRESHOLD', tr: 'EŞİK' },
  intervals: { en: 'INTERVALS', tr: 'İNTERVAL' },
  long:      { en: 'LONG',      tr: 'UZUN' },
  race:      { en: 'RACE',      tr: 'YARIŞ' },
  other:     { en: 'TRAINING',  tr: 'ANTRENMAN' },
}

function intentText(intent, isTR) {
  if (!intent) return ''
  if (typeof intent === 'string') return intent
  return intent[isTR ? 'tr' : 'en'] || intent.en || ''
}

function ZonesMiniBar({ zones }) {
  const total = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].reduce((a, k) => a + (Number(zones?.[k]) || 0), 0)
  if (total <= 0) return null
  const colors = { Z1: '#3a8e3a', Z2: '#67b04a', Z3: '#f5c542', Z4: '#ff9500', Z5: '#dc3545' }
  return (
    <div role="img" aria-label="zone distribution"
      style={{ display: 'flex', width: '100%', height: '8px', borderRadius: '2px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(k => {
        const v = Number(zones?.[k]) || 0
        if (v <= 0) return null
        return <div key={k} style={{ flex: `${v} 0 0`, background: colors[k] }} />
      })}
    </div>
  )
}

function ZonesLegend({ zones, isTR }) {
  const total = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].reduce((a, k) => a + (Number(zones?.[k]) || 0), 0)
  if (total <= 0) return null
  return (
    <div style={{ ...S.mono, fontSize: '9px', color: 'var(--sub, var(--muted))', marginTop: '4px', letterSpacing: '0.04em' }}>
      {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].filter(k => Number(zones?.[k]) > 0).map(k => (
        <span key={k} style={{ marginRight: '8px' }}>
          {k}:{zones[k]}{isTR ? 'dk' : 'min'}
        </span>
      ))}
    </div>
  )
}

export default function TodayProgrammedSessionCard() {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [persisted] = useLocalStorage(PROGRAM_KEY, null)
  const [startOverride] = useLocalStorage(START_KEY, null)

  const session = useMemo(() => {
    if (!persisted?.input) return null
    const programStart = persisted.input?.options?.today || startOverride || null
    // Reconstruct enough of program shape on the fly
    try {
      const result = buildEliteProgram(persisted.input)
      if (!result || result._rejected) return null
      return getTodayProgrammedSession(result, undefined, programStart)
    } catch {
      return null
    }
  }, [persisted, startOverride])

  const ariaLabel = isTR ? "Bugünün planlı seansı" : "Today's planned session"
  const titleEN = "TODAY'S SESSION"
  const titleTR = 'BUGÜNÜN SEANSI'
  const cardBase = { ...S.card, animationDelay: '80ms', padding: '20px' }

  // ── No program saved ──────────────────────────────────────────────────────
  if (!persisted?.input) {
    return (
      <div className="sp-card" role="region" aria-label={ariaLabel}
        style={{ ...cardBase, borderLeft: '4px solid #6c757d' }}>
        <div style={S.cardTitle}>{titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}</div>
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub, var(--muted))', lineHeight: 1.7 }}>
          {isTR
            ? 'Bugünün seansını görmek için bir plan oluştur'
            : "Generate a plan to see today's session"}
          <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
          {isTR
            ? "Generate a plan to see today's session"
            : 'Bugünün seansını görmek için bir plan oluştur'}
        </div>
      </div>
    )
  }

  if (!session) return null

  // ── Before/after window ──────────────────────────────────────────────────
  if (session.reliable === false) {
    const accent = '#6c757d'
    return (
      <div className="sp-card" role="region" aria-label={ariaLabel}
        style={{ ...cardBase, borderLeft: `4px solid ${accent}` }}>
        <div style={S.cardTitle}>{titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}</div>
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.7, marginBottom: '6px' }}>
          {session.message?.en}
          <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
          {session.message?.tr}
        </div>
        {session.recommendation ? (
          <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', lineHeight: 1.6 }}>
            {session.recommendation.en}
            <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
            {session.recommendation.tr}
          </div>
        ) : null}
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '8px' }}>{session.citation}</div>
      </div>
    )
  }

  const accent = session.intentColor || '#0064ff'
  const phaseLbl = PHASE_LBL[session.phase]?.[isTR ? 'tr' : 'en'] || session.phase
  const intentLblObj = INTENT_LBL[session.intentKey] || INTENT_LBL.other
  const intentBadge = intentLblObj[isTR ? 'tr' : 'en']

  // ── Rest day ──────────────────────────────────────────────────────────────
  if (session.isRest) {
    return (
      <div className="sp-card" role="region" aria-label={ariaLabel}
        style={{ ...cardBase, borderLeft: `4px solid ${accent}`, opacity: 0.92 }}>
        <div style={S.cardTitle}>{titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}</div>
        <div aria-live="polite" style={{ ...S.mono, fontSize: '32px', fontWeight: 700, color: accent, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '6px' }}>
          {isTR ? 'DİNLENME' : 'REST'}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.7, marginBottom: '8px' }}>
          {session.message.en}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{session.message.tr}
        </div>
        <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', letterSpacing: '0.04em', marginBottom: '8px' }}>
          {phaseLbl} {isTR ? 'haftası' : 'week'} {session.weekIndex}/{session.weekTotal}
        </div>
        {session.recommendation ? (
          <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.6, paddingLeft: '8px', borderLeft: `2px solid ${accent}`, marginBottom: '8px' }}>
            {session.recommendation[isTR ? 'tr' : 'en']}
          </div>
        ) : null}
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>{session.citation}</div>
      </div>
    )
  }

  // ── Training day ──────────────────────────────────────────────────────────
  return (
    <div className="sp-card" role="region" aria-label={ariaLabel}
      style={{ ...cardBase, borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          {titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}
        </div>
        <span data-testid="intent-badge" style={{ ...S.mono, fontSize: '10px', fontWeight: 700, color: '#fff', background: accent, padding: '4px 10px', borderRadius: '3px', letterSpacing: '0.08em' }}>
          {intentBadge}
        </span>
      </div>

      <div aria-live="polite" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
        <div style={{ ...S.mono, fontSize: '36px', fontWeight: 700, color: accent, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {session.durationMin}
        </div>
        <div style={{ ...S.mono, fontSize: '12px', color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {isTR ? 'DK' : 'MIN'}
        </div>
      </div>

      <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.7, marginBottom: '4px' }}>
        {intentText(session.intent, isTR)}
      </div>
      <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', letterSpacing: '0.04em', marginBottom: '10px' }}>
        {phaseLbl} {isTR ? 'haftası' : 'week'} {session.weekIndex}/{session.weekTotal}
      </div>

      {session.paceTarget ? (
        <div style={{ ...S.mono, fontSize: '14px', fontWeight: 600, color: accent, marginBottom: '10px' }}>
          {isTR ? 'TEMPO' : 'PACE'}: {session.paceTarget}
        </div>
      ) : null}

      <ZonesMiniBar zones={session.zones} />
      <ZonesLegend zones={session.zones} isTR={isTR} />

      {session.notes && (session.notes.en || session.notes.tr) ? (
        <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', lineHeight: 1.6, marginTop: '8px' }}>
          {session.notes.en}
          {session.notes.en && session.notes.tr ? <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span> : null}
          {session.notes.tr}
        </div>
      ) : null}

      {session.recommendation ? (
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.6, paddingLeft: '8px', borderLeft: `2px solid ${accent}`, marginTop: '10px', marginBottom: '6px' }}>
          {session.recommendation[isTR ? 'tr' : 'en']}
        </div>
      ) : null}

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>{session.citation}</div>
    </div>
  )
}
