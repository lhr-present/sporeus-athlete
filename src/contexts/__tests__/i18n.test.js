// i18n parity tests — every EN key must have a TR value; no orphan TR keys
// Run as part of vitest suite. Fails CI if any translation gap is introduced.
import { describe, it, expect } from 'vitest'
import { LABELS } from '../LangCtx.jsx'

const EN = LABELS.en
const TR = LABELS.tr

// Keys that are intentionally null in BOTH locales (design choice):
const INTENTIONAL_NULL = new Set(['status_outage', 'status_degraded'])

describe('i18n parity — LABELS', () => {
  it('EN and TR have the same set of keys', () => {
    const enKeys = Object.keys(EN).sort()
    const trKeys = Object.keys(TR).sort()
    const missingInTR = enKeys.filter(k => !trKeys.includes(k))
    const orphanInTR  = trKeys.filter(k => !enKeys.includes(k))
    expect(missingInTR, `Keys present in EN but missing from TR: ${missingInTR.join(', ')}`).toHaveLength(0)
    expect(orphanInTR,  `Keys present in TR but missing from EN: ${orphanInTR.join(', ')}`).toHaveLength(0)
  })

  it('every EN key with a non-null value has a TR translation', () => {
    // Technical terms that legitimately stay identical across EN/TR:
    // acronyms (TSB, CTL, CSV), universal units (KM), short symbol strings
    const ALLOWED_IDENTICAL = new Set([
      'tsbLabel',       // 'FORM (TSB)' — TSB is a technical acronym
      'squadColTSB',    // 'TSB'
      'pacingKm',       // 'KM' — universal SI unit
      'spb_exportCSV',  // '↓ CSV' — CSV universal
      't_plan',         // '⚡ PLAN' — PLAN used in Turkish
    ])
    const gaps = []
    for (const [key, enVal] of Object.entries(EN)) {
      if (INTENTIONAL_NULL.has(key)) continue
      if (ALLOWED_IDENTICAL.has(key)) continue
      if (enVal === null) continue     // intentionally null in EN too
      const trVal = TR[key]
      if (trVal === null || trVal === undefined || trVal === enVal) {
        // Allow pure symbol/digit strings (arrows, numbers) that are universal
        if (typeof enVal === 'string' && /^[\d\W\s]+$/.test(enVal)) continue
        gaps.push(key)
      }
    }
    expect(gaps, `TR translations identical to EN (untranslated): ${gaps.join(', ')}`).toHaveLength(0)
  })

  it('no null TR values except intentionally null keys', () => {
    const nullKeys = Object.entries(TR)
      .filter(([k, v]) => v === null && !INTENTIONAL_NULL.has(k))
      .map(([k]) => k)
    expect(nullKeys, `Unexpected null in TR: ${nullKeys.join(', ')}`).toHaveLength(0)
  })

  it('intentionally null keys are null in both EN and TR', () => {
    for (const key of INTENTIONAL_NULL) {
      expect(EN[key], `${key} should be null in EN`).toBeNull()
      expect(TR[key], `${key} should be null in TR`).toBeNull()
    }
  })
})

describe('i18n — Turkish locale spot checks (C7)', () => {
  it('todayConsec is translated (was missing in TR before C7)', () => {
    expect(TR.todayConsec).toBeTruthy()
    expect(TR.todayConsec).not.toBe(EN.todayConsec)
  })

  it('SemanticSearch keys exist in both EN and TR', () => {
    const ssKeys = ['ssPlaceholder','ssSearching','ssUpgradeMsg','ssRetry',
                    'ssNoResults','ssMinChars','ssIdleTitle','ssIdleCorpus',
                    'ssNavHint','ssJumpHint','ssEscHint',
                    'ssExample1','ssExample2','ssExample3','ssExample4']
    for (const k of ssKeys) {
      expect(EN[k], `EN.${k} should exist`).toBeTruthy()
      expect(TR[k], `TR.${k} should exist`).toBeTruthy()
    }
  })

  it('LiveSquadFeed keys exist in both EN and TR', () => {
    const feedKeys = ['feedSquadLabel','feedNoAthletes','feedNoActivity','feedConnecting','feedOnline']
    for (const k of feedKeys) {
      expect(EN[k], `EN.${k} should exist`).toBeTruthy()
      expect(TR[k], `TR.${k} should exist`).toBeTruthy()
    }
  })

  it('TR examples are in Turkish (not identical to EN examples)', () => {
    for (let i = 1; i <= 4; i++) {
      expect(TR[`ssExample${i}`]).not.toBe(EN[`ssExample${i}`])
    }
  })
})
