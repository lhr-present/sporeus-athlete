import { useState, useCallback } from 'react'
import { logger } from '../lib/logger.js'

export const STORAGE_WARN_KEY = 'sporeus-quota-warned'

export function useLocalStorage(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def }
  })
  const set = useCallback(v => {
    setVal(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch (e) {
      if (e && (e.name==='QuotaExceededError' || e.code===22)) {
        try { localStorage.setItem(STORAGE_WARN_KEY,'1') } catch (e) { logger.warn('localStorage:', e.message) }
      }
    }
  }, [key])
  return [val, set]
}
