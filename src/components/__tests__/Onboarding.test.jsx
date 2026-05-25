// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import OnboardingWizard from '../Onboarding.jsx'

describe('OnboardingWizard', () => {
  const defaultProps = {
    onFinish: vi.fn(),
    setLang:  vi.fn(),
    lang:     'en',
  }

  // v9.103.0 — Onboarding now persists a draft to localStorage on every
  // step change. Without isolating localStorage between tests, draft from
  // one test hydrates the next render and breaks the "starts on welcome"
  // assumption.
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the welcome step (step 0) on mount', () => {
    render(<OnboardingWizard {...defaultProps} />)
    // Step 0 is the SPOREUS welcome screen
    expect(screen.getByText('◈ SPOREUS')).toBeInTheDocument()
  })

  it('shows a Next button on the welcome step', () => {
    render(<OnboardingWizard {...defaultProps} />)
    expect(screen.getByText('Next →')).toBeInTheDocument()
  })

  // v9.331.0 — Slim wizard: purpose screen removed; goal moved up to step 2.
  // New step order: 0 welcome → 1 sport → 2 goal → 3 log_method (quickFinish)
  // → 4 basic → 5 level → 6 metrics.
  it('advances to sport picker after clicking Next (slim wizard: step 1 is sport)', () => {
    render(<OnboardingWizard {...defaultProps} />)
    fireEvent.click(screen.getByText('Next →'))
    expect(screen.getByText(/PRIMARY SPORT/i)).toBeInTheDocument()
  })

  it('shows goal picker on step 2 (mission-critical position)', () => {
    render(<OnboardingWizard {...defaultProps} />)
    fireEvent.click(screen.getByText('Next →'))  // step 0 → 1 (sport)
    fireEvent.click(screen.getByText('Next →'))  // step 1 → 2 (goal)
    expect(screen.getByText(/YOUR GOAL/i)).toBeInTheDocument()
  })

  it('quick-start button calls onFinish at step 3 (log_method, with goal seeded)', () => {
    const onFinish = vi.fn()
    render(<OnboardingWizard onFinish={onFinish} setLang={vi.fn()} lang="en" />)
    // Navigate to step 3: welcome → sport → goal → log_method
    for (let i = 0; i < 3; i++) {
      const btn = screen.queryByText('Next →')
      if (btn) fireEvent.click(btn)
    }
    const startBtn = screen.queryByText('Start logging →')
    if (startBtn) fireEvent.click(startBtn)
    expect(onFinish).toHaveBeenCalled()
    // Critical for starter plan: quickFinish must include goal (auto-seeded
    // from sport's first valid goal via the data.sport/data.goal effect)
    const payload = onFinish.mock.calls[0][0]
    expect(payload.goal).toBeTruthy()
    expect(payload.sport).toBeTruthy()
  })

  it('calls onFinish after clicking through all steps via full-setup', () => {
    const onFinish = vi.fn()
    render(<OnboardingWizard onFinish={onFinish} setLang={vi.fn()} lang="en" />)
    // Click Next repeatedly — eventually reaches "Let's go →"
    for (let i = 0; i < 12; i++) {
      const btn = screen.queryByText(/Next →|Let's go →/)
      if (btn) fireEvent.click(btn)
    }
    expect(onFinish).toHaveBeenCalled()
  })
})
