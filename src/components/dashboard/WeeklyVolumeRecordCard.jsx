// ─── WeeklyVolumeRecordCard.jsx — All-time peak weekly TSS + current rank ────
// Surfaces analyzeWeeklyVolumeRecord(): the athlete's lifetime peak weekly
// TSS and where THIS week ranks against their historical weekly-TSS
// distribution. Celebratory/contextual companion to WeeklyVolumeRampCard
// (which polices week-over-week injury safety).
//
// Bands: NEW_RECORD, TOP_5, TOP_20_PERCENT, TYPICAL, LOW.
// Bilingual EN/TR via LangCtx.
// Cite: Hellard 2019; Issurin 2010.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeWeeklyVolumeRecord } from '../../lib/athlete/weeklyVolumeRecord.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  NEW_RECORD:     '#ff6600',
  TOP_5:          '#5bc25b',
  TOP_20_PERCENT: '#0064ff',
  TYPICAL:        '#888',
  LOW:            '#555',
}

const BAND_LABEL = {
  NEW_RECORD:     { en: 'NEW RECORD',  tr: 'YENİ REKOR' },
  TOP_5:          { en: 'TOP 5',       tr: 'İLK 5' },
  TOP_20_PERCENT: { en: 'TOP 20%',     tr: 'İLK %20' },
  TYPICAL:        { en: 'TYPICAL',     tr: 'OLAĞAN' },
  LOW:            { en: 'LOW',         tr: 'DÜŞÜK' },
}

const BAND_HINT = {
  NEW_RECORD: {
    en: 'All-time biggest week — make sure recovery scales accordingly.',
    tr: 'Tüm zamanların en büyük haftası — toparlanmanın da buna göre artmasını sağla.',
  },
  TOP_5: {
    en: 'One of your biggest weeks ever — keep the next 2 weeks deliberately easier.',
    tr: 'Şimdiye kadarki en büyük haftalarından biri — önümüzdeki 2 haftayı bilinçli olarak hafiflet.',
  },
  TOP_20_PERCENT: {
    en: 'Top-quintile training week — significant load above your norm.',
    tr: "En üst %20'lik antrenman haftası — normalinin oldukça üstünde yük.",
  },
  TYPICAL: {
    en: 'Middle of your historical range — predictable load.',
    tr: 'Geçmiş aralığının ortasında — öngörülebilir yük.',
  },
  LOW: {
    en: 'Lower than your typical week. Could be deload, illness, or schedule constraint.',
    tr: 'Normal haftandan düşük. Azaltma, hastalık ya da program sınırlaması olabilir.',
  },
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

// Format a number as a tidy TSS integer (1 decimal only when fractional).
function fmtTss(v) {
  if (!Number.isFinite(v)) return '0'
  if (Math.abs(v - Math.round(v)) < 0.05) return String(Math.round(v))
  return v.toFixed(1)
}

// Ordinal suffix for English percentile display.
function ordinalEn(n) {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

function WeeklyVolumeRecordCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeWeeklyVolumeRecord({ log, today: todayIso() }),
    [log]
  )

  if (!result) return null

  const {
    band,
    peakWeekTss,
    peakWeekStart,
    currentWeekTss,
    currentRank,
    currentPercentile,
    totalCompletedWeeks,
    citation,
  } = result

  const accent     = BAND_COLOR[band] || BAND_COLOR.TYPICAL
  const bandLbl    = BAND_LABEL[band]?.[isTR ? 'tr' : 'en'] || band
  const hint       = BAND_HINT[band]?.[isTR ? 'tr' : 'en'] || ''

  const title      = isTR ? 'HAFTALIK HACİM · REKOR' : 'WEEKLY VOLUME · RECORD'
  const ariaLabel  = isTR
    ? 'Haftalık hacim rekoru ve sıralama'
    : 'Weekly volume record and rank'

  const tssThisWeek = isTR ? 'TSS bu hafta' : 'TSS this week'
  const peakLabel   = isTR
    ? `Tüm zamanların zirvesi: ${fmtTss(peakWeekTss)} · ${peakWeekStart}`
    : `All-time peak: ${fmtTss(peakWeekTss)} · ${peakWeekStart}`
  const rankLabel   = isTR
    ? `${totalCompletedWeeks} tamamlanmış hafta içinde #${currentRank}`
    : `rank #${currentRank} of ${totalCompletedWeeks} completed weeks`
  const pctLabel    = isTR
    ? `%${currentPercentile} yüzdelik`
    : `${ordinalEn(currentPercentile)} percentile`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-weekly-volume-record-card
      data-record-band={band}
      data-current-week-tss={currentWeekTss}
      data-peak-week-tss={peakWeekTss}
      data-current-rank={currentRank}
      data-current-percentile={currentPercentile}
      data-total-completed-weeks={totalCompletedWeeks}
      style={{
        ...S.card,
        borderLeft: `4px solid ${accent}`,
        padding: '20px',
        fontFamily: MONO,
      }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* Big current-week TSS + band badge */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: '10px',
      }}>
        <div
          data-current-week-tss-value
          style={{
            fontFamily: MONO,
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1,
            color: accent,
          }}
        >
          {fmtTss(currentWeekTss)}
        </div>
        <div style={{
          fontFamily: MONO,
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
        }}>
          {tssThisWeek}
        </div>
        <div
          data-record-band-label
          style={{
            display: 'inline-block',
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            background: accent,
            padding: '4px 10px',
            borderRadius: 3,
            letterSpacing: '0.08em',
            marginLeft: 'auto',
          }}
        >
          {bandLbl}
        </div>
      </div>

      {/* Peak reference */}
      <div
        data-peak-reference
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--sub)',
          marginBottom: 4,
          letterSpacing: '0.02em',
        }}
      >
        {peakLabel}
      </div>

      {/* Rank + percentile */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 10,
      }}>
        <div
          data-rank-display
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          {rankLabel}
        </div>
        <div
          data-percentile-display
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          {pctLabel}
        </div>
      </div>

      {/* Interpretation hint */}
      {hint ? (
        <div style={{
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--text)',
          lineHeight: 1.55,
          paddingLeft: 8,
          borderLeft: `2px solid ${accent}`,
          marginBottom: 8,
        }}>
          {hint}
        </div>
      ) : null}

      {/* Citation */}
      <div style={{
        fontFamily: MONO,
        fontSize: 9,
        color: '#555',
        marginTop: 4,
        letterSpacing: '0.04em',
      }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(WeeklyVolumeRecordCard)
