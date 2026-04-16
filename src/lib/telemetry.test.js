import { it, expect, beforeEach, vi } from 'vitest'
import {
  trackEvent,
  getEventSummary,
  flushTelemetry,
  logError,
  getErrorLog,
} from './telemetry.js'

// ─── Mock localStorage ────────────────────────────────────────────────────────
const store = {}
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem:    (k)    => store[k] ?? null,
    setItem:    (k, v) => { store[k] = v },
    removeItem: (k)    => { delete store[k] },
  })
})

// ─── Test 1: trackEvent stores event in localStorage ─────────────────────────
it('trackEvent stores an event in localStorage', () => {
  trackEvent('navigation', 'tab_click', 'Training')
  const events = JSON.parse(store['sporeus-telemetry'] ?? '[]')
  expect(events).toHaveLength(1)
  expect(events[0].category).toBe('navigation')
  expect(events[0].action).toBe('tab_click')
  expect(events[0].label).toBe('Training')
  expect(typeof events[0].ts).toBe('string')
})

// ─── Test 2: buffer rolls over at MAX_EVENTS ──────────────────────────────────
it('buffer stays at MAX_EVENTS (100) after 101 events', () => {
  for (let i = 0; i < 101; i++) {
    trackEvent('test', `action_${i}`, '')
  }
  const events = JSON.parse(store['sporeus-telemetry'] ?? '[]')
  expect(events).toHaveLength(100)
  // The oldest (action_0) should have been dropped; newest should be action_100
  expect(events[99].action).toBe('action_100')
  expect(events.find(e => e.action === 'action_0')).toBeUndefined()
})

// ─── Test 3: getEventSummary returns correct counts per category ──────────────
it('getEventSummary returns correct per-category counts', () => {
  trackEvent('navigation', 'tab_click', 'Training')
  trackEvent('navigation', 'tab_click', 'Zones')
  trackEvent('form',       'submit',    'log_entry')
  const summary = getEventSummary()
  expect(summary.navigation).toBe(2)
  expect(summary.form).toBe(1)
  expect(summary.unknown).toBeUndefined()
})

// ─── Test 4: flushTelemetry returns all stored events ────────────────────────
it('flushTelemetry returns all stored events without clearing', () => {
  trackEvent('perf', 'tti', '320')
  trackEvent('perf', 'tti', '315')
  const events = flushTelemetry()
  expect(events).toHaveLength(2)
  expect(events[0].action).toBe('tti')
  // Buffer should still be intact after flush
  const still = JSON.parse(store['sporeus-telemetry'] ?? '[]')
  expect(still).toHaveLength(2)
})

// ─── Test 5: logError caps at 20 entries ─────────────────────────────────────
it('logError caps at MAX_ERRORS (20) entries', () => {
  for (let i = 0; i < 22; i++) {
    logError('TestTab', `Error number ${i}`, `stack_${i}`)
  }
  const errors = getErrorLog()
  expect(errors).toHaveLength(20)
  // Oldest two (0 and 1) should have been dropped; latest should be error 21
  expect(errors[19].error).toBe('Error number 21')
  expect(errors.find(e => e.error === 'Error number 0')).toBeUndefined()
})
