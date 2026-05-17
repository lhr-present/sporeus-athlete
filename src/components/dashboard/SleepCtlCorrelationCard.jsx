// ─── dashboard/SleepCtlCorrelationCard.jsx ──────────────────────────────────
// Surfaces the 28-day Pearson r between daily sleep hours and CTL.
// Answers: "does THIS athlete adapt better when they sleep more?"
// References: Halson 2014; Mah 2011; Walker 2017.
import { memo, useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  computeSleepCtlCorrelation,
} from '../../lib/athlete/sleepCtlCorrelation.js'

const MONO = "'IBM Plex Mono', monospace"

// Color per interpretation band — green strong / blue moderate / muted weak.
const BAND_COLOR = {
  strong:   '#5bc25b',
  moderate: '#0064ff',
  weak:     '#888888',
}

function SleepCtlCorrelationCard({ log, recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const data = useMemo(
    () => computeSleepCtlCorrelation({ log, recovery, windowDays: 28 }),
    [log, recovery],
  )

  // Per the spec: render NULL (i.e. nothing) if the pure-fn returns null.
  if (!data) return null

  const { r, n, meanSleep, meanCtl, band, interpretation, citation } = data
  const color = BAND_COLOR[band] || BAND_COLOR.weak

  const title    = isTR ? '◈ UYKU × KTY KORELASYONU'   : '◈ SLEEP × CTL CORRELATION'
  const rLabel   = isTR ? 'PEARSON r'                  : 'PEARSON r'
  const nLabel   = isTR ? 'eşli gün'                   : 'paired days'
  const slpLabel = isTR ? 'ort uyku'                   : 'avg sleep'
  const ctlLabel = isTR ? 'ort KTY'                    : 'avg CTL'
  const ariaLabel = isTR
    ? 'Uyku ve kronik antrenman yükü korelasyon kartı'
    : 'Sleep and chronic training load correlation card'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-sleep-ctl-correlation-card
      data-correlation-band={band}
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
      {/* Title */}
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#ff6600',
        marginBottom: 10,
      }}>
        {title}
      </div>

      {/* r value — the headline metric */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{
          fontFamily: MONO,
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: '0.02em',
          color,
          lineHeight: 1,
        }}
        data-correlation-r
        >
          {r >= 0 ? '+' : ''}{r.toFixed(2)}
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.08em',
        }}>
          {rLabel}
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          marginLeft: 'auto',
        }}>
          n = {n} {nLabel}
        </div>
      </div>

      {/* Mean sleep + mean CTL row */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 10,
        fontSize: 11,
        color: 'var(--sub, #aaa)',
        flexWrap: 'wrap',
      }}>
        <div>
          <span style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
            {slpLabel}:
          </span>{' '}
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>
            {meanSleep.toFixed(1)}h
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
            {ctlLabel}:
          </span>{' '}
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>
            {meanCtl}
          </span>
        </div>
      </div>

      {/* Interpretation — bilingual */}
      <div style={{
        padding: 8,
        background: `${color}14`,
        border: `1px solid ${color}55`,
        borderRadius: 3,
        fontSize: 11,
        lineHeight: 1.5,
        color: 'var(--text)',
        marginBottom: 8,
      }}
      data-correlation-interpretation
      >
        {isTR ? interpretation.tr : interpretation.en}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: 'var(--muted)',
        fontStyle: 'italic',
        letterSpacing: '0.04em',
        opacity: 0.8,
        borderTop: '1px solid var(--border)',
        paddingTop: 6,
      }}>
        ℹ {citation}
      </div>
    </div>
  )
}

export default memo(SleepCtlCorrelationCard)
