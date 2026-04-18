// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ConfirmModal from '../ui/ConfirmModal.jsx'

describe('ConfirmModal', () => {
  const onConfirm = vi.fn()
  const onCancel  = vi.fn()

  beforeEach(() => {
    onConfirm.mockClear()
    onCancel.mockClear()
  })

  it('renders nothing when open=false', () => {
    const { container } = render(
      <ConfirmModal open={false} title="Delete?" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title and default button labels when open=true', () => {
    render(
      <ConfirmModal open={true} title="Delete?" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    expect(screen.getByText('Delete?')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('renders body text when provided', () => {
    render(
      <ConfirmModal open={true} title="Delete?" body="This cannot be undone." onConfirm={onConfirm} onCancel={onCancel} />,
    )
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('uses custom button labels', () => {
    render(
      <ConfirmModal open={true} title="Delete?" confirmLabel="Delete" cancelLabel="No thanks" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('No thanks')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', () => {
    render(
      <ConfirmModal open={true} title="Delete?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByText('Delete'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when cancel button clicked', () => {
    render(
      <ConfirmModal open={true} title="Delete?" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel on Escape keydown', () => {
    render(
      <ConfirmModal open={true} title="Delete?" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm on Enter keydown', () => {
    render(
      <ConfirmModal open={true} title="Delete?" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when backdrop is clicked', () => {
    render(
      <ConfirmModal open={true} title="Delete?" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('applies red color to confirm button when dangerous=true', () => {
    render(
      <ConfirmModal open={true} title="Delete?" dangerous onConfirm={onConfirm} onCancel={onCancel} />,
    )
    const confirmBtn = screen.getByText('Confirm')
    expect(confirmBtn).toHaveStyle({ color: '#e03030' })
  })

  it('has role=dialog and aria-modal on the overlay', () => {
    render(
      <ConfirmModal open={true} title="Delete?" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('renders aria-labelledby pointing to the title', () => {
    render(
      <ConfirmModal open={true} title="Delete this?" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId)?.textContent).toBe('Delete this?')
  })
})
