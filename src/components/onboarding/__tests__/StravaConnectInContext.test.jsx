// @vitest-environment jsdom
// ─── StravaConnectInContext.test.jsx ────────────────────────────────────────
// v9.502 — first test for this component. It shipped fully built but was
// never imported anywhere in the app (dead code) until wired into
// Dashboard.jsx's sparse-log state. These tests lock in the visibility gate
// (sessionCount < 14) so a future edit can't silently break it again.

import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import StravaConnectInContext from '../StravaConnectInContext.jsx'

describe('StravaConnectInContext', () => {
  it('renders when session count is below 14 (EN)', () => {
    render(<StravaConnectInContext sessionCount={5} lang="en" userId="u1" />)
    expect(screen.getByText(/Your chart has 5 sessions\./i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect Strava/i })).toBeInTheDocument()
  })

  it('renders when session count is below 14 (TR)', () => {
    render(<StravaConnectInContext sessionCount={3} lang="tr" userId="u1" />)
    expect(screen.getByText(/Grafiğinde 3 antrenman var\./i)).toBeInTheDocument()
  })

  it('does not render at exactly 14 sessions', () => {
    const { container } = render(<StravaConnectInContext sessionCount={14} lang="en" userId="u1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does not render above 14 sessions', () => {
    const { container } = render(<StravaConnectInContext sessionCount={40} lang="en" userId="u1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('dismiss button hides the prompt without navigating away', () => {
    render(<StravaConnectInContext sessionCount={5} lang="en" userId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: /Dismiss Strava prompt/i }))
    expect(screen.queryByText(/Your chart has 5 sessions\./i)).toBeNull()
  })
})
