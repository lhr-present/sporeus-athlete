import { useState } from 'react'
import { PLAN_GOALS } from '../lib/constants.js'

// ── Rule-based plan preview (no API key required) ─────────────────────────────
function getPlanPreview(data) {
  const level = data.level || 'Intermediate'
  const wks   = parseInt(data.weeks) || 12
  const phase  = wks >= 16 ? 'Base Build' : wks >= 8 ? 'Build' : 'Peak/Taper'
  const tssMap = { Beginner: 250, Intermediate: 380, Advanced: 550 }
  const daysMap = { Beginner: 4, Intermediate: 5, Advanced: 6 }
  return {
    weeklyTss:  tssMap[level],
    daysPerWk:  daysMap[level],
    phase,
    suggestion: `Start ${phase} block. Target ${tssMap[level]} TSS/week across ${daysMap[level]} sessions.`,
  }
}

const LABEL = { fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#888', display:'block', marginBottom:'4px' }
const INPUT = { fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'4px', width:'100%', boxSizing:'border-box', background:'var(--input-bg,#fff)', color:'var(--text,#1a1a1a)' }
const pill  = active => ({ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', padding:'8px 16px', borderRadius:'4px', border:`2px solid ${active?'#ff6600':'#e0e0e0'}`, background:active?'#ff6600':'transparent', color:active?'#fff':'#888', cursor:'pointer', fontWeight:active?600:400 })

export default function OnboardingWizard({ onFinish, setLang, lang }) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    name:'', sport:'Running', age:'', gender:'male',
    level:'Intermediate', maxhr:'', ftp:'', ltpace:'',
    goal:'Half Marathon', weeks:'',
  })
  const set = (k,v) => setData(d=>({...d,[k]:v}))
  const sports = ['Running','Cycling','Triathlon','Swimming','Rowing','Other']

  const steps = [
    // ── 0: Welcome ─────────────────────────────────────────────────────────
    <div key="welcome" style={{ textAlign:'center', padding:'20px 0' }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'22px', fontWeight:600, color:'#ff6600', letterSpacing:'0.1em', marginBottom:'8px' }}>◈ SPOREUS</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', color:'#888', marginBottom:'24px' }}>Bloomberg Terminal for your body</div>
      <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginBottom:'24px' }}>
        {['EN','TR'].map(l=>(
          <button key={l} onClick={()=>setLang(l.toLowerCase())} style={pill(lang===l.toLowerCase())}>
            {l}
          </button>
        ))}
      </div>
    </div>,

    // ── 1: Basic info ───────────────────────────────────────────────────────
    <div key="basic">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>01 / BASIC INFO</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        {[{l:'Name',k:'name',ph:'Athlete name'},{l:'Age',k:'age',ph:'32',type:'number'}].map(f=>(
          <div key={f.k}>
            <label style={LABEL}>{f.l.toUpperCase()}</label>
            <input style={INPUT} type={f.type||'text'} placeholder={f.ph} value={data[f.k]} onChange={e=>set(f.k,e.target.value)}/>
          </div>
        ))}
        <div>
          <label style={LABEL}>GENDER</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {['male','female'].map(g=>(
              <button key={g} onClick={()=>set('gender',g)} style={pill(data.gender===g)}>
                {g.charAt(0).toUpperCase()+g.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={LABEL}>PRIMARY SPORT</label>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {sports.map(s=>(
              <button key={s} onClick={()=>set('sport',s)} style={{ ...pill(data.sport===s), fontSize:'11px', padding:'5px 12px' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,

    // ── 2: Fitness level (NEW) ──────────────────────────────────────────────
    <div key="level">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>02 / FITNESS LEVEL</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <div>
          <label style={LABEL}>CURRENT LEVEL</label>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            {[
              { id:'Beginner',     desc:'< 1 yr training, mostly recreational' },
              { id:'Intermediate', desc:'1–4 yrs, regular structured training' },
              { id:'Advanced',     desc:'5+ yrs, race-focused, high volume' },
            ].map(({ id, desc })=>(
              <button key={id} onClick={()=>set('level',id)}
                style={{ flex:'1 1 130px', textAlign:'left', padding:'12px', borderRadius:'6px', border:`2px solid ${data.level===id?'#ff6600':'var(--border)'}`, background:data.level===id?'#fff3eb':'transparent', cursor:'pointer' }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', fontWeight:600, color:data.level===id?'#ff6600':'var(--text)', marginBottom:'4px' }}>{id}</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', lineHeight:1.5 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={LABEL}>TRAINING DAYS PER WEEK (current)</label>
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

    // ── 3: Key metrics ──────────────────────────────────────────────────────
    <div key="metrics">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>03 / KEY METRICS</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <div>
          <label style={LABEL}>MAX HEART RATE (bpm)</label>
          <div style={{ display:'flex', gap:'8px' }}>
            <input style={{ ...INPUT, flex:1 }} type="number" placeholder="185" value={data.maxhr} onChange={e=>set('maxhr',e.target.value)}/>
            {data.age && (
              <button onClick={()=>set('maxhr',String(Math.round(208-0.7*parseInt(data.age))))}
                style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'8px 12px', borderRadius:'4px', border:'1px solid #ff6600', background:'transparent', color:'#ff6600', cursor:'pointer', whiteSpace:'nowrap' }}>
                Estimate from age
              </button>
            )}
          </div>
        </div>
        {['Running','Triathlon','Rowing'].includes(data.sport) ? (
          <div>
            <label style={LABEL}>THRESHOLD PACE (MM:SS /km)</label>
            <input style={INPUT} type="text" placeholder="4:45" value={data.ltpace} onChange={e=>set('ltpace',e.target.value)}/>
          </div>
        ) : (
          <div>
            <label style={LABEL}>FTP (watts)</label>
            <input style={INPUT} type="number" placeholder="240" value={data.ftp} onChange={e=>set('ftp',e.target.value)}/>
          </div>
        )}
      </div>
    </div>,

    // ── 4: Goal + plan preview ──────────────────────────────────────────────
    <div key="goal">
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>04 / YOUR GOAL</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {PLAN_GOALS.map(g=>(
          <button key={g} onClick={()=>set('goal',g)}
            style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', padding:'12px', borderRadius:'6px', border:`2px solid ${data.goal===g?'#ff6600':'#e0e0e0'}`, background:data.goal===g?'#fff3eb':'transparent', color:data.goal===g?'#ff6600':'#888', cursor:'pointer', textAlign:'center', fontWeight:data.goal===g?600:400 }}>
            {g}
          </button>
        ))}
      </div>
      <div style={{ marginBottom:'16px' }}>
        <label style={LABEL}>WEEKS UNTIL EVENT (optional): {data.weeks||'—'}</label>
        <input type="range" min="4" max="52" value={data.weeks||12} onChange={e=>set('weeks',e.target.value)} style={{ width:'100%', accentColor:'#ff6600' }}/>
      </div>
      {/* ── Plan preview ── */}
      {(() => {
        const p = getPlanPreview(data)
        return (
          <div style={{ background:'#0a0a0a', borderRadius:'6px', padding:'14px', border:'1px solid #333' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', letterSpacing:'0.1em', marginBottom:'10px' }}>YOUR STARTER PLAN</div>
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px' }}>
              {[['Phase', p.phase],['TSS/wk', p.weeklyTss],['Days/wk', p.daysPerWk]].map(([lbl,val])=>(
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
    </div>,
  ]

  const TOTAL = steps.length
  const pct   = Math.round((step / (TOTAL - 1)) * 100)

  const finish = () => {
    onFinish({
      name:data.name, age:data.age, gender:data.gender, sport:data.sport,
      athleteLevel: data.level, trainDays: data.trainDays,
      maxhr:data.maxhr, ftp:data.ftp, threshold:data.ltpace, goal:data.goal,
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
