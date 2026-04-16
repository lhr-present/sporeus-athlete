import { useState, useContext } from 'react'
import { logger } from '../../lib/logger.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { calcLoad } from '../../lib/formulas.js'

export default function AthleteCard({ profile, log }) {
  const { t: _t } = useContext(LangCtx)
  const [status, setStatus] = useState(null)
  const last28 = log.slice(-28)
  const totalH = Math.round(last28.reduce((s,e)=>s+(e.duration||0),0)/60)
  const sessions28 = last28.length
  const avgRPE28 = sessions28 ? (last28.reduce((s,e)=>s+(e.rpe||0),0)/sessions28).toFixed(1) : '—'
  const { tsb } = calcLoad(log)

  const downloadCard = async () => {
    let fm = 'monospace'
    try {
      const f = new FontFace('IBM Plex Mono','url(https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n5iQ.woff2)')
      await f.load(); document.fonts.add(f); fm = '"IBM Plex Mono"'
    } catch (e) { logger.warn('caught:', e.message) }
    const c = document.createElement('canvas')
    c.width=400; c.height=580
    const ctx = c.getContext('2d')
    ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,400,580)
    ctx.fillStyle='#ff6600'; ctx.fillRect(0,0,400,4)
    ctx.fillStyle='#ff6600'; ctx.font=`bold 22px ${fm}`; ctx.fillText(profile.name||'ATHLETE',24,52)
    ctx.fillStyle='#888'; ctx.font=`12px ${fm}`; ctx.fillText((profile.sport||'ENDURANCE').toUpperCase(),24,72)
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,85); ctx.lineTo(376,85); ctx.stroke()
    const stats=[
      ['VO₂max',profile.vo2max?`${profile.vo2max} mL/kg/min`:'—'],
      ['FTP',profile.ftp?`${profile.ftp}W`:'—'],
      ['Max HR',profile.maxhr?`${profile.maxhr} bpm`:'—'],
      ['Age',profile.age||'—'],
    ]
    stats.forEach(([l,v],i)=>{
      const x=24+(i%2)*190, y=130+Math.floor(i/2)*70
      ctx.fillStyle='#888'; ctx.font=`10px ${fm}`; ctx.fillText(l.toUpperCase(),x,y-14)
      ctx.fillStyle='#ff6600'; ctx.font=`bold 20px ${fm}`; ctx.fillText(String(v),x,y)
    })
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,290); ctx.lineTo(376,290); ctx.stroke()
    ctx.fillStyle='#888'; ctx.font=`10px ${fm}`; ctx.fillText('4-WEEK SUMMARY',24,314)
    const sums=[['HOURS',`${totalH}h`],['SESSIONS',sessions28],['AVG RPE',avgRPE28]]
    sums.forEach(([l,v],i)=>{
      const x=24+i*120
      ctx.fillStyle='#e5e5e5'; ctx.font=`bold 18px ${fm}`; ctx.fillText(String(v),x,348)
      ctx.fillStyle='#888'; ctx.font=`9px ${fm}`; ctx.fillText(l,x,366)
    })
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,390); ctx.lineTo(376,390); ctx.stroke()
    ctx.fillStyle='#888'; ctx.font=`10px ${fm}`; ctx.fillText('CURRENT FORM (TSB)',24,414)
    const tsbColor = tsb>5?'#5bc25b':tsb<-10?'#e03030':'#f5c542'
    ctx.fillStyle=tsbColor; ctx.font=`bold 28px ${fm}`; ctx.fillText((tsb>=0?'+':'')+tsb,24,448)
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,490); ctx.lineTo(376,490); ctx.stroke()
    ctx.fillStyle='#555'; ctx.font=`10px ${fm}`; ctx.fillText('SPOREUS ATHLETE CONSOLE — SPOREUS.COM',24,514)
    ctx.fillStyle='#444'; ctx.font=`9px ${fm}`; ctx.fillText('sporeus.com — Science-based endurance training console',24,534)
    c.toBlob(blob=>{
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a'); a.href=url; a.download='sporeus-athlete-card.png'; a.click()
      URL.revokeObjectURL(url)
    })
  }

  const share = async () => {
    const text=`${profile.name||'Athlete'} | ${profile.sport||'Endurance'} | VO₂max: ${profile.vo2max||'?'} | ${sessions28} sessions / 4 weeks — via Sporeus Athlete Console`
    try {
      if (navigator.share) await navigator.share({ title:'Sporeus Athlete Card', text, url:'https://sporeus.com' })
      else { await navigator.clipboard.writeText(text); setStatus('copied'); setTimeout(()=>setStatus(null),2000) }
    } catch (e) { logger.warn('share:', e.message) }
  }

  return (
    <div style={{ ...S.card, background:'#0a0a0a', border:'1px solid #333', borderRadius:'8px', padding:'20px' }}>
      <div style={{ ...S.cardTitle, color:'#ff6600', borderColor:'#333' }}>SHAREABLE ATHLETE CARD</div>
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
        <button style={S.btn} onClick={downloadCard}>↓ Download PNG</button>
        <button style={{ ...S.btnSec, borderColor:'#555', color:'#ccc' }} onClick={share}>
          {status==='copied'?'✓ COPIED':'⬡ Share'}
        </button>
      </div>
      <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', marginTop:'10px' }}>
        Card includes: name, sport, VO₂max, FTP, max HR, 4-week summary, form badge.
      </div>
    </div>
  )
}
