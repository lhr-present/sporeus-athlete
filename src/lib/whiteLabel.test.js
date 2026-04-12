import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyTheme, getTheme, isWhiteLabel } from './whiteLabel.js'

vi.mock('./supabase.js', () => ({
  supabase: { from: vi.fn() },
  isSupabaseReady: vi.fn(() => false),
}))

beforeEach(() => {
  // Reset to defaults before each test
  applyTheme({ primaryColor: '#ff6600', appName: 'Sporeus Athlete', logoUrl: '' })
})

describe('applyTheme / getTheme', () => {
  it('returns defaults initially', () => {
    const t = getTheme()
    expect(t.primaryColor).toBe('#ff6600')
    expect(t.appName).toBe('Sporeus Athlete')
    expect(t.logoUrl).toBe('')
  })

  it('updates theme via applyTheme', () => {
    applyTheme({ primaryColor: '#0055aa', appName: 'My Club', logoUrl: 'https://example.com/logo.png' })
    const t = getTheme()
    expect(t.primaryColor).toBe('#0055aa')
    expect(t.appName).toBe('My Club')
    expect(t.logoUrl).toBe('https://example.com/logo.png')
  })
})

describe('isWhiteLabel', () => {
  it('returns false for default theme', () => {
    expect(isWhiteLabel()).toBe(false)
  })

  it('returns true when primary color differs', () => {
    applyTheme({ primaryColor: '#0055aa', appName: 'Sporeus Athlete', logoUrl: '' })
    expect(isWhiteLabel()).toBe(true)
  })
})
