import { useState, useEffect, useContext } from 'react'
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { sanitizeProfile } from '../lib/validate.js'
import { assessDataQuality } from '../lib/intelligence.js'
import { exportAllData, importAllData } from '../lib/storage.js'
import { exportAthleteData, deleteAthleteData, triggerDownload } from '../lib/gdprExport.js'
import { logAction, getMyAuditLog } from '../lib/db/auditLog.js'
import { hasCurrentConsent, withdrawConsent } from '../lib/db/consentVersion.js'
import { logConsent } from '../lib/db/consent.js'
import { generateSeasonReport } from '../lib/pdfReport.js'
import { getTierSync, isFeatureGated, getUpgradePrompt } from '../lib/subscription.js'
import { isSupabaseReady } from '../lib/supabase.js'
import NotificationSettings from './NotificationSettings.jsx'
import DeviceSync from './DeviceSync.jsx'
import MVHealth from './admin/MVHealth.jsx'
import QueueStats from './admin/QueueStats.jsx'
import AthleteOSCosts from './AthleteOSCosts.jsx'
import ActivityHeatmap from './ActivityHeatmap.jsx'
import StravaConnect from './profile/StravaConnect.jsx'
import NotifReminders from './profile/NotifReminders.jsx'
import WeightHydration from './profile/WeightHydration.jsx'
import BodyComp from './profile/BodyComp.jsx'
import AthleteCard from './profile/AthleteCard.jsx'
import CoachMessagesCard from './profile/CoachMessagesCard.jsx'
import Achievements from './Achievements.jsx'
import AISettings from './profile/AISettings.jsx'
import SportSelector from './profile/SportSelector.jsx'
import HuseyinCoachCard from './profile/HuseyinCoachCard.jsx'
import NutritionEstimator from './profile/NutritionEstimator.jsx'
import TrainingAgeCard from './profile/TrainingAgeCard.jsx'
import ReferralCard from './profile/ReferralCard.jsx'
import AdminCodeGenerator from './profile/AdminCodeGenerator.jsx'
import DataPrivacySettings from './profile/DataPrivacySettings.jsx'

export default function Profile({ log, authUser }) {
  const { t } = useContext(LangCtx)
  const { profile, setProfile, recovery, testResults } = useData()
  const [local, setLocal] = useState(profile)
  const [status, setStatus] = useState(null)
  const [coachMode, setCoachMode] = useLocalStorage('sporeus-coach-mode', false)

  useEffect(()=>{ setLocal(profile) },[profile])

  const save = () => { setProfile(sanitizeProfile(local)); setStatus('saved'); setTimeout(()=>setStatus(null),2000) }

  const share = async () => {
    const text=`${local.name||'Athlete'} | ${local.sport||''} | VO\u2082max: ${local.vo2max||'?'} | FTP: ${local.ftp||'?'}W | Goal: ${local.goal||''} — via Sporeus Athlete Console`
    try {
      if (navigator.share) {
        await navigator.share({ title:'Sporeus Athlete Profile', text, url:'https://sporeus.com' })
      } else {
        await navigator.clipboard.writeText(text)
        setStatus('copied'); setTimeout(()=>setStatus(null),2000)
      }
    } catch (e) { logger.warn('share:', e.message) }
  }

  const FIELDS = [
    {k:'name',lk:'nameL',ph:'Athlete name'},{k:'age',lk:'ageL',ph:'32',type:'number'},
    {k:'height',lk:'heightCmL',ph:'175',type:'number'},{k:'weight',lk:'weightL',ph:'70',type:'number'},
    {k:'maxhr',lk:'maxHRIn',ph:'185',type:'number'},{k:'ftp',lk:'ftpL',ph:'280',type:'number'},
    {k:'vo2max',lk:'vo2L',ph:'55',type:'number'},{k:'threshold',lk:'threshPaceL',ph:'4:30'},
    {k:'goal',lk:'goalL',ph:'Sub-3h marathon Istanbul 2026'},
    {k:'weeklyTssGoal',lk:'weeklyTssGoalL',ph:'e.g. 400',type:'number'},
    {k:'raceDate',lk:'profileRaceDate',ph:'',type:'date'},
  ]

  const handleExport = () => {
    const json = exportAllData()
    const blob = new Blob([json], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0,10)
    a.href = url; a.download = `sporeus-backup-${date}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const ok = importAllData(ev.target.result)
      if (ok) window.location.reload()
      else alert('Import failed — invalid file.')
    }
    reader.readAsText(file)
  }

  const handleReset = () => {
    if (confirm('Delete ALL Sporeus data? This cannot be undone.')) {
      Object.keys(localStorage).filter(k=>k.startsWith('sporeus')).forEach(k=>localStorage.removeItem(k))
      window.location.reload()
    }
  }

  const [gdprStatus, setGdprStatus] = useState(null)
  const [auditLog, setAuditLog]     = useState(null) // null=not loaded, []|[...]=loaded
  const [aiTone, setAiTone] = useState(() => { try { return localStorage.getItem('sporeus-ai-tone') || 'motivating' } catch { return 'motivating' } })
  const [marketingConsent, setMarketingConsent] = useState(() => { try { return localStorage.getItem('sporeus-marketing-consent') === '1' } catch { return false } })
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showErrorLog, setShowErrorLog] = useState(false)
  const [dqOpen, setDqOpen] = useState(false)

  const handleGdprDownload = async () => {
    setGdprStatus('exporting')
    try {
      const data = await exportAthleteData(authUser?.id || 'local')
      triggerDownload(data, `sporeus-my-data-${new Date().toISOString().slice(0,10)}.json`)
      if (authUser?.id) logAction('export', 'all_tables', authUser.id)
      setGdprStatus('done')
    } catch (e) {
      setGdprStatus('error')
    }
    setTimeout(() => setGdprStatus(null), 3000)
  }

  const handleGdprDelete = async () => {
    if (!confirm('Permanently delete ALL your Sporeus data? This cannot be undone.')) return
    if (!authUser?.id) { alert('You must be signed in to delete your account data.'); return }
    setGdprStatus('deleting')
    try {
      await deleteAthleteData(authUser.id)
      Object.keys(localStorage).filter(k=>k.startsWith('sporeus')).forEach(k=>localStorage.removeItem(k))
      setGdprStatus('deleted')
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      setGdprStatus('error')
    }
  }

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('profileTitle')}</div>
        <div style={S.row}>
          {FIELDS.map(f=>(
            <div key={f.k} style={{ flex:'1 1 200px' }}>
              <label style={S.label}>{t(f.lk)}</label>
              <input style={S.input} type={f.type||'text'} placeholder={f.ph}
                value={local[f.k]||''} onChange={e=>setLocal({...local,[f.k]:e.target.value})}/>
            </div>
          ))}
        </div>
        <SportSelector local={local} setLocal={setLocal}/>
        <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
          <button style={S.btn} onClick={save}>{status==='saved'?t('savedMsg'):t('saveProfileBtn')}</button>
          <button style={S.btnSec} onClick={share}>{status==='copied'?t('copiedMsg'):t('shareBtn')}</button>
        </div>
      </div>

      <HuseyinCoachCard/>

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={S.cardTitle}>{t('aboutTitle')}</div>
        <div style={{ fontSize:'14px', lineHeight:1.8, color:'var(--text)' }}>
          <p style={{ marginTop:0 }}>A Bloomberg Terminal-inspired training console for endurance athletes. Science-based periodization, power analysis, HRV readiness, and race intelligence — all in one PWA.</p>
          <p style={{ marginBottom:0 }}>
            <a href="https://sporeus.com/huseyin-akbulut/" target="_blank" rel="noreferrer"
              style={{ color:'#0064ff', textDecoration:'none', fontWeight:600 }}>H\u00fcseyin Akbulut</a>
            {' '}\u2014 BSc &amp; MSc Sport Science, Marmara University \u00b7{' '}
            <a href="https://sporeus.com" target="_blank" rel="noreferrer" style={{ color:'#ff6600', textDecoration:'none' }}>sporeus.com</a>
          </p>
        </div>
      </div>

      <TrainingAgeCard log={log} profile={local}/>
      <AthleteCard profile={local} log={log}/>

      {isSupabaseReady() && authUser && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'63ms', borderLeft:'3px solid #fc4c02' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
            <div style={{ ...S.cardTitle, marginBottom:0, borderBottom:'none', paddingBottom:0 }}>STRAVA SYNC</div>
            <span style={{ ...S.mono, fontSize:'9px', color:'#fc4c02', border:'1px solid #fc4c02', padding:'2px 6px', borderRadius:'2px', letterSpacing:'0.06em' }}>PHASE 3</span>
          </div>
          <StravaConnect userId={authUser.id}/>
        </div>
      )}

      <div className="sp-card" style={{ ...S.card, animationDelay:'65ms' }}>
        <div style={S.cardTitle}>REMINDERS &amp; NOTIFICATIONS</div>
        <NotifReminders authUser={authUser}/>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'75ms' }}>
        <div style={S.cardTitle}>{t('bodyCompTitle')}</div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginBottom:'12px' }}>{t('navyMethodNote')}</div>
        <BodyComp profile={local} setProfile={setLocal}/>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'85ms' }}>
        <div style={S.cardTitle}>{t('nutritionTitle')}</div>
        <NutritionEstimator profile={local}/>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'92ms' }}>
        <div style={S.cardTitle}>{t('weightTitle')}</div>
        <WeightHydration profile={local}/>
      </div>

      <div className="sp-card" style={{ ...S.card, background:'#0a0a0a', animationDelay:'100ms' }}>
        <div style={{ ...S.cardTitle, color:'#ff6600', borderColor:'#333' }}>{t('installTitle')}</div>
        <div style={{ ...S.mono, fontSize:'12px', lineHeight:1.9, color:'#ccc' }}>
          <div>📱 <strong style={{ color:'#fff' }}>iOS:</strong> Safari \u2192 Share \u2192 Add to Home Screen</div>
          <div>🤖 <strong style={{ color:'#fff' }}>Android:</strong> Chrome menu \u2192 Install App</div>
          <div>💻 <strong style={{ color:'#fff' }}>Desktop:</strong> Address bar \u2192 Install icon</div>
          <div style={{ color:'var(--sub)', fontSize:'10px', marginTop:'6px' }}>Works fully offline once installed.</div>
        </div>
      </div>

      {log && log.length > 0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'105ms' }}>
          <div style={S.cardTitle}>TRAINING HEATMAP</div>
          <ActivityHeatmap log={log} />
        </div>
      )}

      <div className="sp-card" style={{ ...S.card, animationDelay:'108ms', borderLeft:`3px solid ${coachMode?'#0064ff':'var(--border)'}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={S.cardTitle}>COACH MODE</div>
          <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', ...S.mono, fontSize:'11px', color:coachMode?'#0064ff':'var(--muted)' }}>
            <input type="checkbox" checked={coachMode} onChange={e=>setCoachMode(e.target.checked)} style={{ accentColor:'#0064ff', width:'16px', height:'16px' }}/>
            {coachMode ? '◈ ACTIVE' : 'OFF'}
          </label>
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'6px', lineHeight:1.6 }}>
          Import athlete JSON exports and view their dashboards, create plans, track compliance.
          <br/>File-based · No server · No API keys · Zero tracking
        </div>
      </div>

      <CoachMessagesCard/>

      <div className="sp-card" style={{ ...S.card, animationDelay:'110ms' }}>
        <div style={S.cardTitle}>DATA MANAGEMENT</div>
        {/* Storage monitor */}
        {(() => {
          try {
            const bytes = Object.keys(localStorage)
              .filter(k => k.startsWith('sporeus'))
              .reduce((s, k) => s + (localStorage.getItem(k) || '').length * 2, 0)
            const kb = Math.round(bytes / 1024)
            const pct = Math.min(100, Math.round(bytes / (5 * 1048576) * 100))
            const color = pct < 40 ? '#5bc25b' : pct < 75 ? '#f5c542' : '#e03030'
            const topKeys = Object.keys(localStorage)
              .filter(k => k.startsWith('sporeus'))
              .map(k => ({ k, size: (localStorage.getItem(k) || '').length * 2 }))
              .sort((a, b) => b.size - a.size).slice(0, 3)
            return (
              <div style={{ marginBottom:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'11px', marginBottom:'4px' }}>
                  <span style={{ color:'var(--muted)' }}>Storage used</span>
                  <span style={{ color }}>{kb} KB / ~5 MB ({pct}%)</span>
                </div>
                <div style={{ height:'6px', borderRadius:'3px', background:'var(--border)', overflow:'hidden', marginBottom:'6px' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:color, transition:'width 400ms' }}/>
                </div>
                <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>
                  {topKeys.map(({ k, size }) => `${k.slice(7)}: ${Math.round(size/1024)}KB`).join(' · ')}
                </div>
              </div>
            )
          } catch (e) { logger.warn('localStorage:', e.message); return null }
        })()}
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <button style={S.btn} onClick={handleExport}>↓ Export All Data</button>
          <label style={{ ...S.btnSec, cursor:'pointer', display:'inline-flex', alignItems:'center' }}>
            ↑ Import Data
            <input type="file" accept=".json" onChange={handleImport} style={{ display:'none' }}/>
          </label>
          <button style={{ ...S.btnSec, color:'#e03030', borderColor:'#e03030' }} onClick={handleReset}>✕ Reset All Data</button>
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'10px' }}>
          Export backs up all training data, plans, and settings as JSON. Import restores a previous backup.
        </div>

        {/* Season Report PDF */}
        {(() => {
          const tier = getTierSync()
          const gated = isFeatureGated('export_pdf', tier)
          return (
            <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid var(--border)' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.1em', marginBottom:'8px' }}>◈ SEASON REPORT</div>
              {gated ? (
                <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542' }}>{getUpgradePrompt('export_pdf')}</div>
              ) : (
                <button
                  style={{ ...S.btnSec, fontSize:'9px', padding:'4px 12px' }}
                  onClick={() => {
                    try {
                      const recovery = JSON.parse(localStorage.getItem('sporeus-recovery') || '[]')
                      const html = generateSeasonReport(
                        { name: local.name, sport: local.sport || local.primarySport },
                        log || [],
                        recovery,
                      )
                      const win = window.open('', '_blank')
                      if (win) { win.document.write(html); win.document.close(); win.print() }
                    } catch (e) { logger.warn('caught:', e.message) }
                  }}
                >
                  ↓ Download Season Report
                </button>
              )}
            </div>
          )
        })()}

        {/* Data & Privacy — KVKK/GDPR data rights */}
        {authUser && (
          <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid var(--border)' }}>
            <DataPrivacySettings authUser={authUser} />
          </div>
        )}

        {/* PRIVACY Dashboard */}
        <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid var(--border)' }}>
          <button
            onClick={() => setShowPrivacy(s => !s)}
            style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.1em', marginBottom:'8px', background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:'6px' }}
          >
            {showPrivacy ? '▴' : '▾'} ◈ PRIVACY DASHBOARD
          </button>
          {showPrivacy && (
            <div style={{ marginTop:'8px' }}>
              {/* Consent status */}
              <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginBottom:'10px' }}>
                Data processing consent: {hasCurrentConsent() ? '✓ v1.1 — accepted' : '✗ Not given'}
              </div>

              {/* Withdraw consent */}
              {hasCurrentConsent() && (
                <button
                  onClick={() => {
                    if (window.confirm('Withdraw KVKK/GDPR consent? The app will reload and ask for consent again before you can use it.')) {
                      withdrawConsent()
                      window.location.reload()
                    }
                  }}
                  style={{ ...S.mono, fontSize:'10px', color:'#ff4444', background:'transparent', border:'1px solid #ff444440', borderRadius:'3px', padding:'4px 10px', cursor:'pointer', marginBottom:'10px' }}
                >
                  Withdraw consent
                </button>
              )}

              {/* Data retention */}
              <div style={{ ...S.mono, fontSize:'10px', color:'#555', marginBottom:'10px', lineHeight:1.6 }}>
                Your training data is retained for 3 years from last activity per KVKK Art. 7.
              </div>

              {/* Marketing consent toggle */}
              <div style={{ marginBottom:'12px' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={async (e) => {
                      const val = e.target.checked
                      setMarketingConsent(val)
                      try { localStorage.setItem('sporeus-marketing-consent', val ? '1' : '0') } catch (e) { logger.warn('localStorage:', e.message) }
                      if (val && authUser?.id) {
                        await logConsent(authUser.id, 'marketing', '1.0')
                      }
                    }}
                    style={{ accentColor:'#ff6600' }}
                  />
                  <span style={{ ...S.mono, fontSize:'10px', color:'#aaa' }}>
                    Marketing emails: {marketingConsent ? 'opted in' : 'not opted in'}
                  </span>
                </label>
              </div>

              {/* Data categories */}
              <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.08em', marginBottom:'6px' }}>DATA CATEGORIES PROCESSED</div>
              <ul style={{ ...S.mono, fontSize:'10px', color:'#666', margin:0, paddingLeft:'16px', lineHeight:1.8 }}>
                <li>Training sessions (date, TSS, duration, RPE, notes)</li>
                <li>Recovery scores (sleep, mood, soreness, stress)</li>
                <li>GPS/route data (if GPX imported)</li>
                <li>Profile data (name, sport, age)</li>
              </ul>
            </div>
          )}
        </div>

        {/* Activity log (audit_log) */}
        {authUser && (
          <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid var(--border)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.1em' }}>◈ ACTIVITY LOG</div>
              {auditLog === null && (
                <button
                  style={{ ...S.btnSec, fontSize:'9px', padding:'3px 10px' }}
                  onClick={async () => {
                    const { data } = await getMyAuditLog(authUser.id, 20)
                    setAuditLog(data || [])
                  }}
                >
                  LOAD
                </button>
              )}
            </div>
            {auditLog !== null && (
              auditLog.length === 0 ? (
                <div style={{ ...S.mono, fontSize:'10px', color:'#555' }}>No audit entries yet.</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'10px' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid var(--border)', color:'#555', fontSize:'9px', letterSpacing:'0.06em' }}>
                        {['DATE','ACTION','TABLE','RECORD'].map(h => (
                          <th key={h} style={{ textAlign:'left', padding:'3px 8px 6px 0', fontWeight:600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map(row => (
                        <tr key={row.id} style={{ borderBottom:'1px solid #1a1a1a' }}>
                          <td style={{ padding:'4px 8px 4px 0', color:'var(--sub,#aaa)', whiteSpace:'nowrap' }}>{row.created_at?.slice(0,16)}</td>
                          <td style={{ padding:'4px 8px 4px 0', color: row.action === 'erase' ? '#e03030' : row.action === 'export' ? '#f5c542' : '#888' }}>{row.action.toUpperCase()}</td>
                          <td style={{ padding:'4px 8px 4px 0' }}>{row.table_name}</td>
                          <td style={{ padding:'4px 8px 4px 0', color:'#666', maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.record_id || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* AI Settings */}
      {authUser && (
        <div style={S.card}>
          <div style={S.cardTitle}>AI SETTINGS</div>
          <AISettings authUser={authUser} />

          {/* AI Tone Preference */}
          <div style={{ marginTop:'16px', paddingTop:'12px', borderTop:'1px solid #1e1e1e' }}>
            <div style={{ fontSize:'10px', fontWeight:700, color:'#ccc', marginBottom:'8px', letterSpacing:'0.08em' }}>
              AI TONE
            </div>
            {['Motivating', 'Clinical', 'Concise'].map(tone => (
              <label key={tone} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', cursor:'pointer' }}>
                <input
                  type="radio"
                  name="ai-tone"
                  value={tone.toLowerCase()}
                  checked={aiTone === tone.toLowerCase()}
                  onChange={() => {
                    try { localStorage.setItem('sporeus-ai-tone', tone.toLowerCase()) } catch (e) { logger.warn('localStorage:', e.message) }
                    setAiTone(tone.toLowerCase())
                  }}
                />
                <span style={{ fontSize:'11px', color:'#aaa' }}>{tone}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Refer a club — coach/club tier only */}
      <ReferralCard authUser={authUser} />

      <NotificationSettings />
      <DeviceSync userId={authUser?.id} />

      {/* Admin error log — only shown to admin */}
      {(profile?.name === 'Hüseyin' || profile?.isAdmin ||
        local.name?.toLowerCase().includes('hüseyin') || local.name?.toLowerCase().includes('huseyin')) && (() => {
        const errors = JSON.parse(localStorage.getItem('sporeus-error-log') || '[]').slice(-10).reverse()
        const btnStyle = { ...S.mono, fontSize:'10px', padding:'5px 12px', cursor:'pointer', borderRadius:'3px' }
        return (
          <div style={{ ...S.card, marginTop:'16px', paddingTop:'16px', borderTop:'1px solid #333' }}>
            <button onClick={() => setShowErrorLog(s => !s)} style={{ ...btnStyle, background:'none', color:'#555', border:'1px solid #333' }}>
              {showErrorLog ? '▴' : '▾'} ERROR LOG ({errors.length})
            </button>
            {showErrorLog && (errors.length === 0 ? (
              <div style={{ ...S.mono, fontSize:'10px', color:'#444', marginTop:'8px' }}>No errors logged.</div>
            ) : errors.map((e, i) => (
              <div key={i} style={{ marginTop:'6px', fontSize:'9px', color:'#444', borderBottom:'1px solid #111', paddingBottom:'4px', ...S.mono }}>
                <span style={{ color:'#e03030' }}>{e.ts?.slice(0,19)}</span> · {e.tabName} · {e.error?.slice(0,100)}
              </div>
            )))}
          </div>
        )
      })()}

      {/* Admin code generator — only shown to Hüseyin */}
      {(authUser?.email === 'huseyinakbulut71@gmail.com' || authUser?.email === 'huseyinakbulut@marun.edu.tr') && (
        <AdminCodeGenerator/>
      )}

      {/* Admin infra panels — MV health + queue depth (admin email only) */}
      {(authUser?.email === 'huseyinakbulut71@gmail.com' || authUser?.email === 'huseyinakbulut@marun.edu.tr') && (() => {
        const adminLang = localStorage.getItem('sporeus-lang') || 'en'
        const adminProfile = { role: 'admin' }
        return (
          <>
            <div style={{ ...S.card, marginTop: '16px' }}>
              <MVHealth authProfile={adminProfile} lang={adminLang} />
            </div>
            <div style={{ ...S.card, marginTop: '12px' }}>
              <QueueStats authProfile={adminProfile} lang={adminLang} />
            </div>
          </>
        )
      })()}

      {/* AthleteOS developer reference — Cost Cuts + Prompt Library */}
      {(authUser?.email === 'huseyinakbulut71@gmail.com' || authUser?.email === 'huseyinakbulut@marun.edu.tr') && (
        <AthleteOSCosts />
      )}

      {/* Data quality indicator — H5 */}
      {log && log.length >= 3 && (() => {
        const dq    = assessDataQuality(log, recovery || [], testResults || [], profile)
        const color = dq.score >= 80 ? '#5bc25b' : dq.score >= 60 ? '#f5c542' : '#e03030'
        return (
          <div style={{ ...S.card, borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setDqOpen(o => !o)}>
              <div>
                <div style={{ ...S.cardTitle, marginBottom: 2 }}>DATA QUALITY</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 700, color, fontFamily: "'IBM Plex Mono', monospace" }}>{dq.grade}</span>
                  <span style={{ fontSize: '11px', color: '#888', fontFamily: "'IBM Plex Mono', monospace" }}>{dq.score}/100</span>
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#555' }}>{dqOpen ? '▲' : '▼'}</span>
            </div>
            {dqOpen && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {dq.factors.map(f => (
                    <div key={f.name} style={{ fontSize: '9px', padding: '3px 8px', border: `1px solid ${f.score >= 70 ? '#5bc25b33' : f.score >= 50 ? '#f5c54233' : '#e0303033'}`, borderRadius: '2px', color: f.score >= 70 ? '#5bc25b' : f.score >= 50 ? '#f5c542' : '#e03030', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {f.name} {f.score}
                    </div>
                  ))}
                </div>
                {dq.tips.slice(0, 3).map((tip, i) => (
                  <div key={i} style={{ fontSize: '10px', color: '#888', lineHeight: 1.6, marginBottom: '4px', paddingLeft: '10px', borderLeft: '2px solid #333', fontFamily: "'IBM Plex Mono', monospace" }}>
                    → {(localStorage.getItem('sporeus-lang') || 'en') === 'tr' ? tip.tr : tip.en}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Training milestones — logbook, not reward screen */}
      {log && log.length > 0 && (() => {
        const [dark] = [JSON.parse(localStorage.getItem('sporeus-dark') || 'false')]
        const [lang] = [localStorage.getItem('sporeus-lang') || 'en']
        return (
          <div style={S.card}>
            <Achievements log={log} dark={dark} lang={lang} />
          </div>
        )
      })()}
    </div>
  )
}
