// src/lib/fetch.js — safe fetch wrapper with timeout + retry
// Use for all external HTTP calls in the browser (not Supabase SDK calls).

const DEFAULT_TIMEOUT_MS = 10_000

/**
 * fetch() with AbortController timeout and exponential-backoff retry.
 * @param {string} url
 * @param {RequestInit} [opts]
 * @param {{ retries?: number; timeoutMs?: number }} [cfg]
 */
export async function safeFetch(url, opts = {}, { retries = 2, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ctrl.signal, ...opts })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (err) {
      clearTimeout(timer)
      const isLast = attempt === retries
      if (isLast) throw err
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
}
