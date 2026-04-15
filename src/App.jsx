import { useState, useEffect, useCallback, useRef, lazy } from 'react'
import { exchangeStravaCode } from './lib/strava.js'
import { checkRaceCountdowns, checkSubscriptionExpiry } from './lib/pushNotify.js'
import { scheduleSessionReminder, getReminderSettings } from './lib/pushNotifications.js'
import { triggerSync } from './lib/deviceSync.js'
import { initOfflineSync, onSyncStatusChange, getSyncStatus, flushQueue } from './lib/offlineQueue.js'
import { exportAllData } from './lib/storage.js'
import { LangCtx, LABELS, TABS } from './contexts/LangCtx.jsx'
import { useLocalStorage, STORAGE_WARN_KEY } from './hooks/useLocalStorage.js'
import { DataProvider, useData } from './contexts/DataContext.jsx'
import { S, ANIM_CSS } from './styles.js'
import AsyncBoundary from './components/ui/AsyncBoundary.jsx'
import TodayView from './components/TodayView.jsx'
import ZoneCalc from './components/ZoneCalc.jsx'
import TrainingLog from './components/TrainingLog.jsx'
import Recovery from './components/Recovery.jsx'
import OnboardingWizard from './components/Onboarding.jsx'
import SearchPalette from './components/SearchPalette.jsx'
import AuthGate from './components/AuthGate.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import RoleSelector from './components/RoleSelector.jsx'
import MigrationModal from './components/MigrationModal.jsx'
import { InviteModal } from './components/MyCoach.jsx'
import { useAuth } from './hooks/useAuth.js'
import { isSupabaseReady } from './lib/supabase.js'
import { hasCurrentConsent, grantConsent } from './lib/db/consentVersion.js'
import { logConsent } from './lib/db/consent.js'
import { addNotification } from './lib/notificationCenter.js'
import NotificationBell from './components/NotificationBell.jsx'
import { calculateACWR } from './lib/trainingLoad.js'
import { detectLocalData } from './lib/dataMigration.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
const CoachDashboard  = lazy(() => import('./components/CoachDashboard.jsx'))
const CoachOverview   = lazy(() => import('./components/CoachOverview.jsx'))
const CoachSquadView  = lazy(() => import('./components/CoachSquadView.jsx'))
const PlanGenerator  = lazy(() => import('./components/PlanGenerator.jsx'))
const YearlyPlan     = lazy(() => import('./components/YearlyPlan.jsx'))
const Glossary            = lazy(() => import('./components/Glossary.jsx'))
const SportProgramBuilder = lazy(() => import('./components/SportProgramBuilder.jsx'))
// Heavy tabs: defer until user navigates to them
const Dashboard     = lazy(() => import('./components/Dashboard.jsx'))
const Profile       = lazy(() => import('./components/Profile.jsx'))
const TestProtocols = lazy(() => import('./components/Protocols.jsx'))
const Periodization = lazy(() => import('./components/Periodization.jsx'))


const EMBED_MODE = new URLSearchParams(window.location.search).get('embed') === 'true'


const Splash = () => (
  <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#444', letterSpacing:'0.12em' }}>
    LOADING...
  </div>
)

// ─── AppInner — inside DataProvider, can call useData() ──────────────────────
function AppInner({ lang, setLang, dark, setDark, authUser, authProfile, signOut }) {
  const { log, setLog, recovery } = useData()
  const isGuest = isSupabaseReady() && !authUser && localStorage.getItem('sporeus-guest-mode') === '1'

  const [tab, setTab] = useState('today')
  const [coachMode] = useLocalStorage('sporeus-coach-mode', false)
  const [inviteCode, setInviteCode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('invite')
    if (code) {
      const url = new URL(window.location.href)
      url.searchParams.delete('invite')
      window.history.replaceState({}, '', url.toString())
    }
    // Prefer URL param; fall back to pending invite stored for unauthenticated users
    return code || sessionStorage.getItem('sporeus-pending-invite') || null
  })

  // After auth completes, pick up any pending invite stored pre-login
  useEffect(() => {
    if (!authUser) return
    const pending = sessionStorage.getItem('sporeus-pending-invite')
    if (pending && !inviteCode) setInviteCode(pending)
    sessionStorage.removeItem('sporeus-pending-invite')
  }, [authUser])

  // Strava OAuth callback — detect ?state=strava&code=XXX on load
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
  const [stravaToast, setStravaToast] = useState('')

  // Exchange Strava code once we have an authenticated user
  useEffect(() => {
    if (!stravaCallbackCode || !authUser || !isSupabaseReady()) return
    setStravaCallbackCode(null) // prevent re-runs
    exchangeStravaCode(stravaCallbackCode).then(({ data, error }) => {
      if (error) {
        setStravaToast(`⚠ Strava connection failed: ${(error.message || 'Unknown error').slice(0, 200)}`)
      } else {
        setStravaToast(`✓ Strava connected${data?.athlete ? ' — ' + data.athlete : ''}`)
      }
      setTimeout(() => setStravaToast(''), 6000)
    })
  }, [stravaCallbackCode, authUser])
  const [profile, setProfile] = useLocalStorage('sporeus_profile', {})
  const [logPrefill, setLogPrefill] = useState(null)
  const [quotaWarn, setQuotaWarn] = useState(() => {
    try { return localStorage.getItem(STORAGE_WARN_KEY)==='1' } catch { return false }
  })
  const [onboarded, setOnboarded] = useLocalStorage('sporeus-onboarded', false)
  const [consentGiven, setConsentGiven] = useState(hasCurrentConsent)
  const [swUpdateReady, setSwUpdateReady] = useState(false)
  const [coachToast, setCoachToast] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [firstSessionToast, setFirstSessionToast] = useState(false)
  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus())
  const [coachUnreadBadge, setCoachUnreadBadge] = useState(0)
  const coachToastTimer = useRef(null)
  const firstSessionTimer = useRef(null)
  const prevLogLen = useRef(log.length)

  const [visitedTabs, setVisitedTabs] = useLocalStorage('sporeus-visited-tabs', {})
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

  useEffect(() => {
    if (!onboarded && profile && profile.name) setOnboarded(true)
  }, [])

  useEffect(() => {
    try {
      const msgs = JSON.parse(localStorage.getItem('sporeus-coach-messages')) || []
      setCoachUnreadBadge(msgs.filter(m => m.from === 'coach' && !m.read).length)
    } catch {}
  }, [tab])

  useEffect(() => {
    if (!visitedTabs._firstVisit) {
      setVisitedTabs(v => ({ ...v, _firstVisit: new Date().toISOString() }))
    }
  }, [])

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
        setCoachToast(`◉ Connected to coach ${coachLabel} — go to Profile to send your data.`)
        clearTimeout(coachToastTimer.current)
        coachToastTimer.current = setTimeout(() => setCoachToast(''), 6000)
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('coach')
      window.history.replaceState({}, '', url.toString())
    } catch {}
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Offline sync queue — init once on mount
  useEffect(() => {
    initOfflineSync()
    const unsub = onSyncStatusChange(setSyncStatus)
    return unsub
  }, [])

  // Race countdown check on load (only if permission already granted)
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      checkRaceCountdowns()
      checkSubscriptionExpiry(authUser?.id)
    }
  }, [authUser?.id])

  // Session reminders — reschedule on load if enabled
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    const s = getReminderSettings()
    if (s.enabled) scheduleSessionReminder({ hour: s.hour })
  }, [])

  // Device sync — auto-trigger if last sync > 4h ago
  useEffect(() => {
    if (!authUser || !isSupabaseReady()) return
    const SYNC_KEY = 'sporeus-last-device-sync'
    const lastSync = parseInt(localStorage.getItem(SYNC_KEY) || '0', 10)
    const fourHours = 4 * 60 * 60 * 1000
    if (Date.now() - lastSync < fourHours) return
    triggerSync().then(() => {
      try { localStorage.setItem(SYNC_KEY, String(Date.now())) } catch {}
    }).catch(() => {})
  }, [authUser])

  // ACWR spike notification — fires when log changes and ratio exceeds 1.3
  useEffect(() => {
    const { ratio } = calculateACWR(log)
    if (ratio === null || ratio <= 1.3) return
    const FLAG_KEY = 'sporeus-acwr-notif-date'
    const today2 = new Date().toISOString().slice(0, 10)
    try {
      if (localStorage.getItem(FLAG_KEY) === today2) return
      localStorage.setItem(FLAG_KEY, today2)
    } catch {}
    addNotification(
      'warning',
      'High Load Warning',
      `ACWR is ${ratio.toFixed(2)} — above 1.3. Consider an easy day to reduce injury risk.`,
      { tab: 'today' }
    )
  }, [log])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) setSwUpdateReady(true)
        })
      })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (prevLogLen.current === 0 && log.length >= 1) {
      setFirstSessionToast(true)
      clearTimeout(firstSessionTimer.current)
      firstSessionTimer.current = setTimeout(() => setFirstSessionToast(false), 6000)
    }
    prevLogLen.current = log.length
  }, [log.length])

  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
      }
      if (e.key === 'Escape') setShowSearch(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function handleTabClick(tabId) {
    setTab(tabId)
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
    if (import.meta.env.DEV && !LABELS[lang]?.[key] && !LABELS.en?.[key]) {
      console.warn(`[i18n] Missing translation: ${key} (${lang})`)
    }
    return val
  }, [lang])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase()

  if (EMBED_MODE) {
    return (
      <LangCtx.Provider value={{ t, lang, setLang }}>
        <style>{ANIM_CSS}</style>
        <AsyncBoundary name="Today">
          <TodayView log={log} profile={profile} setTab={() => {}} setLogPrefill={() => {}} />
        </AsyncBoundary>
      </LangCtx.Provider>
    )
  }

  return (
    <LangCtx.Provider value={{ t, lang, setLang }}>
      <style>{ANIM_CSS}</style>

      <OfflineBanner />
      <InstallPrompt />

      {showSearch && (
        <SearchPalette
          onNavigate={tabId => { setTab(tabId); setShowSearch(false) }}
          onToggleDark={() => setDark(d => !d)}
          onToggleLang={() => setLang(l => l === 'en' ? 'tr' : 'en')}
          onClose={() => setShowSearch(false)}
          log={log}
          onSync={() => flushQueue()}
          onExport={() => {
            try {
              const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: 'application/json' })
              const url  = URL.createObjectURL(blob)
              const a    = document.createElement('a')
              a.href = url; a.download = `sporeus-export-${new Date().toISOString().slice(0,10)}.json`; a.click()
              URL.revokeObjectURL(url)
            } catch {}
          }}
        />
      )}

      {!onboarded && <OnboardingWizard onFinish={finishOnboarding} setLang={setLang} lang={lang}/>}

      {/* ── KVKK / GDPR consent gate — must accept before health data is stored ── */}
      {onboarded && !hasCurrentConsent() && (
        <div style={{ position:'fixed', inset:0, zIndex:10010, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
          <div style={{ maxWidth:'480px', width:'100%', background:'#0f0f0f', border:'2px solid #ff6600', borderRadius:'8px', padding:'32px', fontFamily:"'IBM Plex Mono',monospace" }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#ff6600', letterSpacing:'0.12em', marginBottom:'16px' }}>
              {lang === 'tr' ? 'VERİ GİZLİLİĞİ ONAYI' : 'DATA PRIVACY CONSENT'}
            </div>
            {/* Show version update notice if they had old boolean consent */}
            {localStorage.getItem('sporeus-consent-v1') === 'true' && (
              <div style={{ fontSize:'9px', color:'#888', marginBottom:'12px' }}>
                {lang === 'tr' ? 'Gizlilik politikamız güncellendi (v1.1). Lütfen tekrar onaylayın.' : 'Privacy policy updated (v1.1). Please re-confirm your consent.'}
              </div>
            )}
            <div style={{ fontSize:'11px', color:'#aaa', lineHeight:1.7, marginBottom:'20px' }}>
              {lang === 'tr'
                ? 'Sporeus, antrenman yükü, iyileşme skorları ve sağlık verilerinizi analiz etmek için işler. Bu veriler yalnızca spor performansınızı değerlendirmek amacıyla kullanılır ve üçüncü taraflarla paylaşılmaz. Türk KVKK (Kanun No. 6698) kapsamında açık rızanız gereklidir.'
                : 'Sporeus processes your training load, recovery scores, and health data to analyse athletic performance. Data is used solely to evaluate your training and is not shared with third parties. Explicit consent is required under Turkish KVKK (Law No. 6698) and EU GDPR Art. 9 for health data.'
              }
            </div>
            <div style={{ fontSize:'10px', color:'#555', marginBottom:'24px', lineHeight:1.6 }}>
              {lang === 'tr' ? 'Onayı istediğiniz zaman Profil → Gizlilik bölümünden geri çekebilirsiniz.' : 'You may withdraw consent at any time from Profile → Privacy.'}
            </div>
            <button
              onClick={() => { grantConsent(); setConsentGiven(true); if (authUser?.id) logConsent(authUser.id, 'data_processing', '1.1') }}
              style={{ width:'100%', padding:'12px', background:'#ff6600', border:'none', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:700, letterSpacing:'0.08em', borderRadius:'4px', cursor:'pointer' }}
            >
              {lang === 'tr' ? 'KABUL EDİYORUM — DEVAM ET' : 'I CONSENT — CONTINUE'}
            </button>
          </div>
        </div>
      )}

      {swUpdateReady && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:10001, background:'#0064ff', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          ◈ New version available — reload to update
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => { setSwUpdateReady(false); window.location.reload() }} style={{ background:'#fff', border:'none', color:'#0064ff', padding:'4px 12px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px', fontWeight:600, borderRadius:'3px' }}>RELOAD</button>
            <button onClick={() => setSwUpdateReady(false)} style={{ background:'none', border:'1px solid #fff', color:'#fff', padding:'4px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Coach invite acceptance modal */}
      {inviteCode && authUser && authProfile?.role === 'athlete' && (
        <InviteModal
          inviteCode={inviteCode}
          userId={authUser.id}
          onDone={() => setInviteCode(null)}
        />
      )}

      {/* Guest mode upgrade nudge — after 30 days or 50 sessions */}
      {isGuest && (() => {
        const sessCount = log?.length || 0
        const firstDate = log?.length ? [...log].sort((a,b) => a.date > b.date ? 1 : -1)[0]?.date : null
        const daysSince = firstDate ? Math.floor((Date.now() - new Date(firstDate).getTime()) / 86400000) : 0
        if (sessCount < 50 && daysSince < 30) return null
        const NUDGE_KEY = 'sporeus-guest-nudge-dismissed'
        if (localStorage.getItem(NUDGE_KEY) === '1') return null
        return (
          <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:10003, background:'linear-gradient(90deg,#0a0a20,#0a1530)', borderBottom:'2px solid #0064ff', color:'#e0e0e0', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <span>
              <span style={{ color:'#0064ff', fontWeight:700 }}>
                {sessCount >= 50 ? `${sessCount} sessions logged` : `${daysSince} days of training`}
              </span>
              {lang === 'en' ? ' — sync to cloud so you never lose your data.' : ' — verilerinizi buluta senkronize edin, hiç kaybetmeyin.'}
            </span>
            <div style={{ display:'flex', gap:'8px' }}>
              <button
                onClick={() => { localStorage.removeItem('sporeus-guest-mode'); window.location.reload() }}
                style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', fontWeight:700, padding:'5px 14px', background:'#0064ff', border:'none', color:'#fff', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em' }}>
                {lang === 'en' ? 'Create Account →' : 'Hesap Oluştur →'}
              </button>
              <button
                onClick={() => { try { localStorage.setItem(NUDGE_KEY,'1') } catch {}; window.location.reload() }}
                style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', padding:'4px 10px', background:'transparent', border:'1px solid #333', color:'#555', borderRadius:'3px', cursor:'pointer' }}>
                ✕
              </button>
            </div>
          </div>
        )
      })()}

      {/* Guest mode banner */}
      {isGuest && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:10001, background:'#111', borderTop:'1px solid #333', color:'#888', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'8px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
          <span>
            <span style={{ color:'var(--brand-primary,#ff6600)', fontWeight:600 }}>GUEST MODE</span>
            {' · '}{lang === 'en' ? 'Data saves to this device only.' : 'Veri yalnızca bu cihaza kaydedilir.'}
          </span>
          <button
            onClick={() => { localStorage.removeItem('sporeus-guest-mode'); window.location.reload() }}
            style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', fontWeight:600, padding:'5px 14px', background:'var(--brand-primary,#ff6600)', border:'none', color:'#fff', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>
            {lang === 'en' ? 'Sign in & sync →' : 'Giriş yap & senkronize et →'}
          </button>
        </div>
      )}

      {stravaToast && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:10002, background: stravaToast.startsWith('⚠') ? '#e03030' : '#fc4c02', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {stravaToast}
          <button onClick={() => setStravaToast('')} style={{ background:'none', border:'1px solid #fff', color:'#fff', padding:'2px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px' }}>✕</button>
        </div>
      )}

      {coachToast && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:10002, background:'#0064ff', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {coachToast}
          <button onClick={() => setCoachToast('')} style={{ background:'none', border:'1px solid #fff', color:'#fff', padding:'2px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px' }}>✕</button>
        </div>
      )}

      {firstSessionToast && (
        <div style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', zIndex:10003, background:'#1a1a1a', border:'2px solid #5bc25b', color:'#5bc25b', fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', padding:'12px 24px', borderRadius:'8px', boxShadow:'0 8px 32px rgba(0,0,0,0.6)', display:'flex', alignItems:'center', gap:'12px', whiteSpace:'nowrap' }}>
          <span style={{ fontSize:'18px' }}>🏆</span>
          <div>
            <div style={{ fontWeight:700, letterSpacing:'0.06em' }}>FIRST STEP UNLOCKED</div>
            <div style={{ fontSize:'10px', color:'#888', marginTop:'2px' }}>You logged your first session. Consistency starts here.</div>
          </div>
          <button onClick={() => setFirstSessionToast(false)} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'16px', marginLeft:'8px' }}>×</button>
        </div>
      )}

      {quotaWarn && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:10000, background:'#e03030', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'8px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          ⚠ Storage full — some data may not save. Export your training log.
          <button onClick={() => { setQuotaWarn(false); try{localStorage.removeItem(STORAGE_WARN_KEY)}catch{} }} style={{ background:'none', border:'1px solid #fff', color:'#fff', padding:'2px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px' }}>✕</button>
        </div>
      )}

      <div style={S.app}>
        <div style={S.topBar}/>

        <header style={S.header}>
          <div>
            <div style={S.headerTitle}>◈ {t('appTitle')}</div>
            <div style={S.headerSub}>{t('appSub')}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ ...S.mono, fontSize:'10px', color:'#888' }}>{timeStr}</div>
              <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', letterSpacing:'0.06em' }}>{dateStr}</div>
            </div>
            {/* Sync status dot */}
            <span
              title={syncStatus === 'offline' ? 'Offline — changes queued' : syncStatus === 'syncing' ? 'Syncing…' : 'Synced'}
              style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: syncStatus === 'offline' ? '#555' : syncStatus === 'syncing' ? '#f5c542' : '#5bc25b',
                boxShadow: syncStatus === 'syncing' ? '0 0 6px #f5c54299' : 'none',
              }}
            />
            <NotificationBell onNavigate={setTab} />
            <button
              onClick={() => setShowSearch(true)}
              title="Search features (Ctrl+K)"
              style={{ ...S.mono, fontSize:'12px', padding:'4px 8px', borderRadius:'3px', border:'1px solid #444', background:'transparent', color:'#888', cursor:'pointer', letterSpacing:'0.06em' }}>
              ◈ Search
            </button>
            <button
              onClick={() => setDark(!dark)}
              style={{ ...S.mono, fontSize:'13px', padding:'4px 8px', borderRadius:'3px', border:'1px solid #444', background:'transparent', color:'#ccc', cursor:'pointer' }}>
              {dark ? '☀' : '☾'}
            </button>
            <button
              onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}
              style={{ ...S.mono, fontSize:'11px', fontWeight:600, padding:'5px 10px', borderRadius:'3px', border:'1px solid #444', background:'transparent', color:'#ccc', cursor:'pointer', letterSpacing:'0.08em' }}>
              {lang === 'en' ? 'TR' : 'EN'}
            </button>
            {isSupabaseReady() && authUser && (
              <button
                onClick={signOut}
                title={authProfile?.display_name || authUser.email}
                style={{ ...S.mono, fontSize:'10px', padding:'5px 10px', borderRadius:'3px', border:'1px solid #333', background:'transparent', color:'#555', cursor:'pointer', letterSpacing:'0.06em' }}>
                ⊗ {lang === 'en' ? 'Sign out' : 'Çıkış'}
              </button>
            )}
          </div>
        </header>

        <nav style={S.navWrap}>
          <div style={S.nav}>
            {TABS.map(tab2 => {
              const hasBadge = badges[tab2.id]
              const isLogPulse = tab2.id === 'log' && isFirstSession
              return (
                <button
                  key={tab2.id}
                  className={isLogPulse ? 'sp-tab-pulse' : ''}
                  style={{ ...S.navBtn(tab === tab2.id), position:'relative' }}
                  onClick={() => handleTabClick(tab2.id)}
                >
                  {tab2.icon} {t(tab2.lk)}
                  {hasBadge && (
                    <span style={{ position:'absolute', top:'6px', right:'4px', width:'6px', height:'6px', borderRadius:'50%', background: tab2.id === 'profile' ? '#e03030' : '#f5c542', display:'inline-block' }}/>
                  )}
                  {isLogPulse && (
                    <span style={{ position:'absolute', top:'4px', right:'4px', background:'var(--brand-primary,#ff6600)', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'8px', padding:'1px 4px', borderRadius:'2px', whiteSpace:'nowrap', pointerEvents:'none' }}>
                      Start here
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>

        <main style={S.content}>
          {coachMode && authProfile?.role === 'coach' && (
            <>
              <AsyncBoundary name="Squad View">
                <CoachSquadView authUser={authUser} />
              </AsyncBoundary>
              <div style={{ height: '16px' }}/>
              <AsyncBoundary name="Coach Overview">
                <CoachOverview coachId={authUser?.id} onSelectAthlete={() => {}} />
              </AsyncBoundary>
              <div style={{ height: '24px' }}/>
              <AsyncBoundary name="Coach Mode"><CoachDashboard authUser={authUser}/></AsyncBoundary>
            </>
          )}
          {coachMode && authProfile?.role !== 'coach' && <AsyncBoundary name="Coach Mode"><CoachDashboard authUser={authUser}/></AsyncBoundary>}
          {!coachMode && tab === 'today'        && <AsyncBoundary name="Today"><TodayView log={log} profile={profile} setTab={setTab} setLogPrefill={setLogPrefill}/></AsyncBoundary>}
          {!coachMode && tab === 'dashboard'    && <AsyncBoundary name="Dashboard"><Dashboard log={log} profile={profile}/></AsyncBoundary>}
          {tab === 'zones'        && <AsyncBoundary name="Zone Calc"><ZoneCalc/></AsyncBoundary>}
          {tab === 'tests'        && <AsyncBoundary name="Protocols"><TestProtocols/></AsyncBoundary>}
          {tab === 'log'          && <AsyncBoundary name="Training Log"><TrainingLog log={log} setLog={setLog} prefill={logPrefill} clearPrefill={() => setLogPrefill(null)}/></AsyncBoundary>}
          {tab === 'periodization'&& <AsyncBoundary name="Macro Plan"><Periodization authUser={authUser}/></AsyncBoundary>}
          {tab === 'plan'         && <AsyncBoundary name="Yearly Plan"><YearlyPlan /></AsyncBoundary>}
          {tab === 'glossary'     && <AsyncBoundary name="Glossary"><Glossary/></AsyncBoundary>}
          {tab === 'recovery'     && <AsyncBoundary name="Recovery"><Recovery/></AsyncBoundary>}
          {tab === 'profile'      && <AsyncBoundary name="Profile"><Profile profile={profile} setProfile={setProfile} log={log} authUser={authUser}/></AsyncBoundary>}
          {tab === 'sport'        && <AsyncBoundary name="Sport Plan"><SportProgramBuilder profile={profile}/></AsyncBoundary>}
        </main>

        <footer style={S.footer}>
          SPOREUS ATHLETE CONSOLE v6.1.0 · SPOREUS.COM
        </footer>
      </div>
    </LangCtx.Provider>
  )
}

// ─── App — thin shell: auth + providers ──────────────────────────────────────
export default function App() {
  const [lang, setLang] = useLocalStorage('sporeus-lang', 'en')
  const [dark, setDark] = useLocalStorage('sporeus-dark', false)
  const { user, profile: authProfile, loading, signOut, refreshProfile } = useAuth()

  const userId = isSupabaseReady() ? (user?.id ?? null) : null

  // Auth gates (only when Supabase is configured)
  if (isSupabaseReady()) {
    const isGuest = localStorage.getItem('sporeus-guest-mode') === '1'
    if (!isGuest) {
      if (loading) return <Splash />
      if (!user) {
        // Persist any pending invite so it survives the auth redirect
        const pendingInvite = new URLSearchParams(window.location.search).get('invite')
        if (pendingInvite) {
          try { sessionStorage.setItem('sporeus-pending-invite', pendingInvite) } catch {}
          const url = new URL(window.location.href)
          url.searchParams.delete('invite')
          window.history.replaceState({}, '', url.toString())
        }
        return <AuthGate lang={lang} />
      }
      if (authProfile && !authProfile.role) return <RoleSelector userId={user.id} onComplete={refreshProfile} lang={lang} />
      if (!authProfile) return <RoleSelector userId={user.id} onComplete={refreshProfile} lang={lang} />
      const localData = detectLocalData()
      if (localData) return <MigrationModal userId={user.id} localData={localData} lang={lang} onComplete={refreshProfile} />
    }
    // If guest and a real user signs in behind the scenes, clear the guest flag
    if (isGuest && user) localStorage.removeItem('sporeus-guest-mode')
  }

  return (
    <ErrorBoundary name="DataProvider">
      <DataProvider userId={userId}>
        <AppInner
          lang={lang} setLang={setLang}
          dark={dark} setDark={setDark}
          authUser={user} authProfile={authProfile} signOut={signOut}
        />
      </DataProvider>
    </ErrorBoundary>
  )
}
