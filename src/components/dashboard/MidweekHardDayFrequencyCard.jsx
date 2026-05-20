// ─── MidweekHardDayFrequencyCard.jsx — Day-of-week hard-session distribution ─
//
// Surfaces analyzeMidweekHardDayFrequency (Foster 2017; Bompa 2018). Renders
// a 7-bar Mon-Sun histogram of HARD-day counts across the trailing 8 ISO
// weeks plus a headline midweek share %.
//
// Distinct from neighbouring cards:
//   - HardDaySpacingCard counts hard→hard adjacencies (mean spacing).
//   - HardEasyAdherenceCard counts weeks that respect the hard/easy rule.
//   - WeekendVolumeShareCard tracks weekend % of total VOLUME (minutes).
//   - DayOfWeekAvailabilityCard tracks which days a session was logged.
//   - This card answers: WHEN in the week do hard sessions actually happen?
//
// Bilingual EN/TR via LangCtx. Render rule: NULL when the analyzer returns
// null (unresolvable `today`). All four bands render, including
// INSUFFICIENT_HARD — surfacing "you don't have enough hard sessions" is
// itself useful feedback.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  analyzeMidweekHardDayFrequency,
  MIDWEEK_HARD_DAY_FREQUENCY_CITATION,
} from '../../lib/athlete/midweekHardDayFrequency.js'

const MONO = "'IBM Plex Mono', monospace"

const COLOR_MIDWEEK = '#0064ff' // blue — Tue/Wed/Thu
const COLOR_WEEKEND = '#e03030' // red  — Sat/Sun
const COLOR_NEUTRAL = '#888'    // grey — Mon/Fri

const BAND_COLOR = {
  MIDWEEK_FOCUSED:    '#0064ff', // blue — strong positive
  BALANCED:           '#5bc25b', // green
  WEEKEND_WARRIOR:    '#e03030', // red — warning
  INSUFFICIENT_HARD:  '#888',    // grey
}

const BAND_LABEL_EN = {
  MIDWEEK_FOCUSED:    'MIDWEEK FOCUSED',
  BALANCED:           'BALANCED',
  WEEKEND_WARRIOR:    'WEEKEND WARRIOR',
  INSUFFICIENT_HARD:  'INSUFFICIENT HARD',
}
const BAND_LABEL_TR = {
  MIDWEEK_FOCUSED:    'HAFTA İÇİ ODAKLI',
  BALANCED:           'DENGELİ',
  WEEKEND_WARRIOR:    'HAFTASONU SAVAŞÇISI',
  INSUFFICIENT_HARD:  'YETERSİZ SERT',
}

const HINT_EN = {
  MIDWEEK_FOCUSED:
    'Most hard sessions land mid-week (Tue-Thu) — classic serious-athlete pattern, weekends stay free for long aerobic work.',
  BALANCED:
    'Hard sessions spread across the week with no strong midweek or weekend skew.',
  WEEKEND_WARRIOR:
    'Hard sessions cluster on Sat/Sun. Working-athlete pattern — consider shifting one quality session to Tue or Wed to recover better.',
  INSUFFICIENT_HARD:
    'Fewer than 6 hard days in the last 8 weeks — too sparse to read a day-of-week pattern. Add quality sessions before tuning placement.',
}
const HINT_TR = {
  MIDWEEK_FOCUSED:
    'Sert seansların çoğu hafta içine düşüyor (Sal-Per) — ciddi sporcu kalıbı, haftasonu uzun aerobik için boş kalıyor.',
  BALANCED:
    'Sert seanslar hafta içine dengeli dağılmış, belirgin bir hafta içi veya haftasonu eğilimi yok.',
  WEEKEND_WARRIOR:
    'Sert seanslar Cmt/Paz üzerinde yığılıyor. Çalışan sporcu kalıbı — bir kaliteli seansı Sal veya Çar gününe kaydırarak daha iyi toparlanabilirsin.',
  INSUFFICIENT_HARD:
    'Son 8 haftada 6’dan az sert gün — gün-haftası kalıbı okumak için fazla seyrek. Yerleşim ayarı yapmadan önce kaliteli seans sayısını artır.',
}

const DAY_LABEL_EN = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const DAY_LABEL_TR = { mon: 'Pzt', tue: 'Sal', wed: 'Çar', thu: 'Per', fri: 'Cum', sat: 'Cmt', sun: 'Paz' }
const DAY_LONG_EN = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const DAY_LONG_TR = { mon: 'Pazartesi', tue: 'Salı', wed: 'Çarşamba', thu: 'Perşembe', fri: 'Cuma', sat: 'Cumartesi', sun: 'Pazar' }

const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const MIDWEEK_KEYS = new Set(['tue', 'wed', 'thu'])
const WEEKEND_KEYS = new Set(['sat', 'sun'])

function dayBarColor(key) {
  if (MIDWEEK_KEYS.has(key)) return COLOR_MIDWEEK
  if (WEEKEND_KEYS.has(key)) return COLOR_WEEKEND
  return COLOR_NEUTRAL
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

export default function MidweekHardDayFrequencyCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => todayIso(), [])
  const result = useMemo(
    () => analyzeMidweekHardDayFrequency({ log, today, windowWeeks: 8 }),
    [log, today]
  )

  if (!result) return null

  const color = BAND_COLOR[result.band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[result.band] : BAND_LABEL_EN[result.band]
  const hint = isTR ? HINT_TR[result.band] : HINT_EN[result.band]
  const heading = isTR ? 'HAFTA İÇİ SERT GÜNLER · 8H' : 'MIDWEEK HARD DAYS · 8W'
  const ariaLabel = isTR ? 'Hafta içi sert gün sıklığı kartı' : 'Midweek hard day frequency card'

  const maxCount = Math.max(1, ...DOW_KEYS.map(k => result.dayCounts[k]))
  const midweekSharePct = Math.round(result.midweekShare * 100)

  const dominantLong = result.dominantDay
    ? (isTR ? DAY_LONG_TR[result.dominantDay] : DAY_LONG_EN[result.dominantDay])
    : null
  const dominantLine = dominantLong
    ? (isTR ? `En sert gün: ${dominantLong}` : `Most-hard day: ${dominantLong}`)
    : (isTR ? 'En sert gün: —' : 'Most-hard day: —')

  const histogramAriaLabel = isTR
    ? 'Pazartesi’den Pazar’a sert gün sayıları'
    : 'Hard-day counts Monday through Sunday'

  const totalLine = isTR
    ? `${result.totalHardDays} sert gün · hafta içi ${result.midweekHardCount} · haftasonu ${result.weekendHardCount}`
    : `${result.totalHardDays} hard days · midweek ${result.midweekHardCount} · weekend ${result.weekendHardCount}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="midweek-hard-day-frequency"
      data-band={result.band}
      style={{
        ...S.card,
        animationDelay: '275ms',
        borderLeft: `3px solid ${color}`,
        fontFamily: MONO,
      }}
    >
      <div style={{ ...S.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>{heading}</span>
        <span
          data-midweek-hard-band={result.band}
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

      {/* Big midweek-share % + sub line ----------------------------------- */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0 10px' }}>
        <div
          data-midweek-share-pct={midweekSharePct}
          style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}
        >
          {midweekSharePct}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>%</div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginLeft: 6, lineHeight: 1.4 }}>
          {isTR ? 'hafta içi sert gün payı' : 'midweek hard-day share'}
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
          const count = result.dayCounts[k]
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
              {result.dayCounts[k]}
            </div>
          </div>
        ))}
      </div>

      {/* Stats row + dominant day ------------------------------------------ */}
      <div
        data-midweek-total-hard={result.totalHardDays}
        style={{ fontSize: 10, color: 'var(--sub, #555)', marginBottom: 4 }}
      >
        {totalLine}
      </div>
      <div
        data-midweek-dominant-day={result.dominantDay || ''}
        style={{ fontSize: 10, color: 'var(--text, #ccc)', marginBottom: 10, fontWeight: 600 }}
      >
        {dominantLine}
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
        {result.citation || MIDWEEK_HARD_DAY_FREQUENCY_CITATION}
      </div>
    </div>
  )
}
