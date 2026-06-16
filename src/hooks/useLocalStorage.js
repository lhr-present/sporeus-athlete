import { useState, useCallback, useEffect } from 'react'
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

  // Cross-tab sync: the `storage` event fires ONLY in *other* tabs (not the
  // writer), so adopting the new value here can't create a write-loop. Without
  // this, two tabs on the same device diverge silently — Tab B never sees Tab
  // A's write, then clobbers it with its own stale snapshot on its next write.
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== key || e.storageArea !== localStorage || e.newValue == null) return
      let parsed
      try { parsed = JSON.parse(e.newValue) } catch { return }
      setVal(prev => {
        // Ignore unchanged values to avoid spurious re-renders.
        try { if (JSON.stringify(prev) === e.newValue) return prev } catch { /* prev not serializable — fall through */ }
        return parsed
      })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  return [val, set]
}
