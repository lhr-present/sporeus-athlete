// ─── useAppState — all AppInner state + effects in one hook ──────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import { useToasts } from './useToasts.js'
import { logger } from '../lib/logger.js'
import { useData } from '../contexts/DataContext.jsx'
import { useLocalStorage, STORAGE_WARN_KEY } from './useLocalStorage.js'
import { LABELS } from '../contexts/LangCtx.jsx'
import { calculateACWR } from '../lib/trainingLoad.js'
import { addNotification } from '../lib/notificationCenter.js'
import { exchangeStravaCode } from '../lib/strava.js'
import { checkRaceCountdowns, checkSubscriptionExpiry } from '../lib/pushNotify.js'
import { scheduleSessionReminder, getReminderSettings } from '../lib/pushNotifications.js'
import { triggerSync } from '../lib/deviceSync.js'
import { initOfflineSync, onSyncStatusChange, getSyncStatus, flushQueue } from '../lib/offlineQueue.js'
import { exportAllData } from '../lib/storage.js'
import { isSupabaseReady } from '../lib/supabase.js'
import { sanitizeLogEntry } from '../lib/validate.js'
import { hasCurrentConsent, grantConsent } from '../lib/db/consentVersion.js'
import { logConsent } from '../lib/db/consent.js'

/**
 * @param {{ lang: string, setLang: Function, dark: boolean, setDark: Function,
 *           authUser: object|null, authProfile: object|null, signOut: Function }} opts
 */
export function useAppState({ lang, setLang, dark, setDark, authUser, authProfile, signOut }) {
  const { log, setLog, recovery, profile, setProfile } = useData()
  const isGuest = isSupabaseReady() && !authUser && localStorage.getItem('sporeus-guest-mode') === '1'
  const { toasts, addToast, dismissToast } = useToasts()

  // ── Tab — persisted to sessionStorage so refresh restores position ───────────
  const [tab, setTabRaw] = useState(() => {
    try { return sessionStorage.getItem('sporeus-active-tab') || 'today' } catch { return 'today' }
  })

  // ── Coach mode ────────────────────────────────────────────────────────────────
  const [coachMode] = useLocalStorage('sporeus-coach-mode', false)

  // ── Invite code — from URL param or sessionStorage (survives auth redirect) ──
  const [inviteCode, setInviteCode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('invite')
    if (code) {
      const url = new URL(window.location.href)
      url.searchParams.delete('invite')
      window.history.replaceState({}, '', url.toString())
    }
    return code || sessionStorage.getItem('sporeus-pending-invite') || null
  })

  useEffect(() => {
    if (!authUser) return
    const pending = sessionStorage.getItem('sporeus-pending-invite')
    if (pending && !inviteCode) setInviteCode(pending)
    sessionStorage.removeItem('sporeus-pending-invite')
  }, [authUser]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Strava OAuth callback ─────────────────────────────────────────────────────
  const [stravaCallbackCode, setStravaCallbackCode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('state') === 'strava' && params.get('code')) {
      const oauthCode = params.get('code')
      const url = new URL(window.location.href)
      url.searchParams.delete('state')
      url.searchParams.delete('code')
      url.searchParams.delete('scope')
      window.history.replaceState({}, '', url.toString())
      return oauthCode
    }
    return null
  })

  useEffect(() => {
    if (!stravaCallbackCode || !authUser || !isSupabaseReady()) return
    setStravaCallbackCode(null)
    exchangeStravaCode(stravaCallbackCode).then(({ data, error }) => {
      if (error) {
        addToast({ id: 'strava', message: `⚠ Strava connection failed: ${(error.message || 'Unknown error').slice(0, 200)}`, type: 'error', duration: 6000 })
      } else {
        addToast({ id: 'strava', message: `✓ Strava connected${data?.athlete ? ' — ' + data.athlete : ''}`, type: 'success', duration: 6000 })
      }
    })
  }, [stravaCallbackCode, authUser]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core state ────────────────────────────────────────────────────────────────
  const [logPrefill, setLogPrefill] = useState(null)
  const [onboarded, setOnboarded] = useLocalStorage('sporeus-onboarded', false)
  const [consentGiven, setConsentGiven] = useState(hasCurrentConsent)
  const [showSearch, setShowSearch] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus())
  const [coachUnreadBadge, setCoachUnreadBadge] = useState(0)

  const prevLogLen = useRef(log.length)

  const [visitedTabs, setVisitedTabs] = useLocalStorage('sporeus-visited-tabs', {})

  // ── Computed values ───────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const hasRecoveryToday = recovery.some(e => e.date === today)
  const isProfileIncomplete = onboarded && (!profile.name || !profile.primarySport)
  const isFirstSession = onboarded && log.length === 0

  const appAge = (() => {
    const first = visitedTabs._firstVisit
    if (!first) return 0
    return Math.floor((Date.now() - new Date(first).getTime()) / 86400000)
  })()
  const showBadges = appAge >= 1 || Object.keys(visitedTabs).length > 3
  const badges = {
    recovery: showBadges && !hasRecoveryToday && !visitedTabs.recovery_today,
    profile:  (onboarded && isProfileIncomplete) || coachUnreadBadge > 0,
    log:      false,
  }

  // ── Effects ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!onboarded && profile?.name) setOnboarded(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const msgs = JSON.parse(localStorage.getItem('sporeus-coach-messages')) || []
      setCoachUnreadBadge(msgs.filter(m => m.from === 'coach' && !m.read).length)
    } catch { logger.warn('Failed to read coach messages') }
  }, [tab])

  useEffect(() => {
    if (!visitedTabs._firstVisit) {
      setVisitedTabs(v => ({ ...v, _firstVisit: new Date().toISOString() }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const coachParam = params.get('coach')
    if (!coachParam) return
    if (coachParam !== 'huseyin-sporeus' && !coachParam.startsWith('SP-')) return
    try {
      const current = localStorage.getItem('sporeus-my-coach')
      if (current !== coachParam) {
        localStorage.setItem('sporeus-my-coach', coachParam)
        const coachLabel = coachParam === 'huseyin-sporeus' ? 'Hüseyin Akbulut' : coachParam
        addToast({ id: 'coach', message: `◉ Connected to coach ${coachLabel} — go to Profile to send your data.`, type: 'info', duration: 6000 })
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('coach')
      window.history.replaceState({}, '', url.toString())
    } catch { logger.warn('Failed to process ?coach param') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    initOfflineSync()
    const unsub = onSyncStatusChange(setSyncStatus)
    return unsub
  }, [])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      checkRaceCountdowns()
      checkSubscriptionExpiry(authUser?.id)
    }
  }, [authUser?.id])

  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    const s = getReminderSettings()
    if (s.enabled) scheduleSessionReminder({ hour: s.hour })
  }, [])

  useEffect(() => {
    if (!authUser || !isSupabaseReady()) return
    const SYNC_KEY = 'sporeus-last-device-sync'
    const lastSync = parseInt(localStorage.getItem(SYNC_KEY) || '0', 10)
    const fourHours = 4 * 60 * 60 * 1000
    if (Date.now() - lastSync < fourHours) return
    triggerSync().then(() => {
      try { localStorage.setItem(SYNC_KEY, String(Date.now())) } catch (e) { logger.warn('localStorage:', e.message) }
    }).catch(() => {})
  }, [authUser]) // eslint-disable-line react-hooks/exhaustive-deps

  // ACWR spike notification
  useEffect(() => {
    const { ratio } = calculateACWR(log)
    if (ratio === null || ratio <= 1.3) return
    const FLAG_KEY = 'sporeus-acwr-notif-date'
    const today2 = new Date().toISOString().slice(0, 10)
    try {
      if (localStorage.getItem(FLAG_KEY) === today2) return
      localStorage.setItem(FLAG_KEY, today2)
    } catch (e) { logger.warn('localStorage:', e.message) }
    addNotification(
      'warning',
      'High Load Warning',
      `ACWR is ${ratio.toFixed(2)} — above 1.3. Consider an easy day to reduce injury risk.`,
      { tab: 'today' }
    )
  }, [log])

  // Service worker update detection
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            addToast({ id: 'sw-update', message: '◈ New version available — reload to update', type: 'update', duration: 0, action: { label: 'RELOAD', onClick: () => window.location.reload() } })
          }
        })
      })
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addToast is stable, SW listener only runs once
  }, [])

  // First session toast
  useEffect(() => {
    if (prevLogLen.current === 0 && log.length >= 1) {
      addToast({ id: 'first-session', message: '🏆 FIRST STEP UNLOCKED — You logged your first session. Consistency starts here.', type: 'success', duration: 6000 })
    }
    prevLogLen.current = log.length
  }, [log.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quota warn toast — fires once on mount if flag was set by useLocalStorage
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_WARN_KEY) === '1') {
        addToast({
          id: 'quota',
          message: '⚠ Storage full — some data may not save. Export your training log.',
          type: 'error',
          duration: 0,
          onDismiss: () => { try { localStorage.removeItem(STORAGE_WARN_KEY) } catch (e) { logger.warn('localStorage:', e.message) } },
        })
      }
    } catch (e) { logger.warn('localStorage:', e.message) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sunday weekly digest notification
  useEffect(() => {
    if (!log || log.length < 5) return
    const now = new Date()
    if (now.getDay() !== 0) return // 0 = Sunday
    const todayStr = now.toISOString().slice(0, 10)
    const FLAG_KEY = `sporeus-weekly-digest-notif-${todayStr}`
    try {
      if (localStorage.getItem(FLAG_KEY)) return
      localStorage.setItem(FLAG_KEY, '1')
    } catch (e) { logger.warn('localStorage:', e.message) }
    const sevenAgo = new Date(now)
    sevenAgo.setDate(sevenAgo.getDate() - 7)
    const weekStr = sevenAgo.toISOString().slice(0, 10)
    const weekSessions = log.filter(e => e.date >= weekStr && e.date <= todayStr)
    if (weekSessions.length === 0) return
    const totalTSS = weekSessions.reduce((s, e) => s + (e.tss || 0), 0)
    const { ratio: acwr } = calculateACWR(log)
    addNotification(
      'analytics',
      lang === 'tr' ? 'Haftalık Özet' : 'Weekly Summary',
      `${weekSessions.length} session${weekSessions.length !== 1 ? 's' : ''} · ${Math.round(totalTSS)} TSS · ACWR ${acwr ? acwr.toFixed(2) : '—'}`,
      { tab: 'dashboard' }
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Global keyboard shortcuts
  useEffect(() => {
    const TAB_KEYS = { '1':'today','2':'dashboard','3':'log','4':'recovery','5':'profile','6':'zones','7':'tests' }
    const isInputFocused = () => {
      const el = document.activeElement
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    }
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
        return
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
        setShowQuickAdd(false)
        setShowShortcutsHelp(false)
        return
      }
      if (isInputFocused()) return
      if (e.key === '?') { e.preventDefault(); setShowShortcutsHelp(s => !s); return }
      if (e.key === '+' || e.key === 'a') { e.preventDefault(); setShowQuickAdd(true); return }
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); setLang(l => l === 'en' ? 'tr' : 'en'); return }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); setDark(d => !d); return }
      if (TAB_KEYS[e.key]) { e.preventDefault(); handleTabClick(TAB_KEYS[e.key]); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleTabClick(tabId) {
    setTabRaw(tabId)
    try { sessionStorage.setItem('sporeus-active-tab', tabId) } catch (e) { logger.warn('sessionStorage:', e.message) }
    if (tabId === 'recovery') {
      setVisitedTabs(v => ({ ...v, recovery_today: today }))
    }
  }

  const finishOnboarding = (data) => {
    if (data) setProfile(prev => ({ ...prev, ...data }))
    setOnboarded(true)
  }

  const t = useCallback(key => {
    const val = LABELS[lang]?.[key] ?? LABELS.en?.[key] ?? key
    if (!LABELS[lang]?.[key] && !LABELS.en?.[key]) {
      logger.warn(`[i18n] Missing translation: ${key} (${lang})`)
    }
    return val
  }, [lang])

  const handleExport = () => {
    try {
      const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sporeus-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch { logger.warn('Data export failed') }
  }

  const handleAddSession = (entry) => {
    setLog(prev => [...prev, sanitizeLogEntry(entry)])
  }

  const handleConsentGrant = () => {
    grantConsent()
    setConsentGiven(true)
    if (authUser?.id) logConsent(authUser.id, 'data_processing', '1.1')
  }

  return {
    // Data from DataProvider
    log, setLog, recovery,
    profile, setProfile,
    // Tab
    tab, handleTabClick,
    // Overlays
    showSearch, setShowSearch,
    showQuickAdd, setShowQuickAdd,
    showShortcutsHelp, setShowShortcutsHelp,
    // Invite + consent
    inviteCode, setInviteCode,
    consentGiven, handleConsentGrant,
    // Mode flags
    coachMode,
    // Log prefill
    logPrefill, setLogPrefill,
    // Toast manager
    toasts, dismissToast,
    // Sync
    syncStatus,
    flushQueue,
    // Computed booleans
    isGuest, isFirstSession, isProfileIncomplete, badges,
    onboarded,
    // Callbacks
    finishOnboarding, t, handleExport, handleAddSession,
    // Pass-through (needed by render)
    lang, setLang, dark, setDark, authUser, authProfile, signOut,
  }
}
