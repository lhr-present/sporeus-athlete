// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
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

const ENTRY = {
  id: 'e1', date: '2026-04-10', type: 'run', duration: 60, tss: 80, rpe: 7,
  zones: [], notes: 'Easy run', source: 'manual',
}

describe('TrainingLog', () => {
  it('renders SESSION HISTORY heading when log is empty', () => {
    renderWithLang(<TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />)
    expect(screen.getByText(/SESSION HISTORY/)).toBeInTheDocument()
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

  it('shows "No sessions logged yet." empty-state when log is empty', () => {
    renderWithLang(<TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />)
    expect(screen.getByText(/No sessions logged yet/i)).toBeInTheDocument()
  })
})

// ── Delete confirm flow ────────────────────────────────────────────────────────
describe('TrainingLog — delete confirm', () => {
  let setLog

  beforeEach(() => { setLog = vi.fn() })

  it('clicking ✕ shows "Delete this session?" confirm row', () => {
    renderWithLang(<TrainingLog log={[ENTRY]} setLog={setLog} prefill={null} clearPrefill={noop} />)
    fireEvent.click(screen.getByText('✕'))
    expect(screen.getByText(/Delete this session\?/i)).toBeInTheDocument()
    expect(screen.getByText('Delete →')).toBeInTheDocument()
    expect(screen.getByText('← Cancel')).toBeInTheDocument()
  })

  it('← Cancel hides the confirm row without calling setLog', () => {
    renderWithLang(<TrainingLog log={[ENTRY]} setLog={setLog} prefill={null} clearPrefill={noop} />)
    fireEvent.click(screen.getByText('✕'))
    fireEvent.click(screen.getByText('← Cancel'))
    expect(screen.queryByText(/Delete this session\?/i)).toBeNull()
    expect(setLog).not.toHaveBeenCalled()
  })

  it('Delete → calls setLog with entry removed', () => {
    renderWithLang(<TrainingLog log={[ENTRY]} setLog={setLog} prefill={null} clearPrefill={noop} />)
    fireEvent.click(screen.getByText('✕'))
    fireEvent.click(screen.getByText('Delete →'))
    expect(setLog).toHaveBeenCalledOnce()
    const updated = setLog.mock.calls[0][0]
    expect(updated).toHaveLength(0) // entry removed
  })
})

// ── Edit while filtered (CRITICAL: edit the clicked row, not a reverse-mapped one) ──
describe('TrainingLog — edit respects active filter', () => {
  // Production log ids are numbers (Date.now()); sanitizeLogEntry only preserves
  // numeric ids, so use numeric ids here to mirror real data.
  it('editing a filtered row loads THAT row into the form (not an index-mapped one)', () => {
    const log = [
      { id: 1001, date: '2026-04-01', type: 'Easy Run', duration: 30, tss: 40, rpe: 4, zones: [], notes: 'alpha', source: 'manual' },
      { id: 1002, date: '2026-04-02', type: 'Tempo',    duration: 45, tss: 70, rpe: 7, zones: [], notes: 'bravo', source: 'manual' },
      { id: 1003, date: '2026-04-03', type: 'Long Run', duration: 90, tss: 120, rpe: 6, zones: [], notes: 'charlie', source: 'manual' },
    ]
    const setLog = vi.fn()
    const { container } = renderWithLang(
      <TrainingLog log={log} setLog={setLog} prefill={null} clearPrefill={noop} />
    )

    // Filter to a single row that is NOT the most recent — index-reverse-mapping
    // would have loaded the wrong session here.
    const filter = screen.getByLabelText(/Filter training log/i)
    fireEvent.change(filter, { target: { value: 'bravo' } })
    expect(screen.getByText('2026-04-02')).toBeInTheDocument()
    expect(screen.queryByText('2026-04-01')).toBeNull()
    expect(screen.queryByText('2026-04-03')).toBeNull()

    // Click the (single) edit button in the filtered list.
    fireEvent.click(screen.getByLabelText('Edit session'))

    // The date input (form.date) must reflect the clicked row 'b', not row 'a' or 'c'.
    const dateInput = container.querySelector('input[type="date"]')
    expect(dateInput.value).toBe('2026-04-02')
  })

  it('updating a filtered row saves to THAT row id', () => {
    const log = [
      { id: 1001, date: '2026-04-01', type: 'Easy Run', duration: 30, tss: 40, rpe: 4, zones: [], notes: 'alpha', source: 'manual' },
      { id: 1002, date: '2026-04-02', type: 'Tempo',    duration: 45, tss: 70, rpe: 7, zones: [], notes: 'bravo', source: 'manual' },
    ]
    const setLog = vi.fn()
    renderWithLang(<TrainingLog log={log} setLog={setLog} prefill={null} clearPrefill={noop} />)

    fireEvent.change(screen.getByLabelText(/Filter training log/i), { target: { value: 'bravo' } })
    fireEvent.click(screen.getByLabelText('Edit session'))

    // Save (button becomes "Update session" while editing).
    fireEvent.click(screen.getByText(/Update session/i))
    expect(setLog).toHaveBeenCalled()
    const updated = setLog.mock.calls[setLog.mock.calls.length - 1][0]
    // Row 1001 must be untouched; the edited row (1002) must be the one replaced.
    const a = updated.find(e => e.id === 1001)
    const b = updated.find(e => e.id === 1002)
    expect(a.notes).toBe('alpha')
    expect(b).toBeTruthy()
    expect(b.date).toBe('2026-04-02')
  })
})

// ── LIST / CAL toggle ─────────────────────────────────────────────────────────
describe('TrainingLog — LIST/CAL toggle', () => {
  it('≡ LIST and ⊞ CAL buttons are present with entries', () => {
    renderWithLang(<TrainingLog log={[ENTRY]} setLog={noop} prefill={null} clearPrefill={noop} />)
    expect(screen.getByText('≡ LIST')).toBeInTheDocument()
    expect(screen.getByText('⊞ CAL')).toBeInTheDocument()
  })

  it('clicking ⊞ CAL switches to calendar view (table disappears)', () => {
    renderWithLang(<TrainingLog log={[ENTRY]} setLog={noop} prefill={null} clearPrefill={noop} />)
    // List view: session date visible in table
    expect(screen.getByText('2026-04-10')).toBeInTheDocument()
    fireEvent.click(screen.getByText('⊞ CAL'))
    // Calendar renders a month grid — the table row date should no longer be present
    // (calendar shows abbreviated dates, not the full ISO string in a table cell)
    expect(screen.queryByRole('table')).toBeNull()
  })
})
