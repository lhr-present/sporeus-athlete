import { useContext, useMemo, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeSeasonStats, topSportByVolume } from '../../lib/athlete/seasonStats.js'

const SPORT_COLORS = {
  running: '#ff6600',
  cycling: '#2196f3',
  rowing: '#4caf50',
  swimming: '#9c27b0',
  general: '#607d8b',
}
const EXTRA_COLORS = ['#e91e63', '#ff9800', '#00bcd4', '#8bc34a', '#795548', '#009688']

function sportColor(sport, index) {
  return SPORT_COLORS[sport?.toLowerCase()] || EXTRA_COLORS[index % EXTRA_COLORS.length]
}

export default function SeasonStatsCard({ log = [] }) {
  const { t } = useContext(LangCtx)
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const stats = useMemo(
    () => computeSeasonStats(log, selectedYear),
    [log, selectedYear]
  )

  // Return null if no sessions
  if (stats.totalSessions === 0) return null

  const hours = (stats.totalDurationMin / 60).toFixed(1)

  const headlineStats = [
    { val: stats.totalSessions, lbl: t('seasonSessions') || 'Sessions' },
    { val: stats.totalDistanceKm, lbl: `${t('seasonDistance') || 'Distance'} (km)` },
    { val: hours, lbl: t('seasonHours') || 'Hours' },
    { val: stats.totalTSS, lbl: t('seasonTSS') || 'TSS' },
  ]

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '40ms' }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <div style={S.cardTitle}>
          {t('seasonStats') || 'Season Statistics'}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* Year selector buttons */}
          {[currentYear, currentYear - 1].map(yr => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                border: `1px solid ${selectedYear === yr ? '#ff6600' : 'var(--border)'}`,
                background: selectedYear === yr ? 'rgba(255,102,0,0.12)' : 'transparent',
                color: selectedYear === yr ? '#ff6600' : 'var(--muted)',
                fontWeight: selectedYear === yr ? 700 : 400,
              }}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* 4 headline stats */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '14px',
      }}>
        {headlineStats.map(({ val, lbl }) => (
          <div
            key={lbl}
            style={{
              flex: '1 1 60px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '8px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '0.02em',
            }}>
              {val}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '9px',
              color: 'var(--muted)',
              letterSpacing: '0.06em',
              marginTop: '3px',
              textTransform: 'uppercase',
            }}>
              {lbl}
            </div>
          </div>
        ))}
      </div>

      {/* Sport breakdown segmented bar */}
      {stats.sportBreakdown.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            {t('seasonSportBreakdown') || 'Sport Breakdown'}
          </div>
          {/* Segmented horizontal bar */}
          <div style={{
            display: 'flex',
            height: '12px',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '8px',
          }}>
            {stats.sportBreakdown.map((s, i) => (
              <div
                key={s.sport}
                title={`${s.sport}: ${s.pct}%`}
                style={{
                  width: `${s.pct}%`,
                  background: sportColor(s.sport, i),
                  transition: 'width 0.3s',
                }}
              />
            ))}
          </div>
          {/* Legend */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            {stats.sportBreakdown.map((s, i) => (
              <div key={s.sport} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  background: sportColor(s.sport, i),
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '9px',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                }}>
                  {s.sport} {s.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best week callout */}
      {stats.bestWeek && (
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '10px',
          color: 'var(--muted)',
          padding: '6px 10px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid #ff6600',
          borderRadius: '3px',
          marginBottom: '8px',
          letterSpacing: '0.04em',
        }}>
          {t('seasonBestWeek') || 'Best week'}: {stats.bestWeek.weekStart} · {stats.bestWeek.tss} {t('seasonTSS') || 'TSS'}
        </div>
      )}

      {/* Streak row */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px',
        color: 'var(--muted)',
        letterSpacing: '0.04em',
      }}>
        {t('seasonStreak') || 'Streak'}: {t('currentStreak') || 'Current'}: {stats.currentStreak} days · Best: {stats.maxStreak} days
      </div>
    </div>
  )
}
