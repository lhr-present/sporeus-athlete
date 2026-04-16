// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase.js', () => ({
  supabase: null,
  isSupabaseReady: vi.fn(() => false),
}))
vi.mock('../logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { getLocalClubProfile, saveLocalClubProfile } from './orgBranding.js'

describe('getLocalClubProfile', () => {
  beforeEach(() => localStorage.clear())

  it('returns defaults when nothing stored', () => {
    const p = getLocalClubProfile()
    expect(p.orgName).toBe('')
    expect(p.primaryColor).toBe('#ff6600')
  })

  it('returns stored value', () => {
    localStorage.setItem('sporeus-club-profile', JSON.stringify({ orgName: 'Test Club', primaryColor: '#0064ff' }))
    const p = getLocalClubProfile()
    expect(p.orgName).toBe('Test Club')
    expect(p.primaryColor).toBe('#0064ff')
  })
})

describe('saveLocalClubProfile', () => {
  beforeEach(() => localStorage.clear())

  it('persists org name', () => {
    saveLocalClubProfile({ orgName: 'Sparta', primaryColor: '#ff6600' })
    const raw = JSON.parse(localStorage.getItem('sporeus-club-profile'))
    expect(raw.orgName).toBe('Sparta')
  })
})

describe('upsertOrgBranding + getOrgBranding', () => {
  it('no-op when supabase not ready', async () => {
    const { upsertOrgBranding, getOrgBranding } = await import('./orgBranding.js')
    const r1 = await upsertOrgBranding('some-id', { orgName: 'x', primaryColor: '#fff' })
    expect(r1.error).toBeNull()
    const r2 = await getOrgBranding('some-id')
    expect(r2.data).toBeNull()
  })
})
