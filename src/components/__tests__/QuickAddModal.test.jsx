// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'
import QuickAddModal from '../QuickAddModal.jsx'

vi.mock('../../lib/notificationCenter.js', () => ({ addNotification: vi.fn() }))
vi.mock('../../hooks/useFocusTrap.js', () => ({ useFocusTrap: vi.fn() }))
vi.mock('../../contexts/DataContext.jsx', () => ({ useData: () => ({ log: [] }) }))

const defaultProps = {
  onAdd: vi.fn(),
  onClose: vi.fn(),
  profile: { sport: 'Running' },
  isFirst: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QuickAddModal — defaults', () => {
  it('defaults duration to 45 minutes', () => {
    renderWithLang(<QuickAddModal {...defaultProps} />)
    expect(screen.getByDisplayValue('45')).toBeInTheDocument()
  })

  it('defaults type to Easy Run for Running profile', () => {
    renderWithLang(<QuickAddModal {...defaultProps} profile={{ sport: 'Running' }} />)
    expect(screen.getByDisplayValue('Easy Run')).toBeInTheDocument()
  })

  it('defaults type to Easy Ride for Cycling profile', () => {
    renderWithLang(<QuickAddModal {...defaultProps} profile={{ sport: 'Cycling' }} />)
    expect(screen.getByDisplayValue('Easy Ride')).toBeInTheDocument()
  })

  it('defaults type to Easy Swim for Swimming profile', () => {
    renderWithLang(<QuickAddModal {...defaultProps} profile={{ sport: 'Swimming' }} />)
    expect(screen.getByDisplayValue('Easy Swim')).toBeInTheDocument()
  })

  it('defaults type to Easy Run when profile sport is unrecognised', () => {
    renderWithLang(<QuickAddModal {...defaultProps} profile={{ sport: 'Fencing' }} />)
    expect(screen.getByDisplayValue('Easy Run')).toBeInTheDocument()
  })

  it('defaults type to Easy Run when no profile provided', () => {
    renderWithLang(<QuickAddModal {...defaultProps} profile={null} />)
    expect(screen.getByDisplayValue('Easy Run')).toBeInTheDocument()
  })
})

describe('QuickAddModal — TSS label', () => {
  it('shows "Training Load" label, not "Est. TSS"', () => {
    renderWithLang(<QuickAddModal {...defaultProps} />)
    expect(screen.queryByText(/Est\. TSS/i)).not.toBeInTheDocument()
    expect(screen.getByText('Training Load')).toBeInTheDocument()
  })

  it('shows TSS acronym alongside Training Load label', () => {
    renderWithLang(<QuickAddModal {...defaultProps} />)
    expect(screen.getByText('(TSS)')).toBeInTheDocument()
  })

  it('shows Foster 2001 citation in the training load preview', () => {
    renderWithLang(<QuickAddModal {...defaultProps} />)
    expect(screen.getByText(/Foster 2001/)).toBeInTheDocument()
  })
})

describe('QuickAddModal — RPE effort labels', () => {
  it('shows "Easy — aerobic base building" for RPE 4', () => {
    renderWithLang(<QuickAddModal {...defaultProps} />)
    // RPE tap buttons — find the button whose text content is exactly '4'
    const allButtons = screen.getAllByRole('button')
    const btn4 = allButtons.find(b => b.textContent.trim() === '4')
    fireEvent.click(btn4)
    expect(screen.getByText(/aerobic base building/i)).toBeInTheDocument()
  })

  it('shows "Hard — threshold effort" for RPE 8', () => {
    renderWithLang(<QuickAddModal {...defaultProps} />)
    const allButtons = screen.getAllByRole('button')
    const btn8 = allButtons.find(b => b.textContent.trim() === '8')
    fireEvent.click(btn8)
    expect(screen.getByText(/threshold effort/i)).toBeInTheDocument()
  })
})

describe('QuickAddModal — validation', () => {
  it('save button disabled when duration is 0', () => {
    renderWithLang(<QuickAddModal {...defaultProps} />)
    const durInput = screen.getByPlaceholderText('45')
    fireEvent.change(durInput, { target: { value: '0' } })
    const submitBtn = document.querySelector('button[type="submit"]')
    expect(submitBtn).toBeDisabled()
  })

  it('does not call onAdd when duration is empty', () => {
    const onAdd = vi.fn()
    renderWithLang(<QuickAddModal {...defaultProps} onAdd={onAdd} />)
    fireEvent.change(screen.getByPlaceholderText('45'), { target: { value: '' } })
    fireEvent.submit(document.querySelector('form'))
    expect(onAdd).not.toHaveBeenCalled()
  })
})

describe('QuickAddModal — submission', () => {
  it('calls onAdd with correct entry shape', () => {
    const onAdd = vi.fn()
    renderWithLang(<QuickAddModal {...defaultProps} onAdd={onAdd} />)
    fireEvent.submit(document.querySelector('form'))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      type: 'Easy Run',
      duration: 45,
      durationSec: 2700,
      rpe: 6,
      tss: expect.any(Number),
    }))
  })

  it('shows saved confirmation phase after submit', async () => {
    vi.useFakeTimers()
    const onAdd = vi.fn()
    renderWithLang(<QuickAddModal {...defaultProps} onAdd={onAdd} />)
    act(() => { fireEvent.submit(document.querySelector('form')) })
    expect(screen.getByText(/session logged|antrenman kaydedildi/i)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows first-session celebration when isFirst=true', async () => {
    vi.useFakeTimers()
    renderWithLang(<QuickAddModal {...defaultProps} isFirst={true} onAdd={vi.fn()} />)
    act(() => { fireEvent.submit(document.querySelector('form')) })
    expect(screen.getByText(/first step done|ilk adım/i)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('does NOT show first-session message when isFirst=false', async () => {
    vi.useFakeTimers()
    renderWithLang(<QuickAddModal {...defaultProps} isFirst={false} onAdd={vi.fn()} />)
    act(() => { fireEvent.submit(document.querySelector('form')) })
    expect(screen.queryByText(/first step done|ilk adım/i)).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('QuickAddModal — close behaviour', () => {
  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    renderWithLang(<QuickAddModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
