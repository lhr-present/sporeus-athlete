// @vitest-environment jsdom
// ─── TrainingLog.import.test.jsx ─────────────────────────────────────────────
// Integration tests for the external-CSV import UI in TrainingLog.jsx
// (TrainingPeaks / Runalyze / Garmin Connect adapters mocked).
//
// These tests cover:
//   • format selector renders all 3 options (EN + TR)
//   • picking a format + uploading a file dispatches to the correct importer
//   • preview modal shows summary counts (parsed, duplicates, errors)
//   • confirm button calls setLog with the toImport sessions
//   • empty CSV → "No sessions found" empty-state
//   • announce() called polite on success, assertive on error
// ────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang, langCtxValue as _langCtxValue } from './testUtils.jsx'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'
import { render } from '@testing-library/react'

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  importTP:     vi.fn(),
  importRZ:     vi.fn(),
  importGarmin: vi.fn(),
  announce:     vi.fn(),
}))

vi.mock('../../lib/integrations/trainingPeaksImport.js', () => ({
  importTrainingPeaksCSV: mocks.importTP,
}))
vi.mock('../../lib/integrations/runalyzeImport.js', () => ({
  importRunalyzeCSV: mocks.importRZ,
}))
vi.mock('../../lib/integrations/garminConnectImport.js', () => ({
  importGarminConnectCSV: mocks.importGarmin,
}))
vi.mock('../../lib/a11y/announcer.js', () => ({
  announce: mocks.announce,
  init:     vi.fn(),
  destroy:  vi.fn(),
}))

vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({
    log: [], setLog: vi.fn(),
    recovery: [], setRecovery: vi.fn(),
    injuries: [], setInjuries: vi.fn(),
    testResults: [], setTestResults: vi.fn(),
    raceResults: [], setRaceResults: vi.fn(),
    profile: {}, setProfile: vi.fn(),
    fetchNextPage: vi.fn(), hasMore: false, isLoadingMore: false,
  }),
}))
vi.mock('../../lib/supabase.js', () => ({
  supabase: null,
  isSupabaseReady: vi.fn(() => false),
}))
vi.mock('../../lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import TrainingLog from '../TrainingLog.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────
// Find the hidden file input bound to the external-import flow.
// (The component renders 2 file inputs total: existing CSV import + this new
// one. We pick the one whose accept attribute starts with ".csv,text/csv".)
function getExtFileInput(container) {
  const inputs = container.querySelectorAll('input[type="file"]')
  for (const el of inputs) {
    if ((el.getAttribute('accept') || '').includes('text/csv')) return el
  }
  return inputs[inputs.length - 1]
}

const TP_CSV_SAMPLE = 'WorkoutDay,WorkoutType,TimeTotalInHours\n2026-04-10,Run,1.0'
const RZ_CSV_SAMPLE = 'Date,Sport,Time\n2026-04-10,Running,3600'
const GARMIN_CSV_SAMPLE = 'Activity Type,Date,Time,Distance,Avg HR\nRunning,2026-04-10,01:00:00,10.0,150'

const TP_RESULT = {
  toImport: [
    { date: '2026-04-10', type: 'Running', duration: 60, tss: 70, source: 'tp_csv' },
    { date: '2026-04-11', type: 'Cycling', duration: 90, tss: 110, source: 'tp_csv' },
  ],
  duplicates: [],
  errors: [],
  summary: { total: 2, parsed: 2, skipped: 0, duplicates: 0, toImport: 2 },
}

const RZ_RESULT = {
  toImport: [{ date: '2026-04-10', type: 'Running', duration: 60, source: 'runalyze' }],
  duplicates: [],
  errors: [],
  summary: { total: 1, parsed: 1, skipped: 0, duplicates: 0, toImport: 1 },
}

const GARMIN_RESULT = {
  toImport: [{ date: '2026-04-10', type: 'Running', duration: 60, source: 'garmin' }],
  duplicates: [],
  errors: [],
  summary: { total: 1, parsed: 1, skipped: 0, duplicates: 0, toImport: 1 },
}

const RESULT_WITH_COUNTS = {
  toImport: [{ date: '2026-04-10', type: 'Running', duration: 60, source: 'tp_csv' }],
  duplicates: [{ date: '2026-04-09', type: 'Cycling', duration: 45 }, { date: '2026-04-08', type: 'Running', duration: 30 }],
  errors: [{ row: 5, reason: 'Missing WorkoutDay' }, { row: 7, reason: 'Bad duration' }],
  summary: { total: 5, parsed: 3, skipped: 2, duplicates: 2, toImport: 1 },
}

const EMPTY_RESULT = {
  toImport: [],
  duplicates: [],
  errors: [],
  summary: { total: 0, parsed: 0, skipped: 0, duplicates: 0, toImport: 0 },
}

const ERROR_RESULT = {
  toImport: [],
  duplicates: [],
  errors: [
    { row: 1, reason: 'Missing required columns. Need WorkoutDay and (TimeTotalInHours or Time).' },
  ],
  summary: { total: 0, parsed: 0, skipped: 0, duplicates: 0, toImport: 0 },
}

const noop = () => {}

// Helper: fire a real File at the hidden file input and wait for state to settle.
// Uses a stub File-like object whose `.text()` returns a resolved promise — this
// works regardless of whether jsdom provides a real Blob.text() implementation.
function makeFakeFile(content, name = 'workouts.csv') {
  return {
    name,
    type: 'text/csv',
    size: content.length,
    text: () => Promise.resolve(content),
  }
}
async function uploadFile(input, file) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => {
    fireEvent.change(input)
    // Give microtasks/macrotasks time to flush async file.text() awaits
    await Promise.resolve()
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 0))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('TrainingLog — external CSV import (UI)', () => {
  it('renders format selector with all 3 options', () => {
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />
    )
    const select = container.querySelector('select[aria-label="FORMAT"]')
    expect(select).toBeInTheDocument()
    const opts = Array.from(select.querySelectorAll('option')).map(o => o.textContent)
    expect(opts).toEqual(['TrainingPeaks', 'Runalyze', 'Garmin Connect'])
  })

  it('renders the IMPORT FROM SERVICE button', () => {
    renderWithLang(<TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />)
    expect(screen.getByText(/IMPORT FROM SERVICE/i)).toBeInTheDocument()
  })

  it('uploading a TP file calls importTrainingPeaksCSV', async () => {
    mocks.importTP.mockReturnValue(TP_RESULT)
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />
    )
    // Default format is TrainingPeaks (id 'tp')
    await uploadFile(getExtFileInput(container), makeFakeFile(TP_CSV_SAMPLE))
    expect(mocks.importTP).toHaveBeenCalledOnce()
    expect(mocks.importTP).toHaveBeenCalledWith(TP_CSV_SAMPLE, [])
  })

  it('selecting Runalyze + uploading a Runalyze file calls importRunalyzeCSV', async () => {
    mocks.importRZ.mockReturnValue(RZ_RESULT)
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />
    )
    const select = container.querySelector('select[aria-label="FORMAT"]')
    fireEvent.change(select, { target: { value: 'rz' } })
    await uploadFile(getExtFileInput(container), makeFakeFile(RZ_CSV_SAMPLE))
    expect(mocks.importRZ).toHaveBeenCalledOnce()
    expect(mocks.importTP).not.toHaveBeenCalled()
    expect(mocks.importGarmin).not.toHaveBeenCalled()
  })

  it('selecting Garmin Connect + uploading a Garmin file calls importGarminConnectCSV', async () => {
    mocks.importGarmin.mockReturnValue(GARMIN_RESULT)
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />
    )
    const select = container.querySelector('select[aria-label="FORMAT"]')
    fireEvent.change(select, { target: { value: 'garmin' } })
    await uploadFile(getExtFileInput(container), makeFakeFile(GARMIN_CSV_SAMPLE))
    expect(mocks.importGarmin).toHaveBeenCalledOnce()
  })

  it('preview modal shows correct summary counts (parsed, duplicates, errors, ready)', async () => {
    mocks.importTP.mockReturnValue(RESULT_WITH_COUNTS)
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />
    )
    await uploadFile(getExtFileInput(container), makeFakeFile(TP_CSV_SAMPLE))
    // Modal should render
    const dlg = await screen.findByRole('dialog')
    expect(dlg).toBeInTheDocument()
    // a11y deep-dive: import preview is a modal dialog (focus-trapped)
    expect(dlg).toHaveAttribute('aria-modal', 'true')
    // Format label appears inside the dialog header
    expect(dlg.textContent).toContain('TrainingPeaks')
    // Summary cards (READY, PARSED, DUPLICATES, ERRORS)
    expect(dlg.textContent).toContain('READY TO IMPORT')
    expect(dlg.textContent).toContain('PARSED')
    expect(dlg.textContent).toContain('DUPLICATES')
    expect(dlg.textContent).toContain('ERRORS')
    // Verify the numeric values appear adjacent to their card labels.
    // Stripped textContent looks like "READY TO IMPORT1PARSED3DUPLICATES2ERRORS2"
    expect(dlg.textContent).toMatch(/READY TO IMPORT1/)
    expect(dlg.textContent).toMatch(/PARSED3/)
    expect(dlg.textContent).toMatch(/DUPLICATES2/)
    expect(dlg.textContent).toMatch(/ERRORS2/)
  })

  it('confirm button calls setLog with toImport sessions', async () => {
    mocks.importTP.mockReturnValue(TP_RESULT)
    const setLog = vi.fn()
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={setLog} prefill={null} clearPrefill={noop} />
    )
    await uploadFile(getExtFileInput(container), makeFakeFile(TP_CSV_SAMPLE))
    const confirmBtn = await screen.findByRole('button', { name: /IMPORT 2 SESSIONS/i })
    await act(async () => { fireEvent.click(confirmBtn) })
    expect(setLog).toHaveBeenCalledOnce()
    // setLog called with an updater fn — invoke it with the prev log to verify
    const updater = setLog.mock.calls[0][0]
    const next = typeof updater === 'function' ? updater([]) : updater
    expect(next).toHaveLength(2)
    expect(next[0]).toMatchObject({ date: '2026-04-10', type: 'Running', duration: 60 })
    expect(next[1]).toMatchObject({ date: '2026-04-11', type: 'Cycling', duration: 90 })
    // Each entry should have an id assigned by the UI
    expect(next[0].id).toBeDefined()
    expect(next[1].id).toBeDefined()
  })

  it('empty CSV → "No sessions found" message rendered', async () => {
    mocks.importTP.mockReturnValue(EMPTY_RESULT)
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />
    )
    await uploadFile(getExtFileInput(container), makeFakeFile(''))
    expect(await screen.findByText(/No sessions found/i)).toBeInTheDocument()
  })

  it('format selector labels render in TR mode', () => {
    const t = key => LABELS.tr?.[key] ?? key
    const trCtx = { t, lang: 'tr', setLang: () => {} }
    function Wrapper({ children }) {
      return <LangCtx.Provider value={trCtx}>{children}</LangCtx.Provider>
    }
    const { container } = render(
      <TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />,
      { wrapper: Wrapper }
    )
    // Aria-label uses TR string ("BİÇİM")
    const select = container.querySelector('select[aria-label="BİÇİM"]')
    expect(select).toBeInTheDocument()
    // Service button uses TR label
    expect(screen.getByText(/HARİCİ SERVİSTEN AKTAR/)).toBeInTheDocument()
  })

  it('announce() called polite on successful import', async () => {
    mocks.importTP.mockReturnValue(TP_RESULT)
    const setLog = vi.fn()
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={setLog} prefill={null} clearPrefill={noop} />
    )
    await uploadFile(getExtFileInput(container), makeFakeFile(TP_CSV_SAMPLE))
    const confirmBtn = await screen.findByRole('button', { name: /IMPORT 2 SESSIONS/i })
    await act(async () => { fireEvent.click(confirmBtn) })
    // announce called with polite level on success
    const politeCalls = mocks.announce.mock.calls.filter(c => c[1] === 'polite' || c[1] === undefined)
    expect(politeCalls.length).toBeGreaterThan(0)
    const successMsg = politeCalls.find(c => /Imported 2 sessions/i.test(String(c[0])))
    expect(successMsg).toBeTruthy()
  })

  it('announce() called assertively when importer returns errors with no parseable rows', async () => {
    mocks.importTP.mockReturnValue(ERROR_RESULT)
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={noop} prefill={null} clearPrefill={noop} />
    )
    await uploadFile(getExtFileInput(container), makeFakeFile('garbage,headers\nrow1'))
    await waitFor(() => {
      const assertive = mocks.announce.mock.calls.filter(c => c[1] === 'assertive')
      expect(assertive.length).toBeGreaterThan(0)
    })
  })

  it('cancel button closes the preview modal without calling setLog', async () => {
    mocks.importTP.mockReturnValue(TP_RESULT)
    const setLog = vi.fn()
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={setLog} prefill={null} clearPrefill={noop} />
    )
    await uploadFile(getExtFileInput(container), makeFakeFile(TP_CSV_SAMPLE))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    const cancelBtn = screen.getByRole('button', { name: /^CANCEL$/i })
    fireEvent.click(cancelBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(setLog).not.toHaveBeenCalled()
  })
})
