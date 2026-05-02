// ─── dashboard/StaleZonesCard.jsx — E120: Zone balance over last 28 days ─────
// Surfaces stale (<5% share) and dropped (last-7d share <50% of prior-21d)
// zones from detectStaleZones() so athletes can rebalance training distribution.
// Citation: Seiler 2010 polarized; Foster 2001.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectStaleZones } from '../../lib/athlete/staleZones.js'

const STATUS_COLORS = {
  healthy: '#5bc25b',
  stale:   '#e03030',
  dropped: '#f5c542',
}

const STATUS_LABEL = {
  healthy: { en: 'healthy', tr: 'iyi' },
  stale:   { en: 'stale',   tr: 'ihmal edilmiş' },
  dropped: { en: 'dropped', tr: 'düşmüş' },
}

export default function StaleZonesCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectStaleZones(log), [log])

  // Empty / unreliable state ---------------------------------------------------
  if (!result.zones.length || !result.reliable) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Bölge dengesi — yetersiz veri' : 'Zone balance — not enough data'}
        style={{ ...S.card, animationDelay: '195ms' }}
      >
        <div style={S.cardTitle}>
          {isTR ? 'BÖLGE DENGESİ — 28G' : 'ZONE BALANCE — 28D'}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', textAlign: 'center', padding: '14px 0', lineHeight: 1.7 }}>
          {isTR
            ? 'Bölge dengeni görmek için 14+ gün antrenman kaydet'
            : 'Log 14+ days of training to see zone balance'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const flagged = result.summary.stale + result.summary.dropped

  // All-healthy state ---------------------------------------------------------
  if (flagged === 0) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Bölge dengesi — iyi' : 'Zone balance — healthy'}
        style={{ ...S.card, animationDelay: '195ms', borderLeft: `3px solid ${STATUS_COLORS.healthy}` }}
      >
        <div style={S.cardTitle}>
          {isTR ? 'BÖLGE DENGESİ — 28G' : 'ZONE BALANCE — 28D'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
          <div style={{ ...S.mono, fontSize: '20px', color: STATUS_COLORS.healthy, fontWeight: 700, lineHeight: 1 }}>
            ✓
          </div>
          <div style={{ ...S.mono, fontSize: '12px', color: 'var(--text)', lineHeight: 1.6 }}>
            {isTR ? 'Bölge dengen iyi' : 'Zone balance is healthy'}
          </div>
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '6px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // Flagged state — render zone tiles + flagged messages ----------------------
  const flaggedZones = result.zones.filter(z => z.status !== 'healthy')

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Bölge dengesi — son 28 gün' : 'Zone balance — last 28 days'}
      style={{ ...S.card, animationDelay: '195ms' }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'BÖLGE DENGESİ — 28G' : 'ZONE BALANCE — 28D'}
      </div>

      {/* Single-row zone tile legend */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
        {result.zones.map(z => {
          const color = STATUS_COLORS[z.status] || STATUS_COLORS.healthy
          const pct = Math.round(z.share28d)
          const statusLbl = STATUS_LABEL[z.status]?.[isTR ? 'tr' : 'en'] || z.status
          return (
            <div
              key={z.zone}
              aria-label={
                isTR
                  ? `${z.zone} ${statusLbl}, payı %${pct}`
                  : `${z.zone} ${statusLbl}, share ${pct} percent`
              }
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '6px 2px',
                background: `${color}18`,
                border: `1px solid ${color}55`,
                borderRadius: '3px',
              }}
            >
              <div style={{ ...S.mono, fontSize: '11px', fontWeight: 700, color, lineHeight: 1.2 }}>
                {z.zone}
              </div>
              <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginTop: '2px' }}>
                {pct}%
              </div>
            </div>
          )
        })}
      </div>

      {/* Flagged zone messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {flaggedZones.map(z => {
          const color = STATUS_COLORS[z.status] || '#888'
          return (
            <div
              key={z.zone}
              style={{
                ...S.mono,
                fontSize: '10px',
                color: 'var(--sub)',
                lineHeight: 1.6,
                paddingLeft: '8px',
                borderLeft: `2px solid ${color}`,
              }}
            >
              {z.message[isTR ? 'tr' : 'en']}
            </div>
          )
        })}
      </div>

      {/* Citation footer */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '10px' }}>
        {result.citation}
      </div>
    </div>
  )
}
