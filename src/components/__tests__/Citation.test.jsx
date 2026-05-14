// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import Citation from '../ui/Citation.jsx'

const PREF_KEY = 'sporeus-citations-preferred'

beforeEach(() => {
  try { localStorage.removeItem(PREF_KEY) } catch { /* */ }
})

describe('Citation', () => {
  it('renders null when text is empty', () => {
    const { container } = render(<Citation text="" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when text is undefined', () => {
    const { container } = render(<Citation />)
    expect(container.firstChild).toBeNull()
  })

  it('starts collapsed by default — shows "? Why" button only', () => {
    render(<Citation text="Banister 1991 (acute load model)" />)
    expect(screen.getByText(/\? Why/)).toBeInTheDocument()
    expect(screen.queryByText(/Banister 1991/)).not.toBeInTheDocument()
  })

  it('expands when clicked', () => {
    render(<Citation text="Bompa 2018" />)
    fireEvent.click(screen.getByText(/\? Why/))
    expect(screen.getByText('Bompa 2018')).toBeInTheDocument()
  })

  it('persists expansion preference to localStorage', () => {
    render(<Citation text="Mujika 2003" />)
    fireEvent.click(screen.getByText(/\? Why/))
    expect(localStorage.getItem(PREF_KEY)).toBe('expanded')
  })

  it('respects pre-existing preferred=expanded on mount', () => {
    localStorage.setItem(PREF_KEY, 'expanded')
    render(<Citation text="Bosquet 2007" />)
    expect(screen.getByText('Bosquet 2007')).toBeInTheDocument()
    expect(screen.queryByText(/\? Why/)).not.toBeInTheDocument()
  })

  it('aria-expanded is "false" when collapsed', () => {
    render(<Citation text="Plews 2013" />)
    const btn = screen.getByRole('button', { name: /show citation/i })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })
})
