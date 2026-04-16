import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── localStorage mock ─────────────────────────────────────────────────────────
const store = {}
const lsMock = {
  getItem:    k => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] },
  clear:      () => { Object.keys(store).forEach(k => delete store[k]) },
}
vi.stubGlobal('localStorage', lsMock)

// ── supabase mock ─────────────────────────────────────────────────────────────
const { mockIsSupabaseReady, mockChain } = vi.hoisted(() => {
  const chain = { from: vi.fn(), update: vi.fn(), eq: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.eq.mockResolvedValue({ error: null })
  return {
    mockIsSupabaseReady: vi.fn(() => false),
    mockChain: chain,
  }
})

vi.mock('../supabase.js', () => ({
  supabase:        mockChain,
  isSupabaseReady: mockIsSupabaseReady,
}))

import { getPushRateState, sendLocalNotification, scheduleCheckinReminder } from '../pushNotify.js'

const today = new Date().toISOString().slice(0, 10)

beforeEach(() => {
  lsMock.clear()
  vi.clearAllMocks()
  mockChain.from.mockReturnValue(mockChain)
  mockChain.update.mockReturnValue(mockChain)
  mockChain.eq.mockResolvedValue({ error: null })
  delete globalThis.navigator
  delete globalThis.Notification
})

afterEach(() => {
  delete globalThis.navigator
  delete globalThis.Notification
})

// ── getPushRateState ──────────────────────────────────────────────────────────
describe('getPushRateState', () => {
  it('returns {date, count:0} when nothing stored', () => {
    const state = getPushRateState()
    expect(state.date).toBe(today)
    expect(state.count).toBe(0)
  })

  it('returns stored count when date matches today', () => {
    localStorage.setItem('sporeus-push-rate', JSON.stringify({ date: today, count: 1 }))
    expect(getPushRateState().count).toBe(1)
  })

  it('resets count to 0 when stored date is different', () => {
    localStorage.setItem('sporeus-push-rate', JSON.stringify({ date: '2020-01-01', count: 99 }))
    const state = getPushRateState()
    expect(state.date).toBe(today)
    expect(state.count).toBe(0)
  })

  it('returns default when stored JSON is malformed', () => {
    localStorage.setItem('sporeus-push-rate', 'NOT_JSON')
    expect(getPushRateState().count).toBe(0)
  })
})

// ── sendLocalNotification ─────────────────────────────────────────────────────
describe('sendLocalNotification', () => {
  // Use getter-based spy instead of Promise.reject — avoids unhandled rejections.
  function stubPushSupportedNoServiceWorker() {
    const nav = {}
    Object.defineProperty(nav, 'serviceWorker', {
      get() { throw new Error('serviceWorker must not be accessed') },
      configurable: true,
    })
    globalThis.navigator = nav
    globalThis.window = { PushManager: class {} }
  }

  it('returns early when Notification permission is not granted', async () => {
    stubPushSupportedNoServiceWorker()
    globalThis.Notification = { permission: 'default' }
    // If function reaches navigator.serviceWorker, the getter throws synchronously.
    await expect(sendLocalNotification('title', 'body')).resolves.toBeUndefined()
  })

  it('silently drops notification when daily rate limit (MAX=2) is reached', async () => {
    stubPushSupportedNoServiceWorker()
    globalThis.Notification = { permission: 'granted' }
    localStorage.setItem('sporeus-push-rate', JSON.stringify({ date: today, count: 2 }))
    // Rate-limited early return — serviceWorker getter must not be triggered.
    await expect(sendLocalNotification('title', 'body')).resolves.toBeUndefined()
  })
})

// ── scheduleCheckinReminder ───────────────────────────────────────────────────
// Spy on setTimeout to prevent the sendLocalNotification timer from firing
// during tests — avoids full fake-timer machinery and its Vitest 4.x teardown issues.
describe('scheduleCheckinReminder', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'setTimeout').mockReturnValue(undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns error object when userId is not provided', async () => {
    const result = await scheduleCheckinReminder(null, '07:00')
    expect(result.error).toBeTruthy()
    expect(result.error.message).toMatch(/Not authenticated/i)
  })

  it('returns scheduledAt and error:null when isSupabaseReady is false', async () => {
    mockIsSupabaseReady.mockReturnValue(false)
    const result = await scheduleCheckinReminder('user-abc', '07:00')
    expect(result.error).toBeNull()
    expect(typeof result.scheduledAt).toBe('string')
    expect(result.scheduledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('saves preferred_checkin_time to profiles.profile_data', async () => {
    mockIsSupabaseReady.mockReturnValue(true)
    // First from('profiles') call: select chain
    const maybeSingle = vi.fn().mockResolvedValue({ data: { profile_data: {} }, error: null })
    const eqForSelect = vi.fn().mockReturnValue({ maybeSingle })
    const selectFn    = vi.fn().mockReturnValue({ eq: eqForSelect })
    mockChain.from.mockReturnValueOnce({ select: selectFn })
    // Second from('profiles') call: falls back to mockChain (update chain)
    const result = await scheduleCheckinReminder('user-abc', '08:30')
    expect(result.error).toBeNull()
    expect(mockChain.from).toHaveBeenCalledWith('profiles')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_data: expect.objectContaining({ preferred_checkin_time: '08:30' }),
      })
    )
  })
})
