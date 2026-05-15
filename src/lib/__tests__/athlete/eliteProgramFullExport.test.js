// @vitest-environment jsdom
// src/lib/__tests__/athlete/eliteProgramFullExport.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  eliteProgramToFullCSV,
  eliteProgramToJSON,
  downloadEliteProgramFullCSV,
  downloadEliteProgramJSON,
} from '../../athlete/eliteProgramExport.js'
import { buildEliteProgram } from '../../athlete/eliteProgram.js'

const TODAY = '2026-05-07'

function realRunProgram() {
  return buildEliteProgram({
    sport: 'run',
    raceDate: '2026-08-15',
    currentPR: { distanceM: 10000, timeSec: 3000 },
    targetPR:  { distanceM: 10000, timeSec: 2400 },
    profile: { currentCTL: 50 },
    options: { today: TODAY },
  })
}

function realBikeProgram() {
  return buildEliteProgram({
    sport: 'bike',
    raceDate: '2026-09-01',
    currentPR: { distanceM: 0, timeSec: 250 },
    targetPR:  { distanceM: 0, timeSec: 280 },
    profile: { currentCTL: 60 },
    options: { today: TODAY },
  })
}

describe('eliteProgramToFullCSV — shape', () => {
  it('returns "" for null / non-object input', () => {
    expect(eliteProgramToFullCSV(null)).toBe('')
    expect(eliteProgramToFullCSV(undefined)).toBe('')
    expect(eliteProgramToFullCSV(42)).toBe('')
    expect(eliteProgramToFullCSV('x')).toBe('')
  })

  it('emits all six section headers in order', () => {
    const csv = eliteProgramToFullCSV(realRunProgram())
    const headers = ['# META', '# WEEKLY_TSS', '# DAILY_GRID', '# STRENGTH', '# DRILLS', '# PHYSIOLOGY_GAP']
    let cursor = -1
    for (const h of headers) {
      const idx = csv.indexOf(h, cursor + 1)
      expect(idx, `section ${h} should appear after previous`).toBeGreaterThan(cursor)
      cursor = idx
    }
  })

  it('META section contains sport, raceDate, distanceCategory, cohort', () => {
    const csv = eliteProgramToFullCSV(realRunProgram())
    expect(csv).toMatch(/^Sport,run$/m)
    expect(csv).toMatch(/^RaceDate,2026-08-15$/m)
    expect(csv).toMatch(/^DistanceCategory,/m)
    expect(csv).toMatch(/^Cohort,/m)
    expect(csv).toMatch(/^ExportVersion,v9\./m)
  })

  it('WEEKLY_TSS section has one row per planned week with numeric TSS', () => {
    const p = realRunProgram()
    const csv = eliteProgramToFullCSV(p)
    const wt = p.weeklyTSS || []
    const tssBlock = csv.split('# WEEKLY_TSS\n')[1].split('\n\n')[0]
    const lines = tssBlock.split('\n').slice(1) // drop header
    expect(lines.length).toBe(wt.length)
    // every row has 3 columns and numeric TSS
    for (const ln of lines) {
      const cols = ln.split(',')
      expect(cols.length).toBe(3)
      expect(Number.isFinite(Number(cols[2]))).toBe(true)
    }
  })

  it('DAILY_GRID section preserves the legacy CSV header and content', () => {
    const csv = eliteProgramToFullCSV(realRunProgram())
    expect(csv).toContain('Phase,Week,Day,Intent,DurationMin,Z1,Z2,Z3,Z4,Z5,PaceTarget,NotesEN,NotesTR')
    expect(csv).toMatch(/\d+:\d{2}\/km/)
  })

  it('STRENGTH section contains prehab + movements + core sections per phase', () => {
    const p = realRunProgram()
    const csv = eliteProgramToFullCSV(p)
    const strBlock = csv.split('# STRENGTH\n')[1].split('\n\n')[0]
    expect(strBlock.split('\n')[0]).toBe('Phase,Section,Name,Sets,Reps,Intensity,NotesEN,NotesTR')
    expect(strBlock).toMatch(/\bBase,prehab,/)
    expect(strBlock).toMatch(/\bBase,movements,/)
    expect(strBlock).toMatch(/\bBase,core,/)
  })

  it('DRILLS section has phase + key + bilingual names', () => {
    const csv = eliteProgramToFullCSV(realRunProgram())
    const drillBlock = csv.split('# DRILLS\n')[1].split('\n\n')[0]
    expect(drillBlock.split('\n')[0]).toBe('Phase,Key,NameEN,NameTR,StructureEN,FrequencyPerWeek,Citation')
    expect(drillBlock).toMatch(/run-drill-/)
  })

  it('PHYSIOLOGY_GAP section has a single data row for run', () => {
    const csv = eliteProgramToFullCSV(realRunProgram())
    const gapBlock = csv.split('# PHYSIOLOGY_GAP\n')[1]
    const lines = gapBlock.split('\n').filter(Boolean)
    expect(lines[0]).toBe('Metric,Current,Target,Gap,GapDirection,RatePerBlock,BlocksToBridge,WeeksToBridge,Verdict,NoteEN,NoteTR')
    expect(lines[1].split(',')[0]).toBe('VDOT')
  })

  it('works for bike sport (FTP metric)', () => {
    const csv = eliteProgramToFullCSV(realBikeProgram())
    expect(csv).toMatch(/^Sport,bike$/m)
    const gapBlock = csv.split('# PHYSIOLOGY_GAP\n')[1]
    const lines = gapBlock.split('\n').filter(Boolean)
    expect(lines[1].split(',')[0]).toBe('FTP')
  })
})

describe('eliteProgramToJSON', () => {
  it('returns "" for null / non-object', () => {
    expect(eliteProgramToJSON(null)).toBe('')
    expect(eliteProgramToJSON(42)).toBe('')
  })

  it('round-trips program + adds envelope + physiology gap', () => {
    const p = realRunProgram()
    const json = eliteProgramToJSON(p)
    const parsed = JSON.parse(json)
    expect(parsed.exportVersion).toMatch(/^v9\./)
    expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(parsed.program.sport).toBe('run')
    expect(parsed.program.feasibility?.effectiveRaceDate).toBe('2026-08-15')
    expect(Array.isArray(parsed.program.phases)).toBe(true)
    expect(Array.isArray(parsed.program.weeklyTSS)).toBe(true)
    expect(parsed.physiologyGap?.metric).toBe('VDOT')
  })

  it('envelope is stable JSON (parseable, no functions / undefined)', () => {
    const json = eliteProgramToJSON(realRunProgram())
    expect(() => JSON.parse(json)).not.toThrow()
    expect(json).not.toContain('undefined')
  })
})

describe('downloadEliteProgramFullCSV / downloadEliteProgramJSON', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('return false for null', () => {
    expect(downloadEliteProgramFullCSV(null)).toBe(false)
    expect(downloadEliteProgramJSON(null)).toBe(false)
  })

  it('return true for a real program', () => {
    const p = realRunProgram()
    expect(downloadEliteProgramFullCSV(p, 'test.csv')).toBe(true)
    expect(downloadEliteProgramJSON(p, 'test.json')).toBe(true)
  })
})
