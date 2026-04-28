// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import OnboardingWizard from '../general/OnboardingWizard.jsx'

// Use real suggestTemplate — it's pure and fast
// No mocks needed for this component

const noop = () => {}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('OnboardingWizard — step 0: goal', () => {
  it('renders SETUP 1/3 progress', () => {
    render(<OnboardingWizard onComplete={noop} />)
    expect(screen.getByText(/SETUP 1\/3/)).toBeInTheDocument()
  })

  it('shows What Is Your Goal? heading', () => {
    render(<OnboardingWizard onComplete={noop} />)
    expect(screen.getByText('What Is Your Goal?')).toBeInTheDocument()
  })

  it('shows all four goal options', () => {
    render(<OnboardingWizard onComplete={noop} />)
    expect(screen.getByText('Build Muscle')).toBeInTheDocument()
    expect(screen.getByText('Get Stronger')).toBeInTheDocument()
    expect(screen.getByText(/General Fitness/)).toBeInTheDocument()
    expect(screen.getByText(/Lose Fat/)).toBeInTheDocument()
  })

  it('Next → button is disabled before a goal is selected', () => {
    render(<OnboardingWizard onComplete={noop} />)
    expect(screen.getByText('Next →')).toBeDisabled()
  })

  it('Next → button enables after selecting a goal', () => {
    render(<OnboardingWizard onComplete={noop} />)
    fireEvent.click(screen.getByText('Build Muscle'))
    expect(screen.getByText('Next →')).not.toBeDisabled()
  })

  it('TR locale renders Hedefin Nedir?', () => {
    render(<OnboardingWizard lang="tr" onComplete={noop} />)
    expect(screen.getByText('Hedefin Nedir?')).toBeInTheDocument()
  })
})

describe('OnboardingWizard — step 1: experience', () => {
  function advanceToStep1() {
    render(<OnboardingWizard onComplete={noop} />)
    fireEvent.click(screen.getByText('Build Muscle'))
    fireEvent.click(screen.getByText('Next →'))
  }

  it('shows Experience Level heading', () => {
    advanceToStep1()
    expect(screen.getByText('Experience Level')).toBeInTheDocument()
  })

  it('shows SETUP 2/3 progress', () => {
    advanceToStep1()
    expect(screen.getByText(/SETUP 2\/3/)).toBeInTheDocument()
  })

  it('shows three experience options', () => {
    advanceToStep1()
    expect(screen.getByText(/Never Lifted/)).toBeInTheDocument()
    expect(screen.getByText(/Some Experience/)).toBeInTheDocument()
    expect(screen.getByText(/Experienced/)).toBeInTheDocument()
  })

  it('Next → is disabled until experience is selected', () => {
    advanceToStep1()
    expect(screen.getByText('Next →')).toBeDisabled()
  })

  it('Back button returns to step 0', () => {
    advanceToStep1()
    fireEvent.click(screen.getByText(/← Back/))
    expect(screen.getByText('What Is Your Goal?')).toBeInTheDocument()
  })
})

describe('OnboardingWizard — step 2: frequency + equipment', () => {
  function advanceToStep2() {
    render(<OnboardingWizard onComplete={noop} />)
    fireEvent.click(screen.getByText('Build Muscle'))
    fireEvent.click(screen.getByText('Next →'))
    fireEvent.click(screen.getByText(/Never Lifted/))
    fireEvent.click(screen.getByText('Next →'))
  }

  it('shows SETUP 3/3 progress', () => {
    advanceToStep2()
    expect(screen.getByText(/SETUP 3\/3/)).toBeInTheDocument()
  })

  it('shows frequency buttons 2–6', () => {
    advanceToStep2()
    for (const d of ['2×', '3×', '4×', '5×', '6×']) {
      expect(screen.getByText(d)).toBeInTheDocument()
    }
  })

  it('shows equipment options', () => {
    advanceToStep2()
    expect(screen.getByText('Bodyweight Only')).toBeInTheDocument()
    expect(screen.getByText(/Home Gym/)).toBeInTheDocument()
    expect(screen.getByText(/Full Gym/)).toBeInTheDocument()
  })

  it('Start ✓ is disabled until equipment is selected', () => {
    advanceToStep2()
    expect(screen.getByText('Start ✓')).toBeDisabled()
  })

  it('shows suggested template name after selecting equipment', () => {
    advanceToStep2()
    fireEvent.click(screen.getByText(/Full Gym/))
    // beginner + muscle + 3days + gym → ppl_3day_beginner
    expect(screen.getByText(/Push\/Pull\/Legs 3-Day/)).toBeInTheDocument()
  })
})

describe('OnboardingWizard — handleFinish', () => {
  it('calls onComplete with correct shape', () => {
    const onComplete = vi.fn()
    render(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Get Stronger'))
    fireEvent.click(screen.getByText('Next →'))
    fireEvent.click(screen.getByText(/Never Lifted/))
    fireEvent.click(screen.getByText('Next →'))
    // 3× is default selection
    fireEvent.click(screen.getByText(/Full Gym/))
    fireEvent.click(screen.getByText('Start ✓'))
    expect(onComplete).toHaveBeenCalledOnce()
    const result = onComplete.mock.calls[0][0]
    expect(result.goal).toBe('strength')
    expect(result.experience).toBe('beginner')
    expect(result.days).toBe(3)
    expect(result.equipment).toBe('gym')
    expect(result.templateId).toBe('fb_3day_beginner')
    expect(result.reference_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('anti-overcommitment: beginner + 5 days → effectiveDays = 3', () => {
    const onComplete = vi.fn()
    render(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Build Muscle'))
    fireEvent.click(screen.getByText('Next →'))
    fireEvent.click(screen.getByText(/Never Lifted/))
    fireEvent.click(screen.getByText('Next →'))
    fireEvent.click(screen.getByText('5×'))
    // Guardrail notice should appear
    expect(screen.getByText(/Starting with 3 days/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Full Gym/))
    fireEvent.click(screen.getByText('Start ✓'))
    const result = onComplete.mock.calls[0][0]
    expect(result.days).toBe(3) // clamped from 5 → 3
  })

  it('intermediate + 5 days → effectiveDays stays 5 (no guardrail)', () => {
    const onComplete = vi.fn()
    render(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Build Muscle'))
    fireEvent.click(screen.getByText('Next →'))
    fireEvent.click(screen.getByText(/Experienced/))
    fireEvent.click(screen.getByText('Next →'))
    fireEvent.click(screen.getByText('5×'))
    expect(screen.queryByText(/Starting with 3 days/)).toBeNull()
    fireEvent.click(screen.getByText(/Full Gym/))
    fireEvent.click(screen.getByText('Start ✓'))
    const result = onComplete.mock.calls[0][0]
    expect(result.days).toBe(5)
  })
})
