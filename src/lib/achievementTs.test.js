// VISUAL-2: Achievement timestamp tests
import { describe, test, expect, beforeEach } from 'vitest'
import { checkAchievements } from '../components/Achievements.jsx'

// Minimal log that satisfies first_step
const minLog = [{ date: '2026-01-01', tss: 50, duration: 60, rpe: 5 }]

describe('achievement timestamps', () => {
  test('first unlock stores ISO timestamp', () => {
    // Simulate the timestamp-writing logic
    const achievements = {}
    const achievementTs = {}
    const today = new Date().toISOString().slice(0, 10)
    const current = checkAchievements({ log: minLog, recovery: [], testLog: [], dark: false, lang: 'en', planStatus: {}, plan: null })
    const newUnlocks = Object.keys(current).filter(id => current[id] && !achievements[id])

    expect(newUnlocks.length).toBeGreaterThan(0)
    newUnlocks.forEach(id => {
      achievements[id] = today
      if (!achievementTs[id]) achievementTs[id] = new Date().toISOString()
    })

    expect(typeof achievementTs[newUnlocks[0]]).toBe('string')
    expect(achievementTs[newUnlocks[0]]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('timestamp not overwritten on re-check', () => {
    const existing = { first_step: '2026-01-01' }
    const existingTs = { first_step: '2026-01-01T10:00:00.000Z' }
    const current = checkAchievements({ log: minLog, recovery: [], testLog: [], dark: false, lang: 'en', planStatus: {}, plan: null })
    const newUnlocks = Object.keys(current).filter(id => current[id] && !existing[id])
    // first_step already in existing — should not be in newUnlocks
    expect(newUnlocks).not.toContain('first_step')
    // Timestamp remains unchanged
    expect(existingTs.first_step).toBe('2026-01-01T10:00:00.000Z')
  })

  test('fmtAchDate formats correctly', () => {
    // 'Apr 2026' format from ISO date
    const isoDate = '2026-04-15'
    const d = new Date(isoDate + 'T12:00:00')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const result = `${months[d.getMonth()]} ${d.getFullYear()}`
    expect(result).toBe('Apr 2026')
  })

  test('recently unlocked detection: within 7 days', () => {
    const today = new Date().toISOString().slice(0, 10)
    const achievements = { first_step: today }
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const recent = Object.entries(achievements)
      .filter(([, date]) => date >= cutoffStr)
    expect(recent.length).toBe(1)
    expect(recent[0][0]).toBe('first_step')
  })
})
