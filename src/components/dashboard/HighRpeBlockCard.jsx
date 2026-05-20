// ─── dashboard/HighRpeBlockCard.jsx — 60d Consecutive-High-RPE Block Card ───
// Surfaces analyzeHighRpeBlock(): counts maximal consecutive-high-RPE runs of
// ≥3 days in the trailing 60 days. Three or more high-RPE days back-to-back
// approach unintended overreaching (Foster 2001; Halson 2014).
//
// Distinct from RpeStability (rpe variability within type) and HardDaySpacing
// (mean spacing between hard sessions). This card targets clustering.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeHighRpeBlock } from '../../lib/athlete/highRpeBlock.js'

const BAND_COLOR = {
  CLEAN:            '#5bc25b',
  OCCASIONAL_BLOCK: '#f5c542',
  REPEAT_BLOCKS:    '#ff6600',
  CHRONIC_STRAIN:   '#e03030',
}

const BAND_LABEL = {
  CLEAN:            { en: 'CLEAN',            tr: 'TEMİZ' },
  OCCASIONAL_BLOCK: { en: 'OCCASIONAL BLOCK', tr: 'ARA SIRA BLOK' },
  REPEAT_BLOCKS:    { en: 'REPEAT BLOCKS',    tr: 'TEKRAR EDEN BLOK' },
  CHRONIC_STRAIN:   { en: 'CHRONIC STRAIN',   tr: 'KRONİK YÜK' },
}

const BAND_MSG = {
  CLEAN: {
    en: 'No back-to-back high-RPE blocks — recovery cadence looks healthy.',
    tr: 'Üst üste yüksek-efor bloğu yok — toparlanma ritmi sağlıklı.',
  },
  OCCASIONAL_BLOCK: {
    en: 'One block of consecutive high-RPE days — fine if followed by deload.',
    tr: 'Bir tek üst üste yüksek-efor bloğu — sonrasında deload varsa sorun değil.',
  },
  REPEAT_BLOCKS: {
    en: 'Multiple consecutive high-RPE blocks — schedule deliberate recovery days.',
    tr: 'Birden çok yüksek-efor bloğu — bilinçli toparlanma günleri planla.',
  },
  CHRONIC_STRAIN: {
    en: 'Chronic high-RPE clustering — strong overreaching signal, ease back.',
    tr: 'Kronik yüksek-efor kümelenmesi — aşırı yüklenme sinyali, geri çekil.',
  },
}

const CELL = 6
const GAP  = 1
const STEP = CELL + GAP
const WINDOW_DAYS = 60
const HIGH_THRESHOLD = 8
const MIN_BLOCK_DAYS = 3

const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function compactDate(iso, isTR) {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return iso || ''
  const mo = Number(iso.slice(5, 7)) - 1
  const dd = iso.slice(8, 10)
  if (mo < 0 || mo > 11) return iso
  return isTR ? `${dd} ${MONTH_TR[mo]}` : `${MONTH_EN[mo]} ${dd}`
}

export default function HighRpeBlockCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeHighRpeBlock({
      log,
      today: new Date(),
      windowDays: WINDOW_DAYS,
      highRpeThreshold: HIGH_THRESHOLD,
      minBlockDays: MIN_BLOCK_DAYS,
    }),
    [log]
  )

  // Build a 60-day strip: each day classified as in-block (red), high-but-
  // isolated (orange), or non-high (grey). This hook is unconditional —
  // it must run on every render so hook order stays stable.
  const strip = useMemo(() => {
    if (!result) return []
    const todayIso = new Date().toISOString().slice(0, 10)
    const start = new Date(todayIso + 'T00:00:00Z')
    start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1))

    // Set of in-block ISO dates from result.blocks for O(1) lookup.
    const blockSet = new Set()
    for (const b of (result.blocks || [])) {
      const cur = new Date(b.startDate + 'T00:00:00Z')
      const end = new Date(b.endDate   + 'T00:00:00Z')
      while (cur <= end) {
        blockSet.add(cur.toISOString().slice(0, 10))
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
    }

    // Compute max RPE per date from log directly.
    const dayMax = new Map()
    for (const e of (log || [])) {
      if (!e || !e.date) continue
      const r = Number(e.rpe)
      if (!Number.isFinite(r)) continue
      const iso = String(e.date).slice(0, 10)
      const prev = dayMax.get(iso)
      if (prev === undefined || r > prev) dayMax.set(iso, r)
    }

    const days = []
    const cur = new Date(start)
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const iso = cur.toISOString().slice(0, 10)
      let kind = 'none'
      const isHigh = (dayMax.get(iso) ?? -Infinity) >= HIGH_THRESHOLD
      if (blockSet.has(iso)) kind = 'block'
      else if (isHigh) kind = 'isolated'
      days.push({ iso, kind })
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return days
  }, [log, result])

  if (!result) return null

  const color = BAND_COLOR[result.band] || BAND_COLOR.CLEAN
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en']
    || String(result.band || '').toUpperCase()
  const bandMsg = BAND_MSG[result.band]?.[isTR ? 'tr' : 'en'] || ''

  const SVG_W = WINDOW_DAYS * STEP
  const SVG_H = CELL

  // Up to 3 most-recent blocks for chip rendering.
  const recentBlocks = (result.blocks || []).slice(-3).reverse()

  const ariaLabel = isTR ? 'Yüksek Efor Blokları — 60G' : 'High-RPE Blocks — 60D'

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="high-rpe-block"
      data-high-rpe-block-band={result.band}
      data-high-rpe-block-total={result.totalBlocks}
      data-high-rpe-block-longest={result.longestBlockDays}
      data-high-rpe-block-total-high-days={result.totalHighRpeDays}
      style={{ ...S.card, animationDelay: '260ms', borderLeft: `3px solid ${color}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'YÜKSEK EFOR BLOKLARI — 60G' : 'HIGH-RPE BLOCKS — 60D'}
      </div>

      {/* Headline number ------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '4px 0 8px',
        }}
      >
        <div>
          <div
            data-high-rpe-block-longest={result.longestBlockDays}
            style={{ ...S.mono, fontSize: '24px', fontWeight: 700, color, lineHeight: 1.1 }}
          >
            {result.longestBlockDays}
            <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '4px', color: 'var(--sub)' }}>
              {isTR ? 'gün' : 'd'}
            </span>
          </div>
          <div style={{
            ...S.mono,
            fontSize: '10px',
            color: 'var(--muted)',
            letterSpacing: '0.04em',
            marginTop: '2px',
            textTransform: 'uppercase',
          }}>
            {isTR ? 'en uzun seri' : 'longest streak'}
          </div>
        </div>
        <div
          data-high-rpe-block-band-badge={result.band}
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

      {/* 60-day strip ---------------------------------------------------- */}
      <svg
        width={SVG_W}
        height={SVG_H}
        role="img"
        aria-label={isTR ? '60 gün yüksek-efor şeridi' : '60-day high-RPE strip'}
        data-high-rpe-block-strip
        style={{ display: 'block', marginBottom: '8px' }}
      >
        {strip.map((d, i) => {
          const fill =
            d.kind === 'block'    ? '#e03030' :
            d.kind === 'isolated' ? '#ff6600' :
                                    '#444'
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
              data-strip-kind={d.kind}
            >
              <title>{d.iso}: {d.kind}</title>
            </rect>
          )
        })}
      </svg>

      {/* Stats row ------------------------------------------------------- */}
      <div
        data-high-rpe-block-total={result.totalBlocks}
        data-high-rpe-block-total-high-days={result.totalHighRpeDays}
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
        <span data-high-rpe-block-total-badge={result.totalBlocks}>
          {isTR
            ? `${result.totalBlocks} blok`
            : `${result.totalBlocks} block${result.totalBlocks === 1 ? '' : 's'}`}
        </span>
        <span>
          {isTR
            ? `son 60 günde ${result.totalHighRpeDays} yüksek-efor günü`
            : `${result.totalHighRpeDays} high-RPE days in last 60`}
        </span>
      </div>

      {/* Recent block chips --------------------------------------------- */}
      {recentBlocks.length > 0 ? (
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
            {isTR ? 'SON BLOKLAR' : 'RECENT BLOCKS'}
          </div>
          <div
            role="list"
            aria-label={isTR ? 'Son yüksek-efor blokları' : 'Recent high-RPE blocks'}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}
          >
            {recentBlocks.map(b => (
              <div
                key={`${b.startDate}-${b.endDate}`}
                role="listitem"
                data-block-chip
                data-block-start={b.startDate}
                data-block-end={b.endDate}
                data-block-length={b.lengthDays}
                data-block-peak-rpe={b.peakRpe}
                style={{
                  ...S.mono,
                  fontSize: '10px',
                  color,
                  background: `${color}14`,
                  border: `1px solid ${color}44`,
                  borderRadius: '3px',
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {compactDate(b.startDate, isTR)}–{compactDate(b.endDate, isTR)},{' '}
                {b.lengthDays}{isTR ? 'g' : 'd'},{' '}
                {isTR ? 'tepe' : 'peak'} {b.peakRpe}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Band interpretation -------------------------------------------- */}
      <div
        data-high-rpe-block-interpretation
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

      {/* Citation footer ------------------------------------------------ */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
