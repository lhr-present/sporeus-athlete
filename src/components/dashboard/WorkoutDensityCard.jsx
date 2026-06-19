// ─── dashboard/WorkoutDensityCard.jsx — E121: Workout density (4 weeks) ──────
// Surfaces detectWorkoutDensity() output: 4-week hi-intensity day counts +
// injury-risk pattern (consecutive flagged weeks). Sits next to StaleZonesCard
// as the second coaching insight in the dashboard.
// Citation: Gabbett 2016; Hulin 2016.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectWorkoutDensity } from '../../lib/athlete/workoutDensity.js'

const RISK_COLORS = {
  low:      '#5bc25b',
  moderate: '#f5c542',
  high:     '#e03030',
}

const BAR_FLAGGED   = '#e03030'
const BAR_HEALTHY   = '#5bc25b'
const BAR_MAX_HEIGHT = 7   // logical 0–7 scale (days of week)

function WorkoutDensityCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectWorkoutDensity(log), [log])

  // ─── Empty / unreliable state ──────────────────────────────────────────────
  if (result.weeks.length === 0 || result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={
          isTR ? 'Antrenman yoğunluğu — yetersiz veri' : 'Workout density — not enough data'
        }
        style={{ ...S.card, animationDelay: '210ms' }}
      >
        <div style={S.cardTitle}>
          {isTR ? 'ANTRENMAN YOĞUNLUĞU — 4 HAFTA' : 'WORKOUT DENSITY — 4 WEEKS'}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', textAlign: 'center', padding: '14px 0', lineHeight: 1.7 }}>
          {isTR
            ? 'Antrenman yoğunluğunu görmek için 14+ gün antrenman kaydet'
            : 'Log 14+ days of training to see workout density'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── 4-week bar group (always rendered when reliable) ──────────────────────
  const weeks = result.weeks
  const barSummary = weeks.map(w => w.hiDays).join(', ')
  const barAriaLabel = isTR
    ? `4 haftalık yoğunluk: ${barSummary} ağır gün`
    : `4-week density: ${barSummary} hard days`

  const FourWeekBars = (
    <div
      role="img"
      aria-label={barAriaLabel}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        height: '90px',
        padding: '4px 2px 0',
      }}
    >
      {weeks.map((w, i) => {
        const color = w.flagged ? BAR_FLAGGED : BAR_HEALTHY
        const pctH = Math.max(4, (w.hiDays / BAR_MAX_HEIGHT) * 100)
        return (
          <div
            key={w.weekStart}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              height: '100%',
            }}
          >
            <div style={{ ...S.mono, fontSize: '10px', color, fontWeight: 700, marginBottom: '3px' }}>
              {w.hiDays}
            </div>
            <div
              style={{
                width: '100%',
                height: `${pctH}%`,
                background: color,
                borderRadius: '3px 3px 0 0',
                opacity: w.hiDays === 0 ? 0.25 : 1,
              }}
            />
            <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginTop: '4px' }}>
              W{i + 1}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ─── Low-risk: green tint + ✓ icon, no recommendation ──────────────────────
  if (result.risk === 'low') {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Antrenman yoğunluğu — sağlıklı' : 'Workout density — healthy'}
        style={{ ...S.card, animationDelay: '210ms', borderLeft: `3px solid ${RISK_COLORS.low}` }}
      >
        <div style={S.cardTitle}>
          {isTR ? 'ANTRENMAN YOĞUNLUĞU — 4 HAFTA' : 'WORKOUT DENSITY — 4 WEEKS'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0 10px' }}>
          <div style={{ ...S.mono, fontSize: '20px', color: RISK_COLORS.low, fontWeight: 700, lineHeight: 1 }}>
            ✓
          </div>
          <div
            aria-live="polite"
            style={{ ...S.mono, fontSize: '12px', color: 'var(--text)', lineHeight: 1.6 }}
          >
            {result.message[isTR ? 'tr' : 'en']}
          </div>
        </div>

        {FourWeekBars}

        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '10px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Moderate / high risk — colored border + message + recommendation ──────
  const accent = RISK_COLORS[result.risk] || RISK_COLORS.moderate
  const isHigh = result.risk === 'high'

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={
        isTR
          ? `Antrenman yoğunluğu — ${result.risk === 'high' ? 'yüksek risk' : 'orta risk'}`
          : `Workout density — ${result.risk} risk`
      }
      style={{ ...S.card, animationDelay: '210ms', borderLeft: `${isHigh ? 4 : 3}px solid ${accent}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'ANTRENMAN YOĞUNLUĞU — 4 HAFTA' : 'WORKOUT DENSITY — 4 WEEKS'}
      </div>

      <div
        aria-live="polite"
        style={{
          ...S.mono,
          fontSize: isHigh ? '13px' : '12px',
          fontWeight: isHigh ? 700 : 600,
          color: accent,
          lineHeight: 1.5,
          marginBottom: '6px',
        }}
      >
        {result.message[isTR ? 'tr' : 'en']}
      </div>

      <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)', lineHeight: 1.6, marginBottom: '10px' }}>
        {result.recommendation[isTR ? 'tr' : 'en']}
      </div>

      {FourWeekBars}

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '10px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(WorkoutDensityCard)
