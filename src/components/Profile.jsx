import { useState, useEffect, useContext, useCallback } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { ACTIVITY_MULTS, SPORT_BRANCHES, TRIATHLON_TYPES, ATHLETE_LEVELS } from '../lib/constants.js'
import { navyBF, mifflinBMR, calcLoad, generateUnlockCode, FREE_ATHLETE_LIMIT } from '../lib/formulas.js'
import { sanitizeProfile } from '../lib/validate.js'
import { exportAllData, importAllData } from '../lib/storage.js'
import { exportAthleteData, deleteAthleteData, triggerDownload } from '../lib/gdprExport.js'
import { logAction, getMyAuditLog } from '../lib/db/auditLog.js'
import { hasCurrentConsent, withdrawConsent } from '../lib/db/consentVersion.js'
import { logConsent } from '../lib/db/consent.js'
import { generateSeasonReport } from '../lib/pdfReport.js'
import { getTierSync, isFeatureGated, getUpgradePrompt } from '../lib/subscription.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import NotificationSettings from './NotificationSettings.jsx'
import DeviceSync from './DeviceSync.jsx'
import AthleteOSCosts from './AthleteOSCosts.jsx'
import ActivityHeatmap from './ActivityHeatmap.jsx'
import StravaConnect from './profile/StravaConnect.jsx'
import NotifReminders from './profile/NotifReminders.jsx'
import WeightHydration from './profile/WeightHydration.jsx'
import { clearInsightCache } from '../lib/aiPrompts.js'
import { generateReferralCode, getReferralStats } from '../lib/referral.js'
import Achievements from './Achievements.jsx'

// ─── AI Settings Panel ────────────────────────────────────────────────────────
// API key is managed server-side (ai-proxy edge function). This panel shows
// subscription tier (read from DB) and daily usage, plus cache controls.
function AISettings({ authUser }) {
  const [tier, setTierState] = useState('loading')
  const [dailyUsed, setDailyUsed] = useState(0)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    if (!isSupabaseReady() || !authUser) return
    // Read authoritative tier from DB
    supabase.from('profiles').select('subscription_tier').eq('id', authUser.id).maybeSingle()
      .then(({ data }) => {
        const t = data?.subscription_tier || 'free'
        setTierState(t)
        try { localStorage.setItem('sporeus-tier', t) } catch {}
      })
    // Read today's AI usage count
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('ai_insights').select('*', { count: 'exact', head: true })
      .eq('athlete_id', authUser.id).eq('date', today)
      .then(({ count }) => setDailyUsed(count || 0))
  }, [authUser?.id])

  if (!isSupabaseReady() || !authUser) return (
    <div style={{ ...S.mono, fontSize:'11px', color:'#555', padding:'12px 0' }}>
      Sign in to view AI settings.
    </div>
  )

  const handleClearCache = async () => {
    await clearInsightCache(authUser.id)
    try { Object.keys(localStorage).filter(k => k.startsWith('sporeus-ai-')).forEach(k => localStorage.removeItem(k)) } catch {}
    setCleared(true)
    setTimeout(() => setCleared(false), 3000)
  }

  const TIER_INFO = {
    free:  { label: 'Free',  limit: 0,   desc: 'Rule-based insights only' },
    coach: { label: 'Coach', limit: 50,  desc: '50 AI calls/day' },
    club:  { label: 'Club',  limit: 500, desc: '500 AI calls/day' },
  }
  const info = TIER_INFO[tier] || TIER_INFO.free

  return (
    <div style={{ marginTop:'8px' }}>
      {/* Tier display */}
      <div style={{ marginBottom:'14px' }}>
        <label style={{ ...S.label, marginBottom:'6px' }}>SUBSCRIPTION TIER</label>
        <div style={{ ...S.mono, fontSize:'12px', color:'#ff6600', fontWeight:600 }}>
          {tier === 'loading' ? '…' : info.label.toUpperCase()}
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#555', marginTop:'3px' }}>{info.desc}</div>
        {info.limit > 0 && (
          <div style={{ ...S.mono, fontSize:'10px', color:'#555', marginTop:'3px' }}>
            Today: {dailyUsed} / {info.limit} calls used
          </div>
        )}
        {tier === 'free' && (
          <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', marginTop:'6px' }}>
            Upgrade to Coach or Club at sporeus.com to enable AI insights.
          </div>
        )}
      </div>

      {/* Clear cache */}
      <div>
        <button onClick={handleClearCache} style={{ ...S.btnSec, fontSize:'11px', padding:'6px 14px' }}>
          {cleared ? '✓ Cache cleared' : 'Clear AI cache'}
        </button>
        <div style={{ ...S.mono, fontSize:'9px', color:'#444', marginTop:'4px' }}>Removes cached AI insights — next load will re-fetch.</div>
      </div>
    </div>
  )
}

function SportSelector({ local, setLocal }) {
  const { t } = useContext(LangCtx)
  const primary = local.primarySport || ''
  const triType = local.triathlonType || 'olympic'
  const secondary = local.secondarySports || []
  const level = local.athleteLevel || ''

  const setPrimary = id => {
    const branch = SPORT_BRANCHES.find(b=>b.id===id)
    setLocal(prev=>({...prev, primarySport:id, sport:branch?.label||id}))
  }
  const setTriType = id => setLocal(prev=>({...prev, triathlonType:id}))
  const toggleSec = id => {
    const cur = local.secondarySports||[]
    setLocal(prev=>({...prev, secondarySports: cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]}))
  }
  const setLevel = id => setLocal(prev=>({...prev, athleteLevel:id}))

  const pillStyle = (active, col='#ff6600') => ({
    ...S.mono, fontSize:'11px', padding:'5px 10px', borderRadius:'3px', cursor:'pointer',
    border:`1px solid ${active?col:'var(--border)'}`,
    background:active?col+'22':'transparent',
    color:active?col:'var(--muted)', fontWeight:active?600:400,
  })

  return (
    <div style={{marginTop:'16px'}}>
      <label style={S.label}>{t('primarySportL')}</label>
      <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'12px'}}>
        {SPORT_BRANCHES.map(b=>(
          <button key={b.id} style={pillStyle(primary===b.id)} onClick={()=>setPrimary(b.id)}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      {primary==='triathlon' && (
        <div style={{marginBottom:'12px'}}>
          <label style={S.label}>{t('triathlonTypeL')}</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {TRIATHLON_TYPES.map(tt=>(
              <button key={tt.id} style={pillStyle(triType===tt.id,'#0064ff')} onClick={()=>setTriType(tt.id)}>
                {tt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(primary==='triathlon'||primary==='hybrid') && (
        <div style={{marginBottom:'12px'}}>
          <label style={S.label}>{t('secondarySportsL')}</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {SPORT_BRANCHES.filter(b=>b.id!==primary&&b.id!=='hybrid'&&b.id!=='other').map(b=>(
              <button key={b.id} style={pillStyle(secondary.includes(b.id),'#5bc25b')} onClick={()=>toggleSec(b.id)}>
                {b.icon} {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <label style={S.label}>{t('athleteLevelL')}</label>
      <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
        {ATHLETE_LEVELS.map(lv=>(
          <button key={lv.id} style={pillStyle(level===lv.id,'#4a90d9')} onClick={()=>setLevel(lv.id)}>
            {lv.label}
            <span style={{color:'#777',fontSize:'9px',marginLeft:'5px'}}>{lv.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function HuseyinCoachCard() {
  const { t } = useContext(LangCtx)
  const [myCoach, setMyCoach] = useLocalStorage('sporeus-my-coach', null)
  const connected = !!myCoach
  const isHuseyin = !myCoach || myCoach === 'huseyin-sporeus'

  const sendData = () => {
    const raw = exportAllData()
    const parsed = JSON.parse(raw)
    parsed.coachId = myCoach || 'huseyin-sporeus'
    parsed.coachExport = true
    const blob = new Blob([JSON.stringify(parsed,null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`sporeus-for-coach-${new Date().toISOString().slice(0,10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="sp-card" style={{...S.card, animationDelay:'48ms', borderLeft:`3px solid ${connected?'#5bc25b':'#ff6600'}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
        <div style={S.cardTitle}>{t('coachCardTitle')}</div>
        {connected && <span style={{...S.mono,fontSize:'10px',color:'#5bc25b',fontWeight:600}}>◈ CONNECTED</span>}
      </div>
      <div style={{display:'flex',gap:'14px',marginBottom:'14px'}}>
        <div style={{width:'52px',height:'52px',borderRadius:'4px',background:'#0a0a0a',border:'1px solid #333',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,...S.mono,fontSize:'16px',fontWeight:700,color:'#ff6600',letterSpacing:'-1px'}}>
          HA
        </div>
        <div>
          <div style={{...S.mono,fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'4px'}}>
            {isHuseyin ? 'HÜSEYİN AKBULUT' : myCoach}
          </div>
          <div style={{...S.mono,fontSize:'10px',color:'#888',lineHeight:1.8}}>
            {isHuseyin ? <>MSc Sport Science · Marmara University<br/>Uzmanlık: Dayanıklılık · Triatlon · Periyodizasyon</> : 'Connected coach · Sporeus Athlete Console'}
          </div>
        </div>
      </div>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        {!connected ? (
          <button style={S.btn} onClick={()=>setMyCoach('huseyin-sporeus')}>{t('connectCoachBtn')}</button>
        ) : (
          <>
            <button style={{...S.btn,background:'#5bc25b',borderColor:'#5bc25b'}} onClick={sendData}>
              ↓ {t('sendDataCoachBtn')}
            </button>
            <a href="https://sporeus.com/huseyin-akbulut/" target="_blank" rel="noreferrer"
              style={{...S.btnSec,textDecoration:'none',display:'inline-flex',alignItems:'center',color:'var(--text)'}}>
              PROFILE →
            </a>
            <button style={{...S.btnSec,color:'#e03030',borderColor:'#e03030'}} onClick={()=>setMyCoach(null)}>
              {t('disconnectCoachBtn')}
            </button>
          </>
        )}
      </div>
      {connected && (
        <div style={{...S.mono,fontSize:'10px',color:'#888',marginTop:'10px',lineHeight:1.6}}>
          {t('coachConnectNote')}
        </div>
      )}
    </div>
  )
}

function BodyComp({ profile, setProfile }) {
  const { t } = useContext(LangCtx)
  const [gender, setGender] = useState(profile.gender||'male')
  const [neck,   setNeck]   = useState(profile.neck||'')
  const [waist,  setWaist]  = useState(profile.waist||'')
  const [hip,    setHip]    = useState(profile.hip||'')
  const [result, setResult] = useState(null)
  const [compErr, setCompErr] = useState('')

  const calc = () => {
    setCompErr('')
    const h=parseFloat(profile.height||0), w=parseFloat(profile.weight||0)
    const n=parseFloat(neck), wa=parseFloat(waist), hi=parseFloat(hip)
    const missing = []
    if (!h) missing.push('height (in profile)')
    if (!w) missing.push('weight (in profile)')
    if (!n) missing.push('neck')
    if (!wa) missing.push('waist')
    if (gender==='female'&&!hi) missing.push('hip')
    if (missing.length) { setCompErr(`Missing: ${missing.join(', ')}`); return }
    const bf = navyBF(n, wa, hi, h, gender)
    const fat = Math.round(w * bf / 100 * 10) / 10
    const lean = Math.round((w - fat) * 10) / 10
    const bmi = Math.round(w / Math.pow(h/100, 2) * 10) / 10
    setResult({ bf, fat, lean, bmi, leanPct: Math.round(lean/w*100) })
    setProfile(prev => ({ ...prev, gender, neck:String(n), waist:String(wa), hip:String(hi) }))
  }

  return (
    <div>
      <div style={S.row}>
        <div style={{ flex:'1 1 120px' }}>
          <label style={S.label}>{t('genderL')}</label>
          <select style={S.select} value={gender} onChange={e=>setGender(e.target.value)}>
            <option value="male">Male / Erkek</option>
            <option value="female">Female / Kadın</option>
          </select>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>{t('neckL')}</label>
          <input style={S.input} type="number" placeholder="37" value={neck} onChange={e=>setNeck(e.target.value)}/>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>{t('waistL')}</label>
          <input style={S.input} type="number" placeholder="82" value={waist} onChange={e=>setWaist(e.target.value)}/>
        </div>
        {gender==='female' && (
          <div style={{ flex:'1 1 100px' }}>
            <label style={S.label}>{t('hipL')}</label>
            <input style={S.input} type="number" placeholder="98" value={hip} onChange={e=>setHip(e.target.value)}/>
          </div>
        )}
      </div>
      <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'6px', marginBottom:'12px' }}>
        Uses HEIGHT & WEIGHT from profile above.
      </div>
      <button style={S.btn} onClick={calc}>{t('calcCompBtn')}</button>
      {compErr && <div style={{ ...S.mono, fontSize:'11px', color:'#e03030', marginTop:'8px' }}>⚠ {compErr}</div>}
      {result && (
        <div style={{ marginTop:'16px' }}>
          <div style={S.row}>
            {[
              {l:t('bfPctL'), v:`${result.bf}%`, c:'#f08c00'},
              {l:t('leanMassL'), v:`${result.lean} kg`, c:'#5bc25b'},
              {l:t('fatMassL'), v:`${result.fat} kg`, c:'#e03030'},
              {l:t('bmiLbl'), v:result.bmi, c:'#4a90d9'},
            ].map(({l,v,c})=>(
              <div key={l} style={{ ...S.stat, flex:'1 1 90px' }}>
                <span style={{ ...S.statVal, color:c, fontSize:'18px' }}>{v}</span>
                <span style={S.statLbl}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'12px' }}>
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'4px' }}>LEAN vs FAT</div>
            <div style={{ display:'flex', height:'10px', borderRadius:'3px', overflow:'hidden', background:'var(--border)' }}>
              <div style={{ width:`${result.leanPct}%`, background:'#5bc25b', transition:'width 400ms ease-out' }}/>
              <div style={{ width:`${100-result.leanPct}%`, background:'#f08c00' }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'3px' }}>
              <span>Lean {result.leanPct}%</span><span>Fat {100-result.leanPct}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NutritionEstimator({ profile }) {
  const { t } = useContext(LangCtx)
  const [actIdx, setActIdx] = useState(2)
  const w = parseFloat(profile.weight||0), h = parseFloat(profile.height||0)
  const a = parseFloat(profile.age||0), g = profile.gender||'male'
  const bmr  = w&&h&&a ? mifflinBMR(w,h,a,g) : null
  const tdee = bmr ? Math.round(bmr * ACTIVITY_MULTS[actIdx].mult) : null
  const protLow = w ? Math.round(w*1.6) : null, protHi = w ? Math.round(w*2.2) : null
  const carbLow = w ? Math.round(w*5)   : null, carbHi  = w ? Math.round(w*7)   : null

  const fuelRows = [
    ['< 60 min', '30 g/hr'],
    ['60–150 min', '60 g/hr'],
    ['> 150 min', '90 g/hr (glucose+fructose mix)'],
  ]

  return (
    <div>
      {!bmr && (
        <div style={{ ...S.mono, fontSize:'11px', color:'#e03030', marginBottom:'12px' }}>
          Missing in profile: {[!w&&'weight',!h&&'height',!a&&'age'].filter(Boolean).join(', ') || 'gender'}. Add them above to see estimates.
        </div>
      )}
      <div style={{ flex:'1 1 220px', marginBottom:'14px' }}>
        <label style={S.label}>{t('activityL')}</label>
        <select style={S.select} value={actIdx} onChange={e=>setActIdx(+e.target.value)}>
          {ACTIVITY_MULTS.map((m,i)=><option key={i} value={i}>{m.label} (×{m.mult})</option>)}
        </select>
      </div>
      {bmr && (
        <>
          <div style={S.row}>
            {[
              {l:t('bmrL'),v:`${bmr} kcal`,c:'#4a90d9'},
              {l:t('tdeeL'),v:`${tdee} kcal`,c:'#ff6600'},
              {l:t('proteinL'),v:`${protLow}–${protHi}g`,c:'#5bc25b'},
              {l:t('carbL'),v:`${carbLow}–${carbHi}g`,c:'#f5c542'},
            ].map(({l,v,c})=>(
              <div key={l} style={{ ...S.stat, flex:'1 1 110px' }}>
                <span style={{ ...S.statVal, color:c, fontSize:'15px' }}>{v}</span>
                <span style={S.statLbl}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'6px', marginBottom:'14px' }}>
            Protein: 1.6–2.2 g/kg · Carbs: 5–7 g/kg (endurance) · Mifflin-St Jeor BMR
          </div>
          <div style={{ ...S.cardTitle, marginBottom:'8px' }}>{t('raceFuelTitle')}</div>
          <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', marginBottom:'8px' }}>
            {t('carbLoadL')}: <strong>8–12 g/kg/day</strong>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'11px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', color:'#888', fontSize:'9px' }}>
                <th style={{ textAlign:'left', padding:'4px 0 6px', fontWeight:600 }}>DURATION</th>
                <th style={{ textAlign:'right', padding:'4px 0 6px', fontWeight:600 }}>CARBS</th>
              </tr>
            </thead>
            <tbody>
              {fuelRows.map(([dur,carb])=>(
                <tr key={dur} style={{ borderBottom:'1px solid #f5f5f5' }}>
                  <td style={{ padding:'5px 0', color:'var(--sub)' }}>{dur}</td>
                  <td style={{ textAlign:'right', padding:'5px 0', color:'#ff6600', fontWeight:600 }}>{carb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ─── Training Age Card (v4.4) ─────────────────────────────────────────────────
function TrainingAgeCard({ log, profile }) {
  const { t } = useContext(LangCtx)
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const [trainingAge, setTrainingAge] = useLocalStorage('sporeus-training-age', '')

  if (!log.length) return null

  const ctl = (() => {
    if (!log.length) return 0
    const sorted = [...log].sort((a, b) => a.date > b.date ? 1 : -1)
    let c = 0
    for (const s of sorted) c = c + ((s.tss || 0) - c) / 42
    return Math.round(c)
  })()

  const ctlScale = [
    { min:0,  max:19,  label: lang==='tr' ? 'Yeni Başlayan' : 'Beginner',       color:'#888' },
    { min:20, max:39,  label: lang==='tr' ? 'Rekreasyonel'  : 'Recreational',   color:'#4a90d9' },
    { min:40, max:64,  label: lang==='tr' ? 'Rekabetçi'     : 'Competitive',     color:'#5bc25b' },
    { min:65, max:89,  label: lang==='tr' ? 'İleri Seviye'  : 'Advanced',        color:'#f5c542' },
    { min:90, max:999, label: lang==='tr' ? 'Elit'          : 'Elite',           color:'#ff6600' },
  ]
  const ctlLevel = ctlScale.find(l => ctl >= l.min && ctl <= l.max) || ctlScale[0]

  const ageOpts = ['< 1 year', '1–2 years', '3–5 years', '6–10 years', '10+ years']
  const ageTr   = ['< 1 yıl', '1–2 yıl', '3–5 yıl', '6–10 yıl', '10+ yıl']
  const ageContext = {
    '< 1 year': { en: 'Early adaptation phase — VO₂max responds fastest in the first year.', tr: 'Erken adaptasyon fazı — VO₂maks ilk yılda en hızlı gelişir.' },
    '1–2 years': { en: 'Neuromuscular efficiency improving — coordination gains are significant.', tr: 'Nöromüsküler verimlilik artıyor — koordinasyon kazanımları önemli.' },
    '3–5 years': { en: 'Aerobic base established — now responding to polarized high-intensity work.', tr: 'Aerobik baz kuruldu — artık polarize yüksek yoğunluklu çalışmaya yanıt veriyor.' },
    '6–10 years': { en: 'Mature athlete — marginal gains require precision periodization.', tr: 'Olgun sporcu — marjinal kazanımlar hassas periyodizasyon gerektirir.' },
    '10+ years': { en: 'Elite training age — longevity and health maintenance are key.', tr: 'Elit antrenman yaşı — uzun ömür ve sağlık koruması anahtar.' },
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'62ms' }}>
      <div style={S.cardTitle}>{t('trainingAgeTitle')}</div>
      <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'12px' }}>
        <div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'4px' }}>SELECT {lang==='tr'?'ANTRENMAN YAŞI':'TRAINING AGE'}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
            {ageOpts.map((opt, i) => (
              <button key={opt}
                style={{ ...S.mono, fontSize:'10px', padding:'4px 9px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${trainingAge===opt?'#ff6600':'var(--border)'}`, background:trainingAge===opt?'#ff660022':'transparent', color:trainingAge===opt?'#ff6600':'var(--muted)' }}
                onClick={() => setTrainingAge(opt)}>
                {lang==='tr' ? ageTr[i] : opt}
              </button>
            ))}
          </div>
        </div>
      </div>
      {trainingAge && ageContext[trainingAge] && (
        <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.7, marginBottom:'12px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px', borderLeft:'3px solid #ff6600' }}>
          ◈ {ageContext[trainingAge][lang] || ageContext[trainingAge].en}
        </div>
      )}
      <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'8px', letterSpacing:'0.06em' }}>{t('ctlScaleLabel')} (CURRENT CTL: {ctl})</div>
      <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
        {ctlScale.map(l => (
          <div key={l.label} style={{ flex:'1 1 60px', padding:'7px 8px', borderRadius:'4px', border:`1px solid ${ctl >= l.min && ctl <= l.max ? l.color : 'var(--border)'}`, background: ctl >= l.min && ctl <= l.max ? l.color + '22' : 'transparent', textAlign:'center' }}>
            <div style={{ ...S.mono, fontSize:'9px', color: ctl >= l.min && ctl <= l.max ? l.color : 'var(--muted)', fontWeight: ctl >= l.min && ctl <= l.max ? 700 : 400 }}>{l.label}</div>
            <div style={{ ...S.mono, fontSize:'8px', color:'#888', marginTop:'2px' }}>{l.min}–{l.max === 999 ? '100+' : l.max}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AthleteCard({ profile, log }) {
  const { t } = useContext(LangCtx)
  const [status, setStatus] = useState(null)
  const last28 = log.slice(-28)
  const totalH = Math.round(last28.reduce((s,e)=>s+(e.duration||0),0)/60)
  const sessions28 = last28.length
  const avgRPE28 = sessions28 ? (last28.reduce((s,e)=>s+(e.rpe||0),0)/sessions28).toFixed(1) : '—'
  const { tsb } = calcLoad(log)

  const downloadCard = async () => {
    let fm = 'monospace'
    try {
      const f = new FontFace('IBM Plex Mono','url(https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n5iQ.woff2)')
      await f.load(); document.fonts.add(f); fm = '"IBM Plex Mono"'
    } catch {}
    const c = document.createElement('canvas')
    c.width=400; c.height=580
    const ctx = c.getContext('2d')
    ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,400,580)
    ctx.fillStyle='#ff6600'; ctx.fillRect(0,0,400,4)
    ctx.fillStyle='#ff6600'; ctx.font=`bold 22px ${fm}`; ctx.fillText(profile.name||'ATHLETE',24,52)
    ctx.fillStyle='#888'; ctx.font=`12px ${fm}`; ctx.fillText((profile.sport||'ENDURANCE').toUpperCase(),24,72)
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,85); ctx.lineTo(376,85); ctx.stroke()
    const stats=[
      ['VO₂max',profile.vo2max?`${profile.vo2max} mL/kg/min`:'—'],
      ['FTP',profile.ftp?`${profile.ftp}W`:'—'],
      ['Max HR',profile.maxhr?`${profile.maxhr} bpm`:'—'],
      ['Age',profile.age||'—'],
    ]
    stats.forEach(([l,v],i)=>{
      const x=24+(i%2)*190, y=130+Math.floor(i/2)*70
      ctx.fillStyle='#888'; ctx.font=`10px ${fm}`; ctx.fillText(l.toUpperCase(),x,y-14)
      ctx.fillStyle='#ff6600'; ctx.font=`bold 20px ${fm}`; ctx.fillText(String(v),x,y)
    })
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,290); ctx.lineTo(376,290); ctx.stroke()
    ctx.fillStyle='#888'; ctx.font=`10px ${fm}`; ctx.fillText('4-WEEK SUMMARY',24,314)
    const sums=[['HOURS',`${totalH}h`],['SESSIONS',sessions28],['AVG RPE',avgRPE28]]
    sums.forEach(([l,v],i)=>{
      const x=24+i*120
      ctx.fillStyle='#e5e5e5'; ctx.font=`bold 18px ${fm}`; ctx.fillText(String(v),x,348)
      ctx.fillStyle='#888'; ctx.font=`9px ${fm}`; ctx.fillText(l,x,366)
    })
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,390); ctx.lineTo(376,390); ctx.stroke()
    ctx.fillStyle='#888'; ctx.font=`10px ${fm}`; ctx.fillText('CURRENT FORM (TSB)',24,414)
    const tsbColor = tsb>5?'#5bc25b':tsb<-10?'#e03030':'#f5c542'
    ctx.fillStyle=tsbColor; ctx.font=`bold 28px ${fm}`; ctx.fillText((tsb>=0?'+':'')+tsb,24,448)
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,490); ctx.lineTo(376,490); ctx.stroke()
    ctx.fillStyle='#555'; ctx.font=`10px ${fm}`; ctx.fillText('SPOREUS ATHLETE CONSOLE — SPOREUS.COM',24,514)
    ctx.fillStyle='#444'; ctx.font=`9px ${fm}`; ctx.fillText('sporeus.com — Science-based endurance training console',24,534)
    c.toBlob(blob=>{
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a'); a.href=url; a.download='sporeus-athlete-card.png'; a.click()
      URL.revokeObjectURL(url)
    })
  }

  const share = async () => {
    const text=`${profile.name||'Athlete'} | ${profile.sport||'Endurance'} | VO₂max: ${profile.vo2max||'?'} | ${sessions28} sessions / 4 weeks — via Sporeus Athlete Console`
    try {
      if (navigator.share) await navigator.share({ title:'Sporeus Athlete Card', text, url:'https://sporeus.com' })
      else { await navigator.clipboard.writeText(text); setStatus('copied'); setTimeout(()=>setStatus(null),2000) }
    } catch {}
  }

  return (
    <div style={{ ...S.card, background:'#0a0a0a', border:'1px solid #333', borderRadius:'8px', padding:'20px' }}>
      <div style={{ ...S.cardTitle, color:'#ff6600', borderColor:'#333' }}>SHAREABLE ATHLETE CARD</div>
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
        <button style={S.btn} onClick={downloadCard}>↓ Download PNG</button>
        <button style={{ ...S.btnSec, borderColor:'#555', color:'#ccc' }} onClick={share}>
          {status==='copied'?'✓ COPIED':'⬡ Share'}
        </button>
      </div>
      <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', marginTop:'10px' }}>
        Card includes: name, sport, VO₂max, FTP, max HR, 4-week summary, form badge.
      </div>
    </div>
  )
}

// ─── Strava Connect (Phase 3.1) ───────────────────────────────────────────────
// ─── Referral Card (coach/club tier only) ────────────────────────────────────
function ReferralCard({ authUser }) {
  const tier = getTierSync()
  const [stats, setStats]   = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!authUser?.id || tier === 'free') return
    getReferralStats(authUser.id).then(setStats)
  }, [authUser?.id, tier])

  if (tier === 'free' || !authUser) return null

  const code     = stats?.code || generateReferralCode(authUser.id)
  const shareUrl = `https://sporeus.com/join?ref=${code}`
  const uses     = stats?.uses ?? 0
  const rewards  = stats?.rewards ?? []

  const copyCode = () => {
    try {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } catch {}
  }

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>REFER A CLUB</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', marginBottom:12, lineHeight:1.6 }}>
        Every 3 new clubs you refer earns 1 month free on your plan.
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:700, color:'#ff6600', letterSpacing:'0.1em' }}>
          {code}
        </span>
        <button onClick={copyCode} style={{ ...S.btnSec, fontSize:'9px', padding:'3px 10px' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#555', marginBottom:10, wordBreak:'break-all' }}>
        {shareUrl}
      </div>
      {uses > 0 && (
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5bc25b' }}>
          {uses} club{uses !== 1 ? 's' : ''} referred
          {rewards.length > 0 ? ` · ${rewards.length} reward${rewards.length > 1 ? 's' : ''} earned` : ''}
        </div>
      )}
    </div>
  )
}

// ─── Admin Code Generator (visible only to Hüseyin) ──────────────────────────

function AdminCodeGenerator() {
  const [adminCoachId, setAdminCoachId] = useState('')
  const [adminLimit, setAdminLimit] = useState('10')
  const [adminResult, setAdminResult] = useState('')
  const [adminLog, setAdminLog] = useLocalStorage('sporeus-admin-codes', [])
  const [copying, setCopying] = useState(false)

  async function handleGenerate() {
    if (!adminCoachId.trim() || !adminLimit) return
    const code = await generateUnlockCode(adminCoachId.trim(), parseInt(adminLimit))
    setAdminResult(code)
    const entry = { coachId: adminCoachId.trim(), limit: parseInt(adminLimit), code, generatedAt: new Date().toISOString().slice(0, 10) }
    setAdminLog(prev => [entry, ...prev].slice(0, 50))
  }

  function copyCode() {
    if (!adminResult) return
    navigator.clipboard.writeText(adminResult).catch(() => {})
    setCopying(true); setTimeout(() => setCopying(false), 1500)
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'115ms', borderLeft:'3px solid #ff6600' }}>
      <div style={{ ...S.cardTitle, color:'#ff6600', borderColor:'#ff660044' }}>◈ ADMIN: UNLOCK CODE GENERATOR</div>
      <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'14px', lineHeight:1.7 }}>
        Generate SPUNLOCK codes for coaches who need more than {FREE_ATHLETE_LIMIT} athletes.
      </div>
      <div style={S.row}>
        <div style={{ flex:'2 1 200px' }}>
          <label style={S.label}>COACH ID (SP-XXXXXXXX)</label>
          <input style={S.input} placeholder="SP-a3f7b2e1" value={adminCoachId} onChange={e => setAdminCoachId(e.target.value.trim())}/>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>NEW LIMIT</label>
          <input style={S.input} type="number" min="4" max="999" placeholder="10" value={adminLimit} onChange={e => setAdminLimit(e.target.value)}/>
        </div>
      </div>
      <button style={{ ...S.btn, marginTop:'12px' }} onClick={handleGenerate}>Generate Unlock Code</button>
      {adminResult && (
        <div style={{ marginTop:'12px', padding:'12px 14px', background:'#ff660011', border:'1px solid #ff660044', borderRadius:'6px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'6px', letterSpacing:'0.1em' }}>UNLOCK CODE</div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <input readOnly style={{ ...S.input, flex:1, color:'#ff6600', fontSize:'12px', letterSpacing:'0.06em', fontWeight:600 }} value={adminResult} onFocus={e => e.target.select()}/>
            <button style={{ ...S.btnSec, whiteSpace:'nowrap', borderColor:'#ff6600', color: copying ? '#5bc25b' : '#ff6600' }} onClick={copyCode}>
              {copying ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
      {adminLog.length > 0 && (
        <div style={{ marginTop:'14px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.08em', marginBottom:'6px' }}>RECENT CODES</div>
          <div style={{ maxHeight:'180px', overflowY:'auto' }}>
            {adminLog.map((entry, i) => (
              <div key={i} style={{ display:'flex', gap:'8px', flexWrap:'wrap', borderBottom:'1px solid var(--border)', padding:'5px 0', ...S.mono, fontSize:'10px', color:'var(--sub)' }}>
                <span style={{ color:'#888', minWidth:'70px' }}>{entry.generatedAt}</span>
                <span style={{ color:'#0064ff' }}>{entry.coachId}</span>
                <span>→ {entry.limit} athletes</span>
                <span style={{ color:'#ff6600', marginLeft:'auto' }}>{entry.code}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Coach message thread (athlete side) ─────────────────────────────────────
const COACH_MSG_KEY = 'sporeus-coach-messages'
function readCoachMsgs()   { try { return JSON.parse(localStorage.getItem(COACH_MSG_KEY)) || [] } catch { return [] } }
function saveCoachMsgs(a)  { try { localStorage.setItem(COACH_MSG_KEY, JSON.stringify(a)) } catch {} }

function CoachMessagesCard() {
  const [messages, setMessages] = useState(() => readCoachMsgs())
  const [reply,    setReply]    = useState('')

  // Mark coach messages as read on mount
  useEffect(() => {
    const updated = messages.map(m => m.from === 'coach' ? { ...m, read: true } : m)
    if (updated.some((m, i) => m.read !== messages[i].read)) {
      setMessages(updated); saveCoachMsgs(updated)
    }
  }, [])

  const sendReply = () => {
    const text = reply.trim()
    if (!text) return
    const msg = { id: Date.now() + Math.random().toString(36).slice(2, 5), from: 'athlete', text, ts: new Date().toISOString(), read: true }
    const updated = [...messages, msg]
    setMessages(updated); saveCoachMsgs(updated); setReply('')
  }

  if (!messages.length) return null

  return (
    <div style={{ ...S.card, marginBottom:'16px' }}>
      <div style={{ ...S.label, color:'#0064ff', marginBottom:'10px' }}>✉ COACH MESSAGES</div>
      <div style={{ maxHeight:'250px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px', marginBottom:'10px' }}>
        {messages.map(m => (
          <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems: m.from === 'coach' ? 'flex-start' : 'flex-end' }}>
            <div style={{ maxWidth:'85%', padding:'7px 11px', borderRadius:'8px', background: m.from === 'coach' ? '#ff660015' : '#0064ff15', border:`1px solid ${m.from === 'coach' ? '#ff660033' : '#0064ff33'}` }}>
              <div style={{ ...S.mono, fontSize:'9px', color: m.from === 'coach' ? '#ff9944' : '#6699ff', letterSpacing:'0.06em', marginBottom:'3px' }}>
                {m.from === 'coach' ? 'COACH' : 'YOU'} · {new Date(m.ts).toLocaleDateString()}
              </div>
              <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.6, wordBreak:'break-word' }}>{m.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:'8px' }}>
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
          placeholder="Reply to coach… (Enter to send)"
          rows={2}
          style={{ ...S.input, flex:1, fontSize:'11px', padding:'7px 9px', resize:'none', lineHeight:1.5 }}
        />
        <button
          onClick={sendReply}
          disabled={!reply.trim()}
          style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'6px 14px', background:'#0064ff', border:'none', color:'#fff', borderRadius:'4px', cursor:'pointer', opacity: reply.trim() ? 1 : 0.4, alignSelf:'flex-end' }}>
          SEND
        </button>
      </div>
      <div style={{ ...S.mono, fontSize:'9px', color:'#555', marginTop:'6px' }}>
        Replies are saved locally and included in your data export.
      </div>
    </div>
  )
}

export function countUnreadCoachMessages() {
  try { return (JSON.parse(localStorage.getItem(COACH_MSG_KEY)) || []).filter(m => m.from === 'coach' && !m.read).length } catch { return 0 }
}

export default function Profile({ log, authUser }) {
  const { t } = useContext(LangCtx)
  const { profile, setProfile } = useData()
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
    } catch {}
  }

  const FIELDS = [
    {k:'name',lk:'nameL',ph:'Athlete name'},{k:'age',lk:'ageL',ph:'32',type:'number'},
    {k:'height',lk:'heightCmL',ph:'175',type:'number'},{k:'weight',lk:'weightL',ph:'70',type:'number'},
    {k:'maxhr',lk:'maxHRIn',ph:'185',type:'number'},{k:'ftp',lk:'ftpL',ph:'280',type:'number'},
    {k:'vo2max',lk:'vo2L',ph:'55',type:'number'},{k:'threshold',lk:'threshPaceL',ph:'4:30'},
    {k:'goal',lk:'goalL',ph:'Sub-3h marathon Istanbul 2026'},
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
          } catch { return null }
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
                    } catch {}
                  }}
                >
                  ↓ Download Season Report
                </button>
              )}
            </div>
          )
        })()}

        {/* GDPR — Download my data / Delete my account */}
        <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid var(--border)' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.1em', marginBottom:'8px' }}>◈ PRIVACY — GDPR RIGHTS</div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
            <button
              style={{ ...S.btnSec, fontSize:'9px', padding:'4px 12px' }}
              disabled={gdprStatus === 'exporting'}
              onClick={handleGdprDownload}
            >
              {gdprStatus === 'exporting' ? '…exporting' : gdprStatus === 'done' ? '✓ Downloaded' : '↓ Download my data'}
            </button>
            <button
              style={{ ...S.btnSec, fontSize:'9px', padding:'4px 12px', color:'#e03030', borderColor:'#e03030' }}
              disabled={!!gdprStatus}
              onClick={handleGdprDelete}
            >
              {gdprStatus === 'deleting' ? '…deleting' : gdprStatus === 'deleted' ? '✓ Deleted' : '✕ Delete my account'}
            </button>
            {gdprStatus === 'error' && (
              <span style={{ ...S.mono, fontSize:'9px', color:'#e03030' }}>Error — try again</span>
            )}
          </div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#444', marginTop:'6px' }}>
            Download exports all your data as JSON (GDPR Article 20). Delete erases all records from our servers.
          </div>
        </div>

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
                      try { localStorage.setItem('sporeus-marketing-consent', val ? '1' : '0') } catch {}
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
                    try { localStorage.setItem('sporeus-ai-tone', tone.toLowerCase()) } catch {}
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
      {(local.name?.toLowerCase().includes('hüseyin') || local.name?.toLowerCase().includes('huseyin') || local.email === 'huseyinakbulut@marun.edu.tr') && (
        <AdminCodeGenerator/>
      )}

      {/* AthleteOS developer reference — Cost Cuts + Prompt Library */}
      {(local.name?.toLowerCase().includes('hüseyin') || local.name?.toLowerCase().includes('huseyin') || local.email === 'huseyinakbulut@marun.edu.tr') && (
        <AthleteOSCosts />
      )}

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
