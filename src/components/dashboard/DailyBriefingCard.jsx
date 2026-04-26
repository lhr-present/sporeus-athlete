// src/components/dashboard/DailyBriefingCard.jsx
// The "6am answer" card — top of Dashboard.
// Tells the athlete exactly what to do today based on their actual data.
import { useMemo } from 'react'
import { deriveAllMetrics } from '../../lib/profileDerivedMetrics.js'
import { dailyPrescription } from '../../lib/dailyPrescription.js'
import { FormulaPopover } from '../ui/FormulaPopover.jsx'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const RED    = '#e03030'

const STATUS_COLOR = {
  fresh: GREEN, optimal: GREEN, normal: AMBER,
  fatigued: RED, 'very-fatigued': RED,
}
const ZONE_COLORS = ['#888', '#5bc25b', '#f5c542', '#ff8c00', '#e03030']

export default function DailyBriefingCard({ profile, log, plan, planStatus, recovery, isTR }) {
  const metrics  = useMemo(() => deriveAllMetrics(profile, log || [], []), [profile, log])
  const rx       = useMemo(
    () => dailyPrescription(profile, log, plan, planStatus, recovery, metrics),
    [profile, log, plan, planStatus, recovery, metrics]
  )

  if (!log?.length) return null

  const color = STATUS_COLOR[rx.status] || AMBER
  const sess  = rx.today.session

  return (
    <div style={{
      borderLeft: `4px solid ${color}`, borderRadius: '3px',
      padding: '14px 16px', marginBottom: '16px',
      background: 'var(--surface, #0f0f0f)', fontFamily: MONO,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em' }}>
          ◈ {isTR ? 'GÜNLÜK REÇETE' : 'DAILY BRIEFING'}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {rx.today.raceCountdown != null && rx.today.raceCountdown <= 30 && (
            <span style={{ fontSize: '9px', color: ORANGE, fontWeight: 700 }}>
              {rx.today.raceCountdown}{isTR ? 'g yarış' : 'd race'}
            </span>
          )}
          <span style={{ fontSize: '9px', color: color, fontWeight: 700, letterSpacing: '0.06em' }}>
            {rx.status.replace('-', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Brief headline */}
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '10px', lineHeight: 1.5 }}>
        {rx.today.brief[isTR ? 'tr' : 'en']}
      </div>

      {/* Today's session block */}
      {sess && (
        <div style={{
          padding: '8px 10px', background: 'var(--bg, #0a0a0a)',
          borderRadius: '3px', marginBottom: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#ccc' }}>
              {sess.type}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {sess.durationMin && <span style={{ fontSize: '9px', color: '#555' }}>{sess.durationMin}min</span>}
              {sess.zoneNum && (
                <span style={{ fontSize: '9px', fontWeight: 700, color: ZONE_COLORS[sess.zoneNum - 1] ?? '#888' }}>
                  Z{sess.zoneNum}
                </span>
              )}
              {sess.suggested && <span style={{ fontSize: '8px', color: '#333' }}>{isTR ? 'öneri' : 'suggested'}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {sess.hrRange    && <span style={{ fontSize: '9px', color: '#666' }}>❤ {sess.hrRange}</span>}
            {sess.paceRange  && <span style={{ fontSize: '9px', color: '#666' }}>⏱ {sess.paceRange}</span>}
            {sess.powerRange && <span style={{ fontSize: '9px', color: '#666' }}>⚡ {sess.powerRange}</span>}
          </div>
          {sess.description && (
            <div style={{ fontSize: '9px', color: '#444', marginTop: '3px', lineHeight: 1.4 }}>
              {typeof sess.description === 'object' ? (sess.description[isTR ? 'tr' : 'en'] || sess.description.en || sess.description) : sess.description}
            </div>
          )}
        </div>
      )}

      {/* Tomorrow suggestion */}
      {rx.tomorrow && (
        <div style={{ fontSize: '9px', color: '#444', marginBottom: '6px' }}>
          {isTR ? 'Yarın →' : 'Tomorrow →'}{' '}
          <span style={{ color: rx.tomorrow.type === 'rest' ? RED : AMBER }}>
            {rx.tomorrow.suggestion[isTR ? 'tr' : 'en']}
          </span>
          <span style={{ color: '#333', marginLeft: '6px' }}>
            ({rx.tomorrow.rationale[isTR ? 'tr' : 'en']})
          </span>
        </div>
      )}

      {/* Warnings */}
      {rx.warnings.map(w => (
        <div key={w.code} style={{
          fontSize: '9px', color: w.level === 'danger' ? RED : AMBER,
          marginTop: '4px', letterSpacing: '0.04em',
        }}>
          {w.level === 'danger' ? '⚠ ' : '△ '}{w[isTR ? 'tr' : 'en']}
        </div>
      ))}

      {/* TSB / CTL row */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', borderTop: '1px solid #1a1a1a', paddingTop: '6px', alignItems: 'center' }}>
        {[
          { label: 'CTL', val: rx.ctl, key: 'ctl' },
          { label: 'TSB', val: rx.tsb >= 0 ? `+${rx.tsb}` : `${rx.tsb}`, key: 'tsb' },
          ...(rx.acwr != null ? [{ label: 'ACWR', val: rx.acwr, key: 'acwr' }] : []),
        ].map(m => (
          <span key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '8px', color: '#333', letterSpacing: '0.08em' }}>{m.label}</span>
            <FormulaPopover metricKey={m.key} lang={isTR ? 'tr' : 'en'} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#555' }}>{m.val}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
