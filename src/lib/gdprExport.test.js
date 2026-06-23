// @vitest-environment jsdom
import { it, expect, vi, beforeEach } from 'vitest'

// ─── Stateful in-memory supabase mock ─────────────────────────────────────────
// A tiny relational store seeded with rows for user A AND user B. Each .from()
// builds a query chain that records its .eq()/.lt() filters and, when awaited
// (export) or .delete()-ed, applies them against the live store — so dropping a
// user filter, or filtering on the WRONG key column, changes the observable
// result and FAILS the test (the old mock used mockReturnThis() and could not
// detect cross-user leakage).

const A = 'user-A'
const B = 'user-B'

// table → array of rows. Seeded fresh each test in beforeEach.
let store

// Records of every .eq(col, val) call, grouped by table, for assertions.
let eqCalls

function seed() {
  store = {
    // single-party, keyed user_id
    training_log:       [{ id: 't1', user_id: A }, { id: 't2', user_id: B }],
    recovery:           [{ id: 'r1', user_id: A }, { id: 'r2', user_id: B }],
    injuries:           [{ id: 'i1', user_id: A }, { id: 'i2', user_id: B }],
    test_results:       [{ id: 'tr1', user_id: A }, { id: 'tr2', user_id: B }],
    race_results:       [{ id: 'rr1', user_id: A }, { id: 'rr2', user_id: B }],
    push_subscriptions: [{ id: 'p1', user_id: A }, { id: 'p2', user_id: B }],
    strava_tokens:      [{ user_id: A, access_token: 'a' }, { user_id: B, access_token: 'b' }],
    athlete_devices:    [{ id: 'd1', user_id: A }, { id: 'd2', user_id: B }],
    ai_feedback:        [{ id: 'af1', user_id: A }, { id: 'af2', user_id: B }],
    training_plans:     [{ id: 'tp1', user_id: A }, { id: 'tp2', user_id: B }],
    onboarding_state:   [{ user_id: A }, { user_id: B }],
    consents:           [{ id: 'c1', user_id: A }, { id: 'c2', user_id: B }],
    consent_purposes:   [{ id: 'cp1', user_id: A }, { id: 'cp2', user_id: B }],
    attribution_events: [{ id: 'ae1', user_id: A }, { id: 'ae2', user_id: B }],
    notification_log:   [{ id: 'n1', user_id: A }, { id: 'n2', user_id: B }],
    export_jobs:        [{ id: 'ej1', user_id: A }, { id: 'ej2', user_id: B }],
    activity_upload_jobs:[{ id: 'au1', user_id: A }, { id: 'au2', user_id: B }],
    insight_embeddings: [{ insight_id: 'e1', user_id: A }, { insight_id: 'e2', user_id: B }],
    session_embeddings: [{ session_id: 's1', user_id: A }, { session_id: 's2', user_id: B }],
    session_views:      [{ user_id: A, session_id: 's1' }, { user_id: B, session_id: 's2' }],
    message_reads:      [{ user_id: A, thread_id: 'th1' }, { user_id: B, thread_id: 'th2' }],
    generated_reports:  [{ id: 'gr1', user_id: A }, { id: 'gr2', user_id: B }],
    // single-party, keyed athlete_id  ← WRONG-KEY regression guard
    ai_insights:        [{ id: 'ins1', athlete_id: A }, { id: 'ins2', athlete_id: B }],
    ai_proxy_usage:     [{ id: 'pu1', athlete_id: A }, { id: 'pu2', athlete_id: B }],
    session_attendance: [{ id: 'sa1', athlete_id: A }, { id: 'sa2', athlete_id: B }],
    // single-party, keyed author_id
    session_comments:   [{ id: 'sc1', author_id: A }, { id: 'sc2', author_id: B }],
    // profiles keyed by id (= auth uid)  ← WRONG-KEY regression guard
    profiles:           [{ id: A, email: 'a@x' }, { id: B, email: 'b@x' }],
    // exportOnly (legal/financial retention)
    billing_events:      [{ id: 'be1', user_id: A }, { id: 'be2', user_id: B }],
    subscription_events: [{ id: 'se1', user_id: A }, { id: 'se2', user_id: B }],
    audit_log:           [{ id: 'al1', user_id: A }, { id: 'al2', user_id: B }],
    data_rights_requests:[{ id: 'dr1', user_id: A }, { id: 'dr2', user_id: B }],
    deletion_requests:   [{ id: 'de1', user_id: A }, { id: 'de2', user_id: B }],
    // two-party: A is coach in one row, athlete in another; B unrelated
    coach_notes: [
      { id: 'cn1', coach_id: A, athlete_id: 'someone' },
      { id: 'cn2', coach_id: 'coachX', athlete_id: A },
      { id: 'cn3', coach_id: B, athlete_id: 'other' },
    ],
    coach_plans: [
      { id: 'cpl1', coach_id: A, athlete_id: 'someone' },
      { id: 'cpl2', coach_id: 'coachX', athlete_id: A },
      { id: 'cpl3', coach_id: B, athlete_id: 'other' },
    ],
    messages: [
      { id: 'm1', coach_id: A, athlete_id: 'someone' },
      { id: 'm2', coach_id: 'coachX', athlete_id: A },
      { id: 'm3', coach_id: B, athlete_id: 'other' },
    ],
    gdpr_erasure_log: [],
  }
  eqCalls = {}
}

function makeQuery(table) {
  // Pending filters applied at resolve time.
  const filters = []
  let mode = 'select' // or 'delete'

  function rows() {
    let rs = store[table] || []
    for (const [col, val] of filters) rs = rs.filter((r) => r[col] === val)
    return rs
  }

  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((col, val) => {
      filters.push([col, val])
      ;(eqCalls[table] ||= []).push([col, val])
      return chain
    }),
    lt: vi.fn(() => chain),
    is: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => { mode = 'delete'; return chain }),
    insert: vi.fn(async (row) => {
      ;(store[table] ||= []).push(row)
      return { error: null }
    }),
  }

  // Awaiting the chain resolves the query. For delete, mutate the store.
  chain.then = (resolve) => {
    const matched = rows()
    if (mode === 'delete') {
      store[table] = (store[table] || []).filter((r) => !matched.includes(r))
    }
    return resolve({ data: matched, error: null })
  }
  return chain
}

vi.mock('./supabase.js', () => ({
  supabase: { from: vi.fn() },
  isSupabaseReady: () => true,
}))
vi.mock('./storage/local.js', () => ({ clearAllAppData: vi.fn() }))
vi.mock('./db/auditLog.js', () => ({ logAction: vi.fn(async () => {}) }))
vi.mock('./logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

import { supabase } from './supabase.js'

beforeEach(() => {
  seed()
  vi.clearAllMocks()
  supabase.from.mockImplementation((table) => makeQuery(table))
  // jsdom localStorage
  localStorage.clear()
})

import { exportAthleteData, deleteAthleteData } from './gdprExport.js'

// Mirror of the registry so the test asserts coverage + correct keys independently.
const EXPORT_KEYS = {
  training_log: 'user_id', recovery: 'user_id', injuries: 'user_id',
  test_results: 'user_id', race_results: 'user_id', profiles: 'id',
  push_subscriptions: 'user_id', ai_insights: 'athlete_id', ai_feedback: 'user_id',
  ai_proxy_usage: 'athlete_id', strava_tokens: 'user_id', athlete_devices: 'user_id',
  training_plans: 'user_id', onboarding_state: 'user_id', consents: 'user_id',
  consent_purposes: 'user_id', attribution_events: 'user_id', notification_log: 'user_id',
  export_jobs: 'user_id', activity_upload_jobs: 'user_id', insight_embeddings: 'user_id',
  session_embeddings: 'user_id', session_views: 'user_id', message_reads: 'user_id',
  generated_reports: 'user_id', session_attendance: 'athlete_id',
  session_comments: 'author_id', billing_events: 'user_id', subscription_events: 'user_id',
  audit_log: 'user_id', data_rights_requests: 'user_id', deletion_requests: 'user_id',
}
const TWO_PARTY_TABLES = ['coach_notes', 'coach_plans', 'messages']
// Tables that must NOT be touched by delete (exportOnly + two-party).
const DELETE_EXCLUDED = [
  'billing_events', 'subscription_events', 'audit_log',
  'data_rights_requests', 'deletion_requests',
  'consents', 'consent_purposes', // retained on erasure (proof-of-consent obligation)
  'coach_notes', 'coach_plans', 'messages',
]

// ─── guards ───────────────────────────────────────────────────────────────────
it('exportAthleteData throws when userId is missing', async () => {
  await expect(exportAthleteData(null)).rejects.toThrow('userId required')
  await expect(exportAthleteData('')).rejects.toThrow('userId required')
})

it('deleteAthleteData throws when userId is missing', async () => {
  await expect(deleteAthleteData(null)).rejects.toThrow('userId required')
})

// ─── export: ONLY user A's rows, using each table's correct key ───────────────
it('exportAthleteData returns ONLY user A rows for every single-party table', async () => {
  const result = await exportAthleteData(A)
  expect(result.userId).toBe(A)
  expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)

  for (const [table, key] of Object.entries(EXPORT_KEYS)) {
    const rows = result.tables[table]
    expect(rows, `${table} should be present in export`).toBeDefined()
    expect(rows.length, `${table} should return exactly 1 row (A's, not B's)`).toBe(1)
    // none of A's exported rows may carry B's owner-key value
    for (const r of rows) {
      expect(r[key], `${table} leaked a non-A row via key ${key}`).toBe(A)
    }
    // and the filter was applied on the CORRECT column with A's id
    expect(eqCalls[table], `${table} never filtered`).toContainEqual([key, A])
  }
})

it('exportAthleteData includes two-party tables filtered to A as either participant', async () => {
  const result = await exportAthleteData(A)
  for (const table of TWO_PARTY_TABLES) {
    const rows = result.tables[table]
    expect(rows, `${table} present`).toBeDefined()
    // A is coach in one row + athlete in another → exactly 2, B's row excluded
    expect(rows.length, `${table} should return A's 2 rows, not B's`).toBe(2)
    for (const r of rows) {
      expect(r.coach_id === A || r.athlete_id === A).toBe(true)
    }
    // both participant keys queried
    expect(eqCalls[table]).toContainEqual(['coach_id', A])
    expect(eqCalls[table]).toContainEqual(['athlete_id', A])
  }
})

// ─── delete: ONLY A's rows removed, B untouched, correct key per table ────────
it('deleteAthleteData deletes ONLY user A rows and leaves user B intact', async () => {
  const result = await deleteAthleteData(A)
  expect(result.error).toBeNull()
  expect(Array.isArray(result.tablesAffected)).toBe(true)

  for (const [table, key] of Object.entries(EXPORT_KEYS)) {
    if (DELETE_EXCLUDED.includes(table)) continue
    const remaining = store[table]
    // A's row gone, B's row stays
    expect(remaining.length, `${table} should have only B's row left`).toBe(1)
    expect(remaining[0][key], `${table} kept the wrong owner`).toBe(B)
    // delete filtered on correct key+value
    expect(eqCalls[table]).toContainEqual([key, A])
    expect(result.tablesAffected).toContain(table)
  }
})

it('deleteAthleteData does NOT touch exportOnly or two-party tables', async () => {
  await deleteAthleteData(A)
  for (const table of DELETE_EXCLUDED) {
    // store untouched (both A and B rows still present) and never queried by delete
    const before = table.startsWith('coach') || table === 'messages' ? 3 : 2
    expect(store[table].length, `${table} must NOT be auto-deleted`).toBe(before)
  }
})

it('deleteAthleteData writes a gdpr_erasure_log entry', async () => {
  await deleteAthleteData(A)
  expect(store.gdpr_erasure_log.length).toBe(1)
  expect(store.gdpr_erasure_log[0].user_id).toBe(A)
  expect(Array.isArray(store.gdpr_erasure_log[0].tables_affected)).toBe(true)
})

// ─── coverage guard: every export/delete table has a defined non-empty key ────
it('every registry table has a defined owner key', async () => {
  // export single-party
  for (const [table, key] of Object.entries(EXPORT_KEYS)) {
    expect(typeof key, `${table} key`).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  }
  // two-party tables each declare ≥1 participant key actually queried
  const result = await exportAthleteData(A)
  for (const table of TWO_PARTY_TABLES) {
    expect(result.tables[table]).toBeDefined()
    expect((eqCalls[table] || []).length).toBeGreaterThan(0)
  }
})
