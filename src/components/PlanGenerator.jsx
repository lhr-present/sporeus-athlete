import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { PLAN_GOALS, PLAN_LEVELS, ZONE_COLORS, ZONE_NAMES } from '../lib/constants.js'
import { generatePlan } from '../lib/formulas.js'
import { MiniDonut } from './ui.jsx'

function TaperCalculator() {
  const [peakTSS, setPeakTSS] = useState('500')
  const [peakVol, setPeakVol] = useState('10')
  const [taperWeeks, setTaperWeeks] = useState('2')
  const [model, setModel] = useState('exp')

  const PT = parseFloat(peakTSS)||500, PV = parseFloat(peakVol)||10, TW = parseInt(taperWeeks)||2

  const genTaper = () => {
    const weeks = []
    for (let i = 0; i <= TW; i++) {
      let volPct, tssPct
      if (model === 'exp') {
        const ratio = i === TW ? 0.40 : 1 - (1 - 0.40) * (i / TW) * (2 - i / TW) * 0.5
        volPct = Math.round((i === 0 ? 1 : Math.pow(0.40, i / TW)) * 100)
        tssPct = Math.round((i === 0 ? 1 : Math.pow(0.40, i / TW)) * 100)
      } else {
        volPct = Math.round((1 - i / TW * 0.6) * 100)
        tssPct = Math.round((1 - i / TW * 0.6) * 100)
      }
      if (i === TW) { volPct = 40; tssPct = 40 }
      weeks.push({
        label: i === 0 ? 'PEAK' : i === TW ? 'RACE WK' : `TAPER ${i}`,
        vol: Math.round(PV * volPct / 100 * 10) / 10,
        tss: Math.round(PT * tssPct / 100),
        volPct, tssPct,
        isRace: i === TW,
      })
    }
    return weeks
  }

  const taperData = genTaper()
  const tips = [
    'Maintain intensity — only reduce volume',
    'Keep ≥1 quality session/week during taper',
    'Sleep 8–9h, prioritize nutrition carb-loading in final 3 days',
    '2-week taper: −40% week 1 → −60% race week',
    '3-week taper: −20% → −40% → −60%',
  ]

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'250ms' }}>
      <div style={S.cardTitle}>TAPER CALCULATOR</div>
      <div style={S.row}>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>PEAK WEEKLY TSS: <strong>{peakTSS}</strong></label>
          <input type="range" min="200" max="1200" step="10" value={peakTSS} onChange={e=>setPeakTSS(e.target.value)} style={{ width:'100%', accentColor:'#ff6600' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>200</span><span>1200</span></div>
        </div>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>PEAK VOLUME (h/wk): <strong>{peakVol}</strong></label>
          <input type="range" min="3" max="20" value={peakVol} onChange={e=>setPeakVol(e.target.value)} style={{ width:'100%', accentColor:'#ff6600' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>3h</span><span>20h</span></div>
        </div>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>TAPER WEEKS: <strong>{taperWeeks}</strong></label>
          <input type="range" min="1" max="4" value={taperWeeks} onChange={e=>setTaperWeeks(e.target.value)} style={{ width:'100%', accentColor:'#4a90d9' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>1</span><span>4</span></div>
        </div>
      </div>
      <div style={{ display:'flex', gap:'6px', margin:'10px 0' }}>
        {['exp','linear'].map(m=>(
          <button key={m} onClick={()=>setModel(m)} style={{ ...S.navBtn(model===m), borderRadius:'4px', fontSize:'10px', padding:'4px 10px' }}>
            {m==='exp'?'Exponential':'Linear'}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', gap:'6px', flexWrap:'nowrap', overflowX:'auto', padding:'4px 0' }}>
        {taperData.map((w,i)=>(
          <div key={i} style={{ flex:'1 1 80px', minWidth:'75px', background: w.isRace?'#ff660022':'var(--card-bg)', border:`1px solid ${w.isRace?'#ff6600':'var(--border)'}`, borderTop:`3px solid ${w.isRace?'#ff6600':'#4a90d9'}`, borderRadius:'5px', padding:'8px 10px', textAlign:'center' }}>
            <div style={{ ...S.mono, fontSize:'9px', fontWeight:600, color: w.isRace?'#ff6600':'#888', marginBottom:'4px' }}>{w.label}</div>
            <div style={{ ...S.mono, fontSize:'14px', fontWeight:600, color:'var(--text)' }}>{w.vol}h</div>
            <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600' }}>{w.tss} TSS</div>
            <div style={{ ...S.mono, fontSize:'9px', color:'var(--muted)', marginTop:'2px' }}>{w.volPct}%</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:'12px' }}>
        {tips.map((tip,i)=>(
          <div key={i} style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', padding:'2px 0', display:'flex', gap:'6px' }}>
            <span style={{ color:'#ff6600' }}>◈</span>{tip}
          </div>
        ))}
      </div>
      <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'8px' }}>Mujika &amp; Padilla (2003) · Bosquet et al. (2007) meta-analysis</div>
    </div>
  )
}

export default function PlanGenerator({ onLogSession }) {
  const { t } = useContext(LangCtx)
  const [goal,  setGoal]  = useState('Half Marathon')
  const [weeks, setWeeks] = useState(12)
  const [hours, setHours] = useState(8)
  const [level, setLevel] = useState('Intermediate')
  const [plan,  setPlan]  = useLocalStorage('sporeus-plan', null)
  const [planStatus, setPlanStatus] = useLocalStorage('sporeus-plan-status', {})
  const [selWeek, setSelWeek] = useState(0)

  const toggleStatus = (wi, di, val) => {
    const key = `${wi}-${di}`
    setPlanStatus(prev => {
      const next = { ...prev }
      if (next[key] === val) delete next[key]
      else next[key] = val
      return next
    })
  }
  const weekCompliance = (wi) => {
    if (!plan) return null
    const sessions = plan.weeks[wi].sessions
    let total = 0, done = 0
    sessions.forEach((s, di) => {
      if (s.type !== 'Rest' && s.duration > 0) {
        total++
        const st = planStatus[`${wi}-${di}`]
        if (st === 'done' || st === 'modified') done++
      }
    })
    return total ? Math.round(done / total * 100) : null
  }
  const planCompliance = () => {
    if (!plan) return null
    let total = 0, done = 0
    plan.weeks.forEach((w, wi) => {
      w.sessions.forEach((s, di) => {
        if (s.type !== 'Rest' && s.duration > 0) {
          total++
          const st = planStatus[`${wi}-${di}`]
          if (st === 'done' || st === 'modified') done++
        }
      })
    })
    return total ? Math.round(done / total * 100) : null
  }

  const today = new Date().toISOString().slice(0,10)
  const thisWeekIdx = plan ? Math.min(
    Math.floor((new Date(today) - new Date(plan.generatedAt)) / (7*864e5)),
    plan.weeks.length - 1
  ) : 0

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('plan_goal')) setGoal(decodeURIComponent(p.get('plan_goal')))
    if (p.get('plan_weeks')) setWeeks(Math.min(24, Math.max(4, parseInt(p.get('plan_weeks'))||12)))
    if (p.get('plan_hours')) setHours(Math.min(15, Math.max(3, parseInt(p.get('plan_hours'))||8)))
    if (p.get('plan_level')) setLevel(decodeURIComponent(p.get('plan_level')))
  }, [])

  const [shareMsg, setShareMsg] = useState('')

  const sharePlan = () => {
    const base = window.location.origin + window.location.pathname
    const params = new URLSearchParams({
      plan_goal: goal,
      plan_weeks: weeks,
      plan_hours: hours,
      plan_level: level,
    })
    const url = `${base}?${params.toString()}#plan`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => { setShareMsg('Link copied!'); setTimeout(()=>setShareMsg(''),2500) })
    } else {
      setShareMsg(url)
    }
  }

  const generate = () => {
    const weeks_arr = generatePlan(goal, weeks, hours, level)
    setPlan({ goal, weeks: weeks_arr, generatedAt: today, level, hoursPerWeek: hours })
    setSelWeek(0)
  }

  const printPlan = () => {
    if (!plan) return
    const phaseColors = { Base:'#4a90d9', Build:'#f5c542', Peak:'#e03030', Peak2:'#e03030', Taper:'#888', Recovery:'#5bc25b', 'Race Week':'#ff6600' }
    const rows = plan.weeks.map(w => {
      const activeSessions = w.sessions.filter(s => s.type !== 'Rest' && s.duration > 0)
      return `<tr>
        <td style="font-weight:600;color:${phaseColors[w.phase]||'#888'}">${w.week}</td>
        <td style="font-weight:600;color:${phaseColors[w.phase]||'#888'}">${w.phase}</td>
        <td>${w.totalHours}h</td>
        <td>${w.tss}</td>
        <td style="font-size:10px">${activeSessions.map(s=>`${s.day}: ${s.type} ${s.duration}min`).join('<br>')}</td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><title>${plan.goal} Training Plan</title>
    <style>
      body{font-family:'Courier New',monospace;font-size:11px;color:#1a1a1a;margin:24px;background:#fff}
      h1{font-size:16px;border-bottom:2px solid #ff6600;padding-bottom:8px;margin-bottom:16px}
      .meta{font-size:11px;color:#555;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:10px;border:1px solid #ccc}
      td{padding:6px 8px;border:1px solid #e0e0e0;vertical-align:top}
      tr:nth-child(even){background:#fafafa}
      .footer{margin-top:24px;font-size:10px;color:#888;border-top:1px solid #e0e0e0;padding-top:8px}
      @media print{body{margin:12px}}
    </style></head><body>
    <h1>SPOREUS ATHLETE — ${plan.goal.toUpperCase()} TRAINING PLAN</h1>
    <div class="meta">
      Level: ${plan.level} &nbsp;|&nbsp; Duration: ${plan.weeks.length} weeks &nbsp;|&nbsp;
      Volume: ~${plan.hoursPerWeek}h/week &nbsp;|&nbsp; Generated: ${plan.generatedAt}
    </div>
    <table><thead><tr><th>WK</th><th>PHASE</th><th>VOL</th><th>TSS</th><th>SESSIONS</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="footer">sporeus.com — Science-based periodization · EŞİK / THRESHOLD</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}</script>
    </body></html>`
    const w = window.open('', '_blank', 'width=900,height=700')
    if (w) { w.document.write(html); w.document.close() }
  }

  const W = plan?.weeks[selWeek]

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('planGoalL')}</div>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
          {PLAN_GOALS.map(g=>(
            <button key={g} onClick={()=>setGoal(g)}
              style={{ ...S.navBtn(goal===g), borderRadius:'4px', fontSize:'11px', padding:'6px 12px' }}>{g}</button>
          ))}
        </div>
        <div style={S.row}>
          <div style={{ flex:'1 1 180px' }}>
            <label style={S.label}>{t('planWeeksL')}: <strong>{weeks}</strong></label>
            <input type="range" min="4" max="24" value={weeks} onChange={e=>setWeeks(+e.target.value)}
              style={{ width:'100%', accentColor:'#ff6600' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>4</span><span>24</span></div>
          </div>
          <div style={{ flex:'1 1 180px' }}>
            <label style={S.label}>{t('planHoursL')}: <strong>{hours}h</strong></label>
            <input type="range" min="3" max="15" value={hours} onChange={e=>setHours(+e.target.value)}
              style={{ width:'100%', accentColor:'#ff6600' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>3h</span><span>15h</span></div>
          </div>
        </div>
        <div style={{ marginTop:'12px' }}>
          <label style={S.label}>{t('planLevelL')}</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {PLAN_LEVELS.map(lv=>(
              <button key={lv} onClick={()=>setLevel(lv)}
                style={{ ...S.navBtn(level===lv), borderRadius:'4px', fontSize:'11px', padding:'6px 14px' }}>{lv}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', marginTop:'16px', flexWrap:'wrap', alignItems:'center' }}>
          <button style={S.btn} onClick={generate}>{t('genPlanBtn')}</button>
          <button style={{ ...S.btnSec, fontSize:'11px' }} onClick={sharePlan}>⤴ Share Config</button>
          {shareMsg && <span style={{ ...S.mono, fontSize:'11px', color:'#5bc25b' }}>{shareMsg}</span>}
        </div>
      </div>

      <div style={{ ...S.card, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'12px 16px', marginBottom:'16px', ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.8 }}>
        {t('coachNote')}{' '}
        <a href="https://sporeus.com" target="_blank" rel="noreferrer" style={{ color:'#0064ff', fontWeight:600 }}>sporeus.com →</a>
      </div>

      {plan && (
        <>
          <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={S.cardTitle}>{plan.goal} — {plan.weeks.length} {t('weekLabel').toLowerCase()}s · {plan.level}</div>
                <button onClick={printPlan} style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:'1px solid var(--border)', background:'transparent', color:'var(--muted)' }}>⎙ Print/PDF</button>
              </div>
              {planCompliance() !== null && (
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ ...S.mono, fontSize:'10px', color:'#888' }}>PLAN COMPLIANCE</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                    <div style={{ width:'80px', height:'6px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ width:`${planCompliance()}%`, height:'100%', background: planCompliance()>=80?'#5bc25b':planCompliance()>=50?'#f5c542':'#e03030', borderRadius:'3px', transition:'width 0.3s' }}/>
                    </div>
                    <span style={{ ...S.mono, fontSize:'11px', fontWeight:600, color: planCompliance()>=80?'#5bc25b':planCompliance()>=50?'#f5c542':'#e03030' }}>{planCompliance()}%</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {plan.weeks.map((w,i) => {
                const isThis = Boolean(plan) && i === thisWeekIdx
                const isSel  = i === selWeek
                const phaseColor = { Base:'#4a90d9', Build:'#f5c542', Peak:'#e03030', Peak2:'#e03030', Taper:'#888', Recovery:'#5bc25b', 'Race Week':'#ff6600' }[w.phase] || '#888'
                const wc = weekCompliance(i)
                return (
                  <button key={i} onClick={()=>setSelWeek(i)} style={{
                    ...S.mono, fontSize:'10px', fontWeight:600, padding:'5px 9px', borderRadius:'4px', cursor:'pointer',
                    background: isSel ? phaseColor : 'var(--card-bg)',
                    color: isSel ? '#fff' : 'var(--sub)',
                    border: isThis ? `2px solid ${phaseColor}` : '2px solid transparent',
                    position:'relative',
                  }}>
                    W{w.week}
                    {isThis && <span style={{ position:'absolute', top:'-4px', right:'-4px', width:'7px', height:'7px', background:'#ff6600', borderRadius:'50%' }}/>}
                    {wc !== null && <span style={{ position:'absolute', bottom:'-6px', left:'50%', transform:'translateX(-50%)', fontSize:'8px', color: wc>=80?'#5bc25b':wc>=50?'#f5c542':'#e03030', fontWeight:700 }}>{wc}%</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {W && (
            <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                    <div style={S.cardTitle}>{t('weekLabel')} {W.week} — {W.phase.toUpperCase()}</div>
                    {selWeek === thisWeekIdx && <span style={{ ...S.tag('#ff6600') }}>THIS WEEK</span>}
                    {weekCompliance(selWeek) !== null && (
                      <span style={{ ...S.mono, fontSize:'10px', fontWeight:700, color: weekCompliance(selWeek)>=80?'#5bc25b':weekCompliance(selWeek)>=50?'#f5c542':'#e03030' }}>
                        {weekCompliance(selWeek)}% DONE
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:'16px' }}>
                    {[{l:t('totalHrsLabel'),v:`${W.totalHours}h`},{l:t('tssEstLabel'),v:W.tss}].map(({l,v})=>(
                      <div key={l}>
                        <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{l}</div>
                        <div style={{ ...S.mono, fontSize:'15px', fontWeight:600, color:'#ff6600' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <MiniDonut pcts={W.zonePct} colors={ZONE_COLORS} size={56}/>
                  <div style={{ ...S.mono, fontSize:'8px', color:'#888', lineHeight:2 }}>
                    {ZONE_NAMES.map((n,i)=>W.zonePct[i]>0 && <div key={i} style={{ color:ZONE_COLORS[i] }}>Z{i+1}: {W.zonePct[i]}%</div>)}
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'8px' }}>
                {W.sessions.map((ses, di) => {
                  const stKey = `${selWeek}-${di}`
                  const st = planStatus[stKey]
                  const stColors = { done:'#5bc25b', skipped:'#888', modified:'#f5c542' }
                  const stLabels = { done:'✓ DONE', skipped:'↷ SKIPPED', modified:'~ MODIFIED' }
                  return (
                  <div key={di} style={{
                    background: st==='done' ? '#5bc25b11' : st==='skipped' ? 'var(--card-bg)' : ses.type==='Rest' ? 'var(--card-bg)' : `${ses.color}11`,
                    border: `1px solid ${st ? stColors[st]+'44' : ses.type==='Rest'?'var(--border)':ses.color+'44'}`,
                    borderLeft: `3px solid ${st ? stColors[st] : ses.color}`,
                    borderRadius:'5px', padding:'10px 12px',
                    opacity: st==='skipped' ? 0.65 : 1,
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                      <span style={{ ...S.mono, fontSize:'10px', fontWeight:600, color:'var(--muted)' }}>{ses.day.toUpperCase()}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        {st && <span style={{ ...S.mono, fontSize:'9px', fontWeight:700, color:stColors[st] }}>{stLabels[st]}</span>}
                        {ses.duration > 0 && <span style={{ ...S.mono, fontSize:'10px', color:'var(--muted)' }}>{ses.duration}min</span>}
                      </div>
                    </div>
                    <div style={{ ...S.mono, fontSize:'12px', fontWeight:600, color:ses.type==='Rest'?'var(--border)':ses.color, marginBottom:'4px' }}>{ses.type}</div>
                    {ses.zone !== '—' && <span style={{ ...S.tag(ses.color), fontSize:'9px', marginBottom:'6px', display:'inline-block' }}>{ses.zone}</span>}
                    <div style={{ fontSize:'11px', color:'var(--sub)', lineHeight:1.6, marginTop:'4px' }}>{ses.description}</div>
                    {ses.type !== 'Rest' && ses.duration > 0 && (
                      <>
                        <div style={{ display:'flex', gap:'4px', marginTop:'8px' }}>
                          {['done','skipped','modified'].map(s=>(
                            <button key={s} onClick={()=>toggleStatus(selWeek,di,s)}
                              style={{ flex:1, ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 0', borderRadius:'3px', cursor:'pointer', border:`1px solid ${st===s?stColors[s]:'var(--border)'}`, background:st===s?stColors[s]+'22':'transparent', color:st===s?stColors[s]:'var(--muted)' }}>
                              {s==='done'?'✓':s==='skipped'?'↷':'~'} {s.charAt(0).toUpperCase()+s.slice(1)}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => onLogSession(ses)}
                          style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px', marginTop:'6px', width:'100%' }}>
                          {'\u2261'} {t('logThisBtn')}
                        </button>
                      </>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!plan && (
        <div style={{ textAlign:'center', ...S.mono, fontSize:'12px', color:'#aaa', padding:'40px 0' }}>{t('noPlanYet')}</div>
      )}

      <TaperCalculator />
    </div>
  )
}
