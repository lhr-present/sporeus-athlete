// ─── BackToBackLongDayCard.jsx — Back-to-Back Long-Day Pattern Detector ──────
//
// Surfaces analyzeBackToBackLongDay() (src/lib/athlete/backToBackLongDay.js).
// Counts weeks in the last 12 ISO weeks (Mon–Sun) where the athlete completed
// two long sessions (≥90 min) on consecutive calendar days.
//
// Why this matters (Issurin 2010 / Daniels 2014 / Skorski 2019):
//   - Back-to-back long days are the canonical signature of BLOCK accumulation
//     and marathon-block prep (depleted-glycogen simulation of late-race
//     fatigue).
//   - The same pattern WITHOUT a subsequent ≥48 h recovery window maps onto
//     overreaching markers — so the card surfaces both the count (positive
//     signal) and the flagged subset (negative signal).
//
// Bands:
//   NONE          → muted grey   — no back-to-back long-day pairs
//   OCCASIONAL    → blue         — 1–3 pairs (some block exposure)
//   BLOCK_STYLE   → green        — 4–8 pairs, ≤50% flagged (textbook block)
//   EXCESSIVE     → red          — ≥9 pairs OR >50% flagged (overreaching risk)
//
// Bilingual EN/TR via LangCtx. Mono terminal aesthetic.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeBackToBackLongDay } from '../../lib/athlete/backToBackLongDay.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  NONE:        '#888888',
  OCCASIONAL:  '#0064ff',
  BLOCK_STYLE: '#5bc25b',
  EXCESSIVE:   '#e03030',
}

const BAND_LABEL_EN = {
  NONE:        'NONE',
  OCCASIONAL:  'OCCASIONAL',
  BLOCK_STYLE: 'BLOCK STYLE',
  EXCESSIVE:   'EXCESSIVE',
}

const BAND_LABEL_TR = {
  NONE:        'YOK',
  OCCASIONAL:  'ARA SIRA',
  BLOCK_STYLE: 'BLOK TARZI',
  EXCESSIVE:   'AŞIRI',
}

const BAND_HINT_EN = {
  NONE:        'No back-to-back long days detected — long-session blocks are not part of the current habit.',
  OCCASIONAL:  'A few back-to-back long-day pairs — early exposure to block-style accumulation.',
  BLOCK_STYLE: 'Consistent block-style accumulation with adequate recovery windows. Textbook marathon-block prep.',
  EXCESSIVE:   'Too many back-to-back long days, or recovery windows missing after them — overreaching risk.',
}

const BAND_HINT_TR = {
  NONE:        'Üst üste uzun gün yok — uzun seans blokları mevcut alışkanlıkta yer almıyor.',
  OCCASIONAL:  'Birkaç ardışık uzun gün çifti — blok tarzı birikime erken maruziyet.',
  BLOCK_STYLE: 'Tutarlı blok tarzı birikim ve yeterli toparlanma pencereleri. Klasik maraton-blok hazırlığı.',
  EXCESSIVE:   'Çok fazla üst üste uzun gün ya da sonrasında toparlanma penceresi eksik — aşırı yüklenme riski.',
}

// Format 'YYYY-MM-DD' as 'MMM D' (EN) or 'D Ay' (TR).
const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function formatPair(startDate, isTR) {
  if (typeof startDate !== 'string' || startDate.length < 10) return ''
  const d = new Date(startDate + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return ''
  const d2 = new Date(d.getTime())
  d2.setUTCDate(d2.getUTCDate() + 1)
  const m1 = d.getUTCMonth()
  const m2 = d2.getUTCMonth()
  const day1 = d.getUTCDate()
  const day2 = d2.getUTCDate()
  if (isTR) {
    if (m1 === m2) return `${day1}-${day2} ${MONTH_TR[m1]}`
    return `${day1} ${MONTH_TR[m1]} - ${day2} ${MONTH_TR[m2]}`
  }
  if (m1 === m2) return `${MONTH_EN[m1]} ${day1}-${day2}`
  return `${MONTH_EN[m1]} ${day1} - ${MONTH_EN[m2]} ${day2}`
}

function shortSport(s) {
  if (typeof s !== 'string') return ''
  const t = s.trim().toLowerCase()
  if (!t) return ''
  // Truncate long sport strings to keep the chip compact.
  return t.length > 8 ? t.slice(0, 8) : t
}

/**
 * Dashboard card — back-to-back long-day pattern detector.
 *
 * @param {{ log: Array }} props
 */
function BackToBackLongDayCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const result = useMemo(
    () => analyzeBackToBackLongDay({ log: Array.isArray(log) ? log : [], today }),
    [log, today]
  )

  // Show up to 4 most-recent occurrences as chips. Hook MUST run before any
  // early return to satisfy rules-of-hooks.
  const recentChips = useMemo(() => {
    const occs = result?.occurrences
    if (!Array.isArray(occs) || occs.length === 0) return []
    return occs.slice(-4).reverse()
  }, [result])

  if (!result) return null

  const {
    band,
    totalOccurrences,
    flaggedCount,
    weeksWithB2B,
    citation,
  } = result

  const color = BAND_COLOR[band] || BAND_COLOR.OCCASIONAL
  const bandLabel = isTR ? (BAND_LABEL_TR[band] || band) : (BAND_LABEL_EN[band] || band)
  const hint = isTR ? BAND_HINT_TR[band] : BAND_HINT_EN[band]

  const title = isTR ? 'ÜST ÜSTE UZUN GÜNLER · 12H' : 'BACK-TO-BACK LONG DAYS · 12W'
  const ariaLabel = isTR ? 'Üst üste uzun günler kartı' : 'Back-to-back long days card'

  const totalCaption = isTR
    ? `çift / son 12 hafta`
    : `pairs / last 12 weeks`

  const weeksCaption = isTR
    ? `${weeksWithB2B} hafta`
    : `${weeksWithB2B} week${weeksWithB2B === 1 ? '' : 's'}`

  const flaggedCaption = isTR
    ? `${flaggedCount} 48s toparlanma yok`
    : `${flaggedCount} no 48h recovery`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="back-to-back-long-day"
      data-back-to-back-band={band}
      data-total-occurrences={totalOccurrences}
      data-flagged-count={flaggedCount}
      data-weeks-with-b2b={weeksWithB2B}
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
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-band-label
          style={{
            fontSize: 10,
            letterSpacing: '0.05em',
            fontWeight: 700,
            padding: '3px 8px',
            background: `${color}22`,
            color,
            border: `1px solid ${color}`,
            borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Big total + secondary stats row */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 8,
      }}>
        <div
          data-total-display
          style={{
            fontSize: 32,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {totalOccurrences}
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          lineHeight: 1.4,
        }}>
          {totalCaption}
        </div>
        <div style={{ flex: 1 }} />
        <div
          data-weeks-display
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1,
          }}
        >
          {weeksCaption}
        </div>
      </div>

      {/* Flagged badge (only when flaggedCount > 0) */}
      {flaggedCount > 0 ? (
        <div
          data-flagged-badge
          style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 700,
            color: '#e03030',
            background: '#e0303022',
            border: '1px solid #e03030',
            borderRadius: 3,
            padding: '3px 8px',
            letterSpacing: '0.04em',
            marginBottom: 8,
          }}
        >
          ⚠ {flaggedCaption}
        </div>
      ) : null}

      {/* Band strip */}
      <div
        data-band-strip
        style={{
          height: 4,
          width: '100%',
          background: color,
          opacity: 0.85,
          borderRadius: 2,
          marginBottom: 8,
        }}
      />

      {/* Occurrence chips (up to 4 most-recent) */}
      {recentChips.length > 0 ? (
        <div
          data-occurrence-chips
          role="list"
          aria-label={isTR ? 'Son üst üste uzun gün çiftleri' : 'Recent back-to-back long-day pairs'}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}
        >
          {recentChips.map(occ => {
            const dateLabel = formatPair(occ.startDate, isTR)
            const durLabel = `${Math.round(occ.durationsMin[0])}+${Math.round(occ.durationsMin[1])}${isTR ? 'd' : 'm'}`
            const s1 = shortSport(occ.sportPair[0])
            const s2 = shortSport(occ.sportPair[1])
            const sportLabel = s1 && s2 ? `${s1}+${s2}` : (s1 || s2 || '')
            return (
              <div
                key={occ.startDate}
                role="listitem"
                data-occurrence-chip
                data-occurrence-start={occ.startDate}
                data-occurrence-flagged={occ.flaggedNoRecovery ? '1' : '0'}
                style={{
                  fontSize: 10,
                  color: 'var(--text)',
                  background: `${color}14`,
                  border: `1px solid ${color}55`,
                  borderRadius: 3,
                  padding: '3px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {occ.flaggedNoRecovery ? (
                  <span
                    data-occurrence-flag-dot
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#e03030',
                      display: 'inline-block',
                    }}
                  />
                ) : null}
                <span>{dateLabel}, {durLabel}{sportLabel ? `, ${sportLabel}` : ''}</span>
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Hint */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {hint}
      </div>

      {/* Citation footer */}
      <div
        data-citation
        style={{
          fontSize: 9,
          color: '#555',
          fontStyle: 'italic',
        }}
      >
        {citation}
      </div>
    </div>
  )
}

export default memo(BackToBackLongDayCard)
