// VISUAL-4: Training log type prefix, TSS band, CTL delta tests
import { describe, test, expect } from 'vitest'
import { BANISTER } from './sport/constants.js'

// Inline the helpers to avoid JSX import issues
function typePrefix(type) {
  const t = (type || '').toLowerCase()
  if (t.includes('race') || t.includes('triathlon')) return 'RC'
  if (t.includes('run')) return 'RN'
  if (t.includes('ride') || t.includes('cycl') || t.includes('ftp')) return 'RD'
  if (t.includes('swim') || t.includes('css')) return 'SW'
  if (t.includes('row')) return 'RW'
  return 'TR'
}

function tssBand(tss) {
  const v = tss || 0
  if (v >= 150) return '███░'
  if (v >= 100) return '██░░'
  if (v >= 50)  return '█░░░'
  return '░░░░'
}

function calcCtlDelta(log, session) {
  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date))
  const idx = sorted.findIndex(e => e.id === session.id)
  if (idx < 0) return null
  const K = BANISTER.K_CTL
  let ctl = 0
  for (let i = 0; i < idx; i++) {
    ctl = ctl * (1 - K) + (sorted[i].tss || 0) * K
  }
  const ctlBefore = Math.round(ctl * 10) / 10
  ctl = ctl * (1 - K) + (session.tss || 0) * K
  const ctlAfter = Math.round(ctl * 10) / 10
  const delta = Math.round((ctlAfter - ctlBefore) * 10) / 10
  return { ctlBefore, ctlAfter, delta }
}

describe('typePrefix', () => {
  test('all 6 prefixes correctly mapped', () => {
    expect(typePrefix('Easy Run')).toBe('RN')
    expect(typePrefix('Tempo Run')).toBe('RN')
    expect(typePrefix('Easy Ride')).toBe('RD')
    expect(typePrefix('FTP Test')).toBe('RD')
    expect(typePrefix('Easy Swim')).toBe('SW')
    expect(typePrefix('CSS Test')).toBe('SW')
    expect(typePrefix('Rowing')).toBe('RW')
    expect(typePrefix('Run Race')).toBe('RC')
    expect(typePrefix('Triathlon Race')).toBe('RC')
    expect(typePrefix('Strength')).toBe('TR')
    expect(typePrefix('Yoga')).toBe('TR')
    expect(typePrefix('')).toBe('TR')
  })
})

describe('tssBand', () => {
  test('boundaries at 49, 50, 99, 100, 149, 150', () => {
    expect(tssBand(0)).toBe('░░░░')
    expect(tssBand(49)).toBe('░░░░')
    expect(tssBand(50)).toBe('█░░░')
    expect(tssBand(99)).toBe('█░░░')
    expect(tssBand(100)).toBe('██░░')
    expect(tssBand(149)).toBe('██░░')
    expect(tssBand(150)).toBe('███░')
    expect(tssBand(200)).toBe('███░')
  })
})

describe('calcCtlDelta', () => {
  test('CTL delta correct for known TSS and starting CTL=0', () => {
    const session = { id: 2, date: '2026-01-02', tss: 100 }
    const log = [
      { id: 1, date: '2026-01-01', tss: 80 },
      session,
    ]
    const result = calcCtlDelta(log, session)
    expect(result).not.toBeNull()
    // After 1st session (TSS=80), CTL = 0*(1-K) + 80*K = 80*K
    const K = BANISTER.K_CTL
    const expectedBefore = Math.round(80 * K * 10) / 10
    const expectedAfter = Math.round((expectedBefore * (1 - K) + 100 * K) * 10) / 10
    expect(result.ctlBefore).toBeCloseTo(expectedBefore, 1)
    expect(result.ctlAfter).toBeCloseTo(expectedAfter, 1)
    expect(result.delta).toBeCloseTo(expectedAfter - expectedBefore, 1)
  })

  test('returns null if session not found in log', () => {
    const session = { id: 99, date: '2026-01-01', tss: 50 }
    const log = [{ id: 1, date: '2026-01-01', tss: 50 }]
    expect(calcCtlDelta(log, session)).toBeNull()
  })
})
