// ─── announcementHelpers.js — Pure helpers for team announcements ──────────────

// ── validateAnnouncement ───────────────────────────────────────────────────────
// Returns { valid: true } if message is a non-empty string of 1–280 chars.
// Returns { valid: false, error: string } otherwise.
export function validateAnnouncement(message) {
  if (typeof message !== 'string' || message.length === 0) {
    return { valid: false, error: 'Message must be a non-empty string.' }
  }
  if (message.length > 280) {
    return { valid: false, error: 'Message exceeds 280 character limit.' }
  }
  return { valid: true }
}

// ── isUnread ───────────────────────────────────────────────────────────────────
// Returns true if athleteId is NOT in announcement.read_by array.
// Treats null/undefined/empty read_by as fully unread.
export function isUnread(announcement, athleteId) {
  const readBy = announcement?.read_by
  if (!readBy || readBy.length === 0) return true
  return !readBy.includes(athleteId)
}
