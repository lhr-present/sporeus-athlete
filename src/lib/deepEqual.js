// ─── deepEqual.js — order-independent deep equality (no React, pure) ──────────
// Used for change detection in sync hooks. JSON.stringify(a) !== JSON.stringify(b)
// reports two objects with identical content but different key insertion order as
// "changed", firing spurious Supabase writes. deepEqual compares by value and is
// insensitive to object key order (arrays remain order-sensitive, as intended).

export function deepEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== 'object' || typeof b !== 'object') {
    // NaN === NaN should be treated as equal for change detection
    return a !== a && b !== b
  }

  const aIsArr = Array.isArray(a)
  const bIsArr = Array.isArray(b)
  if (aIsArr !== bIsArr) return false

  if (aIsArr) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  // Dates compare by time value
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }

  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false
    if (!deepEqual(a[k], b[k])) return false
  }
  return true
}
