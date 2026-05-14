// @vitest-environment jsdom
// v9.126.0 — Banner snooze tests.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  isBannerSnoozed,
  snoozeBanner,
  clearBannerSnooze,
  BANNER_SNOOZE_TTL_MS,
} from '../../athlete/bannerSnooze.js'

const NOW = 1747200000000  // arbitrary fixed epoch ms

beforeEach(() => {
  localStorage.clear()
})

describe('isBannerSnoozed', () => {
  it('returns false when no snooze is set', () => {
    expect(isBannerSnoozed('decoupling', NOW)).toBe(false)
  })
  it('returns false for empty / null slot', () => {
    expect(isBannerSnoozed('', NOW)).toBe(false)
    expect(isBannerSnoozed(null, NOW)).toBe(false)
  })
  it('returns true immediately after snoozing', () => {
    snoozeBanner('decoupling', NOW)
    expect(isBannerSnoozed('decoupling', NOW)).toBe(true)
  })
  it('returns true within the 7-day window', () => {
    snoozeBanner('decoupling', NOW)
    expect(isBannerSnoozed('decoupling', NOW + BANNER_SNOOZE_TTL_MS - 1)).toBe(true)
  })
  it('returns false after the 7-day window expires', () => {
    snoozeBanner('decoupling', NOW)
    expect(isBannerSnoozed('decoupling', NOW + BANNER_SNOOZE_TTL_MS + 1)).toBe(false)
  })
  it('isolates by slot', () => {
    snoozeBanner('decoupling', NOW)
    expect(isBannerSnoozed('polarized', NOW)).toBe(false)
  })
  it('tolerates malformed localStorage entries', () => {
    localStorage.setItem('sporeus-banner-snooze-decoupling', 'not json')
    expect(isBannerSnoozed('decoupling', NOW)).toBe(false)
  })
})

describe('snoozeBanner', () => {
  it('persists across calls', () => {
    snoozeBanner('decoupling', NOW)
    expect(isBannerSnoozed('decoupling', NOW + 1000)).toBe(true)
  })
  it('idempotent — re-snoozing resets the timer', () => {
    snoozeBanner('decoupling', NOW)
    // Just before expiry, re-snooze
    snoozeBanner('decoupling', NOW + BANNER_SNOOZE_TTL_MS - 1000)
    // The original expiry has passed, but the re-snooze extends
    expect(isBannerSnoozed('decoupling', NOW + BANNER_SNOOZE_TTL_MS + 500)).toBe(true)
  })
  it('no-op for empty slot', () => {
    snoozeBanner('', NOW)
    expect(localStorage.length).toBe(0)
  })
})

describe('clearBannerSnooze', () => {
  it('removes the snooze', () => {
    snoozeBanner('decoupling', NOW)
    clearBannerSnooze('decoupling')
    expect(isBannerSnoozed('decoupling', NOW)).toBe(false)
  })
  it('no-op for unset slot', () => {
    expect(() => clearBannerSnooze('never-set')).not.toThrow()
  })
})
