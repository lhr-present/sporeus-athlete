import { useState, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { MACRO_PHASES, ZONE_COLORS, ZONE_NAMES, LOAD_COLOR } from '../lib/constants.js'

export default function Periodization() {
  const { t } = useContext(LangCtx)
  const [raceDate, setRaceDate] = useState('')
  const [hrs, setHrs] = useState('10')
  const hours = parseFloat(hrs)||10

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('macroCycleTitle')}</div>
        <div style={S.row}>
          <div style={{ flex:'1 1 160px' }}>
            <label style={S.label}>{t('raceDateL')}</label>
            <input style={S.input} type="date" value={raceDate} onChange={e=>setRaceDate(e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 140px' }}>
            <label style={S.label}>{t('weekHoursL')}</label>
            <input style={S.input} type="number" step="0.5" placeholder="10" value={hrs} onChange={e=>setHrs(e.target.value)}/>
          </div>
        </div>
        {raceDate && (
          <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'10px' }}>
            {t('startDateLbl')} {new Date(new Date(raceDate)-13*7*864e5).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
          </div>
        )}
      </div>
      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={S.cardTitle}>{t('zoneLegendTitle')}</div>
        <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
          {ZONE_NAMES.map((n,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', ...S.mono, fontSize:'11px' }}>
              <div style={{ width:'12px', height:'12px', background:ZONE_COLORS[i], borderRadius:'2px' }}/>
              {n}
            </div>
          ))}
        </div>
      </div>
      <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
        <div style={S.cardTitle}>{t('weekBreakTitle')}</div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'11px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', color:'#888', fontSize:'10px', letterSpacing:'0.06em' }}>
                {['WK','PHASE','FOCUS','HRS','ZONE DIST','LOAD'].map((h,i)=>(
                  <th key={h} style={{ textAlign:i>=3?'center':'left', padding:'4px 10px 8px 0', fontWeight:600, minWidth:i===4?'120px':undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MACRO_PHASES.map(row=>{
                const wh=row.load==='Low'?hours*.7:row.load==='Med'?hours:hours*1.25
                return (
                  <tr key={row.week} style={{ borderBottom:'1px solid var(--border)', background:row.phase==='Recovery'?'#fffbf0':row.phase==='Race'?'#fff8f8':'transparent' }}>
                    <td style={{ padding:'7px 10px 7px 0', fontWeight:600, color:'#ff6600' }}>{row.week}</td>
                    <td style={{ padding:'7px 10px 7px 0' }}>{row.phase}</td>
                    <td style={{ padding:'7px 10px 7px 0', color:'var(--sub)' }}>{row.focus}</td>
                    <td style={{ textAlign:'center', padding:'7px 10px 7px 0', fontWeight:600 }}>{wh.toFixed(1)}</td>
                    <td style={{ padding:'7px 0', minWidth:'120px' }}>
                      <div style={{ display:'flex', height:'10px', gap:'1px', borderRadius:'2px', overflow:'hidden' }}>
                        {row.zDist.map((pct,zi)=>pct>0&&<div key={zi} style={{ width:`${pct}%`, background:ZONE_COLORS[zi] }} title={`${ZONE_NAMES[zi]}: ${pct}%`}/>)}
                      </div>
                    </td>
                    <td style={{ textAlign:'center', padding:'7px 0' }}><span style={S.tag(LOAD_COLOR[row.load])}>{row.load}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'10px' }}>Polarized model \u2014 Seiler & T\u00f8nnessen (2009). ~80% Z1\u2013Z2, ~20% Z4\u2013Z5.</div>
      </div>
    </div>
  )
}
