// ─── dashboard/CrossSportRecoveryGapCard.jsx — Cross-Sport Recovery Gap ────
// Per-discipline "days since last session" with sport-specific recovery
// windows. Helps multi-sport athletes detect a discipline drifting out of
// rotation before overuse risk creeps in via single-mode dominance.
//
// Cite: Bompa 2018 "Periodization: Theory and Methodology of Training";
//       Hreljac 2004 "Impact and overuse injuries in runners".
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeCrossSportRecoveryGap } from '../../lib/athlete/crossSportRecoveryGap.js'

const STATUS_COLOR = {
  FRESH: '#5bc25b',
  OK:    '#0064ff',
  STALE: '#ff6600',
}

const STATUS_LABEL = {
  FRESH: { en: 'FRESH', tr: 'TAZE' },
  OK:    { en: 'OK',    tr: 'İYİ' },
  STALE: { en: 'STALE', tr: 'BAYAT' },
}

const SPORT_LABEL = {
  run:      { en: 'Run',      tr: 'Koşu' },
  bike:     { en: 'Bike',     tr: 'Bisiklet' },
  swim:     { en: 'Swim',     tr: 'Yüzme' },
  strength: { en: 'Strength', tr: 'Kuvvet' },
}

const HINT = {
  stale: {
    en: 'Long gap detected. Consider working that discipline back in this week.',
    tr: 'Uzun boşluk tespit edildi. O disiplini bu hafta tekrar programa al.',
  },
  allFresh: {
    en: 'Good rotation across sports — variety reduces overuse risk.',
    tr: 'Sporlar arasında iyi rotasyon — çeşitlilik aşırı kullanım riskini azaltır.',
  },
  mixed: {
    en: 'Healthy spacing across disciplines.',
    tr: 'Disiplinler arası sağlıklı aralık.',
  },
}

function CrossSportRecoveryGapCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeCrossSportRecoveryGap({ log }),
    [log]
  )

  // Render null when there is no data, or when only one sport has ever been
  // logged (no cross-sport comparison to make).
  if (!result) return null
  if (!Array.isArray(result.sports) || result.sports.length < 2) return null

  const title = isTR ? 'SPORLAR ARASI BOŞLUK' : 'CROSS-SPORT GAP'
  const ariaLabel = isTR
    ? 'Sporlar arası toparlanma boşluğu'
    : 'Cross-sport recovery gap'

  const anyStale = result.sports.some((s) => s.status === 'STALE')
  const allFresh = result.sports.every((s) => s.status === 'FRESH')
  const hintKey = anyStale ? 'stale' : allFresh ? 'allFresh' : 'mixed'
  const hint = HINT[hintKey][isTR ? 'tr' : 'en']

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-cross-sport-gap-card=""
      style={{ ...S.card, animationDelay: '440ms', padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0 12px' }}>
        {result.sports.map((row) => {
          const color = STATUS_COLOR[row.status] || '#888'
          const sportLabel = SPORT_LABEL[row.key]?.[isTR ? 'tr' : 'en'] || row.key
          const statusLabel = STATUS_LABEL[row.status]?.[isTR ? 'tr' : 'en'] || row.status
          const daysStr = row.daysSince == null ? '—' : String(row.daysSince)
          const daysSuffix = isTR ? (row.daysSince === 1 ? 'gün' : 'gün') : (row.daysSince === 1 ? 'day' : 'days')
          const lastDateStr = row.lastDate || '—'
          const rowAria = isTR
            ? `${sportLabel}: ${daysStr} ${daysSuffix} — ${statusLabel}`
            : `${sportLabel}: ${daysStr} ${daysSuffix} — ${statusLabel}`

          return (
            <div
              key={row.key}
              data-sport-row=""
              data-sport-key={row.key}
              data-sport-status={row.status}
              data-days-since={row.daysSince == null ? '' : String(row.daysSince)}
              aria-label={rowAria}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 10px',
                borderLeft: `3px solid ${color}`,
                background: 'var(--surface, transparent)',
                borderRadius: '3px',
              }}
            >
              <div style={{ flex: '0 0 auto', minWidth: '88px' }}>
                <div style={{
                  ...S.mono,
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  {sportLabel}
                </div>
              </div>

              <div style={{ flex: '0 0 auto', minWidth: '76px' }}>
                <div style={{
                  ...S.mono,
                  fontSize: '24px',
                  fontWeight: 700,
                  color,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}>
                  {daysStr}
                </div>
                <div style={{
                  ...S.mono,
                  fontSize: '9px',
                  color: 'var(--muted)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginTop: '2px',
                }}>
                  {daysSuffix}
                </div>
              </div>

              <div style={{ flex: '0 0 auto' }}>
                <span style={{
                  display: 'inline-block',
                  ...S.mono,
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#fff',
                  background: color,
                  padding: '3px 8px',
                  borderRadius: '3px',
                  letterSpacing: '0.08em',
                }}>
                  {statusLabel}
                </span>
              </div>

              <div style={{ flex: '1 1 auto', textAlign: 'right' }}>
                <div style={{
                  ...S.mono,
                  fontSize: '10px',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                }}>
                  {lastDateStr}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        ...S.mono,
        fontSize: '11px',
        color: 'var(--text)',
        lineHeight: 1.6,
        paddingLeft: '8px',
        borderLeft: `2px solid ${STATUS_COLOR[anyStale ? 'STALE' : allFresh ? 'FRESH' : 'OK']}`,
        marginBottom: '8px',
      }}>
        {hint}
      </div>

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(CrossSportRecoveryGapCard)
