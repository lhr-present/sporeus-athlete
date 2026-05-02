// ─── dashboard/SessionVarietyCard.jsx — E122: Session-type variety (28d) ─────
// Surfaces detectSessionVariety() output: 28-day mix of recovery / long /
// steady / tempo / intervals sessions, with a 5-tile legend showing intent
// counts. Sits alongside StaleZonesCard + WorkoutDensityCard as the third
// coaching-insight card.
// Citation: Seiler 2010; Foster 2001.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectSessionVariety } from '../../lib/athlete/sessionVariety.js'

const VARIETY_COLORS = {
  good:     '#5bc25b',
  moderate: '#f5c542',
  low:      '#e03030',
}

const PRESENT_COLOR = '#5bc25b'
const MISSING_COLOR = '#555555'

const INTENT_ORDER = ['recovery', 'long', 'steady', 'tempo', 'intervals']

const INTENT_LABELS = {
  recovery:  { en: 'Recovery',  tr: 'Toparlanma' },
  long:      { en: 'Long',      tr: 'Uzun' },
  steady:    { en: 'Steady',    tr: 'Sabit' },
  tempo:     { en: 'Tempo',     tr: 'Tempo' },
  intervals: { en: 'Intervals', tr: 'İntervaller' },
}

export default function SessionVarietyCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectSessionVariety(log), [log])

  // ─── Empty / unreliable state ──────────────────────────────────────────────
  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={
          isTR ? 'Seans çeşitliliği — yetersiz veri' : 'Session variety — not enough data'
        }
        style={{ ...S.card, animationDelay: '225ms' }}
      >
        <div style={S.cardTitle}>
          {isTR ? 'SEANS ÇEŞİTLİLİĞİ — 28G' : 'SESSION VARIETY — 28D'}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', textAlign: 'center', padding: '14px 0', lineHeight: 1.7 }}>
          {isTR
            ? 'Seans çeşitliliğini görmek için 14+ gün antrenman kaydet'
            : 'Log 14+ days of training to see session variety'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── 5-tile legend (always rendered when reliable) ─────────────────────────
  const legendAriaLabel = isTR
    ? `5 seans tipi karışımı: skor ${result.mixScore}/5`
    : `5 session-type mix: score ${result.mixScore}/5`

  const Legend = (
    <div
      role="list"
      aria-label={legendAriaLabel}
      style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}
    >
      {INTENT_ORDER.map(intent => {
        const count = result.intents[intent] || 0
        const present = count > 0
        const color = present ? PRESENT_COLOR : MISSING_COLOR
        const label = INTENT_LABELS[intent][isTR ? 'tr' : 'en']
        const tileAria = isTR
          ? `${label}: ${count} seans`
          : `${label}: ${count} session${count === 1 ? '' : 's'}`
        return (
          <div
            key={intent}
            role="listitem"
            aria-label={tileAria}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '6px 2px',
              background: `${color}18`,
              border: `1px solid ${color}55`,
              borderRadius: '3px',
              opacity: present ? 1 : 0.7,
            }}
          >
            <div style={{ ...S.mono, fontSize: '10px', fontWeight: 700, color, lineHeight: 1.2 }}>
              {label}
            </div>
            <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', marginTop: '2px', fontWeight: 600 }}>
              {count}
            </div>
          </div>
        )
      })}
    </div>
  )

  // Mix-score badge --------------------------------------------------------
  const accent = VARIETY_COLORS[result.variety] || VARIETY_COLORS.moderate
  const ScoreBadge = (
    <div
      style={{
        ...S.mono,
        fontSize: '11px',
        fontWeight: 700,
        color: accent,
        marginBottom: '8px',
        letterSpacing: '0.04em',
      }}
    >
      {isTR ? `Skor: ${result.mixScore}/5` : `Mix score: ${result.mixScore}/5`}
    </div>
  )

  // ─── Good variety: green tint + ✓ icon, no recommendation ──────────────────
  if (result.variety === 'good') {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Seans çeşitliliği — iyi' : 'Session variety — good'}
        style={{ ...S.card, animationDelay: '225ms', borderLeft: `3px solid ${VARIETY_COLORS.good}` }}
      >
        <div style={S.cardTitle}>
          {isTR ? 'SEANS ÇEŞİTLİLİĞİ — 28G' : 'SESSION VARIETY — 28D'}
        </div>

        {ScoreBadge}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0 10px' }}>
          <div style={{ ...S.mono, fontSize: '20px', color: VARIETY_COLORS.good, fontWeight: 700, lineHeight: 1 }}>
            ✓
          </div>
          <div
            aria-live="polite"
            style={{ ...S.mono, fontSize: '12px', color: 'var(--text)', lineHeight: 1.6 }}
          >
            {result.message[isTR ? 'tr' : 'en']}
          </div>
        </div>

        {Legend}

        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Moderate / low variety — colored border + message + recommendation ────
  const isLow = result.variety === 'low'

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={
        isTR
          ? `Seans çeşitliliği — ${isLow ? 'düşük' : 'orta'}`
          : `Session variety — ${result.variety}`
      }
      style={{ ...S.card, animationDelay: '225ms', borderLeft: `${isLow ? 4 : 3}px solid ${accent}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'SEANS ÇEŞİTLİLİĞİ — 28G' : 'SESSION VARIETY — 28D'}
      </div>

      {ScoreBadge}

      <div
        style={{
          ...S.mono,
          fontSize: isLow ? '13px' : '12px',
          fontWeight: isLow ? 700 : 600,
          color: accent,
          lineHeight: 1.5,
          marginBottom: '6px',
        }}
      >
        {result.message[isTR ? 'tr' : 'en']}
      </div>

      <div
        aria-live="polite"
        style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)', lineHeight: 1.6, marginBottom: '10px' }}
      >
        {result.recommendation[isTR ? 'tr' : 'en']}
      </div>

      {Legend}

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
