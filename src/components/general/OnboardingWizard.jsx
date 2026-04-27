// src/components/general/OnboardingWizard.jsx — 4-step general-fitness onboarding
import { useState } from 'react'
import { S } from '../../styles.js'
import { suggestTemplate } from '../../lib/athlete/strengthTraining.js'

const GOALS = [
  { id: 'muscle',   en: 'Build Muscle',           tr: 'Kas Geliştir' },
  { id: 'strength', en: 'Get Stronger',            tr: 'Daha Güçlü Ol' },
  { id: 'general',  en: 'General Fitness / Feel Better', tr: 'Genel Kondisyon' },
  { id: 'recomp',   en: 'Lose Fat (Recomp)',       tr: 'Yağ Yakımı (Rekomp)' },
]

const EXPERIENCE = [
  { id: 'beginner',     en: 'Never Lifted (True Beginner)',   tr: 'Hiç Ağırlık Kaldırmadım' },
  { id: 'some',         en: 'Some Experience (< 1 year)',     tr: 'Biraz Deneyimim Var (< 1 yıl)' },
  { id: 'intermediate', en: 'Experienced (≥ 1 year)',         tr: 'Deneyimliyim (≥ 1 yıl)' },
]

const DAYS_OPTIONS = [2, 3, 4, 5, 6]
const DURATION_OPTIONS = [
  { v: 30, label: '30 min' },
  { v: 45, label: '45 min' },
  { v: 60, label: '60 min' },
  { v: 90, label: '90 min' },
]
const EQUIPMENT = [
  { id: 'bw',   en: 'Bodyweight Only',          tr: 'Sadece Vücut Ağırlığı' },
  { id: 'home', en: 'Home Gym (Dumbbells + Bands)', tr: 'Ev Spor Salonu (Dumbbell + Bant)' },
  { id: 'gym',  en: 'Full Gym (Barbell + Rack)', tr: 'Tam Donanımlı Salon (Barbell + Rack)' },
]

const TEMPLATE_NAMES = {
  bw_starter_3day:        { en: 'Bodyweight Starter 3-Day',       tr: 'Vücut Ağırlığı Başlangıç (3 Gün)' },
  fb_3day_beginner:       { en: 'Full Body 3-Day Beginner',        tr: 'Tüm Vücut 3 Gün Başlangıç' },
  ul_4day_beginner:       { en: 'Upper/Lower 4-Day Beginner',      tr: 'Üst/Alt 4 Gün Başlangıç' },
  ul_4day_intermediate:   { en: 'Upper/Lower 4-Day Intermediate',  tr: 'Üst/Alt 4 Gün Orta Seviye' },
  ppl_3day_beginner:      { en: 'Push/Pull/Legs 3-Day',            tr: 'İtiş/Çekiş/Bacak 3 Gün' },
  ppl_6day_intermediate:  { en: 'Push/Pull/Legs 6-Day',            tr: 'İtiş/Çekiş/Bacak 6 Gün' },
  home_db_3day:           { en: 'Home Dumbbell 3-Day',             tr: 'Evde Dumbbell 3 Gün' },
  home_db_4day:           { en: 'Home Dumbbell 4-Day',             tr: 'Evde Dumbbell 4 Gün' },
  recomp_4day:            { en: 'Recomp 4-Day',                    tr: 'Rekomp 4 Gün' },
}

const card = { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '20px 24px', marginBottom: 16 }
const chip = (active) => ({ ...S.mono, fontSize: 12, padding: '8px 14px', borderRadius: 3, border: `1px solid ${active ? '#ff6600' : 'var(--border)'}`, background: active ? '#ff660022' : 'transparent', color: active ? '#ff6600' : 'var(--text)', cursor: 'pointer', transition: 'all 0.15s' })
const label = { ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }
const h2 = { ...S.mono, fontSize: 14, color: '#ff6600', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }

export default function OnboardingWizard({ lang = 'en', onComplete }) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState(null)
  const [experience, setExperience] = useState(null)
  const [days, setDays] = useState(3)
  const [duration, setDuration] = useState(60)
  const [equipment, setEquipment] = useState(null)

  const t = (item) => lang === 'tr' ? item.tr : item.en

  const canNext = [
    !!goal,
    !!experience,
    days > 0 && duration > 0,
    !!equipment,
  ][step]

  function handleFinish() {
    const templateId = suggestTemplate({ goal, days, equipment, experience })
    onComplete?.({ goal, experience, days, duration, equipment, templateId })
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ ...S.mono, fontSize: 11, color: '#555', letterSpacing: '0.08em', marginBottom: 20 }}>
        {lang === 'tr' ? 'KURULUM' : 'SETUP'} {step + 1}/4
        <div style={{ marginTop: 6, height: 3, background: 'var(--border)', borderRadius: 2 }}>
          <div style={{ width: `${(step + 1) * 25}%`, height: '100%', background: '#ff6600', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {step === 0 && (
        <div style={card}>
          <div style={h2}>{lang === 'tr' ? 'Hedefin Nedir?' : 'What Is Your Goal?'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GOALS.map(g => (
              <button key={g.id} style={chip(goal === g.id)} onClick={() => setGoal(g.id)}>
                {t(g)}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={card}>
          <div style={h2}>{lang === 'tr' ? 'Deneyim Seviyesi' : 'Experience Level'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EXPERIENCE.map(e => (
              <button key={e.id} style={{ ...chip(experience === e.id), textAlign: 'left' }} onClick={() => setExperience(e.id)}>
                {t(e)}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={card}>
          <div style={h2}>{lang === 'tr' ? 'Program Takvimi' : 'Schedule'}</div>
          <span style={label}>{lang === 'tr' ? 'Haftada kaç gün?' : 'Days per week'}</span>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {DAYS_OPTIONS.map(d => (
              <button key={d} style={chip(days === d)} onClick={() => setDays(d)}>{d}</button>
            ))}
          </div>
          <span style={label}>{lang === 'tr' ? 'Antrenman süresi' : 'Session length'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {DURATION_OPTIONS.map(({ v, label: lbl }) => (
              <button key={v} style={chip(duration === v)} onClick={() => setDuration(v)}>{lbl}</button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={card}>
          <div style={h2}>{lang === 'tr' ? 'Ekipman' : 'Equipment'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EQUIPMENT.map(eq => (
              <button key={eq.id} style={{ ...chip(equipment === eq.id), textAlign: 'left' }} onClick={() => setEquipment(eq.id)}>
                {t(eq)}
              </button>
            ))}
          </div>

          {equipment && (
            <div style={{ marginTop: 20, padding: '12px 16px', background: '#ff660011', border: '1px solid #ff660033', borderRadius: 3 }}>
              <span style={label}>{lang === 'tr' ? 'Önerilen Program' : 'Suggested Program'}</span>
              <div style={{ ...S.mono, fontSize: 14, color: '#ff6600' }}>
                {(() => {
                  const tid = suggestTemplate({ goal, days, equipment, experience })
                  const n = TEMPLATE_NAMES[tid]
                  return n ? (lang === 'tr' ? n.tr : n.en) : tid
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {step > 0
          ? <button style={{ ...S.mono, fontSize: 12, padding: '8px 16px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', borderRadius: 3, cursor: 'pointer' }} onClick={() => setStep(s => s - 1)}>
              ← {lang === 'tr' ? 'Geri' : 'Back'}
            </button>
          : <div />
        }
        {step < 3
          ? <button disabled={!canNext} style={{ ...S.mono, fontSize: 12, padding: '8px 20px', border: 'none', background: canNext ? '#ff6600' : '#333', color: canNext ? '#fff' : '#555', borderRadius: 3, cursor: canNext ? 'pointer' : 'not-allowed' }} onClick={() => setStep(s => s + 1)}>
              {lang === 'tr' ? 'Devam →' : 'Next →'}
            </button>
          : <button disabled={!canNext} style={{ ...S.mono, fontSize: 12, padding: '8px 20px', border: 'none', background: canNext ? '#ff6600' : '#333', color: canNext ? '#fff' : '#555', borderRadius: 3, cursor: canNext ? 'pointer' : 'not-allowed' }} onClick={handleFinish}>
              {lang === 'tr' ? 'Başla ✓' : 'Start ✓'}
            </button>
        }
      </div>
    </div>
  )
}
