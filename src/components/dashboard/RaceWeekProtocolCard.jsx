// ─── dashboard/RaceWeekProtocolCard.jsx — 7-day race-week protocol surface ──
// Surfaces generateRaceWeekProtocol() when an upcoming race is within 7 days.
// Source: Mujika & Padilla 2003; Bompa 2005.
import { useContext, memo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { generateRaceWeekProtocol } from '../../lib/race/raceWeekProtocol.js'
import { calcLoad } from '../../lib/formulas.js'

// Map free-text profile.goal → canonical race-type accepted by the generator.
// Mirrors the matching pattern in intelligence.js:computeRaceReadiness.
function deriveRaceType(profile) {
  if (profile?.raceType) return profile.raceType
  const goal = (profile?.goal || '').toLowerCase()
  if (!goal) return null
  if (goal.includes('2000') || goal.includes('2k row') || goal.includes('row')) return '2000m Row'
  if (goal.includes('half marathon') || goal.includes('half-marathon') || goal.includes('yarı maraton')) return 'Half Marathon'
  if (goal.includes('marathon') || goal.includes('maraton')) return 'Marathon'
  if (goal.includes('10k')) return '10K'
  if (goal.includes('5k')) return '5K'
  return null
}

function todayUTCISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso + 'T00:00:00Z').getTime()
  const b = new Date(toIso   + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

function RaceWeekProtocolCard({ profile = {}, log = [] }) {
  const { lang } = useContext(LangCtx)
  const tr = lang === 'tr'

  const raceDate = profile?.raceDate
  if (!raceDate || typeof raceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) return null

  const today      = todayUTCISO()
  const daysToRace = daysBetween(today, raceDate)
  if (daysToRace < 0 || daysToRace > 7) return null

  const raceType   = deriveRaceType(profile)
  const { ctl }    = calcLoad(log)
  const result     = generateRaceWeekProtocol({ raceDate, raceType, currentCTL: ctl || undefined })

  const ariaLabel  = tr ? 'Yarış haftası protokolü' : 'Race week protocol'

  if (!result) {
    return (
      <div role="region" aria-label={ariaLabel} className="sp-card" style={{ ...S.card, borderLeft: '4px solid #e03030' }}>
        <div style={S.cardTitle}>{tr ? 'YARIŞ HAFTASI' : 'RACE WEEK'}</div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#e03030', lineHeight: 1.6 }}>
          {tr
            ? 'Bu yarış için yarış-haftası protokolü oluşturulamadı.'
            : 'Cannot generate race-week protocol for this race.'}
        </div>
      </div>
    )
  }

  const todayEntry  = result.protocol.find(p => p.date === today) || null
  const titleNum    = daysToRace
  const isRaceDay   = daysToRace === 0
  const titleText   = isRaceDay
    ? (tr ? 'YARIŞ GÜNÜ!' : 'RACE DAY!')
    : (tr ? `YARIŞ HAFTASI — YARIŞA ${titleNum} GÜN` : `RACE WEEK — ${titleNum} DAYS TO RACE`)

  const fmtIntent = (entry) => {
    if (!entry || !entry.session) return tr ? 'DİNLENME' : 'REST'
    if (entry.session.intent === 'RACE') return tr ? 'YARIŞ' : 'RACE'
    return entry.session.intent.toUpperCase()
  }

  return (
    <div role="region" aria-label={ariaLabel} className="sp-card" style={{ ...S.card, borderLeft: '4px solid #ff6600', background: '#ff660008' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0, color: '#ff6600' }}>
          {titleText}
        </div>
        <div style={{ ...S.mono, textAlign: 'center', minWidth: '54px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#ff6600', lineHeight: 1 }}>{titleNum}</div>
          <div style={{ fontSize: '8px', color: '#888', letterSpacing: '0.08em', marginTop: '2px' }}>
            {tr ? (isRaceDay ? 'GÜN' : 'GÜN KALDI') : (isRaceDay ? 'DAY' : 'DAYS')}
          </div>
        </div>
      </div>

      {/* Today highlight ─────────────────────────────────────────────── */}
      <div aria-live="polite" style={{ padding: '10px', background: 'var(--card-bg)', border: '1px solid #ff660033', borderRadius: '6px', marginBottom: '10px' }}>
        <div style={{ ...S.mono, fontSize: '9px', color: '#ff6600', letterSpacing: '0.08em', marginBottom: '6px' }}>
          {tr ? 'BUGÜN' : 'TODAY'}
        </div>
        {todayEntry?.session ? (
          <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600 }}>
              {fmtIntent(todayEntry)} · {todayEntry.session.duration}{tr ? ' dk' : ' min'} · RPE {todayEntry.session.rpeLow}-{todayEntry.session.rpeHigh} · TSS {todayEntry.session.tssTarget}
            </div>
            <div style={{ color: 'var(--sub)', fontSize: '10px', marginTop: '2px' }}>
              {tr ? todayEntry.session.description.tr : todayEntry.session.description.en}
            </div>
          </div>
        ) : (
          <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)' }}>
            {tr ? 'DİNLENME GÜNÜ' : 'REST DAY'}
          </div>
        )}
        {todayEntry?.sleep && (
          <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub)', marginTop: '6px' }}>
            <span style={{ color: '#0064ff', fontWeight: 600 }}>{tr ? 'UYKU' : 'SLEEP'}:</span> {todayEntry.sleep.targetHours}h
            <span style={{ color: '#888', marginLeft: '6px' }}>· {tr ? todayEntry.sleep.note.tr : todayEntry.sleep.note.en}</span>
          </div>
        )}
        {todayEntry?.nutrition?.length > 0 && (
          <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub)', marginTop: '4px' }}>
            <span style={{ color: '#5bc25b', fontWeight: 600 }}>{tr ? 'BESLENME' : 'NUTRITION'}:</span> {tr ? todayEntry.nutrition[0].tr : todayEntry.nutrition[0].en}
          </div>
        )}
        {todayEntry?.mental?.length > 0 && (
          <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub)', marginTop: '4px' }}>
            <span style={{ color: '#f5c542', fontWeight: 600 }}>{tr ? 'ZİHİN' : 'MENTAL'}:</span> {tr ? todayEntry.mental[0].tr : todayEntry.mental[0].en}
          </div>
        )}
      </div>

      {/* 7-day strip ─────────────────────────────────────────────────── */}
      <div role="list" style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {result.protocol.map(p => {
          const isToday = p.date === today
          const intent  = fmtIntent(p)
          const dayLbl  = p.dayOffset === 0 ? (tr ? 'YARIŞ' : 'RACE') : `D${p.dayOffset}`
          const ariaDay = tr
            ? `Gün ${p.dayOffset === 0 ? 'yarış' : p.dayOffset}: ${intent}`
            : `Day ${p.dayOffset === 0 ? 'race' : p.dayOffset}: ${intent}`
          return (
            <div
              key={p.date}
              role="listitem"
              aria-label={ariaDay}
              style={{
                flex: '1 1 60px',
                minWidth: '60px',
                padding: '6px 4px',
                textAlign: 'center',
                background: isToday ? '#ff660022' : 'var(--card-bg)',
                border: `1px solid ${isToday ? '#ff6600' : 'var(--border)'}`,
                borderRadius: '4px',
              }}
            >
              <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.06em' }}>{dayLbl}</div>
              <div style={{ ...S.mono, fontSize: '9px', fontWeight: 600, color: isToday ? '#ff6600' : 'var(--text)', marginTop: '2px', wordBreak: 'break-word', lineHeight: 1.3 }}>
                {intent}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ ...S.mono, fontSize: '8px', color: '#888', letterSpacing: '0.04em', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(RaceWeekProtocolCard)
