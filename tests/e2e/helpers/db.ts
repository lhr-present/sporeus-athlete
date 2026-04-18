/**
 * tests/e2e/helpers/db.ts — Direct Supabase admin operations for E2E setup/teardown
 *
 * Uses the SERVICE ROLE key (bypasses RLS) for test data seeding.
 * All helpers throw on error so tests fail loudly rather than silently.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  buildAthleteProfile, buildCoachProfile, buildSession,
  AthleteOptions, CoachOptions, SessionOptions, testEmail, requireEnv,
} from '../../fixtures/factories.js'

// ── Admin client ──────────────────────────────────────────────────────────────
let _admin: SupabaseClient | null = null
export function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      requireEnv('E2E_SUPABASE_URL'),
      requireEnv('E2E_SUPABASE_SERVICE_KEY'),
      { auth: { persistSession: false } },
    )
  }
  return _admin
}

// ── User management ───────────────────────────────────────────────────────────

export interface CreatedUser {
  id: string
  email: string
  password: string
}

/**
 * Create a confirmed test user via admin API.
 * email_confirm: true skips the email verification step.
 */
export async function createTestUser(
  role: 'athlete' | 'coach' = 'athlete',
  overrides: { email?: string; password?: string; tier?: 'free' | 'coach' | 'club' } = {},
): Promise<CreatedUser> {
  const email    = overrides.email    ?? testEmail(role)
  const password = overrides.password ?? 'E2eTestPass!2026'

  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message}`)

  const userId = data.user.id

  // Upsert profile row (handle_new_user trigger may have already created it)
  const profileData = role === 'coach'
    ? buildCoachProfile(userId, { email, tier: (overrides.tier ?? 'coach') as 'coach' | 'club' })
    : buildAthleteProfile(userId, { email, tier: overrides.tier ?? 'free' })

  const { error: profileErr } = await admin()
    .from('profiles')
    .upsert(profileData, { onConflict: 'id' })

  if (profileErr) throw new Error(`createTestUser profile upsert failed: ${profileErr.message}`)

  return { id: userId, email, password }
}

/**
 * Delete a test user and all their data (CASCADE handles tables).
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await admin().auth.admin.deleteUser(userId)
  if (error) console.warn(`deleteTestUser(${userId}) failed: ${error.message}`)
}

// ── Profile helpers ───────────────────────────────────────────────────────────

export async function setUserTier(
  userId: string,
  tier: 'free' | 'coach' | 'club',
): Promise<void> {
  const { error } = await admin()
    .from('profiles')
    .update({
      subscription_tier:       tier,
      subscription_expires_at: tier === 'free'
        ? null
        : new Date(Date.now() + 30 * 86400_000).toISOString(),
    })
    .eq('id', userId)
  if (error) throw new Error(`setUserTier failed: ${error.message}`)
}

// ── Session seeding ───────────────────────────────────────────────────────────

export async function seedSessions(
  userId: string,
  count: number,
  baseOpts: Partial<SessionOptions> = {},
): Promise<string[]> {
  const rows = Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
    return buildSession({ userId, date, ...baseOpts })
  })

  const { data, error } = await admin()
    .from('training_log')
    .insert(rows)
    .select('id')

  if (error) throw new Error(`seedSessions failed: ${error.message}`)
  return (data ?? []).map(r => r.id)
}

// ── Coach-athlete link ────────────────────────────────────────────────────────

export async function linkCoachAthlete(
  coachId: string,
  athleteId: string,
  status: 'active' | 'pending' = 'active',
): Promise<void> {
  const { error } = await admin()
    .from('coach_athletes')
    .upsert(
      { coach_id: coachId, athlete_id: athleteId, status },
      { onConflict: 'coach_id,athlete_id' },
    )
  if (error) throw new Error(`linkCoachAthlete failed: ${error.message}`)
}

// ── Strava token stub ─────────────────────────────────────────────────────────

export async function seedStravaToken(userId: string): Promise<void> {
  const { error } = await admin()
    .from('strava_tokens')
    .upsert({
      user_id:           userId,
      access_token:      'e2e_mock_access_token',
      refresh_token:     'e2e_mock_refresh_token',
      expires_at:        new Date(Date.now() + 3600_000).toISOString(),
      strava_athlete_id: 12345678,
      last_sync_at:      null,
    }, { onConflict: 'user_id' })
  if (error) throw new Error(`seedStravaToken failed: ${error.message}`)
}

// ── Consent seed (bypass GDPR gate in tests) ─────────────────────────────────

export async function seedConsent(userId: string): Promise<void> {
  const { error } = await admin()
    .from('consents')
    .upsert([
      { user_id: userId, consent_type: 'data_processing', version: '1.1' },
      { user_id: userId, consent_type: 'health_data',     version: '1.1' },
    ], { onConflict: 'user_id,consent_type,version' })
  if (error) throw new Error(`seedConsent failed: ${error.message}`)
}

// ── Wait helpers ──────────────────────────────────────────────────────────────

/** Poll a DB query until it returns at least one row or timeout expires. */
export async function waitForRow(
  table: string,
  filter: Record<string, unknown>,
  { timeoutMs = 30_000, intervalMs = 1_000 } = {},
): Promise<Record<string, unknown>> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    let query = admin().from(table).select('*').limit(1)
    for (const [col, val] of Object.entries(filter)) query = query.eq(col, val)
    const { data } = await query
    if (data && data.length > 0) return data[0]
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`waitForRow(${table}, ${JSON.stringify(filter)}) timed out after ${timeoutMs}ms`)
}

/** Poll a DB count until it reaches expected or timeout expires. */
export async function waitForCount(
  table: string,
  filter: Record<string, unknown>,
  expected: number,
  { timeoutMs = 30_000, intervalMs = 1_000 } = {},
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    let query = admin().from(table).select('*', { count: 'exact', head: true })
    for (const [col, val] of Object.entries(filter)) query = query.eq(col, val)
    const { count } = await query
    if ((count ?? 0) >= expected) return
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`waitForCount(${table}, expected=${expected}) timed out after ${timeoutMs}ms`)
}
