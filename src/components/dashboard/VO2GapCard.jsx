// ─── dashboard/VO2GapCard.jsx — VO2max / Z5 Stimulus Gap (28d) ──────────────
// Surfaces detectVO2Gap(): top-end fitness recency + 28d Z5 share. Bands:
// ok, warning, critical, severe, never. Complements MonotonyStrainCard (which
// flags overall load uniformity) and staleZones (which compares all zones)
// by zooming in on Z5 recency + dose. Cite: Stöggl & Sperlich 2014; Seiler 2010
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectVO2Gap } from '../../lib/athlete/vo2GapDetector.js'

const BAND_COLOR = {
  ok:       '#28a745',
  warning:  '#ff9500',
  critical: '#ff6600',
  severe:   '#dc3545',
  never:    '#a40000',
}

const BAND_LABEL = {
  ok:       { en: 'ON TARGET', tr: 'HEDEFTE' },
  warning:  { en: 'WARNING',   tr: 'UYARI' },
  critical: { en: 'CRITICAL',  tr: 'KRİTİK' },
  severe:   { en: 'SEVERE',    tr: 'ŞİDDETLİ' },
  never:    { en: 'NEVER',     tr: 'YOK' },
}

function VO2GapCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectVO2Gap(log), [log])

  const title = isTR ? 'VO2MAX BOŞLUĞU — 28G' : 'VO2MAX GAP — 28D'

  // ─── Insufficient data ──────────────────────────────────────────────────────
  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'VO2max boşluğu — yetersiz veri' : 'VO2max gap — insufficient data'}
        style={{ ...S.card, animationDelay: '220ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'VO2max boşluğunu izlemek için 28 günde 14+ farklı gün kaydet'
            : 'Log 14+ distinct days in the 28-day window to track VO2max gap'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.band] || BAND_COLOR.ok
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()

  // ─── Healthy state — band ok, brief positive note ───────────────────────────
  if (result.band === 'ok') {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'VO2max boşluğu — hedefte' : 'VO2max gap — on target'}
        style={{ ...S.card, animationDelay: '220ms', borderLeft: `4px solid ${accent}` }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '12px', color: 'var(--text)',
          padding: '10px 0', lineHeight: 1.6,
        }}>
          {isTR ? 'Z5 dozunda — son uyaran taze.' : 'Z5 within range — stimulus fresh.'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const isNever = result.band === 'never'
  const daysStr = isNever ? (isTR ? 'YOK' : 'NEVER') : String(result.daysSince ?? result.daysSinceZ5 ?? 0)
  const shareStr = `${(Math.round(result.share28d * 10) / 10).toFixed(1)}%`
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''
  const message = result.message?.[isTR ? 'tr' : 'en'] || ''

  const ariaRow = isTR
    ? `${bandLbl} — ${isNever ? 'Z5 kaydı yok' : `${daysStr} gün sonra`}, 28 gün payı ${shareStr}`
    : `${bandLbl} — ${isNever ? 'no Z5 logged' : `${daysStr} days since Z5`}, 28-day share ${shareStr}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'VO2max boşluğu' : 'VO2max gap'}
      style={{ ...S.card, animationDelay: '220ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      <div style={{
        display: 'inline-block',
        ...S.mono,
        fontSize: '11px',
        fontWeight: 700,
        color: '#fff',
        background: accent,
        padding: '4px 10px',
        borderRadius: '3px',
        letterSpacing: '0.08em',
        marginBottom: '10px',
      }}>
        {bandLbl}
      </div>

      <div
        aria-live="polite"
        aria-label={ariaRow}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '4px 0 8px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
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
            marginTop: '4px',
          }}>
            {isNever
              ? <>NEVER<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>YOK</>
              : <>DAYS SINCE Z5<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>Z5 SONRASI GÜN</>}
          </div>
        </div>

        <div>
          <div style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {shareStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            28D Z5 SHARE
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            28G Z5 PAYI
          </div>
        </div>
      </div>

      {message && (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${accent}`,
          marginBottom: '8px',
        }}>
          {message}
        </div>
      )}

      {recommendation && (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--sub, var(--muted))',
          lineHeight: 1.6,
          marginBottom: '8px',
        }}>
          {recommendation}
        </div>
      )}

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(VO2GapCard)
