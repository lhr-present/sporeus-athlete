// src/lib/cycleUtils.test.js — Cycle phase pure function tests
import { describe, it, expect } from 'vitest'
import { cycleDay, currentCyclePhase, daysUntilPhase } from './cycleUtils.js'

// Use a fixed "today" to make tests deterministic
const BASE = '2026-04-12'  // fixed anchor date

function daysAgo(n) {
  const d = new Date(BASE)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function daysFromNow(n) {
  const d = new Date(BASE)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── cycleDay ──────────────────────────────────────────────────────────────────
describe('cycleDay', () => {
  it('returns 1 on the start date', () => {
    expect(cycleDay(BASE, 28, BASE)).toBe(1)
  })

  it('returns 3 two days after start', () => {
    expect(cycleDay(daysAgo(2), 28, BASE)).toBe(3)
  })

  it('wraps on cycle completion (day 29 = day 1 of next cycle)', () => {
    expect(cycleDay(daysAgo(28), 28, BASE)).toBe(1)
  })

  it('wraps correctly mid-cycle past one full cycle', () => {
    // 30 days ago with 28-day cycle → day 3 of second cycle
    expect(cycleDay(daysAgo(30), 28, BASE)).toBe(3)
  })

  it('returns null for future start date', () => {
    expect(cycleDay(daysFromNow(1), 28, BASE)).toBeNull()
  })

  it('respects custom cycle length of 30', () => {
    // 31 days ago with 30-day cycle → day 2 of new cycle
    expect(cycleDay(daysAgo(31), 30, BASE)).toBe(2)
  })
})

// ── currentCyclePhase ─────────────────────────────────────────────────────────
describe('currentCyclePhase', () => {
  it('returns menstruation on day 1', () => {
    expect(currentCyclePhase(BASE, 28, BASE)).toBe('menstruation')
  })

  it('returns menstruation on day 5', () => {
    expect(currentCyclePhase(daysAgo(4), 28, BASE)).toBe('menstruation')
  })

  it('returns follicular on day 7', () => {
    expect(currentCyclePhase(daysAgo(6), 28, BASE)).toBe('follicular')
  })

  it('returns ovulation on day 14 (cycleLength/2)', () => {
    expect(currentCyclePhase(daysAgo(13), 28, BASE)).toBe('ovulation')
  })

  it('returns ovulation on day 15 (ovDay + 1)', () => {
    expect(currentCyclePhase(daysAgo(14), 28, BASE)).toBe('ovulation')
  })

  it('returns luteal on day 16', () => {
    expect(currentCyclePhase(daysAgo(15), 28, BASE)).toBe('luteal')
  })

  it('returns null for future start date', () => {
    expect(currentCyclePhase(daysFromNow(1), 28, BASE)).toBeNull()
  })

  it('wraps correctly — day 29 of 28-cycle = menstruation again', () => {
    expect(currentCyclePhase(daysAgo(28), 28, BASE)).toBe('menstruation')
  })
})

// ── daysUntilPhase ────────────────────────────────────────────────────────────
describe('daysUntilPhase', () => {
  it('returns positive days until next menstruation when in luteal', () => {
    // Day 20 (luteal) → next menstruation starts day 29 (= day 1 of next cycle) → 9 days
    const start = daysAgo(19)  // day 20
    const d = daysUntilPhase(start, 28, 'menstruation', BASE)
    expect(d).toBe(9)
  })

  it('returns cycleLength when already on day 1 of that phase', () => {
    // Currently day 1 (menstruation) → next menstruation = 28 days
    expect(daysUntilPhase(BASE, 28, 'menstruation', BASE)).toBe(28)
  })

  it('returns null for unknown phase', () => {
    expect(daysUntilPhase(BASE, 28, 'unknown', BASE)).toBeNull()
  })

  it('returns null for future start date', () => {
    expect(daysUntilPhase(daysFromNow(1), 28, 'follicular', BASE)).toBeNull()
  })
})
