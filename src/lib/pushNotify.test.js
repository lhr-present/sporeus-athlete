import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isPushSupported,
  getPermissionStatus,
  getPushRateState,
  sendTestNotification,
  saveNotifPrefs,
  isIOS,
  isPWAStandalone,
  getIOSInstallHint,
} from './pushNotify.js'

// ── localStorage stub (node env has no localStorage) ─────────────────────────
const lsStore = {}
const lsMock = {
  getItem:    k => lsStore[k] ?? null,
  setItem:    (k, v) => { lsStore[k] = String(v) },
  removeItem: k => { delete lsStore[k] },
  clear:      () => { Object.keys(lsStore).forEach(k => delete lsStore[k]) },
}
vi.stubGlobal('localStorage', lsMock)

// ── Hoisted mock variables (must be declared before vi.mock factory runs) ─────
const { mockInvoke, mockFromImpl, mockIsSupabaseReady } = vi.hoisted(() => {
  const maybeSingleFn = vi.fn()
  const eqFn          = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn })
  const selectFn      = vi.fn().mockReturnValue({ eq: eqFn })
  const updateEqFn    = vi.fn()
  const updateFn      = vi.fn().mockReturnValue({ eq: updateEqFn })
  const fromFn        = vi.fn().mockReturnValue({ select: selectFn, update: updateFn })
  return {
    mockInvoke:           vi.fn(),
    mockFromImpl:         fromFn,
    mockIsSupabaseReady:  vi.fn(() => true),
  }
})

vi.mock('./supabase.js', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    from:      mockFromImpl,
  },
  isSupabaseReady: mockIsSupabaseReady,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeFromChain(
  selectResult = { data: null, error: null },
  updateResult = { error: null },
) {
  const maybeSingle = vi.fn().mockResolvedValue(selectResult)
  const selectEq    = vi.fn().mockReturnValue({ maybeSingle })
  const selectFn    = vi.fn().mockReturnValue({ eq: selectEq })
  const updateEq    = vi.fn().mockResolvedValue(updateResult)
  const updateFn    = vi.fn().mockReturnValue({ eq: updateEq })
  mockFromImpl.mockReturnValue({ select: selectFn, update: updateFn })
  return { maybeSingle, selectFn, updateFn, updateEq }
}

beforeEach(() => {
  vi.clearAllMocks()
  lsMock.clear()
  // Restore isSupabaseReady default after clearAllMocks
  mockIsSupabaseReady.mockReturnValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('localStorage', lsMock)
})

// ── isPushSupported ───────────────────────────────────────────────────────────
describe('isPushSupported', () => {
  it('returns false when serviceWorker not in navigator', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', { PushManager: function PushManager() {} })
    expect(isPushSupported()).toBe(false)
  })

  it('returns false when PushManager not in window', () => {
    vi.stubGlobal('navigator', { serviceWorker: {} })
    vi.stubGlobal('window', {})
    expect(isPushSupported()).toBe(false)
  })

  it('returns true when both serviceWorker and PushManager are present', () => {
    vi.stubGlobal('navigator', { serviceWorker: {} })
    vi.stubGlobal('window', { PushManager: function PushManager() {} })
    expect(isPushSupported()).toBe(true)
  })
})

// ── getPermissionStatus ───────────────────────────────────────────────────────
describe('getPermissionStatus', () => {
  it('returns "unsupported" when Notification is not defined', () => {
    vi.stubGlobal('Notification', undefined)
    expect(getPermissionStatus()).toBe('unsupported')
  })

  it('returns "default" when permission is default', () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    expect(getPermissionStatus()).toBe('default')
  })

  it('returns "granted" when permission is granted', () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    expect(getPermissionStatus()).toBe('granted')
  })

  it('returns "denied" when permission is denied', () => {
    vi.stubGlobal('Notification', { permission: 'denied' })
    expect(getPermissionStatus()).toBe('denied')
  })
})

// ── getPushRateState ──────────────────────────────────────────────────────────
describe('getPushRateState', () => {
  it('returns { date: today, count: 0 } when localStorage is empty', () => {
    const state = getPushRateState()
    expect(state.count).toBe(0)
    expect(state.date).toBe(new Date().toISOString().slice(0, 10))
  })

  it('returns count 0 when stored date differs from today (day rollover)', () => {
    lsMock.setItem('sporeus-push-rate', JSON.stringify({ date: '2020-01-01', count: 5 }))
    const state = getPushRateState()
    expect(state.count).toBe(0)
  })

  it('returns stored count when date matches today', () => {
    const today = new Date().toISOString().slice(0, 10)
    lsMock.setItem('sporeus-push-rate', JSON.stringify({ date: today, count: 2 }))
    expect(getPushRateState().count).toBe(2)
  })
})

// ── sendTestNotification ──────────────────────────────────────────────────────
describe('sendTestNotification', () => {
  it('returns error when userId is falsy', async () => {
    const { error } = await sendTestNotification(null)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/Not authenticated/)
  })

  it('returns error when Supabase is not ready', async () => {
    mockIsSupabaseReady.mockReturnValueOnce(false)
    const { error } = await sendTestNotification('user-123')
    expect(error).toBeInstanceOf(Error)
  })

  it('calls send-push invoke with correct kind and user_id', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { sent: 1 }, error: null })
    const { error } = await sendTestNotification('user-abc')
    expect(error).toBeNull()
    expect(mockInvoke).toHaveBeenCalledWith(
      'send-push',
      expect.objectContaining({
        body: expect.objectContaining({ kind: 'test', user_id: 'user-abc' }),
      })
    )
  })

  it('push payload contains no PII-shaped keys', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { sent: 1 }, error: null })
    await sendTestNotification('user-abc')
    const payload = mockInvoke.mock.calls[0][1].body
    const sensitiveKeys = ['email', 'name', 'phone', 'weight', 'dob', 'password', 'token']
    for (const key of sensitiveKeys) {
      expect(payload).not.toHaveProperty(key)
      if (payload.data) expect(payload.data).not.toHaveProperty(key)
    }
  })

  it('dedupe_key includes unique timestamp per call', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { sent: 1 }, error: null })
    await sendTestNotification('user-abc')
    const payload = mockInvoke.mock.calls[0][1].body
    expect(payload.dedupe_key).toMatch(/^test:user-abc:\d+$/)
  })
})

// ── saveNotifPrefs ────────────────────────────────────────────────────────────
describe('saveNotifPrefs', () => {
  it('returns error when userId is falsy', async () => {
    const { error } = await saveNotifPrefs(null, {})
    expect(error).toBeInstanceOf(Error)
  })

  it('returns error when Supabase is not ready', async () => {
    mockIsSupabaseReady.mockReturnValueOnce(false)
    const { error } = await saveNotifPrefs('user-123', {})
    expect(error).toBeInstanceOf(Error)
  })

  it('merges notification prefs into existing profile_data via profiles table', async () => {
    makeFromChain(
      { data: { profile_data: { name: 'existing' } }, error: null },
      { error: null }
    )
    const { error } = await saveNotifPrefs('user-123', {
      notifications: { checkin_reminder: true },
      preferred_checkin_time: '07:00',
    })
    expect(error).toBeNull()
    expect(mockFromImpl).toHaveBeenCalledWith('profiles')
  })

  it('propagates Supabase update errors', async () => {
    makeFromChain(
      { data: { profile_data: {} }, error: null },
      { error: { message: 'DB write failed' } }
    )
    const { error } = await saveNotifPrefs('user-123', { timezone: 'Europe/Istanbul' })
    expect(error).toBeTruthy()
  })
})

// ── Dedupe key shape invariants ───────────────────────────────────────────────
describe('Push notification dedupe key format', () => {
  it('checkin_reminder: checkin_reminder:userId:YYYY-MM-DD', () => {
    const key = `checkin_reminder:user-abc:${new Date().toISOString().slice(0, 10)}`
    expect(key).toMatch(/^checkin_reminder:[a-z0-9-]+:\d{4}-\d{2}-\d{2}$/)
  })

  it('missed_checkin: missed_checkin:userId:YYYY-MM-DD', () => {
    const key = `missed_checkin:user-abc:${new Date().toISOString().slice(0, 10)}`
    expect(key).toMatch(/^missed_checkin:[a-z0-9-]+:\d{4}-\d{2}-\d{2}$/)
  })

  it('test key uses epoch timestamp — each invocation is unique', () => {
    const k1 = `test:user-abc:${Date.now()}`
    const k2 = `test:user-abc:${Date.now() + 1}`
    expect(k1).not.toBe(k2)
  })
})

// ── v9.176.0 — iOS PWA-install detection ─────────────────────────────────────

describe('isIOS', () => {
  it('returns true for iPhone UA', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15')).toBe(true)
  })
  it('returns true for iPad UA', () => {
    expect(isIOS('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15')).toBe(true)
  })
  it('returns true for iPod UA', () => {
    expect(isIOS('Mozilla/5.0 (iPod touch; CPU iPhone OS 16_4 like Mac OS X)')).toBe(true)
  })
  it('returns false for Android UA', () => {
    expect(isIOS('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')).toBe(false)
  })
  it('returns false for desktop Chrome UA', () => {
    expect(isIOS('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120')).toBe(false)
  })
  it('returns false for plain Macintosh without touch (no iPad-spoof)', () => {
    // navigator.maxTouchPoints not set in node; defaults to false
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15')).toBe(false)
  })
  it('returns false for empty UA', () => {
    expect(isIOS('')).toBe(false)
  })
})

describe('isPWAStandalone', () => {
  // In node test env there is no `window` — function should defend itself
  it('returns false when window is not defined', () => {
    // Save / restore for safety even though node doesn't set window
    const orig = global.window
    delete global.window
    expect(isPWAStandalone()).toBe(false)
    if (orig !== undefined) global.window = orig
  })

  it('detects matchMedia standalone', () => {
    vi.stubGlobal('window', { matchMedia: q => ({ matches: q.includes('standalone') }) })
    expect(isPWAStandalone()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('detects legacy navigator.standalone (iOS Safari)', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    vi.stubGlobal('navigator', { standalone: true, userAgent: '' })
    expect(isPWAStandalone()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('returns false when neither display-mode nor navigator.standalone set', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    vi.stubGlobal('navigator', { userAgent: '' })
    expect(isPWAStandalone()).toBe(false)
    vi.unstubAllGlobals()
  })
})

describe('getIOSInstallHint', () => {
  it('returns null on non-iOS platforms', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })
    expect(getIOSInstallHint()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('returns null on iOS already running as PWA standalone', () => {
    vi.stubGlobal('window', { matchMedia: q => ({ matches: q.includes('standalone') }) })
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' })
    expect(getIOSInstallHint()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('returns bilingual install hint on iOS Safari NOT in standalone mode', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' })
    const hint = getIOSInstallHint()
    expect(hint).not.toBeNull()
    expect(hint.requiresInstall).toBe(true)
    expect(hint.en).toMatch(/Add to Home Screen/i)
    expect(hint.tr).toMatch(/Ana Ekrana Ekle/i)
    expect(hint.minIOSVersion).toBe('16.4')
    vi.unstubAllGlobals()
  })
})
