// ─── analyse-session/index.ts — Per-session AI coaching feedback ─────────────
// Invoked two ways:
//   1. Client (coach/club tier) — JWT user auth, body: { entry, context? }
//   2. DB webhook (service role) — body: { session_id, user_id, source:'db_webhook' }
//
// In both cases: loads 14-day context, 90-day CTL/ATL/TSB, active injuries.
// Stores result in ai_insights kind='session_analysis', populates session_id FK.
// If coach linked AND flags non-empty: inserts coach mirror kind='coach_session_flag'.

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { withTelemetry } from '../_shared/telemetry.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHR_VER     = '2023-06-01'
const MODEL         = 'claude-haiku-4-5-20251001'
const MAX_TOKENS    = 320
const TIER_ELIGIBLE = new Set(['coach', 'club'])

function ok(body: unknown)         { return new Response(JSON.stringify(body), { headers: { ...CORS, 'Content-Type': 'application/json' } }) }
function err(msg: string, s = 400) { return new Response(JSON.stringify({ error: msg }), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } }) }

function jwtPayload(header: string) {
  try {
    const token = header.replace('Bearer ', '')
    const seg   = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(seg))
  } catch { return null }
}

// ── EWMA-based CTL/ATL from sorted log rows ────────────────────────────────────

function computeCtlAtl(rows: { tss: number }[]): { ctl: number; atl: number; tsb: number; acwr: number | null } {
  let ctl = 0, atl = 0
  for (const r of rows) {
    const tss = r.tss ?? 0
    ctl = ctl + (tss - ctl) / 42
    atl = atl + (tss - atl) / 7
  }
  const tsb  = Math.round((ctl - atl) * 10) / 10
  const acwr = ctl > 0 ? Math.round((atl / ctl) * 100) / 100 : null
  return { ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb, acwr }
}

// ── Flag detection (overreach, HR drift, decoupling) ──────────────────────────

function detectFlags(session: Record<string, unknown>, acwr: number | null, injuries: { zone: string; level: number }[]): string[] {
  const flags: string[] = []
  if (acwr !== null && acwr > 1.35) flags.push(`overreach_risk (ACWR ${acwr})`)
  if (Number(session.decoupling_pct) > 8)  flags.push(`aerobic_decoupling_${session.decoupling_pct}pct`)
  if (injuries.some(i => i.level >= 3))    flags.push(`active_injury_${injuries.find(i => i.level >= 3)?.zone}`)
  const tss = Number(session.tss)
  if (tss > 150) flags.push(`high_stress_session (TSS ${tss})`)
  return flags
}

serve(withTelemetry('analyse-session', async (req) => {
  if (req.method === 'OPTIONS') return ok('ok')
  if (req.method !== 'POST')   return err('Method not allowed', 405)

  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader) return err('Unauthorized', 401)

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey      = Deno.env.get('SUPABASE_ANON_KEY')!
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!anthropicKey) return err('AI analysis not configured', 503)

  const svc = createClient(supabaseUrl, serviceKey)

  // ── Auth: service role (DB webhook) or user JWT ───────────────────────────────
  const payload  = jwtPayload(authHeader)
  const isWebhook = payload?.role === 'service_role'

  let userId: string
  let sessionRow: Record<string, unknown> | null = null

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON', 400) }

  if (isWebhook) {
    // DB webhook path: trust service role, load session from DB
    const session_id = body.session_id as string
    const user_id    = body.user_id as string
    if (!session_id || !user_id) return err('Missing session_id or user_id', 400)

    const { data } = await svc.from('training_log').select('*').eq('id', session_id).maybeSingle()
    if (!data) return err('Session not found', 404)
    sessionRow = data
    userId     = user_id

    // Tier check for webhook path — read from profiles
    const { data: prof } = await svc.from('profiles').select('subscription_tier').eq('id', userId).maybeSingle()
    const tier = prof?.subscription_tier || 'free'
    if (!TIER_ELIGIBLE.has(tier)) {
      return ok({ insight: null, reason: 'upgrade_required' })
    }
  } else {
    // User JWT path (client invoked)
    const anonSb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await anonSb.auth.getUser()
    if (authErr || !user) return err('Unauthorized', 401)
    userId = user.id

    // Tier check
    const { data: prof } = await svc.from('profiles').select('subscription_tier').eq('id', userId).maybeSingle()
    const tier = prof?.subscription_tier || 'free'
    if (!TIER_ELIGIBLE.has(tier)) return ok({ insight: null, reason: 'upgrade_required' })

    // Use provided entry or load from DB by session_id
    if (body.session_id) {
      const { data } = await svc.from('training_log').select('*').eq('id', body.session_id).maybeSingle()
      sessionRow = data
    } else if (body.entry) {
      sessionRow = body.entry as Record<string, unknown>
    }
    if (!sessionRow?.id) return err('Missing session data', 400)
  }

  const sessionId = String(sessionRow!.id)

  // ── Dedup: skip if already analysed (kind='session_analysis') ─────────────────
  const { data: existing } = await svc
    .from('ai_insights')
    .select('id')
    .eq('athlete_id', userId)
    .eq('session_id', sessionId)
    .eq('kind', 'session_analysis')
    .maybeSingle()
  if (existing) return ok({ insight: null, reason: 'already_analysed', id: existing.id })

  // ── Load context: 14-day sessions + 90-day CTL/ATL + injuries ─────────────────
  const now14  = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  const now90  = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const [{ data: recentLogs }, { data: longLogs }, { data: activeInjuries }, { data: planRow }] = await Promise.all([
    svc.from('training_log').select('date, type, tss, rpe, duration_min').eq('user_id', userId).gte('date', now14).order('date'),
    svc.from('training_log').select('tss').eq('user_id', userId).gte('date', now90).order('date'),
    svc.from('injuries').select('zone, level, type').eq('user_id', userId).is('resolved_date', null),
    svc.from('coach_plans').select('goal, weeks').eq('athlete_id', userId).eq('status', 'active').maybeSingle(),
  ])

  const { ctl, atl, tsb, acwr } = computeCtlAtl((longLogs || []) as { tss: number }[])
  const injuries = (activeInjuries || []) as { zone: string; level: number }[]
  const flags    = detectFlags(sessionRow!, acwr, injuries)

  // ── Build prompt ───────────────────────────────────────────────────────────────
  const sessionSummary = [
    `Date: ${sessionRow!.date}`,
    `Type: ${sessionRow!.type || 'Training'}`,
    `Duration: ${sessionRow!.duration_min || sessionRow!.duration || '?'} min`,
    `TSS: ${sessionRow!.tss ?? '?'}`,
    `RPE: ${sessionRow!.rpe ?? '?'}/10`,
    sessionRow!.decoupling_pct != null ? `Decoupling: ${sessionRow!.decoupling_pct}%` : null,
    sessionRow!.notes ? `Notes: ${String(sessionRow!.notes).slice(0, 200)}` : null,
  ].filter(Boolean).join('\n')

  const loadContext = [
    `CTL: ${ctl} · ATL: ${atl} · TSB: ${tsb} · ACWR: ${acwr ?? 'n/a'}`,
    recentLogs?.length ? `Sessions (14d): ${recentLogs.length}, Total TSS: ${recentLogs.reduce((s: number, r: { tss: number }) => s + (r.tss ?? 0), 0)}` : null,
    injuries.length ? `Active injuries: ${injuries.map(i => `${i.zone} L${i.level}`).join(', ')}` : null,
    planRow?.goal ? `Plan goal: ${planRow.goal}` : null,
    flags.length ? `Flags: ${flags.join(', ')}` : null,
  ].filter(Boolean).join('\n')

  const systemPrompt = `You are a concise endurance sports coach. Analyse this single training session in 2–3 sentences:
1. What was accomplished (load, quality, efficiency).
2. Quality vs plan or recent trend if applicable.
3. One specific flag or recommendation (overreach, recovery, technique) based on the flags provided.
Return plain text only. Max 75 words. Be direct and evidence-based.`

  // ── Call Anthropic ─────────────────────────────────────────────────────────────
  let insightText: string
  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': ANTHR_VER },
      body: JSON.stringify({
        model: MODEL, max_tokens: MAX_TOKENS, system: systemPrompt,
        messages: [{ role: 'user', content: `Session:\n${sessionSummary}\n\nContext:\n${loadContext}` }],
      }),
    })
    if (!resp.ok) return err('AI service error', 502)
    const aiResp = await resp.json()
    insightText  = aiResp?.content?.[0]?.text?.trim() || ''
    if (!insightText) return err('Empty AI response', 502)
  } catch (e) {
    console.error('Anthropic error:', e)
    return err('AI service error', 502)
  }

  const today    = new Date().toISOString().slice(0, 10)
  const dataHash = `session_analysis-${sessionId}`

  // ── Upsert ai_insights (kind='session_analysis') ──────────────────────────────
  const { error: insertErr } = await svc
    .from('ai_insights')
    .upsert({
      athlete_id:   userId,
      date:         String(sessionRow!.date || today),
      data_hash:    dataHash,
      kind:         'session_analysis',
      session_id:   sessionId,
      source_id:    sessionId,
      insight_json: { text: insightText, flags, session: { id: sessionId, type: sessionRow!.type, tss: sessionRow!.tss }, acwr, ctl, tsb },
      model:        MODEL,
    }, { onConflict: 'athlete_id,date,data_hash' })

  if (insertErr) console.error('ai_insights insert error:', insertErr.message)

  // ── Close the embed chain: fire-and-forget embed-session with insight_only ───
  // Both analyse-session and embed-session are triggered in parallel by the same
  // training_log INSERT webhook. embed-session's C1 insight-embedding block runs
  // while ai_insights hasn't been written yet (race condition). Re-invoking with
  // insight_only:true after the upsert above guarantees the insight gets embedded.
  if (!insertErr) {
    fetch(`${supabaseUrl}/functions/v1/embed-session`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, user_id: userId, insight_only: true }),
    }).catch(() => {})  // fire-and-forget; failure is acceptable
  }

  // ── Coach mirror: insert kind='coach_session_flag' when flags present ─────────
  if (flags.length > 0) {
    const { data: coachLink } = await svc
      .from('coach_athletes')
      .select('coach_id')
      .eq('athlete_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (coachLink?.coach_id) {
      await svc.from('ai_insights').upsert({
        athlete_id:   coachLink.coach_id,
        date:         String(sessionRow!.date || today),
        data_hash:    `coach_flag-${sessionId}`,
        kind:         'coach_session_flag',
        session_id:   sessionId,
        source_id:    sessionId,
        insight_json: { athlete_id: userId, flags, acwr, ctl, tsb, session_type: sessionRow!.type },
        model:        MODEL,
      }, { onConflict: 'athlete_id,date,data_hash' })
    }
  }

  return ok({ insight: insightText, flags, stored: !insertErr, kind: 'session_analysis' })
}))
