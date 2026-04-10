import { useState } from 'react'
import { PLAN_GOALS } from '../lib/constants.js'

export default function OnboardingWizard({ onFinish, setLang, lang }) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({ name:'', sport:'Running', age:'', gender:'male', maxhr:'', ftp:'', ltpace:'', goal:'Half Marathon', weeks:'' })
  const set = (k,v) => setData(d=>({...d,[k]:v}))
  const sports = ['Running','Cycling','Triathlon','Swimming','Rowing','Other']
  const goals  = PLAN_GOALS

  const steps = [
    // Step 0: Welcome
    <div style={{ textAlign:'center', padding:'20px 0' }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'22px', fontWeight:600, color:'#ff6600', letterSpacing:'0.1em', marginBottom:'8px' }}>◈ SPOREUS</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', color:'#888', marginBottom:'24px' }}>Bloomberg Terminal for your body</div>
      <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginBottom:'24px' }}>
        {['EN','TR'].map(l=>(
          <button key={l} onClick={()=>setLang(l.toLowerCase())}
            style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', fontWeight:600, padding:'8px 20px', borderRadius:'4px', border:`2px solid ${lang===l.toLowerCase()?'#ff6600':'#e0e0e0'}`, background:lang===l.toLowerCase()?'#ff6600':'transparent', color:lang===l.toLowerCase()?'#fff':'#888', cursor:'pointer' }}>
            {l}
          </button>
        ))}
      </div>
    </div>,

    // Step 1: Basic info
    <div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>01 / BASIC INFO</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        {[{l:'Name',k:'name',ph:'Athlete name'},{l:'Age',k:'age',ph:'32',type:'number'}].map(f=>(
          <div key={f.k}>
            <label style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#888', display:'block', marginBottom:'4px' }}>{f.l.toUpperCase()}</label>
            <input style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'4px', width:'100%', boxSizing:'border-box' }}
              type={f.type||'text'} placeholder={f.ph} value={data[f.k]} onChange={e=>set(f.k,e.target.value)}/>
          </div>
        ))}
        <div>
          <label style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#888', display:'block', marginBottom:'4px' }}>GENDER</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {['male','female'].map(g=>(
              <button key={g} onClick={()=>set('gender',g)}
                style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', padding:'7px 20px', borderRadius:'4px', border:`2px solid ${data.gender===g?'#ff6600':'#e0e0e0'}`, background:data.gender===g?'#ff6600':'transparent', color:data.gender===g?'#fff':'#888', cursor:'pointer' }}>
                {g.charAt(0).toUpperCase()+g.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#888', display:'block', marginBottom:'4px' }}>PRIMARY SPORT</label>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {sports.map(s=>(
              <button key={s} onClick={()=>set('sport',s)}
                style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'5px 12px', borderRadius:'4px', border:`2px solid ${data.sport===s?'#ff6600':'#e0e0e0'}`, background:data.sport===s?'#ff6600':'transparent', color:data.sport===s?'#fff':'#888', cursor:'pointer' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,

    // Step 2: Key metrics
    <div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>02 / KEY METRICS</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <div>
          <label style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#888', display:'block', marginBottom:'4px' }}>MAX HEART RATE (bpm)</label>
          <div style={{ display:'flex', gap:'8px' }}>
            <input style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'4px', flex:1 }}
              type="number" placeholder="185" value={data.maxhr} onChange={e=>set('maxhr',e.target.value)}/>
            {data.age && <button onClick={()=>set('maxhr',String(Math.round(208-0.7*parseInt(data.age))))}
              style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', padding:'8px 12px', borderRadius:'4px', border:'1px solid #ff6600', background:'transparent', color:'#ff6600', cursor:'pointer', whiteSpace:'nowrap' }}>
              Estimate from age
            </button>}
          </div>
        </div>
        {['Running','Triathlon','Rowing'].includes(data.sport) ? (
          <div>
            <label style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#888', display:'block', marginBottom:'4px' }}>THRESHOLD PACE (MM:SS /km)</label>
            <input style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'4px', width:'100%', boxSizing:'border-box' }}
              type="text" placeholder="4:45" value={data.ltpace} onChange={e=>set('ltpace',e.target.value)}/>
          </div>
        ) : (
          <div>
            <label style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#888', display:'block', marginBottom:'4px' }}>FTP (watts)</label>
            <input style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'4px', width:'100%', boxSizing:'border-box' }}
              type="number" placeholder="240" value={data.ftp} onChange={e=>set('ftp',e.target.value)}/>
          </div>
        )}
      </div>
    </div>,

    // Step 3: Goal
    <div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, color:'#ff6600', marginBottom:'16px' }}>03 / YOUR GOAL</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {goals.map(g=>(
          <button key={g} onClick={()=>set('goal',g)}
            style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', padding:'12px', borderRadius:'6px', border:`2px solid ${data.goal===g?'#ff6600':'#e0e0e0'}`, background:data.goal===g?'#fff3eb':'transparent', color:data.goal===g?'#ff6600':'#888', cursor:'pointer', textAlign:'center', fontWeight:data.goal===g?600:400 }}>
            {g}
          </button>
        ))}
      </div>
      <div>
        <label style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#888', display:'block', marginBottom:'4px' }}>WEEKS UNTIL EVENT (optional): {data.weeks||'—'}</label>
        <input type="range" min="4" max="52" value={data.weeks||12} onChange={e=>set('weeks',e.target.value)} style={{ width:'100%', accentColor:'#ff6600' }}/>
      </div>
    </div>,
  ]

  const finish = () => {
    onFinish({
      name:data.name, age:data.age, gender:data.gender, sport:data.sport,
      maxhr:data.maxhr, ftp:data.ftp, threshold:data.ltpace, goal:data.goal,
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ background:'var(--card)', borderRadius:'12px', padding:'32px', width:'100%', maxWidth:'480px', position:'relative' }}>
        <button onClick={()=>onFinish(null)} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:'#ccc', cursor:'pointer', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px' }}>
          Skip all →
        </button>
        <div style={{ display:'flex', gap:'6px', justifyContent:'center', marginBottom:'24px' }}>
          {steps.map((_,i)=>(
            <div key={i} style={{ width:'8px', height:'8px', borderRadius:'50%', background:i===step?'#ff6600':'#e0e0e0', transition:'background 0.2s' }}/>
          ))}
        </div>
        {steps[step]}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'24px' }}>
          {step > 0
            ? <button onClick={()=>setStep(s=>s-1)} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', padding:'8px 18px', borderRadius:'4px', border:'1px solid var(--border)', background:'transparent', color:'#888', cursor:'pointer' }}>← Back</button>
            : <span/>}
          {step < steps.length - 1
            ? <button onClick={()=>setStep(s=>s+1)} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, padding:'8px 20px', borderRadius:'4px', background:'#ff6600', border:'none', color:'#fff', cursor:'pointer' }}>Next →</button>
            : <button onClick={finish} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, padding:'8px 20px', borderRadius:'4px', background:'#ff6600', border:'none', color:'#fff', cursor:'pointer' }}>Let's go →</button>}
        </div>
      </div>
    </div>
  )
}
