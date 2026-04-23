// ─── dashboard/PhaseAnalyticsCard.jsx — Training block phase progress ─────────
// Shows current periodization phase, CTL progress since phase start, and
// phase compliance (actual vs planned TSS for weeks completed so far).
import { memo, useMemo, useContext } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { calcLoad } from '../../lib/formulas.js'
import { MACRO_PHASES } from '../../lib/constants.js'

const PHASE_COLOR = {
  'Base 1': '#0064ff', 'Base 2': '#0064ff',
  'Build 1': '#ff6600', 'Build 2': '#ff6600',
  'Peak 1': '#e03030', 'Peak 2': '#e03030',
  'Recovery': '#5bc25b',
  'Taper': '#f5c542',
  'Race': '#e03030',
}

function PhaseAnalyticsCard({ log, plan, lang }) {
  const { t } = useContext(LangCtx)

  const data = useMemo(() => {
    if (!plan?.start_date || !plan?.weeks?.length) return null
    const today = new Date()
    const planStart = new Date(plan.start_date)
    const weekIndex = Math.floor((today - planStart) / (7 * 86400000))
    if (weekIndex < 0 || weekIndex >= plan.weeks.length) return null

    const macroPhase = MACRO_PHASES[Math.min(weekIndex, MACRO_PHASES.length - 1)]
    const phaseName = macroPhase?.phase || `Week ${weekIndex + 1}`
    const phaseColor = PHASE_COLOR[phaseName] || '#888'

    // Find phase start week (first week with same phase name)
    let phaseStartWeek = weekIndex
    while (phaseStartWeek > 0 && MACRO_PHASES[phaseStartWeek - 1]?.phase === phaseName) {
      phaseStartWeek--
    }
    const weekInPhase = weekIndex - phaseStartWeek + 1
    const phaseTotalWeeks = MACRO_PHASES.filter(p => p.phase === phaseName).length

    // CTL at phase start vs now
    const { daily } = calcLoad(log)
    const phaseStartDate = new Date(planStart)
    phaseStartDate.setDate(phaseStartDate.getDate() + phaseStartWeek * 7)
    const phaseStartKey = phaseStartDate.toISOString().slice(0, 10)
    const startEntry = daily.find(d => d.date === phaseStartKey)
      || daily.slice().reverse().find(d => d.date <= phaseStartKey)
    const startCTL = startEntry ? Math.round(startEntry.ctl) : null
    const currentCTL = daily.length ? Math.round(daily[daily.length - 1].ctl) : null
    const ctlDelta = startCTL !== null && currentCTL !== null ? currentCTL - startCTL : null

    // Phase compliance: actual TSS vs planned for completed weeks in this phase
    let plannedPhase = 0, actualPhase = 0
    for (let wi = phaseStartWeek; wi <= weekIndex; wi++) {
      const plannedWeek = plan.weeks[wi]
      const weekPlanned = plannedWeek?.TSS || plannedWeek?.tss || 0
      plannedPhase += weekPlanned

      // Actual TSS for that week
      const wStart = new Date(planStart)
      wStart.setDate(wStart.getDate() + wi * 7)
      const wEnd = new Date(wStart)
      wEnd.setDate(wEnd.getDate() + 7)
      const wStartKey = wStart.toISOString().slice(0, 10)
      const wEndKey   = wEnd.toISOString().slice(0, 10)
      actualPhase += (log || [])
        .filter(e => e.date >= wStartKey && e.date < wEndKey)
        .reduce((s, e) => s + (e.tss || 0), 0)
    }
    const compliance = plannedPhase > 0 ? Math.round(actualPhase / plannedPhase * 100) : null

    // Week target TSS
    const currentWeekPlan = plan.weeks[weekIndex]
    const weekTargetTSS = currentWeekPlan?.TSS || currentWeekPlan?.tss || 0

    // Actual TSS this week
    const thisMonday = (() => {
      const d = new Date()
      const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1)
      return d.toISOString().slice(0, 10)
    })()
    const weekActualTSS = (log || [])
      .filter(e => e.date >= thisMonday)
      .reduce((s, e) => s + (e.tss || 0), 0)

    return {
      phaseName, phaseColor, weekInPhase, phaseTotalWeeks,
      startCTL, currentCTL, ctlDelta,
      compliance, weekTargetTSS, weekActualTSS,
      weekIndex: weekIndex + 1,
      totalWeeks: plan.weeks.length,
    }
  }, [log, plan])

  if (!data) return null

  const compColor = data.compliance === null ? '#555'
    : data.compliance >= 80 && data.compliance <= 120 ? '#5bc25b'
    : data.compliance > 140 ? '#e03030'
    : '#f5c542'

  const phasePct = Math.round(data.weekInPhase / data.phaseTotalWeeks * 100)

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '22ms', borderLeft: `3px solid ${data.phaseColor}44` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={S.cardTitle}>
          {lang === 'tr' ? 'BLOK ANALİZİ' : 'PHASE ANALYTICS'}
        </div>
        <span style={{ ...S.mono, fontSize: '10px', color: data.phaseColor, border: `1px solid ${data.phaseColor}44`, padding: '2px 7px', borderRadius: '2px' }}>
          {data.phaseName.toUpperCase()}
        </span>
      </div>

      {/* Phase progress bar */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...S.mono, fontSize: '9px', color: '#555', marginBottom: '3px' }}>
          <span>{lang === 'tr' ? `Blok: ${data.weekInPhase}/${data.phaseTotalWeeks} hafta` : `Phase: week ${data.weekInPhase} of ${data.phaseTotalWeeks}`}</span>
          <span>{lang === 'tr' ? `Plan: ${data.weekIndex}/${data.totalWeeks}` : `Plan: wk ${data.weekIndex}/${data.totalWeeks}`}</span>
        </div>
        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${phasePct}%`, background: data.phaseColor, borderRadius: '2px', transition: 'width 0.6s ease' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        {/* CTL progress */}
        {data.startCTL !== null && data.currentCTL !== null && (
          <div style={{ background: 'var(--surface)', borderRadius: '3px', padding: '4px 8px', minWidth: '80px' }}>
            <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>{lang === 'tr' ? 'KONDİSYON (CTL)' : 'FITNESS (CTL)'}</div>
            <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              {data.startCTL} → {data.currentCTL}
              {data.ctlDelta !== null && (
                <span style={{ fontSize: '10px', color: data.ctlDelta >= 0 ? '#5bc25b' : '#e03030', marginLeft: '4px' }}>
                  {data.ctlDelta >= 0 ? '+' : ''}{data.ctlDelta}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Phase compliance */}
        {data.compliance !== null && (
          <div style={{ background: 'var(--surface)', borderRadius: '3px', padding: '4px 8px', minWidth: '80px' }}>
            <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>{lang === 'tr' ? 'UYUM' : 'COMPLIANCE'}</div>
            <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: compColor }}>{data.compliance}%</div>
          </div>
        )}

        {/* This week progress */}
        {data.weekTargetTSS > 0 && (
          <div style={{ background: 'var(--surface)', borderRadius: '3px', padding: '4px 8px', minWidth: '80px' }}>
            <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>{lang === 'tr' ? 'BU HAFTA TSS' : 'THIS WK TSS'}</div>
            <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              {data.weekActualTSS}
              <span style={{ fontSize: '10px', color: '#555' }}>/{data.weekTargetTSS}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(PhaseAnalyticsCard)
