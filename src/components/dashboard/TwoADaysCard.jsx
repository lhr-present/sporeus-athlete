// ─── dashboard/TwoADaysCard.jsx — Two-a-Day (Double-Session) Frequency ─────
// Tracks how often the athlete stacks two or more separate training sessions
// on the same calendar day over the trailing 60 days. Useful brick-pattern
// signal for triathletes and tip-off for overreaching when frequency runs hot.
//
// Cite: Cejuela 2013 (triathlon training distribution / brick frequency);
//       Issurin 2010 (block accumulation patterns);
//       Skorski 2019 (repeated high-density days as overreaching risk).
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeTwoADays } from '../../lib/athlete/twoADays.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLORS = {
  NONE:       '#5bc25b', // green — no doubles, clean recovery
  OCCASIONAL: '#0064ff', // blue — rec/standard
  ROUTINE:    '#ff6600', // orange — block training, deliberate
  EXCESSIVE:  '#d4351c', // red — overreaching risk
}

const BAND_LABELS = {
  NONE:       { en: 'NONE',       tr: 'YOK' },
  OCCASIONAL: { en: 'OCCASIONAL', tr: 'ARA SIRA' },
  ROUTINE:    { en: 'ROUTINE',    tr: 'RUTİN' },
  EXCESSIVE:  { en: 'EXCESSIVE',  tr: 'AŞIRI' },
}

const BAND_HINTS = {
  NONE: {
    en: 'No double-session days. Clean single-session pattern over the last 60 days.',
    tr: 'Çift seanslı gün yok. Son 60 günde temiz tek-seans deseni.',
  },
  OCCASIONAL: {
    en: 'A handful of doubles — typical for recreational athletes layering quality + endurance.',
    tr: 'Birkaç çift seanslı gün — kalite + dayanıklılık bindirmesi yapan rekreasyonel sporcular için tipik.',
  },
  ROUTINE: {
    en: 'Routine two-a-days — block-style accumulation. Watch recovery between AM and PM.',
    tr: 'Rutin çift seanslar — blok tarzı yüklenme. Sabah-akşam arası toparlanmayı izle.',
  },
  EXCESSIVE: {
    en: 'Excessive double-session frequency — overreaching territory. Schedule deload days.',
    tr: 'Çift seans sıklığı aşırı — aşırı yüklenme bölgesi. Boşaltma günleri planla.',
  },
}

// Month-name month/day formatter (matches "May 12" style requested).
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
                   'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function formatDateLabel(iso, isTR) {
  if (typeof iso !== 'string' || iso.length < 10) return iso || ''
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso
  const monthName = (isTR ? MONTHS_TR : MONTHS_EN)[m - 1] || ''
  return `${monthName} ${d}`
}

function TwoADaysCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzeTwoADays({ log }), [log])

  // Pure-fn returns null only on unresolvable `today` — bail in that case.
  if (!result) return null

  const accent      = BAND_COLORS[result.band] || BAND_COLORS.NONE
  const bandLabel   = BAND_LABELS[result.band]?.[isTR ? 'tr' : 'en'] || result.band
  const hintText    = BAND_HINTS[result.band]?.[isTR ? 'tr' : 'en'] || ''

  const title    = isTR ? 'ÇİFT ANTRENMANLI GÜNLER · 60G' : 'TWO-A-DAY SESSIONS · 60D'
  const ariaText = isTR
    ? `Çift antrenmanlı günler — ${bandLabel}`
    : `Two-a-day sessions — ${bandLabel}`

  const subStat = isTR
    ? `çift gün / son 60 gün`
    : `double day${result.totalDoubleDays === 1 ? '' : 's'} in last 60`

  const recent = result.doubleDays.slice(-5).reverse() // last 5 newest-first

  return (
    <div
      role="region"
      aria-label={ariaText}
      data-card="two-a-days"
      data-two-a-days-card=""
      data-band={result.band}
      data-total-double-days={String(result.totalDoubleDays)}
      data-cross-sport-double-days={String(result.crossSportDoubleDays)}
      data-mean-day-tss={String(result.meanDayTssOnDoubles)}
      style={{
        background: 'var(--card-bg, #111)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #e5e5e5)',
      }}
    >
      {/* ─── Title ─────────────────────────────────────────────────────── */}
      <div style={{
        fontSize: 12,
        letterSpacing: '0.06em',
        fontWeight: 700,
        marginBottom: 12,
        color: 'var(--text)',
      }}>
        <span style={{ color: accent, marginRight: 6 }}>◢</span>
        {title}
      </div>

      {/* ─── Large stat ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 6,
        flexWrap: 'wrap',
      }}>
        <div
          data-large-stat=""
          style={{
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1,
            color: accent,
            letterSpacing: '-0.02em',
          }}
        >
          {result.totalDoubleDays}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--muted, #888)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {subStat}
        </div>
      </div>

      {/* ─── Sub-row: cross-sport badge + mean day TSS ─────────────────── */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 12,
      }}>
        <span
          data-band-badge=""
          style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 700,
            color: '#fff',
            background: accent,
            padding: '3px 8px',
            borderRadius: 3,
            letterSpacing: '0.08em',
          }}
        >
          {bandLabel}
        </span>

        {result.crossSportDoubleDays > 0 && (
          <span
            data-cross-sport-badge=""
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text, #e5e5e5)',
              border: '1px solid var(--border, #333)',
              padding: '3px 8px',
              borderRadius: 3,
              letterSpacing: '0.06em',
            }}
          >
            {`${result.crossSportDoubleDays} `}
            {isTR ? 'sporlar-arası' : 'cross-sport'}
          </span>
        )}

        <span
          data-mean-tss-stat=""
          style={{
            fontSize: 11,
            color: 'var(--muted, #888)',
            letterSpacing: '0.04em',
          }}
        >
          {isTR ? 'Ortalama TSS / çift gün:' : 'Mean TSS / double day:'}{' '}
          <strong style={{ color: 'var(--text, #e5e5e5)' }}>
            {result.meanDayTssOnDoubles.toFixed(2)}
          </strong>
        </span>
      </div>

      {/* ─── Band hint strip ───────────────────────────────────────────── */}
      <div
        data-band-hint=""
        style={{
          fontSize: 11,
          color: 'var(--text, #e5e5e5)',
          lineHeight: 1.6,
          paddingLeft: 8,
          borderLeft: `2px solid ${accent}`,
          marginBottom: recent.length > 0 ? 12 : 6,
        }}
      >
        {hintText}
      </div>

      {/* ─── Recent double-days list ──────────────────────────────────── */}
      {recent.length > 0 && (
        <div data-recent-doubles="" style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: 10,
            color: 'var(--muted, #888)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            {isTR ? 'SON ÇİFT GÜNLER' : 'RECENT DOUBLE DAYS'}
          </div>
          <ul style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            {recent.map((d) => {
              const sessionsLabel = isTR
                ? `${d.sessionCount} seans`
                : `${d.sessionCount} session${d.sessionCount === 1 ? '' : 's'}`
              const sportsLabel = d.sports.join('+') || '—'
              const tssLabel = `${Math.round(d.totalDayTss)} TSS`
              return (
                <li
                  key={d.date}
                  data-double-day-row=""
                  data-date={d.date}
                  data-session-count={String(d.sessionCount)}
                  data-cross-sport={d.isCrossSport ? '1' : '0'}
                  style={{
                    fontSize: 11,
                    color: 'var(--text, #e5e5e5)',
                    letterSpacing: '0.02em',
                  }}
                >
                  <span style={{ color: 'var(--muted, #888)', marginRight: 6 }}>
                    {formatDateLabel(d.date, isTR)}
                  </span>
                  {`(${sessionsLabel}, ${sportsLabel}, ${tssLabel})`}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ─── Citation ─────────────────────────────────────────────────── */}
      <div
        data-citation=""
        style={{
          fontSize: 9,
          color: '#555',
          marginTop: 4,
          letterSpacing: '0.04em',
        }}
      >
        {result.citation}
      </div>
    </div>
  )
}

export default memo(TwoADaysCard)
