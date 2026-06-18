// ─── newId.js — stable unique id generator for log/history entries ───────────
//
// training_log.id (and injuries/test_results/race_results) are `uuid` on the
// server with a `gen_random_uuid()` default. Local entry creation historically
// used `Date.now()` (a NUMBER), which Postgres rejects on the uuid column
// (22P02 invalid_text_representation) — so every create-then-sync silently
// failed and training_log stayed at 0 rows. Generate a real UUID at creation
// time so the local id matches the server column type and the diff-by-id sync
// can upsert/update/delete cleanly.
//
// crypto.randomUUID is available in all modern browsers + Node 16+. The
// timestamp+random fallback exists only for ancient environments; it is NOT a
// valid uuid, so logEntryToRow omits it on write (DB default fills a real uuid).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * @returns {string} a v4 UUID when crypto.randomUUID is available, else a
 *   timestamp+random fallback string.
 */
export const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/**
 * @param {*} id
 * @returns {boolean} true when id is a canonical UUID string.
 */
export const isUuid = (id) => typeof id === 'string' && UUID_RE.test(id)
