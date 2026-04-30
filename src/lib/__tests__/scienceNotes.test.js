import { describe, it, expect } from 'vitest'
import { SCIENCE_NOTES, getTriggeredNotes } from '../scienceNotes.js'

// ── SCIENCE_NOTES array structure ────────────────────────────────────────────

describe('SCIENCE_NOTES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(SCIENCE_NOTES)).toBe(true)
    expect(SCIENCE_NOTES.length).toBeGreaterThan(0)
  })

  it('every note has a non-empty string id', () => {
    for (const note of SCIENCE_NOTES) {
      expect(typeof note.id).toBe('string')
      expect(note.id.trim().length).toBeGreaterThan(0)
    }
  })

  it('every note has a non-empty string en', () => {
    for (const note of SCIENCE_NOTES) {
      expect(typeof note.en).toBe('string')
      expect(note.en.trim().length).toBeGreaterThan(0)
    }
  })

  it('every note has a non-empty string tr', () => {
    for (const note of SCIENCE_NOTES) {
      expect(typeof note.tr).toBe('string')
      expect(note.tr.trim().length).toBeGreaterThan(0)
    }
  })

  it('every note has a non-empty string source', () => {
    for (const note of SCIENCE_NOTES) {
      expect(typeof note.source).toBe('string')
      expect(note.source.trim().length).toBeGreaterThan(0)
    }
  })

  it('every note has a trigger function', () => {
    for (const note of SCIENCE_NOTES) {
      expect(typeof note.trigger).toBe('function')
    }
  })

  it('all note ids are unique', () => {
    const ids = SCIENCE_NOTES.map(n => n.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('contains at least the known always-true notes', () => {
    const alwaysTrue = SCIENCE_NOTES.filter(n => {
      try { return n.trigger([], [], {}) } catch { return false }
    })
    expect(alwaysTrue.length).toBeGreaterThan(0)
  })
})

// ── getTriggeredNotes ─────────────────────────────────────────────────────────

describe('getTriggeredNotes', () => {
  it('returns an array with empty inputs', () => {
    const result = getTriggeredNotes([], [], {}, [])
    expect(Array.isArray(result)).toBe(true)
  })

  it('result is a subset of SCIENCE_NOTES ids', () => {
    const result = getTriggeredNotes([], [], {}, [])
    const allIds = new Set(SCIENCE_NOTES.map(n => n.id))
    for (const note of result) {
      expect(allIds.has(note.id)).toBe(true)
    }
  })

  it('always-true trigger notes appear when shownIds is empty', () => {
    const alwaysTrueIds = SCIENCE_NOTES
      .filter(n => { try { return n.trigger([], [], {}) } catch { return false } })
      .map(n => n.id)
    const result = getTriggeredNotes([], [], {}, [])
    const resultIds = result.map(n => n.id)
    for (const id of alwaysTrueIds) {
      expect(resultIds).toContain(id)
    }
  })

  it('excludes notes whose id is in shownIds', () => {
    const alwaysTrueIds = SCIENCE_NOTES
      .filter(n => { try { return n.trigger([], [], {}) } catch { return false } })
      .map(n => n.id)
    // Pass all always-true ids as shownIds
    const result = getTriggeredNotes([], [], {}, alwaysTrueIds)
    const resultIds = result.map(n => n.id)
    for (const id of alwaysTrueIds) {
      expect(resultIds).not.toContain(id)
    }
  })

  it('excludes a specific shown id', () => {
    const first = SCIENCE_NOTES[0]
    // Confirm it fires with empty inputs first
    const withoutFilter = getTriggeredNotes([], [], {}, [])
    const withoutIds = withoutFilter.map(n => n.id)
    if (withoutIds.includes(first.id)) {
      const result = getTriggeredNotes([], [], {}, [first.id])
      expect(result.map(n => n.id)).not.toContain(first.id)
    }
  })

  it('log.length >= 10 trigger: empty log excludes acwr_sweet_spot', () => {
    const result = getTriggeredNotes([], [], {}, [])
    expect(result.map(n => n.id)).not.toContain('acwr_sweet_spot')
  })

  it('log.length >= 10 trigger: 10-entry log includes acwr_sweet_spot', () => {
    const log = Array.from({ length: 10 }, (_, i) => ({ date: `2026-01-${String(i+1).padStart(2,'0')}` }))
    const result = getTriggeredNotes(log, [], {}, [])
    expect(result.map(n => n.id)).toContain('acwr_sweet_spot')
  })

  it('log.length >= 20 trigger: 19-entry log excludes ctl_decay', () => {
    const log = Array.from({ length: 19 }, (_, i) => ({ date: `2026-01-${String(i+1).padStart(2,'0')}` }))
    const result = getTriggeredNotes(log, [], {}, [])
    expect(result.map(n => n.id)).not.toContain('ctl_decay')
  })

  it('log.length >= 20 trigger: 20-entry log includes ctl_decay', () => {
    const log = Array.from({ length: 20 }, (_, i) => ({ date: `2026-01-${String(i+1).padStart(2,'0')}` }))
    const result = getTriggeredNotes(log, [], {}, [])
    expect(result.map(n => n.id)).toContain('ctl_decay')
  })

  it('recovery.length >= 3 trigger: 2 recovery entries excludes sleep_performance', () => {
    const result = getTriggeredNotes([], [{ hrv: 60 }, { hrv: 55 }], {}, [])
    expect(result.map(n => n.id)).not.toContain('sleep_performance')
  })

  it('recovery.length >= 3 trigger: 3 recovery entries includes sleep_performance', () => {
    const rec = [{ hrv: 60 }, { hrv: 55 }, { hrv: 58 }]
    const result = getTriggeredNotes([], rec, {}, [])
    expect(result.map(n => n.id)).toContain('sleep_performance')
  })

  it('running sport profile includes running_cadence', () => {
    const result = getTriggeredNotes([], [], { primarySport: 'running' }, [])
    expect(result.map(n => n.id)).toContain('running_cadence')
  })

  it('non-running profile excludes running_cadence', () => {
    const result = getTriggeredNotes([], [], { primarySport: 'cycling' }, [])
    expect(result.map(n => n.id)).not.toContain('running_cadence')
  })

  it('swim sport profile includes swim_efficiency', () => {
    const result = getTriggeredNotes([], [], { primarySport: 'swimming' }, [])
    expect(result.map(n => n.id)).toContain('swim_efficiency')
  })

  it('cycling profile includes cycling_position', () => {
    const result = getTriggeredNotes([], [], { primarySport: 'cycling' }, [])
    expect(result.map(n => n.id)).toContain('cycling_position')
  })

  it('does not throw with null inputs (null safety)', () => {
    expect(() => getTriggeredNotes(null, null, null, [])).not.toThrow()
  })

  it('null inputs return an array', () => {
    const result = getTriggeredNotes(null, null, null, [])
    expect(Array.isArray(result)).toBe(true)
  })

  it('null shownIds does not throw', () => {
    expect(() => getTriggeredNotes([], [], {}, null)).not.toThrow()
  })

  it('every returned note has non-empty en string', () => {
    const log = Array.from({ length: 30 }, (_, i) => ({ date: `2026-01-${String(i+1).padStart(2,'0')}` }))
    const result = getTriggeredNotes(log, [1,2,3,4,5,6,7], { primarySport: 'running' }, [])
    for (const note of result) {
      expect(typeof note.en).toBe('string')
      expect(note.en.trim().length).toBeGreaterThan(0)
    }
  })

  it('every returned note has non-empty tr string', () => {
    const log = Array.from({ length: 30 }, (_, i) => ({ date: `2026-01-${String(i+1).padStart(2,'0')}` }))
    const result = getTriggeredNotes(log, [1,2,3,4,5,6,7], { primarySport: 'running' }, [])
    for (const note of result) {
      expect(typeof note.tr).toBe('string')
      expect(note.tr.trim().length).toBeGreaterThan(0)
    }
  })

  it('every returned note has id and source fields', () => {
    const result = getTriggeredNotes([], [], {}, [])
    for (const note of result) {
      expect(note).toHaveProperty('id')
      expect(note).toHaveProperty('source')
    }
  })

  it('hiit_vo2max fires when a log entry has rpe >= 8', () => {
    const log = [{ rpe: 9, date: '2026-01-01' }]
    const result = getTriggeredNotes(log, [], {}, [])
    expect(result.map(n => n.id)).toContain('hiit_vo2max')
  })

  it('hiit_vo2max does not fire when all rpe < 8', () => {
    const log = [{ rpe: 7, date: '2026-01-01' }]
    const result = getTriggeredNotes(log, [], {}, [])
    expect(result.map(n => n.id)).not.toContain('hiit_vo2max')
  })

  it('two_a_day fires when a log entry has duration >= 120', () => {
    const log = [{ duration: 120, date: '2026-01-01' }]
    const result = getTriggeredNotes(log, [], {}, [])
    expect(result.map(n => n.id)).toContain('two_a_day')
  })

  it('two_a_day does not fire when all durations < 120', () => {
    const log = [{ duration: 60, date: '2026-01-01' }]
    const result = getTriggeredNotes(log, [], {}, [])
    expect(result.map(n => n.id)).not.toContain('two_a_day')
  })
})
