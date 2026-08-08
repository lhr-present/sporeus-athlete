import { memo, useContext  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { HelpTip } from '../ui.jsx'
import { interpretACWR } from '../../lib/science/interpretations.js'
import { calculateACWR } from '../../lib/trainingLoad.js'
import { ACWR } from '../../lib/sport/constants.js'

function ACWRCard({ log = [], lc, dl }) {
  const { t, lang } = useContext(LangCtx)

  const MONO = "'IBM Plex Mono', monospace"
  if (!dl.acwr || !lc.showACWR) return null
  if (log.length < 7) return (
    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555', padding: '16px 0', textAlign: 'center' }}>
      {lang === 'tr'
        ? 'ACWR hesabı için en az 4 haftalık antrenman kaydet.'
        : 'Log at least 4 weeks of sessions to calculate ACWR.'}
    </div>
  )

  // Canonical Hulin-style EWMA ACWR (src/lib/trainingLoad.js) — this card used to
  // reimplement its own plain rolling-average/no-cap estimator, diverging from every
  // other ACWR consumer in the app (TodayView, Recovery, intelligence.js). Same bug
  // class as the monotony-consolidation fix.
  const now = Date.now()
  const { ratio: acwrVal, acute, chronicWeekly: chronic28 } = calculateACWR(log)
  if (acwrVal == null) return (
    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555', padding: '16px 0', textAlign: 'center' }}>
      {lang === 'tr'
        ? 'ACWR hesabı için en az 4 haftalık antrenman kaydet.'
        : 'Log at least 4 weeks of sessions to calculate ACWR.'}
    </div>
  )

  const { color, label, rec } = acwrVal < ACWR.OPTIMAL_MIN
    ? { color: '#0064ff', label: t('acwrUnder'),   rec: 'Consider adding a moderate session tomorrow' }
    : acwrVal <= ACWR.OPTIMAL_MAX
    ? { color: '#5bc25b', label: t('acwrSweet'),   rec: 'Maintain current load — great zone' }
    : acwrVal <= ACWR.CAUTION_MAX
    ? { color: '#f5c542', label: t('acwrCaution'), rec: 'Easy run or rest day tomorrow' }
    : { color: '#e03030', label: t('acwrDanger'),  rec: 'Rest day mandatory tomorrow' }

  const weeklyACWR = Array.from({ length: 8 }, (_, wi) => {
    const asOf = now - wi * 7 * 864e5
    return calculateACWR(log, asOf).ratio ?? 0
  }).reverse()

  const maxVal = Math.max(...weeklyACWR, 1.6)
  const svgW = 200, svgH = 40
  const pts = weeklyACWR.map((v, i) => `${Math.round(i * (svgW - 1) / 7)},${Math.round(svgH - (v / maxVal) * svgH)}`).join(' ')

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '198ms', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...S.cardTitle, display: 'flex', alignItems: 'center' }}>
            {t('acwrTitle')}<HelpTip text="Acute:Chronic Workload Ratio. Sweet spot: 0.8–1.3. Above 1.5 = injury risk (Hulin et al. 2016). This is a coupled ratio (the chronic window includes the acute week) — treat it as a trend signal, not a precise threshold; coupling can produce spurious correlations independent of real injury risk (Lolli et al. 2019, Sports Med 49:1491-1497)."/>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
            <div>
              <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>{t('acwrAcute')}</div>
              <div style={{ ...S.mono, fontSize: '16px', fontWeight: 600, color: '#ff6600' }}>{Math.round(acute)}</div>
            </div>
            <div>
              <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>{t('acwrChronic')}</div>
              <div style={{ ...S.mono, fontSize: '16px', fontWeight: 600, color: '#888' }}>{Math.round(chronic28)}</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...S.mono, fontSize: '36px', fontWeight: 600, color, lineHeight: 1 }}>{acwrVal.toFixed(2)}</div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
            {acwrVal.toFixed(2)} · <span style={{ color }}>{label}</span>
          </div>
        </div>
      </div>
      <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub)', marginTop: '10px', padding: '6px 8px', background: 'var(--card-bg)', borderRadius: '4px' }}>
        ↗ {t('acwrRec')}: {rec}
      </div>
      <div style={{ marginTop: '10px' }}>
        <div style={{ ...S.mono, fontSize: '9px', color: '#888', marginBottom: '4px' }}>8-WEEK ACWR TREND</div>
        <svg width={svgW} height={svgH} style={{ display: 'block' }}>
          <rect x="0" y={Math.round(svgH - (1.5 / maxVal) * svgH)} width={svgW} height={Math.round((1.5 / maxVal) * svgH - (1.3 / maxVal) * svgH)} fill="#f5c54222"/>
          <rect x="0" y="0" width={svgW} height={Math.round(svgH - (1.5 / maxVal) * svgH)} fill="#e0303011"/>
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ ...S.mono, fontSize: '9px', color: '#aaa', marginTop: '6px' }}>{t('acwrNote')}</div>
      {(() => {
        const interp = interpretACWR(acwrVal)
        return (
          <div style={{ ...S.mono, fontSize: '10px', color: '#666', marginTop: '8px', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
            {lang === 'tr' ? interp.tr : interp.en}
            <span style={{ color: '#3a3a3a', marginLeft: '4px', fontSize: '9px' }}>· {interp.citation}</span>
          </div>
        )
      })()}
      <div style={{ marginTop: '12px' }}>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.08em', marginBottom: '6px' }}>NEXT WEEK FORECAST (TSS targets)</div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {[
            { label: 'CONSERV',  mult: 0.8, clr: '#0064ff' },
            { label: 'MAINTAIN', mult: 1.0, clr: '#5bc25b' },
            { label: 'BUILD',    mult: 1.2, clr: '#ff6600' },
            { label: 'LIMIT',    mult: 1.5, clr: '#e03030' },
          ].map(({ label, mult, clr }) => {
            const tss  = Math.round(chronic28 * mult)
            const proj = (tss / chronic28).toFixed(2)
            const isCurrent = acwrVal >= mult * 0.9 && acwrVal < mult * 1.1
            return (
              <div key={label} style={{ flex: '1 1 60px', textAlign: 'center', padding: '5px 4px', background: isCurrent ? `${clr}18` : 'var(--surface)', borderRadius: '4px', border: `1px solid ${clr}33` }}>
                <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: clr }}>{tss}</div>
                <div style={{ ...S.mono, fontSize: '7px', color: '#555', marginTop: '1px' }}>{label}</div>
                <div style={{ ...S.mono, fontSize: '8px', color: '#444' }}>ACWR {proj}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default memo(ACWRCard)
