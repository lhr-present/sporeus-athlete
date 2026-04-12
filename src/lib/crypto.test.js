// ─── crypto.test.js — AES-GCM message encryption tests ──────────────────────
import { describe, it, expect } from 'vitest'
import { encryptMessage, decryptMessage } from './crypto.js'

// Web Crypto is available in Node 19+ / Vitest with jsdom; polyfill if needed
// Vitest runs in 'node' environment (per vite.config.js) — crypto is global in Node 15+

describe('encryptMessage / decryptMessage', () => {
  it('roundtrip: decrypt(encrypt(x)) === x', async () => {
    const orgId = 'coach-123'
    const plain = 'Hello, athlete! Your TSB is looking great today.'
    const cipher = await encryptMessage(plain, orgId)
    expect(cipher).not.toBe(plain)
    expect(cipher.length).toBeGreaterThan(0)
    const decoded = await decryptMessage(cipher, orgId)
    expect(decoded).toBe(plain)
  })

  it('different orgIds produce different ciphertext', async () => {
    const plain = 'Same message'
    const c1 = await encryptMessage(plain, 'org-A')
    const c2 = await encryptMessage(plain, 'org-B')
    expect(c1).not.toBe(c2)
    // org-B key cannot decrypt org-A ciphertext
    const decoded = await decryptMessage(c1, 'org-B')
    expect(decoded).toBe('')
  })

  it('empty string returns empty string without throwing', async () => {
    const orgId = 'any-org'
    const enc = await encryptMessage('', orgId)
    expect(enc).toBe('')
    const dec = await decryptMessage('', orgId)
    expect(dec).toBe('')
  })
})
