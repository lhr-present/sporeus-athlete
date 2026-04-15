/**
 * @description Determines the current orientation step for a new athlete.
 * Returns null when the user is fully oriented, or a step key string.
 * @param {Object[]} log - Training log entries
 * @param {Object|null} profile - Athlete profile
 * @param {Object[]} wellnessHistory - Wellness entries (array)
 * @returns {'set_profile'|'log_first_session'|'log_wellness'|'run_predictor'|'view_load'|null}
 */
export function getOrientationStep(log, profile, wellnessHistory) {
  // Check dismissals first
  const dismissed = (step) => {
    try { return !!localStorage.getItem(`sporeus-oriented-${step}`) } catch { return false }
  }

  // Priority order
  const steps = [
    {
      key: 'set_profile',
      condition: () => !profile?.sport,
    },
    {
      key: 'log_first_session',
      condition: () => !log || log.length === 0,
    },
    {
      key: 'log_wellness',
      condition: () => {
        if (!wellnessHistory || wellnessHistory.length === 0) return true
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
        const cutoff = threeDaysAgo.toISOString().slice(0, 10)
        return !wellnessHistory.some(e => (e.date || e.created_at || '').slice(0, 10) >= cutoff)
      },
    },
    {
      key: 'run_predictor',
      condition: () => {
        if (!log || log.length < 3) return false
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('sporeus-test-results'))
          return keys.length === 0
        } catch { return false }
      },
    },
    {
      key: 'view_load',
      condition: () => {
        if (!log || log.length < 7) return false
        try {
          return !localStorage.getItem('sporeus-oriented-view_load') &&
                 !localStorage.getItem('sporeus-tab-visited-dashboard')
        } catch { return false }
      },
    },
  ]

  for (const step of steps) {
    if (!dismissed(step.key) && step.condition()) {
      return step.key
    }
  }
  return null
}

export const ORIENTATION_MESSAGES = {
  set_profile: {
    en: '→ Set your sport in Profile to enable sport-specific calculations',
    tr: '→ Spora özgü hesaplamalar için Profil\'den spor dalını seçin',
    tab: 'profile',
  },
  log_first_session: {
    en: '→ Log your first session to start tracking training load',
    tr: '→ Antrenman yükünü takip etmek için ilk seansı kaydedin',
    tab: 'log',
  },
  log_wellness: {
    en: '→ Morning check-in takes 20 seconds — it powers the suggestion engine',
    tr: '→ Sabah kontrol 20 saniye sürer — öneri motorunu besler',
    tab: 'today',
  },
  run_predictor: {
    en: '→ Run a baseline test in Protocols to calibrate your zones',
    tr: '→ Bölgelerinizi kalibre etmek için Protokoller\'de temel test yapın',
    tab: 'protocols',
  },
  view_load: {
    en: '→ Open Dashboard to see your training load trend',
    tr: '→ Antrenman yük trendini görmek için Gösterge Paneli\'ni açın',
    tab: 'dashboard',
  },
}
