import { useState, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { navyBF } from '../../lib/formulas.js'

export default function BodyComp({ profile, setProfile }) {
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
