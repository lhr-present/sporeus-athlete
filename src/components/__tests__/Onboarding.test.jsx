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

  it('advances to basic info step after clicking Next', () => {
    render(<OnboardingWizard {...defaultProps} />)
    fireEvent.click(screen.getByText('Next →'))
    // Step 1 is BASIC INFO with the name input
    expect(screen.getByPlaceholderText('Athlete name')).toBeInTheDocument()
  })

  it('calls onFinish after clicking through all steps', () => {
    const onFinish = vi.fn()
    render(<OnboardingWizard onFinish={onFinish} setLang={vi.fn()} lang="en" />)
    // Click Next / Let's go repeatedly through all ~6 steps
    for (let i = 0; i < 8; i++) {
      const btn = screen.queryByText(/Next →|Let's go →/)
      if (btn) fireEvent.click(btn)
    }
    expect(onFinish).toHaveBeenCalled()
  })
})
