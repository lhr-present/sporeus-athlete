import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { LangCtx, LABELS, TABS } from './contexts/LangCtx.jsx'
import { useLocalStorage, STORAGE_WARN_KEY } from './hooks/useLocalStorage.js'
import { S, ANIM_CSS } from './styles.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Dashboard from './components/Dashboard.jsx'
import ZoneCalc from './components/ZoneCalc.jsx'
import TestProtocols from './components/Protocols.jsx'
import TrainingLog from './components/TrainingLog.jsx'
import Periodization from './components/Periodization.jsx'
import Recovery from './components/Recovery.jsx'
import Profile from './components/Profile.jsx'
import OnboardingWizard from './components/Onboarding.jsx'
import SearchPalette from './components/SearchPalette.jsx'
const CoachDashboard = lazy(() => import('./components/CoachDashboard.jsx'))
const PlanGenerator   = lazy(() => import('./components/PlanGenerator.jsx'))
const Glossary        = lazy(() => import('./components/Glossary.jsx'))

const LazyFallback = () => (
  <div style={{ fontFamily:"'IBM Plex Mono',monospace", padding:'40px 20px', textAlign:'center', color:'#888', letterSpacing:'0.1em', opacity:0.7 }}>
    LOADING...
  </div>
)

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [coachMode] = useLocalStorage('sporeus-coach-mode', false)
  const [log, setLog] = useLocalStorage('sporeus_log', [])
  const [profile, setProfile] = useLocalStorage('sporeus_profile', {})
  const [lang, setLang] = useLocalStorage('sporeus-lang', 'en')
  const [logPrefill, setLogPrefill] = useState(null)
  const [quotaWarn, setQuotaWarn] = useState(() => {
    try { return localStorage.getItem(STORAGE_WARN_KEY)==='1' } catch { return false }
  })
  const [dark, setDark] = useLocalStorage('sporeus-dark', false)
  const [onboarded, setOnboarded] = useLocalStorage('sporeus-onboarded', false)
  const [swUpdateReady, setSwUpdateReady] = useState(false)
  const [coachToast, setCoachToast] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [firstSessionToast, setFirstSessionToast] = useState(false)
  const coachToastTimer = useRef(null)
  const firstSessionTimer = useRef(null)
  const prevLogLen = useRef(log.length)

  // Badge state: track which tabs have been visited to clear dots
  const [visitedTabs, setVisitedTabs] = useLocalStorage('sporeus-visited-tabs', {})
  const [recovery] = useLocalStorage('sporeus-recovery', [])
  const today = new Date().toISOString().slice(0, 10)
  const hasRecoveryToday = recovery.some(e => e.date === today)
  const isProfileIncomplete = onboarded && (!profile.name || !profile.primarySport)
  const isFirstSession = onboarded && log.length === 0

  // Tab badge dots (only show after onboarding and using app for a day or more)
  const appAge = (() => {
    const first = visitedTabs._firstVisit
    if (!first) return 0
    return Math.floor((Date.now() - new Date(first).getTime()) / 86400000)
  })()
  const showBadges = appAge >= 1 || Object.keys(visitedTabs).length > 3
  const badges = {
    recovery: showBadges && !hasRecoveryToday && !visitedTabs.recovery_today,
    profile:  onboarded && isProfileIncomplete,
    log:      false,
  }

  // Migration guard: existing users who have a saved profile skip onboarding
  useEffect(() => {
    if (!onboarded && profile && profile.name) setOnboarded(true)
  }, [])

  // Record first visit for badge age calculation
  useEffect(() => {
    if (!visitedTabs._firstVisit) {
      setVisitedTabs(v => ({ ...v, _firstVisit: new Date().toISOString() }))
    }
  }, [])

  // Handle ?coach= URL param — auto-connect athlete to coach
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

  // First session detection
  useEffect(() => {
    if (prevLogLen.current === 0 && log.length >= 1) {
      setFirstSessionToast(true)
      clearTimeout(firstSessionTimer.current)
      firstSessionTimer.current = setTimeout(() => setFirstSessionToast(false), 6000)
    }
    prevLogLen.current = log.length
  }, [log.length])

  // Ctrl+K / Cmd+K — open search palette
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

  // Track tab visits for badge clearing
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

  const t = useCallback(key => LABELS[lang]?.[key] ?? LABELS.en?.[key] ?? key, [lang])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase()

  return (
    <LangCtx.Provider value={{ t, lang, setLang }}>
      <style>{ANIM_CSS}</style>

      {/* Search Palette */}
      {showSearch && (
        <SearchPalette
          onNavigate={tabId => { setTab(tabId); setShowSearch(false) }}
          onToggleDark={() => setDark(d => !d)}
          onToggleLang={() => setLang(l => l === 'en' ? 'tr' : 'en')}
          onClose={() => setShowSearch(false)}
        />
      )}

      {!onboarded && <OnboardingWizard onFinish={finishOnboarding} setLang={setLang} lang={lang}/>}

      {swUpdateReady && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:10001, background:'#0064ff', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          ◈ New version available — reload to update
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => { setSwUpdateReady(false); window.location.reload() }} style={{ background:'#fff', border:'none', color:'#0064ff', padding:'4px 12px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px', fontWeight:600, borderRadius:'3px' }}>RELOAD</button>
            <button onClick={() => setSwUpdateReady(false)} style={{ background:'none', border:'1px solid #fff', color:'#fff', padding:'4px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Coach connection toast */}
      {coachToast && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:10002, background:'#0064ff', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {coachToast}
          <button onClick={() => setCoachToast('')} style={{ background:'none', border:'1px solid #fff', color:'#fff', padding:'2px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px' }}>✕</button>
        </div>
      )}

      {/* First session achievement toast */}
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
            {/* Search button */}
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
                    <span style={{ position:'absolute', top:'4px', right:'4px', background:'#ff6600', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'8px', padding:'1px 4px', borderRadius:'2px', whiteSpace:'nowrap', pointerEvents:'none' }}>
                      Start here
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>

        <main style={S.content}>
          {coachMode && <ErrorBoundary tabName="Coach Mode"><Suspense fallback={<LazyFallback/>}><CoachDashboard/></Suspense></ErrorBoundary>}
          {!coachMode && tab === 'dashboard'    && <ErrorBoundary tabName="Dashboard"><Dashboard log={log} profile={profile}/></ErrorBoundary>}
          {tab === 'zones'        && <ErrorBoundary tabName="Zone Calc"><ZoneCalc/></ErrorBoundary>}
          {tab === 'tests'        && <ErrorBoundary tabName="Protocols"><TestProtocols/></ErrorBoundary>}
          {tab === 'log'          && <ErrorBoundary tabName="Training Log"><TrainingLog log={log} setLog={setLog} prefill={logPrefill} clearPrefill={() => setLogPrefill(null)}/></ErrorBoundary>}
          {tab === 'periodization'&& <ErrorBoundary tabName="Macro Plan"><Periodization/></ErrorBoundary>}
          {tab === 'plan'         && <ErrorBoundary tabName="Plan Generator"><Suspense fallback={<LazyFallback/>}><PlanGenerator onLogSession={ses => { setLogPrefill(ses); setTab('log') }}/></Suspense></ErrorBoundary>}
          {tab === 'glossary'     && <ErrorBoundary tabName="Glossary"><Suspense fallback={<LazyFallback/>}><Glossary/></Suspense></ErrorBoundary>}
          {tab === 'recovery'     && <ErrorBoundary tabName="Recovery"><Recovery/></ErrorBoundary>}
          {tab === 'profile'      && <ErrorBoundary tabName="Profile"><Profile profile={profile} setProfile={setProfile} log={log}/></ErrorBoundary>}
        </main>

        <footer style={S.footer}>
          SPOREUS ATHLETE CONSOLE v4.4.0 · SPOREUS.COM · EŞİK / THRESHOLD 2026
        </footer>
      </div>
    </LangCtx.Provider>
  )
}
