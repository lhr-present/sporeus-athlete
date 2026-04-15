// ─── pushNotifications.js — Local session reminder scheduling (v5.11.0) ──────
// Uses the Notifications API with setTimeout-based scheduling (no push server).
// scheduleSessionReminder fires at the user's chosen hour if permission granted.

import { logger } from './logger.js'

const REMINDER_KEY  = 'sporeus-reminder-enabled'
const HOUR_KEY      = 'sporeus-reminder-hour'
const TIMER_KEY     = 'sporeus-reminder-timer-id'  // used internally in this module
const DEFAULT_HOUR  = 7

let _timerId = null  // module-level timer so cancelReminder can clear it

// ─── Permission ────────────────────────────────────────────────────────────────

export async function requestPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function fmtSessionList(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return ''
  const names = sessions.slice(0, 3).map(s => s.type || s.name || 'Session')
  const extra = sessions.length > 3 ? ` +${sessions.length - 3} more` : ''
  return names.join(', ') + extra
}

function msUntilHour(hour) {
  const now  = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

// ─── Scheduling ────────────────────────────────────────────────────────────────

export function scheduleSessionReminder({ hour = DEFAULT_HOUR, sessions = [] } = {}) {
  cancelReminder()
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return

  const delay = msUntilHour(hour)
  _timerId = setTimeout(() => {
    const title = 'Sporeus Athlete — Training Reminder'
    const body  = sessions.length > 0
      ? `Today: ${fmtSessionList(sessions)}`
      : 'Time to log your training session.'

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon:    '/sporeus-athlete/icons/icon-192x192.png',
          badge:   '/sporeus-athlete/icons/icon-72x72.png',
          tag:     'sporeus-reminder',
          vibrate: [100, 50, 100],
        })
      }).catch(() => {
        // Fallback: plain Notification if SW not available
        try { new Notification(title, { body }) } catch (e) { logger.warn('notification:', e.message) }
      })
    } else {
      try { new Notification(title, { body }) } catch (e) { logger.warn('notification:', e.message) }
    }

    // Reschedule for next day
    scheduleSessionReminder({ hour, sessions })
  }, delay)
}

export function cancelReminder() {
  if (_timerId !== null) {
    clearTimeout(_timerId)
    _timerId = null
  }
}

// ─── Persistence helpers ───────────────────────────────────────────────────────

export function getReminderSettings() {
  return {
    enabled: localStorage.getItem(REMINDER_KEY) === '1',
    hour:    parseInt(localStorage.getItem(HOUR_KEY) || String(DEFAULT_HOUR), 10),
  }
}

export function saveReminderSettings({ enabled, hour }) {
  try {
    localStorage.setItem(REMINDER_KEY, enabled ? '1' : '0')
    localStorage.setItem(HOUR_KEY, String(hour))
  } catch (e) { logger.warn('localStorage:', e.message) }
}
