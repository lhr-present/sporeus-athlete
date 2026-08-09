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

describe('fingerprint-aware snooze (v9.501 — escalation re-fires the banner)', () => {
  it('snoozing without a fingerprint behaves exactly as before (backward compat)', () => {
    snoozeBanner('strava-sync', NOW)
    expect(isBannerSnoozed('strava-sync', NOW + 1000)).toBe(true)
  })
  it('same fingerprint stays snoozed within the window', () => {
    snoozeBanner('strava-sync', NOW, 'stale|')
    expect(isBannerSnoozed('strava-sync', NOW + 1000, 'stale|')).toBe(true)
  })
  it('a DIFFERENT fingerprint (condition escalated) is NOT considered snoozed, even mid-window', () => {
    snoozeBanner('strava-sync', NOW, 'stale|')
    // Same slot, well within the 7-day TTL, but the underlying condition
    // got worse — this must re-fire, not wait out the original 7 days.
    expect(isBannerSnoozed('strava-sync', NOW + 1000, 'failing|Strava authorization rejected — please reconnect Strava')).toBe(false)
  })
  it('checking WITHOUT a fingerprint after a fingerprinted snooze still honors the TTL', () => {
    snoozeBanner('strava-sync', NOW, 'stale|')
    // A caller that doesn't care about fingerprints (fingerprint arg omitted)
    // just gets normal TTL behavior.
    expect(isBannerSnoozed('strava-sync', NOW + 1000)).toBe(true)
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
