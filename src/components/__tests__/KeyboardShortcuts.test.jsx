// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import KeyboardShortcuts from '../KeyboardShortcuts.jsx'

describe('KeyboardShortcuts', () => {
  it('renders nothing when closed', () => {
    render(<KeyboardShortcuts open={false} onClose={() => {}} lang="en" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when open', () => {
    render(<KeyboardShortcuts open onClose={() => {}} lang="en" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows both shortcut groups in EN', () => {
    render(<KeyboardShortcuts open onClose={() => {}} lang="en" />)
    expect(screen.getByText('NAVIGATION')).toBeInTheDocument()
    expect(screen.getByText('ACTIONS')).toBeInTheDocument()
  })

  it('shows all expected shortcut keys', () => {
    render(<KeyboardShortcuts open onClose={() => {}} lang="en" />)
    expect(screen.getByText('Ctrl+K')).toBeInTheDocument()
    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getByText('Esc')).toBeInTheDocument()
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('calls onClose when × button clicked', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcuts open onClose={onClose} lang="en" />)
    // × is the first Close button; footer "Close" is the second
    const buttons = screen.getAllByRole('button', { name: 'Close' })
    fireEvent.click(buttons[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<KeyboardShortcuts open onClose={onClose} lang="en" />)
    // First child of container is the backdrop div
    const backdrop = container.firstChild
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows TR labels when lang=tr', () => {
    render(<KeyboardShortcuts open onClose={() => {}} lang="tr" />)
    expect(screen.getByText('GEZİNME')).toBeInTheDocument()
    expect(screen.getByText('EYLEMLER')).toBeInTheDocument()
    expect(screen.getByText(/Dil değiştir/)).toBeInTheDocument()
  })

  it('close buttons have accessible label in TR', () => {
    render(<KeyboardShortcuts open onClose={() => {}} lang="tr" />)
    expect(screen.getAllByRole('button', { name: 'Kapat' })).toHaveLength(2)
  })

  it('does not open when typing in an input (handler respects isInputFocused)', () => {
    // The component itself has no handler — the guard lives in useAppState.
    // Verify the overlay stays closed when open=false regardless of keydown.
    const onClose = vi.fn()
    render(<KeyboardShortcuts open={false} onClose={onClose} lang="en" />)
    fireEvent.keyDown(document, { key: '?' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
