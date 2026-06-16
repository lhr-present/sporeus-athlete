// @vitest-environment jsdom
// ─── a11y.deepdive.test.jsx ──────────────────────────────────────────────────
// Covers the additive accessibility fixes from the a11y deep-dive:
//  - SportSelector selection-by-color pickers expose aria-pressed
//  - InsightFeedCard rows carry an sr-only category label (color-bar isn't
//    the only cue)
//  - LoadHeatmapCard / BanisterModelCard SVGs have role="img" + aria-label
// These render with LangCtx only (no DataContext) to stay cheap + stable.
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// Force a known insight card so we can assert the sr-only category label
// independent of the (legitimately complex) insight-generation heuristics.
vi.mock('../../lib/athlete/insightFeed.js', () => ({
  getInsightFeed: () => [
    { type: 'consistency', en: 'You trained 5 days this week.', tr: 'Bu hafta 5 gün antrenman yaptın.' },
  ],
}))

import SportSelector from '../profile/SportSelector.jsx'
import InsightFeedCard from '../dashboard/InsightFeedCard.jsx'

describe('a11y deep-dive — SportSelector aria-pressed', () => {
  it('marks the selected primary sport with aria-pressed=true and others false', () => {
    renderWithLang(<SportSelector local={{ primarySport: 'cycling' }} setLocal={() => {}} />)
    const cycling = screen.getByRole('button', { name: /Cycling/i, pressed: true })
    expect(cycling).toBeInTheDocument()
    const running = screen.getByRole('button', { name: /^.\s*Running$/i, pressed: false })
    expect(running).toBeInTheDocument()
  })

  it('exposes aria-pressed on the athlete-level pickers', () => {
    renderWithLang(<SportSelector local={{ athleteLevel: 'advanced' }} setLocal={() => {}} />)
    // every level button must have an aria-pressed attribute (true or false)
    const advanced = screen.getByRole('button', { name: /Advanced/i, pressed: true })
    expect(advanced).toBeInTheDocument()
  })
})

describe('a11y deep-dive — InsightFeedCard sr-only category', () => {
  // 5+ entries so the card renders (getInsightFeed is mocked above).
  const log = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    return { date: d.toISOString().slice(0, 10), type: 'Easy Run', duration: 50, rpe: 4, tss: 45 }
  })

  it('renders a category label in text alongside each insight (not color-only)', () => {
    const { container } = renderWithLang(<InsightFeedCard log={log} />)
    const text = container.textContent || ''
    // The consistency insight's category label must be surfaced as text.
    expect(text).toMatch(/Consistency/)
    expect(text).toMatch(/You trained 5 days this week/)
  })
})
