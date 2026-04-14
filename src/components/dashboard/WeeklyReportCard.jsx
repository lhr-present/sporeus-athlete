import { useState } from 'react'
import { S } from '../../styles.js'
import { monotonyStrain } from '../../lib/formulas.js'

export default function WeeklyReportCard({ last7, totalMin, totalTSS, avgRPE, recovery, plan, planStatus, rangeLabel }) {
  const [reportVisible, setReportVisible] = useState(false)

  if (!last7.length) return null

  const recLast7 = recovery.filter(e => {
    const d = new Date(e.date), cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    return d >= cutoff
  })
  const avgRec = recLast7.length ? Math.round(recLast7.reduce((s, e) => s + (e.score || 0), 0) / recLast7.length) : null

  const generateReport = () => {
    const { mono, strain } = monotonyStrain(last7)
    const zoneDonutData = (() => {
      const zm = [0, 0, 0, 0, 0]
      last7.forEach(e => {
        const dur = e.duration || 0
        if (e.zones && e.zones.some(z => z > 0)) e.zones.forEach((z, i) => { zm[i] += z })
        else { const r = e.rpe || 5; zm[r <= 3 ? 0 : r <= 5 ? 1 : r <= 7 ? 2 : r === 8 ? 3 : 4] += dur }
      })
      const tot = zm.reduce((s, v) => s + v, 0) || 1
      return zm.map((v, i) => ({ name: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'][i], pct: Math.round(v / tot * 100) })).filter(z => z.pct > 0)
    })()
    const thisWeekIdx = plan ? Math.min(Math.floor((new Date() - new Date(plan.generatedAt)) / (7 * 864e5)), plan.weeks.length - 1) : -1
    let complianceStr = ''
    if (thisWeekIdx >= 0 && plan) {
      const w = plan.weeks[thisWeekIdx]
      let tot = 0, done = 0
      w.sessions.forEach((s, di) => { if (s.type !== 'Rest' && s.duration > 0) { tot++; const st = planStatus[`${thisWeekIdx}-${di}`]; if (st === 'done' || st === 'modified') done++ } })
      if (tot) complianceStr = `${Math.round(done / tot * 100)}% week compliance`
    }
    const html = `<div style="font-family:'Courier New',monospace;font-size:12px;color:#1a1a1a;max-width:480px">
<div style="background:#0a0a0a;color:#ff6600;padding:8px 12px;font-weight:600;font-size:14px">◈ SPOREUS WEEKLY REPORT</div>
<div style="padding:12px;background:#f8f8f8">
<div style="margin-bottom:8px;font-size:11px;color:#888">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px">
<span><strong>${last7.length}</strong> sessions</span>
<span><strong>${Math.floor(totalMin / 60)}h ${totalMin % 60}m</strong> volume</span>
<span><strong>${totalTSS}</strong> TSS</span>
<span>RPE avg <strong>${avgRPE}</strong></span>
</div>
${zoneDonutData.map(z => `<div>${z.name}: ${z.pct}%</div>`).join('')}
${avgRec !== null ? `<div style="margin-top:8px">Recovery score avg: <strong>${avgRec}/100</strong></div>` : ''}
${complianceStr ? `<div>Plan: <strong>${complianceStr}</strong></div>` : ''}
<div style="margin-top:8px;font-size:10px;color:#888">sporeus.com — Science-based training</div>
</div></div>`
    if (navigator.share) {
      navigator.share({ title: 'Sporeus Weekly Report', text: `${last7.length} sessions | ${totalTSS} TSS | ${Math.floor(totalMin / 60)}h ${totalMin % 60}m | RPE ${avgRPE}` })
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(html)
      setReportVisible(true); setTimeout(() => setReportVisible(false), 2500)
    }
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '196ms' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={S.cardTitle}>WEEKLY REPORT</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {reportVisible && <span style={{ ...S.mono, fontSize: '10px', color: '#5bc25b' }}>✓ Copied!</span>}
          <button onClick={generateReport} style={{ ...S.btnSec, fontSize: '10px', padding: '4px 10px' }}>⤴ Share / Copy</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[
          { l: `SESSIONS (${rangeLabel})`, v: last7.length },
          { l: 'VOLUME', v: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` },
          { l: 'TSS', v: totalTSS },
          { l: 'AVG RPE', v: avgRPE },
          avgRec !== null && { l: 'RECOVERY', v: `${avgRec}/100` },
        ].filter(Boolean).map(({ l, v }) => (
          <div key={l}>
            <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>{l}</div>
            <div style={{ ...S.mono, fontSize: '16px', fontWeight: 600, color: '#ff6600' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
