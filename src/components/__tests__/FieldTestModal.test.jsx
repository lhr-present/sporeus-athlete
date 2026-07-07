// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import FieldTestModal from '../FieldTestModal.jsx'

// Stub reAnchorEliteProgram — its own test suite (EP-3, v9.163) already
// covers correctness; here we just verify the modal calls it correctly.
const reAnchorMock = vi.fn()
vi.mock('../../lib/athlete/eliteProgram.js', () => ({
  reAnchorEliteProgram: (...args) => reAnchorMock(...args),
}))

const RUN_PROGRAM = {
  sport: 'run',
  raceDate: '2026-11-01',
  feasibility: { effectiveRaceDate: '2026-11-01', weeksAvailable: 26, weeksNeeded: 12 },
  currentLevel: { vdot: 45 },
  targetLevel:  { vdot: 50 },
  phases: [
    { phase: 'Base',  weeks: [1, 2, 3, 4, 5, 6, 7, 8] },
    { phase: 'Build', weeks: [9, 10, 11, 12, 13] },
    { phase: 'Peak',  weeks: [14, 15, 16] },
    { phase: 'Taper', weeks: [17] },
  ],
  weeklyTSS: [
    ...Array.from({ length: 8 }, (_, i) => ({ week: i + 1, phase: 'Base', tss: 350 })),
    ...Array.from({ length: 5 }, (_, i) => ({ week: i + 9, phase: 'Build', tss: 450 })),
    { week: 14, phase: 'Peak', tss: 500 },
    { week: 15, phase: 'Peak', tss: 520 },
    { week: 16, phase: 'Peak', tss: 540 },
    { week: 17, phase: 'Taper', tss: 300 },
  ],
}

const BIKE_PROGRAM = { ...RUN_PROGRAM, sport: 'bike', currentLevel: { ftp: 250 }, targetLevel: { ftp: 280 } }
const SWIM_PROGRAM = { ...RUN_PROGRAM, sport: 'swim', currentLevel: { css: 100 }, targetLevel: { css: 92 } }
const ROW_PROGRAM  = { ...RUN_PROGRAM, sport: 'rowing', currentLevel: { split500Sec: 110 }, targetLevel: { split500Sec: 105 } }

beforeEach(() => {
  reAnchorMock.mockReset()
  localStorage.clear()
})

describe('FieldTestModal — sport-conditional inputs', () => {
  it('run: shows VDOT input with bounds 30-85', () => {
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    const input = screen.getByLabelText(/VDOT/i)
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('min', '30')
    expect(input).toHaveAttribute('max', '85')
  })

  it('bike: shows W input', () => {
    render(<FieldTestModal program={BIKE_PROGRAM} onClose={() => {}} />)
    expect(screen.getByLabelText(/W \(/)).toBeInTheDocument()
  })

  it('swim: shows sec/100m input', () => {
    render(<FieldTestModal program={SWIM_PROGRAM} onClose={() => {}} />)
    expect(screen.getByLabelText(/SEC\/100M/i)).toBeInTheDocument()
  })

  it('rowing: shows sec/500m input', () => {
    render(<FieldTestModal program={ROW_PROGRAM} onClose={() => {}} />)
    expect(screen.getByLabelText(/SEC\/500M/i)).toBeInTheDocument()
  })

  it('renders empty-state when no program', () => {
    render(<FieldTestModal program={null} onClose={() => {}} />)
    expect(screen.getByText(/No active elite program/i)).toBeInTheDocument()
  })
})

describe('FieldTestModal — validation', () => {
  it('rejects values below sport min', () => {
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '20' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))
    expect(screen.getByRole('alert')).toHaveTextContent(/30-85/)
    expect(reAnchorMock).not.toHaveBeenCalled()
  })

  it('rejects values above sport max', () => {
    render(<FieldTestModal program={BIKE_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/W \(/), { target: { value: '999' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(reAnchorMock).not.toHaveBeenCalled()
  })

  it('rejects non-numeric input', () => {
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('FieldTestModal — happy path', () => {
  it('calls reAnchorEliteProgram with correct fieldTest shape (run → vdot)', () => {
    reAnchorMock.mockReturnValueOnce({
      ...RUN_PROGRAM,
      currentLevel: { vdot: 47 },
      weeklyTSS: RUN_PROGRAM.weeklyTSS.map(w => w.phase === 'Peak' || w.phase === 'Taper' ? { ...w, tss: Math.round(w.tss * 1.1) } : w),
    })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))

    expect(reAnchorMock).toHaveBeenCalledTimes(1)
    const [program, fieldTest, todayISO, profile] = reAnchorMock.mock.calls[0]
    expect(program.sport).toBe('run')
    expect(fieldTest).toEqual({ vdot: 47 })
    expect(todayISO).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(profile).toEqual({})
  })

  it('calls reAnchorEliteProgram with ftp for bike', () => {
    reAnchorMock.mockReturnValueOnce({ ...BIKE_PROGRAM, currentLevel: { ftp: 265 } })
    render(<FieldTestModal program={BIKE_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/W \(/), { target: { value: '265' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))
    expect(reAnchorMock.mock.calls[0][1]).toEqual({ ftp: 265 })
  })

  it('shows before/after Peak+Taper TSS comparison on success', () => {
    // 3 Peak weeks at 500+520+540 + 1 Taper at 300 = 1860 original
    // Scaled 1.1 for Peak+Taper: 550+572+594+330 = 2046
    reAnchorMock.mockReturnValueOnce({
      ...RUN_PROGRAM,
      currentLevel: { vdot: 47 },
      weeklyTSS: RUN_PROGRAM.weeklyTSS.map(w =>
        (w.phase === 'Peak' || w.phase === 'Taper') ? { ...w, tss: Math.round(w.tss * 1.1) } : w),
    })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))

    // The success badge "Re-anchored ✓" appears (along with the synthesized
    // note "Peak/Taper re-anchored"); use getAllByText to disambiguate.
    expect(screen.getAllByText(/Re-anchored/i).length).toBeGreaterThan(0)
    expect(screen.getByText('1860')).toBeInTheDocument()  // previous
    expect(screen.getByText(/2046/)).toBeInTheDocument()  // new (may have +186 suffix)
  })

  it('shows delta note when physiology changes', () => {
    reAnchorMock.mockReturnValueOnce({ ...RUN_PROGRAM, currentLevel: { vdot: 47 } })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))
    expect(screen.getByText(/VDOT \+2/)).toBeInTheDocument()
  })

  it('persists program + appends to results in localStorage', () => {
    reAnchorMock.mockReturnValueOnce({ ...RUN_PROGRAM, currentLevel: { vdot: 47 } })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))

    // useLocalStorage stores values raw (no _v/data wrapper)
    // v9.490 (F4): the persist is non-destructive now — the re-anchored build
    // lives under .reAnchored (the {input, form} storage contract is never
    // overwritten by a raw built program).
    const program = JSON.parse(localStorage.getItem('sporeus-eliteProgram'))
    expect(program?.reAnchored?.currentLevel?.vdot).toBe(47)
    expect(typeof program?.reAnchoredAt).toBe('string')

    const results = JSON.parse(localStorage.getItem('sporeus-field-test-results'))
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(1)
    expect(results[0]?.field).toBe('vdot')
    expect(results[0]?.value).toBe(47)
  })
})

describe('FieldTestModal — error paths', () => {
  it('shows error when reAnchorEliteProgram returns _rejected', () => {
    reAnchorMock.mockReturnValueOnce({ _rejected: true, reason: 'target-not-faster' })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))
    expect(screen.getByRole('alert')).toHaveTextContent(/target-not-faster/)
  })

  it('shows error when reAnchorEliteProgram returns null', () => {
    reAnchorMock.mockReturnValueOnce(null)
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))
    expect(screen.getByRole('alert')).toHaveTextContent(/failed/i)
  })
})

describe('FieldTestModal — bilingual', () => {
  it('English UI by default', () => {
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    expect(screen.getByText('Record Field Test')).toBeInTheDocument()
    expect(screen.getByText(/Re-anchor program/)).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('Turkish UI when lang=tr', () => {
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} lang="tr" />)
    expect(screen.getByText('Saha Testi Kaydet')).toBeInTheDocument()
    expect(screen.getByText(/Programı yeniden hizala/)).toBeInTheDocument()
    expect(screen.getByText('İptal')).toBeInTheDocument()
  })
})

describe('FieldTestModal — close behaviour', () => {
  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn()
    render(<FieldTestModal program={RUN_PROGRAM} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // v9.180.0 — focus-trap a11y
  it('calls onClose when Escape pressed inside the dialog', async () => {
    const onClose = vi.fn()
    render(<FieldTestModal program={RUN_PROGRAM} onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    // useFocusTrap moves focus on the next rAF; trigger event after one frame
    await new Promise(r => requestAnimationFrame(r))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('dialog is announced via role + aria-modal', () => {
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})

// ── v9.178.0 — optional notes + RPE + Undo ───────────────────────────────────

describe('FieldTestModal — optional notes + RPE (v9.178.0)', () => {
  it('saves notes + rpe into results entry when provided', () => {
    reAnchorMock.mockReturnValueOnce({ ...RUN_PROGRAM, currentLevel: { vdot: 47 } })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.change(screen.getByLabelText(/RPE \(1-10\)/i), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText(/^NOTES$/i), { target: { value: 'humid 28°C track' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))

    const results = JSON.parse(localStorage.getItem('sporeus-field-test-results'))
    expect(results[0].rpe).toBe(8)
    expect(results[0].notes).toBe('humid 28°C track')
  })

  it('omits notes + rpe from entry when blank (entry stays minimal)', () => {
    reAnchorMock.mockReturnValueOnce({ ...RUN_PROGRAM, currentLevel: { vdot: 47 } })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))

    const results = JSON.parse(localStorage.getItem('sporeus-field-test-results'))
    expect(results[0]).not.toHaveProperty('rpe')
    expect(results[0]).not.toHaveProperty('notes')
  })

  it('rejects out-of-range RPE values (silently dropped, entry still saves)', () => {
    reAnchorMock.mockReturnValueOnce({ ...RUN_PROGRAM, currentLevel: { vdot: 47 } })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.change(screen.getByLabelText(/RPE \(1-10\)/i), { target: { value: '15' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))

    const results = JSON.parse(localStorage.getItem('sporeus-field-test-results'))
    expect(results[0]).not.toHaveProperty('rpe')   // 15 dropped
    expect(results[0].field).toBe('vdot')          // entry still saved
  })
})

describe('FieldTestModal — Undo (v9.178.0)', () => {
  it('Undo restores the previous program and removes last results entry', () => {
    // Pre-seed an existing program in localStorage so undo has something to restore to
    localStorage.setItem('sporeus-eliteProgram', JSON.stringify(RUN_PROGRAM))

    reAnchorMock.mockReturnValueOnce({ ...RUN_PROGRAM, currentLevel: { vdot: 47 } })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))

    // After submit: re-anchored build stashed under .reAnchored (v9.490 F4 —
    // non-destructive), results has 1 entry
    expect(JSON.parse(localStorage.getItem('sporeus-eliteProgram')).reAnchored.currentLevel.vdot).toBe(47)
    expect(JSON.parse(localStorage.getItem('sporeus-field-test-results')).length).toBe(1)

    fireEvent.click(screen.getByText(/Undo/i))

    // After undo: program restored, results emptied
    expect(JSON.parse(localStorage.getItem('sporeus-eliteProgram')).currentLevel.vdot).toBe(45)
    expect(JSON.parse(localStorage.getItem('sporeus-field-test-results')).length).toBe(0)
  })

  it('Undo returns to the input form (form re-shown)', () => {
    reAnchorMock.mockReturnValueOnce({ ...RUN_PROGRAM, currentLevel: { vdot: 47 } })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Re-anchor program/))

    expect(screen.getByText(/Re-anchored ✓/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Undo/i))

    // Submit button is back (form re-rendered)
    expect(screen.getByText(/Re-anchor program/)).toBeInTheDocument()
  })

  it('Undo is bilingual (TR shows "Geri al")', () => {
    reAnchorMock.mockReturnValueOnce({ ...RUN_PROGRAM, currentLevel: { vdot: 47 } })
    render(<FieldTestModal program={RUN_PROGRAM} onClose={() => {}} lang="tr" />)
    fireEvent.change(screen.getByLabelText(/VDOT/i), { target: { value: '47' } })
    fireEvent.click(screen.getByText(/Programı yeniden hizala/))
    expect(screen.getByText(/Geri al/i)).toBeInTheDocument()
  })
})
