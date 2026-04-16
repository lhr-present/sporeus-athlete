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
})
