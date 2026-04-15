// ─── NutritionEstimator — BMR, TDEE, protein/carb ranges, race fueling ───────
import { useState, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { mifflinBMR } from '../../lib/formulas.js'
import { ACTIVITY_MULTS } from '../../lib/constants.js'

export default function NutritionEstimator({ profile }) {
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
