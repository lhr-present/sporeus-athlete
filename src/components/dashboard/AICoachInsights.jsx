// ─── dashboard/AICoachInsights.jsx — Daily AI coaching summary card ───────────
// Reads today's pre-generated insight from ai_insights (written by nightly-batch).
// Falls back to on-demand generation via ai-proxy if nightly batch hasn't run yet.
// Tier-gated server-side (free → 403); opt-in toggle client-side.
import { useState, useEffect, useCallback } from 'react'
import { S } from '../../styles.js'
import { useData } from '../../contexts/DataContext.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { logAction } from '../../lib/db/auditLog.js'

const SYSTEM_PROMPT = `You are a sport science coach assistant. Generate a concise daily training summary.
Output ONLY valid JSON: {"summary": string}
Three-sentence summary: (1) load trend, (2) readiness interpretation, (3) tomorrow's recommendation.
Plain language. Under 80 words. Supportive but evidence-based tone.`

function buildUserMsg(log, profile, ctl, atl, tsb, acwr) {
  const recent = log.slice(-7)
    .map(e => `${e.date} ${e.type} ${e.duration}min RPE${e.rpe} TSS${e.tss}`)
    .join('\n')
  return `Athlete: ${profile.sport || 'endurance'}, ${profile.athleteLevel || 'recreational'}
CTL=${Math.round(ctl)} ATL=${Math.round(atl)} TSB=${Math.round(tsb)} ACWR=${acwr ? acwr.toFixed(2) : '—'}
Last 7 sessions:\n${recent || '(none)'}`
}

/**
 * @param {{ dl: object }} props
 */
export default function AICoachInsights({ dl }) {
  const { log, profile }         = useData()
  const { user }                 = useAuth()
  const [optedIn, setOptedIn]    = useLocalStorage('sporeus-ai-optin', false)

  const [insight,    setInsight]    = useState(null)   // { id, summary, explanation }
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showWhy,    setShowWhy]    = useState(false)
  const [whyLoading, setWhyLoading] = useState(false)
  const [error,      setError]      = useState(null)
  const [feedback,   setFeedback]   = useState(null)   // 1 | -1 | null

  const fetchInsight = useCallback(async () => {
    if (!isSupabaseReady() || !user) return
    const today = new Date().toISOString().slice(0, 10)
    setLoading(true)
    const { data } = await supabase
      .from('ai_insights')
      .select('id, insight_json, explanation_text, model')
      .eq('athlete_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.insight_json?.summary) {
      setInsight({ id: data.id, summary: data.insight_json.summary, explanation: data.explanation_text, model: data.model })
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (optedIn && user) fetchInsight()
  }, [optedIn, user, fetchInsight])

  const handleGenerate = async () => {
    if (!isSupabaseReady() || !user || generating) return
    setGenerating(true)
    setError(null)
    try {
      const recent28 = log.slice(-28)
      const ctl = recent28.reduce((s, e) => s + (e.tss || 0), 0) / 42
      const recent7 = log.slice(-7)
      const atl = recent7.reduce((s, e) => s + (e.tss || 0), 0) / 7
      const tsb = ctl - atl
      const chronic = recent28.reduce((s, e) => s + (e.tss || 0), 0) / 28
      const acwr = chronic > 0 ? atl / chronic : null

      const { data, error: fnErr } = await supabase.functions.invoke('ai-proxy', {
        body: { model_alias: 'haiku', system: SYSTEM_PROMPT, user_msg: buildUserMsg(log, profile, ctl, atl, tsb, acwr), max_tokens: 256 },
      })
      if (fnErr) throw new Error(fnErr.message || 'AI proxy error')
      if (data?.error) throw new Error(data.error)

      let parsed
      try { parsed = JSON.parse(data.content) } catch { parsed = { summary: data.content } }
      if (!parsed?.summary) throw new Error('Unexpected response from AI — try again.')

      const today = new Date().toISOString().slice(0, 10)
      const { data: inserted } = await supabase
        .from('ai_insights')
        .insert({ athlete_id: user.id, date: today, data_hash: `on-demand-${Date.now()}`, insight_json: parsed, model: 'haiku' })
        .select('id')
        .single()
      setInsight({ id: inserted?.id, summary: parsed.summary, explanation: null, model: 'haiku' })
    } catch (e) {
      setError(e.message)
    }
    setGenerating(false)
  }

  const handleWhy = async () => {
    if (!insight) return
    if (insight.explanation) { setShowWhy(v => !v); return }
    setWhyLoading(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ai-proxy', {
        body: {
          model_alias: 'haiku',
          system: 'You are a sport science tutor. Explain the science behind a training recommendation to a non-expert athlete. Under 60 words. Plain language.',
          user_msg: `Explain the reasoning behind: "${insight.summary}"`,
          max_tokens: 128,
        },
      })
      if (fnErr || data?.error) throw new Error(fnErr?.message || data?.error)
      const text = data.content || ''
      if (insight.id) {
        await supabase.from('ai_insights').update({ explanation_text: text }).eq('id', insight.id)
      }
      setInsight(prev => ({ ...prev, explanation: text }))
      setShowWhy(true)
    } catch { /* silent — button disappears on error */ }
    setWhyLoading(false)
  }

  const handleFeedback = async (rating) => {
    if (feedback !== null || !insight?.id) return
    setFeedback(rating)
    await logAction('feedback', 'ai_insights', String(insight.id), ['rating'])
  }

  if (!dl?.aiInsights) return null

  if (!optedIn) return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '185ms', borderLeft: '4px solid #ff660055' }}>
      <div style={S.cardTitle}>AI COACH INSIGHTS</div>
      <div style={{ ...S.mono, fontSize: '11px', color: '#888', lineHeight: 1.7, marginBottom: '10px' }}>
        Daily AI training summary — load trend, readiness read, tomorrow&apos;s recommendation.
        Powered by Claude Haiku. Requires Coach or Club plan.
      </div>
      <button style={{ ...S.btnSec, fontSize: '11px', padding: '5px 12px' }} onClick={() => setOptedIn(true)}>
        ENABLE AI INSIGHTS
      </button>
    </div>
  )

  if (!user) return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '185ms' }}>
      <div style={S.cardTitle}>AI COACH INSIGHTS</div>
      <div style={{ ...S.mono, fontSize: '11px', color: '#555' }}>Sign in to receive AI coaching insights.</div>
    </div>
  )

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '185ms', borderLeft: '4px solid #ff660055' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={S.cardTitle}>AI COACH INSIGHTS</div>
        {insight?.model && <span style={{ ...S.mono, fontSize: 8, color: '#444' }}>claude {insight.model}</span>}
      </div>

      {loading ? (
        <div style={{ ...S.mono, fontSize: '11px', color: '#555' }}>Loading…</div>
      ) : insight ? (
        <>
          <div style={{ ...S.mono, fontSize: '12px', color: 'var(--text)', lineHeight: 1.8, marginBottom: 8 }}>
            ◈ {insight.summary}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleWhy}
              style={{ ...S.mono, fontSize: '10px', color: '#4a90d9', background: 'transparent', border: '1px solid #4a90d944', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer' }}
            >
              {whyLoading ? '…' : showWhy ? 'HIDE WHY' : 'WHY?'}
            </button>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {[{ r: 1, lbl: '👍' }, { r: -1, lbl: '👎' }].map(({ r, lbl }) => (
                <button
                  key={r}
                  onClick={() => handleFeedback(r)}
                  disabled={feedback !== null}
                  aria-label={r === 1 ? 'Helpful' : 'Not helpful'}
                  style={{ background: 'transparent', border: 'none', cursor: feedback === null ? 'pointer' : 'default', fontSize: 14, opacity: feedback === null ? 1 : feedback === r ? 1 : 0.3 }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {showWhy && insight.explanation && (
            <div style={{ ...S.mono, fontSize: '10px', color: '#888', marginTop: 8, padding: '6px 10px', background: 'var(--surface)', borderRadius: '3px', lineHeight: 1.7 }}>
              {insight.explanation}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ ...S.mono, fontSize: '11px', color: '#555', marginBottom: 10, lineHeight: 1.7 }}>
            {log.length < 3
              ? 'Log at least 3 sessions to generate AI insights.'
              : 'No insight yet for today. Generate now or wait for the nightly batch (03:00 UTC).'}
          </div>
          {log.length >= 3 && (
            <button onClick={handleGenerate} disabled={generating} style={{ ...S.btnSec, fontSize: '11px', padding: '5px 12px' }}>
              {generating ? 'GENERATING…' : 'GENERATE INSIGHT'}
            </button>
          )}
          {error && <div style={{ ...S.mono, fontSize: '10px', color: '#e03030', marginTop: 6 }}>{error}</div>}
        </>
      )}

      <button
        onClick={() => { setOptedIn(false); setInsight(null); setError(null) }}
        style={{ ...S.mono, fontSize: '9px', color: '#444', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: 10, padding: 0, letterSpacing: '0.06em', display: 'block' }}
      >
        DISABLE
      </button>
    </div>
  )
}
