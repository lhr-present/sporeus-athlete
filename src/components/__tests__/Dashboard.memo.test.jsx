// ─── Dashboard.memo.test.jsx — perf guard: Dashboard is React.memo-wrapped ───
// Dashboard is rendered with the App's 30s clock re-rendering its parent and
// (when stable callback props are passed) must not re-execute its body unless
// its props actually change. This guard fails if someone unwraps the memo().
import { describe, it, expect } from 'vitest'
import Dashboard from '../Dashboard.jsx'

describe('Dashboard memoization', () => {
  it('default export is wrapped in React.memo', () => {
    // React.memo objects carry a Symbol $$typeof of Symbol.for('react.memo').
    expect(Dashboard.$$typeof).toBe(Symbol.for('react.memo'))
    // The wrapped render fn is exposed on .type
    expect(typeof Dashboard.type).toBe('function')
  })
})
