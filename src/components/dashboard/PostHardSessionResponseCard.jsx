// ─── PostHardSessionResponseCard.jsx — next-day recovery response to hard days
//
// Surfaces `analyzePostHardSessionResponse` (src/lib/athlete/postHardSessionResponse.js).
// For each hard session (RPE >= 7) in the last 28d, the analyzer pairs
// it with the next morning's recovery entry, computes sleep / RHR / HRV
// deltas vs the 28d baseline median, averages across pairs, and bands:
//
//   STRONG — body bounces back from hard days
//   NORMAL — markers return to baseline within ~24h (typical adaptation)
//   WEAK   — hard sessions leave a residue (consider rest day)
//
// Card renders null when fewer than 3 hard-session pairs with matching
// next-day recovery data.
//
// Citation: Plews D.J. et al. (2013) HRV and training intensity
//   distribution; Buchheit M. (2014) Monitoring training status with
//   HR-derived measures.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzePostHardSessionResponse } from '../../lib/athlete/postHardSessionResponse.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  STRONG: '#5bc25b',
  NORMAL: '#0064ff',
  WEAK:   '#ff6600',
}
const BAND_TR = {
  STRONG: 'GÜÇLÜ',
  NORMAL: 'NORMAL',
  WEAK:   'ZAYIF',
}
const BAND_HINT = {
  STRONG: {
    en: 'Body bounces back from hard days — keep the current load.',
    tr: 'Beden sert günlerden geri toparlanıyor — mevcut yükü sürdür.',
  },
  NORMAL: {
    en: 'Recovery markers return to baseline within a day — typical adaptation.',
    tr: 'Toparlanma göstergeleri bir gün içinde temele dönüyor — tipik adaptasyon.',
  },
  WEAK: {
    en: 'Hard sessions are leaving a residue — add a rest day or reduce intensity.',
    tr: 'Sert seanslar iz bırakıyor — bir dinlenme günü ekle veya yoğunluğu azalt.',
  },
}

// Format a signed delta with an arrow + magnitude + unit
function formatDelta(value, unit, digits = 1) {
  if (!Number.isFinite(value)) return { text: '—', arrow: '·', isPositive: null }
  const rounded = Number(value.toFixed(digits))
  if (rounded === 0) {
    return { text: `0${unit}`, arrow: '·', isPositive: null }
  }
  const arrow = rounded > 0 ? '▲' : '▼'
  const magnitude = Math.abs(rounded).toFixed(digits)
  return { text: `${magnitude}${unit}`, arrow, isPositive: rounded > 0 }
}

/**
 * @description Dashboard card surfacing the post-hard-session recovery
 *   response band over the last 28 days.
 * @param {{ log: Array, recovery: Array }} props
 */
export default function PostHardSessionResponseCard({ log, recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzePostHardSessionResponse({ log, recovery }),
    [log, recovery]
  )

  if (!analysis) return null

  const { band, pairCount, avgSleepDelta, avgRhrDelta, avgHrvDelta } = analysis
  const color = BAND_COLOR[band] || '#888'
  const hint = BAND_HINT[band] || { en: '', tr: '' }
  const bandLabel = isTR ? (BAND_TR[band] || band) : band

  const title = isTR ? 'SERT SONRASI YANIT · 28G' : 'POST-HARD RESPONSE · 28D'
  const ariaLabel = isTR
    ? 'Sert seans sonrası toparlanma yanıtı'
    : 'Post-hard session recovery response'

  const pairsLabel = isTR
    ? `${pairCount} sert-sonrası gün`
    : `${pairCount} post-hard days`

  const sleepLabel = isTR ? 'UYKU Δ' : 'SLEEP Δ'
  const rhrLabel   = isTR ? 'İST. KAH Δ' : 'RHR Δ'
  const hrvLabel   = isTR ? 'HRV Δ' : 'HRV Δ'

  // For sleep + HRV, "up" (▲) is good (green). For RHR, "down" (▼) is good.
  const sleepFmt = formatDelta(avgSleepDelta, 'h', 2)
  const rhrFmt   = formatDelta(avgRhrDelta, ' bpm', 1)
  const hrvFmt   = formatDelta(avgHrvDelta, ' ms', 1)

  const sleepArrowColor = sleepFmt.isPositive === null ? '#888'
    : sleepFmt.isPositive ? BAND_COLOR.STRONG : BAND_COLOR.WEAK
  const rhrArrowColor = rhrFmt.isPositive === null ? '#888'
    : rhrFmt.isPositive ? BAND_COLOR.WEAK : BAND_COLOR.STRONG
  const hrvArrowColor = hrvFmt.isPositive === null ? '#888'
    : hrvFmt.isPositive ? BAND_COLOR.STRONG : BAND_COLOR.WEAK

  const sleepAttr = Number.isFinite(avgSleepDelta) ? Number(avgSleepDelta.toFixed(2)) : ''
  const rhrAttr   = Number.isFinite(avgRhrDelta) ? Number(avgRhrDelta.toFixed(2)) : ''
  const hrvAttr   = Number.isFinite(avgHrvDelta) ? Number(avgHrvDelta.toFixed(2)) : ''

  const rowStyle = {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    fontSize: 11,
    padding: '4px 0',
    borderBottom: '1px dashed var(--border, #222)',
  }
  const rowLabelStyle = {
    color: 'var(--muted, #888)',
    letterSpacing: '0.05em',
    fontWeight: 600,
  }
  const rowValueStyle = {
    fontWeight: 700,
    letterSpacing: '0.04em',
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-post-hard-response-card
      data-response-band={band}
      data-pair-count={pairCount}
      data-sleep-delta={sleepAttr}
      data-rhr-delta={rhrAttr}
      data-hrv-delta={hrvAttr}
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

      {/* Pair count */}
      <div style={{
        fontSize: 10,
        color: 'var(--muted, #888)',
        letterSpacing: '0.05em',
        marginBottom: 8,
      }}>
        {pairsLabel}
      </div>

      {/* Delta rows */}
      <div style={{ marginBottom: 10 }}>
        <div style={rowStyle}>
          <span style={rowLabelStyle}>{sleepLabel}</span>
          <span style={rowValueStyle}>
            <span style={{ color: sleepArrowColor, marginRight: 4 }}>{sleepFmt.arrow}</span>
            {sleepFmt.text}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={rowLabelStyle}>{rhrLabel}</span>
          <span style={rowValueStyle}>
            <span style={{ color: rhrArrowColor, marginRight: 4 }}>{rhrFmt.arrow}</span>
            {rhrFmt.text}
          </span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={rowLabelStyle}>{hrvLabel}</span>
          <span style={rowValueStyle}>
            <span style={{ color: hrvArrowColor, marginRight: 4 }}>{hrvFmt.arrow}</span>
            {hrvFmt.text}
          </span>
        </div>
      </div>

      {/* Interpretation hint */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${color}10`,
        border: `1px solid ${color}40`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {isTR ? hint.tr : hint.en}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Plews 2013; Buchheit 2014
      </div>
    </div>
  )
}
