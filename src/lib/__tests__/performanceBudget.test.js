// src/lib/__tests__/performanceBudget.test.js
// Regression guard for E15 performance budget constants.
import { describe, it, expect } from 'vitest'
import {
  BUNDLE_BUDGETS,
  LIGHTHOUSE_BUDGETS,
  CWV_BUDGETS,
} from '../observability/performanceBudget.js'

// ── Object existence ──────────────────────────────────────────────────────────

describe('performanceBudget — exports exist', () => {
  it('BUNDLE_BUDGETS is an object', () => {
    expect(typeof BUNDLE_BUDGETS).toBe('object')
    expect(BUNDLE_BUDGETS).not.toBeNull()
  })

  it('LIGHTHOUSE_BUDGETS is an object', () => {
    expect(typeof LIGHTHOUSE_BUDGETS).toBe('object')
    expect(LIGHTHOUSE_BUDGETS).not.toBeNull()
  })

  it('CWV_BUDGETS is an object', () => {
    expect(typeof CWV_BUDGETS).toBe('object')
    expect(CWV_BUDGETS).not.toBeNull()
  })
})

// ── BUNDLE_BUDGETS ────────────────────────────────────────────────────────────

describe('BUNDLE_BUDGETS', () => {
  it('has the expected set of keys', () => {
    expect(Object.keys(BUNDLE_BUDGETS).sort()).toEqual(
      ['cssGzipMaxKB', 'mainBundleGzipMaxKB', 'perChunkGzipMaxKB', 'totalGzipMaxKB'].sort()
    )
  })

  it('mainBundleGzipMaxKB is a positive number ≤ 500', () => {
    const v = BUNDLE_BUDGETS.mainBundleGzipMaxKB
    expect(typeof v).toBe('number')
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThanOrEqual(500)
  })

  it('perChunkGzipMaxKB is a positive number', () => {
    expect(BUNDLE_BUDGETS.perChunkGzipMaxKB).toBeGreaterThan(0)
  })

  it('totalGzipMaxKB is a positive number', () => {
    expect(BUNDLE_BUDGETS.totalGzipMaxKB).toBeGreaterThan(0)
  })

  it('cssGzipMaxKB is a positive number', () => {
    expect(BUNDLE_BUDGETS.cssGzipMaxKB).toBeGreaterThan(0)
  })
})

// ── LIGHTHOUSE_BUDGETS ────────────────────────────────────────────────────────

describe('LIGHTHOUSE_BUDGETS', () => {
  it('has the expected set of keys', () => {
    expect(Object.keys(LIGHTHOUSE_BUDGETS).sort()).toEqual(
      ['accessibility', 'bestPractices', 'performance', 'pwa', 'seo'].sort()
    )
  })

  it('performance score is between 80 and 100', () => {
    const v = LIGHTHOUSE_BUDGETS.performance
    expect(typeof v).toBe('number')
    expect(v).toBeGreaterThanOrEqual(80)
    expect(v).toBeLessThanOrEqual(100)
  })

  it('all Lighthouse scores are between 0 and 100', () => {
    for (const [key, v] of Object.entries(LIGHTHOUSE_BUDGETS)) {
      expect(typeof v, `${key} should be a number`).toBe('number')
      expect(v, `${key} should be ≥ 0`).toBeGreaterThanOrEqual(0)
      expect(v, `${key} should be ≤ 100`).toBeLessThanOrEqual(100)
    }
  })
})

// ── CWV_BUDGETS ───────────────────────────────────────────────────────────────

describe('CWV_BUDGETS', () => {
  it('has the expected set of keys', () => {
    expect(Object.keys(CWV_BUDGETS).sort()).toEqual(
      ['CLS', 'FCP_ms', 'INP_ms', 'LCP_ms', 'TTFB_ms'].sort()
    )
  })

  it('all CWV values are positive numbers', () => {
    for (const [key, v] of Object.entries(CWV_BUDGETS)) {
      expect(typeof v, `${key} should be a number`).toBe('number')
      expect(v, `${key} should be > 0`).toBeGreaterThan(0)
    }
  })

  it('LCP_ms is a reasonable millisecond budget', () => {
    expect(CWV_BUDGETS.LCP_ms).toBeGreaterThan(0)
    expect(CWV_BUDGETS.LCP_ms).toBeLessThanOrEqual(10000)
  })

  it('CLS is a small decimal (< 1)', () => {
    expect(CWV_BUDGETS.CLS).toBeGreaterThan(0)
    expect(CWV_BUDGETS.CLS).toBeLessThan(1)
  })
})
