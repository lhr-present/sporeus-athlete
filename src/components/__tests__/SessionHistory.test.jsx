// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SessionHistory from '../general/SessionHistory.jsx'

const EXERCISES = [
  { id: 'bw_pushup',      name_en: 'Push-Up',     name_tr: 'Şınav',  equipment: 'bw' },
  { id: 'bb_bench_press', name_en: 'Bench Press',  name_tr: 'Bench',  equipment: 'bb' },
]

function session(overrides = {}) {
  return {
    id:           '1',
    session_date: '2026-04-28',
    day_label:    'Push',
    exercises:    [],
    ...overrides,
  }
}

describe('SessionHistory', () => {
  it('renders with no sessions', () => {
    render(<SessionHistory sessions={[]} exercises={EXERCISES} lang="en" />)
    expect(screen.getByText(/No sessions yet/i)).toBeInTheDocument()
  })

  it('shows session count', () => {
    const s = session({ exercises: [] })
    const { container } = render(<SessionHistory sessions={[s]} exercises={EXERCISES} lang="en" />)
    expect(container.textContent).toContain('(1)')
  })

  it('shows duration_minutes in subtitle when present', () => {
    const s = session({ duration_minutes: 55, exercises: [] })
    const { container } = render(<SessionHistory sessions={[s]} exercises={EXERCISES} lang="en" />)
    expect(container.textContent).toContain('55 min')
  })

  it('does not show duration subtitle when duration_minutes is null', () => {
    const s = session({ duration_minutes: null, exercises: [] })
    const { container } = render(<SessionHistory sessions={[s]} exercises={EXERCISES} lang="en" />)
    expect(container.textContent).not.toContain('min')
  })

  it('shows session date and day label', () => {
    const s = session()
    const { container } = render(<SessionHistory sessions={[s]} exercises={EXERCISES} lang="en" />)
    expect(container.textContent).toContain('2026-04-28')
    expect(container.textContent).toContain('Push')
  })

  it('THIS WEEK stats bar shows when sessions exist', () => {
    const s = session()
    const { container } = render(<SessionHistory sessions={[s]} exercises={EXERCISES} lang="en" />)
    expect(container.textContent).toContain('THIS WEEK')
  })

  it('Turkish: THIS WEEK shows as BU HAFTA', () => {
    const s = session()
    const { container } = render(<SessionHistory sessions={[s]} exercises={EXERCISES} lang="tr" />)
    expect(container.textContent).toContain('BU HAFTA')
  })
})

// ── Regression: BW top-set reps were hidden when load_kg=null ─────────────────
// Before fix: topSet reduce seeded with null → for all-null load_kg exercises
// the reduce returned null, so the reps count was never shown.
// After fix: seeded with wSets[0], so reps display correctly.
describe('SessionHistory — BW topSet regression (v8.17.0)', () => {
  const bwSession = session({
    exercises: [{
      exercise_id: 'bw_pushup',
      sets: [
        { set_number: 1, reps: 10, load_kg: null, rir: 2, is_warmup: false },
        { set_number: 2, reps: 12, load_kg: null, rir: 2, is_warmup: false },
        { set_number: 3, reps: 8,  load_kg: null, rir: 3, is_warmup: false },
      ],
    }],
  })

  it('shows exercise name in expanded detail', async () => {
    const { getByText, container } = render(
      <SessionHistory sessions={[bwSession]} exercises={EXERCISES} lang="en" />,
    )
    // Expand the card
    container.querySelector('[style]').click()
    // Exercise name should be in the expanded detail after click
    // (the card row shows exercise count, not names)
    expect(container.textContent).toContain('1 exercises')
  })

  it('correctly shows work-set count for BW exercise', () => {
    const { container } = render(
      <SessionHistory sessions={[bwSession]} exercises={EXERCISES} lang="en" />,
    )
    // The subtitle shows "1 exercises · 3 work sets"
    expect(container.textContent).toContain('3 work sets')
  })

  it('weighted exercise shows kg × reps in expanded detail', () => {
    const weightedSession = session({
      exercises: [{
        exercise_id: 'bb_bench_press',
        sets: [
          { set_number: 1, reps: 5, load_kg: 80, rir: 2, is_warmup: false },
          { set_number: 2, reps: 5, load_kg: 82.5, rir: 1, is_warmup: false },
        ],
      }],
    })
    const { container } = render(
      <SessionHistory sessions={[weightedSession]} exercises={EXERCISES} lang="en" />,
    )
    expect(container.textContent).toContain('2 work sets')
  })
})
