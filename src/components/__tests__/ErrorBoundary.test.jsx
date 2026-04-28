// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ErrorBoundary from '../ErrorBoundary.jsx'

vi.mock('../../lib/storage.js', () => ({ exportAllData: vi.fn(() => '{}') }))
vi.mock('../../lib/logger.js',  () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function Thrower() {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>healthy child</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('healthy child')).toBeInTheDocument()
  })

  it('shows error UI when a child throws', () => {
    render(
      <ErrorBoundary tabName="tests">
        <Thrower />
      </ErrorBoundary>
    )
    // Full-page error UI includes tabName in the heading
    expect(screen.getByText(/ERROR IN TESTS/i)).toBeInTheDocument()
  })

  it('shows the error message from the thrown error', () => {
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>
    )
    expect(screen.getByText(/boom/i)).toBeInTheDocument()
  })

  it('shows Retry button in error state', () => {
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>
    )
    expect(screen.getByText(/Retry/i)).toBeInTheDocument()
  })

  it('inline mode shows compact error with Retry', () => {
    render(
      <ErrorBoundary inline name="PowerCurve">
        <Thrower />
      </ErrorBoundary>
    )
    expect(screen.getByText(/POWERCURVE ERROR/i)).toBeInTheDocument()
    expect(screen.getByText(/Retry/i)).toBeInTheDocument()
  })
})
