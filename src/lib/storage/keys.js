// ─── src/lib/storage/keys.js — Central registry of all app localStorage keys ──
// Single source of truth. All localStorage reads/writes in the app should
// reference these constants so key names can be audited and changed safely.

export const STORAGE_KEYS = Object.freeze({
  // ── Core data ──────────────────────────────────────────────────────────────
  LOG:              'sporeus_log',         // underscore — legacy, do not change
  PROFILE:          'sporeus_profile',     // underscore — legacy, do not change
  RECOVERY:         'sporeus-recovery',
  RACE_RESULTS:     'sporeus-race-results',

  // ── Auth & user state ──────────────────────────────────────────────────────
  MIGRATED:         'sporeus-migrated',
  GUEST_MODE:       'sporeus-guest-mode',
  OFFLINE_MODE:     'sporeus-offline-mode',
  TIER:             'sporeus-tier',
  TRAINING_AGE:     'sporeus-training-age',
  TEST_GOALS:       'sporeus-test-goals',
  MY_COACH:         'sporeus-my-coach',

  // ── Push notifications ─────────────────────────────────────────────────────
  PUSH_RATE:        'sporeus-push-rate',

  // ── AI / calls ────────────────────────────────────────────────────────────
  AI_CALLS:         'sporeus-ai-calls',
  // Dynamic keys — use as functions:
  AI_CACHE:   key => `sporeus-ai-${key}`,

  // ── Coach features ─────────────────────────────────────────────────────────
  COACH_FLAGGED:    'sporeus-coach-flagged',
  COACH_MESSAGES:   'sporeus-coach-messages',
  ACTIVE_TEAM:      'sporeus-active-team',
  // Dynamic key: 'sporeus-week-${weekStart}'
  WEEK_NOTE:  week  => `sporeus-week-${week}`,
  // Dynamic key: power zones per effort level
  POWER_ZONE: level => `sporeus-power-${level}`,

  // ── Third-party integrations ───────────────────────────────────────────────
  STRAVA_TOKEN:     'sporeus-strava-token',
  LAST_FIT_POWER:   'sporeus-last-fit-power',

  // ── UI state ───────────────────────────────────────────────────────────────
  RECENT_SEARCHES:  'sporeus-recent-searches',
  QUOTA_WARNED:     'sporeus-quota-warned',
  HEAT_USED:        'sporeus-heat-used',
})

// All static (non-function) key values — used by clearAllAppData()
export const ALL_STATIC_KEYS = Object.values(STORAGE_KEYS).filter(v => typeof v === 'string')
