// VISUAL-5: Dashboard precision formatting tests
import { describe, test, expect } from 'vitest'

// Inline helpers — same logic as in Dashboard.jsx
function fmtLoad(v) {
  const n = typeof v === 'number' ? v : parseFloat(v)
  if (!isFinite(n)) return '—'
  if (Math.abs(n) < 10) return n.toFixed(1)
  return String(Math.round(n))
}

function fmtDateShort(dateStr) {
  if (!dateStr) return dateStr
  const d = new Date(dateStr + 'T12:00:00')
  const thisYear = new Date().getFullYear()
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const m = months[d.getMonth()]
  if (d.getFullYear() === thisYear) return `${m} ${d.getDate()}`
  return `${m} '${String(d.getFullYear()).slice(2)}`
}

describe('fmtLoad', () => {
  test('shows one decimal when value < 10', () => {
    expect(fmtLoad(8.4)).toBe('8.4')
    expect(fmtLoad(0)).toBe('0.0')
    expect(fmtLoad(9.99)).toBe('10.0') // still < 10, shows .1 decimal
    expect(fmtLoad(1.5)).toBe('1.5')
  })

  test('shows integer when value >= 10', () => {
    expect(fmtLoad(10)).toBe('10')
    expect(fmtLoad(52)).toBe('52')
    expect(fmtLoad(52.4)).toBe('52')
    expect(fmtLoad(100)).toBe('100')
  })
})

describe('fmtDateShort', () => {
  test('current year shows month + day', () => {
    const thisYear = new Date().getFullYear()
    const result = fmtDateShort(`${thisYear}-04-12`)
    expect(result).toBe('Apr 12')
  })

  test('prior year shows month + 2-digit year', () => {
    const result = fmtDateShort('2025-04-01')
    expect(result).toBe("Apr '25")
  })

  test('handles null/undefined gracefully', () => {
    expect(fmtDateShort(null)).toBeNull()
    expect(fmtDateShort(undefined)).toBeUndefined()
    expect(fmtDateShort('')).toBe('')
  })
})
