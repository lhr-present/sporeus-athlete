// src/components/ErrorBoundaryTelemetry.jsx
// E15 — Drop-in replacement for ErrorBoundary with enhanced Sentry telemetry.
// Same props, same fallback UI. Adds addBreadcrumb before re-mount attempts.
// Usage: <ErrorBoundaryTelemetry name="TabName"> identical to <ErrorBoundary name="TabName">

import ErrorBoundary from './ErrorBoundary.jsx'
import { addBreadcrumb } from '../lib/observability/sentry.js'

export default class ErrorBoundaryTelemetry extends ErrorBoundary {
  componentDidCatch(error, info) {
    const boundaryName = this.props.name || this.props.tabName || 'unknown'
    // Breadcrumb lands before captureException so the timeline is correct in Sentry
    addBreadcrumb('error_boundary_caught', 'lifecycle', { boundary: boundaryName })
    // Delegate to parent — which calls captureException (now PII-scrubbed via sentry shim)
    super.componentDidCatch(error, info)
  }
}
