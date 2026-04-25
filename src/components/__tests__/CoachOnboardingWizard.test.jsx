// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Module mocks (hoisted) ─────────────────────────────────────────────────────
const { mockProfile } = vi.hoisted(() => {
  const mockProfile = { invite_code: 'COACH-TEST-001', timezone: 'Europe/Istanbul' }
  return { mockProfile }
})

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => ({ profile: mockProfile, user: { id: 'uid-coach' }, loading: false }),
}))

// ── SUT import (after mocks) ───────────────────────────────────────────────────
import CoachOnboardingWizard from '../coach/CoachOnboardingWizard.jsx'

// ─────────────────────────────────────────────────────────────────────────────

describe('CoachOnboardingWizard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    // Make clipboard.writeText available in jsdom
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── 1. Renders when squad is empty and not onboarded ──────────────────────
  it('renders when squad is empty and not onboarded', () => {
    // localStorage has no 'sporeus-coach-onboarded' key
    renderWithLang(<CoachOnboardingWizard open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Welcome to your coach dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/Invite your first athlete/i)).toBeInTheDocument()
  })

  // ── 2. Does not render when already onboarded (localStorage flag set) ─────
  it('does not render when already onboarded (localStorage flag set)', () => {
    localStorage.setItem('sporeus-coach-onboarded', 'true')
    renderWithLang(<CoachOnboardingWizard open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // ── 3. Does not render when open=false (squad has athletes — caller controls open) ─
  it('does not render when open prop is false', () => {
    renderWithLang(<CoachOnboardingWizard open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // ── 4. Clicking skip sets localStorage flag and calls onClose ─────────────
  it('clicking skip sets localStorage flag and closes', () => {
    const onClose = vi.fn()
    renderWithLang(<CoachOnboardingWizard open={true} onClose={onClose} />)

    const skipBtn = screen.getByText(/Skip setup/i)
    fireEvent.click(skipBtn)

    expect(localStorage.getItem('sporeus-coach-onboarded')).toBe('true')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
