import { useState, useEffect, useCallback } from 'react'
import { LangCtx, LABELS, TABS } from './contexts/LangCtx.jsx'
import { useLocalStorage, STORAGE_WARN_KEY } from './hooks/useLocalStorage.js'
import { S, ANIM_CSS } from './styles.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Dashboard from './components/Dashboard.jsx'
import ZoneCalc from './components/ZoneCalc.jsx'
import TestProtocols from './components/Protocols.jsx'
import TrainingLog from './components/TrainingLog.jsx'
import Periodization from './components/Periodization.jsx'
import PlanGenerator from './components/PlanGenerator.jsx'
import Glossary from './components/Glossary.jsx'
import Recovery from './components/Recovery.jsx'
import Profile from './components/Profile.jsx'
import OnboardingWizard from './components/Onboarding.jsx'

export default function App() {
  const [tab, setTab] = useState('dashboard')
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

  // Migration guard: existing users who have a saved profile skip onboarding
  useEffect(() => {
    if (!onboarded && profile && profile.name) setOnboarded(true)
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
    }).catch(()=>{})
  }, [])

  const finishOnboarding = (data) => {
    if (data) setProfile(prev=>({...prev,...data}))
    setOnboarded(true)
  }

  const t = useCallback(key => LABELS[lang]?.[key] ?? LABELS.en?.[key] ?? key, [lang])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})
  const dateStr = now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase()

  return (
    <LangCtx.Provider value={{ t, lang, setLang }}>
      <style>{ANIM_CSS}</style>
      {!onboarded && <OnboardingWizard onFinish={finishOnboarding} setLang={setLang} lang={lang}/>}
      {swUpdateReady && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:10001, background:'#0064ff', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          ◈ New version available — reload to update
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={()=>{ setSwUpdateReady(false); window.location.reload() }} style={{ background:'#fff', border:'none', color:'#0064ff', padding:'4px 12px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px', fontWeight:600, borderRadius:'3px' }}>RELOAD</button>
            <button onClick={()=>setSwUpdateReady(false)} style={{ background:'none', border:'1px solid #fff', color:'#fff', padding:'4px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px' }}>✕</button>
          </div>
        </div>
      )}
      {quotaWarn && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:10000, background:'#e03030', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'8px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          ⚠ Storage full — some data may not save. Export your training log.
          <button onClick={()=>{ setQuotaWarn(false); try{localStorage.removeItem(STORAGE_WARN_KEY)}catch{} }} style={{ background:'none', border:'1px solid #fff', color:'#fff', padding:'2px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:'10px' }}>✕</button>
        </div>
      )}
      <div style={S.app}>
        <div style={S.topBar}/>

        <header style={S.header}>
          <div>
            <div style={S.headerTitle}>\u25c8 {t('appTitle')}</div>
            <div style={S.headerSub}>{t('appSub')}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ ...S.mono, fontSize:'10px', color:'#888' }}>{timeStr}</div>
              <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', letterSpacing:'0.06em' }}>{dateStr}</div>
            </div>
            <button onClick={()=>setDark(!dark)}
              style={{ ...S.mono, fontSize:'13px', padding:'4px 8px', borderRadius:'3px', border:'1px solid #444', background:'transparent', color:'#ccc', cursor:'pointer' }}>
              {dark ? '☀' : '☾'}
            </button>
            <button
              onClick={()=>setLang(lang==='en'?'tr':'en')}
              style={{ ...S.mono, fontSize:'11px', fontWeight:600, padding:'5px 10px', borderRadius:'3px', border:'1px solid #444', background:'transparent', color:'#ccc', cursor:'pointer', letterSpacing:'0.08em' }}>
              {lang==='en'?'TR':'EN'}
            </button>
          </div>
        </header>

        <nav style={S.navWrap}>
          <div style={S.nav}>
            {TABS.map(tab2=>(
              <button key={tab2.id} style={S.navBtn(tab===tab2.id)} onClick={()=>setTab(tab2.id)}>
                {tab2.icon} {t(tab2.lk)}
              </button>
            ))}
          </div>
        </nav>

        <main style={S.content}>
          {tab==='dashboard'     && <ErrorBoundary><Dashboard log={log} profile={profile}/></ErrorBoundary>}
          {tab==='zones'         && <ErrorBoundary><ZoneCalc/></ErrorBoundary>}
          {tab==='tests'         && <ErrorBoundary><TestProtocols/></ErrorBoundary>}
          {tab==='log'           && <ErrorBoundary><TrainingLog log={log} setLog={setLog} prefill={logPrefill} clearPrefill={()=>setLogPrefill(null)}/></ErrorBoundary>}
          {tab==='periodization' && <ErrorBoundary><Periodization/></ErrorBoundary>}
          {tab==='plan'          && <ErrorBoundary><PlanGenerator onLogSession={ses=>{ setLogPrefill(ses); setTab('log') }}/></ErrorBoundary>}
          {tab==='glossary'      && <ErrorBoundary><Glossary/></ErrorBoundary>}
          {tab==='recovery'      && <ErrorBoundary><Recovery/></ErrorBoundary>}
          {tab==='profile'       && <ErrorBoundary><Profile profile={profile} setProfile={setProfile} log={log}/></ErrorBoundary>}
        </main>

        <footer style={S.footer}>
          SPOREUS ATHLETE CONSOLE v3.0.0 · SPOREUS.COM · EŞİK / THRESHOLD 2026
        </footer>
      </div>
    </LangCtx.Provider>
  )
}
