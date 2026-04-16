// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({
    log: [], setLog: vi.fn(),
    recovery: [], setRecovery: vi.fn(),
    injuries: [], setInjuries: vi.fn(),
    testResults: [], setTestResults: vi.fn(),
    raceResults: [], setRaceResults: vi.fn(),
    profile: {}, setProfile: vi.fn(),
  }),
}))
vi.mock('../../lib/supabase.js', () => ({
  supabase: null,
  isSupabaseReady: vi.fn(() => false),
}))
vi.mock('../../lib/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import TrainingLog from '../TrainingLog.jsx'

const noop = () => {}

describe('TrainingLog', () => {
  it('renders without crashing when log is empty', () => {
    renderWithLang(<TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />)
    expect(document.body).not.toBeEmptyDOMElement()
  })

  it('shows log entries when data is present', () => {
    const log = [
      { id: '1', date: '2026-04-10', type: 'run', duration: 60, tss: 80, rpe: 7, zones: [], notes: 'Easy run', source: 'manual' },
      { id: '2', date: '2026-04-12', type: 'bike', duration: 90, tss: 110, rpe: 6, zones: [], notes: '', source: 'manual' },
    ]
    renderWithLang(<TrainingLog log={log} setLog={noop} prefill={null} clearPrefill={noop} />)
    // Log entries should appear — at minimum dates are visible
    expect(screen.getByText('2026-04-10')).toBeInTheDocument()
    expect(screen.getByText('2026-04-12')).toBeInTheDocument()
  })

  it('shows TSS value for each entry', () => {
    const log = [
      { id: '1', date: '2026-04-10', type: 'run', duration: 60, tss: 95, rpe: 7, zones: [], notes: '', source: 'manual' },
    ]
    renderWithLang(<TrainingLog log={log} setLog={noop} prefill={null} clearPrefill={noop} />)
    expect(screen.getByText('95')).toBeInTheDocument()
  })
})
