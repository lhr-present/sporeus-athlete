// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeeklyCtlTrajectoryPeek from '../today/WeeklyCtlTrajectoryPeek.jsx'

function renderPeek(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WeeklyCtlTrajectoryPeek {...props} />
    </LangCtx.Provider>
  )
}

function makePlan({ tssByDow = [0, 0, 0, 0, 0, 0, 0], generatedAt = '2026-05-04', weeks = 1 } = {}) {
  const sessions = tssByDow.map(tss => ({ type: 'Endurance', tss, duration: 60, rpe: 5 }))
  return {
    generatedAt,
    weeks: Array.from({ length: weeks }, () => ({ phase: 'Build', sessions })),
  }
}

function makeLogConstant(tss, endDate, days = 180) {
  const out = []
  const end = new Date(endDate + 'T00:00:00Z')
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime())
    d.setUTCDate(d.getUTCDate() - i)
    out.push({ date: d.toISOString().slice(0, 10), tss })
  }
  return out
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-04T12:00:00Z')) // Monday
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

describe('WeeklyCtlTrajectoryPeek', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderPeek({
      log: [],
      plan: makePlan(),
      today: '2026-05-04',
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when plan is missing', () => {
    const { container } = renderPeek({
      log: makeLogConstant(50, '2026-05-04'),
      plan: null,
      today: '2026-05-04',
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders rising arrow + positive delta when remaining TSS is heavy', () => {
    const { container } = renderPeek({
      log: makeLogConstant(30, '2026-05-04'),
      plan: makePlan({ tssByDow: [200, 200, 200, 200, 200, 200, 200] }),
      today: '2026-05-04',
    })
    const root = container.querySelector('[data-today-ctl-trajectory-peek]')
    expect(root).not.toBeNull()
    expect(root.getAttribute('data-ctl-direction')).toBe('rising')
    expect(root.textContent).toContain('↑')
    expect(root.textContent).toMatch(/\+\d/)
    expect(root.textContent).toContain('by Sun')
  })

  it('renders falling arrow when remaining week is all rest', () => {
    const { container } = renderPeek({
      log: makeLogConstant(80, '2026-05-04'),
      plan: makePlan({ tssByDow: [0, 0, 0, 0, 0, 0, 0] }),
      today: '2026-05-04',
    })
    const root = container.querySelector('[data-today-ctl-trajectory-peek]')
    expect(root).not.toBeNull()
    expect(root.getAttribute('data-ctl-direction')).toBe('falling')
    expect(root.textContent).toContain('↓')
  })

  it('data-ctl-direction attribute is set to stable when load matches CTL', () => {
    const { container } = renderPeek({
      log: makeLogConstant(50, '2026-05-04'),
      plan: makePlan({ tssByDow: [50, 50, 50, 50, 50, 50, 50] }),
      today: '2026-05-04',
    })
    const root = container.querySelector('[data-today-ctl-trajectory-peek]')
    expect(root).not.toBeNull()
    expect(root.getAttribute('data-ctl-direction')).toBe('stable')
  })

  it("Turkish: renders 'Paz'a kadar' when lang='tr'", () => {
    const { container } = renderPeek({
      log: makeLogConstant(30, '2026-05-04'),
      plan: makePlan({ tssByDow: [200, 200, 200, 200, 200, 200, 200] }),
      today: '2026-05-04',
    }, 'tr')
    const root = container.querySelector('[data-today-ctl-trajectory-peek]')
    expect(root).not.toBeNull()
    expect(root.textContent).toContain("Paz'a kadar")
    expect(root.textContent).not.toContain('by Sun')
  })
})
