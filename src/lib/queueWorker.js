// ─── src/lib/queueWorker.js — pure helpers for pgmq queue worker logic ────────

export const MAX_RETRIES  = 3
export const RETRY_DELAYS = [30, 120, 480]  // seconds; index = current retry_count

/**
 * Returns true if this message has exhausted its retry budget.
 * @param {number} retryCount - retry_count from message payload
 * @param {number} [maxRetries] - defaults to MAX_RETRIES
 * @returns {boolean}
 */
export function shouldMoveToDlq(retryCount, maxRetries = MAX_RETRIES) {
  return retryCount >= maxRetries
}

/**
 * Returns the VT delay in seconds for the next retry attempt.
 * Clamps to last RETRY_DELAYS entry for out-of-range retry_count.
 * @param {number} retryCount - current retry_count from payload (0-based)
 * @returns {number} delay in seconds
 */
export function getRetryDelay(retryCount) {
  if (retryCount < 0) return RETRY_DELAYS[0]
  if (retryCount >= RETRY_DELAYS.length) return RETRY_DELAYS[RETRY_DELAYS.length - 1]
  return RETRY_DELAYS[retryCount]
}

/**
 * Validates an ai_batch message payload structure.
 * @param {unknown} msg
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateAiBatchMessage(msg) {
  if (!msg || typeof msg !== 'object') return { valid: false, error: 'payload must be an object' }
  const m = /** @type {Record<string,unknown>} */ (msg)
  if (!m.coach_id || typeof m.coach_id !== 'string') {
    return { valid: false, error: 'coach_id missing or invalid' }
  }
  if (!m.week_start || typeof m.week_start !== 'string') {
    return { valid: false, error: 'week_start missing or invalid' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.week_start)) {
    return { valid: false, error: 'week_start must be YYYY-MM-DD' }
  }
  if (typeof m.retry_count !== 'number') {
    return { valid: false, error: 'retry_count must be a number' }
  }
  return { valid: true, error: null }
}

/**
 * Builds a new payload for re-enqueue with incremented retry_count.
 * @param {Record<string,unknown>} originalPayload - message.message from pgmq row
 * @param {string|null} [errorReason] - error description from the failed attempt
 * @returns {Record<string,unknown>} new payload with retry_count + 1
 */
export function buildRetryMessage(originalPayload, errorReason = null) {
  return {
    ...originalPayload,
    retry_count: (originalPayload.retry_count ?? 0) + 1,
    retried_at:  new Date().toISOString(),
    ...(errorReason !== null ? { last_error: errorReason } : {}),
  }
}
