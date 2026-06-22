// src/lib/__tests__/swDenylist.test.js
// F2 — Guards the service-worker navigation denylist.
//
// sw.js imports workbox at module load (side effects), so we assert against the
// SOURCE TEXT rather than importing it. Workbox matches denylist regexes against
// `pathname + search` ONLY — the URL hash is excluded — so a /#access_token=/
// entry can never match and must NOT be present. The working search-based entries
// (?code=, ?error=, ?state=strava) must remain.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const swPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../sw.js')
const swSource = readFileSync(swPath, 'utf8')

const denylistLine = swSource
  .split('\n')
  .find(l => l.includes('const DENYLIST'))

describe('sw.js navigation denylist', () => {
  it('DENYLIST array does NOT contain the dead hash-based auth entry (#access_token=)', () => {
    // The hash can never match (Workbox uses pathname+search) — must not be a
    // denylist member. (A comment elsewhere in sw.js may reference it to warn
    // future maintainers; we only assert against the array line itself.)
    expect(denylistLine).toBeTruthy()
    expect(denylistLine).not.toMatch(/#access_token=/)
  })

  it('keeps the working search-based OAuth denylist entries', () => {
    expect(denylistLine).toBeTruthy()
    expect(denylistLine).toMatch(/\\\?code=/)
    expect(denylistLine).toMatch(/\\\?error=/)
    expect(denylistLine).toMatch(/\\\?state=strava/)
    expect(denylistLine).toMatch(/\^\\\/auth/)
  })
})
