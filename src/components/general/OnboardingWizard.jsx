// src/components/general/OnboardingWizard.jsx — 3-step general-fitness onboarding
// Deliberately cuts commitment-shaped questions. No session length, no deadlines.
import { useState, useEffect } from 'react'
import { S } from '../../styles.js'
import { suggestTemplate } from '../../lib/athlete/strengthTraining.js'
import { emitEvent } from '../../lib/attribution.js'
import { logger } from '../../lib/logger.js'

// v9.136.0 — Bail recovery parity with athlete Onboarding.jsx (v9.103 GG).
// Persist partial state every step so a closed browser at step 2/3 doesn't
// reset progress. Drafts expire after 7 days (treat as abandoned, emit
// telemetry).
const DRAFT_KEY = 'sporeus-general-onboarding-draft'
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.savedAt || !parsed?.data) return null
    const age = Date.now() - new Date(parsed.savedAt).getTime()
    if (!Number.isFinite(age) || age < 0) return null
    if (age > DRAFT_TTL_MS) {
      try { emitEvent('onboarding_abandoned', { age_ms: age, last_step: parsed.step ?? 0, track: 'general' }) } catch { /* fail open */ }
      localStorage.removeItem(DRAFT_KEY)
      return null
    }
    return parsed
  } catch (e) {
    logger.warn('general-onboarding draft read failed:', e?.message)
    return null
  }
}
function writeDraft(step, data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, data, savedAt: new Date().toISOString() }))
  } catch (e) {
    logger.warn('general-onboarding draft write failed:', e?.message)
  }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* fail open */ }
}

const GOALS = [
  { id: 'muscle',   en: 'Build Muscle',           tr: 'Kas Geliştir' },
  { id: 'strength', en: 'Get Stronger',            tr: 'Daha Güçlü Ol' },
  { id: 'general',  en: 'General Fitness / Feel Better', tr: 'Genel Kondisyon' },
  { id: 'recomp',   en: 'Lose Fat (Recomp)',       tr: 'Yağ Yakımı (Rekomp)' },
]

const EXPERIENCE = [
  { id: 'beginner',     en: 'Never Lifted — True Beginner',  tr: 'Hiç Ağırlık Kaldırmadım' },
  { id: 'some',         en: 'Some Experience (< 1 year)',    tr: 'Biraz Deneyimim Var (< 1 yıl)' },
  { id: 'intermediate', en: 'Experienced (≥ 1 year)',        tr: 'Deneyimliyim (≥ 1 yıl)' },
]

const DAYS_OPTIONS = [2, 3, 4, 5, 6]

const EQUIPMENT = [
  { id: 'bw',   en: 'Bodyweight Only',              tr: 'Sadece Vücut Ağırlığı' },
  { id: 'home', en: 'Home Gym (Dumbbells + Bands)', tr: 'Ev Spor Salonu (Dumbbell + Bant)' },
  { id: 'gym',  en: 'Full Gym (Barbell + Rack)',    tr: 'Tam Donanımlı Salon (Barbell + Rack)' },
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

const card  = { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '20px 24px', marginBottom: 16 }
const chip  = (active) => ({ ...S.mono, fontSize: 12, padding: '8px 14px', borderRadius: 3, border: `1px solid ${active ? '#ff6600' : 'var(--border)'}`, background: active ? '#ff660022' : 'transparent', color: active ? '#ff6600' : 'var(--text)', cursor: 'pointer', transition: 'all 0.15s' })
const label = { ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }
const h2    = { ...S.mono, fontSize: 14, color: '#ff6600', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }

export default function OnboardingWizard({ lang = 'en', onComplete }) {
  // Hydrate from draft once at mount. Saved shape: { step, data:{goal,experience,days,equipment}, savedAt }
  const initialDraft = readDraft()
  const [step, setStep]             = useState(initialDraft?.step ?? 0)
  const [goal, setGoal]             = useState(initialDraft?.data?.goal       ?? null)
  const [experience, setExperience] = useState(initialDraft?.data?.experience ?? null)
  const [days, setDays]             = useState(initialDraft?.data?.days       ?? 3)
  const [equipment, setEquipment]   = useState(initialDraft?.data?.equipment  ?? null)
  const [resumed] = useState(!!initialDraft)

  useEffect(() => {
    if (resumed) {
      try { emitEvent('onboarding_resumed', { resumed_at_step: initialDraft?.step ?? 0, track: 'general' }) } catch { /* fail open */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount
  }, [])

  // Persist draft once the user has actually committed input. Skip the
  // pre-input idle state (goal still null) so we don't write empty drafts.
  useEffect(() => {
    if (goal == null && !resumed) return
    writeDraft(step, { goal, experience, days, equipment })
  }, [step, goal, experience, days, equipment, resumed])

  const t = (item) => lang === 'tr' ? item.tr : item.en

  // Anti-overcommitment guardrail: beginners who pick 5+ days get a 3-day template
  const effectiveDays   = (experience === 'beginner' && days >= 5) ? 3 : days
  const guardRailFired  = experience === 'beginner' && days >= 5

  const canNext = [!!goal, !!experience, !!equipment][step]

  const suggestedId = equipment
    ? suggestTemplate({ goal, days: effectiveDays, equipment, experience })
    : null

  function handleFinish() {
    clearDraft()
    onComplete?.({
      goal,
      experience,
      days: effectiveDays,
      equipment,
      templateId: suggestedId,
      reference_date: new Date().toISOString().slice(0, 10),
    })
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>
      {resumed && (
        <div style={{ ...S.mono, fontSize: 10, color: '#ff6600', marginBottom: 12, padding: '6px 10px', border: '1px solid #ff660033', background: '#ff660011', borderRadius: 3 }}>
          {lang === 'tr' ? '↻ Kaldığın yerden devam ediyorsun.' : '↻ Resumed from where you left off.'}
        </div>
      )}
      <div style={{ ...S.mono, fontSize: 11, color: '#555', letterSpacing: '0.08em', marginBottom: 20 }}>
        {lang === 'tr' ? 'KURULUM' : 'SETUP'} {step + 1}/3
        <div style={{ marginTop: 6, height: 3, background: 'var(--border)', borderRadius: 2 }}>
          <div style={{ width: `${((step + 1) / 3) * 100}%`, height: '100%', background: '#ff6600', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Step 1 — Goal */}
      {step === 0 && (
        <div style={card}>
          <div style={h2}>{lang === 'tr' ? 'Hedefin Nedir?' : 'What Is Your Goal?'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GOALS.map(g => (
              <button key={g.id} style={chip(goal === g.id)} onClick={() => setGoal(g.id)}>{t(g)}</button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Experience */}
      {step === 1 && (
        <div style={card}>
          <div style={h2}>{lang === 'tr' ? 'Deneyim Seviyesi' : 'Experience Level'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EXPERIENCE.map(e => (
              <button key={e.id} style={{ ...chip(experience === e.id), textAlign: 'left' }} onClick={() => setExperience(e.id)}>{t(e)}</button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Frequency + Equipment on one screen */}
      {step === 2 && (
        <div style={card}>
          <div style={h2}>{lang === 'tr' ? 'Program Tercihi' : 'Your Preference'}</div>

          <span style={label}>{lang === 'tr' ? 'Ne sıklıkla antrenman yapacağını düşünüyorsun?' : 'How often do you think you\'ll train?'}</span>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {DAYS_OPTIONS.map(d => (
              <button key={d} style={chip(days === d)} onClick={() => setDays(d)}>{d}×</button>
            ))}
          </div>
          <div style={{ ...S.mono, fontSize: 10, color: '#888', marginBottom: 20 }}>
            {lang === 'tr'
              ? 'Bu sadece başlangıç şablonunu seçmek için. Daha fazla veya daha az çalışabilirsin, takip edilen seri yok.'
              : 'This just helps us pick a starting template. You can train more or less, no streaks.'}
          </div>

          {guardRailFired && (
            <div style={{ ...S.mono, fontSize: 10, color: '#ff6600', marginBottom: 20, padding: '8px 12px', border: '1px solid #ff660033', borderRadius: 3 }}>
              {lang === 'tr'
                ? '3 gün ile başlamak devam etmeyi kolaylaştırır. Daha sonra profilden değiştirebilirsin.'
                : 'Starting with 3 days makes adherence easier. You can switch later from Programs.'}
            </div>
          )}

          <span style={label}>{lang === 'tr' ? 'Ekipman' : 'Equipment'}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EQUIPMENT.map(eq => (
              <button key={eq.id} style={{ ...chip(equipment === eq.id), textAlign: 'left' }} onClick={() => setEquipment(eq.id)}>{t(eq)}</button>
            ))}
          </div>

          {suggestedId && (
            <div style={{ marginTop: 20, padding: '12px 16px', background: '#ff660011', border: '1px solid #ff660033', borderRadius: 3 }}>
              <span style={label}>{lang === 'tr' ? 'Önerilen Program' : 'Suggested Program'}</span>
              <div style={{ ...S.mono, fontSize: 14, color: '#ff6600' }}>
                {(() => { const n = TEMPLATE_NAMES[suggestedId]; return n ? (lang === 'tr' ? n.tr : n.en) : suggestedId })()}
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
        {step < 2
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
