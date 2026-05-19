// ─── SessionLengthDistributionCard.jsx — 90-Day Duration Histogram ──────────
//
// Surfaces `analyzeSessionLengthDistribution` (src/lib/athlete/sessionLength
// Distribution.js). While LongestSessionTrend / LongSessionShare /
// LongRunFrequency / LongRunConsistency each pick a single dimension of
// long-session progression, this card shows the FULL distribution of
// session durations: a horizontal histogram across seven duration bins,
// the modal bin highlighted, plus median + IQR readout.
//
// Issurin 2010 + Bompa 2018: a sustainable endurance base needs duration
// variety. Exclusively short sessions cannot drive aerobic adaptation;
// exclusively long sessions cannot sustain weekly load.
//
// Band colour conventions match the other distribution cards:
//   WIDE_RANGE        green  (healthy spread)
//   BALANCED          blue   (acceptable spread, not yet wide)
//   NARROW_SHORT      orange (skewed toward short sessions)
//   NARROW_LONG       orange (skewed toward long sessions)
//   INSUFFICIENT_DATA grey   (need more sessions to interpret)
//
// Bilingual via LangCtx. Mono terminal aesthetic. Renders null when the
// analyzer returns null (today unresolvable).
//
// Citations:
//   Issurin V.B. (2010). Sports Med 40(3):189-206.
//   Bompa T.O., Buzzichelli C.A. (2018). Periodization, 6th ed.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeSessionLengthDistribution } from '../../lib/athlete/sessionLengthDistribution.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  WIDE_RANGE:        '#5bc25b', // green
  BALANCED:          '#0064ff', // blue
  NARROW_SHORT:      '#ff6600', // orange
  NARROW_LONG:       '#ff6600', // orange
  INSUFFICIENT_DATA: '#888888', // grey
}

const BAND_LABEL = {
  WIDE_RANGE:        { en: 'WIDE RANGE',        tr: 'GENİŞ ARALIK' },
  BALANCED:          { en: 'BALANCED',          tr: 'DENGELİ' },
  NARROW_SHORT:      { en: 'NARROW · SHORT',    tr: 'DAR · KISA' },
  NARROW_LONG:       { en: 'NARROW · LONG',     tr: 'DAR · UZUN' },
  INSUFFICIENT_DATA: { en: 'NOT ENOUGH DATA',   tr: 'YETERSİZ VERİ' },
}

const BAND_HINT = {
  WIDE_RANGE: {
    en: 'Healthy duration variety across short, medium, and long sessions — sustainable base.',
    tr: 'Kısa, orta ve uzun seanslar arasında sağlıklı süre çeşitliliği — sürdürülebilir taban.',
  },
  BALANCED: {
    en: 'Reasonable spread, but a wider duration mix would harden the base further.',
    tr: 'Dağılım makul; süre çeşitliliğini artırmak tabanı daha da sağlamlaştırır.',
  },
  NARROW_SHORT: {
    en: 'Sessions are mostly under 45 min — add one longer ride/run weekly to drive aerobic adaptation.',
    tr: 'Seanslar çoğunlukla 45 dakikanın altında — aerobik adaptasyon için haftada bir uzun seans ekle.',
  },
  NARROW_LONG: {
    en: 'Sessions are mostly 90 min+ — weekly load is fragile; add shorter recovery sessions.',
    tr: 'Seanslar çoğunlukla 90 dk üstü — haftalık yük kırılgan; kısa toparlanma seansları ekle.',
  },
  INSUFFICIENT_DATA: {
    en: 'Log at least 15 sessions in the last 90 days to see your duration distribution.',
    tr: 'Süre dağılımını görmek için son 90 günde en az 15 seans kaydet.',
  },
}

function formatMin(min) {
  if (!Number.isFinite(min)) return '—'
  return `${Math.round(min)}min`
}

/**
 * Dashboard card visualising the 90-day distribution of session durations
 * as a horizontal histogram across seven duration bins.
 *
 * @param {{ log: Array }} props
 */
export default function SessionLengthDistributionCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const analysis = useMemo(
    () => analyzeSessionLengthDistribution({ log, today, windowDays: 90 }),
    [log, today]
  )

  if (!analysis) return null

  const { band, bins, totalSessions, medianMin, q25Min, q75Min, modeBinId, citation } = analysis
  const color = BAND_COLOR[band] || '#0064ff'
  const bandLabel = BAND_LABEL[band] ? BAND_LABEL[band][isTR ? 'tr' : 'en'] : band
  const hint = BAND_HINT[band] || BAND_HINT.BALANCED
  const title = isTR ? 'ANTRENMAN SÜRELERİ · 90G' : 'SESSION LENGTHS · 90D'
  const ariaLabel = isTR
    ? `Antrenman süreleri dağılımı — ${bandLabel}`
    : `Session length distribution — ${bandLabel}`

  // Histogram scale — peak count drives bar width.
  const maxCount = bins.reduce((m, b) => (b.count > m ? b.count : m), 0)

  const totalLabel = isTR
    ? `${totalSessions} seans`
    : `${totalSessions} session${totalSessions === 1 ? '' : 's'}`

  // Median / IQR readout. Suppress when no data.
  const showStats = totalSessions > 0
  const medianLabel = isTR
    ? `medyan ${formatMin(medianMin)}, IQR ${formatMin(q25Min)}-${formatMin(q75Min)}`
    : `median ${formatMin(medianMin)}, IQR ${formatMin(q25Min)}-${formatMin(q75Min)}`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="session-length-distribution"
      data-band={band}
      data-total-sessions={totalSessions}
      data-mode-bin={modeBinId || ''}
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
        gap: 8,
        flexWrap: 'wrap',
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

      {/* Stats row */}
      {showStats && (
        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'baseline',
          marginBottom: 10,
          flexWrap: 'wrap',
        }}>
          <div data-stats style={{ fontSize: 11, color: 'var(--text)' }}>
            {medianLabel}
          </div>
          <div style={{ flex: 1 }} />
          <div
            data-total
            style={{ fontSize: 10, color: 'var(--muted, #888)', letterSpacing: '0.04em' }}
          >
            {totalLabel}
          </div>
        </div>
      )}

      {/* Histogram — one row per bin */}
      <div
        data-histogram
        role="list"
        aria-label={isTR ? 'Süre kovaları' : 'Duration bins'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginBottom: 10,
        }}
      >
        {bins.map(b => {
          const isMode = b.id === modeBinId
          const barColor = isMode ? '#ff6600' : `${color}88`
          const widthPct = maxCount > 0 ? Math.max(2, Math.round((b.count / maxCount) * 100)) : 2
          const rowAria = isTR
            ? `${b.label} dakika: ${b.count} seans`
            : `${b.label} minutes: ${b.count} session${b.count === 1 ? '' : 's'}`
          return (
            <div
              key={b.id}
              role="listitem"
              aria-label={rowAria}
              data-bin={b.id}
              data-bin-count={b.count}
              data-mode={isMode ? 'true' : 'false'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{
                width: 54,
                fontSize: 10,
                color: isMode ? '#ff6600' : 'var(--muted, #888)',
                fontWeight: isMode ? 700 : 500,
                textAlign: 'right',
                letterSpacing: '0.02em',
              }}>
                {b.label}
              </div>
              <div style={{
                flex: 1,
                height: 10,
                background: 'var(--surface, #1a1a1a)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${widthPct}%`,
                  height: '100%',
                  background: barColor,
                  opacity: b.count === 0 ? 0.25 : 1,
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{
                width: 28,
                fontSize: 10,
                color: isMode ? '#ff6600' : 'var(--text)',
                fontWeight: isMode ? 700 : 600,
                textAlign: 'right',
              }}>
                {b.count}
              </div>
            </div>
          )
        })}
      </div>

      {/* Band-coloured interpretation strip */}
      <div
        data-hint
        aria-live="polite"
        style={{
          fontSize: 10,
          color: 'var(--text)',
          lineHeight: 1.5,
          padding: 8,
          background: `${color}10`,
          border: `1px solid ${color}40`,
          borderRadius: 3,
          marginBottom: 8,
        }}
      >
        {isTR ? hint.tr : hint.en}
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
