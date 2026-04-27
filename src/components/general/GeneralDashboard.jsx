// src/components/general/GeneralDashboard.jsx — Today screen for general-fitness track
// Leads with Next Session card. No streaks, no shame copy, no analytics push.
import { useMemo } from 'react'
import { S } from '../../styles.js'
import { daysSinceLastSession, weeklyMuscleFrequency } from '../../lib/athlete/strengthTraining.js'

// Template day structure for each built-in template
const TEMPLATE_DAY_EXERCISES = {
  bw_starter_3day:        [['Push-Up','Bodyweight Squat','Glute Bridge','Plank','Dead Bug'],            ['Push-Up','Bodyweight Squat','Glute Bridge','Plank','Dead Bug'], ['Push-Up','Bodyweight Squat','Glute Bridge','Plank','Dead Bug']],
  fb_3day_beginner:       [['Barbell Back Squat','Barbell Bench Press','Barbell Row','Barbell Overhead Press','Romanian Deadlift'], ['Barbell Back Squat','Barbell Bench Press','Barbell Row','Barbell Overhead Press','Romanian Deadlift'], ['Barbell Back Squat','Barbell Bench Press','Barbell Row','Barbell Overhead Press','Romanian Deadlift']],
  ul_4day_beginner:       [['Barbell Bench Press','DB Shoulder Press','Barbell Row','Lat Pulldown','DB Bicep Curl','Tricep Pushdown'], ['Barbell Back Squat','Romanian Deadlift','Leg Press','Lying Leg Curl','DB Calf Raise'], ['DB Incline Press','DB Shoulder Press','Seated Cable Row','Lat Pulldown','DB Bicep Curl','Tricep Pushdown'], ['Barbell Deadlift','Barbell Back Squat','Leg Extension','Lying Leg Curl','DB Calf Raise']],
  ul_4day_intermediate:   [['Barbell Bench Press','DB Incline Press','DB Shoulder Press','Barbell Row','Lat Pulldown','Face Pull','DB Bicep Curl'], ['Barbell Back Squat','Romanian Deadlift','Leg Press','Lying Leg Curl','DB Calf Raise'], ['DB Incline Press','Cable Crossover Fly','DB Shoulder Press','Seated Cable Row','Lat Pulldown','DB Bicep Curl','Tricep Pushdown'], ['Barbell Deadlift','Barbell Front Squat','Leg Extension','Lying Leg Curl','DB Calf Raise']],
  ppl_3day_beginner:      [['Barbell Bench Press','DB Shoulder Press','DB Incline Press','Tricep Pushdown','DB Lateral Raise'], ['Barbell Row','Lat Pulldown','Seated Cable Row','DB Bicep Curl','Face Pull'], ['Barbell Back Squat','Romanian Deadlift','Leg Press','Lying Leg Curl','DB Calf Raise']],
  ppl_6day_intermediate:  [['Barbell Bench Press','DB Incline Press','Cable Crossover Fly','DB Shoulder Press','DB Lateral Raise','Tricep Pushdown'], ['Barbell Row','Lat Pulldown','Seated Cable Row','Face Pull','DB Bicep Curl','Cable Curl'], ['Barbell Back Squat','Romanian Deadlift','Leg Press','Leg Extension','Lying Leg Curl','DB Calf Raise'], ['DB Bench Press','DB Incline Press','Cable Crossover Fly','DB Shoulder Press','DB Lateral Raise','DB Overhead Tricep Ext'], ['Pull-Up','Barbell Row','Seated Cable Row','Face Pull','DB Bicep Curl','Band Pull-Apart'], ['Barbell Deadlift','Barbell Back Squat','Leg Press','Leg Extension','Lying Leg Curl','DB Calf Raise']],
  home_db_3day:           [['DB Bench Press','DB Shoulder Press','DB Overhead Tricep Ext','DB Lateral Raise','Glute Bridge'], ['DB Single-Arm Row','DB Bicep Curl','Band Row','Band Pull-Apart','Dead Bug'], ['DB Goblet Squat','DB Romanian Deadlift','DB Reverse Lunge','DB Calf Raise','Plank']],
  home_db_4day:           [['DB Bench Press','DB Incline Press','DB Shoulder Press','DB Lateral Raise','DB Overhead Tricep Ext'], ['DB Goblet Squat','DB Romanian Deadlift','DB Reverse Lunge','DB Calf Raise'], ['DB Single-Arm Row','DB Bicep Curl','Band Row','Band Pull-Apart','Dead Bug'], ['DB Goblet Squat','DB Romanian Deadlift','DB Reverse Lunge','DB Calf Raise','Plank']],
  recomp_4day:            [['DB Bench Press','DB Shoulder Press','Lat Pulldown','DB Bicep Curl','Tricep Pushdown'], ['Barbell Back Squat','Romanian Deadlift','Leg Press','Lying Leg Curl'], ['DB Incline Press','DB Lateral Raise','Seated Cable Row','Face Pull','DB Bicep Curl'], ['Barbell Deadlift','Leg Press','Leg Extension','Lying Leg Curl','DB Calf Raise']],
}

const TEMPLATE_DAY_LABELS_EN = {
  bw_starter_3day:        ['Full Body A','Full Body B','Full Body C'],
  fb_3day_beginner:       ['Full Body A','Full Body B','Full Body C'],
  ul_4day_beginner:       ['Upper A','Lower A','Upper B','Lower B'],
  ul_4day_intermediate:   ['Upper A','Lower A','Upper B','Lower B'],
  ppl_3day_beginner:      ['Push','Pull','Legs'],
  ppl_6day_intermediate:  ['Push A','Pull A','Legs A','Push B','Pull B','Legs B'],
  home_db_3day:           ['Push','Pull','Legs'],
  home_db_4day:           ['Upper A','Lower A','Upper B','Lower B'],
  recomp_4day:            ['Upper A','Lower A','Upper B','Lower B'],
}
const TEMPLATE_DAY_LABELS_TR = {
  bw_starter_3day:        ['Tüm Vücut A','Tüm Vücut B','Tüm Vücut C'],
  fb_3day_beginner:       ['Tüm Vücut A','Tüm Vücut B','Tüm Vücut C'],
  ul_4day_beginner:       ['Üst A','Alt A','Üst B','Alt B'],
  ul_4day_intermediate:   ['Üst A','Alt A','Üst B','Alt B'],
  ppl_3day_beginner:      ['İtiş','Çekiş','Bacak'],
  ppl_6day_intermediate:  ['İtiş A','Çekiş A','Bacak A','İtiş B','Çekiş B','Bacak B'],
  home_db_3day:           ['İtiş','Çekiş','Bacak'],
  home_db_4day:           ['Üst A','Alt A','Üst B','Alt B'],
  recomp_4day:            ['Üst A','Alt A','Üst B','Alt B'],
}

const MUSCLE_LABEL = { quads:'Quads', hamstrings:'Hams', glutes:'Glutes', chest:'Chest', back:'Back', delts:'Delts', biceps:'Biceps', triceps:'Triceps', calves:'Calves', core:'Core', full:'Full' }
const MUSCLE_LABEL_TR = { quads:'Ön Bacak', hamstrings:'Arka Bacak', glutes:'Kalça', chest:'Göğüs', back:'Sırt', delts:'Omuz', biceps:'Biseps', triceps:'Triseps', calves:'Baldır', core:'Karın', full:'Tam' }

const MILESTONES = [1, 5, 10, 25, 50, 100]

export default function GeneralDashboard({ sessions = [], exercises = [], activeProgram = null, activeTemplate = null, coachConfirmedAt = null, estimatedMinutes = null, deloadHint = false, lastSessionPRs = [], onDismissPRs, lang = 'en', onLogSession }) {
  const t = (en, tr) => lang === 'tr' ? tr : en

  const days = daysSinceLastSession(activeProgram?.last_session_date)

  // Next session info
  const nextDayIdx    = activeProgram?.next_day_index ?? 0
  const templateId    = activeTemplate?.id ?? ''
  const dayLabels     = (lang === 'tr' ? TEMPLATE_DAY_LABELS_TR : TEMPLATE_DAY_LABELS_EN)[templateId] ?? []
  const dayExercises  = TEMPLATE_DAY_EXERCISES[templateId]?.[nextDayIdx] ?? []
  const dayLabel      = dayLabels[nextDayIdx] ?? t('Next Session', 'Sonraki Seans')
  const previewExs    = dayExercises.slice(0, 4)
  const hasMore       = dayExercises.length > 4

  // Friendly gap line — descriptive, never prescriptive
  const gapLine = useMemo(() => {
    if (days === null) return null
    if (days === 0) return null
    if (days > 14) return t('Welcome back.', 'Tekrar hoş geldin.')
    return `${t('Last session:', 'Son antrenman:')} ${days} ${t('days ago', 'gün önce')}`
  }, [days, lang])

  // Recent sessions (last 3)
  const recent = [...sessions].sort((a, b) => b.session_date?.localeCompare(a.session_date ?? '') ?? 0).slice(0, 3)

  // Weekly muscle frequency
  const muscleFreq = useMemo(() => weeklyMuscleFrequency(sessions, exercises), [sessions, exercises])
  const muscleEntries = Object.entries(muscleFreq).sort((a, b) => b[1] - a[1])

  // Reference strip
  const refDate   = activeProgram?.reference_date
  const sessCount = activeProgram?.sessions_completed ?? sessions.length
  const templateName = activeTemplate ? (lang === 'tr' ? activeTemplate.name_tr : activeTemplate.name_en) : null
  const milestone = MILESTONES.find(n => n === sessCount) ?? null

  // Week progress within the 4-week program block
  const daysPerWeek   = activeTemplate?.days_per_week ?? 0
  const totalWeeks    = activeTemplate?.weeks ?? 4
  const currentWeek   = daysPerWeek > 0 ? Math.floor(sessCount / daysPerWeek) + 1 : null
  const totalSessions = daysPerWeek * totalWeeks
  const cycleJustDone = totalSessions > 0 && sessCount > 0 && sessCount % totalSessions === 0

  return (
    <div style={{ maxWidth: 560 }}>

      {/* ── Next Session card ─────────────────────────────── */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid #ff660066', borderRadius: 4, padding: '20px 22px', marginBottom: 14 }}>
        <div style={{ ...S.mono, fontSize: 10, color: '#ff6600', letterSpacing: '0.1em', marginBottom: 10 }}>
          {t('NEXT SESSION', 'SONRAKI SEANS')}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ ...S.mono, fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>{dayLabel}</div>
            {previewExs.length > 0 && (
              <div style={{ ...S.mono, fontSize: 10, color: '#888', lineHeight: 1.6 }}>
                {previewExs.join(' · ')}{hasMore ? ' …' : ''}
              </div>
            )}
            {estimatedMinutes && (
              <div style={{ ...S.mono, fontSize: 10, color: '#555', marginTop: 6 }}>
                ~{estimatedMinutes} {t('min', 'dk')}
              </div>
            )}
            {!activeTemplate && (
              <div style={{ ...S.mono, fontSize: 11, color: '#888' }}>
                {t('Select a program from the Program tab.', 'Program sekmesinden bir program seç.')}
              </div>
            )}
          </div>
          <button
            onClick={onLogSession}
            style={{ ...S.mono, fontSize: 12, padding: '10px 18px', border: 'none', background: '#ff6600', color: '#fff', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 16 }}>
            {t('START →', 'BAŞLA →')}
          </button>
        </div>

        {gapLine && (
          <div style={{ ...S.mono, fontSize: 10, color: '#888' }}>{gapLine}</div>
        )}
      </div>

      {/* ── PR celebration ───────────────────────────────── */}
      {lastSessionPRs.length > 0 && (
        <div style={{ background: '#ff660011', border: '1px solid #ff660066', borderRadius: 4, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ ...S.mono, fontSize: 10, color: '#ff6600', letterSpacing: '0.1em', marginBottom: 6 }}>
              {t('NEW RECORD', 'YENİ REKOR')}
            </div>
            <button onClick={onDismissPRs} style={{ ...S.mono, fontSize: 9, border: 'none', background: 'transparent', color: '#888', cursor: 'pointer' }}>✕</button>
          </div>
          {lastSessionPRs.map(pr => (
            <div key={pr.exercise_id} style={{ ...S.mono, fontSize: 11, color: 'var(--text)', marginBottom: 3 }}>
              {lang === 'tr' ? pr.name_tr : pr.name_en} — {pr.new1RM} kg {t('est. 1RM', 'tahmini 1TM')}
              {pr.prev1RM && <span style={{ color: '#888', marginLeft: 8 }}>↑ {t('from', 'önceki')} {pr.prev1RM}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Deload hint ───────────────────────────────────── */}
      {deloadHint && (
        <div style={{ ...S.mono, fontSize: 10, color: '#888', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 3, marginBottom: 14 }}>
          {t('Your lifts have stalled across several exercises — consider a lighter session today.',
             'Birden fazla egzersizde duraksama var — bugün daha hafif bir seans düşünebilirsin.')}
        </div>
      )}

      {/* ── Session milestone ─────────────────────────────── */}
      {milestone && (
        <div style={{ ...S.mono, fontSize: 10, color: '#ff6600', padding: '6px 10px', border: '1px solid #ff660033', borderRadius: 3, marginBottom: 14, letterSpacing: '0.06em' }}>
          {milestone === 1
            ? t('First session complete.', 'İlk seans tamamlandı.')
            : `${milestone} ${t('sessions complete.', 'seans tamamlandı.')}`}
        </div>
      )}

      {/* ── Coach confirmation badge — only show when confirmed ─── */}
      {coachConfirmedAt && (
        <div style={{ ...S.mono, fontSize: 10, color: '#22aa44', padding: '6px 10px', border: '1px solid #22aa4433', borderRadius: 3, marginBottom: 14, letterSpacing: '0.06em' }}>
          ✓ {lang === 'tr' ? 'Antrenörün programını onayladı' : 'Program confirmed by your coach'}
        </div>
      )}

      {/* ── This week: muscle frequency ───────────────────── */}
      {muscleEntries.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.08em', marginBottom: 6 }}>
            {t('THIS WEEK', 'BU HAFTA')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {muscleEntries.map(([muscle, count]) => (
              <span key={muscle} style={{ ...S.mono, fontSize: 9, padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border)', color: count >= 2 ? '#22aa44' : 'var(--muted)' }}>
                {(lang === 'tr' ? MUSCLE_LABEL_TR : MUSCLE_LABEL)[muscle] ?? muscle} {count}×
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Week progress ────────────────────────────────── */}
      {currentWeek && daysPerWeek > 0 && !cycleJustDone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ ...S.mono, fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>
            {t('WEEK', 'HAFTA')} {Math.min(currentWeek, totalWeeks)} / {totalWeeks}
          </div>
          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{
              height: '100%',
              width: `${Math.min((sessCount / totalSessions) * 100, 100)}%`,
              background: '#ff6600',
              borderRadius: 2,
              transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ ...S.mono, fontSize: 9, color: '#555', whiteSpace: 'nowrap' }}>
            {sessCount}/{totalSessions}
          </div>
        </div>
      )}

      {/* ── Cycle complete ────────────────────────────────── */}
      {cycleJustDone && (
        <div style={{ ...S.mono, fontSize: 10, color: '#ff6600', padding: '8px 12px', border: '1px solid #ff660044', borderRadius: 3, marginBottom: 14, letterSpacing: '0.06em' }}>
          {t('Program block complete. Starting next cycle.', 'Program bloğu tamamlandı. Yeni döngü başlıyor.')}
        </div>
      )}

      {/* ── Reference strip ───────────────────────────────── */}
      {(refDate || sessCount > 0) && (
        <div style={{ ...S.mono, fontSize: 10, color: '#555', padding: '8px 0', marginBottom: 14, borderBottom: '1px solid var(--border)', lineHeight: 1.8 }}>
          {refDate && `${t('Started', 'Başlangıç')} ${refDate}`}
          {refDate && sessCount > 0 && ' · '}
          {sessCount > 0 && `${sessCount} ${t('sessions logged', 'seans tamamlandı')}`}
          {templateName && ` · ${templateName}`}
        </div>
      )}

      {/* ── Recent sessions ───────────────────────────────── */}
      {recent.length > 0 && (
        <div>
          <div style={{ ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.08em', marginBottom: 8 }}>
            {t('RECENT', 'SON SEANSLAR')}
          </div>
          {recent.map((s, i) => {
            const exCount  = (s.exercises ?? []).length
            const workSets = (s.exercises ?? []).flatMap(ex => (ex.sets ?? []).filter(set => !set.is_warmup)).length
            return (
              <div key={i} style={{ ...S.mono, fontSize: 11, color: 'var(--text)', padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>{s.session_date} · {s.day_label || t('Session', 'Seans')}</span>
                <span style={{ color: '#555', fontSize: 10 }}>
                  {exCount > 0 && `${exCount} ${t('ex', 'egz')}`}
                  {workSets > 0 && ` · ${workSets} ${t('sets', 'set')}`}
                  {s.rpe ? <span style={{ marginLeft: 6 }}>RPE {s.rpe}</span> : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {recent.length === 0 && activeTemplate && (
        <div style={{ ...S.mono, fontSize: 11, color: '#555', padding: '20px 0', textAlign: 'center' }}>
          {t('Hit Start → to log your first session.', 'İlk seansını kaydetmek için Başla →\'ya bas.')}
        </div>
      )}
    </div>
  )
}
