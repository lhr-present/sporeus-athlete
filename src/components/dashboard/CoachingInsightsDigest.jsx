// ─── dashboard/CoachingInsightsDigest.jsx — Unified coaching priorities card ─
// Combines staleZones + workoutDensity + sessionVariety into ONE compact
// "this week's coaching priorities" view so users get a single-glance summary
// before scrolling through the three individual detector cards.
// Citations: Seiler 2010; Foster 2001; Gabbett 2016.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectStaleZones } from '../../lib/athlete/staleZones.js'
import { detectWorkoutDensity } from '../../lib/athlete/workoutDensity.js'
import { detectSessionVariety } from '../../lib/athlete/sessionVariety.js'

const SEVERITY_BULLET = {
  high:     '🔴',
  moderate: '🟡',
  low:      '🟢',
}

const SEVERITY_LABEL = {
  high:     { en: 'high',     tr: 'yüksek' },
  moderate: { en: 'moderate', tr: 'orta' },
  low:      { en: 'low',      tr: 'düşük' },
}

const SOURCE_LABEL = {
  DENSITY: { en: 'DENSITY', tr: 'YOĞUNLUK' },
  VARIETY: { en: 'VARIETY', tr: 'ÇEŞİTLİLİK' },
  ZONES:   { en: 'ZONES',   tr: 'BÖLGELER' },
}

const CITATION = 'Seiler 2010; Foster 2001; Gabbett 2016'
const MAX_ROWS = 3

// ─── Priority synthesis ──────────────────────────────────────────────────────
/**
 * Build a prioritized list of insights from the three detectors.
 *   1. high: density.risk === 'high'
 *   2. then: top stale or dropped zone (one row only)
 *   3. then: variety === 'low' (skip if duplicates)
 *   4. then: density.risk === 'moderate' (lower priority than zones/variety)
 *   5. then: variety === 'moderate'
 * Capped at MAX_ROWS.
 */
function buildInsights(stale, density, variety) {
  const rows = []

  // 1. High-risk density (most actionable — overtraining warning)
  if (density.reliable && density.risk === 'high') {
    rows.push({
      key: 'density-high',
      severity: 'high',
      source: 'DENSITY',
      message: density.message,
    })
  }

  // 2. Top zone insight: stale beats dropped, lower zone index beats higher
  if (stale.reliable) {
    const staleZone = stale.zones.find(z => z.status === 'stale')
    const droppedZone = stale.zones.find(z => z.status === 'dropped')
    const zoneRow = staleZone || droppedZone
    if (zoneRow) {
      rows.push({
        key: `zones-${zoneRow.zone}-${zoneRow.status}`,
        severity: zoneRow.status === 'stale' ? 'moderate' : 'low',
        source: 'ZONES',
        message: zoneRow.message,
      })
    }
  }

  // 3. Low variety
  if (variety.reliable && variety.variety === 'low') {
    rows.push({
      key: 'variety-low',
      severity: 'moderate',
      source: 'VARIETY',
      message: variety.message,
    })
  }

  // 4. Moderate-risk density (only if we still have room)
  if (rows.length < MAX_ROWS && density.reliable && density.risk === 'moderate') {
    rows.push({
      key: 'density-moderate',
      severity: 'moderate',
      source: 'DENSITY',
      message: density.message,
    })
  }

  // 5. Moderate variety (lowest priority — informational)
  if (rows.length < MAX_ROWS && variety.reliable && variety.variety === 'moderate') {
    rows.push({
      key: 'variety-moderate',
      severity: 'low',
      source: 'VARIETY',
      message: variety.message,
    })
  }

  return rows.slice(0, MAX_ROWS)
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function CoachingInsightsDigest({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(
    () => ({
      stale: detectStaleZones(log),
      density: detectWorkoutDensity(log),
      variety: detectSessionVariety(log),
    }),
    [log]
  )

  const { stale, density, variety } = result

  // Card title (rendered for every state)
  const title = isTR ? 'ANTRENÖR İÇGÖRÜLERİ' : 'COACHING INSIGHTS'

  // ─── Empty state: all three detectors unreliable ───────────────────────────
  if (!stale.reliable && !density.reliable && !variety.reliable) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={
          isTR ? 'Antrenör içgörüleri — yetersiz veri' : 'Coaching insights — not enough data'
        }
        style={{ ...S.card, animationDelay: '180ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Antrenman içgörüleri için 14+ gün antrenman kaydet'
            : 'Log 14+ days of training to unlock coaching insights'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {CITATION}
        </div>
      </div>
    )
  }

  // ─── All-green state ───────────────────────────────────────────────────────
  const allGreen =
    density.risk === 'low' &&
    variety.variety === 'good' &&
    stale.summary.stale === 0 &&
    stale.summary.dropped === 0

  if (allGreen) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={
          isTR ? 'Antrenör içgörüleri — tüm ölçütler sağlıklı' : 'Coaching insights — all healthy'
        }
        style={{ ...S.card, animationDelay: '180ms', borderLeft: '3px solid #5bc25b' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0',
          }}
        >
          <div style={{ ...S.mono, fontSize: '20px', color: '#5bc25b', fontWeight: 700, lineHeight: 1 }}>
            ✓
          </div>
          <div style={{ ...S.mono, fontSize: '12px', color: 'var(--text)', lineHeight: 1.6 }}>
            {isTR ? 'Tüm antrenman ölçütleri sağlıklı' : 'All training metrics healthy'}
          </div>
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '6px' }}>
          {CITATION}
        </div>
      </div>
    )
  }

  // ─── Mixed state — prioritized list of up to 3 insights ────────────────────
  const insights = buildInsights(stale, density, variety)

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={
        isTR ? 'Antrenör içgörüleri — bu haftanın öncelikleri' : 'Coaching insights — this week\'s priorities'
      }
      style={{ ...S.card, animationDelay: '180ms' }}
    >
      <div style={S.cardTitle}>{title}</div>

      <ul
        role="list"
        style={{
          listStyle: 'none', margin: 0, padding: 0,
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}
      >
        {insights.map(row => {
          const bullet = SEVERITY_BULLET[row.severity]
          const sevLbl = SEVERITY_LABEL[row.severity][isTR ? 'tr' : 'en']
          const srcLbl = SOURCE_LABEL[row.source][isTR ? 'tr' : 'en']
          const msg = row.message[isTR ? 'tr' : 'en']
          const rowAria = isTR
            ? `${sevLbl} öncelik, kaynak ${srcLbl}: ${msg}`
            : `${sevLbl} priority, source ${srcLbl}: ${msg}`
          return (
            <li
              key={row.key}
              role="listitem"
              aria-label={rowAria}
              style={{
                ...S.mono,
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                fontSize: '11px', lineHeight: 1.5, color: 'var(--text)',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '11px', lineHeight: 1.5 }}>
                {bullet}
              </span>
              <span style={{
                ...S.mono, fontSize: '9px', fontWeight: 700,
                color: 'var(--muted)', letterSpacing: '0.06em',
                minWidth: '52px', paddingTop: '2px',
              }}>
                {srcLbl}
              </span>
              <span style={{ flex: 1 }}>
                {msg}{' '}
                <span style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)' }}>
                  {isTR ? 'detaylar →' : 'see details →'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '10px' }}>
        {CITATION}
      </div>
    </div>
  )
}
