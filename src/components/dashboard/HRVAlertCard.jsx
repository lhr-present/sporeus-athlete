// ─── HRVAlertCard.jsx — E37: HRV Drop Alert ───────────────────────────────────
// Shows only when HRV is clinically suppressed (>2σ drop) or notably suppressed.
// Uses detectHRVAlert logic via computeHRVAlertState from hrvAlertSummary.js.
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeHRVAlertState } from '../../lib/athlete/hrvAlertSummary.js'

/**
 * @param {{ recovery: object[] }} props
 */
export default function HRVAlertCard({ recovery }) {
  const { t, lang } = useContext(LangCtx)

  const state = computeHRVAlertState(recovery)

  // Only render when actionable (alert or suppressed)
  if (!state || state.status === 'normal') return null

  const isAlert      = state.status === 'alert'
  const badgeColor   = isAlert ? '#e03030' : '#f5c542'
  const badgeLabel   = isAlert ? t('hrvAlertAlert') : t('hrvAlertSuppressed')
  const title        = lang === 'tr' ? '⚠ KLV DÜŞÜŞÜ' : '⚠ HRV ALERT'
  const sigmaLabel   = `${state.sigma.toFixed(2)}σ below baseline`
  const deltaLabel   = `${state.delta > 0 ? '+' : ''}${state.delta.toFixed(1)} RMSSD`
  const actionText   = lang === 'tr' ? t('hrvAlertAction_tr') : t('hrvAlertAction')

  return (
    <div className="sp-card" style={{
      ...S.card,
      borderLeft: `4px solid ${badgeColor}`,
      marginBottom: '12px',
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{
          ...S.mono,
          fontSize: '11px',
          fontWeight: 700,
          color: '#e03030',
          letterSpacing: '0.08em',
        }}>
          {title}
        </div>
        {/* Status badge */}
        <span style={{
          ...S.mono,
          fontSize: '9px',
          fontWeight: 700,
          color: badgeColor,
          border: `1px solid ${badgeColor}66`,
          padding: '1px 6px',
          borderRadius: '2px',
          letterSpacing: '0.07em',
        }}>
          {badgeLabel}
        </span>
      </div>

      {/* Delta + Sigma row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...S.mono, fontSize: '16px', fontWeight: 700, color: badgeColor }}>
            {deltaLabel}
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888', marginTop: '2px' }}>
            {sigmaLabel}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: '#555' }}>
            {lang === 'tr' ? 'Ortalama' : 'Baseline'}: <span style={{ color: 'var(--text)' }}>{state.mean}</span>
          </div>
          <div style={{ ...S.mono, fontSize: '10px', color: '#555' }}>
            {lang === 'tr' ? 'Bugün' : 'Today'}: <span style={{ color: badgeColor, fontWeight: 700 }}>{state.current}</span>
          </div>
        </div>
      </div>

      {/* Action line */}
      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: '#888',
        borderTop: '1px solid var(--border)',
        paddingTop: '6px',
        marginBottom: '4px',
        lineHeight: 1.6,
      }}>
        → {actionText}
      </div>

      {/* Citation */}
      <div style={{ ...S.mono, fontSize: '8px', color: '#333', letterSpacing: '0.04em' }}>
        {state.citation}
      </div>
    </div>
  )
}
