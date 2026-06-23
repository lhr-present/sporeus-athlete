// src/lib/__tests__/dbVersionContract.test.js
//
// T4 — IndexedDB version + object-store CONTRACT between the two modules that
// open the SAME 'sporeus-offline' database.
//
//   • src/lib/db.js                — offline wellness queue (pending_logs)
//   • src/lib/offline/writeQueue.js — comment write queue + dead-letter
//
// IndexedDB allows only ONE version of a database at a time, and whichever module
// opens it FIRST at a new version runs the ONLY onupgradeneeded transaction.
// Therefore both modules MUST:
//   1. declare the SAME DB_NAME,
//   2. declare the SAME DB_VERSION, and
//   3. create the SAME set of object stores in onupgradeneeded.
//
// If a future edit bumps DB_VERSION in one file (e.g. to add a store) but not the
// other, the lower-version module that opens the DB first either (a) never creates
// the new store, or (b) the higher-version module throws VersionError — and in
// both cases the offline queue silently breaks and queued writes are dropped.
// There is no runtime test that catches this; this contract test does, statically.
//
// Approach: these constants are module-PRIVATE (not exported — exporting them
// would widen the public API purely for testing), so we read the source files
// off disk and parse the relevant declarations. No real IndexedDB is required.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_JS_PATH    = resolve(__dirname, '../db.js')                 // src/lib/db.js
const WRITEQ_JS_PATH = resolve(__dirname, '../offline/writeQueue.js') // src/lib/offline/writeQueue.js

// ── tiny source parsers (constant value + createObjectStore names) ──────────────

// Read `const NAME = <number>` or `const NAME = '<string>'` (ignores // comments).
function readConst(src, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*(?:'([^']*)'|"([^"]*)"|(\\d+))`)
  const m = src.match(re)
  if (!m) return undefined
  if (m[3] !== undefined) return Number(m[3])
  return m[1] !== undefined ? m[1] : m[2]
}

// Collect every object store created in onupgradeneeded:
//   db.createObjectStore(STORE, ...)  — STORE is a const reference; resolve it.
function readCreatedStores(src) {
  const names = new Set()
  const re = /createObjectStore\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g
  let m
  while ((m = re.exec(src)) !== null) {
    const constName = m[1]
    const value = readConst(src, constName)
    names.add(value !== undefined ? value : constName)
  }
  return names
}

describe('IndexedDB version contract (db.js ↔ writeQueue.js)', () => {
  let dbSrc, wqSrc
  beforeAll(() => {
    dbSrc = readFileSync(DB_JS_PATH, 'utf8')
    wqSrc = readFileSync(WRITEQ_JS_PATH, 'utf8')
  })

  it('both modules open the same DB_NAME', () => {
    const a = readConst(dbSrc, 'DB_NAME')
    const b = readConst(wqSrc, 'DB_NAME')
    expect(a, 'db.js must declare DB_NAME').toBeTruthy()
    expect(b, 'writeQueue.js must declare DB_NAME').toBeTruthy()
    expect(a).toBe(b)
    expect(a).toBe('sporeus-offline')
  })

  it('both modules declare the same DB_VERSION', () => {
    const a = readConst(dbSrc, 'DB_VERSION')
    const b = readConst(wqSrc, 'DB_VERSION')
    expect(typeof a, 'db.js DB_VERSION must be a number').toBe('number')
    expect(typeof b, 'writeQueue.js DB_VERSION must be a number').toBe('number')
    // The core invariant: a divergent version bump in one file fails CI here.
    expect(a).toBe(b)
  })

  it('both modules create the same set of object stores in onupgradeneeded', () => {
    const dbStores = readCreatedStores(dbSrc)
    const wqStores = readCreatedStores(wqSrc)

    // sanity: each side actually parsed some stores (guards a regex break)
    expect(dbStores.size, 'parsed at least one store from db.js').toBeGreaterThan(0)
    expect(wqStores.size, 'parsed at least one store from writeQueue.js').toBeGreaterThan(0)

    // The contract: identical store sets. Whichever module runs the single
    // upgrade transaction must create EVERY store the other expects.
    const dbSorted = [...dbStores].sort()
    const wqSorted = [...wqStores].sort()
    expect(dbSorted, 'db.js and writeQueue.js must create the SAME object stores').toEqual(wqSorted)

    // Pin the known stores so a silent removal also fails (not just divergence).
    expect(dbSorted).toEqual(['dead_letter', 'pending_logs', 'write_queue'])
  })
})
