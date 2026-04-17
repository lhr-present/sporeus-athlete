// ─── adjust-coach-plan/index.ts — Auto-adjust plan volume on injury ──────────
// Called by DB webhook (AFTER INSERT on injuries).
// Input:  { injury_id, user_id, level: 1-5, zone: string, source: 'db_webhook' }
// Action: finds active coach_plans for this athlete, reduces volume 20–40% for
//         next 7 days (based on injury level), writes coach_notes entry.

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { withTelemetry } from '../_shared/telemetry.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function ok(body: unknown)         { return new Response(JSON.stringify(body), { headers: { ...CORS, 'Content-Type': 'application/json' } }) }
function err(msg: string, s = 400) { return new Response(JSON.stringify({ error: msg }), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } }) }

function jwtPayload(header: string) {
  try {
    const seg = header.replace('Bearer ', '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(seg))
  } catch { return null }
}

// Severity → volume cut %: level 1–2 = mild (20%), level 3 = moderate (30%), level 4–5 = severe (40%)
function cutPct(level: number): number {
  if (level <= 2) return 20
  if (level === 3) return 30
  return 40
}

function applyVolumeCut(weeks: Record<string, unknown>[], fromDate: string, toDays: number, pct: number): Record<string, unknown>[] {
  const factor = 1 - pct / 100
  const from   = new Date(fromDate).getTime()
  const to     = from + toDays * 86400000

  return weeks.map(week => {
    const wd = new Date((week.start_date || week.date || week.weekStart || week.week_start) as string).getTime()
    if (isNaN(wd) || wd < from || wd >= to) return week

    const sessions = (week.sessions || []) as Record<string, unknown>[]
    return {
      ...week,
      volume_adjusted: true,
      volume_cut_pct:  pct,
      sessions: sessions.map(s => ({
        ...s,
        duration: typeof s.duration === 'number' ? Math.round((s.duration as number) * factor) : s.duration,
        tss:      typeof s.tss      === 'number' ? Math.round((s.tss      as number) * factor) : s.tss,
        notes:    `[AUTO-ADJUSTED -${pct}% injury] ${s.notes || ''}`.trim(),
      })),
    }
  })
}

serve(withTelemetry('adjust-coach-plan', async (req) => {
  if (req.method === 'OPTIONS') return ok('ok')
  if (req.method !== 'POST')   return err('Method not allowed', 405)

  const authHeader = req.headers.get('authorization') || ''
  const payload    = jwtPayload(authHeader)
  if (!payload || payload.role !== 'service_role') return err('Unauthorized — service role only', 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const svc         = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON', 400) }

  const { injury_id, user_id, level: rawLevel, zone } = body
  if (!user_id) return err('Missing user_id', 400)

  const injuryLevel = Number(rawLevel) || 1

  // ── Find active coach plan for this athlete ───────────────────────────────────
  const { data: planRow, error: planErr } = await svc
    .from('coach_plans')
    .select('id, coach_id, weeks, name')
    .eq('athlete_id', user_id)
    .eq('status', 'active')
    .maybeSingle()

  if (planErr || !planRow) {
    // No active plan — nothing to adjust; log and exit gracefully
    console.log(`adjust-coach-plan: no active plan for athlete ${user_id}`)
    return ok({ adjusted: false, reason: 'no_active_plan' })
  }

  const cut       = cutPct(injuryLevel)
  const today     = new Date().toISOString().slice(0, 10)
  const weeks     = (planRow.weeks || []) as Record<string, unknown>[]
  const newWeeks  = applyVolumeCut(weeks, today, 7, cut)
  const changed   = JSON.stringify(newWeeks) !== JSON.stringify(weeks)

  if (changed) {
    await svc.from('coach_plans').update({ weeks: newWeeks }).eq('id', planRow.id)
  }

  // ── Write coach_notes entry for transparency ──────────────────────────────────
  const noteBody = `⚠ AUTO-ADJUSTMENT: Injury reported (${zone || 'unknown zone'}, severity L${injuryLevel}). ` +
    `Plan volume reduced ${cut}% for next 7 days. Review and confirm this adjustment is appropriate.`

  await svc.from('coach_notes').insert({
    coach_id:   planRow.coach_id,
    athlete_id: user_id,
    note:       noteBody,
    category:   'injury',
  })

  return ok({ adjusted: changed, cut_pct: cut, plan_id: planRow.id, athlete_id: user_id, injury_id })
}))
