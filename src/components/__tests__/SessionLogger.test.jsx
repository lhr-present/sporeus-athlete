// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import SessionLogger from '../general/SessionLogger.jsx'

vi.mock('../../lib/athlete/strengthTraining.js', () => ({
  suggestNextLoad: vi.fn(() => null),
  plateCalculator: vi.fn(() => null),
}))

const EXERCISES = [
  { id: 'bw_pushup',  name_en: 'Push-Up',    name_tr: 'Şınav', equipment: 'bw', pattern: 'push_h', primary_muscle: 'chest',  secondary_muscles: ['triceps'] },
  { id: 'bb_squat',   name_en: 'Back Squat',  name_tr: 'Squat', equipment: 'bb', pattern: 'squat',  primary_muscle: 'quads',  secondary_muscles: ['glutes'] },
]

const PRELOADED = [
  { exercise_id: 'bw_pushup', sets: 3, reps_low: 8, reps_high: 12, rir: 2, rest_seconds: 90 },
]

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('SessionLogger — empty state', () => {
  it('renders LOG SESSION heading', () => {
    render(<SessionLogger exercises={EXERCISES} />)
    expect(screen.getByText('LOG SESSION')).toBeInTheDocument()
  })

  it('shows empty-state prompt when no exercises selected', () => {
    render(<SessionLogger exercises={EXERCISES} />)
    expect(screen.getByText(/Select exercises above to start logging/i)).toBeInTheDocument()
  })

  it('FINISH SESSION button is disabled with no reps', () => {
    render(<SessionLogger exercises={EXERCISES} />)
    expect(screen.getByText('FINISH SESSION')).toBeDisabled()
  })

  it('TR locale renders ANTRENMAN KAYDI heading', () => {
    render(<SessionLogger exercises={EXERCISES} lang="tr" />)
    expect(screen.getByText('ANTRENMAN KAYDI')).toBeInTheDocument()
  })
})

describe('SessionLogger — with preloaded exercises', () => {
  it('renders the preloaded exercise name', () => {
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} />)
    // Exercise name appears in the row heading (and also as select option)
    expect(screen.getAllByText('Push-Up').length).toBeGreaterThanOrEqual(1)
  })

  it('shows prescribed reps as input placeholder', () => {
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} />)
    expect(screen.getAllByPlaceholderText('8–12').length).toBeGreaterThan(0)
  })

  it('FINISH SESSION button remains disabled until a rep count is entered', () => {
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} />)
    expect(screen.getByText('FINISH SESSION')).toBeDisabled()
  })

  it('FINISH SESSION button enables after entering a valid rep count', () => {
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} />)
    fireEvent.change(screen.getAllByPlaceholderText('8–12')[0], { target: { value: '10' } })
    expect(screen.getByText('FINISH SESSION')).not.toBeDisabled()
  })
})

describe('SessionLogger — handleSave', () => {
  it('calls onSave with correct session shape for a BW exercise', () => {
    const onSave = vi.fn()
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} onSave={onSave} />)
    fireEvent.change(screen.getAllByPlaceholderText('8–12')[0], { target: { value: '10' } })
    fireEvent.click(screen.getByText('FINISH SESSION'))
    expect(onSave).toHaveBeenCalledOnce()
    const session = onSave.mock.calls[0][0]
    expect(session.exercises).toHaveLength(1)
    expect(session.exercises[0].exercise_id).toBe('bw_pushup')
    expect(session.exercises[0].sets[0].reps).toBe(10)
    expect(session.exercises[0].sets[0].load_kg).toBeNull()
  })

  it('includes duration_minutes and rpe in session when provided', () => {
    const onSave = vi.fn()
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} onSave={onSave} />)
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '45' } })
    fireEvent.change(screen.getByPlaceholderText('7'), { target: { value: '8' } })
    fireEvent.change(screen.getAllByPlaceholderText('8–12')[0], { target: { value: '12' } })
    fireEvent.click(screen.getByText('FINISH SESSION'))
    const session = onSave.mock.calls[0][0]
    expect(session.duration_minutes).toBe(45)
    expect(session.rpe).toBe(8)
  })

  it('filters out sets with no reps from the saved exercises', () => {
    const onSave = vi.fn()
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} onSave={onSave} />)
    // Fill only first of 3 sets
    fireEvent.change(screen.getAllByPlaceholderText('8–12')[0], { target: { value: '10' } })
    fireEvent.click(screen.getByText('FINISH SESSION'))
    const session = onSave.mock.calls[0][0]
    expect(session.exercises[0].sets).toHaveLength(1) // only the filled set
  })

  it('removes draft from localStorage after save', () => {
    const onSave = vi.fn()
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} onSave={onSave} />)
    fireEvent.change(screen.getAllByPlaceholderText('8–12')[0], { target: { value: '8' } })
    fireEvent.click(screen.getByText('FINISH SESSION'))
    expect(localStorage.getItem('sporeus-gf-draft')).toBeNull()
  })
})

describe('SessionLogger — draft restoration', () => {
  it('shows draft-restored banner when a recent draft exists for the day', () => {
    localStorage.setItem('sporeus-gf-draft', JSON.stringify({
      dayKey: 'bw_pushup',
      rows: [{ exerciseId: 'bw_pushup', prescription: PRELOADED[0], sets: [{ set_number: 1, reps: '10', load_kg: '', rir: '2', is_warmup: false }] }],
      dayLabel: 'Push', rpe: '7', notes: '', durationMin: '45',
      at: Date.now(),
    }))
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} />)
    expect(screen.getByText(/Draft restored/i)).toBeInTheDocument()
  })

  it('does NOT show draft banner when draft is for a different day', () => {
    localStorage.setItem('sporeus-gf-draft', JSON.stringify({
      dayKey: 'bb_squat',  // different day
      rows: [{ exerciseId: 'bb_squat', prescription: null, sets: [{ set_number: 1, reps: '5', load_kg: '80', rir: '2', is_warmup: false }] }],
      dayLabel: 'Legs', rpe: '', notes: '', durationMin: '',
      at: Date.now(),
    }))
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} />)
    expect(screen.queryByText(/Draft restored/i)).toBeNull()
  })

  it('does NOT restore an expired draft (older than 24h)', () => {
    const expired = Date.now() - 86400001 // 24h + 1ms
    localStorage.setItem('sporeus-gf-draft', JSON.stringify({
      dayKey: 'bw_pushup',
      rows: [{ exerciseId: 'bw_pushup', prescription: PRELOADED[0], sets: [{ set_number: 1, reps: '10', load_kg: '', rir: '2', is_warmup: false }] }],
      dayLabel: 'Push', rpe: '', notes: '', durationMin: '',
      at: expired,
    }))
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} />)
    expect(screen.queryByText(/Draft restored/i)).toBeNull()
  })
})

// ── Regression: draft guard checked only rows, not metadata (v8.16.0) ──────────
describe('SessionLogger — draft guard regression (v8.16.0)', () => {
  it('auto-saves draft when only day label is set (no rows)', () => {
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} />)
    fireEvent.change(screen.getByPlaceholderText('Push, Upper A, Legs…'), { target: { value: 'Upper A' } })
    const draft = JSON.parse(localStorage.getItem('sporeus-gf-draft') ?? 'null')
    expect(draft).not.toBeNull()
    expect(draft.dayLabel).toBe('Upper A')
  })

  it('auto-saves draft when only duration is set (no rows)', () => {
    render(<SessionLogger exercises={EXERCISES} preloadedExercises={PRELOADED} />)
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '30' } })
    const draft = JSON.parse(localStorage.getItem('sporeus-gf-draft') ?? 'null')
    expect(draft).not.toBeNull()
    expect(draft.durationMin).toBe('30')
  })
})
