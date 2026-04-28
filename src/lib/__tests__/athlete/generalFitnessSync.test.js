// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────────
let mockUpdateResult = { error: null }
const mockEq     = vi.fn().mockImplementation(() => mockUpdateResult)
const mockUpdate = vi.fn().mockImplementation(() => ({ eq: mockEq }))
const mockFrom   = vi.fn().mockImplementation(() => ({ update: mockUpdate }))

vi.mock('../../../lib/supabase.js', () => ({
  supabase:       { from: mockFrom },
  isSupabaseReady: () => true,
}))

// jsdom sets navigator.onLine = true by default — no override needed

const { syncGeneralProgram } = await import('../../generalFitnessSync.js')

const BASE_PROGRAM = {
  templateId:         'fb_3day_beginner',
  next_day_index:     0,
  sessions_completed: 0,
  reference_date:     '2026-04-01',
  last_session_date:  null,
}

describe('syncGeneralProgram', () => {
  beforeEach(() => {
    mockFrom.mockClear()
    mockUpdate.mockClear()
    mockEq.mockClear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is a no-op when userId is null', async () => {
    await syncGeneralProgram(null, BASE_PROGRAM, 'Full Body 3-Day Beginner')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('is a no-op when program is null', async () => {
    await syncGeneralProgram('user-1', null, 'Full Body 3-Day Beginner')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls profiles.update with general_program payload', async () => {
    await syncGeneralProgram('user-1', BASE_PROGRAM, 'Full Body 3-Day Beginner')
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockUpdate).toHaveBeenCalled()
    const payload = mockUpdate.mock.calls[0][0]
    expect(payload).toHaveProperty('general_program')
    expect(payload.general_program.template_id).toBe('fb_3day_beginner')
    expect(payload.general_program.sessions_completed).toBe(0)
  })

  it('does NOT set last_workout_done_at when sessionSummary is null', async () => {
    await syncGeneralProgram('user-1', BASE_PROGRAM, 'Test', null)
    const payload = mockUpdate.mock.calls[0][0]
    expect(payload).not.toHaveProperty('last_workout_done_at')
  })

  it('sets last_workout_done_at when sessionSummary is provided', async () => {
    const summary = { last_session_label: 'Push', last_session_exercise_count: 4 }
    await syncGeneralProgram('user-1', BASE_PROGRAM, 'Test', summary)
    const payload = mockUpdate.mock.calls[0][0]
    expect(payload).toHaveProperty('last_workout_done_at')
  })

  it('includes last_session_duration_minutes in general_program (v8.16.0)', async () => {
    const summary = {
      last_session_label:            'Upper A',
      last_session_exercise_count:   5,
      last_session_duration_minutes: 62,
    }
    await syncGeneralProgram('user-1', BASE_PROGRAM, 'Test', summary)
    const payload = mockUpdate.mock.calls[0][0]
    expect(payload.general_program.last_session_duration_minutes).toBe(62)
  })

  it('last_session_duration_minutes is null when not provided in summary', async () => {
    const summary = { last_session_label: 'Lower', last_session_exercise_count: 3 }
    await syncGeneralProgram('user-1', BASE_PROGRAM, 'Test', summary)
    const payload = mockUpdate.mock.calls[0][0]
    expect(payload.general_program.last_session_duration_minutes).toBeNull()
  })

  it('logs a console.warn when Supabase returns an error (v8.16.0)', async () => {
    mockUpdateResult = { error: { message: 'row not found' } }
    await syncGeneralProgram('user-1', BASE_PROGRAM, 'Test')
    expect(console.warn).toHaveBeenCalledWith(
      'syncGeneralProgram failed:',
      'row not found',
    )
    mockUpdateResult = { error: null }
  })

  it('does not throw when Supabase returns an error — localStorage stays authoritative', async () => {
    mockUpdateResult = { error: { message: 'network error' } }
    await expect(syncGeneralProgram('user-1', BASE_PROGRAM, 'Test')).resolves.toBeUndefined()
    mockUpdateResult = { error: null }
  })
})
