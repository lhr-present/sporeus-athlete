// @vitest-environment jsdom
// ─── AthleteDetailPanel — applyTemplate seeding (v9.438) ──────────────────────
// Previously `applyTemplate` was an empty stub (clicking a saved plan template did
// nothing). It now pre-fills the athlete's plan generator from the template and
// signals the parent to clear it (one-shot). These tests lock that behavior.
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from '../testUtils.jsx'
import AthleteDetailPanel from '../../coachDashboard/AthleteDetailPanel.jsx'
import { SPORT_GOALS } from '../../coachDashboard/helpers.jsx'

const athlete = { id: 1, name: 'Ada Test', sport: 'running', log: [], recovery: [], profile: {} }

describe('AthleteDetailPanel — applyTemplate', () => {
  it('renders with no applied template and shows no template indicator', () => {
    renderWithLang(<AthleteDetailPanel athlete={athlete} onUpdate={vi.fn()} setTemplates={vi.fn()} />)
    expect(screen.queryByText(/Filled from template/i)).toBeNull()
  })

  it('seeds the plan fields, shows the indicator, and consumes the template once', () => {
    const onTemplateApplied = vi.fn()
    const goal = SPORT_GOALS.running[1] || SPORT_GOALS.running[0]
    const tmpl = { id: 9, name: 'Run 12wk Advanced', sport: 'running', goal, weeks: '12', hours: '10', level: 'Advanced' }

    renderWithLang(
      <AthleteDetailPanel
        athlete={athlete}
        onUpdate={vi.fn()}
        setTemplates={vi.fn()}
        appliedTemplate={tmpl}
        onTemplateApplied={onTemplateApplied}
      />,
    )

    // one-shot: parent is told to clear the staged template exactly once
    expect(onTemplateApplied).toHaveBeenCalledTimes(1)
    // visible confirmation
    expect(screen.getByText(/Filled from template: Run 12wk Advanced/i)).toBeInTheDocument()
    // plan generator fields reflect the template
    expect(screen.getByDisplayValue('12')).toBeInTheDocument()        // weeks
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()        // hours/wk
    expect(screen.getByDisplayValue('Advanced')).toBeInTheDocument()  // level select
    expect(screen.getByDisplayValue(goal)).toBeInTheDocument()        // goal select
  })

  it('ignores a goal that is not valid for the athlete sport (keeps the select valid)', () => {
    const tmpl = { id: 7, name: 'Cross-sport', sport: 'cycling', goal: 'NOT_A_RUNNING_GOAL', weeks: '6', hours: '7', level: 'Beginner' }
    renderWithLang(
      <AthleteDetailPanel athlete={athlete} onUpdate={vi.fn()} setTemplates={vi.fn()} appliedTemplate={tmpl} onTemplateApplied={vi.fn()} />,
    )
    // weeks/hours/level still applied
    expect(screen.getByDisplayValue('6')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Beginner')).toBeInTheDocument()
    // the bogus goal was not forced into the goal <select>
    expect(screen.queryByDisplayValue('NOT_A_RUNNING_GOAL')).toBeNull()
  })
})
