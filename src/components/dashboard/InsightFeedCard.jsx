// src/components/dashboard/InsightFeedCard.jsx — E25
// Renders up to 3 insight cards (milestone / fitness / consistency / workload).
// Returns null when log is too short (< 5 entries).
// Shows "No active insights" state when log is long enough but no cards fire.
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { getInsightFeed } from '../../lib/athlete/insightFeed.js'

const TYPE_COLOR = {
  milestone:   '#ff6600',
  weekly_fitness: '#0064ff',
  fitness:     '#0064ff',
  consistency: '#5bc25b',
  workload_pattern: '#f5c542',
  workload:    '#f5c542',
}

function accentColor(type) {
  return TYPE_COLOR[type] || '#555'
}

export default function InsightFeedCard({ log = [] }) {
  const { t, lang } = useContext(LangCtx)

  // Log too short — render nothing at all
  if (!Array.isArray(log) || log.length < 5) return null

  const today = new Date().toISOString().slice(0, 10)
  const cards = getInsightFeed(log, today).slice(0, 3)

  const titleText = lang === 'tr'
    ? `◈ ${t('insightFeedTitle')}`
    : `◈ ${t('insightFeedTitle')}`

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '195ms' }}>
      <div style={{ ...S.cardTitle, color: '#ff6600', marginBottom: '10px' }}>
        {titleText}
      </div>

      {cards.length === 0 ? (
        <div style={{ ...S.mono, fontSize: '11px', color: '#555', padding: '6px 0' }}>
          {t('insightFeedEmpty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {cards.map((card, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              {/* 3px left accent bar */}
              <div
                style={{
                  width: '3px',
                  minHeight: '100%',
                  alignSelf: 'stretch',
                  background: accentColor(card.type),
                  borderRadius: '2px',
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  ...S.mono,
                  fontSize: '10px',
                  color: '#ccc',
                  lineHeight: 1.6,
                  flex: 1,
                }}
              >
                {card[lang] || card.en}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
