// @vitest-environment jsdom
// ─── Dashboard.cardGating.test.jsx ───────────────────────────────────────────
// Guards the v9.x change that made the advanced-view "auto" cards toggleable via
// the Customize panel. Uses the safe-default-visible pattern: a card renders
// unless its dl id is explicitly `false`. The `quickLinks` card is chosen as the
// probe because it renders synchronously (no lazy/Suspense) at the very bottom
// of the advanced dashboard, so it is a reliable visibility sentinel.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard, { FirstRunInsightCard } from '../Dashboard.jsx'
import { DataProvider } from '../../contexts/DataContext.jsx'
import { selectInsight } from '../../lib/onboarding/day0Insight.js'

// Force the advanced (non-simple) view: competitive level is not dashSimple,
// and we also flip the show-advanced flag for good measure.
function setLS(layout) {
  localStorage.clear()
  localStorage.setItem('sporeus-show-advanced', 'true')
  localStorage.setItem('sporeus-profile', JSON.stringify({ athleteLevel: 'competitive', primarySport: 'running' }))
  if (layout) localStorage.setItem('sporeus-dash-layout', JSON.stringify(layout))
}

function renderDash() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <DataProvider>
        <Dashboard log={[]} onLogSession={() => {}} onGoToProfile={() => {}} />
      </DataProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { localStorage.clear() })

describe('Dashboard advanced-view card gating', () => {
  it('renders an auto card (quickLinks) by default when nothing is hidden', () => {
    setLS(null)
    renderDash()
    // LangCtx default t() echoes the key, so the quickLinks title renders as
    // the raw key "quickLinks".
    expect(screen.getByText('quickLinks')).toBeInTheDocument()
  })

  it('hides that card when its dl id is explicitly set to false', () => {
    setLS({ quickLinks: false })
    renderDash()
    expect(screen.queryByText('quickLinks')).toBeNull()
  })

  it('keeps the card visible when its dl id is explicitly true', () => {
    setLS({ quickLinks: true })
    renderDash()
    expect(screen.getByText('quickLinks')).toBeInTheDocument()
  })
})

describe('FirstRunInsightCard — day-0 activation payoff', () => {
  it('renders the science-anchored insight for a 1-session log (EN)', () => {
    const log = [{ type: 'easy', duration: 45, rpe: 3, tss: 40 }]
    const insight = selectInsight(log, 0, 'en')
    expect(insight).not.toBeNull()
    render(<FirstRunInsightCard insight={insight} isTR={false} />)
    expect(screen.getByText(/WHAT THIS MEANS/i)).toBeInTheDocument()
    expect(screen.getByText(insight.headline)).toBeInTheDocument()
  })

  it('renders the localized header for TR', () => {
    const log = [{ type: 'easy', duration: 45, rpe: 3, tss: 40 }]
    const insight = selectInsight(log, 0, 'tr')
    render(<FirstRunInsightCard insight={insight} isTR={true} />)
    expect(screen.getByText(/İLK BİLGİ/)).toBeInTheDocument()
  })

  it('renders nothing for an empty / insufficient log (selectInsight → null)', () => {
    expect(selectInsight([], 0, 'en')).toBeNull()
    const { container } = render(<FirstRunInsightCard insight={selectInsight([], 0, 'en')} isTR={false} />)
    expect(container.firstChild).toBeNull()
  })
})
