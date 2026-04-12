// ─── src/lib/crypto.js — AES-GCM 256-bit message encryption ─────────────────
// Uses Web Crypto API (browser) or node:crypto.webcrypto (Node/Vitest).
// Key derivation: PBKDF2(orgId, 'sporeus-v1', 100_000, SHA-256) → AES-GCM 256.
// Ciphertext format: base64(<12-byte IV> || <ciphertext bytes>)

const SALT = new TextEncoder().encode('sporeus-v1')
const ITERATIONS = 100_000

// Resolve the crypto object once, handling both browser and Node environments.
let _crypto = null
async function getCrypto() {
  if (_crypto) return _crypto
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    _crypto = globalThis.crypto
  } else if (typeof window !== 'undefined' && window.crypto?.subtle) {
    _crypto = window.crypto
  } else {
    // Node 18+ — import webcrypto from built-in crypto module
    const { webcrypto } = await import('node:crypto')
    _crypto = webcrypto
  }
  return _crypto
}

async function deriveKey(orgId) {
  const wc = await getCrypto()
  const keyMaterial = await wc.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(orgId)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return wc.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a plaintext string using AES-GCM 256.
 * @param {string} plaintext
 * @param {string} orgId — organisation/coach id used as the passphrase
 * @returns {Promise<string>} — base64-encoded IV+ciphertext
 */
export async function encryptMessage(plaintext, orgId) {
  if (!plaintext) return ''
  const wc  = await getCrypto()
  const key = await deriveKey(orgId)
  const iv  = wc.getRandomValues(new Uint8Array(12))
  const enc = await wc.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  const combined = new Uint8Array(iv.byteLength + enc.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(enc), iv.byteLength)
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a base64-encoded AES-GCM ciphertext.
 * @param {string} ciphertext — base64 IV+ciphertext from encryptMessage
 * @param {string} orgId
 * @returns {Promise<string>} — plaintext, or '' on failure
 */
export async function decryptMessage(ciphertext, orgId) {
  if (!ciphertext) return ''
  try {
    const wc    = await getCrypto()
    const bytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
    const iv    = bytes.slice(0, 12)
    const data  = bytes.slice(12)
    const key   = await deriveKey(orgId)
    const plain = await wc.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(plain)
  } catch {
    return ''
  }
}
