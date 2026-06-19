// ─── LogStreakBreakerCard.jsx — Streak vs Longest Logging Gap ──────────────
//
// Surfaces the athlete's CURRENT logging streak alongside the LONGEST
// historical no-logging gap. Pairs the running streak with a story anchor
// the athlete can compare against — a 12-day streak reads very differently
// when the longest break ever was 5 days (compounding) vs 60 days (early
// signal). Wood 2013 (habit formation) + Duckworth 2007 (grit) — concrete
// past evidence of bounce-back outperforms abstract streak counters at
// retention.
//
// Renders null when the pure-fn returns null (no log/recovery entries).
//
// Status colors / labels:
//   ACTIVE       green #5bc25b  AKTİF
//   STEADY       blue  #0064ff  SABİT
//   RECENT_BREAK orange #ff6600 ARA

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeLogStreakBreaker } from '../../lib/athlete/logStreakBreaker.js'

const MONO = "'IBM Plex Mono', monospace"

const STATUS_COLOR = {
  ACTIVE:       '#5bc25b',
  STEADY:       '#0064ff',
  RECENT_BREAK: '#ff6600',
}

const STATUS_LABEL_TR = {
  ACTIVE:       'AKTİF',
  STEADY:       'SABİT',
  RECENT_BREAK: 'ARA',
}

const HINT = {
  ACTIVE: {
    en: "Current streak is bigger than half of your longest break — momentum's compounding.",
    tr: 'Mevcut seri en uzun aranın yarısından fazla — momentum birikiyor.',
  },
  STEADY: {
    en: 'Active streak holding. Past breaks were normal — your job is to extend this one.',
    tr: 'Aktif seri devam ediyor. Geçmiş aralar normaldi — görevin bunu uzatmak.',
  },
  RECENT_BREAK: {
    en: 'Logging just lapsed. Restart today; the next entry resets the clock.',
    tr: 'Kayıt yakın zamanda kesildi. Bugün yeniden başla; bir sonraki kayıt sayacı sıfırlar.',
  },
}

function LogStreakBreakerCard({ log, recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeLogStreakBreaker({ log, recovery }),
    [log, recovery],
  )

  if (!result) return null
  const {
    status,
    currentStreak,
    longestGap,
    gapStart,
    gapEnd,
    totalLoggedDays,
    citation,
  } = result

  const accent = STATUS_COLOR[status] || STATUS_COLOR.RECENT_BREAK
  const statusLbl = isTR
    ? (STATUS_LABEL_TR[status] || status)
    : status.replace('_', ' ')
  const hint = HINT[status]?.[isTR ? 'tr' : 'en'] || ''

  const titleEN = 'STREAK vs LONGEST BREAK'
  const titleTR = 'SERİ vs EN UZUN ARA'
  const daysEN  = currentStreak === 1 ? 'day' : 'days'
  const daysTR  = 'gün'

  // "longest break ever: X days · ended YYYY-MM-DD"
  const comparisonEN = gapEnd
    ? `longest break ever: ${longestGap} days · ended ${gapEnd}`
    : `longest break ever: ${longestGap} days`
  const comparisonTR = gapEnd
    ? `en uzun ara: ${longestGap} gün · bitiş ${gapEnd}`
    : `en uzun ara: ${longestGap} gün`

  const totalEN = `${totalLoggedDays} total logged days`
  const totalTR = `toplam ${totalLoggedDays} kayıt günü`

  const ariaLabel = isTR
    ? 'Seri ve en uzun ara'
    : 'Streak versus longest break'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-log-streak-breaker-card
      data-streak-status={status}
      data-current-streak={currentStreak}
      data-longest-gap={longestGap}
      data-gap-start={gapStart || ''}
      data-gap-end={gapEnd || ''}
      data-total-logged-days={totalLoggedDays}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `4px solid ${accent}`,
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
        <span style={{ color: accent, marginRight: 6 }}>◢</span>
        {isTR ? titleTR : titleEN}
      </div>

      <div
        style={{
          display: 'inline-block',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          background: accent,
          padding: '3px 10px',
          borderRadius: 3,
          letterSpacing: '0.08em',
          marginBottom: 10,
        }}
      >
        {statusLbl}
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
            color: accent,
            lineHeight: 1,
          }}
        >
          {currentStreak}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted, #888)' }}>
          {isTR ? daysTR : daysEN}
        </span>
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--muted, #888)',
          marginBottom: 6,
          lineHeight: 1.5,
        }}
      >
        {isTR ? comparisonTR : comparisonEN}
      </div>

      <div
        style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          marginBottom: 8,
        }}
      >
        {isTR ? totalTR : totalEN}
      </div>

      {hint ? (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text)',
            lineHeight: 1.6,
            paddingLeft: 8,
            borderLeft: `2px solid ${accent}`,
            marginBottom: 8,
          }}
        >
          {hint}
        </div>
      ) : null}

      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(LogStreakBreakerCard)
