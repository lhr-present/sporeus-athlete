// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import OnboardingWizard from '../Onboarding.jsx'

describe('OnboardingWizard', () => {
  const defaultProps = {
    onFinish: vi.fn(),
    setLang:  vi.fn(),
    lang:     'en',
  }

  it('renders the welcome step (step 0) on mount', () => {
    render(<OnboardingWizard {...defaultProps} />)
    // Step 0 is the SPOREUS welcome screen
    expect(screen.getByText('◈ SPOREUS')).toBeInTheDocument()
  })

  it('shows a Next button on the welcome step', () => {
    render(<OnboardingWizard {...defaultProps} />)
    expect(screen.getByText('Next →')).toBeInTheDocument()
  })

  it('advances to purpose question after clicking Next', () => {
    render(<OnboardingWizard {...defaultProps} />)
    fireEvent.click(screen.getByText('Next →'))
    // Step 1 is "What are you training for?"
    expect(screen.getByText(/WHAT ARE YOU TRAINING FOR/i)).toBeInTheDocument()
  })

  it('shows sport picker on step 2', () => {
    render(<OnboardingWizard {...defaultProps} />)
    fireEvent.click(screen.getByText('Next →'))  // step 0 → 1
    fireEvent.click(screen.getByText('Next →'))  // step 1 → 2
    expect(screen.getByText(/PRIMARY SPORT/i)).toBeInTheDocument()
  })

  it('quick-start button calls onFinish at step 3', () => {
    const onFinish = vi.fn()
    render(<OnboardingWizard onFinish={onFinish} setLang={vi.fn()} lang="en" />)
    // Navigate to step 3
    for (let i = 0; i < 3; i++) {
      const btn = screen.queryByText('Next →')
      if (btn) fireEvent.click(btn)
    }
    // Step 3 shows "Start logging →"
    const startBtn = screen.queryByText('Start logging →')
    if (startBtn) fireEvent.click(startBtn)
    expect(onFinish).toHaveBeenCalled()
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
