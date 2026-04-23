// ─── dashboard/FuelGuidanceCard.jsx — Nutrition guidance based on training load ──
// Computes carbohydrate and protein targets from today's TSS and tomorrow's
// planned TSS.  Reference: Burke et al. 2011 ISSN position stand;
// Thomas et al. 2016 (CHO periodization); Moore et al. 2014 (protein).
//
// CHO ranges:   rest <3g/kg · easy 3-5g/kg · moderate 5-7g/kg · hard 7-10g/kg
// Protein:      1.6-2.2g/kg daily (Morton 2018 meta-analysis)
import { memo, useMemo } from 'react'
import { S } from '../../styles.js'

const CHO_ZONES = [
  { label: 'REST',     labelTr: 'DİNLENME',  range: '3–5',   color: '#5bc25b', tssCap: 30  },
  { label: 'EASY',     labelTr: 'KOLAY',     range: '5–7',   color: '#5bc25b', tssCap: 60  },
  { label: 'MODERATE', labelTr: 'ORTA',      range: '7–10',  color: '#f5c542', tssCap: 100 },
  { label: 'HARD',     labelTr: 'ZOR',       range: '10–12', color: '#ff6600', tssCap: 150 },
  { label: 'VERY HARD',labelTr: 'ÇOK ZOR',  range: '12–14', color: '#e03030', tssCap: Infinity },
]

function getCHO(tss) {
  return CHO_ZONES.find(z => tss <= z.tssCap) || CHO_ZONES[CHO_ZONES.length - 1]
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function getTomorrowKey() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function FuelGuidanceCard({ log, plan, profile, lang }) {
  const data = useMemo(() => {
    const today = getTodayKey()
    const tomorrow = getTomorrowKey()
    const bw = parseFloat(profile?.weight) || 70

    // Today's actual TSS
    const todayTSS = (log || [])
      .filter(e => e.date === today)
      .reduce((s, e) => s + (e.tss || 0), 0)

    // Tomorrow's planned TSS (from plan if available)
    let tomorrowPlannedTSS = 0
    if (plan?.start_date && plan?.weeks?.length) {
      const planStart = new Date(plan.start_date)
      const tom = new Date(tomorrow)
      const weekIndex = Math.floor((tom - planStart) / (7 * 86400000))
      if (weekIndex >= 0 && weekIndex < plan.weeks.length) {
        const week = plan.weeks[weekIndex]
        const dayOfWeek = tom.getDay() === 0 ? 6 : tom.getDay() - 1 // Mon=0
        const sessions = week?.sessions || []
        const tomorrowSession = sessions[dayOfWeek]
        if (tomorrowSession?.tss) tomorrowPlannedTSS = tomorrowSession.tss
        else if (tomorrowSession?.duration && tomorrowSession?.type !== 'Rest') {
          tomorrowPlannedTSS = Math.round(tomorrowSession.duration * 0.7) // rough estimate
        }
      }
    }

    const todayCHO     = getCHO(todayTSS)
    const tomorrowCHO  = getCHO(tomorrowPlannedTSS)

    // Protein target: always 1.6–2.2g/kg, higher on hard days
    const proteinLow  = Math.round(bw * 1.6)
    const proteinHigh = Math.round(bw * 2.2)

    // Hydration: ~500-750ml per hour of training
    const todayHours  = (log || []).filter(e => e.date === today).reduce((s, e) => s + (e.duration || 0), 0) / 60
    const hydrationL  = todayHours > 0.5 ? Math.round(2.0 + todayHours * 0.625) : null

    return { bw, todayTSS, tomorrowPlannedTSS, todayCHO, tomorrowCHO, proteinLow, proteinHigh, hydrationL }
  }, [log, plan, profile?.weight])

  // Only show if we have some data to display (plan or at least a recent session)
  const hasRecentSession = (log || []).some(e => e.date >= getTodayKey().slice(0, 8) + '01')
  if (!hasRecentSession && !plan) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '32ms' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={S.cardTitle}>
          {lang === 'tr' ? 'BESLENME REHBERİ' : 'FUEL GUIDANCE'}
        </div>
        <span style={{ ...S.mono, fontSize: '9px', color: '#555' }}>
          {lang === 'tr' ? 'Burke 2011 · Moore 2014' : 'Burke 2011 · Moore 2014'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        {/* Today's CHO */}
        <div style={{ flex: '1 1 120px', background: 'var(--surface)', borderRadius: '3px', padding: '6px 10px', borderLeft: `3px solid ${data.todayCHO.color}` }}>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginBottom: '2px' }}>
            {lang === 'tr' ? 'BUGÜN CHO (g/kg)' : 'TODAY CHO (g/kg)'}
          </div>
          <div style={{ ...S.mono, fontSize: '16px', fontWeight: 700, color: data.todayCHO.color }}>
            {data.todayCHO.range}
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>
            {lang === 'tr' ? data.todayCHO.labelTr : data.todayCHO.label}
            {data.todayTSS > 0 ? ` · ${data.todayTSS} TSS` : ''}
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '2px' }}>
            ≈ {Math.round(parseFloat(data.todayCHO.range.split('–')[0]) * data.bw)}–{Math.round(parseFloat(data.todayCHO.range.split('–')[1]) * data.bw)}g
          </div>
        </div>

        {/* Tomorrow's CHO (if plan available) */}
        {data.tomorrowPlannedTSS > 0 && (
          <div style={{ flex: '1 1 120px', background: 'var(--surface)', borderRadius: '3px', padding: '6px 10px', borderLeft: `3px solid ${data.tomorrowCHO.color}44` }}>
            <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginBottom: '2px' }}>
              {lang === 'tr' ? 'YARIN CHO (g/kg)' : 'TOMORROW CHO (g/kg)'}
            </div>
            <div style={{ ...S.mono, fontSize: '16px', fontWeight: 700, color: data.tomorrowCHO.color }}>
              {data.tomorrowCHO.range}
            </div>
            <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>
              {lang === 'tr' ? data.tomorrowCHO.labelTr : data.tomorrowCHO.label}
              {` · ${data.tomorrowPlannedTSS} TSS`}
            </div>
            <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '2px' }}>
              ≈ {Math.round(parseFloat(data.tomorrowCHO.range.split('–')[0]) * data.bw)}–{Math.round(parseFloat(data.tomorrowCHO.range.split('–')[1]) * data.bw)}g
            </div>
          </div>
        )}

        {/* Protein */}
        <div style={{ flex: '1 1 100px', background: 'var(--surface)', borderRadius: '3px', padding: '6px 10px', borderLeft: '3px solid #0064ff44' }}>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginBottom: '2px' }}>
            {lang === 'tr' ? 'PROTEİN (g/gün)' : 'PROTEIN (g/day)'}
          </div>
          <div style={{ ...S.mono, fontSize: '16px', fontWeight: 700, color: '#0064ff' }}>
            {data.proteinLow}–{data.proteinHigh}
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>
            1.6–2.2 g/kg · {data.bw}kg
          </div>
        </div>

        {/* Hydration */}
        {data.hydrationL && (
          <div style={{ flex: '1 1 80px', background: 'var(--surface)', borderRadius: '3px', padding: '6px 10px' }}>
            <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginBottom: '2px' }}>
              {lang === 'tr' ? 'SIVI (L)' : 'FLUIDS (L)'}
            </div>
            <div style={{ ...S.mono, fontSize: '16px', fontWeight: 700, color: '#888' }}>
              ≥{data.hydrationL}L
            </div>
            <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>incl. training</div>
          </div>
        )}
      </div>

      <div style={{ ...S.mono, fontSize: '9px', color: '#333', lineHeight: 1.5 }}>
        {lang === 'tr'
          ? `KBH: ağır antrenman günleri karbonhidratı artır, dinlenme günleri azalt. ${data.bw}kg için hesaplandı.`
          : `CHO periodization: increase carbs on hard days, reduce on rest days. Calculated for ${data.bw}kg.`}
      </div>
    </div>
  )
}

export default memo(FuelGuidanceCard)
