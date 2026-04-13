import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { safeFetch } from '../fetch.js'

// ── helpers ───────────────────────────────────────────────────────────────────
function okResponse() { return { ok: true, status: 200 } }
function errResponse(status) { return { ok: false, status } }

let mockFetch

beforeEach(() => {
  mockFetch = vi.fn()
  vi.stubGlobal('fetch', mockFetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// ── safeFetch ─────────────────────────────────────────────────────────────────
// Note on timeouts:
// safeFetch backoff = 1000ms * 2^attempt. Real-timer tests pass retries=0 or
// retries=1 with generous test timeouts to keep the suite fast but correct.
// Fake timers are avoided here due to Vitest 4.x / @sinonjs integration edge
// cases with multi-await chains inside safeFetch.
describe('safeFetch', () => {
  it('returns response on first-attempt success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    const res = await safeFetch('https://api.test/data', {}, { retries: 0 })
    expect(res.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('throws HTTP error with no retries (retries=0)', async () => {
    mockFetch.mockResolvedValue(errResponse(500))
    await expect(
      safeFetch('https://api.test/data', {}, { retries: 0 })
    ).rejects.toThrow('HTTP 500')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('succeeds on 2nd attempt after a transient 503 (retries=1, ~1s real backoff)', async () => {
    mockFetch
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse())
    const res = await safeFetch('https://api.test/data', {}, { retries: 1 })
    expect(res.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  }, 5000)  // allow 5s for real 1000ms backoff

  it('retries even on 400 Bad Request — all non-ok statuses trigger retry', async () => {
    mockFetch
      .mockResolvedValueOnce(errResponse(400))
      .mockResolvedValueOnce(okResponse())
    const res = await safeFetch('https://api.test/data', {}, { retries: 1 })
    expect(res.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  }, 5000)

  it('aborts and throws when timeoutMs elapses (AbortController fires)', async () => {
    // fetch blocks until AbortSignal fires
    mockFetch.mockImplementation((_url, opts) =>
      new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }))
        )
      })
    )
    // Use timeoutMs=1 so the real timer fires almost immediately
    await expect(
      safeFetch('https://api.test/data', {}, { retries: 0, timeoutMs: 1 })
    ).rejects.toThrow(/aborted/i)
  })

  it('default retries=2 results in 3 total fetch calls on total failure', async () => {
    mockFetch.mockResolvedValue(errResponse(500))
    await expect(
      safeFetch('https://api.test/data')  // default retries=2
    ).rejects.toThrow('HTTP 500')
    expect(mockFetch).toHaveBeenCalledTimes(3)
  }, 10000)  // allow 10s for 1000ms+2000ms real backoffs
})
