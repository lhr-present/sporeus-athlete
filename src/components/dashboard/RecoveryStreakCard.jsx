// ─── RecoveryStreakCard.jsx — Feeling-Good Recovery Streak ──────────────────
//
// Surfaces the athlete's CURRENT consecutive-day streak of good readiness
// scores (≥70/100) plus the longest such streak in the last 90 days.
//
// Distinct from training-streak cards (which count days-with-a-workout) —
// this card answers: "How long have I been feeling good?" Subjective
// recovery is the strongest predictor of training tolerance (Saw 2016) and
// a multi-week feeling-good streak that suddenly breaks is an early-warning
// flag for over-reach (Halson 2014; Foster 1998).
//
// The card returns null when there's nothing to celebrate (no entries OR
// both current and longest are zero) so the dashboard doesn't render a
// "0 days · best: 0" placeholder.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeRecoveryStreak } from '../../lib/athlete/recoveryStreak.js'

const MONO = "'IBM Plex Mono', monospace"

export default function RecoveryStreakCard({ recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => computeRecoveryStreak({ recovery }),
    [recovery],
  )

  if (!result) return null
  const { currentStreak, longestStreak90d, threshold, citation } = result
  if (currentStreak === 0 && longestStreak90d === 0) return null

  const isMilestone = currentStreak >= 14

  const titleEN = 'RECOVERY STREAK'
  const titleTR = 'TOPARLANMA SERİSİ'
  const daysEN  = currentStreak === 1 ? 'day' : 'days'
  const daysTR  = 'gün'
  const bestEN  = `best 90d: ${longestStreak90d}`
  const bestTR  = `90 gün en iyi: ${longestStreak90d}`
  const thresholdLineEN = `Days with readiness ≥ ${threshold}/100`
  const thresholdLineTR = `Hazırlık ≥ ${threshold}/100 olan günler`

  const ariaLabel = isTR ? 'Toparlanma serisi' : 'Recovery streak'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-recovery-streak-card
      data-current-streak={currentStreak}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 10,
        }}
      >
        <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
        {isTR ? titleTR : titleEN}
        {isMilestone ? (
          <span
            data-recovery-streak-fire
            aria-label={isTR ? 'kilometre taşı' : 'milestone'}
            title={isTR ? 'İki haftadan uzun seri' : '2-week milestone reached'}
            style={{ marginLeft: 8 }}
          >
            🔥
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: isMilestone ? '#ff6600' : 'var(--text)',
            lineHeight: 1,
          }}
        >
          {currentStreak}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted, #888)' }}>
          {isTR ? daysTR : daysEN}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--muted, #888)',
            marginLeft: 4,
          }}
        >
          · {isTR ? bestTR : bestEN}
        </span>
      </div>

      <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 6 }}>
        {isTR ? thresholdLineTR : thresholdLineEN}
      </div>

      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {citation}
      </div>
    </div>
  )
}
