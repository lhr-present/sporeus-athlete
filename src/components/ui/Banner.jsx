// src/components/ui/Banner.jsx
// v9.148.0 — Unified banner component for TodayView.
//
// Pre-v9.148 each banner had bespoke layout — different paddings,
// different snooze-button positions, different citation render, and
// inconsistent severity-to-color mapping. The v9.144 critique flagged
// the inconsistency. This component centralizes the pattern: every
// banner that fits the (title + body + optional citation + optional
// action + optional snooze) shape can render through here.
//
// Severity → color + default icon mapping. Custom icons via props.
// snoozeKey makes the banner snoozable (uses bannerSnooze.js, 7d TTL).
// Action slot accepts arbitrary children for CTAs.

import Citation from './Citation.jsx'
import { snoozeBanner } from '../../lib/athlete/bannerSnooze.js'

const SEVERITY_COLOR = {
  critical: '#e03030',
  warning:  '#f5c542',
  info:     '#0064ff',
  success:  '#5bc25b',
}

const SEVERITY_DEFAULT_ICON = {
  critical: '⚠',
  warning:  '↓',
  info:     '◈',
  success:  '✓',
}

const MONO = "'IBM Plex Mono', monospace"

/**
 * @param {object} props
 * @param {'critical'|'warning'|'info'|'success'} props.severity
 * @param {string} [props.icon]               override default icon for severity
 * @param {string} props.title                first line, severity-colored
 * @param {string} [props.subtitle]           grey second segment in header
 * @param {string} [props.snoozeKey]          enables 7d snooze; required for [×]
 * @param {() => void} [props.onSnooze]       called after snooze; usually bumps state
 * @param {'en'|'tr'} [props.lang]            for snooze aria-label
 * @param {string} [props.citation]           passed to <Citation>
 * @param {React.ReactNode} [props.actions]   CTA buttons or nodes
 * @param {React.ReactNode} props.children    body content
 */
export default function Banner({
  severity = 'info',
  icon,
  title,
  subtitle,
  snoozeKey,
  onSnooze,
  lang = 'en',
  citation,
  actions,
  children,
}) {
  const color = SEVERITY_COLOR[severity] || SEVERITY_COLOR.info
  const iconChar = icon || SEVERITY_DEFAULT_ICON[severity] || '◈'

  return (
    <div role={severity === 'critical' ? 'alert' : 'status'} style={{
      marginBottom: '14px',
      padding: '10px 14px',
      background: `${color}10`,
      border: `1px solid ${color}55`,
      borderLeft: `4px solid ${color}`,
      borderRadius: '4px',
      fontFamily: MONO,
      position: 'relative',
    }}>
      {snoozeKey && (
        <button
          onClick={() => {
            snoozeBanner(snoozeKey)
            onSnooze?.()
          }}
          aria-label={lang === 'tr' ? 'Uyarıyı 7 gün ertele' : 'Snooze alert for 7 days'}
          title={lang === 'tr' ? '7 gün ertele' : 'Snooze 7 days'}
          style={{
            position: 'absolute', top: '6px', right: '8px',
            background: 'transparent', border: 'none', color: '#666',
            cursor: 'pointer', fontSize: '12px', padding: '2px 6px', lineHeight: 1,
          }}
        >
          ×
        </button>
      )}

      <div style={{
        fontSize: '10px', fontWeight: 700, color,
        letterSpacing: '0.08em', marginBottom: '6px',
        paddingRight: snoozeKey ? '20px' : 0,
      }}>
        {iconChar} {title}
        {subtitle && (
          <span style={{ color: '#888', fontWeight: 400, marginLeft: '8px' }}>
            {subtitle}
          </span>
        )}
      </div>

      <div style={{ fontSize: '10px', color: '#ccc', lineHeight: 1.55, marginBottom: '4px' }}>
        {children}
      </div>

      {actions && (
        <div style={{ marginTop: '8px' }}>
          {actions}
        </div>
      )}

      {citation && <Citation text={citation} />}
    </div>
  )
}
