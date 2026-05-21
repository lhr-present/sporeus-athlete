// ─── MaxTssDayPersonalRecordCard.jsx — Peak single-day TSS vs lifetime ──────
// Surfaces analyzeMaxTssDayPersonalRecord(): biggest single-day TSS in the
// last 90 days, ranked against the athlete's lifetime distribution of daily
// TSS totals.
//
// Distinct from WeeklyVolumeRecordCard (weekly grain) and PeakWeekFrequencyCard
// (block grain). This card targets the SINGLE-DAY extreme — Issurin 2010 +
// Daniels 2014 both treat single-day peak intensity as separable from peak
// weekly volume.
//
// Bands: NEW_RECORD, TOP_5, TOP_20_PERCENT, TYPICAL, BELOW_TYPICAL,
//        INSUFFICIENT_HISTORY.
// Bilingual EN/TR via LangCtx.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeMaxTssDayPersonalRecord } from '../../lib/athlete/maxTssDayPersonalRecord.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  NEW_RECORD:           '#ff6600',
  TOP_5:                '#5bc25b',
  TOP_20_PERCENT:       '#0064ff',
  TYPICAL:              '#888888',
  BELOW_TYPICAL:        '#555555',
  INSUFFICIENT_HISTORY: '#888888',
}

const BAND_LABEL_EN = {
  NEW_RECORD:           'NEW RECORD',
  TOP_5:                'TOP 5',
  TOP_20_PERCENT:       'TOP 20%',
  TYPICAL:              'TYPICAL',
  BELOW_TYPICAL:        'BELOW TYPICAL',
  INSUFFICIENT_HISTORY: 'BUILDING HISTORY',
}
const BAND_LABEL_TR = {
  NEW_RECORD:           'YENİ REKOR',
  TOP_5:                'İLK 5',
  TOP_20_PERCENT:       'İLK %20',
  TYPICAL:              'OLAĞAN',
  BELOW_TYPICAL:        'OLAĞAN ALTI',
  INSUFFICIENT_HISTORY: 'GEÇMİŞ OLUŞUYOR',
}

const HINT_EN = {
  NEW_RECORD:
    'Biggest single-day TSS ever recorded. Make sure the next 48–72h are recovery-weighted.',
  TOP_5:
    'One of your top-5 single-day loads. Avoid stacking another high-TSS day immediately after.',
  TOP_20_PERCENT:
    'Top-quintile single-day load — well above your daily norm. Watch acute fatigue.',
  TYPICAL:
    'A typical hard day for you — within the middle of your historical daily range.',
  BELOW_TYPICAL:
    'Your hardest recent day is on the easier side of your history. Room to push if context allows.',
  INSUFFICIENT_HISTORY:
    'Not enough lifetime daily history yet to rank this peak. Keep logging.',
}
const HINT_TR = {
  NEW_RECORD:
    'Şimdiye kadarki en yüksek tek günlük TSS. Sonraki 48–72 saatin toparlanmaya ağırlık vermesini sağla.',
  TOP_5:
    'İlk-5 tek günlük yükünden biri. Hemen ardından bir başka yüksek TSS gününü üst üste yığma.',
  TOP_20_PERCENT:
    "En üst %20'lik tek günlük yük — günlük normalinin oldukça üstünde. Akut yorgunluğu izle.",
  TYPICAL:
    'Senin için tipik bir zor gün — geçmiş günlük aralığının ortasında.',
  BELOW_TYPICAL:
    'Son dönemdeki en zor günün, geçmişine göre daha hafif tarafta. Koşullar uygunsa daha fazla zorlayabilirsin.',
  INSUFFICIENT_HISTORY:
    'Bu zirveyi sıralamak için yeterli günlük geçmiş yok. Kayıt tutmaya devam et.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function fmtTss(v) {
  if (!Number.isFinite(v)) return '0'
  if (Math.abs(v - Math.round(v)) < 0.05) return String(Math.round(v))
  return v.toFixed(1)
}

// Ordinal suffix for English rank display ("3rd ever").
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

export default function MaxTssDayPersonalRecordCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeMaxTssDayPersonalRecord({ log, today: todayIso() }),
    [log]
  )

  if (!result) return null

  const {
    band,
    recentPeakTss,
    recentPeakDate,
    lifetimePeakTss,
    lifetimePeakDate,
    recentRank,
    recentPercentile,
    totalHistoricalDays,
    citation,
  } = result

  const accent    = BAND_COLOR[band] || BAND_COLOR.TYPICAL
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint      = isTR ? HINT_TR[band] : HINT_EN[band]

  const title     = isTR ? 'EN YÜKSEK GÜNLÜK TSS' : 'PEAK SINGLE-DAY TSS'
  const ariaLabel = isTR
    ? 'En yüksek tek günlük TSS ve yaşam boyu sıralama'
    : 'Peak single-day TSS and lifetime ranking'

  const isInsufficient = band === 'INSUFFICIENT_HISTORY'

  const recentLabel = isTR ? 'son 90 gün' : 'last 90 days'

  const peakRefLabel = isTR
    ? `Yaşam boyu zirve: ${fmtTss(lifetimePeakTss)} TSS · ${lifetimePeakDate || '—'}`
    : `Lifetime peak: ${fmtTss(lifetimePeakTss)} TSS · ${lifetimePeakDate || '—'}`

  const rankLabel = isTR
    ? `${totalHistoricalDays} günlük geçmiş içinde #${recentRank}`
    : `rank ${ordinalEn(recentRank)} of ${totalHistoricalDays} historical days`

  const pctLabel = isTR
    ? `%${recentPercentile} yüzdelik`
    : `${ordinalEn(recentPercentile)} percentile`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="max-tss-day-personal-record"
      data-max-tss-day-personal-record-card
      data-band={band}
      data-recent-peak-tss={recentPeakTss}
      data-recent-peak-date={recentPeakDate}
      data-lifetime-peak-tss={lifetimePeakTss}
      data-lifetime-peak-date={lifetimePeakDate}
      data-recent-rank={recentRank}
      data-recent-percentile={recentPercentile}
      data-total-historical-days={totalHistoricalDays}
      style={{
        ...S.card,
        borderLeft: `4px solid ${accent}`,
        padding: '20px',
        fontFamily: MONO,
      }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* Big recent-peak TSS + band badge */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: '8px',
      }}>
        <div
          data-recent-peak-tss-value
          style={{
            fontFamily: MONO,
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1,
            color: accent,
          }}
        >
          {fmtTss(recentPeakTss)}
        </div>
        <div style={{
          fontFamily: MONO,
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
        }}>
          {recentPeakDate
            ? `TSS · ${recentPeakDate} · ${recentLabel}`
            : `TSS · ${recentLabel}`}
        </div>
        <div
          data-band-label
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
          {bandLabel}
        </div>
      </div>

      {/* Lifetime peak comparison + rank — only when we have history */}
      {!isInsufficient ? (
        <>
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
            {peakRefLabel}
          </div>

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
        </>
      ) : null}

      {/* Interpretation hint */}
      {hint ? (
        <div
          data-band-hint
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'var(--text)',
            lineHeight: 1.55,
            paddingLeft: 8,
            borderLeft: `2px solid ${accent}`,
            marginBottom: 8,
          }}
        >
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
