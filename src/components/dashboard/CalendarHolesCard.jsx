// ─── dashboard/CalendarHolesCard.jsx — 90-day Multi-Day Gap Counter ──────────
// Surfaces analyzeCalendarHoles(): counts every gap ≥3 consecutive zero-
// training days in the trailing 90 days, reports the longest, and shows the
// 7-day TSS load BEFORE vs AFTER each gap so the athlete can spot the classic
// gap → spike pattern (Foster 2017; Soligard 2016).
//
// Distinct from streak cards (which only know "current streak"). This card
// always renders — a clean 90 days is still useful information ("0 holes,
// 100% active days").
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeCalendarHoles } from '../../lib/athlete/calendarHoles.js'

const BAND_COLORS = {
  CLEAN:             '#5bc25b',
  OCCASIONAL_HOLES:  '#f5c542',
  FRAGMENTED:        '#e03030',
}

const BAND_LABEL = {
  CLEAN:             { en: 'CLEAN',             tr: 'TEMİZ' },
  OCCASIONAL_HOLES:  { en: 'OCCASIONAL HOLES',  tr: 'ARA SIRA BOŞLUK' },
  FRAGMENTED:        { en: 'FRAGMENTED',        tr: 'PARÇALI' },
}

const BAND_MSG = {
  CLEAN: {
    en: 'Calendar is clean — no meaningful gaps in 90 days.',
    tr: 'Takvim temiz — 90 günde anlamlı boşluk yok.',
  },
  OCCASIONAL_HOLES: {
    en: 'Some gaps — watch the load on the week after each hole.',
    tr: 'Bazı boşluklar var — her boşluğun sonraki haftasındaki yüke dikkat.',
  },
  FRAGMENTED: {
    en: 'Calendar is fragmented — gaps + ramps are an injury setup.',
    tr: 'Takvim parçalı — boşluk + ani yüklenme sakatlık riski.',
  },
}

const CELL = 6
const GAP  = 1
const STEP = CELL + GAP

// Format a YYYY-MM-DD as a compact "MMM DD" label (English) / "DD MMM" (TR).
const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
function compactDate(iso, isTR) {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return iso || ''
  const mo = Number(iso.slice(5, 7)) - 1
  const dd = iso.slice(8, 10)
  if (mo < 0 || mo > 11) return iso
  return isTR
    ? `${dd} ${MONTH_TR[mo]}`
    : `${MONTH_EN[mo]} ${dd}`
}

function CalendarHolesCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeCalendarHoles({ log, today: new Date(), windowDays: 90, minGapDays: 3 }),
    [log]
  )

  // Build the 90-day strip: each day gets a colour.
  //   in-hole = red (#e03030)
  //   active  = blue (#0064ff)
  //   inactive (not in a hole) = grey (#444)
  // NOTE: this hook is unconditional — it runs even when result is null so
  // that hook order stays stable across renders.
  const strip = useMemo(() => {
    if (!result) return []
    const todayIso = new Date().toISOString().slice(0, 10)
    const days = []
    // Mirror the library's window: start = today - 89.
    const start = new Date(todayIso + 'T00:00:00Z')
    start.setUTCDate(start.getUTCDate() - 89)

    // Build a set of in-hole dates from result.holes for O(1) lookup.
    const holeSet = new Set()
    for (const h of (result.holes || [])) {
      const cur = new Date(h.startDate + 'T00:00:00Z')
      const end = new Date(h.endDate   + 'T00:00:00Z')
      while (cur <= end) {
        holeSet.add(cur.toISOString().slice(0, 10))
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
    }

    // Build active-day set from log.
    const activeSet = new Set()
    for (const e of (log || [])) {
      if (!e || !e.date) continue
      const tss = Number(e.tss)
      const dur = Number(e.duration_min ?? e.durationMin ?? e.duration)
      const dis = Number(e.distance_km ?? e.distanceKm ?? e.distance)
      if ((Number.isFinite(tss) && tss > 0) ||
          (Number.isFinite(dur) && dur > 0) ||
          (Number.isFinite(dis) && dis > 0)) {
        activeSet.add(String(e.date).slice(0, 10))
      }
    }

    const cur = new Date(start)
    for (let i = 0; i < 90; i++) {
      const iso = cur.toISOString().slice(0, 10)
      let kind = 'inactive'
      if (holeSet.has(iso)) kind = 'hole'
      else if (activeSet.has(iso)) kind = 'active'
      days.push({ iso, kind })
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return days
  }, [log, result])

  if (!result) return null

  const color = BAND_COLORS[result.band] || BAND_COLORS.CLEAN
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en']
    || String(result.band || '').toUpperCase()
  const bandMsg = BAND_MSG[result.band]?.[isTR ? 'tr' : 'en'] || ''

  const SVG_W = 90 * STEP
  const SVG_H = CELL

  // Up to 3 most-recent holes for chip rendering.
  const recentHoles = (result.holes || []).slice(-3).reverse()

  const activePct = Math.round((result.activeDayRatio || 0) * 100)

  const ariaLabel = isTR ? 'Takvim Boşlukları — 90G' : 'Calendar Holes — 90D'

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="calendar-holes"
      data-calendar-holes-band={result.band}
      data-calendar-holes-total={result.totalHoles}
      data-calendar-holes-longest={result.longestHoleDays}
      data-calendar-holes-active-pct={activePct}
      style={{ ...S.card, animationDelay: '250ms', borderLeft: `3px solid ${color}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'TAKVİM BOŞLUKLARI — 90G' : 'CALENDAR HOLES — 90D'}
      </div>

      {/* Band badge ------------------------------------------------------- */}
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
          data-calendar-holes-longest={result.longestHoleDays}
          style={{ ...S.mono, fontSize: '24px', fontWeight: 700, color, lineHeight: 1.1 }}
        >
          {result.longestHoleDays}
          <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '4px', color: 'var(--sub)' }}>
            {isTR ? 'gün' : 'd'}
          </span>
        </div>
        <div
          data-calendar-holes-band-badge={result.band}
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

      {/* 90-day strip ----------------------------------------------------- */}
      <svg
        width={SVG_W}
        height={SVG_H}
        role="img"
        aria-label={isTR ? '90 gün aktivite şeridi' : '90-day activity strip'}
        data-calendar-holes-strip
        style={{ display: 'block', marginBottom: '8px' }}
      >
        {strip.map((d, i) => {
          const fill =
            d.kind === 'hole'   ? '#e03030' :
            d.kind === 'active' ? '#0064ff' :
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

      {/* Stats row -------------------------------------------------------- */}
      <div
        data-calendar-holes-total={result.totalHoles}
        data-calendar-holes-active-pct={activePct}
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
            ? `${result.totalHoles} boşluk`
            : `${result.totalHoles} hole${result.totalHoles === 1 ? '' : 's'}`}
        </span>
        <span>
          {isTR
            ? `en uzun ${result.longestHoleDays}g`
            : `longest ${result.longestHoleDays}d`}
        </span>
        <span>
          {isTR ? `%${activePct} aktif gün` : `${activePct}% active days`}
        </span>
      </div>

      {/* Recent holes chips ---------------------------------------------- */}
      {recentHoles.length > 0 ? (
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
            {isTR ? 'SON BOŞLUKLAR' : 'RECENT HOLES'}
          </div>
          <div
            role="list"
            aria-label={isTR ? 'Son takvim boşlukları' : 'Recent calendar holes'}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}
          >
            {recentHoles.map(h => {
              const pre  = Math.round(h.precededBy7dTss || 0)
              const post = Math.round(h.followedBy7dTss || 0)
              const arrow = post > pre ? '↑' : post < pre ? '↓' : '→'
              return (
                <div
                  key={`${h.startDate}-${h.endDate}`}
                  role="listitem"
                  data-hole-chip
                  data-hole-start={h.startDate}
                  data-hole-end={h.endDate}
                  data-hole-length={h.lengthDays}
                  data-hole-pre-tss={pre}
                  data-hole-post-tss={post}
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
                  {compactDate(h.startDate, isTR)}→{compactDate(h.endDate, isTR)},{' '}
                  {h.lengthDays}{isTR ? 'g' : 'd'}, ↑{pre}/{arrow}{post}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Band interpretation -------------------------------------------- */}
      <div
        data-calendar-holes-interpretation
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

export default memo(CalendarHolesCard)
