// ─── AltitudeStimulusCard.jsx — climbing-elevation hypoxic-stimulus proxy ───
//
// Surfaces `detectAltitudeStimulus` (src/lib/athlete/altitudeStimulus.js).
// The detector aggregates weekly vertical gain across the last 28
// days and classifies the overall climbing band as a hypoxic-stimulus
// proxy:
//
//   HYPOXIC_STIMULUS — ≥3 weeks ≥1500m   (sustained Lippl-proxy load)
//   MODERATE         — ≥2 weeks ≥500m    (some climbing exposure)
//   NONE             — otherwise         (flat training)
//
// Renders null when the detector returns null (too few sessions or
// no elevation data in the window — the signal cannot be inferred).
//
// Citations: Lippl T. et al. (2010) "Hypobaric hypoxia causes body
// weight reduction in obese subjects"; Levine B.D. & Stray-Gundersen
// J. (1997) "Living high–training low".

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { detectAltitudeStimulus } from '../../lib/athlete/altitudeStimulus.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_TR = {
  HYPOXIC_STIMULUS: 'HİPOKSİK',
  MODERATE:         'ORTA',
  NONE:             'YOK',
}
const BAND_COLOR = {
  HYPOXIC_STIMULUS: '#5bc25b', // green
  MODERATE:         '#0064ff', // blue
  NONE:             '#888',    // muted
}
const BAND_HINT = {
  HYPOXIC_STIMULUS: {
    en: 'Strong climbing load — bone-marrow EPO response likely engaged.',
    tr: 'Güçlü tırmanış yükü — kemik iliği EPO yanıtı muhtemelen tetiklendi.',
  },
  MODERATE: {
    en: 'Some hypoxic exposure — increase climbing minutes for full adaptation.',
    tr: 'Bir miktar hipoksik maruziyet — tam adaptasyon için tırmanış dakikalarını artır.',
  },
  NONE: {
    en: 'Minimal elevation gain — climbing volume too low for hypoxic adaptation.',
    tr: 'Düşük irtifa kazancı — hipoksik adaptasyon için tırmanış hacmi yetersiz.',
  },
}

/**
 * @description Surface `detectAltitudeStimulus` as a Dashboard card.
 * Renders null when the detector returns null.
 *
 * @param {{ log: Array }} props
 */
export default function AltitudeStimulusCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(() => detectAltitudeStimulus({ log }), [log])

  if (!analysis) return null
  const band = analysis.band
  if (!BAND_COLOR[band]) return null

  const color = BAND_COLOR[band]
  const hint = BAND_HINT[band]
  const bandLabel = isTR ? BAND_TR[band] : band
  const title = isTR ? 'İRTİFA UYARANI · 28G' : 'ALTITUDE STIMULUS · 28D'
  const ariaLabel = isTR ? 'İrtifa uyaranı' : 'Altitude stimulus'
  const totalLabel = isTR ? 'TOPLAM TIRMANIŞ' : 'TOTAL ASCENT'
  const sessionsLabel = isTR ? 'seans' : 'sessions'

  // Reverse the weeks so the most recent week renders on the right
  // (matches the natural left-to-right time-progression reading).
  const weekChips = [...analysis.weeks].reverse()

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-altitude-stimulus-card
      data-altitude-band={band}
      data-total-ascent={analysis.totalAscent28d}
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
          data-altitude-band-label
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

      {/* Total 28d ascent — large number */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.05em' }}>
          {totalLabel}
        </div>
        <div
          data-total-ascent-display
          style={{
            fontSize: 26,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {analysis.totalAscent28d.toLocaleString('en-US')}m
        </div>
      </div>

      {/* Weekly bars / chips — one per week */}
      <div
        data-altitude-weeks
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginBottom: 10,
        }}
      >
        {weekChips.map((w, i) => {
          // Per-week color: green if high, blue if moderate, muted else.
          const wColor = w.totalAscentM >= 1500
            ? '#5bc25b'
            : w.totalAscentM >= 500
            ? '#0064ff'
            : '#888'
          return (
            <div
              key={`${w.weekStart}-${i}`}
              data-altitude-week-chip
              data-week-index={i}
              data-week-ascent={w.totalAscentM}
              title={`${w.weekStart} · ${w.totalAscentM}m · ${w.sessionCount} ${sessionsLabel}`}
              style={{
                fontSize: 9,
                padding: '3px 6px',
                background: `${wColor}22`,
                color: wColor,
                border: `1px solid ${wColor}`,
                borderRadius: 2,
                fontWeight: 700,
                letterSpacing: '0.03em',
              }}
            >
              {w.totalAscentM}m
            </div>
          )
        })}
      </div>

      {/* Interpretation hint (bilingual) */}
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
        {analysis.citation}
      </div>
    </div>
  )
}
