// ─── WeeklyGoalVarianceCard.jsx ──────────────────────────────────────────────
// Surfaces 8-week actual TSS vs the user's profile.weeklyTssGoal as a
// goal-setting feedback loop (Locke 2002; Latham 2002).
//
// Render rules:
//   - Returns null when analyzeWeeklyGoalVariance returns null
//     (no goal set, or <4 of 8 weeks have any sessions).
//   - Otherwise renders for all three bands (ON_TARGET, UNDER, OVER).
//
// Bilingual EN/TR via LangCtx.
// Test anchors: data-weekly-goal-variance-card, data-goal-band,
// data-avg-variance, data-weekly-goal, data-week-bar (on each weekly bar).

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeWeeklyGoalVariance } from '../../lib/athlete/weeklyGoalVariance.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  ON_TARGET: '#5bc25b', // green — within tolerance
  UNDER:     '#0064ff', // blue  — below goal
  OVER:      '#ff6600', // orange — above goal
}

const BAND_LABEL_EN = {
  ON_TARGET: 'ON TARGET',
  UNDER:     'UNDER',
  OVER:      'OVER',
}

const BAND_LABEL_TR = {
  ON_TARGET: 'HEDEFTE',
  UNDER:     'ALTINDA',
  OVER:      'ÜSTÜNDE',
}

const RECO_EN = {
  ON_TARGET: 'Consistently hitting your weekly TSS goal — strong adherence.',
  UNDER:     'Average load below goal — either reduce the goal or add one session per week.',
  OVER:      'Running above goal — fine if intentional, but check ACWR for safety.',
}

const RECO_TR = {
  ON_TARGET: 'Haftalık TSS hedefini tutarlı şekilde tutturuyorsun — güçlü uyum.',
  UNDER:     'Ortalama yük hedefin altında — ya hedefi düşür ya haftada bir seans daha ekle.',
  OVER:      'Hedefin üzerinde — bilinçliyse sorun yok, güvenlik için ACWR\'yi kontrol et.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function formatPct(v) {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${Math.round(Math.abs(v) * 100)}%`
}

export default function WeeklyGoalVarianceCard({ log = [], profile = null }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeWeeklyGoalVariance({ log, profile, today: todayIso() }),
    [log, profile]
  )

  if (!result) return null

  const { band, avgVariance, weeklyTssGoal, weeks, citation } = result
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const reco = isTR ? RECO_TR[band] : RECO_EN[band]

  const title = isTR ? 'HAFTALIK HEDEF · 8H' : 'WEEKLY GOAL · 8W'
  const ariaLabel = isTR
    ? 'Haftalık TSS hedef sapması (Locke 2002; Latham 2002)'
    : 'Weekly TSS goal variance (Locke 2002; Latham 2002)'
  const goalLbl    = isTR ? 'HEDEF/HAFTA' : 'GOAL/WEEK'
  const avgLbl     = isTR ? 'ORT. SAPMA'  : 'AVG VARIANCE'
  const chartLbl   = isTR ? '8 HAFTA · GERÇEK vs HEDEF' : '8 WEEKS · ACTUAL vs GOAL'

  // SVG bar chart geometry.
  const svgW = 260
  const svgH = 80
  const padX = 4
  const midY = svgH / 2
  // Vertical scale: pick the larger of |max under-goal| and |max over-goal|
  // (in TSS units) to keep the chart symmetric around the goal line.
  const maxDevTss = Math.max(
    1,
    ...weeks.map(w => Math.abs(w.actualTss - weeklyTssGoal))
  )
  const halfH = (svgH / 2) - 6 // leave a few px padding top/bottom
  const slotW = (svgW - 2 * padX) / weeks.length
  const barW  = Math.max(8, slotW - 4)

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-weekly-goal-variance-card
      data-goal-band={band}
      data-avg-variance={avgVariance}
      data-weekly-goal={weeklyTssGoal}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
            color: 'var(--text, #ccc)',
          }}>
            {title}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>{goalLbl}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted, #888)' }}>
                {Math.round(weeklyTssGoal)} TSS
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>{avgLbl}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color }}>
                {formatPct(avgVariance)}
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-goal-band-label
            style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color,
            }}
          >
            {bandLabel}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 10, padding: '6px 8px',
        background: 'var(--surface, #111)', borderRadius: 4,
        fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
      }}>
        ↗ {reco}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 4 }}>
          {chartLbl}
        </div>
        <svg
          width={svgW}
          height={svgH}
          role="img"
          aria-label={chartLbl}
          data-weekly-goal-chart
          style={{ display: 'block' }}
        >
          {/* Goal reference line (horizontal midline). */}
          <line
            x1="0" y1={midY} x2={svgW} y2={midY}
            stroke="var(--border, #444)" strokeWidth="1" strokeDasharray="3 2"
          />
          {weeks.map((w, i) => {
            const dev = w.actualTss - weeklyTssGoal
            const h = Math.max(1, Math.round(Math.abs(dev) / maxDevTss * halfH))
            const x = padX + i * slotW + (slotW - barW) / 2
            // OVER: bar grows upward from midline. UNDER: bar grows downward.
            const isOver = dev > 0
            const y = isOver ? (midY - h) : midY
            // Per-bar color uses the same band-color logic individually so
            // mixed-direction weeks read clearly.
            let barFill = '#888'
            if (Math.abs(w.variance) <= 0.10) barFill = BAND_COLOR.ON_TARGET
            else if (w.variance < 0)          barFill = BAND_COLOR.UNDER
            else                              barFill = BAND_COLOR.OVER
            return (
              <rect
                key={w.weekStart}
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={barFill}
                data-week-bar
                data-week-start={w.weekStart}
                data-week-tss={w.actualTss}
                data-week-variance={w.variance}
              />
            )
          })}
        </svg>
      </div>

      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}
