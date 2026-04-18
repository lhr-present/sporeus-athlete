/**
 * tests/e2e/global-setup.ts — Playwright globalSetup
 *
 * Runs once before the entire test suite. Creates the three standing test
 * users that Paths 2-5 reuse, writes their credentials to a shared state
 * file that individual specs read via process.env.
 *
 * User roster:
 *   E2E_ATHLETE_A  — free-tier athlete  (Paths 2, 3)
 *   E2E_COACH_A    — coach-tier coach   (Paths 4, 5)
 *   E2E_ATHLETE_B  — free-tier athlete  (Path 4 — invite target)
 *
 * Credentials are written to tests/e2e/.e2e-users.json (git-ignored).
 * The teardown script reads the same file to delete the users.
 */
import * as fs   from 'fs'
import * as path from 'path'
import { createTestUser, linkCoachAthlete, seedSessions, seedConsent, setUserTier } from './helpers/db.js'

const STATE_FILE = path.join(__dirname, '.e2e-users.json')

export default async function globalSetup() {
  console.log('\n[e2e setup] Creating test users…')

  // ── Create users ─────────────────────────────────────────────────────────────
  const athleteA = await createTestUser('athlete', { tier: 'free' })
  const coachA   = await createTestUser('coach',   { tier: 'coach' })
  const athleteB = await createTestUser('athlete', { tier: 'free' })

  console.log(`[e2e setup] athleteA: ${athleteA.email}`)
  console.log(`[e2e setup] coachA:   ${coachA.email}`)
  console.log(`[e2e setup] athleteB: ${athleteB.email}`)

  // ── Seed consent records (bypass GDPR gate at DB level too) ──────────────────
  await Promise.all([
    seedConsent(athleteA.id),
    seedConsent(coachA.id),
    seedConsent(athleteB.id),
  ])

  // ── Seed training sessions for coachA's athletes (Path 5 needs ≥3 sessions) ──
  // Link athleteA and athleteB to coachA
  await linkCoachAthlete(coachA.id, athleteA.id, 'active')
  await linkCoachAthlete(coachA.id, athleteB.id, 'active')

  // Seed 10 sessions for athleteA (report needs data)
  await seedSessions(athleteA.id, 10, { type: 'Easy Ride', durationMin: 60, tss: 55 })
  // Seed 5 sessions for athleteB
  await seedSessions(athleteB.id, 5, { type: 'Tempo Run', durationMin: 45, tss: 70 })

  // ── Persist credentials for specs and teardown ────────────────────────────────
  const state = { athleteA, coachA, athleteB }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))

  // Expose via env vars so specs can read without importing fs
  process.env.E2E_ATHLETE_A_EMAIL = athleteA.email
  process.env.E2E_ATHLETE_A_PW    = athleteA.password
  process.env.E2E_ATHLETE_A_ID    = athleteA.id
  process.env.E2E_COACH_A_EMAIL   = coachA.email
  process.env.E2E_COACH_A_PW      = coachA.password
  process.env.E2E_COACH_A_ID      = coachA.id
  process.env.E2E_ATHLETE_B_EMAIL = athleteB.email
  process.env.E2E_ATHLETE_B_PW    = athleteB.password
  process.env.E2E_ATHLETE_B_ID    = athleteB.id

  console.log('[e2e setup] Done.\n')
}
