// src/lib/realtime/presenceFormat.js
// E11 — Pure, bilingual presence helpers for CoachPresenceBadge.
// No side effects; no imports. All functions are deterministic for easy testing.

const LABELS = {
  en: {
    justNow:     'Viewing now',
    minAgo:      n => `${n} min ago`,
    hourAgo:     n => `${n} hour${n > 1 ? 's' : ''} ago`,
    today:       h => `Today at ${h}`,
    yesterday:   'Yesterday',
    daysAgo:     n => `${n} days ago`,
  },
  tr: {
    justNow:     'Şu an görüntülüyor',
    minAgo:      n => `${n} dk önce`,
    hourAgo:     n => `${n} saat önce`,
    today:       h => `Bugün ${h}`,
    yesterday:   'Dün',
    daysAgo:     n => `${n} gün önce`,
  },
}

/**
 * Human-readable label for a viewed_at timestamp.
 *
 * @param {Date|string|number} viewedAt — timestamp of the last view
 * @param {string} lang — 'en' | 'tr'
 * @param {Date} [now] — injectable for testing (default: new Date())
 * @returns {string}
 */
export function formatViewedAt(viewedAt, lang = 'en', now = new Date()) {
  if (!viewedAt) return ''
  const L   = LABELS[lang] ?? LABELS.en
  const ts  = viewedAt instanceof Date ? viewedAt : new Date(viewedAt)
  if (isNaN(ts)) return ''

  const diffMs  = now - ts
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr  = Math.floor(diffMs / 3_600_000)

  if (diffMin < 2)  return L.justNow
  if (diffMin < 60) return L.minAgo(diffMin)
  if (diffHr  < 24) return L.hourAgo(diffHr)

  // Same calendar day
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  if (ts >= todayStart) {
    const h = ts.toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      hour: '2-digit', minute: '2-digit',
    })
    return L.today(h)
  }

  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  if (ts >= yesterdayStart) return L.yesterday

  const diffDays = Math.floor(diffMs / 86_400_000)
  return L.daysAgo(diffDays)
}

/**
 * Categorise a viewed_at timestamp into a presence bucket.
 * Used to pick badge colour / urgency in CoachPresenceBadge.
 *
 * @param {Date|string|number} viewedAt
 * @param {Date} [now] — injectable for testing
 * @returns {'now' | 'recent' | 'today' | 'older' | 'never'}
 */
export function presenceBucket(viewedAt, now = new Date()) {
  if (!viewedAt) return 'never'
  const ts = viewedAt instanceof Date ? viewedAt : new Date(viewedAt)
  if (isNaN(ts)) return 'never'

  const diffMs  = now - ts
  const diffMin = diffMs / 60_000

  if (diffMin < 5)  return 'now'
  if (diffMin < 60) return 'recent'

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  if (ts >= todayStart) return 'today'

  return 'older'
}

/**
 * Format a list of present users for a presence indicator tooltip.
 * e.g. ["Alice", "Bob"] → "Alice and Bob are viewing"
 *
 * @param {string[]} names
 * @param {string} lang
 * @returns {string}
 */
export function formatPresenceList(names, lang = 'en') {
  if (!names.length) return ''
  const suffix = lang === 'tr' ? ' görüntülüyor' : ' viewing'
  if (names.length === 1) return `${names[0]}${suffix}`
  const last = names[names.length - 1]
  const rest = names.slice(0, -1).join(', ')
  const and  = lang === 'tr' ? ' ve ' : ' and '
  return `${rest}${and}${last}${suffix}`
}
