import { useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { TSSChart, WeeklyVolChart, ZoneDonut, ZoneBar, CTLTimeline } from './ui.jsx'
import { monotonyStrain, calcPRs, navyBF, mifflinBMR, riegel, fmtSec, fmtPace, calcLoad } from '../lib/formulas.js'
import { useCountUp } from '../hooks/useCountUp.js'

export default function Dashboard({ log, profile }) {
  const { t } = useContext(LangCtx)
  const last7 = log.slice(-7)
  const totalTSS = last7.reduce((s,e)=>s+(e.tss||0),0)
  const totalMin = last7.reduce((s,e)=>s+(e.duration||0),0)
  const avgRPE   = last7.length ? (last7.reduce((s,e)=>s+(e.rpe||0),0)/last7.length).toFixed(1) : '\u2014'
  const { atl, ctl, tsb, daily } = calcLoad(log)
  const readiness = totalTSS>600?{label:t('fatigued'),color:'#e03030'}:totalTSS>400?{label:t('trained'),color:'#f5c542'}:{label:t('fresh'),color:'#5bc25b'}
  const tsbColor = tsb>5?'#5bc25b':tsb<-10?'#e03030':'#f5c542'
  const countSess = useCountUp(last7.length)
  const countTSS  = useCountUp(totalTSS)
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()

  return (
    <div className="sp-fade">
      <div style={{ marginBottom:'16px' }}>
        <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginBottom:'4px' }}>{today}</div>
        <div style={{ ...S.mono, fontSize:'18px', fontWeight:600 }}>
          {profile.name ? `ATHLETE: ${profile.name.toUpperCase()}` : t('appTitle')}
        </div>
      </div>

      <div className="sp-card" style={{ ...S.card, borderLeft:`4px solid ${readiness.color}`, animationDelay:'0ms' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={S.cardTitle}>{t('readiness')}</div>
            <span style={S.tag(readiness.color)}>{readiness.label}</span>
            <div style={{ display:'flex', gap:'16px', marginTop:'10px' }}>
              {[{lbl:t('ctlLabel'),v:ctl,c:'#0064ff'},{lbl:t('atlLabel'),v:atl,c:'#ef4444'},{lbl:t('tsbLabel'),v:(tsb>=0?'+':'')+tsb,c:tsbColor}].map(({lbl,v,c})=>(
                <div key={lbl}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.08em' }}>{lbl}</div>
                  <div style={{ ...S.mono, fontSize:'16px', fontWeight:600, color:c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...S.mono, fontSize:'40px', fontWeight:600, color:readiness.color }}>{countTSS}</div>
        </div>
      </div>

      <div className="sp-card" style={{ ...S.row, marginBottom:'16px', animationDelay:'50ms' }}>
        {[
          { val:countSess,                              lbl:t('sessions') },
          { val:`${Math.floor(totalMin/60)}h ${totalMin%60}m`, lbl:t('volume') },
          { val:avgRPE,                                 lbl:t('avgRpe') },
          { val:totalTSS,                               lbl:t('tss7') },
        ].map(({val,lbl})=>(
          <div key={lbl} style={S.stat}>
            <span style={S.statVal}>{val}</span>
            <span style={S.statLbl}>{lbl}</span>
          </div>
        ))}
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
        <div style={S.cardTitle}>{t('tssChartTitle')}</div>
        <TSSChart daily={daily} t={t} />
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'150ms' }}>
        <div style={S.cardTitle}>{t('recentSessions')}</div>
        {last7.length===0 ? (
          <div style={{ ...S.mono, fontSize:'12px', color:'#aaa', textAlign:'center', padding:'20px 0' }}>{t('noSessions')}</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', color:'#888', fontSize:'10px', letterSpacing:'0.06em' }}>
                {[t('dateL'),'TYPE','MIN','RPE','TSS'].map(h=>(
                  <th key={h} style={{ textAlign:h==='TSS'||h==='MIN'||h==='RPE'?'right':'left', padding:'4px 6px 8px 0', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...last7].reverse().map((s,i)=>(
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 6px 6px 0', color:'var(--sub)' }}>{s.date}</td>
                  <td style={{ padding:'6px 6px 6px 0' }}>{s.type}</td>
                  <td style={{ textAlign:'right', padding:'6px 6px 6px 0' }}>{s.duration}</td>
                  <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:s.rpe>=8?'#e03030':s.rpe>=6?'#f5c542':'#5bc25b' }}>{s.rpe}</td>
                  <td style={{ textAlign:'right', padding:'6px 0', color:'#ff6600', fontWeight:600 }}>{s.tss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {log.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'170ms' }}>
          <div style={S.cardTitle}>WEEKLY VOLUME — LAST 8 WEEKS</div>
          <WeeklyVolChart log={log}/>
        </div>
      )}

      {log.length>0 && (() => {
        const { mono, strain } = monotonyStrain(log)
        const prs = calcPRs(log)
        const monoRed = mono>2.0, strainRed = strain>6000
        return (
          <div className="sp-card" style={{ ...S.row, marginBottom:'16px', animationDelay:'180ms' }}>
            <div style={{ ...S.card, flex:'1 1 200px', marginBottom:0 }}>
              <div style={S.cardTitle}>ZONE DISTRIBUTION</div>
              <ZoneDonut log={log}/>
            </div>
            <div style={{ flex:'1 1 200px', display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ ...S.card, marginBottom:0, borderLeft:`3px solid ${monoRed?'#e03030':'#5bc25b'}` }}>
                <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>MONOTONY INDEX</div>
                <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:monoRed?'#e03030':'#1a1a1a' }}>{mono}</div>
                <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>{monoRed?'⚠ INJURY RISK':'Normal'} (alert &gt;2.0)</div>
              </div>
              <div style={{ ...S.card, marginBottom:0, borderLeft:`3px solid ${strainRed?'#e03030':'#5bc25b'}` }}>
                <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>STRAIN INDEX</div>
                <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:strainRed?'#e03030':'#1a1a1a' }}>{strain}</div>
                <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>{strainRed?'⚠ HIGH':'Normal'} (alert &gt;6000)</div>
              </div>
            </div>
          </div>
        )
      })()}

      {log.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'190ms' }}>
          <div style={S.cardTitle}>🏆 PERSONAL RECORDS</div>
          <div style={S.row}>
            {calcPRs(log).map(pr=>(
              <div key={pr.label} style={{ ...S.stat, flex:'1 1 130px', textAlign:'left', padding:'10px 12px' }}>
                <span style={{ ...S.statVal, fontSize:'15px', textAlign:'left' }}>{pr.value}</span>
                <span style={S.statLbl}>{pr.label}</span>
                {pr.date&&<div style={{ ...S.mono, fontSize:'9px', color:'var(--sub)', marginTop:'2px' }}>{pr.date} · {pr.unit}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {log.length>3 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'195ms' }}>
          <div style={S.cardTitle}>FITNESS TIMELINE — CTL (ALL TIME)</div>
          <CTLTimeline log={log}/>
          <div style={{ display:'flex', gap:'12px', marginTop:'6px', flexWrap:'wrap' }}>
            {[{l:'Untrained',c:'#888'},{l:'Moderate',c:'#4a90d9'},{l:'Trained',c:'#5bc25b'},{l:'Elite',c:'#f5c542'}].map(({l,c})=>(
              <div key={l} style={{ display:'flex', alignItems:'center', gap:'4px', ...S.mono, fontSize:'9px', color:c }}>
                <div style={{ width:'10px',height:'4px',background:c+'44',border:`1px solid ${c}`}}/>{l}
              </div>
            ))}
          </div>
        </div>
      )}

      {(() => {
        const h = parseFloat(profile.height||0), w = parseFloat(profile.weight||0)
        const a = parseFloat(profile.age||0), g = profile.gender||'male'
        const n = parseFloat(profile.neck||0), wa = parseFloat(profile.waist||0), hi_p = parseFloat(profile.hip||0)
        const bf = (n&&wa&&h) ? navyBF(n, wa, hi_p, h, g) : null
        const bmi = (w&&h) ? Math.round(w/(h/100)**2*10)/10 : null
        const bmr = (w&&h&&a) ? mifflinBMR(w,h,a,g) : null
        if (!bf && !bmi) return null
        const bfColor = g==='male' ? (bf<10?'#4a90d9':bf<20?'#5bc25b':bf<25?'#f5c542':'#e03030') : (bf<20?'#4a90d9':bf<28?'#5bc25b':bf<35?'#f5c542':'#e03030')
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'198ms' }}>
            <div style={S.cardTitle}>BODY COMPOSITION</div>
            <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
              {bf !== null && (
                <div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>BODY FAT (NAVY)</div>
                  <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:bfColor }}>{bf}%</div>
                </div>
              )}
              {bmi !== null && (
                <div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>BMI</div>
                  <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:bmi<18.5||bmi>=30?'#e03030':bmi<25?'#5bc25b':'#f5c542' }}>{bmi}</div>
                </div>
              )}
              {bmr !== null && (
                <div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>BMR (TDEE@1.55)</div>
                  <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:'var(--text)' }}>{Math.round(bmr*1.55)}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>kcal/day</div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {(() => {
        if (!profile.ftp && !profile.ltPace) return null
        const ftp = parseFloat(profile.ftp||0)
        const ltPaceSec = profile.ltPace ? profile.ltPace.split(':').reduce((a,v,i,arr)=>a+(arr.length===3?[3600,60,1][i]:i===0?60:1)*parseFloat(v),0) : 0
        if (!ftp && !ltPaceSec) return null
        const targets = [
          {label:'5K', m:5000},{label:'10K', m:10000},{label:'HM', m:21097},{label:'Marathon', m:42195}
        ]
        const d1 = ltPaceSec ? 1000 : 0
        const t1 = ltPaceSec ? ltPaceSec : 0
        if (!t1) return null
        const preds = targets.map(({label,m})=>({ label, time:fmtSec(riegel(t1,d1,m)), pace:fmtPace(riegel(t1,d1,m),m) }))
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'199ms' }}>
            <div style={S.cardTitle}>RACE PREDICTIONS (RIEGEL)</div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {preds.map(p=>(
                <div key={p.label} style={{ flex:'1 1 100px', background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'5px', padding:'10px 12px' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{p.label}</div>
                  <div style={{ ...S.mono, fontSize:'15px', fontWeight:600, color:'#ff6600' }}>{p.time}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'var(--sub)' }}>{p.pace}/km</div>
                </div>
              ))}
            </div>
            <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'6px' }}>Based on LT pace · Riegel formula</div>
          </div>
        )
      })()}

      <div className="sp-card" style={{ ...S.card, animationDelay:'200ms' }}>
        <div style={S.cardTitle}>{t('quickLinks')}</div>
        <div style={S.row}>
          {[
            ['sporeus.com','https://sporeus.com'],
            ['EŞİK Kitabı','https://sporeus.com/esik/'],
            ['Hesaplayıcılar','https://sporeus.com/hesaplayicilar/'],
            ['THRESHOLD Book','https://sporeus.com/en/threshold/'],
          ].map(([label,href])=>(
            <a key={label} href={href} target="_blank" rel="noreferrer"
              style={{ ...S.mono, fontSize:'12px', color:'#0064ff', textDecoration:'none', padding:'4px 0' }}>
              \u2192 {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
