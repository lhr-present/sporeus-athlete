// @vitest-environment jsdom
// Tests for: ProgramTemplateGallery, ProgramView, ProgressionChart, WeeklyVolumeChart, GeneralInsights
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('../../lib/athlete/strengthTraining.js', () => ({
  volumeLandmarks:       vi.fn(() => ({ mev: 4, mav: 12, mrv: 20 })),
  volumeStatus:          vi.fn(() => 'under'),
  weeklyHardSets:        vi.fn(() => ({})),
  suggestNextLoad:       vi.fn(() => null),
  plateCalculator:       vi.fn(() => null),
  daysSinceLastSession:  vi.fn(() => null),
  weeklyMuscleFrequency: vi.fn(() => ({})),
}))

import ProgramTemplateGallery from '../general/ProgramTemplateGallery.jsx'
import ProgramView             from '../general/ProgramView.jsx'
import ProgressionChart        from '../general/ProgressionChart.jsx'
import WeeklyVolumeChart       from '../general/WeeklyVolumeChart.jsx'
import GeneralInsights         from '../general/GeneralInsights.jsx'

// ── Fixtures ──────────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 'fb_3day_beginner', name_en: 'Full Body 3-Day Beginner', name_tr: 'Tüm Vücut 3 Gün',
    split: 'full_body', days_per_week: 3, weeks: 4, experience_level: 'beginner',
    equipment: 'gym', description_en: 'A great start.', description_tr: 'Harika bir başlangıç.' },
  { id: 'ppl_3day_beginner', name_en: 'Push/Pull/Legs 3-Day', name_tr: 'İPÇB 3 Gün',
    split: 'ppl', days_per_week: 3, weeks: 4, experience_level: 'beginner',
    equipment: 'gym', description_en: 'Classic PPL.', description_tr: 'Klasik.' },
]

const EXERCISES = [
  { id: 'bw_pushup',  name_en: 'Push-Up',   name_tr: 'Şınav', equipment: 'bw', primary_muscle: 'chest',  secondary_muscles: [] },
  { id: 'bb_squat',   name_en: 'Back Squat', name_tr: 'Squat', equipment: 'bb', primary_muscle: 'quads',  secondary_muscles: [] },
]

const TEMPLATE_DAYS = [
  { day_index: 0, day_label_en: 'Full Body A', day_label_tr: 'Tüm Vücut A',
    exercises: [{ exercise_id: 'bw_pushup', sets: 3, reps_low: 8, reps_high: 12, rir: 2, rest_seconds: 90 }] },
  { day_index: 1, day_label_en: 'Rest', day_label_tr: 'Dinlenme', exercises: [] },
]

const noop = () => {}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))

// ═══════════════════════════════════════════════════════════════════════════════
// ProgramTemplateGallery
// ═══════════════════════════════════════════════════════════════════════════════
describe('ProgramTemplateGallery', () => {
  it('shows loading state when templates is empty', () => {
    render(<ProgramTemplateGallery templates={[]} />)
    expect(screen.getByText('Loading programs…')).toBeInTheDocument()
  })

  it('renders PROGRAMS heading', () => {
    render(<ProgramTemplateGallery templates={TEMPLATES} />)
    expect(screen.getByText('PROGRAMS')).toBeInTheDocument()
  })

  it('renders all template names', () => {
    render(<ProgramTemplateGallery templates={TEMPLATES} />)
    expect(screen.getByText(/Full Body 3-Day Beginner/)).toBeInTheDocument()
    expect(screen.getByText(/Push\/Pull\/Legs 3-Day/)).toBeInTheDocument()
  })

  it('shows ACTIVE badge on the active template', () => {
    render(<ProgramTemplateGallery templates={TEMPLATES} activeId="fb_3day_beginner" />)
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
  })

  it('shows ✓ Selected on active template button', () => {
    render(<ProgramTemplateGallery templates={TEMPLATES} activeId="fb_3day_beginner" />)
    expect(screen.getByText('✓ Selected')).toBeInTheDocument()
  })

  it('calls onSelect when a non-active template is clicked', () => {
    const onSelect = vi.fn()
    render(<ProgramTemplateGallery templates={TEMPLATES} activeId="fb_3day_beginner" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Select')) // PPL template
    expect(onSelect).toHaveBeenCalledWith(TEMPLATES[1])
  })

  it('does NOT call onSelect when the active template is clicked', () => {
    const onSelect = vi.fn()
    render(<ProgramTemplateGallery templates={TEMPLATES} activeId="fb_3day_beginner" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('✓ Selected'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('TR locale: shows AKTİF and PROGRAMLAR', () => {
    render(<ProgramTemplateGallery templates={TEMPLATES} activeId="fb_3day_beginner" lang="tr" />)
    expect(screen.getByText('PROGRAMLAR')).toBeInTheDocument()
    expect(screen.getByText('AKTİF')).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ProgramView
// ═══════════════════════════════════════════════════════════════════════════════
describe('ProgramView', () => {
  it('shows "No active program." when no template', () => {
    render(<ProgramView />)
    expect(screen.getByText('No active program.')).toBeInTheDocument()
  })

  it('renders template name', () => {
    render(<ProgramView template={TEMPLATES[0]} templateDays={TEMPLATE_DAYS} exercises={EXERCISES} />)
    expect(screen.getByText('Full Body 3-Day Beginner')).toBeInTheDocument()
  })

  it('renders day labels', () => {
    render(<ProgramView template={TEMPLATES[0]} templateDays={TEMPLATE_DAYS} exercises={EXERCISES} />)
    expect(screen.getByText(/Full Body A/)).toBeInTheDocument()
    expect(screen.getByText(/Rest/)).toBeInTheDocument()
  })

  it('shows NEXT → badge on the current day', () => {
    render(<ProgramView template={TEMPLATES[0]} templateDays={TEMPLATE_DAYS} exercises={EXERCISES} currentDayIndex={0} />)
    expect(screen.getByText('NEXT →')).toBeInTheDocument()
  })

  it('shows NEXT → only on the current day (exactly once)', () => {
    render(<ProgramView template={TEMPLATES[0]} templateDays={TEMPLATE_DAYS} exercises={EXERCISES} currentDayIndex={0} />)
    expect(screen.getAllByText('NEXT →')).toHaveLength(1)
  })

  it('shows exercise prescription details', () => {
    render(<ProgramView template={TEMPLATES[0]} templateDays={TEMPLATE_DAYS} exercises={EXERCISES} />)
    expect(screen.getByText(/Push-Up/)).toBeInTheDocument()
    expect(screen.getByText(/3×8–12 RIR2/)).toBeInTheDocument()
  })

  it('shows REST DAY label for days with no exercises', () => {
    render(<ProgramView template={TEMPLATES[0]} templateDays={TEMPLATE_DAYS} exercises={EXERCISES} />)
    expect(screen.getByText(/REST DAY/)).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ProgressionChart
// ═══════════════════════════════════════════════════════════════════════════════
describe('ProgressionChart', () => {
  const data2 = [
    { session_date: '2026-04-01', load_kg: 80, reps: 5 },
    { session_date: '2026-04-08', load_kg: 82.5, reps: 5 },
  ]

  it('shows "Need at least 2 sessions" with fewer than 2 data points', () => {
    render(<ProgressionChart data={[data2[0]]} />)
    expect(screen.getByText(/Need at least 2 sessions/)).toBeInTheDocument()
  })

  it('renders exercise name in header', () => {
    render(<ProgressionChart data={data2} exerciseName="Back Squat" />)
    expect(screen.getByText(/Back Squat/)).toBeInTheDocument()
  })

  it('renders TOP SET PROGRESSION header for weighted exercise', () => {
    render(<ProgressionChart data={data2} exerciseName="Back Squat" isBW={false} />)
    expect(screen.getByText(/TOP SET PROGRESSION/)).toBeInTheDocument()
  })

  it('renders MAX REPS header for BW exercise', () => {
    const bwData = [
      { session_date: '2026-04-01', load_kg: null, reps: 10 },
      { session_date: '2026-04-08', load_kg: null, reps: 12 },
    ]
    render(<ProgressionChart data={bwData} exerciseName="Push-Up" isBW />)
    expect(screen.getByText(/MAX REPS/)).toBeInTheDocument()
  })

  it('renders an SVG polyline chart', () => {
    const { container } = render(<ProgressionChart data={data2} exerciseName="Squat" />)
    expect(container.querySelector('polyline')).not.toBeNull()
  })

  it('TR locale: MAX REPS renders as MAX TEKRAR', () => {
    const bwData = [
      { session_date: '2026-04-01', load_kg: null, reps: 10 },
      { session_date: '2026-04-08', load_kg: null, reps: 12 },
    ]
    render(<ProgressionChart data={bwData} exerciseName="Şınav" isBW lang="tr" />)
    expect(screen.getByText(/MAX TEKRAR/)).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// WeeklyVolumeChart
// ═══════════════════════════════════════════════════════════════════════════════
describe('WeeklyVolumeChart', () => {
  it('renders WEEKLY VOLUME heading', () => {
    render(<WeeklyVolumeChart />)
    expect(screen.getByText('WEEKLY VOLUME (HARD SETS)')).toBeInTheDocument()
  })

  it('renders all 10 muscle group labels', () => {
    render(<WeeklyVolumeChart />)
    expect(screen.getByText('Chest')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Quads')).toBeInTheDocument()
  })

  it('renders under/optimal/over legend', () => {
    render(<WeeklyVolumeChart />)
    expect(screen.getByText(/Under/)).toBeInTheDocument()
    expect(screen.getByText(/Optimal/)).toBeInTheDocument()
    expect(screen.getByText(/Over/)).toBeInTheDocument()
  })

  it('TR locale: renders HAFTALIK HACİM', () => {
    render(<WeeklyVolumeChart lang="tr" />)
    expect(screen.getByText('HAFTALIK HACİM (ETKİLİ SET)')).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GeneralInsights
// ═══════════════════════════════════════════════════════════════════════════════
describe('GeneralInsights', () => {
  it('shows "Log sessions to see analytics." when sessions is empty', () => {
    render(<GeneralInsights sessions={[]} exercises={EXERCISES} />)
    expect(screen.getByText(/Log sessions to see analytics/)).toBeInTheDocument()
  })

  it('renders WeeklyVolumeChart when sessions exist', () => {
    const sessions = [
      { session_date: '2026-04-28', exercises: [{ exercise_id: 'bw_pushup', sets: [{ reps: 10, load_kg: null, rir: 2, is_warmup: false }] }] },
    ]
    render(<GeneralInsights sessions={sessions} exercises={EXERCISES} />)
    expect(screen.getByText('WEEKLY VOLUME (HARD SETS)')).toBeInTheDocument()
  })

  it('shows progression charts for exercises with 2+ sessions', () => {
    const sessions = [
      { session_date: '2026-04-21', exercises: [{ exercise_id: 'bb_squat', sets: [{ reps: 5, load_kg: 80, rir: 2, is_warmup: false }] }] },
      { session_date: '2026-04-28', exercises: [{ exercise_id: 'bb_squat', sets: [{ reps: 5, load_kg: 85, rir: 1, is_warmup: false }] }] },
    ]
    render(<GeneralInsights sessions={sessions} exercises={EXERCISES} />)
    expect(screen.getByText('TOP SET PROGRESSION')).toBeInTheDocument()
    expect(screen.getByText(/Back Squat/)).toBeInTheDocument()
  })

  it('shows "Need 2+ sessions" message when exercises only appear once', () => {
    const sessions = [
      { session_date: '2026-04-28', exercises: [{ exercise_id: 'bw_pushup', sets: [{ reps: 10, load_kg: null, rir: 2, is_warmup: false }] }] },
    ]
    render(<GeneralInsights sessions={sessions} exercises={EXERCISES} />)
    expect(screen.getByText(/Need 2\+ sessions/)).toBeInTheDocument()
  })
})
