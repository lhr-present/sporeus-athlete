import { describe, it, expect, vi } from 'vitest'
import { generateSeasonReport } from './pdfReport.js'

vi.mock('./ruleInsights.js', () => ({
  getAthleteInsights: vi.fn(() => [{ message: 'Training is consistent.' }]),
}))

function makeLog(n = 14, baseTss = 80) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i))
    return { date: d.toISOString().slice(0, 10), tss: baseTss + i, rpe: 6, type: 'Run', notes: '' }
  })
}

const athlete = { name: 'Eddy Merckx', sport: 'Cycling' }

describe('generateSeasonReport', () => {
  it('returns an HTML string with DOCTYPE and athlete name', () => {
    const html = generateSeasonReport(athlete, makeLog(), [])
    expect(typeof html).toBe('string')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Eddy Merckx')
  })

  it('escapes XSS in athlete name', () => {
    const bad = { name: '<script>xss</script>', sport: 'Run' }
    const html = generateSeasonReport(bad, makeLog(), [])
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('handles empty log gracefully', () => {
    const html = generateSeasonReport(athlete, [], [])
    expect(html).toContain('No training data')
  })
})
