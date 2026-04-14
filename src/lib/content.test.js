import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./fetch.js', () => ({
  safeFetch: vi.fn(),
}))

import { safeFetch } from './fetch.js'
import { getRelatedArticles, clearContentCache } from './content.js'

const CACHE_KEY = 'sporeus-content-cache'
const TTL_MS = 24 * 60 * 60 * 1000

const store = {}
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = v },
    removeItem: k => { delete store[k] },
  })
  vi.clearAllMocks()
})

describe('getRelatedArticles', () => {
  it('cache returns stale result before TTL expires', async () => {
    const cached = [{ title: 'Cached', url: 'http://x.com', excerpt: 'x' }]
    store[CACHE_KEY] = JSON.stringify({ 'test:en': { ts: Date.now() - 1000, articles: cached } })

    const result = await getRelatedArticles('test', 'en')

    expect(result).toEqual(cached)
    expect(safeFetch).not.toHaveBeenCalled()
  })

  it('cache busts after TTL and re-fetches', async () => {
    const expired = [{ title: 'Old', url: 'http://old.com', excerpt: 'old' }]
    store[CACHE_KEY] = JSON.stringify({ 'test:en': { ts: Date.now() - TTL_MS - 1000, articles: expired } })

    safeFetch.mockResolvedValue({ json: () => Promise.resolve([]) })

    await getRelatedArticles('test', 'en')

    expect(safeFetch).toHaveBeenCalledTimes(1)
  })

  it('empty API response returns empty array gracefully', async () => {
    safeFetch.mockResolvedValue({ json: () => Promise.resolve([]) })

    const result = await getRelatedArticles('anything', 'en')

    expect(result).toEqual([])
  })
})
