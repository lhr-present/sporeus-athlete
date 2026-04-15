// ─── HuseyinCoachCard — connect/disconnect coach, send data export ───────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { exportAllData } from '../../lib/storage.js'

export default function HuseyinCoachCard() {
  const { t } = useContext(LangCtx)
  const [myCoach, setMyCoach] = useLocalStorage('sporeus-my-coach', null)
  const connected = !!myCoach
  const isHuseyin = !myCoach || myCoach === 'huseyin-sporeus'

  const sendData = () => {
    const raw = exportAllData()
    const parsed = JSON.parse(raw)
    parsed.coachId = myCoach || 'huseyin-sporeus'
    parsed.coachExport = true
    const blob = new Blob([JSON.stringify(parsed,null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`sporeus-for-coach-${new Date().toISOString().slice(0,10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="sp-card" style={{...S.card, animationDelay:'48ms', borderLeft:`3px solid ${connected?'#5bc25b':'#ff6600'}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
        <div style={S.cardTitle}>{t('coachCardTitle')}</div>
        {connected && <span style={{...S.mono,fontSize:'10px',color:'#5bc25b',fontWeight:600}}>◈ CONNECTED</span>}
      </div>
      <div style={{display:'flex',gap:'14px',marginBottom:'14px'}}>
        <div style={{width:'52px',height:'52px',borderRadius:'4px',background:'#0a0a0a',border:'1px solid #333',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,...S.mono,fontSize:'16px',fontWeight:700,color:'#ff6600',letterSpacing:'-1px'}}>
          HA
        </div>
        <div>
          <div style={{...S.mono,fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'4px'}}>
            {isHuseyin ? 'HÜSEYİN AKBULUT' : myCoach}
          </div>
          <div style={{...S.mono,fontSize:'10px',color:'#888',lineHeight:1.8}}>
            {isHuseyin ? <>MSc Sport Science · Marmara University<br/>Uzmanlık: Dayanıklılık · Triatlon · Periyodizasyon</> : 'Connected coach · Sporeus Athlete Console'}
          </div>
        </div>
      </div>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        {!connected ? (
          <button style={S.btn} onClick={()=>setMyCoach('huseyin-sporeus')}>{t('connectCoachBtn')}</button>
        ) : (
          <>
            <button style={{...S.btn,background:'#5bc25b',borderColor:'#5bc25b'}} onClick={sendData}>
              ↓ {t('sendDataCoachBtn')}
            </button>
            <a href="https://sporeus.com/huseyin-akbulut/" target="_blank" rel="noreferrer"
              style={{...S.btnSec,textDecoration:'none',display:'inline-flex',alignItems:'center',color:'var(--text)'}}>
              PROFILE →
            </a>
            <button style={{...S.btnSec,color:'#e03030',borderColor:'#e03030'}} onClick={()=>setMyCoach(null)}>
              {t('disconnectCoachBtn')}
            </button>
          </>
        )}
      </div>
      {connected && (
        <div style={{...S.mono,fontSize:'10px',color:'#888',marginTop:'10px',lineHeight:1.6}}>
          {t('coachConnectNote')}
        </div>
      )}
    </div>
  )
}
