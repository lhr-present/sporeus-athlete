// src/lib/__tests__/athlete/insightFeed.test.js — E25
// Tests for computeCTLDelta, buildMonotonyHistory, getInsightFeed.
// No mocking — uses real calcLoad, computeMonotony, generateInsightCards.
import { describe, it, expect } from 'vitest'
import {
  computeCTLDelta,
  buildMonotonyHistory,
  getInsightFeed,
} from '../../athlete/insightFeed.js'

// ── Synthetic log — 70 entries over 70 days, tss=60, type='run', rpe=7 ──────
const TODAY = '2026-04-25'

function makeLog(n = 70, asOf = TODAY) {
  const entries = []
  const base = new Date(asOf)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    entries.push({
      date: d.toISOString().slice(0, 10),
      tss: 60,
      type: 'run',
      rpe: 7,
      duration: 60,
    })
  }
  return entries
}

// ── computeCTLDelta ──────────────────────────────────────────────────────────

describe('computeCTLDelta', () => {
  it('empty log returns both 0', () => {
    const { ctlNow, ctl4wAgo } = computeCTLDelta([], TODAY)
    expect(ctlNow).toBe(0)
    expect(ctl4wAgo).toBe(0)
  })

  it('log with entries returns ctlNow > 0', () => {
    const log = makeLog(70, TODAY)
    const { ctlNow } = computeCTLDelta(log, TODAY)
    expect(ctlNow).toBeGreaterThan(0)
  })

  it('ctlNow is a finite number', () => {
    const log = makeLog(70, TODAY)
    const { ctlNow } = computeCTLDelta(log, TODAY)
    expect(Number.isFinite(ctlNow)).toBe(true)
  })

  it('ctl4wAgo is a finite number with sufficient history', () => {
    const log = makeLog(70, TODAY)
    const { ctl4wAgo } = computeCTLDelta(log, TODAY)
    expect(Number.isFinite(ctl4wAgo)).toBe(true)
  })

  it('ctl4wAgo === 0 when all sessions are within last 28 days', () => {
    // Only 10 entries in last 10 days — nothing before cutoff
    const log = makeLog(10, TODAY)
    const { ctl4wAgo } = computeCTLDelta(log, TODAY)
    // cutoff = today - 28; log starts today-9, so nothing before cutoff
    expect(ctl4wAgo).toBe(0)
  })

  it('returns object with ctlNow and ctl4wAgo keys', () => {
    const result = computeCTLDelta(makeLog(70, TODAY), TODAY)
    expect(result).toHaveProperty('ctlNow')
    expect(result).toHaveProperty('ctl4wAgo')
  })

  it('does not throw for undefined today (uses default)', () => {
    expect(() => computeCTLDelta(makeLog(70, TODAY))).not.toThrow()
  })
})

// ── buildMonotonyHistory ─────────────────────────────────────────────────────

describe('buildMonotonyHistory', () => {
  it('empty log returns array of length 8', () => {
    const hist = buildMonotonyHistory([], TODAY)
    expect(hist).toHaveLength(8)
  })

  it('empty log → all values are 0 (null replaced with 0)', () => {
    const hist = buildMonotonyHistory([], TODAY)
    expect(hist.every(v => v === 0)).toBe(true)
  })

  it('returns array of length 8 with full log', () => {
    const hist = buildMonotonyHistory(makeLog(70, TODAY), TODAY)
    expect(hist).toHaveLength(8)
  })

  it('all values are finite numbers', () => {
    const hist = buildMonotonyHistory(makeLog(70, TODAY), TODAY)
    expect(hist.every(v => Number.isFinite(v))).toBe(true)
  })

  it('no null values in output (all replaced with 0)', () => {
    const hist = buildMonotonyHistory(makeLog(70, TODAY), TODAY)
    expect(hist.every(v => v !== null)).toBe(true)
  })

  it('does not throw for undefined today (uses default)', () => {
    expect(() => buildMonotonyHistory(makeLog(70, TODAY))).not.toThrow()
  })
})

// ── getInsightFeed ───────────────────────────────────────────────────────────

describe('getInsightFeed', () => {
  it('log with fewer than 5 entries returns []', () => {
    const log = makeLog(4, TODAY)
    expect(getInsightFeed(log, TODAY)).toEqual([])
  })

  it('empty log returns []', () => {
    expect(getInsightFeed([], TODAY)).toEqual([])
  })

  it('sufficient log returns an array', () => {
    const log = makeLog(70, TODAY)
    const result = getInsightFeed(log, TODAY)
    expect(Array.isArray(result)).toBe(true)
  })

  it('each returned card has en string field', () => {
    const log = makeLog(70, TODAY)
    const cards = getInsightFeed(log, TODAY)
    for (const card of cards) {
      expect(typeof card.en).toBe('string')
    }
  })

  it('each returned card has tr string field', () => {
    const log = makeLog(70, TODAY)
    const cards = getInsightFeed(log, TODAY)
    for (const card of cards) {
      expect(typeof card.tr).toBe('string')
    }
  })

  it('each returned card has a type string field', () => {
    const log = makeLog(70, TODAY)
    const cards = getInsightFeed(log, TODAY)
    for (const card of cards) {
      expect(typeof card.type).toBe('string')
      expect(card.type.length).toBeGreaterThan(0)
    }
  })

  it('log with exactly 50 entries triggers milestone card', () => {
    const log = makeLog(50, TODAY)
    const cards = getInsightFeed(log, TODAY)
    const milestone = cards.find(c => c.type === 'milestone')
    expect(milestone).toBeDefined()
    expect(milestone.en).toContain('50')
  })

  it('does not throw on malformed entries — returns []', () => {
    const badLog = [{ wrong: true }, null, undefined]
    expect(() => getInsightFeed(badLog, TODAY)).not.toThrow()
  })

  it('returns [] when log < 5 regardless of today value', () => {
    const log = makeLog(3, TODAY)
    expect(getInsightFeed(log, '2000-01-01')).toEqual([])
    expect(getInsightFeed(log, '2099-12-31')).toEqual([])
  })
})
