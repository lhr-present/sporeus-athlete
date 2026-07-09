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
      const json = JSON.stringify(v)
      localStorage.setItem(key, json)
      // v9.498 (general-check F6): the `storage` event never fires in the
      // WRITING tab, so sibling hook instances on the same key (e.g.
      // EliteProgramCard writing sporeus-eliteProgram while ProgramView +
      // NextTrainingCard read it) stayed stale until remount. Broadcast a
      // same-tab event; the listener's value-equality guard makes the writer's
      // own instance a no-op, so no loop is possible (only `set` dispatches).
      try { window.dispatchEvent(new CustomEvent('sporeus-ls-write', { detail: { key, json } })) } catch (_) { /* non-browser env */ }
    } catch (e) {
      if (e && (e.name==='QuotaExceededError' || e.code===22)) {
        try { localStorage.setItem(STORAGE_WARN_KEY,'1') } catch (e) { logger.warn('localStorage:', e.message) }
        // The mount-time quota toast (useAppState) reads STORAGE_WARN_KEY only
        // once on mount, so a user who hits quota *mid-session* would never be
        // warned. Broadcast a window event so the live listener can fire the
        // same toast immediately. Self-guarded — never let the warn path throw.
        try { window.dispatchEvent(new CustomEvent('sporeus-quota-exceeded')) } catch (_) { /* non-browser env */ }
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
    // v9.498 (F6): same-tab counterpart of the cross-tab sync above.
    function onLocalWrite(e) {
      const d = e?.detail
      if (!d || d.key !== key || d.json == null) return
      let parsed
      try { parsed = JSON.parse(d.json) } catch { return }
      setVal(prev => {
        try { if (JSON.stringify(prev) === d.json) return prev } catch { /* fall through */ }
        return parsed
      })
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('sporeus-ls-write', onLocalWrite)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('sporeus-ls-write', onLocalWrite)
    }
  }, [key])

  return [val, set]
}
