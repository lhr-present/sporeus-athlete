// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoist mocks so they are available inside vi.mock() factories ───────────────
const {
  mockGetSession,
  mockFunctionsInvoke,
  mockStorageChain,
  mockQueryChain,
  mockSelectData,
  mockSignedUrl,
} = vi.hoisted(() => {
  const mockSignedUrl = 'https://example.supabase.co/storage/v1/signed/reports/uid/weekly.pdf?token=abc'
  const mockSelectData = [
    { id: 'rep1', kind: 'weekly', storage_path: 'uid/weekly/2026-04-14.pdf', params: {}, created_at: '2026-04-14T10:00:00Z', expires_at: '2026-05-14T10:00:00Z' },
    { id: 'rep2', kind: 'race_readiness', storage_path: 'uid/race/2026-04-10.pdf', params: {}, created_at: '2026-04-10T08:00:00Z', expires_at: '2026-05-10T08:00:00Z' },
  ]

  const mockGetSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok123' } } })
  // v9.61.0 — generateReport now uses functions.invoke instead of safeFetch+Bearer.
  const mockFunctionsInvoke = vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://x.com/s.pdf', reportId: 'rep3', storagePath: 'uid/weekly/x.pdf', expiresAt: '2026-05-14T10:00:00Z' },
    error: null,
  })

  const mockStorageChain = {
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: mockSignedUrl }, error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  }

  // The query chain: most methods return `mockQueryChain` (fluent).
  // `limit` is the leaf that resolves for select queries.
  // `eq` is context-aware: when called as `eq('id', ...)` it acts as delete leaf.
  const mockQueryChain = {
    select:  vi.fn(),
    eq:      vi.fn(),
    order:   vi.fn(),
    limit:   vi.fn(),
    delete:  vi.fn(),
  }

  // Default: all methods return `mockQueryChain` (chainable)
  Object.keys(mockQueryChain).forEach(k => mockQueryChain[k].mockReturnValue(mockQueryChain))

  // `limit` resolves (select leaf)
  mockQueryChain.limit.mockResolvedValue({ data: mockSelectData, error: null })

  // `eq('id', ...)` resolves with delete result; all other eq calls return chain
  mockQueryChain.eq.mockImplementation((col) => {
    if (col === 'id') return Promise.resolve({ error: null })
    return mockQueryChain
  })

  return { mockGetSession, mockFunctionsInvoke, mockStorageChain, mockQueryChain, mockSelectData, mockSignedUrl }
})

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: vi.fn(() => true),
  supabase: {
    auth: { getSession: mockGetSession },
    from: vi.fn(() => mockQueryChain),
    storage: { from: vi.fn(() => mockStorageChain) },
    functions: { invoke: mockFunctionsInvoke },
  },
}))

vi.mock('../../lib/fetch.js', () => ({
  safeFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      signedUrl: 'https://example.supabase.co/storage/v1/signed/reports/uid/weekly.pdf?token=xyz',
      reportId: 'rep3',
      storagePath: 'uid/weekly/2026-04-14.pdf',
      expiresAt: '2026-05-14T10:00:00Z',
    }),
  }),
}))

vi.mock('../../lib/env.js', () => ({
  ENV: { supabaseUrl: 'https://example.supabase.co', supabaseAnon: 'anon' },
}))

import { generateReport, listReports, getSignedUrl, deleteReport } from '../reports.js'
import { supabase, isSupabaseReady } from '../supabase.js'

// ─────────────────────────────────────────────────────────────────────────────

describe('generateReport (v9.61.0 — uses functions.invoke; no getSession)', () => {
  beforeEach(() => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { signedUrl: 'https://x.com/s.pdf', reportId: 'rep3', storagePath: 'uid/weekly/x.pdf', expiresAt: '2026-05-14T10:00:00Z' },
      error: null,
    })
  })

  it('invokes generate-report with body and returns the data field', async () => {
    const result = await generateReport('weekly', { weekStart: '2026-04-07' })
    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      'generate-report',
      { body: { kind: 'weekly', params: { weekStart: '2026-04-07' } } },
    )
    expect(result.reportId).toBe('rep3')
  })

  it('does NOT call supabase.auth.getSession (Web Locks contention rule)', async () => {
    await generateReport('weekly', {})
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('throws when the invoke call returns an error', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({ data: null, error: { message: 'Internal Server Error' } })
    await expect(generateReport('weekly', {})).rejects.toThrow('generate-report failed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('listReports', () => {
  beforeEach(() => {
    mockQueryChain.limit.mockResolvedValue({ data: mockSelectData, error: null })
  })

  it('queries generated_reports ordered by created_at DESC', async () => {
    const rows = await listReports('uid123')
    expect(supabase.from).toHaveBeenCalledWith('generated_reports')
    expect(mockQueryChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(rows).toHaveLength(2)
    expect(rows[0].kind).toBe('weekly')
  })

  it('applies kind filter when provided', async () => {
    mockQueryChain.limit.mockResolvedValueOnce({ data: [mockSelectData[0]], error: null })
    const rows = await listReports('uid123', 'weekly')
    expect(mockQueryChain.eq).toHaveBeenCalledWith('kind', 'weekly')
    expect(rows).toHaveLength(1)
  })

  it('returns empty array when Supabase not ready', async () => {
    isSupabaseReady.mockReturnValueOnce(false)
    const rows = await listReports('uid123')
    expect(rows).toEqual([])
  })

  it('throws on DB error', async () => {
    mockQueryChain.limit.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })
    await expect(listReports('uid123')).rejects.toMatchObject({ message: 'DB error' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('getSignedUrl', () => {
  it('calls storage.createSignedUrl with correct path and expiry', async () => {
    const url = await getSignedUrl('uid/weekly/2026-04-14.pdf', 7200)
    expect(supabase.storage.from).toHaveBeenCalledWith('reports')
    expect(mockStorageChain.createSignedUrl).toHaveBeenCalledWith('uid/weekly/2026-04-14.pdf', 7200)
    expect(url).toBe(mockSignedUrl)
  })

  it('defaults to 3600s expiry', async () => {
    await getSignedUrl('uid/weekly/2026-04-14.pdf')
    expect(mockStorageChain.createSignedUrl).toHaveBeenCalledWith(expect.any(String), 3600)
  })

  it('throws on storage error', async () => {
    mockStorageChain.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'Storage error' } })
    await expect(getSignedUrl('uid/weekly/2026-04-14.pdf')).rejects.toMatchObject({ message: 'Storage error' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('deleteReport', () => {
  it('removes from storage and deletes DB row', async () => {
    await deleteReport('rep1', 'uid/weekly/2026-04-14.pdf')
    expect(mockStorageChain.remove).toHaveBeenCalledWith(['uid/weekly/2026-04-14.pdf'])
    expect(mockQueryChain.delete).toHaveBeenCalled()
    // eq('id', 'rep1') was called — our mock resolves when col === 'id'
    expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'rep1')
  })
})
