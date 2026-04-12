import { describe, it, expect } from 'vitest'
import { getDaysToLaunch, LAUNCH_DATE } from './constants.js'

describe('getDaysToLaunch', () => {
  it('returns a positive number when today is before LAUNCH_DATE', () => {
    const days = getDaysToLaunch('2026-04-13')
    expect(days).toBe(2)
  })

  it('returns 0 on launch day and negative values after launch', () => {
    expect(getDaysToLaunch(LAUNCH_DATE)).toBe(0)
    expect(getDaysToLaunch('2026-04-16')).toBe(-1)
    expect(getDaysToLaunch('2026-04-20')).toBe(-5)
  })
})
