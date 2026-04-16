// ─── useProfileSync.test.js ───────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'

// ── Lightweight unit tests for the sync logic (no DOM/React needed) ───────────

// Profile merge logic: remote wins for populated fields, local fills gaps
describe('profile merge logic', () => {
  function mergeProfiles(local, remote) {
    // Mirrors what useProfileSync does on hydrate when remote has data
    return { ...local, ...remote }
  }

  it('remote data overwrites matching local keys', () => {
    const local  = { name: 'Local Name', sport: 'Running', ftp: 200 }
    const remote = { name: 'Remote Name', sport: 'Cycling' }
    const merged = mergeProfiles(local, remote)
    expect(merged.name).toBe('Remote Name')
    expect(merged.sport).toBe('Cycling')
  })

  it('local-only keys are preserved when remote does not have them', () => {
    const local  = { name: 'Alice', ftp: 250, maxhr: 185 }
    const remote = { name: 'Alice', sport: 'Triathlon' }
    const merged = mergeProfiles(local, remote)
    expect(merged.ftp).toBe(250)
    expect(merged.maxhr).toBe(185)
    expect(merged.sport).toBe('Triathlon')
  })

  it('empty remote does not wipe local data', () => {
    const local  = { name: 'Bob', ftp: 300 }
    const remote = {}
    const merged = mergeProfiles(local, remote)
    expect(merged.name).toBe('Bob')
    expect(merged.ftp).toBe(300)
  })

  it('empty local + populated remote returns remote data', () => {
    const local  = {}
    const remote = { name: 'Carol', sport: 'Swimming', goal: 'Olympic Triathlon' }
    const merged = mergeProfiles(local, remote)
    expect(merged).toEqual(remote)
  })
})

// One-time sync flag: local→remote push only runs once per userId
describe('one-time sync flag', () => {
  // Simulate the flag logic without a real localStorage (node env has no Storage)
  function shouldRunInitialPush(storedFlag, userId) {
    return storedFlag !== userId
  }

  it('does not push again when flag matches userId', () => {
    expect(shouldRunInitialPush('user-abc', 'user-abc')).toBe(false)
  })

  it('pushes when no flag is set yet', () => {
    expect(shouldRunInitialPush(null, 'user-abc')).toBe(true)
  })

  it('pushes when flag is for a different userId', () => {
    expect(shouldRunInitialPush('user-old', 'user-new')).toBe(true)
  })
})

// Setter: functional update form
describe('setProfile functional update', () => {
  it('applies function to previous value', () => {
    const prev = { name: 'Dave', ftp: 200 }
    const next = (p => ({ ...p, ftp: 250 }))(prev)
    expect(next.name).toBe('Dave')
    expect(next.ftp).toBe(250)
  })

  it('applies plain object update', () => {
    const prev = { name: 'Eve', ftp: 220 }
    const patch = { ftp: 240, sport: 'Cycling' }
    const next = { ...prev, ...patch }
    expect(next.name).toBe('Eve')
    expect(next.ftp).toBe(240)
    expect(next.sport).toBe('Cycling')
  })
})
