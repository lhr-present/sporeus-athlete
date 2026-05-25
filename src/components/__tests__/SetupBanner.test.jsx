// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import SetupBanner from '../SetupBanner.jsx'

describe('SetupBanner', () => {
  it('renders nothing when sport is set', () => {
    const { container } = render(
      <SetupBanner profile={{ sport: 'Running' }} lang="en" onPickSport={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when primarySport is set (legacy field)', () => {
    const { container } = render(
      <SetupBanner profile={{ primarySport: 'Cycling' }} lang="en" onPickSport={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders banner when sport is null', () => {
    render(<SetupBanner profile={{}} lang="en" onPickSport={() => {}} />)
    expect(screen.getByText(/FINISH SETUP/i)).toBeInTheDocument()
    expect(screen.getByText(/pick your sport/i)).toBeInTheDocument()
  })

  it('renders Turkish copy when lang=tr', () => {
    render(<SetupBanner profile={{}} lang="tr" onPickSport={() => {}} />)
    expect(screen.getByText(/KURULUMU TAMAMLA/i)).toBeInTheDocument()
    expect(screen.getByText(/SPORU SEÇ/i)).toBeInTheDocument()
  })

  it('calls onPickSport when CTA clicked', () => {
    const onPickSport = vi.fn()
    render(<SetupBanner profile={{}} lang="en" onPickSport={onPickSport} />)
    fireEvent.click(screen.getByRole('button', { name: /PICK SPORT/i }))
    expect(onPickSport).toHaveBeenCalledTimes(1)
  })

  it('renders even when profile is null/undefined', () => {
    render(<SetupBanner profile={null} lang="en" onPickSport={() => {}} />)
    expect(screen.getByText(/FINISH SETUP/i)).toBeInTheDocument()
  })

  it('has role=alert for accessibility', () => {
    render(<SetupBanner profile={{}} lang="en" onPickSport={() => {}} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
