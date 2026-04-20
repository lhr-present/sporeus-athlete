// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// Mock supabase before importing the component
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithOAuth:    vi.fn(() => Promise.resolve({ error: null })),
      signInWithPassword: vi.fn(() => Promise.resolve({ error: null })),
      signUp:             vi.fn(() => Promise.resolve({ error: null })),
      signInWithOtp:      vi.fn(() => Promise.resolve({ error: null })),
    },
  },
  isSupabaseReady: vi.fn(() => true),
}))

import AuthGate from '../AuthGate.jsx'

describe('AuthGate', () => {
  it('renders email and password inputs', () => {
    renderWithLang(<AuthGate lang="en" />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('renders a Google sign-in button', () => {
    renderWithLang(<AuthGate lang="en" />)
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
  })

  it('renders a try-without-account button', () => {
    renderWithLang(<AuthGate lang="en" />)
    expect(screen.getByText(/try without account/i)).toBeInTheDocument()
  })

  it('switches to MAGIC mode when MAGIC tab is clicked, hiding password', () => {
    renderWithLang(<AuthGate lang="en" />)
    const magicTab = screen.getByText('MAGIC')
    fireEvent.click(magicTab)
    expect(screen.queryByPlaceholderText(/min\. 8 characters/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/••••••••/)).not.toBeInTheDocument()
  })

  it('Google OAuth called with select_account — not forced consent', async () => {
    const { supabase } = await import('../../lib/supabase.js')
    renderWithLang(<AuthGate lang="en" />)
    fireEvent.click(screen.getByText('Continue with Google'))
    await vi.waitFor(() => expect(supabase.auth.signInWithOAuth).toHaveBeenCalled())
    const call = supabase.auth.signInWithOAuth.mock.calls[0][0]
    expect(call.provider).toBe('google')
    // Must NOT force the consent screen on returning users
    expect(call.options?.queryParams?.prompt).not.toBe('consent')
    // Must NOT request offline access (Supabase handles its own token refresh)
    expect(call.options?.queryParams?.access_type).toBeUndefined()
  })

  it('Google OAuth redirectTo is origin + base URL, not hardcoded', async () => {
    const { supabase } = await import('../../lib/supabase.js')
    renderWithLang(<AuthGate lang="en" />)
    fireEvent.click(screen.getByText('Continue with Google'))
    await vi.waitFor(() => expect(supabase.auth.signInWithOAuth).toHaveBeenCalled())
    const call = supabase.auth.signInWithOAuth.mock.calls[0][0]
    const redirectTo = call.options?.redirectTo
    expect(redirectTo).toBeTruthy()
    // Must not be the stale GitHub Pages URL
    expect(redirectTo).not.toContain('lhr-present.github.io')
    // Must not hardcode the wrong path suffix
    expect(redirectTo).not.toContain('/sporeus-athlete/')
  })
})
