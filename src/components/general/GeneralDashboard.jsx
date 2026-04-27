// src/components/general/GeneralDashboard.jsx — Today screen for general-fitness track
// Leads with Next Session card. No streaks, no shame copy, no analytics push.
import { useMemo } from 'react'
import { S } from '../../styles.js'
import { daysSinceLastSession, weeklyMuscleFrequency } from '../../lib/athlete/strengthTraining.js'

const MUSCLE_LABEL    = { quads:'Quads', hamstrings:'Hams', glutes:'Glutes', chest:'Chest', back:'Back', delts:'Delts', biceps:'Biceps', triceps:'Triceps', calves:'Calves', core:'Core', full:'Full' }
const MUSCLE_LABEL_TR = { quads:'Ön Bacak', hamstrings:'Arka Bacak', glutes:'Kalça', chest:'Göğüs', back:'Sırt', delts:'Omuz', biceps:'Biseps', triceps:'Triseps', calves:'Baldır', core:'Karın', full:'Tam' }
const MILESTONES      = [1, 5, 10, 25, 50, 100]

export default function GeneralDashboard({ sessions = [], exercises = [], activeProgram = null, activeTemplate = null, currentDay = null, coachConfirmedAt = null, estimatedMinutes = null, deloadHint = false, lastSessionPRs = [], onDismissPRs, lang = 'en', onLogSession }) {
  const t = (en, tr) => lang === 'tr' ? tr : en

  const days = daysSinceLastSession(activeProgram?.last_session_date)

  // Next session info — derived from currentDay + exercise definitions
  const cdExercises = currentDay?.exercises ?? []
  const dayLabel    = currentDay
    ? (lang === 'tr' ? currentDay.day_label_tr : currentDay.day_label_en)
    : t('Next Session', 'Sonraki Seans')
  const previewExs  = cdExercises.slice(0, 4).map(ce => {
    const def = exercises.find(e => e.id === ce.exercise_id)
    return def ? (lang === 'tr' ? def.name_tr : def.name_en) : ce.exercise_id
  })
  const hasMore     = cdExercises.length > 4

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

  // Week progress within the 4-week program block (wraps per cycle)
  const daysPerWeek      = activeTemplate?.days_per_week ?? 0
  const totalWeeks       = activeTemplate?.weeks ?? 4
  const totalSessions    = daysPerWeek * totalWeeks
  const cycleJustDone    = totalSessions > 0 && sessCount > 0 && sessCount % totalSessions === 0
  const sessInCycle      = totalSessions > 0 ? sessCount % totalSessions : 0
  const displaySess      = cycleJustDone ? totalSessions : sessInCycle
  const currentWeek      = daysPerWeek > 0 ? Math.floor(displaySess / daysPerWeek) + 1 : null

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
              width: `${(displaySess / totalSessions) * 100}%`,
              background: '#ff6600',
              borderRadius: 2,
              transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ ...S.mono, fontSize: 9, color: '#555', whiteSpace: 'nowrap' }}>
            {displaySess}/{totalSessions}
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
