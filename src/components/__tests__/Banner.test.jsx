// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import Banner from '../ui/Banner.jsx'

beforeEach(() => {
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('sporeus-')) localStorage.removeItem(k)
  })
})

describe('Banner', () => {
  it('renders title + children', () => {
    render(
      <Banner severity="warning" title="TEST TITLE">
        body content
      </Banner>
    )
    expect(screen.getByText(/TEST TITLE/)).toBeInTheDocument()
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('uses default icon for severity', () => {
    render(<Banner severity="critical" title="X">body</Banner>)
    expect(screen.getByText(/⚠ X/)).toBeInTheDocument()
  })

  it('respects custom icon override', () => {
    render(<Banner severity="warning" icon="◇" title="X">body</Banner>)
    expect(screen.getByText(/◇ X/)).toBeInTheDocument()
  })

  it('renders subtitle when present', () => {
    render(<Banner severity="info" title="X" subtitle="· 5.2%">body</Banner>)
    expect(screen.getByText('· 5.2%')).toBeInTheDocument()
  })

  it('uses role=alert for critical severity', () => {
    const { container } = render(<Banner severity="critical" title="X">body</Banner>)
    expect(container.querySelector('[role=alert]')).toBeInTheDocument()
  })

  it('uses role=status for non-critical severity', () => {
    const { container } = render(<Banner severity="warning" title="X">body</Banner>)
    expect(container.querySelector('[role=status]')).toBeInTheDocument()
  })

  it('omits snooze button when snoozeKey is absent', () => {
    render(<Banner severity="warning" title="X">body</Banner>)
    expect(screen.queryByRole('button', { name: /snooze/i })).not.toBeInTheDocument()
  })

  it('renders snooze button when snoozeKey is provided', () => {
    render(<Banner severity="warning" title="X" snoozeKey="test-slot">body</Banner>)
    const btn = screen.getByRole('button', { name: /snooze/i })
    expect(btn).toBeInTheDocument()
  })

  it('snooze click writes to localStorage and fires onSnooze callback', () => {
    const onSnooze = vi.fn()
    render(<Banner severity="warning" title="X" snoozeKey="test-slot" onSnooze={onSnooze}>body</Banner>)
    fireEvent.click(screen.getByRole('button', { name: /snooze/i }))
    expect(onSnooze).toHaveBeenCalledOnce()
    expect(localStorage.getItem('sporeus-banner-snooze-test-slot')).toBeTruthy()
  })

  it('renders actions slot when provided', () => {
    render(
      <Banner severity="critical" title="X" actions={<button>CLICK ME</button>}>
        body
      </Banner>
    )
    expect(screen.getByRole('button', { name: 'CLICK ME' })).toBeInTheDocument()
  })

  it('citation renders collapsed by default', () => {
    render(
      <Banner severity="warning" title="X" citation="Banister 1991">
        body
      </Banner>
    )
    expect(screen.getByText(/\? Why/)).toBeInTheDocument()
    expect(screen.queryByText('Banister 1991')).not.toBeInTheDocument()
  })

  it('uses Turkish aria-label for snooze when lang=tr', () => {
    render(<Banner severity="warning" title="X" snoozeKey="t" lang="tr">body</Banner>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/7 gün ertele/))
  })
})
