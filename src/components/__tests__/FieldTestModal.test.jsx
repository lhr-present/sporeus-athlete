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
    const program = JSON.parse(localStorage.getItem('sporeus-eliteProgram'))
    expect(program?.currentLevel?.vdot).toBe(47)

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
})
