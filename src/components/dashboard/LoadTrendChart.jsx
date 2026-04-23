// ─── dashboard/LoadTrendChart.jsx — PMC card: ACWR badges + metrics + charts ───
// Extracted from Dashboard.jsx inline PMC block (dl.timeline section).
import { lazy, Suspense, useState, useMemo, useContext } from 'react'
import { S } from '../../styles.js'

import ErrorBoundary from '../ErrorBoundary.jsx'
import { monotonyStrain } from '../../lib/formulas.js'
import PerformanceMetrics from './PerformanceMetrics.jsx'
import ScienceTooltip from '../ScienceTooltip.jsx'
import { LangCtx } from '../../contexts/LangCtx.jsx'

const CTLChart  = lazy(() => import('../charts/CTLChart.jsx'))
const LoadChart = lazy(() => import('../charts/LoadChart.jsx'))
const ZoneChart = lazy(() => import('../charts/ZoneChart.jsx'))

/**
 * @param {object} props
 * @param {Array}  props.log          — full training log
 * @param {object} props.acwr         — { ratio, status } from calculateACWR
 * @param {number} props.ctlChartDays — days to display on CTL chart
 * @param {Array}  props.raceResults  — race result entries (for CTLChart overlay)
 * @param {object} [props.plan]       — current training plan (for CTLChart overlay)
 * @param {object} props.dl           — dashboard layout flags (dl.timeline)
 * @param {object} props.lc           — level config (lc.showCTL)
 */
const PMC_RANGES = [
  { label: '90D', days: 90 },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'ALL', days: 3650 },
]

export default function LoadTrendChart({ log, acwr, ctlChartDays, raceResults, plan, dl, lc }) {
  const { t } = useContext(LangCtx)
  if (!dl.timeline || !lc.showCTL || log.length <= 3) return null

  const [pmcRange, setPmcRange] = useState(ctlChartDays)
  const effectiveDays = pmcRange

  // Career peak CTL — highest fitness point across all history
  const peakCTL = useMemo(() => {
    if (!log.length) return null
    const sorted = [...log].sort((a, b) => a.date > b.date ? 1 : -1)
    let ctl = 0, peak = 0
    for (const s of sorted) { ctl = ctl + ((s.tss || 0) - ctl) / 42; if (ctl > peak) peak = ctl }
    return Math.round(peak)
  }, [log])

  const { mono, strain } = monotonyStrain(log)
  const acwrColor = acwr.status === 'danger'      ? '#e03030'
    : acwr.status === 'caution'                   ? '#f5c542'
    : acwr.status === 'optimal'                   ? '#5bc25b'
    : '#888'

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'195ms' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={S.cardTitle} >
          <ScienceTooltip anchor="1-ctl--atl--tsb-banister-impulseresponse" label="CTL / ATL / TSB" short="CTL=42d fitness EMA · ATL=7d fatigue EMA · TSB=form (CTL−ATL)">
            {t('pmcTitle')}
          </ScienceTooltip>
          {peakCTL && <span style={{ fontSize: '9px', color: '#555', fontWeight: 400, marginLeft: '8px' }}>{t('pmcPeakCTL')} {peakCTL}</span>}
        </div>
        <div style={{ display: 'flex', gap: '3px' }}>
          {PMC_RANGES.map(r => (
            <button key={r.label} onClick={() => setPmcRange(r.days)}
              style={{ ...S.mono, fontSize: '9px', padding: '2px 6px', border: `1px solid ${pmcRange === r.days ? '#ff6600' : '#333'}`, borderRadius: '2px', background: pmcRange === r.days ? '#ff660022' : 'transparent', color: pmcRange === r.days ? '#ff6600' : '#555', cursor: 'pointer' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ACWR · Monotony · Strain badges */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', margin:'6px 0 10px' }}>
        {acwr.ratio !== null && (
          <span style={{ ...S.mono, fontSize:'10px', padding:'2px 7px', border:`1px solid ${acwrColor}44`, borderRadius:'2px', color: acwrColor }}>
            <ScienceTooltip anchor="2-acwr--acutechronic-workload-ratio" label="ACWR" short="Acute:Chronic Workload Ratio — Hulin 2016. Optimal: 0.8–1.3.">
              ACWR {acwr.ratio} · {acwr.status.toUpperCase()}
            </ScienceTooltip>
          </span>
        )}
        <span style={{ ...S.mono, fontSize:'10px', padding:'2px 7px', border:`1px solid ${mono>2?'#e03030':'#333'}44`, borderRadius:'2px', color: mono>2?'#e03030':'#888' }}>
          <ScienceTooltip anchor="3-monotony--strain-banister" label="Monotony" short="Training monotony = mean TSS / SD TSS over 7 days. >2.0 is a risk flag.">
            MONOTONY {mono}{mono>2?' ⚠':''}
          </ScienceTooltip>
        </span>
        <span style={{ ...S.mono, fontSize:'10px', padding:'2px 7px', border:'1px solid #33333344', borderRadius:'2px', color:'#888' }}>
          <ScienceTooltip anchor="3-monotony--strain-banister" label="Strain" short="Strain = weekly TSS × Monotony — Banister / Foster 1998.">
            STRAIN {strain}
          </ScienceTooltip>
        </span>
      </div>

      {/* Performance metric tiles */}
      {log.length >= 7 && <PerformanceMetrics log={log} />}

      <ErrorBoundary inline name="CTL Chart">
        <Suspense fallback={null}>
          <CTLChart log={log} days={effectiveDays} raceResults={raceResults} plan={plan} />
        </Suspense>
      </ErrorBoundary>
      <div style={{ height:'16px' }}/>
      <Suspense fallback={null}><LoadChart log={log} weeks={10} /></Suspense>
      <div style={{ height:'16px' }}/>
      <Suspense fallback={null}><ZoneChart log={log} weeks={8} /></Suspense>
    </div>
  )
}
