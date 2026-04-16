// ─── logger.js — Structured logging with dev-only output + Sentry in prod ─────
import { captureException } from './sentry.js'

const isDev = import.meta.env.DEV

export const logger = Object.freeze({
  // In dev: console.error. In all envs: forward to Sentry (no-ops until initSentry resolves).
  error: (...args) => {
    if (isDev) console.error('[sporeus]', ...args)
    captureException(
      args[0] instanceof Error ? args[0] : new Error(String(args[0])),
      { extra: args.length > 1 ? String(args.slice(1)) : undefined },
    )
  },
  warn: isDev ? (...args) => console.warn('[sporeus]', ...args)  : () => {},
  info: isDev ? (...args) => console.log('[sporeus]', ...args)   : () => {},
})
