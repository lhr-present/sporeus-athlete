// ─── CyclePlannerCard.jsx — Cycle Phase Training Guide (E31) ─────────────────
// Female-gated dashboard card: phase badge, intensity rec, 4-phase mini timeline
// Returns null if computeCyclePlan returns null (not female or no period start)
// ─────────────────────────────────────────────────────────────────────────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { computeCyclePlan, phaseTrainingRec } from '../../lib/athlete/cyclePlanner.js'

const MONO = "'IBM Plex Mono', monospace"

// Typical phase durations in days (for proportional timeline bars)
const PHASE_DURATIONS = {
  menstruation: 5,
  follicular:   9,
  ovulation:    2,
  luteal:       12,
}

const INTENSITY_COLORS = {
  high:     '#5bc25b',
  moderate: '#f5c542',
  low:      '#888',
}

export default function CyclePlannerCard({ profile }) {
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const { t }  = useContext(LangCtx)

  const plan = computeCyclePlan(profile)
  if (!plan) return null

  const rec = phaseTrainingRec(plan.phase)
  const phaseLabel = plan.phaseInfo[lang]?.label ?? plan.phaseInfo.en.label
  const phaseTip   = plan.phaseInfo[lang]?.tip   ?? plan.phaseInfo.en.tip

  const intensityLabel = rec.intensity === 'high'
    ? t('cycleHigh')
    : rec.intensity === 'moderate'
    ? t('cycleMod')
    : t('cycleLow')

  const intensityColor = INTENSITY_COLORS[rec.intensity] ?? '#888'
  const recTip = lang === 'tr' ? rec.tip_tr : rec.tip_en

  const totalDur = Object.values(PHASE_DURATIONS).reduce((a, b) => a + b, 0)

  // Next phase label
  const nextPhaseInfo = plan.allPhases.find(p => p.phase === plan.nextPhase)
  const nextPhaseLabel = plan.phaseInfo[lang]?.label
    ? undefined  // overridden below
    : plan.nextPhase

  // Import PHASE_INFO for next phase label
  // We have it via allPhases color, but need the label — compute inline
  const PHASE_LABELS = {
    menstruation: { en: 'Menstruation', tr: 'Adet' },
    follicular:   { en: 'Follicular',   tr: 'Foliküler' },
    ovulation:    { en: 'Ovulation',    tr: 'Ovülasyon' },
    luteal:       { en: 'Luteal',       tr: 'Luteal' },
  }
  const nextLabel = PHASE_LABELS[plan.nextPhase]?.[lang] ?? plan.nextPhase

  return (
    <div className="sp-card" style={{
      background:    'var(--card-bg)',
      border:        '1px solid var(--border)',
      borderRadius:  '8px',
      padding:       '14px 16px',
      marginBottom:  '16px',
      fontFamily:    MONO,
    }}>
      {/* Title */}
      <div style={{
        fontSize:      '10px',
        color:         '#ff6600',
        letterSpacing: '0.08em',
        fontWeight:    700,
        marginBottom:  '12px',
      }}>
        ◈ {t('cycleTitle')}
      </div>

      {/* Phase badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {/* Colored circle */}
        <div style={{
          width:        '12px',
          height:       '12px',
          borderRadius: '50%',
          background:   plan.phaseInfo.color,
          flexShrink:   0,
        }} />
        {/* Phase label */}
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
          {phaseLabel}
        </span>
        {/* Intensity badge */}
        <span style={{
          fontSize:      '9px',
          fontWeight:    700,
          letterSpacing: '0.06em',
          color:         intensityColor,
          border:        `1px solid ${intensityColor}`,
          borderRadius:  '3px',
          padding:       '1px 5px',
        }}>
          {intensityLabel}
        </span>
      </div>

      {/* Day in cycle */}
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
        {t('cycleDayOf')} {plan.dayInCycle} / {plan.cycleLength}
      </div>

      {/* Phase tip */}
      <div style={{
        fontSize:    '10px',
        color:       '#888',
        lineHeight:  1.5,
        marginBottom: '6px',
        overflow:    'hidden',
        display:     '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {phaseTip}
      </div>

      {/* Training rec tip */}
      <div style={{
        fontSize:    '10px',
        color:       intensityColor,
        lineHeight:  1.5,
        marginBottom: '12px',
      }}>
        {recTip}
      </div>

      {/* 4-phase mini timeline */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', height: '10px' }}>
          {plan.allPhases.map(p => {
            const isCurrent = p.phase === plan.phase
            const pct = (PHASE_DURATIONS[p.phase] / totalDur) * 100
            return (
              <div
                key={p.phase}
                title={PHASE_LABELS[p.phase]?.[lang] ?? p.phase}
                style={{
                  width:      `${pct}%`,
                  background: p.color,
                  opacity:    isCurrent ? 1 : 0.35,
                  outline:    isCurrent ? `2px solid ${p.color}` : 'none',
                  outlineOffset: isCurrent ? '1px' : '0',
                  transition: 'opacity 200ms',
                  cursor:     'default',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Next phase label */}
      <div style={{ fontSize: '9px', color: '#555' }}>
        {t('cycleNext')}: {nextLabel} {t('cycleIn')} {plan.daysUntilNext} {t('cycleDays')}
      </div>
    </div>
  )
}
