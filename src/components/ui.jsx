import { useState, useEffect } from 'react'
import { S } from '../styles.js'
import { ZONE_COLORS, ZONE_NAMES, typeColor } from '../lib/constants.js'

// ─── ZoneBar ───────────────────────────────────────────────────────────────────
export function ZoneBar({ pct, color }) {
  const [w, setW] = useState(0)
  useEffect(() => { const id=setTimeout(()=>setW(pct),60); return ()=>clearTimeout(id) }, [pct])
  return (
    <div style={{ background:'var(--border)', height:'8px', borderRadius:'2px', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${w}%`, background:color, borderRadius:'2px', transition:'width 400ms ease-out' }} />
    </div>
  )
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────
export function Sparkline({ data, w=120, h=30 }) {
  if (!data.length) return <span style={{ ...S.mono, fontSize:'10px', color:'#ccc' }}>\u2014</span>
  const max=Math.max(...data,1), step=w/Math.max(data.length-1,1)
  const pts=data.map((v,i)=>`${i*step},${h-(v/max)*(h-4)-2}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:w, height:h }}>
      <polyline points={pts} fill="none" stroke="#ff6600" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ─── TSS Chart (30-day SVG) ────────────────────────────────────────────────────
export function TSSChart({ daily, t }) {
  if (!daily.length) return (
    <div style={{ textAlign:'center', padding:'30px 0', ...S.mono, fontSize:'12px', color:'#bbb' }}>{t('noDataChart')}</div>
  )
  const W=560, H=110, P={t:10,r:10,b:22,l:34}
  const iW=W-P.l-P.r, iH=H-P.t-P.b
  const maxV=Math.max(...daily.flatMap(d=>[d.tss,d.atl,d.ctl]),1)
  const yMax=Math.ceil(maxV/50)*50
  const xS=i=>P.l+(i/(daily.length-1))*iW
  const yS=v=>P.t+iH-(v/yMax)*iH

  const lineD=pts=>pts.map((v,i)=>`${i===0?'M':'L'}${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ')
  const areaD=daily.map((d,i)=>`${i===0?'M':'L'}${xS(i).toFixed(1)},${yS(d.tss).toFixed(1)}`).join(' ')+
    ` L${xS(daily.length-1).toFixed(1)},${(P.t+iH).toFixed(1)} L${P.l},${(P.t+iH).toFixed(1)} Z`

  const yTicks=[0,.5,1].map(f=>Math.round(yMax*f))
  const xLabels=daily.filter((_,i)=>i===0||i===6||i===13||i===20||i===daily.length-1)
    .map(d=>({ label:d.date.slice(5), i:daily.indexOf(d) }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto' }}>
      {yTicks.map(v=>(
        <g key={v}>
          <line x1={P.l} x2={W-P.r} y1={yS(v)} y2={yS(v)} stroke="#ebebeb" strokeWidth="1"/>
          <text x={P.l-3} y={yS(v)+3} textAnchor="end" fill="#bbb" fontSize="8" fontFamily="IBM Plex Mono,monospace">{v}</text>
        </g>
      ))}
      <path d={areaD} fill="#ff660018" />
      <path d={lineD(daily.map(d=>d.tss))} fill="none" stroke="#ff6600" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d={lineD(daily.map(d=>d.ctl))} fill="none" stroke="#0064ff" strokeWidth="1.5" strokeDasharray="4,2"/>
      <path d={lineD(daily.map(d=>d.atl))} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2"/>
      {xLabels.map(({label,i})=>(
        <text key={i} x={xS(i)} y={H-4} textAnchor="middle" fill="#bbb" fontSize="8" fontFamily="IBM Plex Mono,monospace">{label}</text>
      ))}
      <rect x={P.l+2} y={P.t} width="7" height="7" fill="#ff6600" rx="1"/>
      <text x={P.l+12} y={P.t+6} fill="#999" fontSize="8" fontFamily="IBM Plex Mono,monospace">TSS</text>
      <line x1={P.l+42} x2={P.l+50} y1={P.t+3} y2={P.t+3} stroke="#0064ff" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x={P.l+53} y={P.t+6} fill="#999" fontSize="8" fontFamily="IBM Plex Mono,monospace">CTL</text>
      <line x1={P.l+80} x2={P.l+88} y1={P.t+3} y2={P.t+3} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2"/>
      <text x={P.l+91} y={P.t+6} fill="#999" fontSize="8" fontFamily="IBM Plex Mono,monospace">ATL</text>
    </svg>
  )
}

// ─── MiniDonut (zone pie) ──────────────────────────────────────────────────────
export function MiniDonut({ pcts, colors, size=56 }) {
  const r=20, cx=size/2, cy=size/2
  let acc=0
  const segs = pcts.map((p,i) => {
    if (p<=0) { acc+=p; return null }
    const a0 = acc/100*2*Math.PI - Math.PI/2
    acc += p
    const a1 = acc/100*2*Math.PI - Math.PI/2
    const x1=cx+r*Math.cos(a0), y1=cy+r*Math.sin(a0)
    const x2=cx+r*Math.cos(a1), y2=cy+r*Math.sin(a1)
    const large = p>50?1:0
    return <path key={i} d={`M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`} fill={colors[i]}/>
  }).filter(Boolean)
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {segs}
      <circle cx={cx} cy={cy} r={r*0.55} fill="white"/>
    </svg>
  )
}

// ─── Weekly volume stacked bar chart ──────────────────────────────────────────
export function WeeklyVolChart({ log }) {
  const W=560, H=120, P={t:8,r:10,b:28,l:38}
  const iW=W-P.l-P.r, iH=H-P.t-P.b

  const todayStr = new Date().toISOString().slice(0,10)
  const weeks = []
  for (let i=7; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i*7)
    const start = new Date(d); start.setDate(start.getDate() - start.getDay())
    const end   = new Date(start); end.setDate(end.getDate()+6)
    const s0 = start.toISOString().slice(0,10), e0 = end.toISOString().slice(0,10)
    const entries = log.filter(e=>e.date>=s0&&e.date<=e0)
    const byType = {}
    entries.forEach(e=>{ byType[e.type]=(byType[e.type]||0)+(e.duration||0) })
    const isPartial = i===0 && e0 > todayStr
    weeks.push({ label:`W${8-i}`, byType, total:entries.reduce((s,e)=>s+(e.duration||0),0), isPartial })
  }

  const maxTotal = Math.max(...weeks.map(w=>w.total), 60)
  const yMax = Math.ceil(maxTotal/60)*60
  const bW = Math.floor(iW/8)-4
  const xS = i => P.l + i*(iW/8) + (iW/8 - bW)/2
  const hS = v => (v/yMax)*iH

  const allTypes = [...new Set(log.map(e=>e.type))]
  const yTicks = [0, Math.round(yMax/2), yMax]

  if (!log.length) return null
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto' }}>
        {yTicks.map(v=>(
          <g key={v}>
            <line x1={P.l} x2={W-P.r} y1={P.t+iH-hS(v)} y2={P.t+iH-hS(v)} stroke="#ebebeb" strokeWidth="1"/>
            <text x={P.l-3} y={P.t+iH-hS(v)+3} textAnchor="end" fill="#bbb" fontSize="8" fontFamily="IBM Plex Mono,monospace">{Math.round(v/60)}h</text>
          </g>
        ))}
        {weeks.map((wk,i) => {
          let yOff = 0
          return (
            <g key={i}>
              {Object.entries(wk.byType).map(([type, mins]) => {
                const bH = hS(mins)
                const y = P.t+iH-hS(yOff)-bH
                yOff += mins
                return <rect key={type} x={xS(i)} y={y} width={bW} height={Math.max(bH,1)} fill={typeColor(type)} rx="1"/>
              })}
              <text x={xS(i)+bW/2} y={H-6} textAnchor="middle" fill={wk.isPartial?'#ff6600':'#bbb'} fontSize="8" fontFamily="IBM Plex Mono,monospace">{wk.label}{wk.isPartial?'…':''}</text>
              {wk.isPartial && <line x1={xS(i)} x2={xS(i)+bW} y1={P.t+iH-hS(wk.total)} y2={P.t+iH-hS(wk.total)} stroke="#ff6600" strokeWidth="1.5" strokeDasharray="3,2"/>}
            </g>
          )
        })}
      </svg>
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'6px' }}>
        {allTypes.map(t=>(
          <div key={t} style={{ display:'flex', alignItems:'center', gap:'3px', ...S.mono, fontSize:'9px', color:'#888' }}>
            <div style={{ width:'8px',height:'8px',background:typeColor(t),borderRadius:'1px' }}/>{t}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Zone Donut (aggregate) ────────────────────────────────────────────────────
export function ZoneDonut({ log }) {
  const zoneMins = [0,0,0,0,0]
  log.forEach(e => {
    const dur = e.duration || 0
    if (e.zones && e.zones.some(z=>z>0)) {
      e.zones.forEach((z,i)=>{ zoneMins[i]+=z })
    } else {
      const r = e.rpe || 5
      const zi = r<=3?0:r<=5?1:r<=7?2:r===8?3:4
      zoneMins[zi] += dur
    }
  })
  const total = zoneMins.reduce((s,v)=>s+v,0)
  if (!total) return null
  const pcts = zoneMins.map(v=>Math.round(v/total*100))
  const domIdx = pcts.indexOf(Math.max(...pcts))
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
      <div style={{ position:'relative' }}>
        <MiniDonut pcts={pcts} colors={ZONE_COLORS} size={80}/>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', ...S.mono, fontSize:'9px', fontWeight:600, color:ZONE_COLORS[domIdx], textAlign:'center' }}>Z{domIdx+1}</div>
      </div>
      <div>
        {ZONE_NAMES.map((n,i)=>pcts[i]>0&&(
          <div key={i} style={{ display:'flex', gap:'6px', alignItems:'center', ...S.mono, fontSize:'10px', marginBottom:'2px' }}>
            <div style={{ width:'8px',height:'8px',background:ZONE_COLORS[i],borderRadius:'1px' }}/>
            <span style={{ color:'#888' }}>{n}</span>
            <span style={{ color:ZONE_COLORS[i], fontWeight:600, marginLeft:'auto' }}>{pcts[i]}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Full CTL Timeline ────────────────────────────────────────────────────────
export function CTLTimeline({ log }) {
  if (!log.length) return null
  const byDate = {}
  log.forEach(e=>{ byDate[e.date]=(byDate[e.date]||0)+(e.tss||0) })
  const dates=[], start=new Date(Object.keys(byDate).sort()[0]), today=new Date()
  today.setHours(0,0,0,0)
  for (let d=new Date(start);d<=today;d.setDate(d.getDate()+1)) {
    dates.push(d.toISOString().slice(0,10))
  }
  let ctl=0; const kC=2/(42+1)
  const points = dates.map(dt=>{ const tss=byDate[dt]||0; ctl=tss*kC+ctl*(1-kC); return { dt, ctl:Math.round(ctl) } })
  if (points.length < 2) return null

  const W=560, H=90, P={t:6,r:10,b:22,l:36}
  const iW=W-P.l-P.r, iH=H-P.t-P.b
  const maxCTL=Math.max(...points.map(p=>p.ctl),100)
  const xS=i=>P.l+(i/(points.length-1))*iW
  const yS=v=>P.t+iH-(v/maxCTL)*iH

  const bands=[{lo:0,hi:40,c:'#88888822',l:'Untrained'},{lo:40,hi:70,c:'#4a90d922',l:'Moderate'},{lo:70,hi:100,c:'#5bc25b22',l:'Trained'},{lo:100,hi:maxCTL+20,c:'#f5c54222',l:'Elite'}]
  const line = points.map((p,i)=>`${i===0?'M':'L'}${xS(i).toFixed(1)},${yS(p.ctl).toFixed(1)}`).join(' ')

  const monthLabels=[]
  points.forEach((p,i)=>{ if(p.dt.slice(8)==='01'||i===0) monthLabels.push({i,label:p.dt.slice(0,7)}) })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto' }}>
      {bands.map(b=>(
        <rect key={b.l} x={P.l} y={yS(Math.min(b.hi,maxCTL+20))} width={iW} height={Math.abs(yS(b.lo)-yS(Math.min(b.hi,maxCTL+20)))} fill={b.c}/>
      ))}
      <path d={line} fill="none" stroke="#0064ff" strokeWidth="1.5" strokeLinejoin="round"/>
      {monthLabels.slice(0,6).map(({i,label})=>(
        <text key={label} x={xS(i)} y={H-4} textAnchor="middle" fill="#bbb" fontSize="7" fontFamily="IBM Plex Mono,monospace">{label}</text>
      ))}
      {[40,70,100].map(v=>v<=maxCTL&&(
        <g key={v}>
          <line x1={P.l} x2={W-P.r} y1={yS(v)} y2={yS(v)} stroke="#e0e0e0" strokeWidth="1" strokeDasharray="2,2"/>
          <text x={P.l-3} y={yS(v)+3} textAnchor="end" fill="#bbb" fontSize="7" fontFamily="IBM Plex Mono,monospace">{v}</text>
        </g>
      ))}
    </svg>
  )
}
