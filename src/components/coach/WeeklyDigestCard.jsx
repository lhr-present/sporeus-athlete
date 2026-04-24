// ─── coach/WeeklyDigestCard.jsx — Weekly AI digest for coach ─────────────────
// Reads the latest row from weekly_digests for the signed-in coach.
// digest_json shape: { headline, highlights[], alerts[], recommendation, citations[] }

import { useState, useEffect } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { S } from '../../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'

export default function WeeklyDigestCard({ coachId }) {
  const [digest,  setDigest]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    if (!coachId || !isSupabaseReady()) { setLoading(false); return }
    supabase
      .from('weekly_digests')
      .select('id, week_start, digest_json, created_at')
      .eq('coach_id', coachId)
      .order('week_start', { ascending: false })
      .limit(1)
      .single()
      .then(({ data, error: err }) => {
        if (err && err.code !== 'PGRST116') setError(err.message)
        else setDigest(data ?? null)
        setLoading(false)
      })
  }, [coachId])

  const empty = !loading && !digest

  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'6px', overflow:'hidden', marginTop:'0' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width:'100%', background:'transparent', border:'none', cursor:'pointer', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}
      >
        <span style={{ fontFamily:MONO, fontSize:'11px', fontWeight:700, color:ORANGE, letterSpacing:'0.1em' }}>
          ◈ WEEKLY AI DIGEST
        </span>
        <span style={{ fontFamily:MONO, fontSize:'11px', color:ORANGE }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={{ padding:'0 14px 14px' }}>
          {loading && (
            <div style={{ fontFamily:MONO, fontSize:'11px', color:'var(--muted)', padding:'8px 0' }}>Loading…</div>
          )}

          {error && (
            <div style={{ fontFamily:MONO, fontSize:'11px', color:'#e03030', padding:'8px 0' }}>{error}</div>
          )}

          {empty && (
            <div style={{ fontFamily:MONO, fontSize:'11px', color:'var(--muted)', padding:'8px 0' }}>
              No digest yet — runs Sunday night
            </div>
          )}

          {digest && (() => {
            const d = digest.digest_json || {}
            const highlights = Array.isArray(d.highlights) ? d.highlights : []
            const alerts     = Array.isArray(d.alerts)     ? d.alerts     : []
            const citations  = Array.isArray(d.citations ?? d._citations) ? (d.citations ?? d._citations) : []
            return (
              <div>
                <div style={{ fontFamily:MONO, fontSize:'9px', color:'var(--muted)', marginBottom:'8px', letterSpacing:'0.06em' }}>
                  WEEK OF {digest.week_start}
                </div>

                {d.headline && (
                  <div style={{ fontFamily:MONO, fontSize:'13px', fontWeight:700, color:'var(--text)', marginBottom:'10px', lineHeight:1.4 }}>
                    {d.headline}
                  </div>
                )}

                {highlights.length > 0 && (
                  <div style={{ marginBottom:'10px' }}>
                    <div style={{ fontFamily:MONO, fontSize:'9px', color:BLUE, letterSpacing:'0.1em', marginBottom:'4px' }}>HIGHLIGHTS</div>
                    {highlights.map((h, i) => (
                      <div key={i} style={{ fontFamily:MONO, fontSize:'11px', color:'var(--text)', lineHeight:1.5, paddingLeft:'10px', position:'relative' }}>
                        <span style={{ position:'absolute', left:0, color:BLUE }}>·</span>{h}
                      </div>
                    ))}
                  </div>
                )}

                {alerts.length > 0 && (
                  <div style={{ marginBottom:'10px' }}>
                    <div style={{ fontFamily:MONO, fontSize:'9px', color:'#f5c542', letterSpacing:'0.1em', marginBottom:'4px' }}>ALERTS</div>
                    {alerts.map((a, i) => (
                      <div key={i} style={{ fontFamily:MONO, fontSize:'11px', color:'#f5c542', lineHeight:1.5, paddingLeft:'10px', position:'relative' }}>
                        <span style={{ position:'absolute', left:0 }}>⚠</span>{a}
                      </div>
                    ))}
                  </div>
                )}

                {d.recommendation && (
                  <div style={{ background:'#ff660011', border:'1px solid #ff660033', borderRadius:'4px', padding:'8px 10px', marginBottom:'10px' }}>
                    <div style={{ fontFamily:MONO, fontSize:'9px', color:ORANGE, letterSpacing:'0.1em', marginBottom:'4px' }}>RECOMMENDATION</div>
                    <div style={{ fontFamily:MONO, fontSize:'11px', color:'var(--text)', lineHeight:1.5 }}>{d.recommendation}</div>
                  </div>
                )}

                {citations.length > 0 && (
                  <div>
                    <div style={{ fontFamily:MONO, fontSize:'9px', color:'var(--muted)', letterSpacing:'0.06em', marginBottom:'4px' }}>SOURCES</div>
                    {citations.map((c, i) => (
                      <div key={i} style={{ fontFamily:MONO, fontSize:'9px', color:'var(--muted)', lineHeight:1.5 }}>
                        [{i + 1}] {typeof c === 'string' ? c : (c.title || c.session_id || JSON.stringify(c))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
