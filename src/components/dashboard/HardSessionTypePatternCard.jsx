// ─── HardSessionTypePatternCard.jsx — 90-Day Hard-Session Variety ───────────
//
// Surfaces `analyzeHardSessionTypePattern` (src/lib/athlete/hardSession
// TypePattern.js). DIFFERENT from SessionVarietyCard — that card measures
// variety across ALL sessions; this one measures variety specifically WITHIN
// HARD sessions (Z3+ or RPE ≥ 7).
//
// Stöggl 2014 + Tønnessen 2015: variety in hard-session structure drives
// orthogonal physiological adaptations; a monolithic "always-tempo" pattern
// means only one adaptation pathway is being trained.
//
// Renders a horizontal stacked bar (top 6 types + "other"), the dominant
// type with its share, hard-session count, Shannon entropy and a band-
// coloured interpretation strip. Bilingual via LangCtx, terminal aesthetic.
//
// Citations:
//   Stöggl T., Sperlich B. (2014). Front Physiol 5:33.
//   Tønnessen E. et al. (2015). Int J Sports Physiol Perform 10:29-38.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeHardSessionTypePattern } from '../../lib/athlete/hardSessionTypePattern.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  VARIED:            '#5bc25b', // green
  BALANCED:          '#0064ff', // blue
  NARROW:            '#ff6600', // orange
  MONOLITHIC:        '#e03030', // red
  INSUFFICIENT_HARD: '#888888', // grey
}

const BAND_LABEL = {
  VARIED:            { en: 'VARIED',            tr: 'ÇEŞİTLİ' },
  BALANCED:          { en: 'BALANCED',          tr: 'DENGELİ' },
  NARROW:            { en: 'NARROW',            tr: 'DAR' },
  MONOLITHIC:        { en: 'MONOLITHIC',        tr: 'TEK TİP' },
  INSUFFICIENT_HARD: { en: 'NOT ENOUGH HARD',   tr: 'YETERSİZ SERT' },
}

const BAND_HINT = {
  VARIED: {
    en: 'Healthy variety across multiple hard-session types — orthogonal adaptations are being trained.',
    tr: 'Birden çok sert seans tipinde sağlıklı çeşitlilik — farklı adaptasyon yolları çalışıyor.',
  },
  BALANCED: {
    en: 'Reasonable mix of hard-session types — a couple more session types would broaden the adaptation pool.',
    tr: 'Sert seans tipleri arasında makul karışım — birkaç tip daha eklemek adaptasyonu genişletir.',
  },
  NARROW: {
    en: 'One hard-session type dominates the last 90 days — consider rotating in a second or third format.',
    tr: 'Son 90 günde tek bir sert seans tipi baskın — ikinci ve üçüncü bir format eklemeyi düşün.',
  },
  MONOLITHIC: {
    en: 'Nearly every hard session is the same type — ceiling effect risk. Rotate in intervals, tempo, threshold or hill-repeats.',
    tr: 'Neredeyse her sert seans aynı tip — tavan etkisi riski. İntervaller, tempo, eşik veya tepe tekrarları ekle.',
  },
  INSUFFICIENT_HARD: {
    en: 'Log at least 8 hard sessions (Z3+ or RPE ≥ 7) in the last 90 days to evaluate variety.',
    tr: 'Çeşitliliği değerlendirmek için son 90 günde en az 8 sert seans (Z3+ veya RPE ≥ 7) kaydet.',
  },
}

const SEGMENT_PALETTE = ['#ff6600', '#0064ff', '#5bc25b', '#f5c542', '#9b59b6', '#1abc9c']
const OTHER_COLOR = '#666666'

function buildSegments(typeCounts) {
  // Top 6 types + an aggregated "other" segment when there are extras.
  const top = typeCounts.slice(0, 6)
  const rest = typeCounts.slice(6)
  const restCount = rest.reduce((s, r) => s + r.count, 0)
  const restShare = rest.reduce((s, r) => s + r.share, 0)
  const segs = top.map((t, i) => ({
    key: t.type,
    label: t.type,
    count: t.count,
    share: t.share,
    color: SEGMENT_PALETTE[i % SEGMENT_PALETTE.length],
    isOther: false,
  }))
  if (restCount > 0) {
    segs.push({
      key: '__other__',
      label: 'other',
      count: restCount,
      share: restShare,
      color: OTHER_COLOR,
      isOther: true,
    })
  }
  return segs
}

/**
 * Dashboard card visualising the 90-day distribution of hard-session
 * TYPES — Shannon entropy + dominant share + band classification.
 *
 * @param {{ log: Array }} props
 */
function HardSessionTypePatternCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const analysis = useMemo(
    () => analyzeHardSessionTypePattern({ log, today, windowDays: 90 }),
    [log, today]
  )

  if (!analysis) return null

  const {
    band,
    hardSessions,
    uniqueHardTypes,
    typeCounts,
    entropyBits,
    normalizedEntropy,
    dominantType,
    dominantSharePct,
    citation,
  } = analysis

  const color = BAND_COLOR[band] || BAND_COLOR.BALANCED
  const bandLabel = (BAND_LABEL[band] || BAND_LABEL.BALANCED)[isTR ? 'tr' : 'en']
  const hint = BAND_HINT[band] || BAND_HINT.BALANCED

  const title = isTR
    ? 'SERT ANTRENMAN ÇEŞİTLİLİĞİ · 90G'
    : 'HARD-SESSION VARIETY · 90D'

  const ariaLabel = isTR
    ? `Sert antrenman çeşitliliği — ${bandLabel}`
    : `Hard-session variety — ${bandLabel}`

  const segments = buildSegments(typeCounts)
  const otherLabel = isTR ? 'diğer' : 'other'

  const hardCountLabel = isTR
    ? `son 90 günde ${hardSessions} sert seans`
    : `${hardSessions} hard session${hardSessions === 1 ? '' : 's'} in last 90d`

  const dominantLabel = (() => {
    if (!dominantType) {
      return isTR ? 'baskın tip yok' : 'no dominant type'
    }
    return isTR
      ? `${dominantType}: %${dominantSharePct.toFixed(0)}`
      : `${dominantType}: ${dominantSharePct.toFixed(0)}%`
  })()

  const normEntropyLabel = isTR
    ? `çeşitlilik ${normalizedEntropy.toFixed(2)} / 1.00`
    : `variety ${normalizedEntropy.toFixed(2)} / 1.00`

  const entropyBitsLabel = isTR
    ? `entropi ${entropyBits.toFixed(2)} bit`
    : `entropy ${entropyBits.toFixed(2)} bits`

  const uniqueTypesLabel = isTR
    ? `${uniqueHardTypes} farklı tip`
    : `${uniqueHardTypes} unique type${uniqueHardTypes === 1 ? '' : 's'}`

  // Visual: total bar = sum of segment shares (≤1). Width is share × 100.
  const totalShare = segments.reduce((s, sg) => s + sg.share, 0)

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="hard-session-type-pattern"
      data-band={band}
      data-hard-sessions={hardSessions}
      data-unique-types={uniqueHardTypes}
      data-dominant-type={dominantType || ''}
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

      {/* Large stat: hard-session count */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 12,
        flexWrap: 'wrap',
      }}>
        <div
          data-hard-count
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--text)',
            lineHeight: 1,
          }}
        >
          {hardSessions}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--muted, #888)',
            letterSpacing: '0.04em',
          }}
        >
          {hardCountLabel}
        </div>
      </div>

      {/* Dominant + entropy stats line */}
      <div
        data-stats
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
          fontSize: 11,
          color: 'var(--text)',
        }}
      >
        <span data-dominant style={{ fontWeight: 600 }}>{dominantLabel}</span>
        <span data-unique-label style={{ color: 'var(--muted, #888)' }}>{uniqueTypesLabel}</span>
        <span data-entropy style={{ color: 'var(--muted, #888)' }}>{entropyBitsLabel}</span>
        <span data-norm-entropy style={{ color: 'var(--muted, #888)' }}>{normEntropyLabel}</span>
      </div>

      {/* Horizontal stacked bar (top 6 types + other) */}
      {segments.length > 0 && (
        <div
          data-bar
          role="list"
          aria-label={isTR ? 'Sert seans tip dağılımı' : 'Hard-session type distribution'}
          style={{
            display: 'flex',
            width: '100%',
            height: 16,
            borderRadius: 3,
            overflow: 'hidden',
            background: 'var(--surface, #1a1a1a)',
            marginBottom: 8,
          }}
        >
          {segments.map(sg => {
            const widthPct = totalShare > 0 ? (sg.share / totalShare) * 100 : 0
            const itemLabel = sg.isOther
              ? (isTR ? otherLabel : sg.label)
              : sg.label
            const aria = isTR
              ? `${itemLabel}: ${sg.count} seans`
              : `${itemLabel}: ${sg.count} session${sg.count === 1 ? '' : 's'}`
            return (
              <div
                key={sg.key}
                role="listitem"
                aria-label={aria}
                data-segment={sg.key}
                data-segment-count={sg.count}
                title={`${itemLabel}: ${sg.count}`}
                style={{
                  width: `${widthPct}%`,
                  background: sg.color,
                  transition: 'width 0.3s',
                }}
              />
            )
          })}
        </div>
      )}

      {/* Legend rows (top 6 + other) */}
      {segments.length > 0 && (
        <div
          data-legend
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginBottom: 10,
          }}
        >
          {segments.map(sg => {
            const itemLabel = sg.isOther
              ? (isTR ? otherLabel : sg.label)
              : sg.label
            const sharePct = Math.round(sg.share * 100)
            return (
              <div
                key={sg.key}
                data-legend-row={sg.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 10,
                  color: 'var(--text)',
                }}
              >
                <div style={{
                  width: 10,
                  height: 10,
                  background: sg.color,
                  borderRadius: 2,
                  flex: '0 0 auto',
                }} />
                <div style={{ flex: 1, textTransform: 'lowercase' }}>{itemLabel}</div>
                <div style={{ width: 40, textAlign: 'right', color: 'var(--muted, #888)' }}>
                  {sg.count}
                </div>
                <div style={{ width: 40, textAlign: 'right' }}>
                  {isTR ? `%${sharePct}` : `${sharePct}%`}
                </div>
              </div>
            )
          })}
        </div>
      )}

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

export default memo(HardSessionTypePatternCard)
