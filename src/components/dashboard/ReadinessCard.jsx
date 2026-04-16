// ─── dashboard/ReadinessCard.jsx — CTL / ATL / TSB status + coaching note ─────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { HelpTip } from '../ui.jsx'
import { useCountUp } from '../../hooks/useCountUp.js'

// Format load values: 1 decimal when < 10 (sport science convention)
function fmtLoad(v) {
  const n = typeof v === 'number' ? v : parseFloat(v)
  if (!isFinite(n)) return '—'
  return Math.abs(n) < 10 ? n.toFixed(1) : String(Math.round(n))
}

// Format delta with sign
function fmtDelta(delta) {
  if (!delta) return null
  const abs = Math.abs(delta)
  const fmt = abs < 10 ? abs.toFixed(1) : String(Math.round(abs))
  return (delta > 0 ? '+' : '-') + fmt
}

/**
 * @param {{
 *   dl: object, lc: object,
 *   readiness: { label: string, color: string },
 *   ctl: number, atl: number, tsb: number, tsbColor: string,
 *   trendCTL: number, trendATL: number, trendTSB: number, prev7: object|null,
 *   consistency: object|null,
 *   dqResult: object,
 *   coachingMsg: string|null,
 *   totalTSS: number,
 * }} props
 */
export default function ReadinessCard({
  dl, lc,
  readiness, ctl, atl, tsb, tsbColor,
  trendCTL, trendATL, trendTSB, prev7,
  consistency, dqResult, coachingMsg, totalTSS,
}) {
  const { t } = useContext(LangCtx)
  const countTSS = useCountUp(totalTSS)

  if (!dl.readiness) return null

  return (
    <div className="sp-card" style={{ ...S.card, borderLeft: `4px solid ${readiness.color}`, animationDelay: '0ms' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={S.cardTitle}>{t('readiness')}</div>
          <span style={S.tag(readiness.color)}>{readiness.label}</span>
          {lc.showCTL && (
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
              {[
                { lbl: t('ctlLabel'), v: fmtLoad(ctl), c: '#0064ff', delta: trendCTL, tip: 'Chronic Training Load — your fitness. Higher = fitter. 42-day average of daily TSS.' },
                { lbl: t('atlLabel'), v: fmtLoad(atl), c: '#ef4444', delta: trendATL, tip: 'Acute Training Load — your fatigue. 7-day average. Drops after rest days.' },
                { lbl: t('tsbLabel'), v: (tsb >= 0 ? '+' : '') + fmtLoad(Math.abs(tsb)), c: tsbColor, delta: trendTSB, tip: 'Training Stress Balance = CTL − ATL. Positive = fresh, ready to race. Negative = fatigued.' },
              ].map(({ lbl, v, c, delta, tip }) => (
                <div key={lbl}>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.08em', display: 'flex', alignItems: 'center' }}>
                    {lbl}<HelpTip text={tip}/>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <div style={{ ...S.mono, fontSize: '16px', fontWeight: 600, color: c }}>{v}</div>
                    {delta !== 0 && prev7 && (() => {
                      const d = fmtDelta(delta)
                      return d ? (
                        <div style={{ ...S.mono, fontSize: '10px', color: delta > 0 ? '#5bc25b' : '#e03030', letterSpacing: '0.04em' }}>
                          {d}
                        </div>
                      ) : null
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
          {consistency && (
            <div style={{ fontSize: '10px', color: '#555', fontFamily: "'IBM Plex Mono', monospace", marginTop: '4px' }}>
              Density (28d): {consistency.pct}% · Longest gap: {consistency.longestGap}d · Avg gap: {consistency.totalDays > 0 ? ((consistency.totalDays - consistency.sessionDays) / Math.max(1, consistency.sessionDays + 1)).toFixed(1) : '—'}d
            </div>
          )}
          {lc.showCTL && (() => {
            const complete = dqResult.factors.filter(f => f.score >= 80).length
            return (
              <div style={{ ...S.mono, fontSize: '9px', color: '#444', marginTop: '4px' }}>
                Data quality: <span style={{ color: dqResult.gradeColor }}>{dqResult.grade}</span> ({complete}/{dqResult.factors.length} factors complete)
              </div>
            )
          })()}
        </div>
        <div style={{ ...S.mono, fontSize: '40px', fontWeight: 600, color: readiness.color }}>{countTSS}</div>
      </div>
      {coachingMsg && (
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)', marginTop: '10px', padding: '7px 10px', background: 'var(--card-bg)', borderRadius: '4px', lineHeight: 1.7, borderLeft: '3px solid #ff660066' }}>
          ◈ {coachingMsg}
        </div>
      )}
    </div>
  )
}
