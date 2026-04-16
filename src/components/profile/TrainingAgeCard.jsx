// ─── TrainingAgeCard (v4.4) ───────────────────────────────────────────────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

export default function TrainingAgeCard({ log, profile: _profile }) {
  const { t } = useContext(LangCtx)
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const [trainingAge, setTrainingAge] = useLocalStorage('sporeus-training-age', '')

  if (!log.length) return null

  const ctl = (() => {
    if (!log.length) return 0
    const sorted = [...log].sort((a, b) => a.date > b.date ? 1 : -1)
    let c = 0
    for (const s of sorted) c = c + ((s.tss || 0) - c) / 42
    return Math.round(c)
  })()

  const ctlScale = [
    { min:0,  max:19,  label: lang==='tr' ? 'Yeni Başlayan' : 'Beginner',       color:'#888' },
    { min:20, max:39,  label: lang==='tr' ? 'Rekreasyonel'  : 'Recreational',   color:'#4a90d9' },
    { min:40, max:64,  label: lang==='tr' ? 'Rekabetçi'     : 'Competitive',     color:'#5bc25b' },
    { min:65, max:89,  label: lang==='tr' ? 'İleri Seviye'  : 'Advanced',        color:'#f5c542' },
    { min:90, max:999, label: lang==='tr' ? 'Elit'          : 'Elite',           color:'#ff6600' },
  ]
  const _ctlLevel = ctlScale.find(l => ctl >= l.min && ctl <= l.max) || ctlScale[0]

  const ageOpts = ['< 1 year', '1–2 years', '3–5 years', '6–10 years', '10+ years']
  const ageTr   = ['< 1 yıl', '1–2 yıl', '3–5 yıl', '6–10 yıl', '10+ yıl']
  const ageContext = {
    '< 1 year': { en: 'Early adaptation phase — VO₂max responds fastest in the first year.', tr: 'Erken adaptasyon fazı — VO₂maks ilk yılda en hızlı gelişir.' },
    '1–2 years': { en: 'Neuromuscular efficiency improving — coordination gains are significant.', tr: 'Nöromüsküler verimlilik artıyor — koordinasyon kazanımları önemli.' },
    '3–5 years': { en: 'Aerobic base established — now responding to polarized high-intensity work.', tr: 'Aerobik baz kuruldu — artık polarize yüksek yoğunluklu çalışmaya yanıt veriyor.' },
    '6–10 years': { en: 'Mature athlete — marginal gains require precision periodization.', tr: 'Olgun sporcu — marjinal kazanımlar hassas periyodizasyon gerektirir.' },
    '10+ years': { en: 'Elite training age — longevity and health maintenance are key.', tr: 'Elit antrenman yaşı — uzun ömür ve sağlık koruması anahtar.' },
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'62ms' }}>
      <div style={S.cardTitle}>{t('trainingAgeTitle')}</div>
      <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'12px' }}>
        <div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'4px' }}>SELECT {lang==='tr'?'ANTRENMAN YAŞI':'TRAINING AGE'}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
            {ageOpts.map((opt, i) => (
              <button key={opt}
                style={{ ...S.mono, fontSize:'10px', padding:'4px 9px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${trainingAge===opt?'#ff6600':'var(--border)'}`, background:trainingAge===opt?'#ff660022':'transparent', color:trainingAge===opt?'#ff6600':'var(--muted)' }}
                onClick={() => setTrainingAge(opt)}>
                {lang==='tr' ? ageTr[i] : opt}
              </button>
            ))}
          </div>
        </div>
      </div>
      {trainingAge && ageContext[trainingAge] && (
        <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.7, marginBottom:'12px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px', borderLeft:'3px solid #ff6600' }}>
          ◈ {ageContext[trainingAge][lang] || ageContext[trainingAge].en}
        </div>
      )}
      <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'8px', letterSpacing:'0.06em' }}>{t('ctlScaleLabel')} (CURRENT CTL: {ctl})</div>
      <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
        {ctlScale.map(l => (
          <div key={l.label} style={{ flex:'1 1 60px', padding:'7px 8px', borderRadius:'4px', border:`1px solid ${ctl >= l.min && ctl <= l.max ? l.color : 'var(--border)'}`, background: ctl >= l.min && ctl <= l.max ? l.color + '22' : 'transparent', textAlign:'center' }}>
            <div style={{ ...S.mono, fontSize:'9px', color: ctl >= l.min && ctl <= l.max ? l.color : 'var(--muted)', fontWeight: ctl >= l.min && ctl <= l.max ? 700 : 400 }}>{l.label}</div>
            <div style={{ ...S.mono, fontSize:'8px', color:'#888', marginTop:'2px' }}>{l.min}–{l.max === 999 ? '100+' : l.max}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
