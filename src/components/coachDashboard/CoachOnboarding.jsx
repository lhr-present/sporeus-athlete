import { useState, useRef, useContext } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'

// ─── Coach Onboarding ─────────────────────────────────────────────────────────

export default function CoachOnboarding({ onDone, inviteUrl, fileRef }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const panelRef = useRef(null)
  useFocusTrap(panelRef, { onEscape: onDone })
  const [step, setStep] = useState(0)
  const steps = [
    {
      title: lang === 'tr' ? 'Koç Moduna Hoş Geldiniz' : 'Welcome to Coach Mode',
      body: (
        <div>
          <p style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8, marginBottom:'12px' }}>
            {lang === 'tr'
              ? 'Sporcuları yönetin, planlar oluşturun, uyumu takip edin — tek ekrandan.'
              : 'Manage athletes, create plans, track compliance — all from one screen.'}
          </p>
          <p style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8 }}>
            {lang === 'tr'
              ? 'Veriler cihazda kalır. Sporcular sizinle JSON dosyası paylaşır. Sunucu yok, ücret yok.'
              : 'Data stays local. Athletes share JSON files with you. Zero server, zero fees.'}
          </p>
        </div>
      ),
    },
    {
      title: lang === 'tr' ? 'Nasıl çalışır' : 'How it works',
      body: (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'0', marginBottom:'20px', flexWrap:'wrap', justifyContent:'center' }}>
            {[
              { icon:'◈', lbl: lang === 'tr' ? 'Sporcu uygulamadan\nJSON dışa aktarır' : 'Athlete exports\nJSON from app' },
              { icon:'→', lbl:null },
              { icon:'⊞', lbl: lang === 'tr' ? 'Koç Modunda\ndosyayı içe aktarırsınız' : 'You import file\nin Coach Mode' },
              { icon:'→', lbl:null },
              { icon:'⚡', lbl: lang === 'tr' ? 'Plan oluşturup\ngeri aktarırsınız' : 'Create plan,\nexport back' },
            ].map((s, i) => s.lbl ? (
              <div key={i} style={{ textAlign:'center', padding:'12px' }}>
                <div style={{ ...S.mono, fontSize:'24px', color:'#0064ff', marginBottom:'6px' }}>{s.icon}</div>
                <div style={{ ...S.mono, fontSize:'9px', color:'#888', whiteSpace:'pre-line', lineHeight:1.6 }}>{s.lbl}</div>
              </div>
            ) : (
              <div key={i} style={{ ...S.mono, fontSize:'20px', color:'#333', padding:'0 4px' }}>{s.icon}</div>
            ))}
          </div>
          <div style={{ ...S.mono, fontSize:'11px', color:'#888', textAlign:'center', marginTop:'8px' }}>
            {lang === 'tr'
              ? 'Davet linkinizi paylaşın → sporcular linki açtığında otomatik bağlanır'
              : 'Share your invite link → athletes auto-connect when they open it'}
          </div>
        </div>
      ),
    },
    {
      title: lang === 'tr' ? 'Başlayın' : 'Get started',
      body: (
        <div>
          <p style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8, marginBottom:'16px' }}>
            {lang === 'tr'
              ? 'İlk sporcunuzu içe aktarın veya aşağıdaki davet linkinizi paylaşın.'
              : 'Import your first athlete or share your invite link below.'}
          </p>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            <button style={S.btn} onClick={() => { fileRef.current?.click(); onDone() }}>
              {lang === 'tr' ? 'Sporcu JSON İçe Aktar' : 'Import Athlete JSON'}
            </button>
            <button style={S.btnSec} onClick={() => {
              navigator.clipboard.writeText(inviteUrl).catch(() => {})
              onDone()
            }}>
              {lang === 'tr' ? 'Davet Linkini Kopyala' : 'Copy Invite Link'}
            </button>
          </div>
        </div>
      ),
    },
  ]

  return (
    <>
      <div aria-hidden="true" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:10200 }} onClick={onDone}/>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={lang === 'tr' ? 'Koç modu kurulumu' : 'Coach mode setup'} style={{ position:'fixed', top:'15vh', left:'50%', transform:'translateX(-50%)', width:'min(480px,92vw)', background:'var(--card-bg)', border:'1px solid #0064ff44', borderRadius:'8px', zIndex:10201, padding:'28px', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#0064ff', letterSpacing:'0.1em' }}>◈ {lang === 'tr' ? 'KOÇ MODU — ADIM' : 'COACH MODE — STEP'} {step+1}/3</div>
          <button onClick={onDone} aria-label={lang === 'tr' ? 'Kapat' : 'Close'} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'18px' }}>×</button>
        </div>
        <div style={{ ...S.mono, fontSize:'16px', fontWeight:700, color:'var(--text)', marginBottom:'16px' }}>
          {steps[step].title}
        </div>
        {steps[step].body}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'24px' }}>
          <div style={{ display:'flex', gap:'6px' }}>
            {steps.map((_, i) => (
              <div key={i} style={{ width:i===step?'20px':'8px', height:'8px', borderRadius:'4px', background: i===step?'#0064ff':i<step?'#0064ff88':'#333', transition:'all 0.3s' }}/>
            ))}
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            {step > 0 && <button style={S.btnSec} onClick={() => setStep(s => s - 1)}>{lang === 'tr' ? '← Geri' : '← Back'}</button>}
            {step < steps.length - 1
              ? <button style={S.btn} onClick={() => setStep(s => s + 1)}>{lang === 'tr' ? 'İleri →' : 'Next →'}</button>
              : <button style={S.btn} onClick={onDone}>{lang === 'tr' ? 'Bitti ✓' : 'Done ✓'}</button>
            }
          </div>
        </div>
      </div>
    </>
  )
}
