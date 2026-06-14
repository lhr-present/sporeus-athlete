// v9.404 — derive the plan LEVEL (Beginner/Intermediate/Advanced) from the athlete's
// training age, so the plan generator's level defaults to the athlete's experience
// instead of a flat "Intermediate". Two signals, in priority order:
//   1. the user-declared bucket from TrainingAgeCard (localStorage 'sporeus-training-age')
//   2. the log-derived stage from analyzeTrainingAge() (Lloyd 2015 bands)
// Athletes can still override via the level buttons — this only sets the default.
import { analyzeTrainingAge } from '../athlete/trainingAge.js'

// Declared buckets shown in TrainingAgeCard (note: en-dash in the ranges).
export const TRAINING_AGE_BUCKET_LEVEL = {
  '< 1 year':   'Beginner',
  '1–2 years':  'Intermediate',
  '3–5 years':  'Advanced',
  '6–10 years': 'Advanced',
  '10+ years':  'Advanced',
}

// analyzeTrainingAge() stage → plan level (BEGINNER<26wk, DEVELOPING<104, ESTABLISHED<260, VETERAN).
export const TRAINING_AGE_STAGE_LEVEL = {
  BEGINNER:    'Beginner',
  DEVELOPING:  'Intermediate',
  ESTABLISHED: 'Advanced',
  VETERAN:     'Advanced',
}

/**
 * @param {string} declaredBucket - value of localStorage 'sporeus-training-age' ('' if unset)
 * @param {Array}  log            - training log (for the log-derived fallback)
 * @returns {'Beginner'|'Intermediate'|'Advanced'} defaults to 'Intermediate' when no signal
 */
export function levelFromTrainingAge(declaredBucket, log) {
  if (declaredBucket && TRAINING_AGE_BUCKET_LEVEL[declaredBucket]) {
    return TRAINING_AGE_BUCKET_LEVEL[declaredBucket]
  }
  const stage = analyzeTrainingAge({ log: Array.isArray(log) ? log : [] })?.stage
  if (stage && TRAINING_AGE_STAGE_LEVEL[stage]) return TRAINING_AGE_STAGE_LEVEL[stage]
  return 'Intermediate'
}
