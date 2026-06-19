// ─── dashboard/AverageWeekShapeCard.jsx — Typical microcycle visualizer ─────
// Surfaces analyzeAverageWeekShape(): the athlete's TYPICAL weekly training
// rhythm over the trailing 8 weeks. Renders pattern badge + 7-bar Mon-Sun
// mini chart + bilingual interpretation hint.
// Cite: Bompa 2018 microcycle design; Issurin 2010 within-week distribution.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeAverageWeekShape } from '../../lib/athlete/averageWeekShape.js'

// ─── Palette ────────────────────────────────────────────────────────────────
const PATTERN_COLOR = {
  WEEKEND_HEAVY:       '#ff6600',
  MIDWEEK_HEAVY:       '#0064ff',
  EVENLY_DISTRIBUTED:  '#5bc25b',
  POLARIZED:           '#9966ff',
  MIXED:               '#888',
}

const PATTERN_LABEL = {
  WEEKEND_HEAVY:       { en: 'WEEKEND HEAVY',       tr: 'HAFTA SONU AĞIR' },
  MIDWEEK_HEAVY:       { en: 'MIDWEEK HEAVY',       tr: 'HAFTA ORTASI AĞIR' },
  EVENLY_DISTRIBUTED:  { en: 'EVENLY DISTRIBUTED',  tr: 'DENGELİ' },
  POLARIZED:           { en: 'POLARIZED',           tr: 'POLARİZE' },
  MIXED:               { en: 'MIXED',               tr: 'KARIŞIK' },
}

const PATTERN_HINT = {
  WEEKEND_HEAVY: {
    en: 'Long sessions stacked on weekends — typical for working athletes. Watch Monday recovery.',
    tr: 'Uzun seanslar hafta sonuna yığılmış — çalışan sporcular için tipik. Pazartesi toparlanmasını izle.',
  },
  MIDWEEK_HEAVY: {
    en: "Quality work mid-week — hard sessions land Wed-Thu. Plan easy Mon and Fri.",
    tr: "Kaliteli iş hafta ortasında — sert seanslar Çar-Per'de. Pazartesi ve Cuma kolay planla.",
  },
  EVENLY_DISTRIBUTED: {
    en: 'Steady microcycle — load spread across the week. Good for accumulation phases.',
    tr: 'Düzenli mikrosiklus — yük haftaya yayılmış. Birikim fazları için iyi.',
  },
  POLARIZED: {
    en: 'Hard-easy rhythm — clear training stress with intentional rest days.',
    tr: 'Sert-kolay ritmi — net antrenman stresi ve bilinçli dinlenme günleri.',
  },
  MIXED: {
    en: 'No dominant pattern — week-to-week variability is high.',
    tr: 'Baskın bir desen yok — haftalar arası değişkenlik yüksek.',
  },
}

// ─── Chart constants ────────────────────────────────────────────────────────
const SVG_W = 224
const SVG_H = 64
const PAD_X = 4
const BAR_GAP = 4
// 7 bars across (SVG_W - 2*PAD_X) with BAR_GAP between → barW = (216 - 6*4) / 7
const BAR_W = Math.floor(((SVG_W - 2 * PAD_X) - BAR_GAP * 6) / 7)
const CHART_H = SVG_H

function AverageWeekShapeCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzeAverageWeekShape({ log }), [log])

  if (!result) return null

  const { pattern, days, peakDay, restDay, citation } = result
  const accent = PATTERN_COLOR[pattern] || PATTERN_COLOR.MIXED
  const patternLbl = PATTERN_LABEL[pattern]?.[isTR ? 'tr' : 'en'] || pattern
  const hint = PATTERN_HINT[pattern]?.[isTR ? 'tr' : 'en'] || ''

  const title = isTR ? 'TİPİK HAFTA · 8H' : 'TYPICAL WEEK · 8W'

  const maxAvg = Math.max(...days.map(d => d.avgTss), 1)

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Tipik hafta şekli' : 'Typical week shape'}
      data-average-week-shape-card
      data-week-shape-pattern={pattern}
      data-peak-day={peakDay.dayIndex}
      data-rest-day={restDay.dayIndex}
      style={{ ...S.card, borderLeft: `4px solid ${accent}`, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* Pattern badge */}
      <div style={{
        display: 'inline-block',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '11px',
        fontWeight: 700,
        color: '#fff',
        background: accent,
        padding: '4px 10px',
        borderRadius: '3px',
        letterSpacing: '0.08em',
        marginBottom: '12px',
      }}>
        {patternLbl}
      </div>

      {/* 7-bar mini chart */}
      <div style={{ marginBottom: '10px' }}>
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          aria-label={isTR ? 'Haftalık TSS dağılımı' : 'Weekly TSS distribution'}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {days.map((d, i) => {
            const ratio = maxAvg > 0 ? d.avgTss / maxAvg : 0
            const barH = Math.max(2, Math.round(ratio * (CHART_H - 4)))
            const x = PAD_X + i * (BAR_W + BAR_GAP)
            const y = CHART_H - barH
            const isPeak = d.dayIndex === peakDay.dayIndex && d.avgTss > 0
            return (
              <rect
                key={d.dayIndex}
                data-day-bar
                data-day-index={d.dayIndex}
                data-day-avg-tss={d.avgTss}
                x={x}
                y={y}
                width={BAR_W}
                height={barH}
                fill={isPeak ? accent : `${accent}66`}
                stroke={isPeak ? accent : 'none'}
                strokeWidth={isPeak ? 1 : 0}
                rx={1}
              />
            )
          })}
        </svg>
        {/* Day labels under bars */}
        <div style={{
          display: 'flex',
          width: SVG_W,
          paddingLeft: PAD_X,
          marginTop: '4px',
        }}>
          {days.map((d, i) => (
            <div
              key={d.dayIndex}
              style={{
                width: BAR_W,
                marginRight: i < 6 ? BAR_GAP : 0,
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '9px',
                fontWeight: 600,
                color: d.dayIndex === peakDay.dayIndex ? accent : 'var(--muted)',
                letterSpacing: '0.04em',
                textAlign: 'center',
              }}
            >
              {isTR ? d.dayLabelTr : d.dayLabelEn}
            </div>
          ))}
        </div>
      </div>

      {/* Interpretation hint */}
      {hint ? (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.55,
          paddingLeft: '8px',
          borderLeft: `2px solid ${accent}`,
          marginBottom: '8px',
        }}>
          {hint}
        </div>
      ) : null}

      {/* Citation */}
      <div style={{
        ...S.mono,
        fontSize: '9px',
        color: '#555',
        marginTop: '4px',
        letterSpacing: '0.04em',
      }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(AverageWeekShapeCard)
