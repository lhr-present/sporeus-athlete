// ─── dashboard/PaceRangeCard.jsx — Running Pace Spread (28d window) ─────────
// Surfaces the SPREAD of running paces used over the last 28 days. Reveals
// whether the athlete is using both ends of the polarized spectrum (wide
// spread, good) or grinding away at a single tempo (narrow spread, junk-mile
// risk).
//
// Distinct from PaceByRpeCard (per-RPE median, calibration view); this card
// collapses to a single SPREAD metric (polarization view).
//
// Cite: Daniels 2014; Seiler 2010.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  analyzePaceRange,
  formatPace,
  formatSpread,
} from '../../lib/athlete/paceRange.js'

const BAND_COLOR = {
  WIDE_SPREAD:     '#5bc25b',
  MODERATE_SPREAD: '#0064ff',
  NARROW_SPREAD:   '#ff6600',
}

const BAND_LABEL = {
  WIDE_SPREAD:     { en: 'WIDE',     tr: 'GENİŞ' },
  MODERATE_SPREAD: { en: 'MODERATE', tr: 'ORTA' },
  NARROW_SPREAD:   { en: 'NARROW',   tr: 'DAR' },
}

const HINT = {
  WIDE_SPREAD: {
    en: "Wide pace variety — you're using both ends of the spectrum. Polarized training territory.",
    tr: 'Geniş tempo çeşitliliği — spektrumun her iki ucunu kullanıyorsun. Polarize antrenman bölgesi.',
  },
  MODERATE_SPREAD: {
    en: 'Some pace variety. Add 1-2 sessions at extreme paces (very easy OR very fast) for full polarization.',
    tr: 'Bir miktar tempo çeşitliliği. Tam polarizasyon için aşırı tempolarda (çok kolay VEYA çok hızlı) 1-2 seans ekle.',
  },
  NARROW_SPREAD: {
    en: 'Single-pace pattern — most runs land in a tight pace band. Junk-mile risk. Push hard days harder, easy days easier.',
    tr: 'Tek-tempo deseni — koşuların çoğu dar bir aralıkta. Verimsiz-mil riski. Sert günleri daha sert, kolay günleri daha kolay yap.',
  },
}

export default function PaceRangeCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzePaceRange({ log }), [log])

  if (!result) return null

  const {
    band,
    spread,
    fastestPace,
    slowestPace,
    medianPace,
    sampleCount,
    citation,
  } = result

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = BAND_LABEL[band]?.[isTR ? 'tr' : 'en'] || band
  const hint = HINT[band]?.[isTR ? 'tr' : 'en'] || ''

  const title = isTR ? 'TEMPO ARALIĞI · 28G' : 'PACE RANGE · 28D'
  const ariaLabel = isTR
    ? 'Tempo aralığı — 28 günlük tempo dağılımı'
    : 'Pace range — 28-day pace spread'

  const sessionsLabel = isTR
    ? `${sampleCount} koşu`
    : `${sampleCount} run${sampleCount === 1 ? '' : 's'}`

  const spreadStr = formatSpread(spread)
  const fastestStr = formatPace(fastestPace)
  const slowestStr = formatPace(slowestPace)
  const medianStr = formatPace(medianPace)

  const medianLabel = isTR ? 'medyan' : 'median'
  const rangeLabel = isTR ? 'aralık' : 'range'

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-pace-range-card=""
      data-pace-range-band={band}
      data-spread={spread.toFixed(4)}
      data-fastest-pace={fastestPace.toFixed(4)}
      data-slowest-pace={slowestPace.toFixed(4)}
      data-median-pace={medianPace.toFixed(4)}
      data-sample-count={String(sampleCount)}
      style={{ ...S.card, animationDelay: '500ms', padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* ── Header: sample count ─────────────────────────────────────────── */}
      <div
        style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '14px',
        }}
      >
        {sessionsLabel}
      </div>

      {/* ── Spread value + band badge ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          marginBottom: '14px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            ...S.mono,
            fontSize: '28px',
            fontWeight: 700,
            color: color,
            letterSpacing: '0.02em',
          }}
        >
          ±{spreadStr}
        </span>
        <span
          data-pace-range-band-badge=""
          style={{
            ...S.mono,
            fontSize: '10px',
            fontWeight: 700,
            color: '#fff',
            background: color,
            padding: '3px 10px',
            borderRadius: '2px',
            letterSpacing: '0.08em',
          }}
        >
          {bandLabel}
        </span>
      </div>

      {/* ── Range: fastest → slowest ─────────────────────────────────────── */}
      <div
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          letterSpacing: '0.04em',
          marginBottom: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '9px',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            minWidth: '52px',
          }}
        >
          {rangeLabel}
        </span>
        <span
          data-pace-range-fastest=""
          style={{ color: BAND_COLOR.NARROW_SPREAD, fontWeight: 600 }}
        >
          {fastestStr}
        </span>
        <span style={{ color: 'var(--muted)' }}>→</span>
        <span
          data-pace-range-slowest=""
          style={{ color: BAND_COLOR.WIDE_SPREAD, fontWeight: 600 }}
        >
          {slowestStr}
        </span>
      </div>

      {/* ── Median reference ─────────────────────────────────────────────── */}
      <div
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            minWidth: '52px',
          }}
        >
          {medianLabel}
        </span>
        <span
          data-pace-range-median=""
          style={{ color: 'var(--text)', fontWeight: 600 }}
        >
          {medianStr}
        </span>
      </div>

      {/* ── Interpretation hint ──────────────────────────────────────────── */}
      <div
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${color}`,
          marginBottom: '8px',
        }}
      >
        {hint}
      </div>

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {citation}
      </div>
    </div>
  )
}
