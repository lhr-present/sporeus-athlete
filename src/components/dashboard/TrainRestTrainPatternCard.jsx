// ─── dashboard/TrainRestTrainPatternCard.jsx ────────────────────────────────
// Surfaces analyzeTrainRestTrainPattern(): the fraction of rest days that are
// ISOLATED (single-day rest sandwiched between training on both sides) vs
// EXTENDED (≥ 2 consecutive rest days) across the trailing 12 ISO weeks.
//
// Issurin 2010 + Bompa 2018: a single isolated rest day delivers minimal
// supercompensation. Extended rest blocks (≥2 consecutive days) are what
// actually drive adaptation. A calendar dominated by isolated rest days looks
// "well-rested" on the surface but leaks adaptive return.
//
// Strip legend (12 weeks × 7 days = 84 days):
//   active        → blue   (#0064ff)
//   isolated rest → orange (#ff6600)
//   extended rest → green  (#5bc25b)
//   edge length-1 rest (unclassified) → grey (#444)
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeTrainRestTrainPattern } from '../../lib/athlete/trainRestTrainPattern.js'

const BAND_COLORS = {
  EXTENDED_REST_DOMINANT:  '#5bc25b',
  BALANCED:                '#f5c542',
  ISOLATED_REST_DOMINANT:  '#e03030',
  INSUFFICIENT_REST_DAYS:  '#888888',
}

const BAND_LABEL = {
  EXTENDED_REST_DOMINANT: { en: 'EXTENDED REST DOMINANT', tr: 'UZUN DİNLENME BASKIN' },
  BALANCED:               { en: 'BALANCED',               tr: 'DENGELİ' },
  ISOLATED_REST_DOMINANT: { en: 'ISOLATED REST DOMINANT', tr: 'TEK GÜN DİNLENME BASKIN' },
  INSUFFICIENT_REST_DAYS: { en: 'INSUFFICIENT REST',      tr: 'YETERSİZ DİNLENME' },
}

const BAND_MSG = {
  EXTENDED_REST_DOMINANT: {
    en: 'Rest comes in real blocks — supercompensation has time to happen.',
    tr: 'Dinlenme gerçek bloklar halinde — süperkompansasyon için zaman var.',
  },
  BALANCED: {
    en: 'Mixed pattern — some isolated rest, some real recovery blocks.',
    tr: 'Karışık desen — bazı tek günlük, bazı gerçek toparlanma blokları.',
  },
  ISOLATED_REST_DOMINANT: {
    en: 'Most rest days are single sandwiches — minimal adaptation return.',
    tr: 'Dinlenme günlerinin çoğu tek gün — adaptasyon kazancı düşük.',
  },
  INSUFFICIENT_REST_DAYS: {
    en: 'Too few rest days in window to characterize a pattern.',
    tr: 'Desen için pencerede yeterince dinlenme günü yok.',
  },
}

const CELL = 6
const GAP = 1
const STEP = CELL + GAP
const WINDOW_WEEKS = 12
const STRIP_DAYS = WINDOW_WEEKS * 7  // 84

// UTC date helpers — local copies to keep card pure (no shared util import).
function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}
function isoAddDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isActive(e) {
  if (!e || typeof e !== 'object') return false
  const tss = Number(e.tss)
  if (Number.isFinite(tss) && tss > 0) return true
  const dur = Number(e.duration_min ?? e.durationMin ?? e.duration)
  if (Number.isFinite(dur) && dur > 0) return true
  const dist = Number(e.distance_km ?? e.distanceKm ?? e.distance)
  if (Number.isFinite(dist) && dist > 0) return true
  return false
}

export default function TrainRestTrainPatternCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeTrainRestTrainPattern({
      log,
      today: new Date(),
      windowWeeks: WINDOW_WEEKS,
    }),
    [log]
  )

  // Build the 84-day strip. Hook is unconditional to keep order stable.
  // Strip span: from the Monday of (currentMonday - 11 weeks) for 84 days
  // (12 ISO weeks × 7 days). This may extend past today; days beyond today
  // are rendered grey (out-of-window future) so the grid stays 12×7.
  const strip = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const currentMonday = isoMondayOf(todayIso)
    const stripStart = isoAddDays(currentMonday, -(WINDOW_WEEKS - 1) * 7)

    const activeSet = new Set()
    for (const e of (log || [])) {
      if (!e || !e.date) continue
      const key = String(e.date).slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
      if (isActive(e)) activeSet.add(key)
    }

    // First pass: build active/rest array for the strip.
    const cells = []
    for (let i = 0; i < STRIP_DAYS; i++) {
      const iso = isoAddDays(stripStart, i)
      const inWindow = iso <= todayIso
      cells.push({
        iso,
        inWindow,
        active: inWindow && activeSet.has(iso),
      })
    }

    // Second pass: walk REST runs that fall fully inside the analyzed
    // window (iso <= todayIso) and tag each cell as isolated / extended /
    // edge-unclassified, mirroring analyzer logic.
    let runStart = -1
    const lastInWindow = cells.findIndex(c => !c.inWindow) === -1
      ? cells.length - 1
      : cells.findIndex(c => !c.inWindow) - 1

    const setKind = (s, e, kind) => {
      for (let i = s; i <= e; i++) cells[i].kind = kind
    }

    for (let i = 0; i <= lastInWindow; i++) {
      const c = cells[i]
      const isRest = !c.active
      if (isRest && runStart === -1) runStart = i
      const atEnd = i === lastInWindow
      const closes = isRest && (atEnd || cells[i + 1].active)
      if (closes) {
        const len = i - runStart + 1
        if (len === 1) {
          const isLeading = runStart === 0
          const isTrailing = i === lastInWindow
          if (!isLeading && !isTrailing &&
              cells[runStart - 1].active && cells[runStart + 1].active) {
            setKind(runStart, i, 'isolated')
          } else {
            setKind(runStart, i, 'edge-rest')
          }
        } else {
          setKind(runStart, i, 'extended')
        }
        runStart = -1
      }
    }

    // Active and future cells get their own kinds.
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      if (!c.inWindow) c.kind = 'future'
      else if (c.active) c.kind = 'active'
      else if (!c.kind) c.kind = 'edge-rest'
    }

    return cells
  }, [log])

  if (!result) return null

  const color = BAND_COLORS[result.band] || BAND_COLORS.BALANCED
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en']
    || String(result.band || '').toUpperCase()
  const bandMsg = BAND_MSG[result.band]?.[isTR ? 'tr' : 'en'] || ''

  const sharePct = Math.round((result.isolatedShare || 0) * 100)

  const SVG_W = STRIP_DAYS * STEP
  const SVG_H = CELL

  const ariaLabel = isTR
    ? 'Dinlenme Deseni — 12H'
    : 'Rest Pattern — 12W'

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="train-rest-train-pattern"
      data-trtp-band={result.band}
      data-trtp-isolated-rest-days={result.isolatedRestDays}
      data-trtp-extended-rest-blocks={result.extendedRestBlocks}
      data-trtp-extended-rest-days-total={result.extendedRestDaysTotal}
      data-trtp-total-rest-days={result.totalRestDays}
      data-trtp-isolated-share={result.isolatedShare}
      data-trtp-longest-rest-block-days={result.longestRestBlockDays}
      style={{ ...S.card, animationDelay: '250ms', borderLeft: `3px solid ${color}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'DİNLENME DESENİ — 12H' : 'REST PATTERN — 12W'}
      </div>

      {/* Headline stats ----------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '4px 0 8px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <div style={{ ...S.mono, fontSize: '24px', fontWeight: 700, color, lineHeight: 1.1 }}>
            {result.isolatedRestDays}
            <span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '4px', color: 'var(--sub)' }}>
              {isTR ? 'tek gün dinlenme' : 'isolated rest days'}
            </span>
          </div>
          <div style={{ ...S.mono, fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>
            {result.extendedRestBlocks}
            <span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '4px', color: 'var(--sub)' }}>
              {isTR ? 'dinlenme bloğu' : 'rest blocks'}
            </span>
          </div>
        </div>
        <div
          data-trtp-band-badge={result.band}
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

      {/* Secondary stats row ------------------------------------------------ */}
      <div
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
        <span data-trtp-longest-badge>
          {isTR
            ? `en uzun blok ${result.longestRestBlockDays}g`
            : `longest block ${result.longestRestBlockDays}d`}
        </span>
        <span data-trtp-share-pct={sharePct}>
          {isTR
            ? `%${sharePct} tek gün`
            : `${sharePct}% isolated`}
        </span>
        <span>
          {isTR
            ? `toplam ${result.totalRestDays} dinlenme g`
            : `${result.totalRestDays} total rest d`}
        </span>
      </div>

      {/* 84-day strip ------------------------------------------------------- */}
      <svg
        width={SVG_W}
        height={SVG_H}
        role="img"
        aria-label={isTR ? '84 gün dinlenme şeridi' : '84-day rest strip'}
        data-trtp-strip
        style={{ display: 'block', marginBottom: '8px' }}
      >
        {strip.map((d, i) => {
          const fill =
            d.kind === 'active'   ? '#0064ff' :
            d.kind === 'isolated' ? '#ff6600' :
            d.kind === 'extended' ? '#5bc25b' :
            d.kind === 'future'   ? '#1a1a1a' :
                                    '#444'   // edge-rest unclassified
          return (
            <rect
              key={`${d.iso}-${i}`}
              x={i * STEP}
              y={0}
              width={CELL}
              height={CELL}
              rx={1}
              ry={1}
              fill={fill}
              data-strip-kind={d.kind}
              data-strip-iso={d.iso}
            >
              <title>{d.iso}: {d.kind}</title>
            </rect>
          )
        })}
      </svg>

      {/* Band interpretation ------------------------------------------------ */}
      <div
        data-trtp-interpretation
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

      {/* Citation footer --------------------------------------------------- */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
