// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import GeneralDashboard from '../general/GeneralDashboard.jsx'

vi.mock('../../lib/athlete/strengthTraining.js', () => ({
  daysSinceLastSession:   vi.fn(() => null),
  weeklyMuscleFrequency:  vi.fn(() => ({})),
}))

import { daysSinceLastSession, weeklyMuscleFrequency } from '../../lib/athlete/strengthTraining.js'

const EXERCISES = [
  { id: 'bw_pushup',  name_en: 'Push-Up',   name_tr: 'Şınav',  equipment: 'bw', primary_muscle: 'chest',  secondary_muscles: [] },
  { id: 'bb_squat',   name_en: 'Back Squat', name_tr: 'Squat',  equipment: 'bb', primary_muscle: 'quads',  secondary_muscles: [] },
]

const TEMPLATE = {
  id: 'fb_3day_beginner', name_en: 'Full Body 3-Day Beginner', name_tr: 'Tüm Vücut 3 Gün',
  days_per_week: 3, weeks: 4, experience_level: 'beginner',
}

const CURRENT_DAY = {
  day_index: 0, day_label_en: 'Full Body A', day_label_tr: 'Tüm Vücut A',
  exercises: [
    { exercise_id: 'bw_pushup', sets: 3, reps_low: 8, reps_high: 12, rir: 2, rest_seconds: 90 },
    { exercise_id: 'bb_squat',  sets: 3, reps_low: 5, reps_high: 8,  rir: 2, rest_seconds: 120 },
  ],
}

const BASE_PROGRAM = {
  templateId: 'fb_3day_beginner', next_day_index: 0, sessions_completed: 0,
  reference_date: '2026-01-01', last_session_date: null,
}

const noop = () => {}

beforeEach(() => {
  vi.clearAllMocks()
  daysSinceLastSession.mockReturnValue(null)
  weeklyMuscleFrequency.mockReturnValue({})
})

describe('GeneralDashboard — render basics', () => {
  it('renders NEXT SESSION heading', () => {
    render(<GeneralDashboard />)
    expect(screen.getByText('NEXT SESSION')).toBeInTheDocument()
  })

  it('shows "Select a program" when no template is active', () => {
    render(<GeneralDashboard />)
    expect(screen.getByText(/Select a program/i)).toBeInTheDocument()
  })

  it('shows template day label when currentDay is provided', () => {
    render(<GeneralDashboard activeTemplate={TEMPLATE} currentDay={CURRENT_DAY} />)
    expect(screen.getByText('Full Body A')).toBeInTheDocument()
  })

  it('shows exercise preview from currentDay (up to 4 exercises)', () => {
    render(<GeneralDashboard exercises={EXERCISES} activeTemplate={TEMPLATE} currentDay={CURRENT_DAY} />)
    expect(screen.getByText(/Push-Up/)).toBeInTheDocument()
    expect(screen.getByText(/Back Squat/)).toBeInTheDocument()
  })

  it('START → button calls onLogSession', () => {
    const onLogSession = vi.fn()
    render(<GeneralDashboard onLogSession={onLogSession} />)
    fireEvent.click(screen.getByText('START →'))
    expect(onLogSession).toHaveBeenCalledOnce()
  })

  it('TR locale: renders SONRAKI SEANS', () => {
    render(<GeneralDashboard lang="tr" />)
    expect(screen.getByText('SONRAKI SEANS')).toBeInTheDocument()
  })

  it('TR locale: START → renders as BAŞLA →', () => {
    render(<GeneralDashboard lang="tr" />)
    expect(screen.getByText('BAŞLA →')).toBeInTheDocument()
  })
})

describe('GeneralDashboard — gap line', () => {
  it('shows days-ago line when days > 0', () => {
    daysSinceLastSession.mockReturnValue(3)
    render(<GeneralDashboard activeProgram={{ ...BASE_PROGRAM, last_session_date: '2026-04-25' }} />)
    expect(screen.getByText(/3 days ago/i)).toBeInTheDocument()
  })

  it('shows "Welcome back." when gap > 14 days', () => {
    daysSinceLastSession.mockReturnValue(21)
    render(<GeneralDashboard activeProgram={{ ...BASE_PROGRAM, last_session_date: '2026-04-07' }} />)
    expect(screen.getByText('Welcome back.')).toBeInTheDocument()
  })

  it('shows no gap line when days === 0 (trained today)', () => {
    daysSinceLastSession.mockReturnValue(0)
    render(<GeneralDashboard activeProgram={BASE_PROGRAM} />)
    expect(screen.queryByText(/days ago/i)).toBeNull()
  })
})

describe('GeneralDashboard — PR celebration', () => {
  const prs = [
    { exercise_id: 'bb_squat', name_en: 'Back Squat', name_tr: 'Squat', new1RM: 100, prev1RM: 95 },
  ]

  it('shows NEW RECORD banner when lastSessionPRs is non-empty', () => {
    render(<GeneralDashboard lastSessionPRs={prs} onDismissPRs={noop} />)
    expect(screen.getByText('NEW RECORD')).toBeInTheDocument()
    expect(screen.getByText(/Back Squat/)).toBeInTheDocument()
    expect(screen.getByText(/100 kg est\. 1RM/)).toBeInTheDocument()
  })

  it('dismiss ✕ calls onDismissPRs', () => {
    const onDismissPRs = vi.fn()
    render(<GeneralDashboard lastSessionPRs={prs} onDismissPRs={onDismissPRs} />)
    fireEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(onDismissPRs).toHaveBeenCalledOnce()
  })

  it('no PR banner when lastSessionPRs is empty', () => {
    render(<GeneralDashboard lastSessionPRs={[]} onDismissPRs={noop} />)
    expect(screen.queryByText('NEW RECORD')).toBeNull()
  })
})

describe('GeneralDashboard — badges', () => {
  it('shows deload hint when deloadHint=true', () => {
    render(<GeneralDashboard deloadHint />)
    expect(screen.getByText(/lifts have stalled/i)).toBeInTheDocument()
  })

  it('shows coach-confirmed badge when coachConfirmedAt is set', () => {
    render(<GeneralDashboard coachConfirmedAt="2026-04-20T10:00:00Z" />)
    expect(screen.getByText(/confirmed by your coach/i)).toBeInTheDocument()
  })

  it('session milestone badge at 1 session', () => {
    render(<GeneralDashboard activeProgram={{ ...BASE_PROGRAM, sessions_completed: 1 }} />)
    expect(screen.getByText(/First session complete\./i)).toBeInTheDocument()
  })

  it('session milestone badge at 10 sessions', () => {
    render(<GeneralDashboard activeProgram={{ ...BASE_PROGRAM, sessions_completed: 10 }} activeTemplate={TEMPLATE} />)
    expect(screen.getByText(/10 sessions complete\./i)).toBeInTheDocument()
  })

  it('no milestone badge at non-milestone count (e.g. 7)', () => {
    render(<GeneralDashboard activeProgram={{ ...BASE_PROGRAM, sessions_completed: 7 }} />)
    expect(screen.queryByText(/sessions complete/i)).toBeNull()
  })
})

describe('GeneralDashboard — week progress', () => {
  it('shows week progress for a mid-cycle session count', () => {
    // 3 days/week × 4 weeks = 12 total, sessCount=3 → Week 2/4
    render(<GeneralDashboard
      activeProgram={{ ...BASE_PROGRAM, sessions_completed: 3 }}
      activeTemplate={TEMPLATE}
    />)
    expect(screen.getByText(/WEEK/)).toBeInTheDocument()
    expect(screen.getByText('3/12')).toBeInTheDocument()
  })

  it('shows cycle-complete message when sessCount % totalSessions === 0', () => {
    render(<GeneralDashboard
      activeProgram={{ ...BASE_PROGRAM, sessions_completed: 12 }}
      activeTemplate={TEMPLATE}
    />)
    expect(screen.getByText(/Program block complete/i)).toBeInTheDocument()
  })
})

describe('GeneralDashboard — recent sessions', () => {
  const sessions = [
    { session_date: '2026-04-28', day_label: 'Push', exercises: [{ exercise_id: 'bw_pushup', sets: [] }], rpe: 7 },
    { session_date: '2026-04-26', day_label: 'Pull', exercises: [], rpe: null },
  ]

  it('shows RECENT heading when sessions exist', () => {
    render(<GeneralDashboard sessions={sessions} />)
    expect(screen.getByText('RECENT')).toBeInTheDocument()
  })

  it('shows session dates in recent list', () => {
    render(<GeneralDashboard sessions={sessions} />)
    expect(screen.getByText(/2026-04-28/)).toBeInTheDocument()
    expect(screen.getByText(/2026-04-26/)).toBeInTheDocument()
  })

  it('shows RPE when present', () => {
    render(<GeneralDashboard sessions={sessions} />)
    expect(screen.getByText('RPE 7')).toBeInTheDocument()
  })

  it('"Hit Start → to log your first session." when no sessions and template active', () => {
    render(<GeneralDashboard sessions={[]} activeTemplate={TEMPLATE} />)
    expect(screen.getByText(/Hit Start →/)).toBeInTheDocument()
  })
})
