// ─── dashboard/MacroPlanCountdown.jsx — days-to-race countdown from macro plan ─
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

/**
 * @param {{ dl: object, lc: object }} props
 */
export default function MacroPlanCountdown({ dl, lc }) {
  const [plan]       = useLocalStorage('sporeus-plan', null)
  const [planStatus] = useLocalStorage('sporeus-plan-status', {})
  const [lang]       = useLocalStorage('sporeus-lang', 'en')

  if (!dl.goal || !lc.showTaper || !plan) return null

  const startDate    = new Date(plan.generatedAt)
  const raceDate     = new Date(startDate)
  raceDate.setDate(raceDate.getDate() + plan.weeks.length * 7)
  const todayD = new Date(); todayD.setHours(0, 0, 0, 0)
  const daysLeft     = Math.round((raceDate - todayD) / 864e5)
  const weeksElapsed = Math.min(Math.floor((todayD - startDate) / (7 * 864e5)), plan.weeks.length)
  const progressPct  = Math.round(weeksElapsed / plan.weeks.length * 100)
  const currentPhase = plan.weeks[Math.min(weeksElapsed, plan.weeks.length - 1)]?.phase || ''

  const phaseMotivation = {
    Base:         'Building your aerobic engine — every easy mile counts.',
    Build:        'Threshold is developing — discomfort is adaptation.',
    Peak:         'Race-specific fitness peaking — trust the hard work.',
    Taper:        'Taper mode — your body is supercompensating. Trust it.',
    Recovery:     'Recovery week — adaptation happens here, not in workouts.',
    'Race Week':  'RACE WEEK — warm up, execute, enjoy every meter.',
  }[currentPhase] || 'Stay consistent. Every session compounds.'

  const borderColor = daysLeft <= 7 ? '#ff6600' : daysLeft <= 21 ? '#f5c542' : '#0064ff'

  return (
    <div className="sp-card" style={{ ...S.card, borderLeft: `4px solid ${borderColor}`, animationDelay: '191ms' }}>
      {daysLeft <= 0 ? (
        <div style={{ ...S.mono, fontSize: '20px', fontWeight: 600, color: '#ff6600', textAlign: 'center', padding: '12px 0' }}>
          🏁 RACE DAY — {plan.goal.toUpperCase()}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={S.cardTitle}>{plan.goal.toUpperCase()} IN</div>
              <div style={{ ...S.mono, fontSize: '32px', fontWeight: 600, color: borderColor }}>{daysLeft}</div>
              <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)' }}>DAYS</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...S.mono, fontSize: '10px', color: '#888', marginBottom: '4px' }}>PLAN PROGRESS</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '80px', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', background: borderColor, borderRadius: '4px' }}/>
                </div>
                <span style={{ ...S.mono, fontSize: '12px', fontWeight: 600, color: borderColor }}>{progressPct}%</span>
              </div>
              <div style={{ ...S.mono, fontSize: '10px', color: '#888', marginTop: '4px' }}>
                PHASE: <strong style={{ color: 'var(--text)' }}>{currentPhase?.toUpperCase()}</strong>
              </div>
            </div>
          </div>
          {daysLeft <= 7 && (
            <div style={{ ...S.mono, fontSize: '11px', color: '#ff6600', marginTop: '8px', padding: '6px 10px', background: '#ff660011', borderRadius: '4px' }}>
              ⚡ TAPER MODE — trust the training
            </div>
          )}
          <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub)', marginTop: '8px', lineHeight: 1.6 }}>
            ◈ {phaseMotivation}
          </div>
        </>
      )}
    </div>
  )
}
