// src/lib/pushNotify.js — Web Push subscription management (Phase 3.4)
// VAPID public key set via VITE_VAPID_PUBLIC_KEY env var.
// Server sends pushes via supabase/functions/send-push edge function.

import { supabase, isSupabaseReady } from './supabase.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
  const padding   = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64    = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData   = atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function getPushState() {
  if (!isPushSupported()) return 'unsupported'
  const perm = Notification.permission
  if (perm === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : perm === 'granted' ? 'granted' : 'default'
}

export async function subscribePush(userId) {
  if (!isPushSupported()) throw new Error('Push not supported')
  if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY not set')

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Permission denied')

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const subJson = sub.toJSON()

  // Store subscription in Supabase if available
  if (isSupabaseReady() && userId) {
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id:  userId,
      endpoint: subJson.endpoint,
      keys:     subJson.keys,
    }, { onConflict: 'endpoint' })
    if (error) console.warn('Failed to save push subscription:', error.message)
  }

  return sub
}

export async function unsubscribePush(userId) {
  if (!isPushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return

  const endpoint = sub.endpoint
  await sub.unsubscribe()

  if (isSupabaseReady() && userId) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  }
}

// ── Rate limiter — max 2 local pushes per calendar day ────────────────────────
const PUSH_RATE_KEY = 'sporeus-push-rate'
const MAX_PUSHES_PER_DAY = 2

export function getPushRateState() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const raw   = localStorage.getItem(PUSH_RATE_KEY)
    if (!raw) return { date: today, count: 0 }
    const parsed = JSON.parse(raw)
    if (parsed.date !== today) return { date: today, count: 0 }
    return parsed
  } catch { return { date: new Date().toISOString().slice(0, 10), count: 0 } }
}

function incrementPushCount() {
  try {
    const state = getPushRateState()
    localStorage.setItem(PUSH_RATE_KEY, JSON.stringify({ date: state.date, count: state.count + 1 }))
  } catch {}
}

// Send a test/local notification (no server, uses SW directly).
// Rate-limited to MAX_PUSHES_PER_DAY per calendar day.
export async function sendLocalNotification(title, body, url = '/sporeus-athlete/') {
  if (!isPushSupported()) return
  if (Notification.permission !== 'granted') return

  const { count } = getPushRateState()
  if (count >= MAX_PUSHES_PER_DAY) return  // silently drop; rate exceeded

  const reg = await navigator.serviceWorker.ready
  reg.showNotification(title, {
    body,
    icon:    '/sporeus-athlete/pwa-192x192.png',
    badge:   '/sporeus-athlete/pwa-192x192.png',
    data:    { url },
    vibrate: [100, 50, 100],
    tag:     'sporeus-local',
  })
  incrementPushCount()
}

// ── scheduleCheckinReminder ────────────────────────────────────────────────────
// Saves the athlete's preferred check-in time to Supabase for server-side
// scheduling, then fires a local notification at the chosen hour today/tomorrow.
// preferredTime: 'HH:MM' 24h string (e.g. '07:30')
export async function scheduleCheckinReminder(userId, preferredTime = '07:00') {
  if (!userId) return { error: new Error('Not authenticated') }

  // Persist preference to Supabase for server-side scheduling
  if (isSupabaseReady()) {
    const [h, m] = preferredTime.split(':').map(Number)
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ checkin_hour: h, checkin_minute: m ?? 0 })
      .eq('user_id', userId)
    if (error) console.warn('scheduleCheckinReminder: Supabase update failed:', error.message)
  }

  // Fire a local notification at preferredTime (setTimeout)
  const [hStr, mStr] = preferredTime.split(':')
  const hour   = parseInt(hStr, 10)
  const minute = parseInt(mStr || '0', 10)

  const now  = new Date()
  const next = new Date(now)
  next.setHours(hour, minute, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)

  const delay = next.getTime() - now.getTime()
  setTimeout(() => {
    sendLocalNotification(
      'Sporeus — Daily Check-in',
      'How are you feeling today? Log your wellness in 30 seconds.',
      '/sporeus-athlete/'
    )
  }, delay)

  return { error: null, scheduledAt: next.toISOString() }
}

// ── Race countdown checker ─────────────────────────────────────────────────────
// Called on app load / daily. Checks race_results for upcoming races.
export async function checkRaceCountdowns() {
  if (Notification.permission !== 'granted') return
  try {
    const raw  = localStorage.getItem('sporeus-race-results') || '[]'
    const races = JSON.parse(raw)
    const today = new Date().toISOString().slice(0, 10)
    const notifiedKey = 'sporeus-race-notified'
    const notified = JSON.parse(localStorage.getItem(notifiedKey) || '{}')

    for (const race of races) {
      if (!race.date || race.date <= today) continue
      const daysLeft = Math.ceil((new Date(race.date) - new Date()) / 86400000)
      const key = `${race.date}-${daysLeft}`
      if (notified[key]) continue
      if (daysLeft === 7 || daysLeft === 1) {
        const label = race.type || race.distance || 'Race'
        await sendLocalNotification(
          daysLeft === 1 ? `◈ ${label} — RACE DAY TOMORROW` : `◈ ${label} — 7 days out`,
          daysLeft === 1
            ? 'Rest today. Stick to your routine. Trust your training.'
            : 'Final week. Taper in. Don\'t add anything new.',
          '/sporeus-athlete/'
        )
        notified[key] = true
        localStorage.setItem(notifiedKey, JSON.stringify(notified))
      }
    }
  } catch {}
}
