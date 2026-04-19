// src/lib/observability/performanceBudget.js
// E15 — Single source of truth for all performance budgets.
// Read by: scripts/checkBundleSize.js, ObservabilityDashboard.jsx, Lighthouse CI.

export const BUNDLE_BUDGETS = {
  mainBundleGzipMaxKB:  250,   // main entry chunk (index-*.js)
  perChunkGzipMaxKB:    500,   // any single lazy chunk
  totalGzipMaxKB:      2000,   // sum of all JS + CSS chunks
  cssGzipMaxKB:          80,
}

export const LIGHTHOUSE_BUDGETS = {
  performance:   85,
  accessibility: 90,
  bestPractices: 90,
  seo:           90,
  pwa:           85,
}

export const CWV_BUDGETS = {
  LCP_ms:  2500,
  INP_ms:   200,
  CLS:      0.1,
  FCP_ms: 1800,
  TTFB_ms:  800,
}
