// ─── RuleAlertsCard.jsx — Rule-Based Coaching Alerts Card (E30) ──────────────
// Displays up to 3 coaching alerts derived from 5 rule checks:
// readiness (ACWR+wellness), load trend, monotony, fatigue accumulation, rest.
// Returns null when no actionable alerts exist.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { computeRuleAlerts } from '../../lib/athlete/ruleAlerts.js'

const MONO = "'IBM Plex Mono', monospace"

export default function RuleAlertsCard({ log = [], recovery = [] }) {
  const { t }    = useContext(LangCtx)
  const [lang]   = useLocalStorage('sporeus-lang', 'en')

  const alerts = computeRuleAlerts(log, recovery)

  if (!alerts || alerts.length === 0) return null

  const visible = alerts.slice(0, 3)

  return (
    <div className="sp-card" style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '14px 16px',
      marginBottom: '16px',
    }}>
      {/* Title */}
      <div style={{
        fontFamily: MONO,
        fontSize: '10px',
        color: '#ff6600',
        letterSpacing: '0.08em',
        fontWeight: 700,
        marginBottom: '12px',
      }}>
        ◈ {lang === 'tr' ? t('ruleAlertsTitle') : t('ruleAlertsTitle')}
      </div>

      {/* Alert rows */}
      {visible.map(alert => (
        <div key={alert.key} style={{
          borderLeft: `4px solid ${alert.color}`,
          paddingLeft: '10px',
          marginBottom: '10px',
        }}>
          <div style={{
            fontFamily: MONO,
            fontSize: '10px',
            color: '#ccc',
            lineHeight: 1.5,
          }}>
            {lang === 'tr' ? alert.tr : alert.message}
          </div>
          {(lang === 'tr' ? alert.actionTr : alert.action) && (
            <div style={{
              fontFamily: MONO,
              fontSize: '9px',
              color: '#888',
              marginTop: '3px',
              lineHeight: 1.4,
            }}>
              → {lang === 'tr' ? alert.actionTr : alert.action}
            </div>
          )}
        </div>
      ))}

      {/* Severity legend */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginTop: '6px',
        borderTop: '1px solid var(--border)',
        paddingTop: '8px',
      }}>
        {[
          { label: t('ruleAlertsHigh'), color: '#e03030' },
          { label: t('ruleAlertsMod'),  color: '#ff6600' },
          { label: t('ruleAlertsOpt'),  color: '#5bc25b' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '1px', background: color }} />
            <span style={{ fontFamily: MONO, fontSize: '8px', color: '#666', letterSpacing: '0.05em' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
