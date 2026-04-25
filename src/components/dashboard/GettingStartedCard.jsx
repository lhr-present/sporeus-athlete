// ─── GettingStartedCard.jsx — empty-state onboarding card for new athletes ────
const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'

export default function GettingStartedCard({ isTR, onLogSession }) {
  const steps = isTR ? [
    { n: '01', title: 'İlk antrenmanını kaydet', desc: 'Süre ve RPE ile hızlı kayıt — 10 saniye sürer.' },
    { n: '02', title: 'Bugün sekmesini kontrol et', desc: 'Günlük antrenman önerileri ve hazırlık puanın.' },
    { n: '03', title: 'Profili doldur', desc: 'Spor dalı, FTP veya VDOT ekle → akıllı analiz açılır.' },
  ] : [
    { n: '01', title: 'Log your first session', desc: 'Just duration + RPE — takes 10 seconds.' },
    { n: '02', title: 'Check the Today tab', desc: 'Daily training suggestions and readiness score.' },
    { n: '03', title: 'Complete your profile', desc: 'Add sport, FTP or VDOT → smart analysis unlocks.' },
  ]

  return (
    <div style={{
      border: '1px solid #2a2a2a', borderRadius: '4px', padding: '20px 24px',
      marginBottom: '18px', fontFamily: MONO,
    }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, letterSpacing: '0.12em', marginBottom: '4px' }}>
        ◈ {isTR ? 'BAŞLANGIC' : 'GET STARTED'}
      </div>
      <div style={{ fontSize: '10px', color: '#555', marginBottom: '18px' }}>
        {isTR ? 'Antrenman günlüğünüz boş' : 'Your training journal is empty'}
      </div>
      {steps.map(s => (
        <div key={s.n} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '9px', color: ORANGE, fontWeight: 700, minWidth: '18px', marginTop: '1px' }}>{s.n}</div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#ccc', marginBottom: '2px' }}>{s.title}</div>
            <div style={{ fontSize: '9px', color: '#555', lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        </div>
      ))}
      <button
        onClick={onLogSession}
        style={{
          marginTop: '8px', width: '100%', padding: '10px', fontSize: '11px', fontWeight: 700,
          background: ORANGE, color: '#000', border: 'none', borderRadius: '3px',
          cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.06em',
        }}
      >
        + {isTR ? 'İLK ANTRENMANINI KAYDET' : 'LOG YOUR FIRST SESSION'}
      </button>
      <div style={{ fontSize: '8px', color: '#333', marginTop: '8px', textAlign: 'center' }}>
        {isTR
          ? 'Tüm veriler cihazınızda saklanır · Senkronizasyon için kayıt olun'
          : 'All data stays on your device · Sign up to sync across devices'}
      </div>
    </div>
  )
}
