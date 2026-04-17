// ─── realtimeStatus.js — Module-level realtime channel status registry ─────────
// Hooks call reportStatus(name, status) when their channel status changes.
// ConnectionBanner subscribes to see aggregate status without prop-drilling.

const _statuses = {}
const _listeners = new Set()

/**
 * Report a channel's current status. Called by realtime hooks.
 * @param {string} name   — unique channel identifier (e.g. 'squad-feed-{coachId}')
 * @param {string} status — 'connecting' | 'live' | 'reconnecting' | 'disconnected'
 */
export function reportStatus(name, status) {
  _statuses[name] = status
  const snapshot = { ..._statuses }
  _listeners.forEach(fn => fn(snapshot))
}

/**
 * Remove a channel entry (call on hook cleanup).
 * @param {string} name
 */
export function removeStatus(name) {
  delete _statuses[name]
  const snapshot = { ..._statuses }
  _listeners.forEach(fn => fn(snapshot))
}

/**
 * Subscribe to status changes. Returns an unsubscribe function.
 * @param {Function} fn — called with current statuses snapshot on every change
 * @returns {Function} unsubscribe
 */
export function subscribeToStatuses(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/** Snapshot of all current statuses. */
export function getStatuses() {
  return { ..._statuses }
}
