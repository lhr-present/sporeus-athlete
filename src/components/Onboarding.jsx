import { useState } from 'react'
import { PLAN_GOALS } from '../lib/constants.js'
import { autoFormatMmSs } from '../lib/format/mmss.js'

// ── Rule-based plan preview (no API key required) ─────────────────────────────
// v9.74.0 — Expanded from 3 to 5 tier buckets to match ATHLETE_LEVELS.
// 'Intermediate' kept as a back-compat alias for users with pre-v9.74 state
// (it maps to the same numbers as 'Competitive' — the new explicit label).
// v9.75.0 — Accept lang to return localized phase + suggestion.
function getPlanPreview(data, lang = 'en') {
  const level = data.level || 'Competitive'
  const wks   = parseInt(data.weeks) || 12
  const isTR  = lang === 'tr'
  const phaseEN = wks >= 16 ? 'Base Build' : wks >= 8 ? 'Build' : 'Peak/Taper'
  const phaseTR = wks >= 16 ? 'Temel Yapı' : wks >= 8 ? 'Geliştirme' : 'Zirve/Konik'
  const tssMap = {
    Beginner: 250, Recreational: 320,
    Intermediate: 380, Competitive: 380,
    Advanced: 550, Elite: 700,
  }
  const daysMap = {
    Beginner: 4, Recreational: 4,
    Intermediate: 5, Competitive: 5,
    Advanced: 6, Elite: 6,
  }
  const tss  = tssMap[level] ?? 380
  const days = daysMap[level] ?? 5
  return {
    weeklyTss:  tss,
    daysPerWk:  days,
    phase:      isTR ? phaseTR : phaseEN,
    suggestion: isTR
      ? `${phaseTR} bloğuna başla. Haftalık ${tss} TSS hedefi, ${days} antrenman.`
      : `Start ${phaseEN} block. Target ${tss} TSS/week across ${days} sessions.`,
  }
}

const LABEL = { fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#888', display:'block', marginBottom:'4px' }
const INPUT = { fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'4px', width:'100%', boxSizing:'border-box', background:'var(--input-bg,#fff)', color:'var(--text,#1a1a1a)' }
const pill  = active => ({ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', padding:'8px 16px', borderRadius:'4px', border:`2px solid ${active?'#ff6600':'#e0e0e0'}`, background:active?'#ff6600':'transparent', color:active?'#fff':'#888', cursor:'pointer', fontWeight:active?600:400 })

const PURPOSES = ['General fitness','A race','Weight goal','Rehabbing','Just exploring']
const LOGGING_METHODS = [
  { id:'manual',     label:'Log manually',     desc:'Enter sessions by hand' },
  { id:'strava',     label:'Connect Strava',   desc:'Auto-import activities' },
  { id:'fit_upload', label:'Upload FIT files', desc:'From Garmin/Wahoo/etc.' },
]

export default function OnboardingWizard({ onFinish, setLang, lang }) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    // New fast-track fields
    purpose:'', loggingMethod:'manual',
    // Original detailed fields
    name:'', sport:'Running', age:'', gender:'male',
    level:'Competitive', maxhr:'', ftp:'', ltpace:'',
    goal:'Half Marathon', weeks:'', raceDate:'',
  })
  const set = (k,v) => setData(d=>({...d,[k]:v}))
  const sports = ['Running','Cycling','Triathlon','Swimming','Rowing','Other']

  const quickFinish = () => onFinish({
    name:data.name || '', sport:data.sport, purpose:data.purpose,
    loggingMethod:data.loggingMethod, quickStart:true,
  })

  const steps = [
    // ── 0: Welcome ─────────────────────────────────────────────────────────
    <div key="welcome" style={{ textAlign:'center', padding:'20px 0' }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'22px', fontWeight:600, color:'#ff6600', letterSpacing:'0.1em', marginBottom:'8px' }}>◈ SPOREUS</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', color:'#888', marginBottom:'24px' }}>
        {lang === 'tr' ? 'Vücudunun Bloomberg Terminali' : 'Bloomberg Terminal for your body'}
      </div>
      <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginBottom:'24px' }}>
        {['EN','TR'].map(l=>(
          <button key={l} onClick={()=>setLang(l.toLowerCase())} style={pill(lang===l.toLowerCase())}>
            {l}
          </button>
        ))}
      </div>
    </div>,

    // ── 1: What are you training for? (E9 fast-track Q1) ───────────────────
    <div key="purpose">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'12px' }}>
        {lang === 'tr' ? '01 / NE İÇİN ANTRENMAN YAPIYORSUN?' : '01 / WHAT ARE YOU TRAINING FOR?'}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {PURPOSES.map(p=>{
          const PURPOSE_TR = { 'General fitness':'Genel fitness', 'A race':'Bir yarış', 'Weight goal':'Kilo hedefi', 'Rehabbing':'Rehabilitasyon', 'Just exploring':'Sadece keşfediyorum' }
          return (
            <button key={p} onClick={()=>set('purpose',p)}
              style={{ textAlign:'left', padding:'12px 14px', borderRadius:'6px', border:`2px solid ${data.purpose===p?'#ff6600':'var(--border)'}`, background:data.purpose===p?'#fff3eb':'transparent', cursor:'pointer', fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', color:data.purpose===p?'#ff6600':'var(--text)', fontWeight:data.purpose===p?600:400 }}>
              {lang === 'tr' ? (PURPOSE_TR[p] || p) : p}
            </button>
          )
        })}
      </div>
    </div>,

    // ── 2: Primary sport? (E9 fast-track Q2) ──────────────────────────────
    <div key="sport_pick">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'12px' }}>
        {lang === 'tr' ? '02 / ANA SPOR' : '02 / PRIMARY SPORT'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
        {sports.map(s=>{
          const SPORT_TR = { Running:'Koşu', Cycling:'Bisiklet', Triathlon:'Triatlon', Swimming:'Yüzme', Rowing:'Kürek', Other:'Diğer' }
          return (
            <button key={s} onClick={()=>set('sport',s)}
              style={{ padding:'14px 8px', borderRadius:'6px', border:`2px solid ${data.sport===s?'#ff6600':'var(--border)'}`, background:data.sport===s?'#fff3eb':'transparent', cursor:'pointer', fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', color:data.sport===s?'#ff6600':'var(--text)', fontWeight:data.sport===s?600:400, textAlign:'center' }}>
              {s === 'Running' ? '🏃' : s === 'Cycling' ? '🚴' : s === 'Triathlon' ? '🏊' : s === 'Swimming' ? '🏊' : s === 'Rowing' ? '🚣' : '⚡'}<br/>{lang === 'tr' ? (SPORT_TR[s] || s) : s}
            </button>
          )
        })}
      </div>
    </div>,

    // ── 3: How do you want to log? (E9 fast-track Q3) ─────────────────────
    <div key="log_method">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'12px' }}>
        {lang === 'tr' ? '03 / NASIL KAYIT YAPMAK İSTİYORSUN?' : '03 / HOW DO YOU WANT TO LOG?'}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
        {LOGGING_METHODS.map(m=>{
          const LM_TR = {
            manual:     { label:'Elle kaydet',      desc:'Antrenmanları elle gir' },
            strava:     { label:"Strava'ya bağlan", desc:'Aktiviteleri otomatik içe aktar' },
            fit_upload: { label:'FIT dosyası yükle', desc:'Garmin/Wahoo vb.' },
          }
          const labelTxt = lang === 'tr' && LM_TR[m.id] ? LM_TR[m.id].label : m.label
          const descTxt  = lang === 'tr' && LM_TR[m.id] ? LM_TR[m.id].desc  : m.desc
          return (
            <button key={m.id} onClick={()=>set('loggingMethod',m.id)}
              style={{ textAlign:'left', padding:'12px 14px', borderRadius:'6px', border:`2px solid ${data.loggingMethod===m.id?'#ff6600':'var(--border)'}`, background:data.loggingMethod===m.id?'#fff3eb':'transparent', cursor:'pointer', fontFamily:"'IBM Plex Mono',monospace" }}>
              <div style={{ fontSize:'13px', color:data.loggingMethod===m.id?'#ff6600':'var(--text)', fontWeight:data.loggingMethod===m.id?600:400, marginBottom:'2px' }}>{labelTxt}</div>
              <div style={{ fontSize:'11px', color:'#888' }}>{descTxt}</div>
            </button>
          )
        })}
      </div>
      <button onClick={quickFinish}
        style={{ width:'100%', padding:'12px', borderRadius:'6px', background:'#ff6600', border:'none', color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', fontWeight:600, cursor:'pointer', marginBottom:'8px' }}>
        {lang === 'tr' ? 'Kaydetmeye başla →' : 'Start logging →'}
      </button>
      <button onClick={()=>setStep(s=>s+1)}
        style={{ width:'100%', padding:'10px', borderRadius:'6px', background:'transparent', border:'1px solid var(--border)', color:'#888', fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', cursor:'pointer' }}>
        {lang === 'tr' ? 'Tam kurulum (metrikler, hedefler, plan önizleme)' : 'Full setup (metrics, goals, plan preview)'}
      </button>
    </div>,

    // ── 4: Basic info (optional full-setup) ────────────────────────────────
    <div key="basic">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>
        {lang === 'tr' ? '04 / TEMEL BİLGİ' : '04 / BASIC INFO'}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        {[{l:'Name', lTR:'İsim', k:'name', ph:'Athlete name', phTR:'Sporcu adı'}, {l:'Age', lTR:'Yaş', k:'age', ph:'32', type:'number'}].map(f=>(
          <div key={f.k}>
            <label style={LABEL}>{(lang === 'tr' ? (f.lTR || f.l) : f.l).toUpperCase()}</label>
            <input style={INPUT} type={f.type||'text'} placeholder={lang === 'tr' && f.phTR ? f.phTR : f.ph} value={data[f.k]} onChange={e=>set(f.k,e.target.value)}/>
          </div>
        ))}
        <div>
          <label style={LABEL}>{lang === 'tr' ? 'CİNSİYET' : 'GENDER'}</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {['male','female'].map(g=>{
              const GENDER_TR = { male:'Erkek', female:'Kadın' }
              return (
                <button key={g} onClick={()=>set('gender',g)} style={pill(data.gender===g)}>
                  {lang === 'tr' ? GENDER_TR[g] : g.charAt(0).toUpperCase()+g.slice(1)}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label style={LABEL}>{lang === 'tr' ? 'ANA SPOR' : 'PRIMARY SPORT'}</label>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {sports.map(s=>{
              const SPORT_TR = { Running:'Koşu', Cycling:'Bisiklet', Triathlon:'Triatlon', Swimming:'Yüzme', Rowing:'Kürek', Other:'Diğer' }
              return (
                <button key={s} onClick={()=>set('sport',s)} style={{ ...pill(data.sport===s), fontSize:'11px', padding:'5px 12px' }}>
                  {lang === 'tr' ? (SPORT_TR[s] || s) : s}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>,

    // ── 5: Fitness level ───────────────────────────────────────────────────
    <div key="level">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>
        {lang === 'tr' ? '05 / KONDİSYON SEVİYESİ' : '05 / FITNESS LEVEL'}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <div>
          <label style={LABEL}>{lang === 'tr' ? 'MEVCUT SEVİYE' : 'CURRENT LEVEL'}</label>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            {[
              { id:'Beginner',     desc:'< 1 yr · first steps',         labelTR:'Başlangıç',   descTR:'< 1 yıl · ilk adımlar' },
              { id:'Recreational', desc:'1–3 yr · fun races',           labelTR:'Rekreasyonel', descTR:'1–3 yıl · keyifli yarışlar' },
              { id:'Competitive',  desc:'3–7 yr · age-group medals',    labelTR:'Yarışmacı',   descTR:'3–7 yıl · yaş grubu madalyaları' },
              { id:'Advanced',     desc:'7+ yr · top 10% finisher',     labelTR:'İleri',       descTR:'7+ yıl · ilk %10 bitirici' },
              { id:'Elite',        desc:'National / international level', labelTR:'Elit',     descTR:'Ulusal / uluslararası seviye' },
            ].map(({ id, desc, labelTR, descTR })=>(
              <button key={id} onClick={()=>set('level',id)}
                style={{ flex:'1 1 130px', textAlign:'left', padding:'12px', borderRadius:'6px', border:`2px solid ${data.level===id?'#ff6600':'var(--border)'}`, background:data.level===id?'#fff3eb':'transparent', cursor:'pointer' }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', fontWeight:600, color:data.level===id?'#ff6600':'var(--text)', marginBottom:'4px' }}>{lang === 'tr' ? labelTR : id}</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', lineHeight:1.5 }}>{lang === 'tr' ? descTR : desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={LABEL}>{lang === 'tr' ? 'HAFTALIK ANTRENMAN GÜNLERİ (mevcut)' : 'TRAINING DAYS PER WEEK (current)'}</label>
          <div style={{ display:'flex', gap:'6px' }}>
            {[2,3,4,5,6,7].map(n=>(
              <button key={n} onClick={()=>set('trainDays',n)}
                style={{ ...pill(data.trainDays===n), flex:'1', padding:'8px 4px' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,

    // ── 6: Key metrics ─────────────────────────────────────────────────────
    <div key="metrics">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>
        {lang === 'tr' ? '06 / TEMEL METRİKLER' : '06 / KEY METRICS'}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <div>
          <label style={LABEL}>{lang === 'tr' ? 'MAKS KALP ATIŞI (atım/dk)' : 'MAX HEART RATE (bpm)'}</label>
          <div style={{ display:'flex', gap:'8px' }}>
            <input style={{ ...INPUT, flex:1 }} type="number" inputMode="numeric" placeholder="185" value={data.maxhr} onChange={e=>set('maxhr',e.target.value)}/>
            {data.age && (
              <button onClick={()=>set('maxhr',String(Math.round(208-0.7*parseInt(data.age))))}
                style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'8px 12px', borderRadius:'4px', border:'1px solid #ff6600', background:'transparent', color:'#ff6600', cursor:'pointer', whiteSpace:'nowrap' }}>
                {lang === 'tr' ? 'Yaştan tahmin et' : 'Estimate from age'}
              </button>
            )}
          </div>
        </div>
        {['Running','Triathlon','Rowing'].includes(data.sport) ? (
          <div>
            <label style={LABEL}>{lang === 'tr' ? 'EŞİK TEMPOSU (DD:SS /km)' : 'THRESHOLD PACE (MM:SS /km)'}</label>
            <input style={INPUT} type="text" inputMode="numeric" placeholder="4:45" value={data.ltpace}
              onChange={e=>set('ltpace', autoFormatMmSs(e.target.value))}
              onBlur={e=>set('ltpace', autoFormatMmSs(e.target.value, { padOnBlur: true }))}
            />
          </div>
        ) : (
          <div>
            <label style={LABEL}>{lang === 'tr' ? 'FTP (watt)' : 'FTP (watts)'}</label>
            <input style={INPUT} type="number" inputMode="numeric" placeholder="240" value={data.ftp} onChange={e=>set('ftp',e.target.value)}/>
          </div>
        )}
      </div>
    </div>,

    // ── 7: Goal + plan preview ─────────────────────────────────────────────
    <div key="goal">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>
        {lang === 'tr' ? '07 / HEDEFİN' : '07 / YOUR GOAL'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {PLAN_GOALS.map(g=>(
          <button key={g} onClick={()=>set('goal',g)}
            style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', padding:'12px', borderRadius:'6px', border:`2px solid ${data.goal===g?'#ff6600':'#e0e0e0'}`, background:data.goal===g?'#fff3eb':'transparent', color:data.goal===g?'#ff6600':'#888', cursor:'pointer', textAlign:'center', fontWeight:data.goal===g?600:400 }}>
            {g}
          </button>
        ))}
      </div>
      <div style={{ marginBottom:'12px' }}>
        <label style={LABEL}>{lang === 'tr' ? 'YARIŞ TARİHİ (isteğe bağlı)' : 'RACE DATE (optional)'}</label>
        <input
          style={INPUT}
          type="date"
          value={data.raceDate}
          min={new Date().toISOString().slice(0, 10)}
          onChange={e => {
            const v = e.target.value
            set('raceDate', v)
            if (v) {
              const wks = Math.max(4, Math.min(52, Math.round((new Date(v) - new Date()) / (7 * 86400000))))
              set('weeks', String(wks))
            }
          }}
        />
      </div>
      <div style={{ marginBottom:'16px' }}>
        <label style={LABEL}>{lang === 'tr' ? `ETKİNLİĞE KALAN HAFTA (isteğe bağlı): ${data.weeks||'—'}` : `WEEKS UNTIL EVENT (optional): ${data.weeks||'—'}`}</label>
        <input type="range" min="4" max="52" value={data.weeks||12} onChange={e=>{
          const wks = parseInt(e.target.value, 10)
          set('weeks', e.target.value)
          if (wks > 0) {
            const d = new Date(); d.setDate(d.getDate() + wks * 7)
            set('raceDate', d.toISOString().slice(0, 10))
          }
        }} style={{ width:'100%', accentColor:'#ff6600' }}/>
      </div>
      {/* ── Plan preview ── */}
      {(() => {
        const p = getPlanPreview(data, lang)
        const labels = lang === 'tr'
          ? [['Faz', p.phase],['TSS/hafta', p.weeklyTss],['Gün/hafta', p.daysPerWk]]
          : [['Phase', p.phase],['TSS/wk', p.weeklyTss],['Days/wk', p.daysPerWk]]
        return (
          <div style={{ background:'#0a0a0a', borderRadius:'6px', padding:'14px', border:'1px solid #333' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', letterSpacing:'0.1em', marginBottom:'10px' }}>
              {lang === 'tr' ? 'BAŞLANGIÇ PLANIN' : 'YOUR STARTER PLAN'}
            </div>
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px' }}>
              {labels.map(([lbl,val])=>(
                <div key={lbl} style={{ flex:'1 1 80px', textAlign:'center' }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'18px', fontWeight:600, color:'#ff6600' }}>{val}</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#888', letterSpacing:'0.08em', textTransform:'uppercase' }}>{lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#aaa', lineHeight:1.6 }}>{p.suggestion}</div>
          </div>
        )
      })()}
      {/* v9.66.0 — Surface the coach-invite path during onboarding so new
          athletes know the feature exists. Previously hidden in Profile tab
          with zero discoverability. */}
      <div style={{ marginTop:'14px', padding:'10px 12px', background:'#0064ff08', border:'1px dashed #0064ff44', borderRadius:'6px', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', lineHeight:1.6 }}>
        {lang === 'tr'
          ? '◆ Antrenörünüz var mı? Kayıt sonrası Profil sekmesinden SP-XXXXXXXX kodunu girebilir veya davet bağlantısını açabilirsiniz.'
          : '◆ Have a coach? After signup you can enter their SP-XXXXXXXX code in the Profile tab, or open the invite link they sent you.'}
      </div>
    </div>,
  ]

  const TOTAL = steps.length
  const pct   = Math.round((step / (TOTAL - 1)) * 100)

  const finish = () => {
    // v9.67.0 — Map step-5 picker values ('Beginner' / 'Intermediate' /
    // 'Advanced') to LEVEL_CONFIG keys so the simplified dashSimple dashboard
    // actually fires for new "Beginner" users. sanitizeProfile() also runs
    // this on load; doing it here too means the first save lands clean.
    // v9.74.0 — Picker now exposes all 5 tiers; map all five to lowercase
    // LEVEL_CONFIG keys. 'Intermediate' kept as a back-compat alias for
    // user state from pre-v9.74 onboarding (still maps to 'competitive').
    const LEVEL_MAP = {
      Beginner:     'beginner',
      Recreational: 'recreational',
      Intermediate: 'competitive',
      Competitive:  'competitive',
      Advanced:     'advanced',
      Elite:        'elite',
    }
    onFinish({
      name:data.name, age:data.age, gender:data.gender, sport:data.sport,
      purpose:data.purpose, loggingMethod:data.loggingMethod,
      athleteLevel: LEVEL_MAP[data.level] || data.level, trainDays: data.trainDays,
      maxhr:data.maxhr, ftp:data.ftp, threshold:data.ltpace, goal:data.goal,
      // v9.60.0 — collect race date during onboarding so the daily answer +
      // taper + race readiness engines have an anchor from day one
      raceDate: data.raceDate || undefined,
      nextRaceDate: data.raceDate || undefined,
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ background:'var(--card)', borderRadius:'12px', padding:'32px', width:'100%', maxWidth:'480px', position:'relative' }}>
        <button onClick={()=>onFinish(null)} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:'#ccc', cursor:'pointer', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px' }}>
          Skip all →
        </button>

        {/* ── Progress bar ── */}
        <div style={{ marginBottom:'24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#888', letterSpacing:'0.1em' }}>STEP {step + 1} / {TOTAL}</span>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#ff6600' }}>{pct}%</span>
          </div>
          <div style={{ height:'3px', background:'#e0e0e0', borderRadius:'2px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'#ff6600', borderRadius:'2px', transition:'width 0.3s ease' }}/>
          </div>
        </div>

        {steps[step]}

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'24px' }}>
          {step > 0
            ? <button onClick={()=>setStep(s=>s-1)} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', padding:'8px 18px', borderRadius:'4px', border:'1px solid var(--border)', background:'transparent', color:'#888', cursor:'pointer' }}>← Back</button>
            : <span/>}
          {step < TOTAL - 1
            ? <button onClick={()=>setStep(s=>s+1)} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, padding:'8px 20px', borderRadius:'4px', background:'#ff6600', border:'none', color:'#fff', cursor:'pointer' }}>Next →</button>
            : <button onClick={finish} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, padding:'8px 20px', borderRadius:'4px', background:'#ff6600', border:'none', color:'#fff', cursor:'pointer' }}>Let's go →</button>}
        </div>
      </div>
    </div>
  )
}
