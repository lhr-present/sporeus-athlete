// ── dashboard/InjuryPatternCard.jsx — E35 Injury Pattern Mining Card ──────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeInjuryPatterns, confidenceColor } from '../../lib/athlete/injuryPatterns.js'

export default function InjuryPatternCard({ log, injuries, recovery }) {
  const { t, lang } = useContext(LangCtx)
  const result = computeInjuryPatterns(log || [], injuries || [], recovery || [])

  // Not enough data
  if (!result) {
    return (
      <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
        <div style={{ ...S.mono, fontSize: '11px', fontWeight: 600, color: '#ff6600', letterSpacing: '0.08em', marginBottom: '8px' }}>
          ◈ {t('injPatternTitle')}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888' }}>
          {t('injPatternNeedMore')}
        </div>
      </div>
    )
  }

  const { patterns, vulnerableZones, protectiveFactors, topPattern, citation } = result

  // injuries exist but no triggers found → no patterns
  if (patterns.length === 0) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms', borderLeft: '3px solid #ff6600' }}>
      {/* Title */}
      <div style={{ ...S.mono, fontSize: '11px', fontWeight: 600, color: '#ff6600', letterSpacing: '0.08em', marginBottom: '10px' }}>
        ◈ {t('injPatternTitle')}
      </div>

      {/* Vulnerable zones chips */}
      {vulnerableZones.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.06em', marginBottom: '5px' }}>
            {t('injPatternVulnerable')}
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {vulnerableZones.map(zone => (
              <span
                key={zone}
                style={{ ...S.mono, fontSize: '10px', background: '#e03030', color: '#fff', padding: '2px 8px', borderRadius: '3px', letterSpacing: '0.04em' }}
              >
                {zone.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top pattern block */}
      {topPattern && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '10px', marginBottom: '10px' }}>
          {/* Zone label + confidence badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ ...S.mono, fontSize: '12px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>
              {topPattern.zone.replace(/_/g, ' ')}
            </span>
            <span style={{ ...S.mono, fontSize: '9px', color: confidenceColor(topPattern.confidence), border: `1px solid ${confidenceColor(topPattern.confidence)}55`, padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {topPattern.confidence}
            </span>
            <span style={{ ...S.mono, fontSize: '9px', color: '#555' }}>
              {topPattern.occurrences}×
            </span>
          </div>

          {/* Trigger tags */}
          {topPattern.triggers && topPattern.triggers.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '7px' }}>
              {topPattern.triggers.map(trigger => (
                <span
                  key={trigger}
                  style={{ ...S.mono, fontSize: '9px', background: '#333', color: '#aaa', padding: '2px 7px', borderRadius: '3px', letterSpacing: '0.02em' }}
                >
                  {trigger.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* Pattern description */}
          <div style={{ ...S.mono, fontSize: '10px', color: '#888', lineHeight: 1.6 }}>
            {topPattern[lang] || topPattern.en}
          </div>
        </div>
      )}

      {/* Protective factors */}
      {protectiveFactors && protectiveFactors.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ ...S.mono, fontSize: '9px', color: '#5bc25b', letterSpacing: '0.06em', marginBottom: '4px' }}>
            {t('injPatternProtective')}
          </div>
          {protectiveFactors.map((f, i) => (
            <div
              key={i}
              style={{ ...S.mono, fontSize: '10px', color: '#5bc25b', lineHeight: 1.6, borderLeft: '2px solid #5bc25b44', paddingLeft: '8px', marginBottom: '4px' }}
            >
              ✓ {f[lang] || f.en}
            </div>
          ))}
        </div>
      )}

      {/* Citation */}
      <div style={{ ...S.mono, fontSize: '8px', color: '#333', borderTop: '1px solid var(--border)', paddingTop: '6px', letterSpacing: '0.04em' }}>
        {citation}
      </div>
    </div>
  )
}
