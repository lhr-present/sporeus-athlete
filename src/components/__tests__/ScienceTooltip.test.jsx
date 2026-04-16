// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ScienceTooltip from '../ScienceTooltip.jsx'

// Suppress React act() warnings from focus events
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('ScienceTooltip', () => {
  it('renders without crashing (smoke test)', () => {
    const { container } = render(
      <ScienceTooltip anchor="1-ctl--atl--tsb" label="CTL" short="Chronic Training Load — 42d fitness EMA">
        CTL
      </ScienceTooltip>
    )
    expect(container.firstChild).toBeTruthy()
    expect(screen.getByText('CTL')).toBeInTheDocument()
  })

  it('ⓘ button has correct aria attributes', () => {
    render(
      <ScienceTooltip anchor="4-rmssd" label="RMSSD" short="Root Mean Square of Successive Differences">
        RMSSD
      </ScienceTooltip>
    )
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-label', 'Science reference: RMSSD')
    expect(btn).toHaveAttribute('tabindex', '0')
  })

  it('tooltip text appears when button is focused', () => {
    render(
      <ScienceTooltip anchor="2-acwr" label="ACWR" short="Acute:Chronic Workload Ratio — injury risk flag">
        ACWR
      </ScienceTooltip>
    )
    const btn = screen.getByRole('button')
    // Tooltip should not be visible initially
    expect(screen.queryByRole('tooltip')).toBeNull()
    // Focus shows tooltip
    fireEvent.focus(btn)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Acute:Chronic Workload Ratio — injury risk flag')
    // Blur hides tooltip
    fireEvent.blur(btn)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('the href anchor in the science URL is correct', () => {
    // We test that clicking opens the correct URL
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(
      <ScienceTooltip anchor="8-critical-power--w" label="CP" short="Critical Power 2-param model">
        CP
      </ScienceTooltip>
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(openSpy).toHaveBeenCalledWith(
      '/science#8-critical-power--w',
      '_blank',
      'noopener,noreferrer'
    )
    openSpy.mockRestore()
  })
})
