// src/lib/__tests__/observability/bundleCheck.test.js
// E15 — Pure logic tests for the bundle size checker.
// Tests the exported checkBundles() function — no file system, no gzip I/O.
import { describe, it, expect } from 'vitest'
import { checkBundles } from '../../../../scripts/checkBundleSize.js'
import { BUNDLE_BUDGETS } from '../../observability/performanceBudget.js'

// Helper: make a fake file entry
function file(name, rawKB, gzipKB, type) {
  return { name, rawBytes: rawKB * 1024, gzipBytes: gzipKB * 1024, type }
}

describe('checkBundles — pass cases', () => {
  it('returns pass=true when all chunks are under budget', () => {
    const files = [
      file('index-abc123.js', 400, 90, 'main'),   // 90 < 250
      file('vendor-react-xyz.js', 300, 45, 'chunk'),
      file('TrainingLog-def.js', 200, 35, 'chunk'),
      file('styles-ghi.css', 100, 20, 'css'),
    ]
    const { pass } = checkBundles(files, BUNDLE_BUDGETS)
    expect(pass).toBe(true)
  })

  it('ignores asset files in budget calculations', () => {
    const files = [
      file('index-abc123.js', 100, 40, 'main'),
      file('sporeus-icon.png', 5000, 4900, 'asset'),  // huge image — should not fail
    ]
    const { pass } = checkBundles(files, BUNDLE_BUDGETS)
    expect(pass).toBe(true)
  })
})

describe('checkBundles — fail cases', () => {
  it('returns pass=false when main bundle exceeds budget', () => {
    const files = [
      file('index-abc123.js', 900, 260, 'main'),  // 260 > 250
    ]
    const { pass, rows } = checkBundles(files, BUNDLE_BUDGETS)
    expect(pass).toBe(false)
    expect(rows.find(r => r.name === 'index-abc123.js').status).toBe('FAIL')
  })

  it('returns pass=false when any single chunk exceeds per-chunk budget', () => {
    const files = [
      file('index-abc123.js', 400, 90, 'main'),
      file('vendor-huge-xxx.js', 2000, 510, 'chunk'),  // 510 > 500
    ]
    const { pass } = checkBundles(files, BUNDLE_BUDGETS)
    expect(pass).toBe(false)
  })

  it('returns pass=false when total gzip exceeds total budget', () => {
    // 10 chunks × 210 KB = 2100 KB > 2000 KB
    const files = Array.from({ length: 10 }, (_, i) =>
      file(`chunk-${i}.js`, 800, 210, 'chunk')
    )
    const { pass } = checkBundles(files, BUNDLE_BUDGETS)
    expect(pass).toBe(false)
  })
})

describe('checkBundles — file grouping', () => {
  it('groups main, chunk, and css files correctly', () => {
    const files = [
      file('index-abc.js', 300, 80, 'main'),
      file('vendor-react.js', 200, 50, 'chunk'),
      file('styles-main.css', 80, 20, 'css'),
    ]
    const { rows } = checkBundles(files, BUNDLE_BUDGETS)
    const mainRow   = rows.find(r => r.type === 'main')
    const chunkRow  = rows.find(r => r.type === 'chunk')
    const cssRow    = rows.find(r => r.type === 'css')
    expect(mainRow).toBeDefined()
    expect(chunkRow).toBeDefined()
    expect(cssRow).toBeDefined()
  })

  it('handles empty file list without crashing', () => {
    const { pass, rows, totalGzipKB } = checkBundles([], BUNDLE_BUDGETS)
    expect(pass).toBe(true)
    expect(rows).toHaveLength(0)
    expect(totalGzipKB).toBe(0)
  })
})

describe('checkBundles — report output', () => {
  it('returns a structured report string for PR comments', () => {
    const files = [file('index-xyz.js', 200, 80, 'main')]
    const { report } = checkBundles(files, BUNDLE_BUDGETS)
    expect(typeof report).toBe('string')
    expect(report).toContain('index-xyz.js')
    expect(report).toContain('PASS')
  })

  it('includes TOTAL line in report', () => {
    const files = [file('index-abc.js', 200, 80, 'main')]
    const { report } = checkBundles(files, BUNDLE_BUDGETS)
    expect(report).toContain('TOTAL')
  })
})
