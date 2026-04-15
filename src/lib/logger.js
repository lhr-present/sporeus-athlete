// ─── logger.js — Structured logging with dev-only output ─────────────────────
const isDev = import.meta.env.DEV

export const logger = Object.freeze({
  error: isDev ? (...args) => console.error('[sporeus]', ...args) : () => {},
  warn:  isDev ? (...args) => console.warn('[sporeus]', ...args)  : () => {},
  info:  isDev ? (...args) => console.log('[sporeus]', ...args)   : () => {},
})
