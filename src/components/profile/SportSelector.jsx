// ─── SportSelector — primary sport, triathlon type, secondary sports, level ──
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { SPORT_BRANCHES, TRIATHLON_TYPES, ATHLETE_LEVELS } from '../../lib/constants.js'

export default function SportSelector({ local, setLocal }) {
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
