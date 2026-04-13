// ─── AsyncBoundary.jsx — ErrorBoundary + Suspense in one wrapper ──────────────
// Replaces the repeated <ErrorBoundary><Suspense fallback={...}> pattern.
// Props:
//   name     — component/tab name (shown in error fallback)
//   fallback — custom loading fallback JSX (default: SkeletonCard)
//   children — content to render

import { Suspense } from 'react'
import ErrorBoundary from '../ErrorBoundary.jsx'
import SkeletonCard from './SkeletonCard.jsx'

export default function AsyncBoundary({ name, fallback, children }) {
  return (
    <ErrorBoundary name={name}>
      <Suspense fallback={fallback ?? <SkeletonCard />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}
