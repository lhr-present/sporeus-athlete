// ─── RecoveryProtocolCard.jsx — E26 Recovery Protocol Recommender ────────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { getTopRecoveryProtocols } from '../../lib/athlete/recoveryRecommender.js'

const EVIDENCE_COLOR = {
  strong:   '#5bc25b',
  moderate: '#f5c542',
  limited:  '#e03030',
}

function wellnessColor(score) {
  if (score == null) return '#888'
  if (score >= 4)   return '#5bc25b'
  if (score >= 2.5) return '#f5c542'
  return '#e03030'
}

/**
 * RecoveryProtocolCard
 * Props: { log, recovery }
 */
export default function RecoveryProtocolCard({ log = [], recovery = [] }) {
  const { t, lang } = useContext(LangCtx)

  // Derive latest entries (sorted ascending by date, take last)
  const latestRecovery = [...recovery]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .at(-1) ?? null

  const latestSession = [...log]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .at(-1) ?? null

  const { protocols, wellnessScore } = getTopRecoveryProtocols(latestRecovery, latestSession)

  if (protocols.length === 0) return null

  const _title = lang === 'tr'
    ? t('recoveryProtocolTitle').split('/')[1]?.trim() ?? t('recoveryProtocolTitle')
    : t('recoveryProtocolTitle').split('/')[0]?.trim() ?? t('recoveryProtocolTitle')

  // Simpler: use t() key directly, which already maps per lang
  const cardTitle = t('recoveryProtocolTitle')

  const wColor = wellnessColor(wellnessScore)

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '210ms' }}>
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <div style={{ ...S.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ff6600' }}>
          ◈ {cardTitle}
        </div>
        {wellnessScore != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.05em' }}>
              {t('recoveryWellness')}
            </span>
            <span style={{ ...S.mono, fontSize: '11px', fontWeight: 700, color: wColor, border: `1px solid ${wColor}55`, borderRadius: '3px', padding: '1px 6px' }}>
              {wellnessScore}/5
            </span>
          </div>
        )}
      </div>

      {/* No data hint when both inputs are absent */}
      {latestRecovery == null && latestSession == null && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#555', marginBottom: '10px', fontStyle: 'italic' }}>
          {t('recoveryNoData')}
        </div>
      )}

      {/* Protocol cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {protocols.map(p => {
          const protoName  = lang === 'tr' ? (p.text_tr || p.name) : (p.text_en || p.name)
          const firstStep  = (p.steps?.[0] ?? '').slice(0, 80) + ((p.steps?.[0] ?? '').length > 80 ? '…' : '')
          const evColor    = EVIDENCE_COLOR[p.evidence_level] ?? '#888'

          return (
            <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px 12px' }}>
              {/* Name + badges row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ ...S.mono, fontSize: '10px', fontWeight: 700, color: 'var(--text)', flex: '1 1 120px' }}>
                  {protoName}
                </span>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  {/* Duration badge */}
                  <span style={{ ...S.mono, fontSize: '9px', background: '#555', color: '#aaa', borderRadius: '3px', padding: '1px 6px' }}>
                    {p.duration}
                  </span>
                  {/* Evidence badge */}
                  <span style={{ ...S.mono, fontSize: '9px', color: evColor, border: `1px solid ${evColor}55`, borderRadius: '3px', padding: '1px 6px' }}>
                    {p.evidence_level} {t('recoveryEvidence')}
                  </span>
                </div>
              </div>

              {/* First step */}
              {firstStep && (
                <div style={{ ...S.mono, fontSize: '10px', color: '#888', lineHeight: 1.6, marginBottom: '5px' }}>
                  → {firstStep}
                </div>
              )}

              {/* Source citation */}
              {p.source && (
                <div style={{ ...S.mono, fontSize: '8px', color: '#333', lineHeight: 1.4 }}>
                  {p.source}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
