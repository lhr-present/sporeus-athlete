// ─── telegramHelpers.js — Telegram notification payload helpers ────────────────

const VALID_TELEGRAM_TYPES = ['check_in_reminder', 'coach_alert', 'weekly_digest']

// ── buildTelegramPayload ───────────────────────────────────────────────────────
// Returns { chat_id, text, parse_mode: 'HTML' }, or null if chatId or message is falsy.
export function buildTelegramPayload(chatId, message, type) {
  if (!chatId || !message) return null
  return {
    chat_id:    chatId,
    text:       message,
    parse_mode: 'HTML',
  }
}

// ── validateTelegramType ───────────────────────────────────────────────────────
// Returns true if type is one of the allowed Telegram notification types.
export function validateTelegramType(type) {
  return VALID_TELEGRAM_TYPES.includes(type)
}

// ── shouldSendTelegram ────────────────────────────────────────────────────────
// Returns true if pushSubscription has a telegram_chat_id AND dailyCount < maxPerDay.
export function shouldSendTelegram(pushSubscription, dailyCount, maxPerDay = 2) {
  if (!pushSubscription?.telegram_chat_id) return false
  return dailyCount < maxPerDay
}
