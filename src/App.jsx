import { lazy, useEffect } from 'react'
import { version as APP_VERSION } from '../package.json'
import { logger } from './lib/logger.js'
import { LangCtx, TABS } from './contexts/LangCtx.jsx'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { useAppState } from './hooks/useAppState.js'
import { DataProvider } from './contexts/DataContext.jsx'
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
import { hasCurrentConsent } from './lib/db/consentVersion.js'
import NotificationBell from './components/NotificationBell.jsx'
import { detectLocalData } from './lib/dataMigration.js'
import QuickAddModal from './components/QuickAddModal.jsx'
import KeyboardShortcuts from './components/KeyboardShortcuts.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { flushQueue } from './lib/offlineQueue.js'
import ToastStack from './components/ToastStack.jsx'
const CoachDashboard  = lazy(() => import('./components/CoachDashboard.jsx'))
const CoachOverview   = lazy(() => import('./components/CoachOverview.jsx'))
const CoachSquadView  = lazy(() => import('./components/CoachSquadView.jsx'))
const _PlanGenerator = lazy(() => import('./components/PlanGenerator.jsx'))
const YearlyPlan     = lazy(() => import('./components/YearlyPlan.jsx'))
const Glossary            = lazy(() => import('./components/Glossary.jsx'))
const SportProgramBuilder = lazy(() => import('./components/SportProgramBuilder.jsx'))
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

// ─── AppInner — inside DataProvider, renders using useAppState hook ───────────
function AppInner({ lang, setLang, dark, setDark, authUser, authProfile, signOut }) {
  const {
    log, setLog,
    tab, handleTabClick,
    showSearch, setShowSearch,
    showQuickAdd, setShowQuickAdd,
    showShortcutsHelp, setShowShortcutsHelp,
    inviteCode, setInviteCode,
    handleConsentGrant,
    coachMode,
    logPrefill, setLogPrefill,
    onboarded,
    toasts, dismissToast,
    syncStatus,
    badges, isGuest, isFirstSession,
    finishOnboarding, t, handleExport, handleAddSession,
  } = useAppState({ lang, setLang, dark, setDark, authUser, authProfile, signOut })

  const now = new Date()
  const timeStr = now.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase()

  if (EMBED_MODE) {
    return (
      <LangCtx.Provider value={{ t, lang, setLang }}>
        <style>{ANIM_CSS}</style>
        <AsyncBoundary name="Today">
          <TodayView log={log} setTab={() => {}} setLogPrefill={() => {}} />
        </AsyncBoundary>
      </LangCtx.Provider>
    )
  }

  return (
    <LangCtx.Provider value={{ t, lang, setLang }}>
      <style>{ANIM_CSS}</style>

      <OfflineBanner />
      <InstallPrompt />
      <ToastStack toasts={toasts} dismissToast={dismissToast} />

      {showSearch && (
        <SearchPalette
          onNavigate={tabId => { handleTabClick(tabId); setShowSearch(false) }}
          onToggleDark={() => setDark(d => !d)}
          onToggleLang={() => setLang(l => l === 'en' ? 'tr' : 'en')}
          onClose={() => setShowSearch(false)}
          log={log}
          onSync={() => flushQueue()}
          onExport={handleExport}
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
              onClick={handleConsentGrant}
              style={{ width:'100%', padding:'12px', background:'#ff6600', border:'none', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:700, letterSpacing:'0.08em', borderRadius:'4px', cursor:'pointer' }}
            >
              {lang === 'tr' ? 'KABUL EDİYORUM — DEVAM ET' : 'I CONSENT — CONTINUE'}
            </button>
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
                onClick={() => { try { localStorage.setItem(NUDGE_KEY,'1') } catch (e) { logger.warn('localStorage:', e.message) }; window.location.reload() }}
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
            <NotificationBell onNavigate={handleTabClick} />
            <button
              onClick={() => setShowQuickAdd(true)}
              title={`${lang === 'tr' ? 'Hızlı Antrenman Kaydet' : 'Quick Log Session'} (+)`}
              style={{ ...S.mono, fontSize:'14px', fontWeight:700, padding:'3px 10px', borderRadius:'3px', border:'1px solid #ff6600', background:'transparent', color:'#ff6600', cursor:'pointer', lineHeight:1 }}>
              +
            </button>
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
          <div role="tablist" style={S.nav}>
            {TABS.map(tab2 => {
              const hasBadge = badges[tab2.id]
              const isLogPulse = tab2.id === 'log' && isFirstSession
              return (
                <button
                  key={tab2.id}
                  role="tab"
                  aria-selected={tab === tab2.id}
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
          {!coachMode && tab === 'today'        && <AsyncBoundary name="Today"><TodayView log={log} setTab={handleTabClick} setLogPrefill={setLogPrefill}/></AsyncBoundary>}
          {!coachMode && tab === 'dashboard'    && <AsyncBoundary name="Dashboard"><Dashboard log={log}/></AsyncBoundary>}
          {tab === 'zones'        && <AsyncBoundary name="Zone Calc"><ZoneCalc/></AsyncBoundary>}
          {tab === 'tests'        && <AsyncBoundary name="Protocols"><TestProtocols/></AsyncBoundary>}
          {tab === 'log'          && <AsyncBoundary name="Training Log"><TrainingLog log={log} setLog={setLog} prefill={logPrefill} clearPrefill={() => setLogPrefill(null)}/></AsyncBoundary>}
          {tab === 'periodization'&& <AsyncBoundary name="Macro Plan"><Periodization authUser={authUser}/></AsyncBoundary>}
          {tab === 'plan'         && <AsyncBoundary name="Yearly Plan"><YearlyPlan /></AsyncBoundary>}
          {tab === 'glossary'     && <AsyncBoundary name="Glossary"><Glossary/></AsyncBoundary>}
          {tab === 'recovery'     && <AsyncBoundary name="Recovery"><Recovery/></AsyncBoundary>}
          {tab === 'profile'      && <AsyncBoundary name="Profile"><Profile log={log} authUser={authUser}/></AsyncBoundary>}
          {tab === 'sport'        && <AsyncBoundary name="Sport Plan"><SportProgramBuilder/></AsyncBoundary>}
        </main>

        <footer style={S.footer}>
          SPOREUS ATHLETE CONSOLE v{APP_VERSION} · SPOREUS.COM
          <span style={{ marginLeft:'12px', color:'#333', fontSize:'9px', letterSpacing:'0.06em' }}>
            ? = shortcuts · + = quick log · Ctrl+K = search
          </span>
        </footer>
      </div>

      {/* ── Quick-Add Session modal ───────────────────────────────────────── */}
      {showQuickAdd && (
        <QuickAddModal
          onAdd={handleAddSession}
          onClose={() => setShowQuickAdd(false)}
        />
      )}

      {/* ── Keyboard Shortcuts Help ───────────────────────────────────────── */}
      <KeyboardShortcuts
        open={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        lang={lang}
      />
    </LangCtx.Provider>
  )
}

// ─── App — thin shell: auth + providers ──────────────────────────────────────
export default function App() {
  const [lang, setLang] = useLocalStorage('sporeus-lang', 'en')
  const [dark, setDark] = useLocalStorage('sporeus-dark', true)
  const { user, profile: authProfile, loading, signOut, refreshProfile } = useAuth()

  // Clean up ?code= param left in URL after Supabase magic-link / email confirmation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('code') && !params.has('state')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

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
          try { sessionStorage.setItem('sporeus-pending-invite', pendingInvite) } catch (e) { logger.warn('sessionStorage:', e.message) }
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
