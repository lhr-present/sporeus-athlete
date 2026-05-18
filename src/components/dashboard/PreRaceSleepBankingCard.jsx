// ─── dashboard/PreRaceSleepBankingCard.jsx — Pre-race sleep banking ──────────
//
// Surfaces `detectPreRaceSleepBanking` (Mah 2011 protocol): in the 7 days
// before a race, target sleep ≥ (sleepTarget + 0.5h) to bank a surplus
// that buffers against the (almost inevitable) poor race-night sleep.
//
// Companion to — but distinct from — SleepDebtCard:
//   - SleepDebtCard      : rolling cumulative shortfall vs target (chronic).
//   - PreRaceSleepBanking: pre-race surplus protocol (acute, race-window only).
//
// Card renders null when the pure-fn returns null (no race date / race past
// / race > 7 days out).
//
// References:
//   Mah 2011    — Sleep extension improves athletic performance (Sleep 34:943)
//   Walker 2017 — Why We Sleep
//   Halson 2014 — Sleep and the elite athlete

import { memo, useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { detectPreRaceSleepBanking } from '../../lib/athlete/preRaceSleepBanking.js'

const MONO = "'IBM Plex Mono', monospace"

const STATUS_COLOR = {
  BANKED:      '#5bc25b', // green
  PARTIAL:     '#0064ff', // blue
  NEEDS_FOCUS: '#ff8c1a', // orange
}

const STATUS_LABEL_EN = {
  BANKED:      'BANKED',
  PARTIAL:     'PARTIAL',
  NEEDS_FOCUS: 'NEEDS FOCUS',
}
const STATUS_LABEL_TR = {
  BANKED:      'BİRİKTİ',
  PARTIAL:     'KISMEN',
  NEEDS_FOCUS: 'ODAKLAN',
}

function PreRaceSleepBankingCard({ recovery, profile }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const data = useMemo(
    () => detectPreRaceSleepBanking({ recovery, profile, windowDays: 7 }),
    [recovery, profile],
  )

  if (!data) return null

  const { daysToRace, nightsBanked, nightsTotal, status, perNight, citation } = data
  const color = STATUS_COLOR[status] || '#888'
  const statusLabel = isTR ? STATUS_LABEL_TR[status] : STATUS_LABEL_EN[status]

  const title = isTR
    ? `UYKU BİRİKİMİ · T-${daysToRace} GÜN`
    : `SLEEP BANKING · T-${daysToRace} DAYS`

  const countLabel = isTR
    ? `${nightsBanked}/${nightsTotal} gece biriktirildi`
    : `${nightsBanked}/${nightsTotal} nights banked`

  const ariaLabel = isTR
    ? 'Yarış öncesi uyku biriktirme protokolü'
    : 'Pre-race sleep banking protocol'

  // Brief recommendation surfaces only when status is NEEDS_FOCUS — the
  // green BANKED state doesn't need nagging copy.
  const recommendation = (() => {
    if (status !== 'NEEDS_FOCUS') return null
    return isTR
      ? 'Bu gece 8.5+ saat — toparlanma şimdiden başlıyor'
      : 'Aim for 8.5+ h tonight — race recovery starts now'
  })()

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-pre-race-sleep-banking-card
      data-banking-status={status}
      data-days-to-race={daysToRace}
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
      {/* Title */}
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: '#ff6600',
        letterSpacing: '0.08em',
        marginBottom: 10,
      }}>
        ◈ {title}
      </div>

      {/* Headline: banked count + status badge */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 8,
      }}>
        <span
          data-nights-banked={nightsBanked}
          style={{
            fontSize: 28,
            fontWeight: 700,
            color,
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}
        >
          {nightsBanked}
        </span>
        <span style={{
          fontSize: 11,
          color: 'var(--muted)',
          letterSpacing: '0.06em',
        }}>
          {countLabel}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          border: `1px solid ${color}`,
          borderRadius: 2,
          padding: '2px 6px',
          letterSpacing: '0.06em',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* 7-night chip strip — one chip per night, ✓ if banked / ✗ if not */}
      <div
        data-banking-chip-strip
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 10,
        }}
      >
        {perNight.map((night) => {
          const chipColor = night.isBanked ? '#5bc25b' : '#ff8c1a'
          return (
            <div
              key={night.date}
              data-banking-chip
              data-chip-date={night.date}
              data-chip-banked={night.isBanked ? 'true' : 'false'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontFamily: MONO,
                color: chipColor,
                border: `1px solid ${chipColor}`,
                borderRadius: 2,
                padding: '2px 6px',
                letterSpacing: '0.04em',
                opacity: 0.9,
              }}
            >
              <span>{night.sleepHrs}h</span>
              <span aria-hidden="true">{night.isBanked ? '✓' : '✗'}</span>
            </div>
          )
        })}
      </div>

      {/* Recommendation — only when NEEDS_FOCUS */}
      {recommendation && (
        <div
          data-banking-recommendation
          style={{
            fontSize: 10,
            color: 'var(--text, #ccc)',
            lineHeight: 1.5,
            marginTop: 6,
          }}
        >
          {recommendation}
        </div>
      )}

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: 'var(--muted)',
        marginTop: 10,
        letterSpacing: '0.04em',
        opacity: 0.7,
        borderTop: '1px solid var(--border)',
        paddingTop: 6,
        fontStyle: 'italic',
      }}>
        ℹ {citation}
      </div>
    </div>
  )
}

export default memo(PreRaceSleepBankingCard)
