import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { WELLNESS_FIELDS } from '../lib/constants.js'
import { Sparkline } from './ui.jsx'

export default function Recovery() {
  const { t } = useContext(LangCtx)
  const [entries, setEntries] = useLocalStorage('sporeus-recovery', [])
  const today = new Date().toISOString().slice(0,10)
  const todayEntry = entries.find(e=>e.date===today)
  const defVals = { sleep:3, soreness:3, energy:3, mood:3, stress:3 }
  const [form, setForm] = useState(todayEntry ? { ...todayEntry } : { ...defVals })

  useEffect(() => {
    const e = entries.find(x=>x.date===today)
    setForm(e ? {...e} : {...defVals})
  }, [today])

  const score = Math.round(Object.values({sleep:form.sleep,soreness:form.soreness,energy:form.energy,mood:form.mood,stress:form.stress}).reduce((s,v)=>s+v,0)/5*20)
  const readiness = score>=75?{label:t('goLabel'),color:'#5bc25b'}:score>=50?{label:t('monitorLabel'),color:'#f5c542'}:{label:t('restLabel'),color:'#e03030'}

  const save = () => {
    const entry = { date:today, ...form, score }
    const updated = entries.filter(e=>e.date!==today)
    setEntries([...updated, entry].slice(-90))
  }

  const last7scores = entries.slice(-7).map(e=>e.score)

  return (
    <div className="sp-fade">
      {todayEntry && (
        <div className="sp-card" style={{ ...S.card, borderLeft:`4px solid ${readiness.color}`, animationDelay:'0ms', ...S.mono, fontSize:'12px', color:'#888' }}>
          {t('alreadyLoggedMsg')}
        </div>
      )}

      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('wellnessTitle')} \u2014 {today}</div>
        {WELLNESS_FIELDS.map(field=>(
          <div key={field.key} style={{ marginBottom:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <label style={{ ...S.label, marginBottom:0 }}>{t(field.lk)}</label>
              <span style={{ ...S.mono, fontSize:'11px', color:'#888' }}>{form[field.key]}/5</span>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              {field.emoji.map((em,i)=>(
                <button key={i} onClick={()=>setForm({...form,[field.key]:i+1})}
                  style={{ fontSize:'20px', padding:'6px 10px', borderRadius:'6px', border:`2px solid ${form[field.key]===i+1?'#ff6600':'#e0e0e0'}`, background:form[field.key]===i+1?'#fff3eb':'#fff', cursor:'pointer', transition:'all 0.15s', lineHeight:1 }}>
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button style={S.btn} onClick={save}>{t('saveEntryBtn')}</button>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={S.cardTitle}>{t('readScoreTitle')}</div>
        <div style={{ display:'flex', alignItems:'center', gap:'24px' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ ...S.mono, fontSize:'48px', fontWeight:600, color:readiness.color, lineHeight:1 }}>{score}</div>
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'4px' }}>/100</div>
          </div>
          <div>
            <span style={{ ...S.tag(readiness.color), fontSize:'14px', padding:'6px 16px' }}>{readiness.label}</span>
            <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'8px' }}>
              \u226575: {t('goLabel')} \u00b7 50\u201374: {t('monitorLabel')} \u00b7 &lt;50: {t('restLabel')}
            </div>
          </div>
          <div style={{ marginLeft:'auto' }}>
            <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'4px' }}>7-DAY</div>
            <Sparkline data={last7scores}/>
          </div>
        </div>
      </div>

      {entries.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
          <div style={S.cardTitle}>{t('hist7Title')}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', color:'#888', fontSize:'10px' }}>
                {['DATE','SLEEP','SORENESS','ENERGY','MOOD','STRESS','SCORE'].map(h=>(
                  <th key={h} style={{ textAlign:h==='SCORE'?'right':'left', padding:'4px 6px 8px 0', fontWeight:600, fontSize:'9px', letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...entries].slice(-7).reverse().map((e,i)=>{
                const sc=e.score||0
                const sc_c=sc>=75?'#5bc25b':sc>=50?'#f5c542':'#e03030'
                return (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'6px 6px 6px 0', color:'var(--sub)' }}>{e.date}</td>
                    {['sleep','soreness','energy','mood','stress'].map(k=>(
                      <td key={k} style={{ padding:'6px 6px 6px 0' }}>{WELLNESS_FIELDS.find(f=>f.key===k)?.emoji[(e[k]||3)-1]}</td>
                    ))}
                    <td style={{ textAlign:'right', padding:'6px 0', color:sc_c, fontWeight:600 }}>{sc}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
