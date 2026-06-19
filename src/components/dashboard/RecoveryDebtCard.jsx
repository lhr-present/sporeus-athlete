// ─── dashboard/RecoveryDebtCard.jsx — Recovery Debt (28d cumulative TSB) ─────
// Surfaces detectRecoveryDebt(): inline Banister EWMA over the full log to
// integrate negative-TSB area under the curve across the trailing 28 days.
// Bands: fresh, maintaining, building, fatigued, overreached. Closes the
// lib→card loop for v8.77.0.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectRecoveryDebt } from '../../lib/athlete/recoveryDebt.js'

const BAND_COLOR = {
  fresh:       '#28a745',
  maintaining: '#0064ff',
  building:    '#ff6600',
  fatigued:    '#ff9500',
  overreached: '#dc3545',
}

const BAND_LABEL = {
  fresh:       { en: 'FRESH',       tr: 'TAZE' },
  maintaining: { en: 'MAINTAINING', tr: 'KORUMA' },
  building:    { en: 'BUILDING',    tr: 'BİRİKİM' },
  fatigued:    { en: 'FATIGUED',    tr: 'YORGUN' },
  overreached: { en: 'OVERREACHED', tr: 'AŞIRI YÜK' },
}

function fmtSigned1(v) {
  const n = Number(v) || 0
  const s = n.toFixed(1)
  return n > 0 ? `+${s}` : s
}

function RecoveryDebtCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectRecoveryDebt(log), [log])

  const title = isTR ? 'TOPARLANMA BORCU — 28G' : 'RECOVERY DEBT — 28D'

  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Toparlanma borcu — yetersiz veri' : 'Recovery debt — insufficient data'}
        style={{ ...S.card, animationDelay: '280ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Toparlanma borcu için 28+ günlük log gerekli'
            : 'Log 28+ days to track cumulative recovery debt'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.band] || BAND_COLOR.maintaining
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()
  const tsbStr = fmtSigned1(result.currentTSB)
  const deficitStr = String(result.cumulativeDeficit)
  const ctlStr = result.ctlToday.toFixed(1)
  const atlStr = result.atlToday.toFixed(1)
  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  const ariaRow = isTR
    ? `${bandLbl} — TSB ${tsbStr}, borç ${deficitStr}`
    : `${bandLbl} — TSB ${tsbStr}, deficit ${deficitStr}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Toparlanma borcu' : 'Recovery debt'}
      style={{ ...S.card, animationDelay: '280ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
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
            {tsbStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            TSB
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            TSB
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
            {deficitStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            DEFICIT
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            BORÇ
          </div>
        </div>
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '6px',
        letterSpacing: '0.04em',
      }}>
        {`CTL: ${ctlStr}`}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {`ATL: ${atlStr}`}
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '6px',
        letterSpacing: '0.04em',
      }}>
        {isTR
          ? `28G'de ${result.debtDays} borç günü`
          : `${result.debtDays}/28 debt days`}
      </div>

      {result.maxConsecutiveNegativeDays > 0 ? (
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--sub, var(--muted))',
          marginBottom: '10px',
          letterSpacing: '0.04em',
        }}>
          {isTR
            ? `En uzun borç dizisi: ${result.maxConsecutiveNegativeDays} gün`
            : `Longest deficit run: ${result.maxConsecutiveNegativeDays} days`}
        </div>
      ) : null}

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

      {recommendation ? (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--sub, var(--muted))',
          lineHeight: 1.6,
          marginBottom: '8px',
        }}>
          {recommendation}
        </div>
      ) : null}

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(RecoveryDebtCard)
