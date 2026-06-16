// @vitest-environment jsdom
// ─── TrainingLog.fitImportPersist.test.jsx ───────────────────────────────────
// Regression for the FIT/GPX import metric-persistence bug: the saved entry
// from a FIT/GPX import dropped the parsed distanceM / avgHR (and avgPaceSecKm),
// so EF / pace / distance cards got nothing from file imports. confirmImport()
// must now carry those fields into the entry passed to setLog (sanitizeLogEntry
// already whitelists distanceM/avgHR).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Mock fileImport so parseGPX returns a deterministic preview ──────────────
const mocks = vi.hoisted(() => ({
  parseGPX: vi.fn(),
  parseFIT: vi.fn(),
}))
vi.mock('../../lib/fileImport.js', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    parseGPX: mocks.parseGPX,
    parseFIT: mocks.parseFIT,
    detectFileType: (file) => (file.name.endsWith('.gpx') ? 'gpx' : file.name.endsWith('.fit') ? 'fit' : 'unsupported'),
  }
})

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

const noop = () => {}

function getFitGpxInput(container) {
  const inputs = container.querySelectorAll('input[type="file"]')
  for (const el of inputs) {
    if ((el.getAttribute('accept') || '').includes('.fit')) return el
  }
  return inputs[0]
}

function makeFakeFile(name = 'route.gpx', size = 1024) {
  return { name, type: 'application/gpx+xml', size, text: () => Promise.resolve('<gpx/>'), arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }
}

async function uploadFile(input, file) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => {
    fireEvent.change(input)
    await Promise.resolve(); await Promise.resolve()
    await new Promise(r => setTimeout(r, 0))
  })
}

beforeEach(() => { vi.clearAllMocks() })

describe('TrainingLog — FIT/GPX import persists parsed metrics', () => {
  it('saves distanceM and avgHR (and avgPaceSecKm passes through) from a GPX import', async () => {
    mocks.parseGPX.mockReturnValue({
      date: '2026-04-10', durationMin: 60, distanceM: 12000,
      elevationGainM: 120, avgPaceSecKm: 300, avgHR: 148, maxHR: 170,
      tssEstimate: 70, trackpoints: [],
    })
    const setLog = vi.fn()
    const { container } = renderWithLang(
      <TrainingLog log={[]} setLog={setLog} prefill={null} clearPrefill={noop} />
    )
    await uploadFile(getFitGpxInput(container), makeFakeFile('route.gpx'))

    // Preview dialog should be open
    const dlg = await screen.findByRole('dialog', { name: /import preview/i })
    expect(dlg).toBeInTheDocument()

    const saveBtn = screen.getByRole('button', { name: /SAVE SESSION/i })
    await act(async () => { fireEvent.click(saveBtn) })

    expect(setLog).toHaveBeenCalled()
    // setLog([...log, sanitizeLogEntry(raw)]) — last call is an array
    const lastArg = setLog.mock.calls[setLog.mock.calls.length - 1][0]
    const next = typeof lastArg === 'function' ? lastArg([]) : lastArg
    const entry = next[next.length - 1]
    expect(entry.distanceM).toBe(12000)
    expect(entry.avgHR).toBe(148)
    expect(entry.date).toBe('2026-04-10')
  })
})
