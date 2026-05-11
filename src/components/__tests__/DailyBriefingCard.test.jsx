// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DailyBriefingCard from '../dashboard/DailyBriefingCard.jsx'

describe('DailyBriefingCard — v9.68.0 empty-log mission placeholder', () => {
  const profile = { name: 'Test', sport: 'running', maxhr: 180, age: 30 }

  it('renders mission-framed placeholder when log is empty (EN)', () => {
    render(<DailyBriefingCard profile={profile} log={[]} isTR={false} />)
    expect(screen.getByText('◈ DAILY BRIEFING')).toBeTruthy()
    expect(
      screen.getByText(/target → physiology → plan → daily answer/i)
    ).toBeTruthy()
  })

  it('renders mission-framed placeholder when log is empty (TR)', () => {
    render(<DailyBriefingCard profile={profile} log={[]} isTR={true} />)
    expect(screen.getByText('◈ GÜNLÜK REÇETE')).toBeTruthy()
    expect(
      screen.getByText(/hedef → fizyoloji → plan → günlük cevap/i)
    ).toBeTruthy()
  })

  it('renders placeholder when log is undefined', () => {
    render(<DailyBriefingCard profile={profile} log={undefined} isTR={false} />)
    expect(screen.getByText('◈ DAILY BRIEFING')).toBeTruthy()
  })

  it('renders placeholder when log is null', () => {
    render(<DailyBriefingCard profile={profile} log={null} isTR={false} />)
    expect(screen.getByText('◈ DAILY BRIEFING')).toBeTruthy()
  })
})
