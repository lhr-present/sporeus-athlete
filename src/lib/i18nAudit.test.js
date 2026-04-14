// ─── i18nAudit.test.js — i18n completeness and accessibility audit ─────────
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()

describe('i18n and accessibility audit', () => {

  it('ACWR band labels exist in LABELS (both EN and TR)', () => {
    const src = readFileSync(join(root, 'src/contexts/LangCtx.jsx'), 'utf-8')
    // acwrOptimal must appear in both EN and TR sections
    expect(src).toContain('acwrOptimal')
    expect(src).toContain('acwrInsufficient')
    // Verify EN value
    expect(src).toContain("acwrOptimal: 'OPTIMAL'")
    // Verify TR value
    expect(src).toContain("acwrOptimal: 'OPTİMAL'")
  })

  it('recovery protocols — all 8 have both text_en and text_tr fields', () => {
    const src = readFileSync(join(root, 'src/lib/recoveryProtocols.js'), 'utf-8')
    const EXPECTED_IDS = [
      'cold_water_immersion',
      'contrast_bathing',
      'active_recovery',
      'compression',
      'sleep_hygiene',
      'nutrition_window',
      'foam_rolling',
      'breathing_478',
    ]
    // Verify all 8 protocol IDs exist
    for (const id of EXPECTED_IDS) {
      expect(src, `Protocol id '${id}' missing`).toContain(`id: '${id}'`)
    }
    // Count text_en and text_tr occurrences — must equal 8 each
    const enCount  = (src.match(/text_en:/g) || []).length
    const trCount  = (src.match(/text_tr:/g) || []).length
    expect(enCount).toBe(8)
    expect(trCount).toBe(8)
  })

  it('RESTQ items — count is exactly 19', () => {
    const src = readFileSync(join(root, 'src/lib/sport/restq.js'), 'utf-8')
    // Count id: entries in RESTQ_ITEMS array
    const idMatches = src.match(/\{ id:'/g) || []
    expect(idMatches.length).toBe(19)
    // Every item must have text_en and text_tr
    const enCount = (src.match(/text_en:/g) || []).length
    const trCount = (src.match(/text_tr:/g) || []).length
    expect(enCount).toBe(19)
    expect(trCount).toBe(19)
  })

  it('test battery — all 7 tests present', () => {
    const src = readFileSync(join(root, 'src/lib/sport/testBattery.js'), 'utf-8')
    const EXPECTED_IDS = [
      'standing_broad_jump',
      'step_test_3min',
      'erg_2km',
      'sprint_20m',
      'squat_1rm',
      'yoyo_ir1',
      'cooper_12min',
    ]
    for (const id of EXPECTED_IDS) {
      expect(src, `Test id '${id}' missing`).toContain(`id: '${id}'`)
    }
    // Count id: entries in TEST_BATTERY block
    const idMatches = src.match(/id: '[\w]+'/g) || []
    expect(idMatches.length).toBeGreaterThanOrEqual(7)
  })

  it('LangCtx LABELS has minimum 40 translation keys', () => {
    const src = readFileSync(join(root, 'src/contexts/LangCtx.jsx'), 'utf-8')
    // Extract LABELS block — count keys by matching "word: '" or "word: `" patterns
    // Use a pattern that matches label key assignments
    const matches = src.match(/\b\w+:\s*['"`]/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(40)
  })

})
