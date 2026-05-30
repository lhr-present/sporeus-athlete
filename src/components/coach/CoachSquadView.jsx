// ─── CoachSquadView.jsx — Realtime squad overview table ──────────────────────
// Replaces the manual athlete list in CoachDashboard.
// Calls get_squad_overview() RPC for CTL/ATL/TSB/ACWR/HRV/status.
// Subscribes to coach_athletes realtime channel — new athlete joins instantly.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseReady, sbQuery } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { predictInjuryRisk } from '../../lib/intelligence.js'
import { computeLoad } from '../coachDashboard/helpers.jsx'
import SbAthletePanel from '../coachDashboard/SbAthletePanel.jsx'
import InviteManager from '../InviteManager.jsx'
import SquadRedFlagsCard from './SquadRedFlagsCard.jsx'
import {
  acwrColor, tsbColor, trainingStatusColor,
  formatLastSession, sortAthletes, filterAthletes,
  getAthleteAttentionSignal, ATTENTION_COLORS,
} from '../../lib/squadView.js'
import { summarizeSquad } from '../../lib/coach/squadSummary.js'

const MONO = "'IBM Plex Mono', monospace"
const DIM  = '#555'

const COLS = [
  // v9.105.0 (Prompt HH): leading ATTN column. Sort defaults to desc so
  // urgent rises to top. Click toggles asc/desc.
  { id: 'attention',   label: 'ATTN',     flex: '0 0 36px'  },
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
  // v9.105.0 (Prompt HH) — Default to attention DESC so urgent athletes
  // appear at the top of the list on load. Coaches who want alphabetical
  // can still click the ATHLETE column to re-sort.
  const [sortBy, setSortBy]             = useState('attention')
  const [sortDir, setSortDir]           = useState('desc')
  const [selectedId, setSelectedId]     = useState(null)
  const [athleteData, setAthleteData]   = useState({})   // { [athleteId]: { log, recovery } }
  const [loadingDetail, setLoadingDetail] = useState(false)
  const channelRef = useRef(null)
  // v9.109.0 (Prompt WW) — Coach plan acceptance metrics. Aggregated client-
  // side from a single coach_plans query keyed on coach_id. Cheaper than a
  // dedicated RPC for this scale; per-coach plan counts are typically <1000.
  const [planStats, setPlanStats] = useState(null)

  const fetchSquad = useCallback(async () => {
    if (!isSupabaseReady() || !coachId) { setLoading(false); return }
    const { data, error } = await sbQuery('get_squad_overview', () =>
      supabase.rpc('get_squad_overview', { p_coach_id: coachId })
    )
    if (error) {
      logger.error(new Error(`[CoachSquadView] rpc: ${error.message}`), { code: error.code })
      setLoading(false)
      return
    }
    setAthletes(data ?? [])
    setLoading(false)
  }, [coachId])

  // v9.109.0 (Prompt WW) — Plan acceptance stats fetch. One-shot on
  // coach load; doesn't need realtime since accepted_at/rejected_at
  // updates don't change frequently enough to warrant a subscription.
  useEffect(() => {
    if (!isSupabaseReady() || !coachId) return
    supabase
      .from('coach_plans')
      .select('id, accepted_at, rejected_at, status')
      .eq('coach_id', coachId)
      .then(({ data, error }) => {
        if (error || !Array.isArray(data)) return
        const total = data.length
        const accepted = data.filter(p => p.accepted_at).length
        const declined = data.filter(p => p.rejected_at).length
        const pending  = data.filter(p => !p.accepted_at && !p.rejected_at && p.status === 'active').length
        setPlanStats({ total, accepted, declined, pending })
      })
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
    // v9.56.0 — coach drill-down was missing athlete profile (sport, FTP,
    // VO2max, weight, gender). Without it, SbAthletePanel can't surface
    // sport-specific context, drag-factor norms, W/kg bands, or W/kg-derived
    // %-of-WR. Fetch in parallel with log + recovery.
    const [{ data: log }, { data: recovery }, { data: profileRow }] = await Promise.all([
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
      supabase
        .from('profiles')
        .select('profile_data')
        .eq('id', athleteId)
        .maybeSingle(),
    ])
    setAthleteData(prev => ({
      ...prev,
      [athleteId]: {
        log: log || [],
        recovery: recovery || [],
        profile: profileRow?.profile_data || {},
      },
    }))
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

      {/* ── v9.130.0 — Squad summary strip. Pre-v9.130 the only roll-up was
          the (athletes.length) connected count next to the section header.
          Coaches scanning a 10+ athlete roster had to count urgent/
          attention rows by eye. This strip surfaces the same per-athlete
          signal (squadView.getAthleteAttentionSignal) aggregated: counts
          + top firing reasons + week-level activity stats.
          Hidden when there are no athletes loaded yet. */}
      {!loading && athletes.length > 0 && (() => {
        const summary = summarizeSquad(athletes)
        const { counts, topReasons, activity } = summary
        const urgentColor = '#e03030', attentionColor = '#f5c542', okColor = '#5bc25b'
        return (
          <div style={{
            marginBottom: '14px', padding: '10px 12px',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderLeft: '3px solid #0064ff', borderRadius: '4px',
          }}>
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: topReasons.length > 0 ? '8px' : 0 }}>
              <div style={{ fontSize: '9px', color: '#0064ff', letterSpacing: '0.12em', fontWeight: 700 }}>
                ◆ SQUAD
              </div>
              {counts.urgent > 0 && (
                <div style={{ fontSize: '11px' }}>
                  <span style={{ color: urgentColor, fontWeight: 700 }}>{counts.urgent}</span>
                  <span style={{ color: DIM, marginLeft: '4px' }}>urgent</span>
                </div>
              )}
              {counts.attention > 0 && (
                <div style={{ fontSize: '11px' }}>
                  <span style={{ color: attentionColor, fontWeight: 700 }}>{counts.attention}</span>
                  <span style={{ color: DIM, marginLeft: '4px' }}>attention</span>
                </div>
              )}
              <div style={{ fontSize: '11px' }}>
                <span style={{ color: okColor, fontWeight: 700 }}>{counts.ok}</span>
                <span style={{ color: DIM, marginLeft: '4px' }}>ok</span>
              </div>
              <div style={{ flex: 1 }}/>
              <div style={{ fontSize: '10px', color: '#aaa' }}>
                {activity.activeLast7d}/{summary.total} <span style={{ color: DIM }}>active 7d</span>
              </div>
              {activity.zeroSessionsThisWeek > 0 && (
                <div style={{ fontSize: '10px', color: '#aaa' }}>
                  {activity.zeroSessionsThisWeek} <span style={{ color: DIM }}>idle this wk</span>
                </div>
              )}
              {activity.avgAdherencePct != null && (
                <div style={{ fontSize: '10px', color: '#aaa' }}>
                  {activity.avgAdherencePct}% <span style={{ color: DIM }}>avg adh</span>
                </div>
              )}
            </div>
            {topReasons.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {topReasons.slice(0, 4).map(r => (
                  <span key={r.key} style={{
                    fontSize: '9px', color: '#aaa', background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: '3px',
                    padding: '2px 7px', letterSpacing: '0.04em',
                  }}>
                    {r.count}× <span style={{ color: '#888' }}>{r.label?.en || r.key}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── v9.109.0 (Prompt WW) — Plan acceptance stats. One-line summary of
          this coach's coach_plans by status. Surfaces a leading indicator
          coaches couldn't see before: the accept rate. Bar visually
          weights accepted (green) vs declined (red) vs pending (amber). */}
      {planStats && planStats.total > 0 && (() => {
        const acceptPct = Math.round((planStats.accepted / planStats.total) * 100)
        return (
          <div style={{
            marginBottom: '14px', padding: '8px 12px',
            background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '4px',
            display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
            fontSize: '10px',
          }}>
            <span style={{ color: DIM, letterSpacing: '0.08em' }}>PLANS SENT</span>
            <span style={{ color: '#e0e0e0', fontWeight: 700 }}>{planStats.total}</span>
            <span style={{ color: '#5bc25b' }}>
              ✓ {planStats.accepted} <span style={{ color: DIM, fontWeight: 400 }}>accepted</span>
            </span>
            {planStats.declined > 0 && (
              <span style={{ color: '#e03030' }}>
                ✕ {planStats.declined} <span style={{ color: DIM, fontWeight: 400 }}>declined</span>
              </span>
            )}
            {planStats.pending > 0 && (
              <span style={{ color: '#f5c542' }}>
                ⏱ {planStats.pending} <span style={{ color: DIM, fontWeight: 400 }}>pending</span>
              </span>
            )}
            <span style={{ marginLeft: 'auto', color: acceptPct >= 70 ? '#5bc25b' : acceptPct >= 40 ? '#f5c542' : '#e03030', fontWeight: 700 }}>
              {acceptPct}% accept rate
            </span>
          </div>
        )
      })()}

      {/* ── Invite manager ── */}
      <div style={{ marginBottom: '16px' }}>
        <InviteManager coachId={coachId} />
      </div>

      {/* v9.48.0 — Today's Red Flags triage card. Surfaces athletes with
          ACWR>1.5 (Gabbett 2016) / TSB<-20 / 5+d silent BEFORE the squad
          table so coaches see who needs attention without scanning rows. */}
      {!loading && athletes.length > 0 ? (
        <SquadRedFlagsCard athletes={athletes} onSelectAthlete={selectAthlete} />
      ) : null}

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
              <div
                key={col.id}
                style={hdr(col.id, col.flex)}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort(col.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(col.id) } }}
              >
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
                  {/* v9.105.0 (Prompt HH) — Attention signal dot. Replaces
                      the old standalone injury-risk dot in the name column —
                      attention is a richer superset that combines ACWR,
                      adherence, fatigue, staleness, and training status. */}
                  {(() => {
                    const attn = getAthleteAttentionSignal(ath)
                    const color = ATTENTION_COLORS[attn.level] || ATTENTION_COLORS.ok
                    const tip = attn.reasons.length === 0
                      ? 'OK · no flagged signals'
                      : attn.reasons.map(r => '• ' + (r.label?.en || r.key)).join('\n')
                    const visible = attn.level !== 'ok'
                    return (
                      <div style={cell(COLS[0].flex, { textAlign: 'center', fontSize: '11px' })} title={tip}>
                        {visible ? <span style={{ color }}>●</span> : <span style={{ color: '#333' }}>○</span>}
                      </div>
                    )
                  })()}

                  {/* Athlete name */}
                  <div style={cell(COLS[1].flex, { color: '#e0e0e0', fontWeight: 700 })}>
                    {ath.display_name}
                  </div>

                  {/* Training status */}
                  <div style={cell(COLS[2].flex, { color: trainingStatusColor(ath.training_status), fontSize: '9px', letterSpacing: '0.05em' })}>
                    {ath.training_status ?? '—'}
                  </div>

                  {/* CTL */}
                  <div style={cell(COLS[3].flex, { color: '#ff6600' })}>
                    {ath.today_ctl != null ? ath.today_ctl : '—'}
                  </div>

                  {/* TSB */}
                  <div style={cell(COLS[4].flex, { color: tsbColor(ath.today_tsb) })}>
                    {ath.today_tsb != null
                      ? (ath.today_tsb > 0 ? `+${ath.today_tsb}` : String(ath.today_tsb))
                      : '—'}
                  </div>

                  {/* ACWR */}
                  <div style={cell(COLS[5].flex, { color: acwrColor(ath.acwr_status) })}>
                    {ath.acwr_ratio != null ? ath.acwr_ratio : '—'}
                  </div>

                  {/* Last session */}
                  <div style={cell(COLS[6].flex, { fontSize: '10px' })}>
                    {formatLastSession(ath.last_session_date)}
                  </div>

                  {/* Adherence% */}
                  <div style={cell(COLS[7].flex, {
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
