// ─── WeekendVolumeShareCard.jsx — Weekend-warrior distribution detector UI ──
//
// Surfaces `computeWeekendVolumeShare` (Soligard 2016; Lambert 1997). The
// card renders ONLY when the pattern is worth surfacing:
//   - Pure fn returns non-null (enough data, ≥3 sessions/week, ≥2 weeks)
//   - band !== 'BALANCED' (a healthy distribution doesn't need a card)
//
// Bilingual EN/TR. Color-coded by band:
//   WEEKEND_BIASED  blue
//   WEEKEND_WARRIOR orange
//   SEVERE          red
// (BALANCED is green by spec but never renders — the card returns null.)
//
// Tests: src/components/__tests__/WeekendVolumeShareCard.test.jsx

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeWeekendVolumeShare } from '../../lib/athlete/weekendVolumeShare.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  BALANCED:        '#5bc25b', // green (never rendered — card returns null)
  WEEKEND_BIASED:  '#0064ff', // blue
  WEEKEND_WARRIOR: '#ff6600', // orange
  SEVERE:          '#e03030', // red
}

const BAND_LABEL_EN = {
  BALANCED:        'BALANCED',
  WEEKEND_BIASED:  'WEEKEND-BIASED',
  WEEKEND_WARRIOR: 'WEEKEND WARRIOR',
  SEVERE:          'SEVERE',
}

const BAND_LABEL_TR = {
  BALANCED:        'DENGELİ',
  WEEKEND_BIASED:  'HAFTASONU AĞIRLIKLI',
  WEEKEND_WARRIOR: 'HAFTASONU SAVAŞÇISI',
  SEVERE:          'AĞIR',
}

export default function WeekendVolumeShareCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const result = useMemo(
    () => computeWeekendVolumeShare({ log, today, weeks: 4 }),
    [log, today]
  )

  // Render NULL when no signal: insufficient data OR healthy distribution.
  if (!result || result.band === 'BALANCED') return null

  const color = BAND_COLOR[result.band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[result.band] : BAND_LABEL_EN[result.band]
  const heading = isTR ? 'HAFTASONU PAYI · 4H' : 'WEEKEND SHARE · 4W'
  const ariaLabel = isTR ? 'Haftasonu hacim payı kartı' : 'Weekend volume share card'

  const sharePctRounded = Math.round(result.sharePct)

  const labelWeekday = isTR ? 'Hafta içi' : 'Weekday'
  const labelWeekend = isTR ? 'Haftasonu' : 'Weekend'
  const labelSessions = isTR ? 'seans/hafta' : 'sessions/wk'

  const recommendation = isTR
    ? '1-2 antrenmanı hafta ortasına taşı — yükü dağıt, yaralanma riskini azalt.'
    : 'Move 1-2 sessions to mid-week to spread load and reduce injury risk.'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-weekend-volume-share-card
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
          {isTR ? 'haftasonu hacmi' : 'of weekly volume'}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10,
        marginBottom: 12,
        fontSize: 10,
      }}>
        <div>
          <div style={{ color: 'var(--muted, #888)', marginBottom: 2 }}>{labelWeekday}</div>
          <div style={{ color: 'var(--text)', fontWeight: 700 }}>
            {result.weekdayMin} <span style={{ fontWeight: 400, color: 'var(--muted, #888)' }}>min</span>
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--muted, #888)', marginBottom: 2 }}>{labelWeekend}</div>
          <div style={{ color, fontWeight: 700 }}>
            {result.weekendMin} <span style={{ fontWeight: 400, color: 'var(--muted, #888)' }}>min</span>
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--muted, #888)', marginBottom: 2 }}>{labelSessions}</div>
          <div style={{ color: 'var(--text)', fontWeight: 700 }}>
            {result.sessionsPerWeek}
          </div>
        </div>
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
