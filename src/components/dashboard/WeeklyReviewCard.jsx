import { useMemo } from 'react'
import { S } from '../../styles.js'
import { generateWeeklyNarrative } from '../../lib/intelligence.js'
import { FormulaPopover } from '../ui/FormulaPopover.jsx'

// ─── WeeklyReviewCard — E69 ───────────────────────────────────────────────────
// Compares this ISO week (Mon–Sun) vs last ISO week by TSS and sessions.
// Props: log (array), profile (object), isTR (bool)

function estimateTSS(entry) {
  if (entry.tss != null) return entry.tss
  const duration = entry.duration || 0
  const rpe = entry.rpe || 5
  return Math.round((duration / 60) * rpe * 0.1 * rpe)
}

function getISOWeekBounds(offsetWeeks = 0) {
  const today = new Date()
  const dow = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dow + 6) % 7) - offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    monISO: monday.toISOString().slice(0, 10),
    sunISO: sunday.toISOString().slice(0, 10),
  }
}

export default function WeeklyReviewCard({ log, profile, isTR }) {
  const { thisWeek, lastWeek } = useMemo(() => {
    if (!log || log.length === 0) return { thisWeek: [], lastWeek: [] }
    const { monISO: thisMon, sunISO: thisSun } = getISOWeekBounds(0)
    const { monISO: lastMon, sunISO: lastSun } = getISOWeekBounds(1)
    return {
      thisWeek: log.filter(e => e.date >= thisMon && e.date <= thisSun),
      lastWeek: log.filter(e => e.date >= lastMon && e.date <= lastSun),
    }
  }, [log])

  const thisWeekTss      = useMemo(() => thisWeek.reduce((s, e) => s + estimateTSS(e), 0), [thisWeek])
  const lastWeekTss      = useMemo(() => lastWeek.reduce((s, e) => s + estimateTSS(e), 0), [lastWeek])
  const thisWeekSessions = thisWeek.length
  const lastWeekSessions = lastWeek.length
  const tssDelta         = thisWeekTss - lastWeekTss
  const sessionDelta     = thisWeekSessions - lastWeekSessions

  // Optional: first insight from generateWeeklyNarrative
  const narrative = useMemo(() => {
    if (!log || log.length < 4) return null
    try {
      const result = generateWeeklyNarrative(log, [], profile)
      if (!result) return null
      const text = isTR ? result.tr : result.en
      // Return first sentence only
      return text ? text.split('.')[0] + '.' : null
    } catch {
      return null
    }
  }, [log, profile, isTR])

  if (thisWeekSessions === 0) return null

  const title   = isTR ? 'HAFTALIK DEĞERLENDİRME' : 'WEEKLY REVIEW'
  const thisLbl = isTR ? 'BU HAFTA' : 'THIS WEEK'
  const lastLbl = isTR ? 'GEÇEN HAFTA' : 'LAST WEEK'

  const deltaColor = (d) => d > 0 ? '#5bc25b' : d < 0 ? '#e03030' : '#888'
  const deltaStr   = (d) => d > 0 ? `+${d}` : String(d)

  const colStyle = {
    flex: '1 1 120px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '10px 12px',
  }
  const colHdr = {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '9px',
    color: 'var(--muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '6px',
  }
  const bigNum = {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '20px',
    fontWeight: 700,
    color: '#ff6600',
    lineHeight: 1.1,
  }
  const subLine = {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '4px',
  }
  const deltaTag = (d, suffix = '') => (
    <span style={{
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: '10px',
      fontWeight: 700,
      color: deltaColor(d),
      marginLeft: '6px',
    }}>
      {deltaStr(d)}{suffix}
    </span>
  )

  return (
    <div style={{ ...S.card }}>
      <div style={S.cardTitle}>{title}</div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: narrative ? '12px' : '0' }}>
        {/* This week column */}
        <div style={colStyle}>
          <div style={colHdr}>{thisLbl}</div>
          <div style={bigNum}>{thisWeekTss} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted)' }}>TSS</span><FormulaPopover metricKey="tss" lang={isTR ? 'tr' : 'en'} /></div>
          <div style={subLine}>
            {thisWeekSessions} {isTR ? 'antrenman' : `session${thisWeekSessions !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Last week column */}
        <div style={colStyle}>
          <div style={colHdr}>{lastLbl}</div>
          <div style={bigNum}>{lastWeekTss} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted)' }}>TSS</span></div>
          <div style={subLine}>
            {lastWeekSessions} {isTR ? 'antrenman' : `session${lastWeekSessions !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Delta column */}
        {lastWeekSessions > 0 && (
          <div style={{ ...colStyle, borderLeft: `3px solid ${deltaColor(tssDelta)}` }}>
            <div style={colHdr}>{isTR ? 'DEĞİŞİM' : 'CHANGE'}</div>
            <div style={{ ...bigNum, color: deltaColor(tssDelta), fontSize: '16px' }}>
              {deltaStr(tssDelta)} TSS
            </div>
            <div style={subLine}>
              {deltaStr(sessionDelta)} {isTR ? 'seans' : 'sessions'}
              {deltaTag(tssDelta)}
            </div>
          </div>
        )}
      </div>

      {narrative && (
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '11px',
          color: 'var(--muted)',
          lineHeight: 1.6,
          borderTop: '1px solid var(--border)',
          paddingTop: '10px',
          marginTop: '4px',
        }}>
          {narrative}
        </div>
      )}
    </div>
  )
}
