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
import { buildEliteProgramAutopsy } from '../../lib/athlete/eliteProgramAutopsy.js'
import { announce } from '../../lib/a11y/announcer.js'

// ── v8.98.0 — make-up suggestion helpers ─────────────────────────────────────
// Detect prescribed key intent from a sample-week intent label.
const MAKEUP_INTENT_LBL = {
  long:      { en: 'long run',    tr: 'uzun koşu' },
  threshold: { en: 'threshold',   tr: 'eşik' },
  intervals: { en: 'intervals',   tr: 'interval' },
}
function makeupKeyIntent(intentLabel) {
  if (!intentLabel) return null
  const txt = (typeof intentLabel === 'string'
    ? intentLabel
    : (intentLabel.en || '')
  ).toLowerCase()
  if (/long/.test(txt)) return 'long'
  if (/threshold|tempo|cruise/.test(txt)) return 'threshold'
  if (/interval|vo2|race-pace/.test(txt)) return 'intervals'
  return null
}
function logIntentKey(entry) {
  if (!entry || typeof entry !== 'object') return null
  const blob = `${entry.type || ''} ${entry.intent || ''} ${entry.notes || ''} ${entry.session || ''}`.toLowerCase()
  if (/long/.test(blob)) return 'long'
  if (/threshold|tempo|cruise/.test(blob)) return 'threshold'
  if (/interval|vo2|race-pace|repetition/.test(blob)) return 'intervals'
  return null
}

const PROGRAM_KEY = 'sporeus-eliteProgram'
const START_KEY   = 'sporeus-eliteProgramStart'

const VERDICT_COLOR = {
  'beat-target':     '#28a745',
  'on-target':       '#0064ff',
  'shortfall':       '#ff9500',
  'major-shortfall': '#dc3545',
}

const VERDICT_LBL = {
  'beat-target':     { en: 'BEAT TARGET',     tr: 'HEDEFİ GEÇTİ' },
  'on-target':       { en: 'ON TARGET',       tr: 'HEDEFE TUTTU' },
  'shortfall':       { en: 'SHORTFALL',       tr: 'EKSİK KALDI' },
  'major-shortfall': { en: 'MAJOR SHORTFALL', tr: 'ÇOK EKSİK' },
}

function fmtMmSs(sec) {
  if (sec == null || !isFinite(sec) || sec <= 0) return '—'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

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

export default function TodayProgrammedSessionCard({ log = [] } = {}) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [persisted, setPersisted] = useLocalStorage(PROGRAM_KEY, null)
  const [startOverride, setStartOverride] = useLocalStorage(START_KEY, null)

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

  const autopsy = useMemo(() => {
    if (!persisted?.input) return null
    if (!session || session.reliable !== false || session.reason !== 'after') return null
    try {
      return buildEliteProgramAutopsy({ input: persisted.input }, log)
    } catch {
      return null
    }
  }, [persisted, session, log])

  // ── v8.98.0 — make-up suggestion ──────────────────────────────────────────
  // When today's prescribed intent is easy or rest AND a key session was
  // prescribed in the last 2 days but no matching log entry exists, surface a
  // small "MAKE-UP" sub-block at the bottom of the card.
  const makeupSuggestion = useMemo(() => {
    if (!session || session.reliable === false) return null
    if (!persisted?.input) return null
    // Only suggest swap when today is easy or rest
    const todayKey = session.intentKey
    if (todayKey !== 'easy' && todayKey !== 'rest') return null

    let result
    try {
      result = buildEliteProgram(persisted.input)
    } catch {
      return null
    }
    if (!result || result._rejected) return null
    const sample = result.sampleWeeks?.[session.phase]
    if (!Array.isArray(sample) || sample.length === 0) return null

    // Today's day name (Mon..Sun) inferred from session — not exposed directly,
    // so derive from current date.
    const todayDate = new Date()
    const todayJsDow = todayDate.getUTCDay() // 0=Sun..6=Sat
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const jsDowToIdx = (d) => (d === 0 ? 6 : d - 1)
    const todayIdx = jsDowToIdx(todayJsDow)

    // Walk the last 2 prescribed days (today-1, today-2).
    for (let back = 1; back <= 2; back++) {
      const checkIdx = (todayIdx - back + 7) % 7
      const dayName = dayOrder[checkIdx]
      const dayPlan = sample.find(d => d?.day === dayName)
      if (!dayPlan) continue
      const ki = makeupKeyIntent(dayPlan.intent)
      if (!ki) continue
      // Compute that calendar date and check log for a matching entry within
      // ±1 day.
      const target = new Date(todayDate)
      target.setUTCDate(target.getUTCDate() - back)
      const targetMs = target.getTime()
      const tolMs = 1 * 86400000
      const safeLog = Array.isArray(log) ? log : []
      const matched = safeLog.some(e => {
        if (!e || typeof e !== 'object') return false
        const ds = (e.date || '').slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false
        const d = new Date(`${ds}T00:00:00Z`)
        if (isNaN(d.getTime())) return false
        if (Math.abs(d.getTime() - targetMs) > tolMs) return false
        return logIntentKey(e) === ki
      })
      if (!matched) {
        return {
          intent: ki,
          missedDate: target.toISOString().slice(0, 10),
          missedDay: dayName,
        }
      }
    }
    return null
  }, [session, persisted, log])

  function handleNextCycle() {
    if (!autopsy || !persisted?.input) return
    const sport = persisted.input.sport
    const next = autopsy.nextCyclePR
    const actualTime = autopsy.foundRace?.timeSec
    const form = {
      sport,
      currentDist: next.distanceM,
      currentTime: fmtMmSs(actualTime),
      targetDist:  next.distanceM,
      targetTime:  fmtMmSs(next.timeSec),
      raceDate: '',
    }
    try {
      setPersisted({ input: null, form })
      setStartOverride(null)
    } catch {
      announce(isTR ? 'Depolama başarısız' : 'Storage failed')
      return
    }
    announce(isTR
      ? 'Yeni döngü formu hazırlandı. Yeni yarış tarihi için Elite Program kartını aç'
      : 'Next-cycle form prepared. Open Elite Program card to set new race date.')
  }

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
    // After-window: try to surface the race-result autopsy
    if (session.reason === 'after' && autopsy) {
      const vAccent = VERDICT_COLOR[autopsy.verdict] || '#6c757d'
      const vLblObj = VERDICT_LBL[autopsy.verdict] || { en: '', tr: '' }
      const vLbl = vLblObj[isTR ? 'tr' : 'en']
      const actualStr = fmtMmSs(autopsy.foundRace?.timeSec)
      const pctStr = `${(autopsy.pctOfTarget * 100).toFixed(1)}%`
      const levelStr =
        autopsy.actualLevel?.vdot != null ? `VDOT ${autopsy.actualLevel.vdot}`
        : autopsy.actualLevel?.ftp != null ? `FTP ${autopsy.actualLevel.ftp}W`
        : autopsy.actualLevel?.css != null ? `CSS ${autopsy.actualLevel.css}s/100m`
        : ''
      return (
        <div className="sp-card" role="region" aria-label={ariaLabel}
          style={{ ...cardBase, borderLeft: `4px solid ${vAccent}` }}>
          <div style={S.cardTitle}>{titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}</div>
          <span data-testid="autopsy-verdict-pill"
            aria-label={`${isTR ? 'yarış sonucu' : 'race result'}: ${vLblObj.en}`}
            style={{ display: 'inline-block', ...S.mono, fontSize: '10px', fontWeight: 700, color: '#fff', background: vAccent, padding: '4px 10px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '8px' }}>
            {vLbl}
          </span>
          <div aria-live="polite" style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <div style={{ ...S.mono, fontSize: '28px', fontWeight: 700, color: vAccent, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {actualStr}
            </div>
            <div style={{ ...S.mono, fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
              {isTR ? 'HEDEF' : 'TARGET'} {pctStr}
            </div>
            {levelStr ? (
              <div style={{ ...S.mono, fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
                {levelStr}
              </div>
            ) : null}
          </div>
          <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.7, marginBottom: '6px' }}>
            {autopsy.message.en}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{autopsy.message.tr}
          </div>
          <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.6, paddingLeft: '8px', borderLeft: `2px solid ${vAccent}`, marginBottom: '10px' }}>
            {autopsy.recommendation.en}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{autopsy.recommendation.tr}
          </div>
          <button type="button"
            data-testid="next-cycle-btn"
            onClick={handleNextCycle}
            aria-label={isTR ? 'Yeni döngü oluştur' : 'Generate next cycle'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', padding: '8px 14px', background: vAccent, color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', minHeight: '34px' }}>
            {isTR ? 'YENİ DÖNGÜ OLUŞTUR' : 'GENERATE NEXT CYCLE'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'GENERATE NEXT CYCLE' : 'YENİ DÖNGÜ OLUŞTUR'}
          </button>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '8px' }}>{autopsy.citation}</div>
        </div>
      )
    }

    const accent = '#6c757d'
    const isAfter = session.reason === 'after'
    const raceDate = persisted?.input?.raceDate
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
        {isAfter && raceDate ? (
          <div data-testid="log-it-nudge" style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', lineHeight: 1.6, marginTop: '8px' }}>
            {isTR
              ? `Günlüğünde ${raceDate} civarında bir yarış sonucu bulamadık. Tam autopsi için yarışını günlüğe ekle.`
              : `We didn't find a race result in your log near ${raceDate}. Log it to see your full autopsy.`}
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

  const makeupBlock = makeupSuggestion ? (() => {
    const lbl = MAKEUP_INTENT_LBL[makeupSuggestion.intent] || { en: makeupSuggestion.intent, tr: makeupSuggestion.intent }
    const dayEN = makeupSuggestion.missedDay
    const swap = session.intentKey === 'rest'
      ? null
      : (isTR ? "Bugün taze hissediyorsan kolay seansla yer değiştir." : "If feeling fresh, swap with today's easy run.")
    return (
      <div data-testid="makeup-suggestion" data-intent={makeupSuggestion.intent}
        style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', lineHeight: 1.6, marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
        <div style={{ fontSize: '9px', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '4px' }}>
          {isTR ? 'TELAFİ' : 'MAKE-UP'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'MAKE-UP' : 'TELAFİ'}
        </div>
        <div>
          {isTR
            ? `${dayEN} günü planlanan ${lbl.tr} seansı kayıtta yok.`
            : `You missed ${dayEN}'s ${lbl.en} session.`}
          {swap ? <> {swap}</> : null}
        </div>
      </div>
    )
  })() : null

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
        {makeupBlock}
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

      {makeupBlock}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>{session.citation}</div>
    </div>
  )
}
