// src/components/general/ProgramView.jsx — week calendar for active program
import { S } from '../../styles.js'

const DAY_LABELS_TR = { Push: 'İtiş', Pull: 'Çekiş', Legs: 'Bacak', Upper: 'Üst', Lower: 'Alt', 'Full Body': 'Tüm Vücut', Rest: 'Dinlenme' }
const EXP_LABEL = {
  beginner:     { en: 'Beginner',     tr: 'Başlangıç'   },
  intermediate: { en: 'Intermediate', tr: 'Orta Seviye'  },
  advanced:     { en: 'Advanced',     tr: 'İleri Seviye' },
}

function trDay(label, lang) {
  if (lang !== 'tr') return label
  return DAY_LABELS_TR[label] ?? label
}

export default function ProgramView({ template = null, templateDays = [], templateExercises = [], exercises = [], lang = 'en', currentDayIndex = 0 }) {
  if (!template) {
    return (
      <div style={{ ...S.mono, fontSize: 11, color: '#555', padding: '24px 0', textAlign: 'center' }}>
        {lang === 'tr' ? 'Aktif program yok.' : 'No active program.'}
      </div>
    )
  }

  const name = lang === 'tr' ? template.name_tr : template.name_en

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
      <div style={{ ...S.mono, fontSize: 12, color: '#ff6600', letterSpacing: '0.1em', marginBottom: 4 }}>{name}</div>
      <div style={{ ...S.mono, fontSize: 10, color: '#888', marginBottom: 16 }}>
        {template.days_per_week}×{lang === 'tr' ? '/hafta' : '/week'} · {template.weeks}w · {EXP_LABEL[template.experience_level]?.[lang] ?? template.experience_level}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {templateDays.map(day => {
          // day.exercises are inline prescriptions from TEMPLATE_PROGRAM_DATA;
          // exercises prop (SEED_EXERCISES) is used only for name lookup.
          const dayExercises = day.exercises ?? []
          const dayLabel = lang === 'tr' ? day.day_label_tr : day.day_label_en
          const isNext = day.day_index === currentDayIndex

          const isRest = dayExercises.length === 0
          return (
            <div key={day.day_index} style={{ border: `1px solid ${isNext ? '#ff660088' : isRest ? '#33333388' : 'var(--border)'}`, background: isNext ? '#ff660008' : isRest ? '#0d0d0d' : 'transparent', borderRadius: 3, padding: '10px 14px', opacity: isRest ? 0.7 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ ...S.mono, fontSize: 11, color: isNext ? '#ff6600' : 'var(--text)', letterSpacing: '0.08em' }}>
                  {lang === 'tr' ? `Gün ${day.day_index + 1}` : `Day ${day.day_index + 1}`} — {dayLabel}
                </div>
                {isNext && (
                  <span style={{ ...S.mono, fontSize: 8, color: '#ff6600', border: '1px solid #ff660044', borderRadius: 2, padding: '1px 6px', letterSpacing: '0.06em' }}>
                    {lang === 'tr' ? 'SIRADA →' : 'NEXT →'}
                  </span>
                )}
              </div>
              {dayExercises.map((te, i) => {
                const ex = exercises.find(e => e.id === te.exercise_id)
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ ...S.mono, fontSize: 11, color: 'var(--text)' }}>
                      {ex ? (lang === 'tr' ? ex.name_tr : ex.name_en) : te.exercise_id}
                    </span>
                    <span style={{ ...S.mono, fontSize: 10, color: '#888' }}>
                      {te.sets}×{te.reps_low}–{te.reps_high} RIR{te.rir} · {te.rest_seconds ?? 90}s
                    </span>
                  </div>
                )
              })}
              {isRest && (
                <span style={{ ...S.mono, fontSize: 10, color: '#444', letterSpacing: '0.06em' }}>— {lang === 'tr' ? 'DİNLENME GÜNÜ' : 'REST DAY'}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
