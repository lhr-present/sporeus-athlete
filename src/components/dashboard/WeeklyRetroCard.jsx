// ─── dashboard/WeeklyRetroCard.jsx — Last-week retrospective digest ──────────
// Compact card shown every Monday (or always) with last week's key numbers.
// Bridges useAdaptivePlan adherence data with recovery and session summaries.
import { memo, useMemo, useContext } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { useAdaptivePlan } from '../../hooks/useAdaptivePlan.js'

function getMonday(d = new Date()) {
  const day = d.getDay() || 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - day + 1)
  mon.setHours(0, 0, 0, 0)
  return mon.toISOString().slice(0, 10)
}

function getPrevMonday() {
  const d = new Date(getMonday())
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

function sundayOf(mondayStr) {
  const d = new Date(mondayStr)
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

function WeeklyRetroCard({ log, recovery, plan, lang }) {
  const { t } = useContext(LangCtx)
  const { adaptation } = useAdaptivePlan(log, plan)

  const retro = useMemo(() => {
    const prevMon = getPrevMonday()
    const prevSun = sundayOf(prevMon)
    const weekLog = (log || []).filter(e => e.date >= prevMon && e.date <= prevSun)
    if (weekLog.length === 0) return null

    const totalTSS = weekLog.reduce((s, e) => s + (e.tss || 0), 0)
    const totalMin = weekLog.reduce((s, e) => s + (e.duration || 0), 0)
    const topSession = [...weekLog].sort((a, b) => (b.tss || 0) - (a.tss || 0))[0]
    const weekRec = (recovery || []).filter(e => e.date >= prevMon && e.date <= prevSun)
    const avgScore = weekRec.length
      ? Math.round(weekRec.reduce((s, e) => s + (e.score || 0), 0) / weekRec.length)
      : null
    const avgHRV = weekRec.filter(e => (e.hrv || 0) > 0).length
      ? Math.round(weekRec.filter(e => e.hrv > 0).reduce((s, e) => s + e.hrv, 0) / weekRec.filter(e => e.hrv > 0).length)
      : null

    const fromDate = new Date(prevMon).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const toDate   = new Date(prevSun).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

    return { totalTSS, totalMin, sessions: weekLog.length, topSession, avgScore, avgHRV, fromDate, toDate, prevMon }
  }, [log, recovery])

  if (!retro) return null

  const adherence = adaptation?.adherence ?? null
  const adherenceColor = adherence === null ? '#555'
    : adherence >= 80 && adherence <= 120 ? '#5bc25b'
    : adherence > 140 ? '#e03030'
    : '#f5c542'

  const hours = Math.floor(retro.totalMin / 60)
  const mins  = retro.totalMin % 60

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '12ms', borderLeft: '3px solid #0064ff44' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={S.cardTitle}>
          {lang === 'tr' ? 'GEÇEN HAFTA' : 'LAST WEEK'} · {retro.fromDate}–{retro.toDate}
        </div>
        {adherence !== null && (
          <span style={{ ...S.mono, fontSize: '10px', color: adherenceColor, border: `1px solid ${adherenceColor}44`, padding: '2px 7px', borderRadius: '2px' }}>
            {adherence}%
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        {[
          { label: lang === 'tr' ? 'SEANS' : 'SESSIONS',  val: retro.sessions },
          { label: 'TSS',                                   val: retro.totalTSS },
          { label: lang === 'tr' ? 'SÜRE' : 'VOLUME',      val: hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m` },
          avgScore ? { label: lang === 'tr' ? 'HAZIRLIK' : 'READINESS', val: avgScore } : null,
          avgHRV   ? { label: 'HRV', val: `${avgHRV}ms` } : null,
        ].filter(Boolean).map(({ label, val }) => (
          <div key={label} style={{ textAlign: 'center', minWidth: '50px', background: 'var(--surface)', borderRadius: '3px', padding: '4px 8px' }}>
            <div style={{ ...S.mono, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{val}</div>
            <div style={{ ...S.mono, fontSize: '8px', color: '#555', letterSpacing: '0.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {retro.topSession && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#888', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
          {lang === 'tr' ? '↑ En iyi seans:' : '↑ Top session:'}{' '}
          <span style={{ color: 'var(--text)' }}>
            {retro.topSession.type} · {retro.topSession.tss} TSS · {retro.topSession.date}
          </span>
        </div>
      )}

      {adaptation?.message && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#888', marginTop: '6px', lineHeight: 1.6 }}>
          {lang === 'tr' ? adaptation.messageTr : adaptation.message}
        </div>
      )}
    </div>
  )
}

export default memo(WeeklyRetroCard)
