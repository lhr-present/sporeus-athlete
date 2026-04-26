// src/components/dashboard/EliteMetricsStrip.jsx
// Compact horizontal strip showing derived elite metrics (W/kg, VDOT, MaxHR, LTHR).
// Returns null if fewer than 2 metrics are available.
import { useMemo } from 'react'
import { deriveAllMetrics } from '../../lib/profileDerivedMetrics.js'
import { FormulaPopover } from '../ui/FormulaPopover.jsx'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'

export default function EliteMetricsStrip({ profile, log, testResults, isTR, onGoToProfile }) {
  const metrics = useMemo(
    () => deriveAllMetrics(profile, log || [], testResults || []),
    [profile, log, testResults]
  )

  // Build the list of elite metrics to show
  const items = []
  if (metrics?.power?.wPerKg != null)
    items.push({ label: 'W/kg', value: metrics.power.wPerKg.toFixed(2), infoKey: 'wkg' })
  if (metrics?.running?.vdot != null)
    items.push({ label: 'VDOT', value: metrics.running.vdot.toFixed(1), infoKey: 'vdot' })
  if (metrics?.hr?.maxHR != null)
    items.push({ label: isTR ? 'MaksKA' : 'MaxHR', value: String(metrics.hr.maxHR), infoKey: null })
  if (metrics?.hr?.lthr != null)
    items.push({ label: 'LTHR', value: `${metrics.hr.lthr}`, infoKey: 'lthr' })
  // Auto-VDOT (when vo2max not set but derived from log)
  if (!metrics?.running?.vdot && metrics?.autoVdot?.vdot != null)
    items.push({ label: 'VDOT*', value: metrics.autoVdot.vdot.toFixed(1), auto: true, infoKey: 'vdot' })

  if (items.length < 2) return null

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0',
        padding: '8px 0 10px', borderBottom: '1px solid #1a1a1a',
        marginBottom: '14px', fontFamily: MONO,
        cursor: onGoToProfile ? 'pointer' : 'default',
      }}
      onClick={onGoToProfile}
      title={onGoToProfile ? (isTR ? 'Profile git →' : 'Go to Profile →') : undefined}
    >
      {items.map((item) => (
        <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '16px' }}>
          <span style={{ fontSize: '9px', color: '#555', letterSpacing: '0.08em' }}>{item.label}</span>
          {item.infoKey && <FormulaPopover metricKey={item.infoKey} lang={isTR ? 'tr' : 'en'} />}
          <span style={{
            fontSize: '13px', fontWeight: 700, fontFamily: MONO,
            color: item.auto ? '#f5c542' : ORANGE,
          }}>
            {item.value}
          </span>
          {item.auto && (
            <span style={{ fontSize: '8px', color: '#555' }}>
              {isTR ? 'auto' : 'auto'}
            </span>
          )}
        </span>
      ))}
      {onGoToProfile && (
        <span style={{ fontSize: '8px', color: '#333', marginLeft: 'auto' }}>
          {isTR ? 'profil →' : 'profile →'}
        </span>
      )}
    </div>
  )
}
