// src/components/general/ProgramTemplateGallery.jsx — browse all 9 program templates
import { S } from '../../styles.js'

const SPLIT_LABEL = {
  full_body:   { en: 'Full Body',      tr: 'Tüm Vücut' },
  upper_lower: { en: 'Upper / Lower',  tr: 'Üst / Alt' },
  ppl:         { en: 'Push/Pull/Legs', tr: 'İtiş/Çekiş/Bacak' },
  bro:         { en: 'Bro Split',      tr: 'Bro Split' },
}
const EXP_LABEL = {
  beginner:     { en: 'Beginner',     tr: 'Başlangıç' },
  intermediate: { en: 'Intermediate', tr: 'Orta Seviye' },
  advanced:     { en: 'İleri Seviye', tr: 'İleri Seviye' },
}
const EQ_ICON = { bw: '🤸', home: '🏠', gym: '🏋️' }

export default function ProgramTemplateGallery({ templates = [], activeId = null, lang = 'en', onSelect }) {
  if (templates.length === 0) {
    return (
      <div style={{ ...S.mono, fontSize: 11, color: '#555', padding: '16px 0' }}>
        {lang === 'tr' ? 'Program yükleniyor…' : 'Loading programs…'}
      </div>
    )
  }

  return (
    <div>
      <div style={{ ...S.mono, fontSize: 11, color: '#ff6600', letterSpacing: '0.1em', marginBottom: 14 }}>
        {lang === 'tr' ? 'PROGRAMLAR' : 'PROGRAMS'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {templates.map(t => {
          const isActive = t.id === activeId
          const split = SPLIT_LABEL[t.split]?.[lang] ?? t.split
          const exp   = EXP_LABEL[t.experience_level]?.[lang] ?? t.experience_level
          const name  = lang === 'tr' ? t.name_tr : t.name_en
          const desc  = lang === 'tr' ? t.description_tr : t.description_en

          return (
            <div key={t.id} style={{ background: 'var(--card-bg)', border: `1px solid ${isActive ? '#ff6600' : 'var(--border)'}`, borderRadius: 4, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <span style={{ ...S.mono, fontSize: 12, color: isActive ? '#ff6600' : 'var(--text)' }}>{EQ_ICON[t.equipment] || ''} {name}</span>
                  {isActive && <span style={{ ...S.mono, fontSize: 9, color: '#ff6600', marginLeft: 8, border: '1px solid #ff6600', borderRadius: 2, padding: '1px 5px' }}>{lang === 'tr' ? 'AKTİF' : 'ACTIVE'}</span>}
                </div>
                <button
                  onClick={() => onSelect?.(t)}
                  style={{ ...S.mono, fontSize: 10, padding: '4px 10px', border: '1px solid var(--border)', background: isActive ? '#ff660022' : 'transparent', color: isActive ? '#ff6600' : '#888', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {isActive ? (lang === 'tr' ? '✓ Seçili' : '✓ Selected') : (lang === 'tr' ? 'Seç' : 'Select')}
                </button>
              </div>
              <div style={{ ...S.mono, fontSize: 10, color: '#888', marginBottom: 6 }}>
                {split} · {t.days_per_week}×{lang === 'tr' ? '/hf' : '/wk'} · {t.weeks}w · {exp}
              </div>
              <div style={{ ...S.mono, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
