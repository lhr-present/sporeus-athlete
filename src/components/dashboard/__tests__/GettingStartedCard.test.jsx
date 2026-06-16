// @vitest-environment jsdom
// ─── GettingStartedCard.test.jsx ────────────────────────────────────────────
//
// Step 02 is goal-anchored. The card renders inside the Today screen, so the
// old "Check the Today tab" copy told the user to go where they already were.
// It now states the payoff of logging — with the user's goal woven in when
// present, and a generic training-focused fallback when absent.

import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import GettingStartedCard from '../GettingStartedCard.jsx'

describe('GettingStartedCard — goal-anchored step 02', () => {
  it('does not tell the user to "check the Today tab" (EN)', () => {
    render(<GettingStartedCard isTR={false} onLogSession={() => {}} />)
    expect(screen.queryByText(/Check the Today tab/i)).toBeNull()
  })

  it('weaves the goal into step 02 when a goal is set (EN)', () => {
    render(<GettingStartedCard isTR={false} goal="Marathon" onLogSession={() => {}} />)
    expect(
      screen.getByText(/Your Marathon answer sharpens — your first log feeds today's recommendation\./i)
    ).toBeInTheDocument()
  })

  it('weaves the goal into step 02 when a goal is set (TR)', () => {
    render(<GettingStartedCard isTR={true} goal="Maraton" onLogSession={() => {}} />)
    expect(
      screen.getByText(/Maraton cevabın keskinleşir — ilk kaydın bugünün tavsiyesini besler\./i)
    ).toBeInTheDocument()
  })

  it('falls back to a generic training-focused line when no goal is set (EN)', () => {
    render(<GettingStartedCard isTR={false} onLogSession={() => {}} />)
    expect(screen.getByText(/Your first log feeds today's recommendation/i)).toBeInTheDocument()
    expect(screen.queryByText(/Your .* answer sharpens/i)).toBeNull()
  })

  it('falls back to a generic training-focused line when no goal is set (TR)', () => {
    render(<GettingStartedCard isTR={true} onLogSession={() => {}} />)
    expect(screen.getByText(/İlk kaydın bugünün tavsiyesini besler/i)).toBeInTheDocument()
    expect(screen.queryByText(/Bugün sekmesini kontrol et/i)).toBeNull()
  })
})
