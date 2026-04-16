// ─── CoachSquadView.jsx — Realtime squad overview table ──────────────────────
// Replaces the manual athlete list in CoachDashboard.
// Calls get_squad_overview() RPC for CTL/ATL/TSB/ACWR/HRV/status.
// Subscribes to coach_athletes realtime channel — new athlete joins instantly.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { predictInjuryRisk } from '../../lib/intelligence.js'
import { computeLoad } from '../coachDashboard/helpers.jsx'
import SbAthletePanel from '../coachDashboard/SbAthletePanel.jsx'
import InviteManager from '../InviteManager.jsx'
import {
  acwrColor, tsbColor, trainingStatusColor,
  formatLastSession, sortAthletes, filterAthletes,
} from '../../lib/squadView.js'

const MONO = "'IBM Plex Mono', monospace"
const DIM  = '#555'

const COLS = [
  { id: 'name',        label: 'ATHLETE',  flex: '2 1 120px' },
  { id: 'status',      label: 'STATUS',   flex: '1 1 90px'  },
  { id: 'ctl',         label: 'CTL',      flex: '0 0 48px'  },
  { id: 'tsb',         label: 'TSB',      flex: '0 0 52px'  },
  { id: 'acwr',        label: 'ACWR',     flex: '0 0 52px'  },
  { id: 'lastSession', label: 'LAST',     flex: '0 0 64px'  },
  { id: 'adherence',   label: 'ADH%',     flex: '0 0 44px'  },
]

const FILTER_CHIPS = [
  { id: 'all',         label: 'All'        },
  { id: 'danger',      label: 'Danger'     },
  { id: 'caution',     label: 'Caution'    },
  { id: 'detraining',  label: 'Detraining' },
]

export default function CoachSquadView({ coachId, coachName = '' }) {
  const [athletes, setAthletes]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [chip, setChip]                 = useState('all')
  const [sortBy, setSortBy]             = useState('name')
  const [sortDir, setSortDir]           = useState('asc')
  const [selectedId, setSelectedId]     = useState(null)
  const [athleteData, setAthleteData]   = useState({})   // { [athleteId]: { log, recovery } }
  const [loadingDetail, setLoadingDetail] = useState(false)
  const channelRef = useRef(null)

  const fetchSquad = useCallback(async () => {
    if (!isSupabaseReady() || !coachId) { setLoading(false); return }
    const { data, error } = await supabase.rpc('get_squad_overview', { p_coach_id: coachId })
    if (error) {
      logger.warn('[CoachSquadView] rpc error:', error.message)
      setLoading(false)
      return
    }
    setAthletes(data ?? [])
    setLoading(false)
  }, [coachId])

  // Initial fetch + realtime subscription
  useEffect(() => {
    fetchSquad()
    if (!isSupabaseReady() || !coachId) return

    const channel = supabase
      .channel(`squad-${coachId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coach_athletes', filter: `coach_id=eq.${coachId}` },
        () => { fetchSquad() },
      )
      .subscribe()

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [coachId, fetchSquad])

  async function selectAthlete(athleteId) {
    if (selectedId === athleteId) { setSelectedId(null); return }
    setSelectedId(athleteId)
    if (athleteData[athleteId] || !isSupabaseReady()) return
    setLoadingDetail(true)
    const [{ data: log }, { data: recovery }] = await Promise.all([
      supabase
        .from('training_log')
        .select('*')
        .eq('user_id', athleteId)
        .order('date', { ascending: false })
        .limit(365),
      supabase
        .from('recovery')
        .select('*')
        .eq('user_id', athleteId)
        .order('date', { ascending: false })
        .limit(90),
    ])
    setAthleteData(prev => ({ ...prev, [athleteId]: { log: log || [], recovery: recovery || [] } }))
    setLoadingDetail(false)
  }

  function toggleSort(colId) {
    if (sortBy === colId) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(colId); setSortDir('asc') }
  }

  const visible = filterAthletes(sortAthletes(athletes, sortBy, sortDir), search, chip)

  const hdr = (colId, flex) => ({
    fontFamily: MONO, fontSize: '8px', letterSpacing: '0.1em',
    color: sortBy === colId ? '#ff6600' : DIM,
    cursor: 'pointer', userSelect: 'none',
    padding: '0 4px', flex,
  })

  const cell = (flex, extra = {}) => ({
    fontFamily: MONO, fontSize: '11px', color: '#ccc',
    padding: '0 4px', flex,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    ...extra,
  })

  return (
    <div style={{ fontFamily: MONO }}>

      {/* ── Section header ── */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#0064ff', letterSpacing: '0.1em', marginBottom: '12px' }}>
        MY ATHLETES (LIVE)
        {!loading && (
          <span style={{ color: DIM, fontWeight: 400, marginLeft: '8px', fontSize: '10px' }}>
            {athletes.length} connected
          </span>
        )}
      </div>

      {/* ── Invite manager ── */}
      <div style={{ marginBottom: '16px' }}>
        <InviteManager coachId={coachId} />
      </div>

      {/* ── Nothing connected yet ── */}
      {!loading && athletes.length === 0 && (
        <div style={{ fontSize: '10px', color: DIM, fontStyle: 'italic', padding: '4px 0' }}>
          No connected athletes yet — generate an invite link above.
        </div>
      )}

      {/* ── Squad table ── */}
      {(loading || athletes.length > 0) && (
        <>
          {/* Search + filter chips */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
            <input
              style={{
                fontFamily: MONO, fontSize: '11px', padding: '5px 10px',
                border: '1px solid #2a2a2a', borderRadius: '4px',
                background: '#111', color: '#e0e0e0',
                flex: '1 1 140px', boxSizing: 'border-box',
              }}
              placeholder="Search athlete…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {FILTER_CHIPS.map(fc => (
                <button
                  key={fc.id}
                  onClick={() => setChip(fc.id)}
                  style={{
                    fontFamily: MONO, fontSize: '9px', fontWeight: 600,
                    padding: '3px 8px', borderRadius: '3px', cursor: 'pointer',
                    border: `1px solid ${chip === fc.id ? '#ff6600' : '#2a2a2a'}`,
                    background: chip === fc.id ? '#ff660022' : 'transparent',
                    color: chip === fc.id ? '#ff6600' : DIM,
                  }}
                >
                  {fc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 14px', borderBottom: '1px solid #1e1e1e', marginBottom: '4px' }}>
            {COLS.map(col => (
              <div key={col.id} style={hdr(col.id, col.flex)} onClick={() => toggleSort(col.id)}>
                {col.label}{sortBy === col.id ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </div>
            ))}
          </div>

          {/* Skeleton rows while loading */}
          {loading && Array.from({ length: 3 }, (_, i) => (
            <div key={i} style={{
              height: '38px', background: '#0d0d0d', borderRadius: '4px',
              marginBottom: '4px', opacity: 0.35,
            }} />
          ))}

          {/* No results after filter */}
          {!loading && visible.length === 0 && athletes.length > 0 && (
            <div style={{ fontSize: '10px', color: DIM, padding: '12px 0' }}>
              No athletes match this filter.
            </div>
          )}

          {/* Athlete rows */}
          {!loading && visible.map(ath => {
            const isSelected = selectedId === ath.athlete_id
            const data       = athleteData[ath.athlete_id]
            const metrics    = data ? computeLoad(data.log) : null
            const injRisk    = data ? predictInjuryRisk(data.log, data.recovery, {}) : null
            const adherence  = ath.adherence_pct ?? 0

            return (
              <div key={ath.athlete_id}>
                <button
                  onClick={() => selectAthlete(ath.athlete_id)}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: isSelected ? '#0064ff14' : '#0d0d0d',
                    border: `1px solid ${isSelected ? '#0064ff55' : '#1e1e1e'}`,
                    borderRadius: '4px', padding: '8px 14px', marginBottom: '3px',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {/* Athlete name */}
                  <div style={cell(COLS[0].flex, { color: '#e0e0e0', fontWeight: 700 })}>
                    {injRisk && (
                      <span style={{
                        color: injRisk.level === 'HIGH' ? '#e03030' : '#f5c542',
                        marginRight: '4px', fontSize: '9px',
                      }}>●</span>
                    )}
                    {ath.display_name}
                  </div>

                  {/* Training status */}
                  <div style={cell(COLS[1].flex, { color: trainingStatusColor(ath.training_status), fontSize: '9px', letterSpacing: '0.05em' })}>
                    {ath.training_status ?? '—'}
                  </div>

                  {/* CTL */}
                  <div style={cell(COLS[2].flex, { color: '#ff6600' })}>
                    {ath.today_ctl != null ? ath.today_ctl : '—'}
                  </div>

                  {/* TSB */}
                  <div style={cell(COLS[3].flex, { color: tsbColor(ath.today_tsb) })}>
                    {ath.today_tsb != null
                      ? (ath.today_tsb > 0 ? `+${ath.today_tsb}` : String(ath.today_tsb))
                      : '—'}
                  </div>

                  {/* ACWR */}
                  <div style={cell(COLS[4].flex, { color: acwrColor(ath.acwr_status) })}>
                    {ath.acwr_ratio != null ? ath.acwr_ratio : '—'}
                  </div>

                  {/* Last session */}
                  <div style={cell(COLS[5].flex, { fontSize: '10px' })}>
                    {formatLastSession(ath.last_session_date)}
                  </div>

                  {/* Adherence% */}
                  <div style={cell(COLS[6].flex, {
                    color: adherence >= 70 ? '#5bc25b' : adherence >= 40 ? '#f5c542' : '#e03030',
                  })}>
                    {ath.adherence_pct != null ? `${ath.adherence_pct}%` : '—'}
                  </div>
                </button>

                {/* Expanded athlete detail */}
                {isSelected && (
                  <div style={{ marginBottom: '8px' }}>
                    <SbAthletePanel
                      athleteId={ath.athlete_id}
                      athleteName={ath.display_name}
                      data={data}
                      metrics={metrics}
                      injRisk={injRisk}
                      loading={loadingDetail && !data}
                      coachId={coachId}
                      coachName={coachName}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
