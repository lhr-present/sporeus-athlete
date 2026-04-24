// src/components/coach/SquadCompareStrip.jsx — E3: Squad Comparison strip
// Shows CTL (fitness) and ACWR side-by-side for all active athletes
// from mv_squad_readiness as a Recharts BarChart, collapsible.
import { useEffect, useState, useContext } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'

// ACWR zone color: green if 0.8–1.3, yellow if 1.3–1.5, red otherwise
function acwrColor(acwr) {
  if (acwr == null) return '#555'
  if (acwr >= 0.8 && acwr <= 1.3) return '#00c853'
  if (acwr > 1.3 && acwr <= 1.5) return '#ffd600'
  return '#d50000'
}

function truncate(str, n) {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n) + '…' : str
}

export default function SquadCompareStrip({ coachId }) {
  const { t } = useContext(LangCtx)
  const [open, setOpen] = useLocalStorage('sporeus-squad-compare-open', true)
  const [athletes, setAthletes] = useState([])

  useEffect(() => {
    if (!isSupabaseReady() || !coachId) return
    supabase
      .from('mv_squad_readiness')
      .select('athlete_id, display_name, ctl, acwr')
      .then(({ data }) => {
        if (!data) return
        const filtered = data.filter(a => typeof a.ctl === 'number' && a.ctl > 0)
        setAthletes(filtered)
      })
  }, [coachId])

  // Don't render if no athletes have data
  if (!isSupabaseReady() || !coachId || athletes.length === 0) return null

  const chartData = athletes.map(a => ({
    name: truncate(a.display_name, 10),
    ctl: typeof a.ctl === 'number' ? Math.round(a.ctl * 10) / 10 : 0,
    acwr: typeof a.acwr === 'number' ? Math.round(a.acwr * 100) / 100 : 0,
    _acwrColor: acwrColor(a.acwr),
  }))

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...S.mono,
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        aria-expanded={open}
      >
        <div style={{ ...S.cardTitle, margin: 0 }}>
          {t('squadComparison').toUpperCase()}
        </div>
        <span style={{ ...S.mono, fontSize: '12px', color: '#0064ff' }}>
          {open ? '▼' : '▶'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: '12px' }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 10, height: 10, background: '#0064ff', borderRadius: 2 }} />
              <span style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)' }}>
                {t('squadComparisonCTL')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 10, height: 10, background: '#00c853', borderRadius: 2 }} />
              <span style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)' }}>
                {t('squadComparisonACWR')} (0.8–1.3 ✓)
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              barCategoryGap="20%"
              barGap={2}
            >
              <XAxis
                dataKey="name"
                tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fill: 'var(--muted)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fill: 'var(--muted)' }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--card-bg, #111)',
                  border: '1px solid var(--border, #333)',
                  borderRadius: 4,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: 'var(--text, #e0e0e0)',
                }}
                formatter={(value, name) => {
                  if (name === 'ctl') return [value, t('squadComparisonCTL')]
                  if (name === 'acwr') return [value, t('squadComparisonACWR')]
                  return [value, name]
                }}
              />
              {/* CTL bars — uniform blue */}
              <Bar dataKey="ctl" fill="#0064ff" radius={[2, 2, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#0064ff" />
                ))}
              </Bar>
              {/* ACWR bars — per-athlete color based on zone */}
              <Bar dataKey="acwr" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry._acwrColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
