// src/lib/sentry.js — backward-compat shim; delegates to observability/sentry.js
// All logic lives in observability/sentry.js. This shim keeps existing imports working.
export {
  initSentry,
  captureError,
  captureException,   // alias used by ErrorBoundary.jsx
  setUserContext,
  setUser,
  clearUser,
  addBreadcrumb,
} from './observability/sentry.js'

export { scrubPII as scrubData } from './observability/piiScrubber.js'
