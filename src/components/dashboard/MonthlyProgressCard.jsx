// src/components/dashboard/MonthlyProgressCard.jsx — E72
// Shows previous month summary on the 1st–7th of each month.
// Returns null outside that window or when insufficient data.
import { useMemo } from 'react'
import { S } from '../../styles.js'
import { computeMonthlyProgress } from '../../lib/athlete/monthlyProgress.js'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'

export default function MonthlyProgressCard({ log, profile, isTR }) {
  const data = useMemo(
    () => computeMonthlyProgress(log, profile),
    [log, profile]
  )

  if (!data) return null

  const lang   = isTR ? 'tr' : 'en'
  const lbl    = data.monthLabel[lang]
  const title  = isTR ? 'AYLIK ÖZET' : 'MONTHLY SUMMARY'
  const ctlSign = data.ctlDelta >= 0 ? `+${data.ctlDelta}` : String(data.ctlDelta)
  const ctlColor = data.ctlDelta > 0 ? '#5bc25b' : data.ctlDelta < 0 ? '#e03030' : '#888'

  return (
    <div style={{ ...S.card, borderLeft: `4px solid ${ORANGE}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>
          ◈ {title}
        </div>
        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555' }}>
          {lbl}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {[
          { label: isTR ? 'Antrenman' : 'Sessions', value: data.sessions, color: '#ccc' },
          { label: 'TSS',  value: data.totalTSS, color: ORANGE },
          ...(data.avgRPE != null ? [{ label: isTR ? 'Ort. RPE' : 'Avg RPE', value: data.avgRPE, color: '#888' }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', minWidth: '56px' }}>
            <div style={{ fontFamily: MONO, fontSize: '16px', fontWeight: 700, color }}>{value}</div>
            <div style={{ fontFamily: MONO, fontSize: '8px', color: '#555', letterSpacing: '0.08em', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* CTL delta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: '#555' }}>CTL</span>
        <span style={{ fontFamily: MONO, fontSize: '12px', color: '#555' }}>{data.ctlStart}</span>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: '#333' }}>→</span>
        <span style={{ fontFamily: MONO, fontSize: '12px', color: '#888' }}>{data.ctlEnd}</span>
        <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: ctlColor }}>
          ({ctlSign})
        </span>
      </div>

      {/* Best week */}
      {data.bestWeek && (
        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', marginBottom: '8px' }}>
          {isTR ? 'En iyi hafta:' : 'Best week:'}{' '}
          <span style={{ color: '#888' }}>{data.bestWeek.label}</span>
          {' · '}
          <span style={{ color: ORANGE, fontWeight: 700 }}>{data.bestWeek.tss} TSS</span>
        </div>
      )}

      {/* Next month target */}
      <div style={{
        fontFamily: MONO, fontSize: '9px', color: '#444',
        borderTop: '1px solid #1a1a1a', paddingTop: '8px', marginTop: '4px', lineHeight: 1.6,
      }}>
        {isTR
          ? `Gelecek ay hedef: haftada ${data.targetNextMonth.tssLow}–${data.targetNextMonth.tssHigh} TSS → CTL ${data.targetNextMonth.targetCTL} hedefi`
          : `Next month: ${data.targetNextMonth.tssLow}–${data.targetNextMonth.tssHigh} TSS/week → target CTL ${data.targetNextMonth.targetCTL}`}
      </div>
    </div>
  )
}
