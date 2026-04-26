// src/components/dashboard/PRTimelineCard.jsx — E33: Personal Best Timeline Card
// Shows the timeline of when PRs were set and recent PR streaks.
import { useContext, useMemo } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computePRTimeline } from '../../lib/athlete/prTimeline.js'

export default function PRTimelineCard({ log }) {
  const { t, lang } = useContext(LangCtx)

  const timeline = useMemo(
    () => computePRTimeline(log ?? [], 5),
    [log]
  )

  if (!timeline) return null

  const { recentPRs, totalPRCount, lastPRDate: _lastPRDate, daysSinceLastPR } = timeline

  // Badge summary: e.g. '47 total · last 3 days ago'
  const badgeParts = []
  if (totalPRCount > 0) badgeParts.push(`${totalPRCount} ${t('prTotal')}`)
  if (daysSinceLastPR !== null) badgeParts.push(`${t('prLastSet')} ${daysSinceLastPR} ${t('prDaysAgo')}`)
  const badge = badgeParts.join(' · ')

  return (
    <div className="sp-card" style={S.card}>
      {/* Title */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#ff6600',
        marginBottom: '10px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '8px',
      }}>
        ◈ {t('prTitle')}
      </div>

      {/* Badge */}
      {badge && (
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '10px',
          color: '#888',
          marginBottom: '12px',
          letterSpacing: '0.04em',
        }}>
          {badge}
        </div>
      )}

      {/* PR events list */}
      {recentPRs.length === 0 ? (
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '11px',
          color: '#888',
          fontStyle: 'italic',
        }}>
          {t('prEmpty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentPRs.map((ev, idx) => (
            <PREventRow key={`${ev.date}-${idx}`} ev={ev} lang={lang} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function PREventRow({ ev, lang, t }) {
  const displayPRs = ev.prs.slice(0, 2)

  return (
    <div style={{
      borderLeft: '2px solid #ff660044',
      paddingLeft: '10px',
    }}>
      {/* Date + session type */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '9px',
        color: '#555',
        marginBottom: '4px',
        letterSpacing: '0.04em',
      }}>
        {ev.date}{ev.type ? ` · ${ev.type}` : ''}
      </div>

      {/* PR list */}
      {displayPRs.map((pr, i) => {
        const label = lang === 'tr' ? pr.tr : pr.en
        // Compute improvement % if prev exists
        let improvement = null
        if (pr.prev && pr.prev > 0 && pr.value > pr.prev) {
          const pct = Math.round(((pr.value - pr.prev) / pr.prev) * 100)
          improvement = `+${pct}%`
        }

        return (
          <div key={i} style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '10px',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
            marginBottom: '2px',
            flexWrap: 'wrap',
          }}>
            <span style={{ color: '#ff6600', fontWeight: 700, fontSize: '9px' }}>
              {pr.category.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span style={{ color: 'var(--text)', fontSize: '10px' }}>
              {label}
            </span>
            {improvement && (
              <span style={{
                color: '#5bc25b',
                fontSize: '9px',
                fontWeight: 700,
              }}>
                {improvement} {t('prImprovement')}
              </span>
            )}
          </div>
        )
      })}

      {ev.prs.length > 2 && (
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '9px',
          color: '#888',
          marginTop: '2px',
        }}>
          +{ev.prs.length - 2} more
        </div>
      )}
    </div>
  )
}
