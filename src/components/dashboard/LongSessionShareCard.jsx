// ─── LongSessionShareCard.jsx — Long-Session Share Distribution Detector UI ─
//
// Surfaces `computeLongSessionShare` (Daniels 2014; Coggan & Allen 2010;
// Magness 2017). Renders ONLY when the pattern is worth surfacing:
//   - Pure fn returns non-null (≥2 weeks of data, no zero weeks).
//   - band !== 'TARGET' (a healthy 25-35% share doesn't need a card).
//
// Bilingual EN/TR. Color-coded by band:
//   TOO_SHORT     orange   (no real long session — build durability)
//   MODERATE      orange   (long session a bit short — extend gradually)
//   OVERWEIGHTED  orange   (base too thin — fill mid-week)
//   ISOLATED      red      (one big session, weak base — injury risk)
// (TARGET is green by spec but never renders — the card returns null.)
//
// Tests: src/components/__tests__/LongSessionShareCard.test.jsx
//
// Citations:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed.
//   Coggan A.R., Allen H. (2010). Training and Racing with a Power Meter, 2nd ed.
//   Magness S. (2017). The Science of Running.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeLongSessionShare } from '../../lib/athlete/longSessionShare.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  TARGET:       '#5bc25b', // green (never rendered — card returns null)
  TOO_SHORT:    '#ff6600', // orange
  MODERATE:     '#ff6600', // orange
  OVERWEIGHTED: '#ff6600', // orange
  ISOLATED:     '#e03030', // red
}

const BAND_LABEL_EN = {
  TARGET:       'TARGET',
  TOO_SHORT:    'TOO SHORT',
  MODERATE:     'MODERATE',
  OVERWEIGHTED: 'OVERWEIGHTED',
  ISOLATED:     'ISOLATED',
}

const BAND_LABEL_TR = {
  TARGET:       'HEDEF',
  TOO_SHORT:    'ÇOK KISA',
  MODERATE:     'ORTA',
  OVERWEIGHTED: 'AŞIRI AĞIRLIKLI',
  ISOLATED:     'İZOLE',
}

const RECOMMENDATION_EN = {
  TOO_SHORT:    'Build a real long session each week',
  MODERATE:     'Long session a bit short — extend gradually',
  OVERWEIGHTED: 'Base too thin — fill mid-week',
  ISOLATED:     'One big session, weak base — high injury risk',
}

const RECOMMENDATION_TR = {
  TOO_SHORT:    'Her hafta gerçek bir uzun antrenman ekle',
  MODERATE:     'Uzun antrenman biraz kısa — kademeli uzat',
  OVERWEIGHTED: 'Hafta ortası antrenmanlar zayıf',
  ISOLATED:     'Tek büyük antrenman, zayıf taban — yaralanma riski',
}

function LongSessionShareCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const result = useMemo(
    () => computeLongSessionShare({ log, today, weeks: 4 }),
    [log, today]
  )

  // Render NULL when no signal: insufficient data OR healthy distribution.
  if (!result || result.band === 'TARGET') return null

  const color = BAND_COLOR[result.band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[result.band] : BAND_LABEL_EN[result.band]
  const heading = isTR ? 'UZUN ANTR. PAYI · 4H' : 'LONG SESSION SHARE · 4W'
  const ariaLabel = isTR ? 'Uzun antrenman payı kartı' : 'Long session share card'
  const recommendation = isTR
    ? RECOMMENDATION_TR[result.band]
    : RECOMMENDATION_EN[result.band]

  const sharePctRounded = Math.round(result.avgSharePct)
  const labelMin = isTR ? 'dk' : 'min'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-long-session-share-card
      data-share-band={result.band}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: `1px solid ${color}55`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'var(--muted, #888)',
          fontWeight: 700,
        }}>
          {heading}
        </div>
        <div style={{
          fontSize: 9,
          letterSpacing: '0.05em',
          color,
          fontWeight: 700,
        }}>
          {bandLabel}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <div style={{
          fontSize: 32,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}>
          {sharePctRounded}
        </div>
        <div style={{
          fontSize: 14,
          color,
          fontWeight: 700,
        }}>
          %
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          marginLeft: 6,
          lineHeight: 1.4,
        }}>
          {isTR ? 'haftalık hacmin uzun antrenman payı' : 'avg long-session share'}
        </div>
      </div>

      {/* Per-week chips — one for each week in the rolling window. */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
      }}>
        {result.longestPerWeek.map(wk => (
          <div
            key={wk.weekStart}
            data-week-chip
            data-week-start={wk.weekStart}
            title={`${wk.weekStart} · longest ${wk.longestMin} ${labelMin} / total ${wk.totalMin} ${labelMin}`}
            style={{
              fontSize: 10,
              padding: '4px 8px',
              background: `${color}14`,
              border: `1px solid ${color}33`,
              borderRadius: 3,
              color: 'var(--text, #ccc)',
              lineHeight: 1.3,
            }}
          >
            <span style={{ color: 'var(--muted, #888)', marginRight: 4 }}>
              {wk.weekStart.slice(5)}
            </span>
            <span style={{ color, fontWeight: 700 }}>
              {Math.round(wk.sharePct)}%
            </span>
            <span style={{ color: 'var(--muted, #888)', marginLeft: 4 }}>
              ({wk.longestMin}/{wk.totalMin})
            </span>
          </div>
        ))}
      </div>

      <div style={{
        fontSize: 10,
        color: 'var(--text, #ccc)',
        lineHeight: 1.5,
        padding: 8,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {recommendation}
      </div>

      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(LongSessionShareCard)
