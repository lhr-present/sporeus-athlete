/**
 * tests/fixtures/factories.ts — Test data builders for Sporeus E2E tests
 *
 * All builders return plain objects; DB insertion is handled by helpers/db.ts.
 * Timestamps default to now() so factories can be called at test time.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── env helpers ───────────────────────────────────────────────────────────────
export function getEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

export function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Required env var ${key} is not set`)
  return v
}

// ── Supabase admin client (service role — bypasses RLS) ───────────────────────
export function adminClient(): SupabaseClient {
  return createClient(
    requireEnv('E2E_SUPABASE_URL'),
    requireEnv('E2E_SUPABASE_SERVICE_KEY'),
    { auth: { persistSession: false } },
  )
}

// ── Unique test IDs ───────────────────────────────────────────────────────────
let _seq = 0
export function testId(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${++_seq}-${Math.random().toString(36).slice(2, 7)}`
}

export function testEmail(role = 'athlete'): string {
  return `sporeus-e2e-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.sporeus.dev`
}

// ── Athlete factory ───────────────────────────────────────────────────────────
export interface AthleteOptions {
  sport?: string
  ftp?: number
  tier?: 'free' | 'coach' | 'club'
  displayName?: string
  email?: string
}

export function buildAthleteProfile(userId: string, opts: AthleteOptions = {}) {
  return {
    id:                  userId,
    display_name:        opts.displayName ?? `Test Athlete ${userId.slice(0, 6)}`,
    email:               opts.email ?? testEmail('athlete'),
    role:                'athlete',
    sport:               opts.sport ?? 'Cycling',
    ftp:                 opts.ftp ?? 250,
    subscription_tier:   opts.tier ?? 'free',
    training_age:        '1-3 years',
    goal:                'Build base fitness',
  }
}

// ── Coach factory ─────────────────────────────────────────────────────────────
export interface CoachOptions {
  tier?: 'coach' | 'club'
  athleteCount?: number
  displayName?: string
  email?: string
}

export function buildCoachProfile(userId: string, opts: CoachOptions = {}) {
  return {
    id:               userId,
    display_name:     opts.displayName ?? `Test Coach ${userId.slice(0, 6)}`,
    email:            opts.email ?? testEmail('coach'),
    role:             'coach',
    sport:            'Cycling',
    subscription_tier: opts.tier ?? 'coach',
  }
}

// ── Training session factory ──────────────────────────────────────────────────
export interface SessionOptions {
  userId: string
  date?: string
  type?: string
  durationMin?: number
  tss?: number
  rpe?: number
  notes?: string
}

export function buildSession(opts: SessionOptions) {
  const date = opts.date ?? new Date().toISOString().slice(0, 10)
  const dur  = opts.durationMin ?? 60
  const rpe  = opts.rpe ?? 6
  const tss  = opts.tss ?? Math.round((dur / 60) * rpe * rpe * 0.67)   // RPE-based estimate
  return {
    user_id:      opts.userId,
    date,
    type:         opts.type ?? 'Easy Ride',
    duration_min: dur,
    tss,
    rpe,
    notes:        opts.notes ?? 'E2E test session',
    source:       'manual',
  }
}

// ── Strava mock activity ──────────────────────────────────────────────────────
export interface StravaActivityOptions {
  athleteId?: number
  distance?: number        // metres
  movingTime?: number      // seconds
  elapsedTime?: number
  type?: string
  startDate?: string
}

export function mockStravaActivity(opts: StravaActivityOptions = {}) {
  const startDate = opts.startDate ?? '2026-04-18T07:00:00Z'
  const moving    = opts.movingTime ?? 3600
  const elapsed   = opts.elapsedTime ?? moving + 120
  return {
    id:              Math.floor(Math.random() * 1e10),
    athlete:         { id: opts.athleteId ?? 12345678 },
    name:            'Morning Ride',
    type:            opts.type ?? 'Ride',
    distance:        opts.distance ?? 35000,
    moving_time:     moving,
    elapsed_time:    elapsed,
    start_date:      startDate,
    start_date_local: startDate.replace('Z', '+03:00'),
    average_watts:   200,
    weighted_average_watts: 210,
    suffer_score:    55,
    has_heartrate:   true,
    average_heartrate: 150,
    max_heartrate:   172,
    map: { summary_polyline: 'adef~{abcXYZ' },
  }
}

// ── Dodo webhook mock payload ─────────────────────────────────────────────────
export interface DodoWebhookOptions {
  userId: string
  userEmail?: string
  tier?: 'coach' | 'club'
  eventType?: 'payment.succeeded' | 'subscription.cancelled'
}

export function mockDodoWebhook(opts: DodoWebhookOptions) {
  return {
    event_type:    opts.eventType ?? 'payment.succeeded',
    data: {
      customer: {
        email:     opts.userEmail ?? testEmail('customer'),
        metadata:  { supabase_uid: opts.userId },
      },
      product_id:  opts.tier === 'club' ? 'club_monthly' : 'coach_monthly',
      amount:      opts.tier === 'club' ? 4900 : 1900,
      currency:    'TRY',
    },
  }
}

// ── Stripe webhook mock payload ───────────────────────────────────────────────
export interface StripeWebhookOptions {
  userId: string
  userEmail?: string
  tier?: 'coach' | 'club'
  eventType?: 'checkout.session.completed'
}

export function mockStripeWebhook(opts: StripeWebhookOptions) {
  return {
    type: opts.eventType ?? 'checkout.session.completed',
    data: {
      object: {
        id:              `cs_test_${Math.random().toString(36).slice(2)}`,
        customer_email:  opts.userEmail ?? testEmail('stripe'),
        metadata: {
          supabase_uid: opts.userId,
          tier:         opts.tier ?? 'coach',
        },
        amount_total:    opts.tier === 'club' ? 4900 : 1900,
        currency:        'usd',
        payment_status:  'paid',
      },
    },
  }
}
