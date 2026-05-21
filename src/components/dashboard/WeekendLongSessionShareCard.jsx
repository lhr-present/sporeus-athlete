// ─── WeekendLongSessionShareCard.jsx — Long-session weekday/weekend split ───
//
// Surfaces analyzeWeekendLongSessionShare (Foster 2017; Bompa 2018). Renders
// a 7-bar Mon-Sun histogram of long-session counts across the trailing 12
// ISO weeks plus a headline weekend-share %.
//
// Distinct from neighbouring cards:
//   - WeekendVolumeShareCard tracks weekend % of total VOLUME (all minutes).
//   - LongSessionShareCard tracks the % of WEEKLY MINUTES the long session
//     consumes (intra-week distribution).
//   - LongRunFrequencyCard counts run-specific long sessions per month.
//   - LongRunConsistencyCard tracks long-run cadence variance.
//   - This card answers: of all the LONG sessions (any sport), what
//     fraction happen on Sat/Sun?
//
// Bilingual EN/TR via LangCtx. Render rule: NULL when analyze returns null
// (unresolvable `today`). All four bands render, including
// INSUFFICIENT_LONG_SESSIONS — surfacing "you don't have enough long
// sessions to read a pattern" is itself useful feedback.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  analyzeWeekendLongSessionShare,
  WEEKEND_LONG_SESSION_SHARE_CITATION,
} from '../../lib/athlete/weekendLongSessionShare.js'

const MONO = "'IBM Plex Mono', monospace"

const COLOR_WEEKDAY = '#888'    // grey — Mon-Fri
const COLOR_WEEKEND = '#e03030' // red  — Sat/Sun

const BAND_COLOR = {
  WEEKDAY_DOMINANT:           '#0064ff', // blue — unusual mid-week pattern
  MIXED:                      '#5bc25b', // green — balanced
  WEEKEND_DOMINANT:           '#e03030', // red — back-loaded
  INSUFFICIENT_LONG_SESSIONS: '#888',    // grey
}

const BAND_LABEL_EN = {
  WEEKDAY_DOMINANT:           'WEEKDAY DOMINANT',
  MIXED:                      'MIXED',
  WEEKEND_DOMINANT:           'WEEKEND DOMINANT',
  INSUFFICIENT_LONG_SESSIONS: 'INSUFFICIENT LONG',
}
const BAND_LABEL_TR = {
  WEEKDAY_DOMINANT:           'HAFTA İÇİ AĞIRLIKLI',
  MIXED:                      'KARIŞIK',
  WEEKEND_DOMINANT:           'HAFTASONU AĞIRLIKLI',
  INSUFFICIENT_LONG_SESSIONS: 'YETERSİZ UZUN',
}

const HINT_EN = {
  WEEKDAY_DOMINANT:
    'Long sessions skew to mid-week — unusual for amateur athletes. Confirms you have weekday time budget; weekends stay free for other priorities.',
  MIXED:
    'Long sessions spread between weekdays and weekends — flexible pattern with backup days if Saturday is rained out.',
  WEEKEND_DOMINANT:
    'Long sessions cluster on Sat/Sun — classic working-athlete pattern. Risk: one bad weather weekend wipes the durability stimulus. Consider a mid-week backup slot.',
  INSUFFICIENT_LONG_SESSIONS:
    'Fewer than 6 long sessions (≥90 min) in the last 12 weeks — too sparse to read a weekend/weekday pattern. Build long-session volume before tuning placement.',
}
const HINT_TR = {
  WEEKDAY_DOMINANT:
    'Uzun seanslar hafta içine kayıyor — amatör sporcular için sıra dışı. Hafta içi zaman bütçen olduğunu gösteriyor; haftasonu diğer önceliklere kalıyor.',
  MIXED:
    'Uzun seanslar hafta içi ve haftasonu arasında dağılmış — Cumartesi yağmurda iptal olursa yedek günün var.',
  WEEKEND_DOMINANT:
    'Uzun seanslar Cmt/Paz üzerinde yığılıyor — klasik çalışan sporcu kalıbı. Risk: bir kötü hava haftası dayanıklılık uyaranını silebilir. Hafta içi yedek slot düşün.',
  INSUFFICIENT_LONG_SESSIONS:
    'Son 12 haftada 6’dan az uzun seans (≥90 dk) — haftasonu/hafta içi kalıbı okumak için fazla seyrek. Yerleşim ayarı yapmadan önce uzun seans sayısını artır.',
}

const DAY_LABEL_EN = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const DAY_LABEL_TR = { mon: 'Pzt', tue: 'Sal', wed: 'Çar', thu: 'Per', fri: 'Cum', sat: 'Cmt', sun: 'Paz' }

const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKEND_KEYS = new Set(['sat', 'sun'])

function dayBarColor(key) {
  return WEEKEND_KEYS.has(key) ? COLOR_WEEKEND : COLOR_WEEKDAY
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

export default function WeekendLongSessionShareCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => todayIso(), [])
  const result = useMemo(
    () => analyzeWeekendLongSessionShare({ log, today, windowWeeks: 12 }),
    [log, today]
  )

  if (!result) return null

  const color = BAND_COLOR[result.band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[result.band] : BAND_LABEL_EN[result.band]
  const hint = isTR ? HINT_TR[result.band] : HINT_EN[result.band]
  const heading = isTR ? 'HAFTASONU UZUN ANTRENMANLAR · 12H' : 'WEEKEND LONG SESSIONS · 12W'
  const ariaLabel = isTR
    ? 'Hafta sonu uzun antrenman payı kartı'
    : 'Weekend long session share card'

  const maxCount = Math.max(1, ...DOW_KEYS.map(k => result.longSessionsByDay[k]))
  const weekendSharePct = Math.round(result.weekendShare * 100)

  const histogramAriaLabel = isTR
    ? 'Pazartesi’den Pazar’a uzun seans sayıları'
    : 'Long-session counts Monday through Sunday'

  const totalLine = isTR
    ? `${result.longSessions} uzun seans · haftasonu ${result.weekendLongCount} · hafta içi ${result.weekdayLongCount}`
    : `${result.longSessions} long sessions · ${result.weekendLongCount} weekend · ${result.weekdayLongCount} weekday`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="weekend-long-session-share"
      data-band={result.band}
      style={{
        ...S.card,
        animationDelay: '280ms',
        borderLeft: `3px solid ${color}`,
        fontFamily: MONO,
      }}
    >
      <div style={{ ...S.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>{heading}</span>
        <span
          data-weekend-long-band={result.band}
          style={{
            fontSize: 9,
            letterSpacing: '0.05em',
            color,
            fontWeight: 700,
            background: `${color}18`,
            border: `1px solid ${color}55`,
            borderRadius: 3,
            padding: '2px 6px',
          }}
        >
          {bandLabel}
        </span>
      </div>

      {/* Big weekend-share % + sub line ----------------------------------- */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0 10px' }}>
        <div
          data-weekend-long-share-pct={weekendSharePct}
          style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}
        >
          {weekendSharePct}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>%</div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginLeft: 6, lineHeight: 1.4 }}>
          {isTR ? 'uzun seansların haftasonu payı' : 'of long sessions on weekend'}
        </div>
      </div>

      {/* 7-bar Mon-Sun histogram ------------------------------------------- */}
      <div
        role="group"
        aria-label={histogramAriaLabel}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          alignItems: 'end',
          height: 64,
          marginBottom: 6,
        }}
      >
        {DOW_KEYS.map(k => {
          const count = result.longSessionsByDay[k]
          const barColor = dayBarColor(k)
          const heightPx = Math.max(2, Math.round((count / maxCount) * 56))
          return (
            <div
              key={k}
              data-dow-key={k}
              data-dow-count={count}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
            >
              <div
                style={{
                  width: '100%',
                  height: heightPx,
                  background: barColor,
                  borderRadius: '2px 2px 0 0',
                  opacity: count > 0 ? 1 : 0.35,
                }}
              />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 10 }}>
        {DOW_KEYS.map(k => (
          <div
            key={k}
            style={{
              fontSize: 9,
              textAlign: 'center',
              color: dayBarColor(k),
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            {isTR ? DAY_LABEL_TR[k] : DAY_LABEL_EN[k]}
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontWeight: 400 }}>
              {result.longSessionsByDay[k]}
            </div>
          </div>
        ))}
      </div>

      {/* Counts row -------------------------------------------------------- */}
      <div
        data-weekend-long-total={result.longSessions}
        style={{ fontSize: 10, color: 'var(--sub, #555)', marginBottom: 10 }}
      >
        {totalLine}
      </div>

      {/* Band-coloured interpretation strip -------------------------------- */}
      <div
        style={{
          fontSize: 10,
          color: 'var(--text, #ccc)',
          lineHeight: 1.5,
          padding: 8,
          background: `${color}14`,
          border: `1px solid ${color}33`,
          borderLeft: `2px solid ${color}`,
          borderRadius: 3,
          marginBottom: 8,
        }}
      >
        {hint}
      </div>

      {/* Citation footer --------------------------------------------------- */}
      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {result.citation || WEEKEND_LONG_SESSION_SHARE_CITATION}
      </div>
    </div>
  )
}
