// src/components/dashboard/AnnualTssTargetCard.jsx
// Surfaces analyzeAnnualTssTarget — forward-projects year-end TSS from YTD
// pace and classifies against elite-endurance annual load benchmarks.
// Distinct from YearOverYearCard (compares vs last year) and SeasonStatsCard
// (snapshot of work done). This is the "where will I land at year-end?" lens.
//
// Renders nothing when the pure-fn returns null (too early in the year, or no
// TSS logged yet).

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeAnnualTssTarget } from '../../lib/athlete/annualTssTarget.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  ELITE_ENDURANCE: '#ff6600',
  COMPETITIVE:     '#5bc25b',
  CONSISTENT:      '#0064ff',
  DEVELOPING:      '#888',
  CASUAL:          '#555',
}

const BAND_LABEL_EN = {
  ELITE_ENDURANCE: 'ELITE',
  COMPETITIVE:     'COMPETITIVE',
  CONSISTENT:      'CONSISTENT',
  DEVELOPING:      'DEVELOPING',
  CASUAL:          'CASUAL',
}
const BAND_LABEL_TR = {
  ELITE_ENDURANCE: 'ELİT',
  COMPETITIVE:     'YARIŞMACI',
  CONSISTENT:      'İSTİKRARLI',
  DEVELOPING:      'GELİŞEN',
  CASUAL:          'KASUAL',
}

const HINT_EN = {
  ELITE_ENDURANCE: 'Elite-endurance annual load. Recovery infrastructure (sleep, nutrition, life-stress) is the bottleneck at this volume.',
  COMPETITIVE:     "Sub-elite annual volume. You're stacking serious training time — make sure structure and recovery match.",
  CONSISTENT:      'Solid committed-amateur volume. Big enough to drive real adaptation, small enough to fit normal life.',
  DEVELOPING:      'Recreational regular volume. Stay consistent; capacity expands faster at this stage than later.',
  CASUAL:          'Casual training volume. Building a consistent weekly rhythm matters more than total volume right now.',
}
const HINT_TR = {
  ELITE_ENDURANCE: 'Elit dayanıklılık yıllık yükü. Bu hacimde toparlanma altyapısı (uyku, beslenme, yaşam-stresi) darboğazdır.',
  COMPETITIVE:     'Sub-elit yıllık hacim. Ciddi antrenman zamanı biriktiriyorsun — yapı ve toparlanmanın uyuştuğundan emin ol.',
  CONSISTENT:      'Sağlam amatör hacim. Gerçek adaptasyon üretmeye yetecek kadar büyük, normal hayata sığacak kadar küçük.',
  DEVELOPING:      'Düzenli rekreasyonel hacim. Tutarlı kal; bu aşamada kapasite ilerleyen aşamalardan daha hızlı büyür.',
  CASUAL:          'Kasual antrenman hacmi. Şu anda toplam hacimden çok tutarlı haftalık ritim önemli.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function roundToTen(n) {
  return Math.round(n / 10) * 10
}

export default function AnnualTssTargetCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const data = useMemo(
    () => analyzeAnnualTssTarget({ log, today: todayIso() }),
    [log]
  )

  if (!data) return null

  const {
    band, ytdTss, projectedAnnualTss, weeklyAvgPace,
    daysIntoYear, totalDaysInYear, citation,
  } = data

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'YILLIK TSS PROJEKSİYONU' : 'ANNUAL TSS PROJECTION'
  const ariaLabel = isTR
    ? 'Yıllık TSS projeksiyonu'
    : 'Annual TSS projection'

  const projectedRounded = roundToTen(projectedAnnualTss)
  const ytdRounded = Math.round(ytdTss)
  const weeklyRounded = Math.round(weeklyAvgPace)
  const yearProgressPct = Math.round((daysIntoYear / totalDaysInYear) * 100)

  const ytdLbl       = isTR ? 'YIL BAŞINDAN'   : 'YTD'
  const weeklyLbl    = isTR ? 'HAFTALIK ORT.'  : 'WEEKLY AVG'
  const daysLbl      = isTR ? 'GÜN'            : 'DAYS'
  const projectedLbl = isTR ? 'YIL SONU PROJ.' : 'PROJECTED YR-END'
  const tssUnit      = isTR ? 'TSS/hafta'      : 'TSS/wk'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-annual-tss-target-card
      data-projection-band={band}
      data-ytd-tss={String(ytdRounded)}
      data-projected-annual-tss={String(projectedRounded)}
      data-weekly-avg-pace={String(weeklyRounded)}
      data-days-into-year={String(daysIntoYear)}
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
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 8, flexWrap: 'wrap', marginBottom: 12,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
          color: 'var(--text, #ccc)',
        }}>
          ◈ {title}
        </div>
        <div
          data-projection-band-label
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            color, padding: '2px 8px',
            border: `1px solid ${color}`, borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Projected year-end — big number */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: 32, fontWeight: 700, color, lineHeight: 1,
        }}>
          {projectedRounded.toLocaleString('en-US')}
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 4, letterSpacing: '0.05em' }}>
          {projectedLbl} · TSS
        </div>
      </div>

      {/* Stat strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={{
          padding: '6px 8px',
          background: 'var(--surface, #111)',
          borderRadius: 4,
        }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', letterSpacing: '0.05em' }}>
            {ytdLbl}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #ccc)' }}>
            {ytdRounded.toLocaleString('en-US')}
          </div>
        </div>
        <div style={{
          padding: '6px 8px',
          background: 'var(--surface, #111)',
          borderRadius: 4,
        }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', letterSpacing: '0.05em' }}>
            {weeklyLbl}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #ccc)' }}>
            {weeklyRounded} {tssUnit}
          </div>
        </div>
        <div style={{
          padding: '6px 8px',
          background: 'var(--surface, #111)',
          borderRadius: 4,
        }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', letterSpacing: '0.05em' }}>
            {daysLbl}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #ccc)' }}>
            {daysIntoYear}/{totalDaysInYear} ({yearProgressPct}%)
          </div>
        </div>
      </div>

      {/* Hint */}
      <div style={{
        padding: '8px 10px',
        background: 'var(--surface, #111)',
        borderRadius: 4,
        fontSize: 10,
        color: 'var(--muted, #aaa)',
        lineHeight: 1.5,
        marginBottom: 8,
      }}>
        ↗ {hint}
      </div>

      {/* Citation */}
      <div style={{
        fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}
