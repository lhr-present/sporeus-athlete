import { describe, it, expect } from 'vitest'
import { levelFromTrainingAge, TRAINING_AGE_STAGE_LEVEL } from '../plan/levelFromTrainingAge.js'
import { analyzeTrainingAge } from '../athlete/trainingAge.js'

// Build a log of `weeks` consecutive recent weeks, each with `perWeek` sessions,
// so analyzeTrainingAge() counts them as consistent training weeks.
function consistentLog(weeks, perWeek = 4) {
  const log = []
  const dayMs = 86400000
  for (let w = 0; w < weeks; w++) {
    const weekBase = Date.now() - w * 7 * dayMs
    for (let s = 0; s < perWeek; s++) {
      log.push({ date: new Date(weekBase - s * dayMs).toISOString().slice(0, 10) })
    }
  }
  return log
}

describe('levelFromTrainingAge — derive plan level from training age', () => {
  it('maps each declared bucket to the right level', () => {
    expect(levelFromTrainingAge('< 1 year', [])).toBe('Beginner')
    expect(levelFromTrainingAge('1–2 years', [])).toBe('Intermediate')
    expect(levelFromTrainingAge('3–5 years', [])).toBe('Advanced')
    expect(levelFromTrainingAge('6–10 years', [])).toBe('Advanced')
    expect(levelFromTrainingAge('10+ years', [])).toBe('Advanced')
  })

  it('declared bucket takes priority over the log signal', () => {
    const richLog = consistentLog(120) // would be ESTABLISHED on its own
    expect(levelFromTrainingAge('< 1 year', richLog)).toBe('Beginner')
  })

  it('falls back to the log-derived stage (object-form analyzeTrainingAge call)', () => {
    const richLog = consistentLog(120)
    const stage = analyzeTrainingAge({ log: richLog })?.stage
    expect(stage).toBeTruthy() // proves the {log} object form returns non-null
    expect(levelFromTrainingAge('', richLog)).toBe(TRAINING_AGE_STAGE_LEVEL[stage])
  })

  it('defaults to Intermediate with no signal at all', () => {
    expect(levelFromTrainingAge('', [])).toBe('Intermediate')
    expect(levelFromTrainingAge(null, null)).toBe('Intermediate')
    expect(levelFromTrainingAge(undefined, undefined)).toBe('Intermediate')
  })

  it('ignores an unrecognized bucket and falls through', () => {
    expect(levelFromTrainingAge('garbage', [])).toBe('Intermediate')
  })
})
