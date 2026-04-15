import { logger } from './logger.js'

export const STORAGE_VERSION = 3

export const SCHEMA = {
  'sporeus-profile':      { version: 3, defaults: { name:'', sport:'Running', age:'', weight:'', height:'', gender:'male', ftp:'', vo2max:'', ltPace:'', goal:'', neck:'', waist:'', hip:'' } },
  'sporeus_log':          { version: 3, defaults: [] },
  'sporeus-plan':         { version: 3, defaults: null },
  'sporeus-plan-status':  { version: 3, defaults: {} },
  'sporeus-recovery':     { version: 3, defaults: [] },
  'sporeus-test-results': { version: 3, defaults: [] },
  'sporeus-lang':         { version: 3, defaults: 'en' },
  'sporeus-dark':         { version: 3, defaults: false },
  'sporeus-onboarded':    { version: 3, defaults: false },
  'sporeus-reminders':    { version: 3, defaults: { training: false, recovery: false, time: '18:00' } },
  'sporeus-api-cache':    { version: 3, defaults: { data: null, ts: 0 } },
}

export function loadStorage(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key))
    if (!raw || raw._v !== SCHEMA[key]?.version) {
      const migrated = Array.isArray(SCHEMA[key]?.defaults)
        ? (Array.isArray(raw) ? raw : (raw?.data || SCHEMA[key].defaults))
        : { ...SCHEMA[key]?.defaults, ...(raw?._v ? raw.data : (typeof raw === 'object' && raw !== null ? raw : {})) }
      saveStorage(key, migrated)
      return migrated
    }
    return raw.data
  } catch (e) { logger.warn('localStorage:', e.message); return SCHEMA[key]?.defaults ?? null }
}

export function saveStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ _v: SCHEMA[key]?.version ?? 3, data }))
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      window.__storageWarning = true
      try { localStorage.setItem('sporeus-quota-warned', '1') } catch (e) { logger.warn('localStorage:', e.message) }
    }
  }
}

export function exportAllData() {
  const out = {}
  Object.keys(SCHEMA).forEach(key => {
    try { out[key] = JSON.parse(localStorage.getItem(key)) } catch (e) { logger.warn('localStorage:', e.message) }
  })
  return JSON.stringify({ _export: true, version: STORAGE_VERSION, ts: Date.now(), data: out }, null, 2)
}

export function importAllData(json) {
  try {
    const parsed = JSON.parse(json)
    const src = parsed._export ? parsed.data : parsed
    Object.entries(src).forEach(([key, val]) => {
      if (key.startsWith('sporeus')) {
        try { localStorage.setItem(key, JSON.stringify(val)) } catch (e) { logger.warn('localStorage:', e.message) }
      }
    })
    return true
  } catch (e) { logger.warn('localStorage:', e.message); return false }
}

// Import just a plan JSON (exported from coach plan builder)
export function importPlanData(json) {
  try {
    const plan = JSON.parse(json)
    if (!plan || !plan.weeks) return false
    saveStorage('sporeus-plan', plan)
    saveStorage('sporeus-plan-status', {})
    // Merge any coach messages embedded in the plan export
    if (Array.isArray(plan.coachMessages) && plan.coachMessages.length) {
      const key = 'sporeus-coach-messages'
      let existing = []
      try { existing = JSON.parse(localStorage.getItem(key)) || [] } catch (e) { logger.warn('localStorage:', e.message) }
      const ids = new Set(existing.map(m => m.id))
      const merged = [...existing, ...plan.coachMessages.filter(m => !ids.has(m.id))]
      try { localStorage.setItem(key, JSON.stringify(merged)) } catch (e) { logger.warn('localStorage:', e.message) }
    }
    return true
  } catch (e) { logger.warn('localStorage:', e.message); return false }
}
