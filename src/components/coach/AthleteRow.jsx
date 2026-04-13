// ─── coach/AthleteRow.jsx — Single athlete row (mobile card + desktop table) ───
// Extracted from CoachSquadView.jsx. Renders in two layouts via `isMobile` prop.

import { wellnessAvg } from '../../lib/coachDigest.js'
import { getReadinessLabel, getAthleteInsights } from '../../lib/ruleInsights.js'
import { S } from '../../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const GREEN  = '#5bc25b'
const YELLOW = '#f5c542'
const RED    = '#e03030'
const GREY   = '#555'

function statusColor(s) {
  return { Overreaching: RED, Detraining: GREY, Building: BLUE,
           Peaking: ORANGE, Recovering: YELLOW, Maintaining: GREEN }[s] || GREY
}
function acwrColor(s) {
  return { optimal: GREEN, caution: YELLOW, danger: RED, low: GREY }[s] || GREY
}
function adherenceColor(pct) {
  return pct >= 85 ? GREEN : pct >= 60 ? YELLOW : RED
}
function tsbColor(v) {
  return v > 10 ? GREEN : v >= -20 ? YELLOW : RED
}
function readinessColor(score) {
  if (!score) return GREY
  return score >= 7 ? GREEN : score >= 4 ? YELLOW : RED
}
function hrvToReadiness(hrv) {
  if (!hrv) return null
  return Math.round(Math.min(10, Math.max(1, (hrv - 15) / 7)))
}
function fmtDate(d) {
  return d ? d.slice(5) : '—'
}

function TsbBar({ value }) {
  const pct      = Math.max(-50, Math.min(50, value))
  const barWidth = Math.abs(pct) / 50 * 40
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: tsbColor(value), minWidth: 32, textAlign: 'right' }}>
        {value > 0 ? '+' : ''}{value}
      </span>
      <span style={{ display: 'inline-block', width: barWidth, height: 6, borderRadius: 2, background: tsbColor(value), opacity: 0.7 }} />
    </span>
  )
}

function ReadinessCircle({ score, size = 26 }) {
  if (score === null) return <span style={{ fontFamily: MONO, fontSize: 10, color: GREY }}>—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${readinessColor(score)}`,
      fontFamily: MONO, fontSize: 10, fontWeight: 700, color: readinessColor(score),
    }}>
      {score}
    </span>
  )
}

function AthleteBadges({ ath, noCheckIn }) {
  const rl = getReadinessLabel(ath.acwr_ratio, wellnessAvg(ath))
  const alerts = getAthleteInsights({ acwr: ath.acwr_ratio, wellnessAvg: wellnessAvg(ath) })
  const hasAlert = alerts.some(a => a.flag && a.key !== 'readiness')
  return (
    <>
      <span style={{ ...S.badgeOutline(rl.color), fontWeight: 700 }}>
        {rl.level.toUpperCase()}
      </span>
      {hasAlert && <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED, display: 'inline-block', flexShrink: 0 }} title="Active alerts" />}
      {noCheckIn && (
        <span style={S.badgeOutline(YELLOW)}>
          ⚠ NO CHECK-IN
        </span>
      )}
    </>
  )
}

/**
 * AthleteRow
 * Props:
 *   ath          — athlete data object from squad-sync
 *   isMobile     — boolean (mobile card vs desktop table row)
 *   isExpanded   — boolean
 *   onExpand     — () => void
 *   isFlagged    — boolean
 *   onFlag       — () => void
 *   inCompare    — boolean
 *   compareAtMax — boolean (5 athletes already selected)
 *   onCompare    — () => void
 *   onMessage    — () => void
 *   noCheckIn    — boolean
 *   children     — expanded row content (ExpandedRow)
 */
export default function AthleteRow({
  ath, isMobile, isExpanded, onExpand,
  isFlagged, onFlag, inCompare, compareAtMax, onCompare,
  onMessage, noCheckIn, children,
}) {
  const readiness = hrvToReadiness(ath.last_hrv_score)
  const sessions7 = Math.round(ath.adherence_pct * 7 / 100)

  if (isMobile) {
    return (
      <div style={{
        background: 'var(--surface)', borderRadius: 4,
        border: `1px solid ${isFlagged ? ORANGE : '#2a2a2a'}`,
        borderLeft: `3px solid ${isFlagged ? ORANGE : noCheckIn ? YELLOW : '#2a2a2a'}`,
        overflow: 'hidden',
      }}>
        <div role="button" tabIndex={0} onClick={onExpand} onKeyDown={e => e.key === 'Enter' && onExpand()} style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
          <ReadinessCircle score={readiness} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#eee', fontWeight: 600 }}>{ath.display_name}</span>
              <AthleteBadges ath={ath} noCheckIn={noCheckIn} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: statusColor(ath.training_status), padding: '1px 6px', border: `1px solid ${statusColor(ath.training_status)}44`, borderRadius: 2 }}>
                {ath.training_status}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: acwrColor(ath.acwr_status) }}>ACWR {ath.acwr_ratio ?? '—'}</span>
              <TsbBar value={ath.today_tsb} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <button aria-label={isFlagged ? 'Unflag athlete' : 'Flag athlete'} onClick={e => { e.stopPropagation(); onFlag() }} style={{ ...S.ghostBtn, fontSize: 14, color: isFlagged ? ORANGE : '#333', padding: '10px 8px' }}>★</button>
            <button aria-label={`Message ${ath.display_name}`} title={`Message ${ath.display_name}`} onClick={e => { e.stopPropagation(); onMessage() }} style={{ ...S.ghostBtn, fontSize: 13, color: '#666', padding: '10px 8px' }}>✉</button>
            <input type="checkbox" checked={inCompare} onChange={onCompare} disabled={!inCompare && compareAtMax} onClick={e => e.stopPropagation()} style={{ accentColor: ORANGE, cursor: 'pointer', width: 12, height: 12 }} />
          </div>
        </div>
        {isExpanded && children}
      </div>
    )
  }

  // Desktop: returns [row, optional expanded row] as array for tbody
  return [
    <tr
      key={ath.athlete_id}
      onClick={onExpand}
      style={{
        cursor: 'pointer',
        borderLeft: isFlagged ? `3px solid ${ORANGE}` : noCheckIn ? `3px solid ${YELLOW}` : '3px solid transparent',
        background: isExpanded ? 'var(--surface)' : 'transparent',
        borderBottom: '1px solid #1a1a1a', transition: 'background 0.1s',
      }}
    >
      {/* Compare */}
      <td style={{ padding: '8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={inCompare} onChange={onCompare} disabled={!inCompare && compareAtMax} style={{ accentColor: ORANGE, cursor: 'pointer', width: 12, height: 12 }} />
      </td>
      {/* Athlete name */}
      <td style={{ padding: '8px 8px 8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#eee', fontWeight: 600 }}>{ath.display_name}</span>
          <AthleteBadges ath={ath} noCheckIn={noCheckIn} />
        </div>
        <span style={S.dimText}>{fmtDate(ath.last_session_date)}</span>
      </td>
      {/* Readiness */}
      <td style={{ padding: '8px', textAlign: 'center' }}><ReadinessCircle score={readiness} /></td>
      {/* TSB */}
      <td style={{ padding: '8px' }}><TsbBar value={ath.today_tsb} /></td>
      {/* ACWR */}
      <td style={{ padding: '8px' }}>
        <span style={{ fontFamily: MONO, fontSize: 9, padding: '2px 7px', borderRadius: 2, border: `1px solid ${acwrColor(ath.acwr_status)}44`, color: acwrColor(ath.acwr_status) }}>
          {ath.acwr_ratio !== null ? ath.acwr_ratio.toFixed(2) : '—'}
        </span>
      </td>
      {/* Adherence */}
      <td style={{ padding: '8px' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: adherenceColor(ath.adherence_pct) }}>{sessions7}/7</span>
      </td>
      {/* Status */}
      <td style={{ padding: '8px' }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 2, border: `1px solid ${statusColor(ath.training_status)}44`, color: statusColor(ath.training_status) }}>
          {ath.training_status}
        </span>
      </td>
      {/* Flag */}
      <td style={{ padding: '8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <button aria-label={isFlagged ? 'Unflag athlete' : 'Flag athlete'} onClick={onFlag} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: isFlagged ? ORANGE : '#2a2a2a', padding: '6px 8px' }}>★</button>
      </td>
      {/* Message */}
      <td style={{ padding: '8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <button aria-label={`Message ${ath.display_name}`} onClick={onMessage} title={`Message ${ath.display_name}`} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#555', padding: '6px 8px', lineHeight: 1 }}>✉</button>
      </td>
    </tr>,
    isExpanded && (
      <tr key={ath.athlete_id + '-exp'}>
        <td colSpan={9} style={{ padding: 0 }}>{children}</td>
      </tr>
    ),
  ]
}
