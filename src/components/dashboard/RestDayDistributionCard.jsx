// ─── dashboard/RestDayDistributionCard.jsx — Rest day placement tracker ────
// Surfaces analyzeRestDayDistribution(): where in the 28-day microcycle the
// athlete's rest days fall, and whether they follow hard sessions (classic
// hard-easy structure — Bompa 2018) or are scattered randomly (monotony risk
// — Foster 2001). Mono terminal aesthetic.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeRestDayDistribution } from '../../lib/athlete/restDayDistribution.js'

// ─── Palette ────────────────────────────────────────────────────────────────
const PATTERN_COLOR = {
  WELL_PLACED:  '#5bc25b',
  MIXED:        '#0064ff',
  TOO_FEW_REST: '#ff6600',
}

const PATTERN_LABEL = {
  WELL_PLACED:  { en: 'WELL PLACED', tr: 'İYİ YERLEŞMİŞ' },
  MIXED:        { en: 'MIXED',       tr: 'KARIŞIK' },
  TOO_FEW_REST: { en: 'TOO FEW',     tr: 'AZ DİNLENME' },
}

const PATTERN_HINT = {
  WELL_PLACED: {
    en: 'Rest days frequently follow hard days — classic hard-easy structure. Adaptation lands here.',
    tr: 'Dinlenme günleri sıklıkla sert günleri izliyor — klasik sert-kolay yapı. Adaptasyon burada karşılığını verir.',
  },
  MIXED: {
    en: 'Enough rest, but scattered. Try to place rest days right AFTER hard sessions for cleaner recovery.',
    tr: 'Yeterli dinlenme var ama dağınık. Daha temiz toparlanma için dinlenme günlerini sert seansların HEMEN ardına yerleştir.',
  },
  TOO_FEW_REST: {
    en: 'Fewer than 1 rest day per week. Risk accumulates without recovery — add 1-2 zero-load days.',
    tr: "Haftada 1'den az dinlenme. Toparlanma olmadan risk birikir — 1-2 sıfır-yük günü ekle.",
  },
}

function RestDayDistributionCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzeRestDayDistribution({ log }), [log])

  if (!result) return null

  const {
    pattern,
    restDayCount,
    hardDayCount,
    postHardRestCount,
    postHardRestRate,
    citation,
  } = result

  const accent = PATTERN_COLOR[pattern] || PATTERN_COLOR.MIXED
  const patternLbl = PATTERN_LABEL[pattern]?.[isTR ? 'tr' : 'en'] || pattern
  const hint = PATTERN_HINT[pattern]?.[isTR ? 'tr' : 'en'] || ''

  const title = isTR
    ? 'DİNLENME GÜNÜ YERLEŞİMİ · 28G'
    : 'REST DAY PLACEMENT · 28D'

  const ratePct = Math.round(postHardRestRate * 100)

  // Bilingual phrases
  const restDaysLine = isTR
    ? `${restDayCount} dinlenme günü / 28g`
    : `${restDayCount} rest days / 28d`
  const rateLine = isTR
    ? `Sert günlerin %${ratePct}'i dinlenme ile takip edildi`
    : `${ratePct}% of hard days followed by rest`
  const breakdownLine = isTR
    ? `${hardDayCount} sert · ${postHardRestCount} sert→dinlenme`
    : `${hardDayCount} hard · ${postHardRestCount} hard→rest`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Dinlenme günü yerleşimi' : 'Rest day placement'}
      data-rest-day-distribution-card
      data-rest-pattern={pattern}
      data-rest-day-count={restDayCount}
      data-hard-day-count={hardDayCount}
      data-post-hard-rest-count={postHardRestCount}
      data-post-hard-rest-rate={postHardRestRate}
      style={{ ...S.card, borderLeft: `4px solid ${accent}`, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* Big rest-day count */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '34px',
        fontWeight: 700,
        color: accent,
        lineHeight: 1,
        marginBottom: '4px',
        letterSpacing: '-0.02em',
      }}>
        {restDayCount}
      </div>
      <div style={{
        ...S.mono,
        fontSize: '11px',
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        marginBottom: '12px',
      }}>
        {restDaysLine}
      </div>

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

      {/* post-hard rest rate line */}
      <div style={{
        ...S.mono,
        fontSize: '12px',
        color: 'var(--text)',
        marginBottom: '4px',
        fontWeight: 600,
      }}>
        {rateLine}
      </div>

      {/* breakdown */}
      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        marginBottom: '12px',
      }}>
        {breakdownLine}
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

      {/* Citation footer */}
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

export default memo(RestDayDistributionCard)
