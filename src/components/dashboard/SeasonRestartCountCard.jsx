// ─── dashboard/SeasonRestartCountCard.jsx — 365d comeback-frequency card ────
// Surfaces analyzeSeasonRestartCount(): counts every "comeback event" — an
// active day preceded by ≥7 consecutive inactive days — across the trailing
// year, then reports the resilience pattern (how long each restart lasted
// before the next gap). High-restart years are high-risk years (Hägglund 2013,
// Gabbett 2016) because each comeback is a window where the body has
// detrained.
//
// Distinct from CalendarHolesCard (90d gap-detail) and Streak/RecoveryStreak
// cards (current streak only).
// ────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeSeasonRestartCount } from '../../lib/athlete/seasonRestartCount.js'

const BAND_COLORS = {
  CONSISTENT:        '#5bc25b',
  OCCASIONAL_BREAKS: '#f5c542',
  FRAGMENTED:        '#e07b30',
  CHRONIC_RESTART:   '#e03030',
}

const BAND_LABEL = {
  CONSISTENT:        { en: 'CONSISTENT',        tr: 'TUTARLI' },
  OCCASIONAL_BREAKS: { en: 'OCCASIONAL BREAKS', tr: 'ARA SIRA MOLA' },
  FRAGMENTED:        { en: 'FRAGMENTED',        tr: 'PARÇALI' },
  CHRONIC_RESTART:   { en: 'CHRONIC RESTART',   tr: 'KRONİK YENİDEN BAŞLANGIÇ' },
}

const BAND_MSG = {
  CONSISTENT: {
    en: 'Year-long consistency — few comebacks, body stays adapted.',
    tr: 'Yıl boyu tutarlı — az yeniden başlangıç, vücut adapte kalıyor.',
  },
  OCCASIONAL_BREAKS: {
    en: 'A couple of restarts — manageable, ease back in carefully each time.',
    tr: 'Birkaç yeniden başlangıç — yönetilebilir, her seferinde dikkatli geri dönün.',
  },
  FRAGMENTED: {
    en: 'Training keeps fragmenting — each comeback is a high-risk window.',
    tr: 'Antrenman sürekli parçalanıyor — her dönüş yüksek riskli pencere.',
  },
  CHRONIC_RESTART: {
    en: 'Chronic restart pattern — fix the root cause (load, life, injury) before pushing volume.',
    tr: 'Kronik yeniden başlangıç deseni — hacmi artırmadan önce kök nedeni çözün.',
  },
}

const CELL = 3
const GAP  = 0
const STEP = CELL + GAP

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

export default function SeasonRestartCountCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeSeasonRestartCount({ log, today: new Date(), lookbackDays: 365, minGapDays: 7 }),
    [log]
  )

  // Build the 365-day strip: every day gets a colour:
  //   restart day = orange
  //   active      = blue
  //   inactive    = grey
  const strip = useMemo(() => {
    if (!result) return []
    const todayIso = new Date().toISOString().slice(0, 10)
    const start = new Date(todayIso + 'T00:00:00Z')
    start.setUTCDate(start.getUTCDate() - 364)

    const restartSet = new Set((result.restarts || []).map(r => r.restartDate))

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

    const days = []
    const cur = new Date(start)
    for (let i = 0; i < 365; i++) {
      const iso = cur.toISOString().slice(0, 10)
      let kind = 'inactive'
      if (restartSet.has(iso)) kind = 'restart'
      else if (activeSet.has(iso)) kind = 'active'
      days.push({ iso, kind })
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return days
  }, [log, result])

  if (!result) return null

  const color = BAND_COLORS[result.band] || BAND_COLORS.CONSISTENT
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en']
    || String(result.band || '').toUpperCase()
  const bandMsg = BAND_MSG[result.band]?.[isTR ? 'tr' : 'en'] || ''

  const SVG_W = 365 * STEP
  const SVG_H = CELL * 2

  // Up to 4 most-recent restarts (newest first)
  const recentRestarts = (result.restarts || []).slice(-4).reverse()

  const ariaLabel = isTR ? 'Sezon Yeniden Başlangıçları — 365G' : 'Season Restarts — 365D'

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="season-restart-count"
      data-restart-band={result.band}
      data-restart-total={result.totalRestarts}
      data-restart-longest-streak={result.longestStreakAfterRestart}
      data-restart-longest-gap={result.longestGap}
      style={{ ...S.card, animationDelay: '275ms', borderLeft: `3px solid ${color}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'SEZON YENİDEN BAŞLANGIÇLARI — 365G' : 'SEASON RESTARTS — 365D'}
      </div>

      {/* Big stat + band badge */}
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
          data-restart-total={result.totalRestarts}
          style={{ ...S.mono, fontSize: '24px', fontWeight: 700, color, lineHeight: 1.1 }}
        >
          {result.totalRestarts}
          <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '6px', color: 'var(--sub)' }}>
            {isTR ? 'son 365 günde yeniden başlangıç' : 'restarts in last 365d'}
          </span>
        </div>
        <div
          data-restart-band-badge={result.band}
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

      {/* 365-day strip */}
      <svg
        width={SVG_W}
        height={SVG_H}
        role="img"
        aria-label={isTR ? '12 aylık aktivite ve yeniden başlangıç şeridi' : '12-month activity and restart strip'}
        data-restart-strip
        style={{ display: 'block', marginBottom: '8px', maxWidth: '100%' }}
      >
        {strip.map((d, i) => {
          const fill =
            d.kind === 'restart' ? '#ff8c1a' :
            d.kind === 'active'  ? '#0064ff' :
                                   '#444'
          return (
            <rect
              key={d.iso}
              x={i * STEP}
              y={0}
              width={CELL}
              height={SVG_H}
              fill={fill}
              data-strip-kind={d.kind}
            >
              <title>{d.iso}: {d.kind}</title>
            </rect>
          )
        })}
      </svg>

      {/* Best-streak + longest-gap stats */}
      <div
        data-restart-longest-streak={result.longestStreakAfterRestart}
        data-restart-longest-gap={result.longestGap}
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
        <span data-best-streak-badge>
          {isTR
            ? `En iyi yeniden başlangıç serisi: ${result.longestStreakAfterRestart} gün`
            : `Best streak after restart: ${result.longestStreakAfterRestart} days`}
        </span>
        {result.longestGap > 0 ? (
          <span data-longest-gap>
            {isTR
              ? `En uzun ara: ${result.longestGap}g`
              : `Longest gap: ${result.longestGap}d`}
          </span>
        ) : null}
      </div>

      {/* Recent restart chips */}
      {recentRestarts.length > 0 ? (
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
            {isTR ? 'SON YENİDEN BAŞLANGIÇLAR' : 'RECENT RESTARTS'}
          </div>
          <div
            role="list"
            aria-label={isTR ? 'Son yeniden başlangıçlar' : 'Recent restarts'}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}
          >
            {recentRestarts.map(r => (
              <div
                key={r.restartDate}
                role="listitem"
                data-restart-chip
                data-restart-date={r.restartDate}
                data-restart-gap={r.gapLengthDays}
                data-restart-streak={r.streakAfterDays}
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
                {compactDate(r.restartDate, isTR)}
                {isTR
                  ? ` (${r.gapLengthDays}g ara sonrası, ${r.streakAfterDays}g sürdü)`
                  : ` (after ${r.gapLengthDays}-day gap, lasted ${r.streakAfterDays}d)`}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Band interpretation */}
      <div
        data-restart-interpretation
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

      {/* Citation footer */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
