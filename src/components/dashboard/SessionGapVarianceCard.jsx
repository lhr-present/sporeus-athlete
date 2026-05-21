// ─── dashboard/SessionGapVarianceCard.jsx — Training-Rhythm Variance (30d) ───
// Surfaces analyzeSessionGapVariance(): standard deviation of inter-session
// gaps across ALL training sessions in the trailing 30 days (Foster 2017;
// Halson 2014). Predictable cadence → durable adaptation; clustered chaos →
// wasted stimulus.
//
// Renders an at-a-glance "days between sessions on average" stat, a small
// histogram of gap-day buckets, and a 30-day strip of train/no-train days.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeSessionGapVariance } from '../../lib/athlete/sessionGapVariance.js'

const BAND_COLORS = {
  METRONOME:              '#5bc25b',
  STEADY:                 '#0064ff',
  CHAOTIC:                '#e03030',
  INSUFFICIENT_SESSIONS:  '#888',
}

const BAND_LABEL = {
  METRONOME:              { en: 'METRONOME',         tr: 'METRONOM' },
  STEADY:                 { en: 'STEADY',            tr: 'DENGELİ' },
  CHAOTIC:                { en: 'CHAOTIC',           tr: 'KAOTİK' },
  INSUFFICIENT_SESSIONS:  { en: 'LOW DATA',          tr: 'AZ VERİ' },
}

const BAND_MSG = {
  METRONOME: {
    en: 'Metronome rhythm — sessions land on a predictable cadence. Foster 2017: this is when adaptation compounds.',
    tr: 'Metronom ritmi — seanslar düzenli bir tempoda. Foster 2017: adaptasyon bu zaman birikir.',
  },
  STEADY: {
    en: 'Steady cadence — some variation, but stimulus is rhythmic enough to drive adaptation.',
    tr: 'Dengeli tempo — biraz değişkenlik var, ama uyaran adaptasyon için yeterince ritmik.',
  },
  CHAOTIC: {
    en: 'Chaotic spacing — clustered sessions then long gaps blunt the training signal. Aim for a steadier weekly cadence.',
    tr: 'Kaotik aralık — kümelenmiş seanslar ve uzun boşluklar uyaranı köreltir. Daha düzenli bir haftalık tempo hedefle.',
  },
  INSUFFICIENT_SESSIONS: {
    en: 'Need at least 6 training days in 30 to read rhythm.',
    tr: 'Ritmi okumak için 30 günde en az 6 antrenman gerekli.',
  },
}

const CELL = 6
const GAP  = 1
const STEP = CELL + GAP

// Bucket the gap (in days) into one of 5 histogram bins: 1, 2, 3, 4, 5+
function bucketGap(g) {
  if (g <= 1) return 0
  if (g === 2) return 1
  if (g === 3) return 2
  if (g === 4) return 3
  return 4
}

const BUCKET_LABELS = ['1', '2', '3', '4', '5+']

export default function SessionGapVarianceCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeSessionGapVariance({ log, today: new Date(), windowDays: 30 }),
    [log]
  )

  // 30-day strip: each day is either a training day or not. Built
  // unconditionally so hook order stays stable.
  const strip = useMemo(() => {
    if (!result) return []
    const todayIso = new Date().toISOString().slice(0, 10)
    const days = []
    const start = new Date(todayIso + 'T00:00:00Z')
    start.setUTCDate(start.getUTCDate() - 29)

    const trainSet = new Set(result.trainingDays || [])

    const cur = new Date(start)
    for (let i = 0; i < 30; i++) {
      const iso = cur.toISOString().slice(0, 10)
      days.push({ iso, train: trainSet.has(iso) })
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return days
  }, [result])

  // Histogram counts per bucket — also unconditional.
  const histogram = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]
    if (!result) return buckets
    for (const g of (result.gaps || [])) {
      buckets[bucketGap(g)]++
    }
    return buckets
  }, [result])

  if (!result) return null

  const color = BAND_COLORS[result.band] || BAND_COLORS.STEADY
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en']
    || String(result.band || '').toUpperCase()
  const bandMsg = BAND_MSG[result.band]?.[isTR ? 'tr' : 'en'] || ''

  const isInsufficient = result.band === 'INSUFFICIENT_SESSIONS'
  const cvPct = Math.round((result.cv || 0) * 100)
  const SVG_W = 30 * STEP
  const SVG_H = CELL

  const ariaLabel = isTR ? 'Antrenman Ritmi — 30G' : 'Training Rhythm — 30D'

  const maxBucket = histogram.reduce((m, v) => Math.max(m, v), 0)

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="session-gap-variance"
      data-session-gap-variance-band={result.band}
      data-session-gap-variance-count={result.sessionCount}
      data-session-gap-variance-mean={result.meanGapDays}
      data-session-gap-variance-std={result.stdGapDays}
      data-session-gap-variance-cv={result.cv}
      style={{ ...S.card, animationDelay: '250ms', borderLeft: `3px solid ${color}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'ANTRENMAN RİTMİ — 30G' : 'TRAINING RHYTHM — 30D'}
      </div>

      {/* Headline stat + band badge ------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '4px 0 8px',
        }}
      >
        <div
          data-session-gap-variance-mean-display={result.meanGapDays}
          style={{
            ...S.mono,
            fontSize: '24px',
            fontWeight: 700,
            color,
            lineHeight: 1.1,
          }}
        >
          {isInsufficient ? '—' : result.meanGapDays.toFixed(2)}
          <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '6px', color: 'var(--sub)' }}>
            {isTR ? 'gün arası ort.' : 'days avg gap'}
          </span>
        </div>
        <div
          data-session-gap-variance-band-badge={result.band}
          style={{
            ...S.mono,
            fontSize: '10px',
            fontWeight: 700,
            color,
            background: `${color}18`,
            border: `1px solid ${color}55`,
            borderRadius: '3px',
            padding: '3px 8px',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {bandLbl}
        </div>
      </div>

      {/* Insufficient-data state ----------------------------------------- */}
      {isInsufficient ? (
        <div
          data-session-gap-variance-insufficient
          style={{
            ...S.mono,
            fontSize: '11px',
            color: 'var(--text)',
            lineHeight: 1.6,
            paddingLeft: '8px',
            borderLeft: `2px solid ${color}`,
            marginBottom: '6px',
          }}
        >
          {isTR
            ? `${result.sessionCount} antrenman günü kayıtlı (en az 6 gerekli).`
            : `${result.sessionCount} training day${result.sessionCount === 1 ? '' : 's'} logged (need at least 6).`}
        </div>
      ) : (
        <>
          {/* Stats row -------------------------------------------------- */}
          <div
            data-session-gap-variance-stats
            style={{
              ...S.mono,
              fontSize: '11px',
              color: 'var(--sub)',
              marginBottom: '8px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span>
              {isTR
                ? `${result.sessionCount} antrenman`
                : `${result.sessionCount} session${result.sessionCount === 1 ? '' : 's'}`}
            </span>
            <span>
              {isTR
                ? `std ${result.stdGapDays.toFixed(2)}g`
                : `std ${result.stdGapDays.toFixed(2)}d`}
            </span>
            <span data-session-gap-variance-cv-display={cvPct}>
              {isTR ? `VK %${cvPct}` : `CV ${cvPct}%`}
            </span>
          </div>

          {/* Histogram of gap days ------------------------------------- */}
          <div style={{ marginBottom: '8px' }}>
            <div
              style={{
                ...S.mono,
                fontSize: '10px',
                color: 'var(--muted)',
                marginBottom: '4px',
                letterSpacing: '0.04em',
              }}
            >
              {isTR ? 'SEANS ARASI DAĞILIM' : 'GAP DISTRIBUTION'}
            </div>
            <div
              data-session-gap-variance-histogram
              role="list"
              aria-label={isTR ? 'Seans aralığı histogramı' : 'Session gap histogram'}
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '4px',
                height: '36px',
              }}
            >
              {histogram.map((count, i) => {
                const h = maxBucket > 0 ? Math.round((count / maxBucket) * 28) + 2 : 2
                return (
                  <div
                    key={BUCKET_LABELS[i]}
                    role="listitem"
                    data-gap-bucket={BUCKET_LABELS[i]}
                    data-gap-bucket-count={count}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${h}px`,
                        background: count > 0 ? color : '#444',
                        borderRadius: '2px',
                        opacity: count > 0 ? 1 : 0.4,
                      }}
                    >
                      <title>
                        {BUCKET_LABELS[i]}
                        {isTR ? ' gün: ' : ' day: '}
                        {count}
                      </title>
                    </div>
                    <div
                      style={{
                        ...S.mono,
                        fontSize: '9px',
                        color: 'var(--muted)',
                      }}
                    >
                      {BUCKET_LABELS[i]}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* 30-day training-day strip ------------------------------------- */}
      <svg
        width={SVG_W}
        height={SVG_H}
        role="img"
        aria-label={isTR ? '30 gün antrenman şeridi' : '30-day training strip'}
        data-session-gap-variance-strip
        style={{ display: 'block', marginBottom: '8px' }}
      >
        {strip.map((d, i) => {
          const fill = d.train ? color : '#444'
          return (
            <rect
              key={d.iso}
              x={i * STEP}
              y={0}
              width={CELL}
              height={CELL}
              rx={1}
              ry={1}
              fill={fill}
              data-strip-kind={d.train ? 'train' : 'rest'}
              data-strip-date={d.iso}
            >
              <title>{d.iso}: {d.train ? (isTR ? 'antrenman' : 'training') : (isTR ? 'dinlenme' : 'rest')}</title>
            </rect>
          )
        })}
      </svg>

      {/* Band interpretation ------------------------------------------ */}
      <div
        data-session-gap-variance-interpretation
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${color}`,
          marginBottom: '6px',
        }}
      >
        {bandMsg}
      </div>

      {/* Citation footer --------------------------------------------- */}
      <div
        data-session-gap-variance-citation
        style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}
      >
        {result.citation}
      </div>
    </div>
  )
}
