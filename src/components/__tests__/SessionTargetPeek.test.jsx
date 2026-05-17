// @vitest-environment jsdom
// ─── SessionTargetPeek.test.jsx — render tests for the TodayView peek ───────
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SessionTargetPeek from '../today/SessionTargetPeek.jsx'

afterEach(() => {
  cleanup()
})

function renderPeek({ plannedSession, profile, lang = 'en' } = {}) {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SessionTargetPeek plannedSession={plannedSession} profile={profile} />
    </LangCtx.Provider>
  )
}

describe('SessionTargetPeek', () => {
  it('renders nothing when buildSessionTarget returns null', () => {
    const { container } = renderPeek({
      plannedSession: null,
      profile: { primarySport: 'running', threshold: '4:30' },
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders the pace string for a runner with a threshold pace', () => {
    renderPeek({
      plannedSession: { type: 'Threshold run', zone: 'Z4', rpe: 7 },
      profile: { primarySport: 'running', threshold: '4:30' },
    })
    // EN prefix
    expect(screen.getByText('TARGET')).toBeInTheDocument()
    // Daniels Z4 = ±5s of threshold 4:30 → 4:25–4:35
    expect(screen.getByText('4:25–4:35 /km')).toBeInTheDocument()
  })

  it('renders the power string for a cyclist with FTP', () => {
    renderPeek({
      plannedSession: { type: 'Bike threshold', zone: 'Z4', rpe: 7 },
      profile: { primarySport: 'cycling', ftp: 250 },
    })
    // Coggan Z4 91-105% of 250 → 228–263 W
    expect(screen.getByText('228–263 W')).toBeInTheDocument()
  })

  it('renders the Turkish "HEDEF" prefix when lang="tr"', () => {
    renderPeek({
      plannedSession: { type: 'Threshold run', zone: 'Z4', rpe: 7 },
      profile: { primarySport: 'running', threshold: '4:30' },
      lang: 'tr',
    })
    expect(screen.getByText('HEDEF')).toBeInTheDocument()
    expect(screen.queryByText('TARGET')).toBeNull()
  })

  it('exposes data-today-session-target-peek attribute matching the sport', () => {
    const { container } = renderPeek({
      plannedSession: { type: 'Swim threshold', zone: 'Z3', rpe: 6 },
      profile: { primarySport: 'swimming', cssSec: 90 },
    })
    const node = container.querySelector('[data-today-session-target-peek]')
    expect(node).not.toBeNull()
    expect(node.getAttribute('data-today-session-target-peek')).toBe('swim')
    expect(screen.getByText('1:30–1:39 /100m')).toBeInTheDocument()
  })

  it('renders the IF number when an IF target is derivable', () => {
    renderPeek({
      plannedSession: { type: 'Threshold run', zone: 'Z4', rpe: 7 },
      profile: { primarySport: 'running', threshold: '4:30' },
    })
    // RPE 7 → 0.85
    expect(screen.getByText('IF 0.85')).toBeInTheDocument()
  })
})
