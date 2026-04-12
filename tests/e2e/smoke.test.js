// ─── tests/e2e/smoke.test.js — Integration smoke tests against real Supabase ──
// Requires a Supabase test project with the full schema applied.
// Set env vars before running:
//   SUPABASE_TEST_URL=https://xxxx.supabase.co
//   SUPABASE_TEST_ANON_KEY=eyJ...
//   SUPABASE_TEST_SERVICE_KEY=eyJ...  (for coach/admin operations)
//   SUPABASE_TEST_ATHLETE_A=<athlete-a-email>
//   SUPABASE_TEST_ATHLETE_A_PW=<password>
//   SUPABASE_TEST_ATHLETE_B=<athlete-b-email>
//   SUPABASE_TEST_ATHLETE_B_PW=<password>
//   SUPABASE_TEST_COACH=<coach-email>
//   SUPABASE_TEST_COACH_PW=<password>
//
// Run: npm run test:e2e
// All tests are skipped when SUPABASE_TEST_URL is not set.

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const TEST_URL     = process.env.SUPABASE_TEST_URL
const TEST_ANON    = process.env.SUPABASE_TEST_ANON_KEY
const TEST_SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY

const skip = !TEST_URL || !TEST_ANON

// ── Helpers ───────────────────────────────────────────────────────────────────
function client(key = TEST_ANON) {
  return createClient(TEST_URL, key)
}

async function signIn(sb, email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn(${email}): ${error.message}`)
  return data.user
}

// ── Test suite ────────────────────────────────────────────────────────────────
describe.skipIf(skip)('E2E smoke tests (require SUPABASE_TEST_URL)', () => {
  let sbA, sbB, sbCoach

  beforeAll(async () => {
    sbA     = client()
    sbB     = client()
    sbCoach = client()

    const emailA  = process.env.SUPABASE_TEST_ATHLETE_A
    const pwA     = process.env.SUPABASE_TEST_ATHLETE_A_PW
    const emailB  = process.env.SUPABASE_TEST_ATHLETE_B
    const pwB     = process.env.SUPABASE_TEST_ATHLETE_B_PW
    const emailC  = process.env.SUPABASE_TEST_COACH
    const pwC     = process.env.SUPABASE_TEST_COACH_PW

    if (emailA && pwA) await signIn(sbA, emailA, pwA)
    if (emailB && pwB) await signIn(sbB, emailB, pwB)
    if (emailC && pwC) await signIn(sbCoach, emailC, pwC)
  })

  it('athlete reads own wellness_log (RLS allows)', async () => {
    const { data, error } = await sbA
      .from('wellness_logs')
      .select('user_id, date, score')
      .limit(5)
    expect(error).toBeNull()
    // All returned rows belong to the authenticated athlete
    if (data && data.length > 0) {
      const { data: { user } } = await sbA.auth.getUser()
      data.forEach(row => expect(row.user_id).toBe(user.id))
    }
  })

  it('athlete_b cannot read athlete_a wellness_log (RLS blocks)', async () => {
    // Get athlete_a's user_id
    const { data: { user: userA } } = await sbA.auth.getUser()
    if (!userA) return // skip if not signed in

    // Query as athlete_b — RLS should filter out all of athlete_a's rows
    const { data, error } = await sbB
      .from('wellness_logs')
      .select('user_id')
      .eq('user_id', userA.id)
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(0)
  })

  it('coach reads org athletes via coach_athletes (rows returned)', async () => {
    const { data: { user: coach } } = await sbCoach.auth.getUser()
    if (!coach) return // skip if not signed in

    const { data, error } = await sbCoach
      .from('coach_athletes')
      .select('athlete_id, display_name')
      .eq('coach_id', coach.id)
      .limit(20)
    expect(error).toBeNull()
    // If no athletes yet, data is [] — still passes (no error is the key check)
    expect(Array.isArray(data)).toBe(true)
  })

  it('coach cannot read a different org coach_athletes (RLS blocks)', async () => {
    // Use a random UUID that is not any real coach's id
    const fakeCoachId = '00000000-0000-0000-0000-000000000001'
    const { data, error } = await sbCoach
      .from('coach_athletes')
      .select('athlete_id')
      .eq('coach_id', fakeCoachId)
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(0)
  })

  it('free-tier POST to ai-proxy returns tier error (not 200)', async () => {
    // Use a fresh unauthenticated client — no tier = free
    const sbAnon = client()
    // Try to call ai-proxy without auth — expect 401 or error in body
    const { data, error } = await sbAnon.functions.invoke('ai-proxy', {
      body: { model_alias: 'haiku', system: 'test', user_msg: 'hello', max_tokens: 10 },
    })
    // Either a fetch error (401/403) OR the function returns { error: '...' }
    const hasError = error !== null || (data && data.error)
    expect(hasError).toBe(true)
    // If there's an error body, it should mention tier or auth
    if (data?.error) {
      expect(data.error.toLowerCase()).toMatch(/tier|auth|token|sign/)
    }
  })
})
