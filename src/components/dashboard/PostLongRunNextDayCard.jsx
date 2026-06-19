// ─── PostLongRunNextDayCard.jsx — Post-Long-Run Next-Day Pattern Detector ────
//
// Surfaces analyzePostLongRunNextDay() (src/lib/athlete/postLongRunNextDay.js).
// For every long run (≥90 min) in the last 12 ISO weeks (Mon–Sun), classifies
// the day after as rest / easy / moderate / hard, then bands the pattern.
//
// Why this matters (Daniels 2014 / Pfitzinger 2014):
//   - The day AFTER a long run determines recovery quality. Running easy or
//     resting allows the protein-turnover and glycogen-restoration window to
//     do its work.
//   - Hard work the day after a long run accumulates fatigue without earning
//     new adaptation — and is the canonical pre-injury setup.
//
// Bands:
//   INSUFFICIENT_LONG_RUNS → muted grey — fewer than 4 long runs in window
//   IDEAL_RECOVERY         → green      — ≥75% of long runs followed by rest/easy
//   AGGRESSIVE_FOLLOWUP    → red        — ≥40% of long runs followed by hard work
//   MIXED                  → orange     — otherwise (room to improve)
//
// Bilingual EN/TR via LangCtx. Mono terminal aesthetic.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzePostLongRunNextDay } from '../../lib/athlete/postLongRunNextDay.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  INSUFFICIENT_LONG_RUNS: '#888888',
  IDEAL_RECOVERY:         '#5bc25b',
  MIXED:                  '#f5a623',
  AGGRESSIVE_FOLLOWUP:    '#e03030',
}

const BAND_LABEL_EN = {
  INSUFFICIENT_LONG_RUNS: 'INSUFFICIENT',
  IDEAL_RECOVERY:         'IDEAL RECOVERY',
  MIXED:                  'MIXED',
  AGGRESSIVE_FOLLOWUP:    'AGGRESSIVE',
}

const BAND_LABEL_TR = {
  INSUFFICIENT_LONG_RUNS: 'YETERSİZ',
  IDEAL_RECOVERY:         'İDEAL TOPARLANMA',
  MIXED:                  'KARIŞIK',
  AGGRESSIVE_FOLLOWUP:    'AGRESİF',
}

const BAND_HINT_EN = {
  INSUFFICIENT_LONG_RUNS: 'Fewer than 4 long runs in the window — log more long runs to see your post-long-run pattern.',
  IDEAL_RECOVERY:         'Most long runs are followed by rest or easy days — textbook Daniels recovery and the lowest-risk follow-up pattern.',
  MIXED:                  'A mixed pattern after long runs — some recovery, some load. Tighten next-day choices toward rest or easy for better adaptation.',
  AGGRESSIVE_FOLLOWUP:    'Hard work the day after a long run too often — the canonical pre-injury setup. Move hard sessions away from the next-day slot.',
}

const BAND_HINT_TR = {
  INSUFFICIENT_LONG_RUNS: 'Pencerede 4’ten az uzun koşu var — uzun-koşu-sonrası kalıbı görmek için daha fazla uzun koşu logla.',
  IDEAL_RECOVERY:         'Uzun koşuların büyük bölümü dinlenme veya kolay günle takip edilmiş — Daniels’in klasik toparlanma modeli ve en düşük risk profili.',
  MIXED:                  'Uzun koşu sonrası karışık bir kalıp — bir kısmı toparlanma, bir kısmı yük. Daha iyi adaptasyon için ertesi günü dinlenme/kolay yönüne kaydır.',
  AGGRESSIVE_FOLLOWUP:    'Uzun koşunun ertesi günü çok sık sert iş yapılmış — sakatlık öncesi klasik kurulum. Sert seansları bu slottan uzaklaştır.',
}

// Stacked-bar segment colours
const SEGMENT_COLOR = {
  rest:     '#5bc25b',
  easy:     '#0064ff',
  moderate: '#f5a623',
  hard:     '#e03030',
}

const SEGMENT_LABEL_EN = {
  rest:     'rest',
  easy:     'easy',
  moderate: 'moderate',
  hard:     'hard',
}

const SEGMENT_LABEL_TR = {
  rest:     'dinlenme',
  easy:     'kolay',
  moderate: 'orta',
  hard:     'sert',
}

const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function formatDate(iso, isTR) {
  if (typeof iso !== 'string' || iso.length < 10) return ''
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return ''
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  return isTR ? `${day} ${MONTH_TR[m]}` : `${MONTH_EN[m]} ${day}`
}

/**
 * Dashboard card — post-long-run next-day pattern detector.
 *
 * @param {{ log: Array }} props
 */
function PostLongRunNextDayCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const result = useMemo(
    () => analyzePostLongRunNextDay({ log: Array.isArray(log) ? log : [], today }),
    [log, today]
  )

  // Up to 4 most-recent long-run-followups, newest-first. Hook MUST run
  // before any early return to satisfy rules-of-hooks.
  const recentChips = useMemo(() => {
    const lrs = result?.longRuns
    if (!Array.isArray(lrs) || lrs.length === 0) return []
    return lrs.slice(-4).reverse()
  }, [result])

  if (!result) return null

  const {
    band,
    totalLongRuns,
    restDays,
    easyDays,
    moderateDays,
    hardDays,
    restOrEasyShare,
    citation,
  } = result

  const color = BAND_COLOR[band] || BAND_COLOR.MIXED
  const bandLabel = isTR ? (BAND_LABEL_TR[band] || band) : (BAND_LABEL_EN[band] || band)
  const hint = isTR ? BAND_HINT_TR[band] : BAND_HINT_EN[band]
  const segLabel = isTR ? SEGMENT_LABEL_TR : SEGMENT_LABEL_EN

  const title = isTR ? 'UZUN KOŞU SONRASI · 12H' : 'AFTER LONG RUN · 12W'
  const ariaLabel = isTR ? 'Uzun koşu sonrası kartı' : 'After long run card'

  // Stacked-bar widths (percentages). When totalLongRuns === 0 (only possible
  // via INSUFFICIENT band since result is non-null), default bar to 100% muted.
  const denom = Math.max(totalLongRuns, 1)
  const restPct = (restDays / denom) * 100
  const easyPct = (easyDays / denom) * 100
  const moderatePct = (moderateDays / denom) * 100
  const hardPct = (hardDays / denom) * 100

  // Counts caption: "12 long runs · 4 rest · 5 easy · 2 moderate · 1 hard"
  const countsCaption = isTR
    ? `${totalLongRuns} uzun koşu · ${restDays} ${segLabel.rest} · ${easyDays} ${segLabel.easy} · ${moderateDays} ${segLabel.moderate} · ${hardDays} ${segLabel.hard}`
    : `${totalLongRuns} long run${totalLongRuns === 1 ? '' : 's'} · ${restDays} ${segLabel.rest} · ${easyDays} ${segLabel.easy} · ${moderateDays} ${segLabel.moderate} · ${hardDays} ${segLabel.hard}`

  // Big stat: restOrEasyShare as %
  const sharePct = Math.round(restOrEasyShare * 100)

  const shareCaption = isTR
    ? 'dinlenme/kolay payı'
    : 'rest or easy share'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="post-long-run-next-day"
      data-post-long-run-band={band}
      data-total-long-runs={totalLongRuns}
      data-rest-days={restDays}
      data-easy-days={easyDays}
      data-moderate-days={moderateDays}
      data-hard-days={hardDays}
      data-rest-or-easy-share={restOrEasyShare}
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

      {/* Big share stat */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 8,
      }}>
        <div
          data-share-display
          style={{
            fontSize: 32,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {sharePct}
          <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 2 }}>%</span>
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          lineHeight: 1.4,
        }}>
          {shareCaption}
        </div>
      </div>

      {/* Stacked horizontal bar — rest | easy | moderate | hard */}
      <div
        data-stacked-bar
        role="img"
        aria-label={isTR ? 'Sonraki gün dağılımı' : 'Next-day distribution'}
        style={{
          display: 'flex',
          width: '100%',
          height: 10,
          background: '#222',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        {restPct > 0 ? (
          <div
            data-segment="rest"
            data-segment-pct={restPct}
            style={{ width: `${restPct}%`, background: SEGMENT_COLOR.rest }}
          />
        ) : null}
        {easyPct > 0 ? (
          <div
            data-segment="easy"
            data-segment-pct={easyPct}
            style={{ width: `${easyPct}%`, background: SEGMENT_COLOR.easy }}
          />
        ) : null}
        {moderatePct > 0 ? (
          <div
            data-segment="moderate"
            data-segment-pct={moderatePct}
            style={{ width: `${moderatePct}%`, background: SEGMENT_COLOR.moderate }}
          />
        ) : null}
        {hardPct > 0 ? (
          <div
            data-segment="hard"
            data-segment-pct={hardPct}
            style={{ width: `${hardPct}%`, background: SEGMENT_COLOR.hard }}
          />
        ) : null}
      </div>

      {/* Counts caption */}
      <div
        data-counts-caption
        style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          marginBottom: 8,
          lineHeight: 1.5,
        }}
      >
        {countsCaption}
      </div>

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

      {/* Recent long-run-followup chips (up to 4) */}
      {recentChips.length > 0 ? (
        <div
          data-recent-chips
          role="list"
          aria-label={isTR ? 'Son uzun koşu sonrası günler' : 'Recent post-long-run days'}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}
        >
          {recentChips.map(lr => {
            const dateLabel = formatDate(lr.longRunDate, isTR)
            const dur = Math.round(lr.longRunMin)
            const kind = lr.nextDay?.kind || 'rest'
            const kindLabel = segLabel[kind] || kind
            const chipColor = SEGMENT_COLOR[kind] || SEGMENT_COLOR.rest
            const text = isTR
              ? `${dateLabel} (${dur}d koşu) → ${kindLabel}`
              : `${dateLabel} (${dur}m run) → ${kindLabel}`
            return (
              <div
                key={lr.longRunDate}
                role="listitem"
                data-recent-chip
                data-long-run-date={lr.longRunDate}
                data-next-day-kind={kind}
                style={{
                  fontSize: 10,
                  color: 'var(--text)',
                  background: `${chipColor}14`,
                  border: `1px solid ${chipColor}55`,
                  borderRadius: 3,
                  padding: '3px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span
                  data-chip-dot
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: chipColor,
                    display: 'inline-block',
                  }}
                />
                <span>{text}</span>
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Band hint */}
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

export default memo(PostLongRunNextDayCard)
