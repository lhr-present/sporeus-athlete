// ─── coach/ExpandedRow.jsx — Expanded athlete detail (PMC + recent sessions) ──
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase.js'
import CTLChart from '../charts/CTLChart.jsx'
import { LangCtx } from '../../contexts/LangCtx.jsx'
// v9.472.0 (E4) — execution profile: session_tag distribution over the fetched
// window; untagged history rows are classified on the fly by the same rules.
import { summarizeSessionTags, TAG_ORDER, TAG_COLORS } from '../../lib/coach/sessionTagSummary.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'

function fmtDate(d) { return d ? d.slice(5) : '—' }

/**
 * ExpandedRow — inline detail panel shown below an athlete table row.
 * Fetches last 30 sessions from Supabase (or reads athlete._log for demo data).
 * @param {object}   props
 * @param {object}   props.athlete  — athlete row object ({ athlete_id, _log?, today_ctl, today_atl, today_tsb })
 * @param {string}   [props.coachId] — coach's Supabase user id; null = demo/offline mode
 * @param {function} props.onNote   — (athlete) => void, opens NotePanel for this athlete
 */
export default function ExpandedRow({ athlete, coachId = null, onNote }) {
  const [liveLog, setLiveLog] = useState(null)
  const [loading, setLoading] = useState(false)
  const { t, lang } = useContext(LangCtx)

  useEffect(() => {
    if (athlete._log) { setLiveLog(athlete._log); return }
    if (!supabase || !coachId) return
    setLoading(true)
    supabase
      .from('training_log')
      .select('date, tss, type, rpe, duration_min, session_tag')
      .eq('user_id', athlete.athlete_id)
      .order('date', { ascending: false })
      .limit(30)
      .then(({ data }) => { setLiveLog(data || []); setLoading(false) })
  }, [athlete.athlete_id, athlete._log, coachId])

  const recent3 = (liveLog || []).slice(0, 3)
  const exec = liveLog && liveLog.length >= 3 ? summarizeSessionTags(liveLog) : null

  return (
    <div style={{ padding: '10px 14px 14px', background: 'var(--surface)', borderTop: '1px solid #1e1e1e' }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          {loading && <div style={{ fontFamily: MONO, fontSize: 9, color: '#444' }}>{lang === 'tr' ? 'Yükleniyor…' : 'Loading…'}</div>}
          {liveLog && liveLog.length >= 5 && <CTLChart log={liveLog} days={30} raceResults={[]} />}
          {liveLog && liveLog.length < 5 && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#444' }}>
              CTL: {athlete.today_ctl} · ATL: {athlete.today_atl} · TSB: {athlete.today_tsb > 0 ? '+' : ''}{athlete.today_tsb}
            </div>
          )}
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 6 }}>{t('recentSessions')}</div>
          {recent3.length === 0 && <div style={{ fontFamily: MONO, fontSize: 10, color: '#444' }}>{t('noRecentSessions')}</div>}
          {recent3.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#666', minWidth: 48 }}>{fmtDate(s.date)}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#888', minWidth: 70 }}>{(s.type || '—').slice(0, 12)}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: ORANGE }}>{s.tss ? `${Math.round(s.tss)} TSS` : '—'}</span>
              {s.rpe && <span style={{ fontFamily: MONO, fontSize: 9, color: '#555' }}>RPE {s.rpe}</span>}
            </div>
          ))}
        </div>
      </div>
      {/* v9.472 — EXECUTION PROFILE: tag distribution over the fetched window.
          Descriptive only (what the athlete DID); prescriptions stay with the coach. */}
      {exec && exec.total > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 6 }}>
            {lang === 'tr' ? 'UYGULAMA PROFİLİ' : 'EXECUTION PROFILE'} · {exec.total} {lang === 'tr' ? 'seans' : 'sessions'}
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 2, overflow: 'hidden', marginBottom: 6, maxWidth: 420 }}>
            {TAG_ORDER.filter(tg => exec.counts[tg] > 0).map(tg => (
              <div key={tg} title={`${tg} ${exec.share[tg]}%`} style={{ width: `${exec.share[tg]}%`, background: TAG_COLORS[tg] }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: exec.flags.length ? 6 : 0 }}>
            {TAG_ORDER.filter(tg => exec.counts[tg] > 0).map(tg => (
              <span key={tg} style={{ fontFamily: MONO, fontSize: 8, color: TAG_COLORS[tg], letterSpacing: '0.04em' }}>
                ■ {tg.replace('_', ' ').toUpperCase()} {exec.counts[tg]}
              </span>
            ))}
          </div>
          {exec.flags.map((f, i) => (
            <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: f.level === 'warn' ? '#e03030' : '#888', marginTop: 2 }}>
              {f.level === 'warn' ? '⚠ ' : '· '}{lang === 'tr' ? f.tr : f.en}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => onNote(athlete)}
        style={{ marginTop: 10, fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', padding: '4px 10px', background: 'transparent', border: '1px solid #333', borderRadius: '2px', color: '#888', cursor: 'pointer' }}
      >
        {t('addNote')}
      </button>
    </div>
  )
}
