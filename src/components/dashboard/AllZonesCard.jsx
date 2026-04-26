// src/components/dashboard/AllZonesCard.jsx
// E63 — Complete training zone reference for all sports in one card.
// Returns null if no derivable data — safe to always render.

import { useMemo } from 'react'
import { deriveAllMetrics } from '../../lib/profileDerivedMetrics.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const _GREEN  = '#5bc25b'
const AMBER  = '#f5c542'

// Zone color by index (0-based)
const ZONE_COLORS = ['#555', '#5bc25b', '#f5c542', '#ff8c00', '#e03030']

function fmtPace(val) {
  // val may be a number (sec/km) or a string "M:SS"
  if (typeof val === 'string') return val
  if (typeof val === 'number' && val > 0) {
    const m = Math.floor(val / 60)
    const s = Math.round(val % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return '—'
}

export default function AllZonesCard({ profile, log, testResults, isTR }) {
  const metrics = useMemo(
    () => deriveAllMetrics(profile, log || [], testResults || []),
    [profile, log, testResults]
  )

  const hasAny = metrics?.power || metrics?.running || metrics?.hr
  if (!hasAny) return null

  // Sources line
  const sources = []
  if (metrics.power?.ftp)    sources.push(`FTP ${metrics.power.ftp}W`)
  if (metrics.running?.vdot) sources.push(`VDOT ${metrics.running.vdot.toFixed(1)}`)
  if (metrics.hr?.maxHR)     sources.push(`MaxHR ${metrics.hr.maxHR}`)
  if (metrics.running?.source === 'auto-log') sources.push('(auto-estimated)')

  return (
    <div style={{
      border: '1px solid #1a1a1a', borderRadius: '4px',
      padding: '16px 20px', marginBottom: '18px', fontFamily: MONO,
    }}>
      {/* Header */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, letterSpacing: '0.12em', marginBottom: '12px' }}>
        ◈ {isTR ? 'TÜM ANTRENMAN ZONLARI' : 'ALL TRAINING ZONES'}
      </div>

      {/* Power zones (7 Coggan) */}
      {metrics.power?.zones?.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '6px' }}>
            ▶ {isTR ? 'GÜÇ ZONLARI (Coggan)' : 'POWER ZONES (Coggan)'} · FTP {metrics.power.ftp}W
            {metrics.power.wPerKg != null && (
              <span style={{ color: ORANGE, marginLeft: '8px' }}>{metrics.power.wPerKg.toFixed(2)} W/kg</span>
            )}
          </div>
          {metrics.power.zones.map((z, i) => (
            <div key={z.id || i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 0', borderBottom: '1px solid #111',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '9px', color: ZONE_COLORS[Math.min(i, 4)], minWidth: '18px' }}>Z{i+1}</span>
                <span style={{ fontSize: '9px', color: '#777' }}>{z.name}</span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#ccc' }}>
                {z.minWatts ?? z.min ?? '?'}–{z.maxWatts ?? z.max ?? '?'} W
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Running paces (Daniels) */}
      {metrics.running?.paces && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '6px' }}>
            ▶ {isTR ? 'KOŞU TEMPOLARI (Daniels)' : 'RUNNING PACES (Daniels)'} · VDOT {metrics.running.vdot?.toFixed(1)}
            {metrics.running.source === 'auto-log' && (
              <span style={{ color: AMBER, marginLeft: '6px' }}>{isTR ? '(auto)' : '(auto)'}</span>
            )}
          </div>
          {[
            { key: 'easy',      label: isTR ? 'KOLAY'    : 'EASY'      },
            { key: 'marathon',  label: isTR ? 'MARATON'  : 'MARATHON'  },
            { key: 'threshold', label: isTR ? 'EŞİK'     : 'THRESHOLD' },
            { key: 'interval',  label: isTR ? 'İNTERVAL' : 'INTERVAL'  },
            { key: 'rep',       label: 'REP'                             },
          ].map(({ key, label }, i) => (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 0', borderBottom: '1px solid #111',
            }}>
              <span style={{ fontSize: '9px', color: ZONE_COLORS[i] }}>{label}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#ccc' }}>
                {fmtPace(metrics.running.paces[key])}/km
              </span>
            </div>
          ))}
        </div>
      )}

      {/* HR zones */}
      {metrics.hr?.zones?.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '6px' }}>
            ▶ {isTR ? 'KALp ATIŞI ZONLARI' : 'HEART RATE ZONES'} · MaxHR {metrics.hr.maxHR}
            {metrics.hr.maxHRSource === 'age-predicted' && (
              <span style={{ color: '#444', marginLeft: '6px' }}>{isTR ? '(yaşa göre)' : '(age-predicted)'}</span>
            )}
            {metrics.hr.lthr != null && (
              <span style={{ color: '#555', marginLeft: '6px' }}>LTHR {metrics.hr.lthr}</span>
            )}
          </div>
          {metrics.hr.zones.map((z, i) => (
            <div key={z.n} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 0', borderBottom: '1px solid #111',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '9px', color: ZONE_COLORS[i], minWidth: '18px' }}>Z{z.n}</span>
                <span style={{ fontSize: '9px', color: '#777' }}>{z.name}</span>
                <span style={{ fontSize: '8px', color: '#444' }}>{z.pct}</span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#ccc' }}>
                {z.min}–{z.max} bpm
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Missing fields nudge */}
      {metrics.completeness?.missing?.length > 0 && (
        <div style={{ fontSize: '8px', color: '#333', marginTop: '8px', lineHeight: 1.6 }}>
          {isTR ? 'Eksik:' : 'Unlock more:'}{' '}
          {metrics.completeness.missing.slice(0, 3).join(', ')}{' '}
          {isTR ? '→ Profile\'dan ekle' : '→ add in Profile'}
        </div>
      )}

      {/* Source footer */}
      {sources.length > 0 && (
        <div style={{ fontSize: '8px', color: '#333', marginTop: '6px' }}>
          {isTR ? 'Kaynak:' : 'Based on:'} {sources.join(' · ')}
        </div>
      )}
    </div>
  )
}
