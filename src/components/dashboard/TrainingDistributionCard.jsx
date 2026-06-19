// ─── dashboard/TrainingDistributionCard.jsx — E128: Training Distribution ────
// Surfaces detectTrainingDistribution(): season-level (84-day default) zone +
// intent distribution with polarized-model match badge. Complements the 28-day
// coaching-insight cluster by giving a longer-window perspective.
// Citation: Seiler 2010; Stöggl & Sperlich 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectTrainingDistribution } from '../../lib/athlete/trainingDistribution.js'

const ZONE_KEYS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
const ZONE_COLORS = {
  Z1: '#5bc25b',
  Z2: '#3a8f3a',
  Z3: '#f5c542',
  Z4: '#f57c42',
  Z5: '#e03030',
}

const BAND_COLORS = {
  good:     '#5bc25b',
  moderate: '#f5c542',
  poor:     '#e03030',
}

const BAND_LABEL = {
  good:     { en: 'GOOD',     tr: 'İYİ' },
  moderate: { en: 'MODERATE', tr: 'ORTA' },
  poor:     { en: 'POOR',     tr: 'ZAYIF' },
}

const INTENT_KEYS = ['recovery', 'long', 'steady', 'tempo', 'intervals']
const INTENT_LABEL = {
  recovery:  { en: 'Recovery',  tr: 'Toparlanma' },
  long:      { en: 'Long',      tr: 'Uzun' },
  steady:    { en: 'Steady',    tr: 'Sabit' },
  tempo:     { en: 'Tempo',     tr: 'Tempo' },
  intervals: { en: 'Intervals', tr: 'İntervaller' },
}

function TrainingDistributionCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectTrainingDistribution(log), [log])

  // ─── Empty / unreliable state ──────────────────────────────────────────────
  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Sezon antrenman dağılımı — yetersiz veri' : 'Season training distribution — not enough data'}
        style={{ ...S.card, animationDelay: '300ms' }}
      >
        <div style={S.cardTitle}>
          {isTR ? 'ANTRENMAN DAĞILIMI — 84G' : 'TRAINING DISTRIBUTION — 84D'}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', textAlign: 'center', padding: '14px 0', lineHeight: 1.7 }}>
          {isTR
            ? 'Sezon dağılımı için 4+ hafta antrenman kaydet'
            : 'Log 4+ weeks to see season distribution'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Reliable render ───────────────────────────────────────────────────────
  const bandColor = BAND_COLORS[result.polarizedMatch] || BAND_COLORS.poor
  const bandLbl = BAND_LABEL[result.polarizedMatch]?.[isTR ? 'tr' : 'en']
    || result.polarizedMatch.toUpperCase()

  const zoneAria = isTR
    ? `Z1 %${result.zones.Z1}, Z2 %${result.zones.Z2}, Z3 %${result.zones.Z3}, Z4 %${result.zones.Z4}, Z5 %${result.zones.Z5}`
    : `Z1 ${result.zones.Z1}%, Z2 ${result.zones.Z2}%, Z3 ${result.zones.Z3}%, Z4 ${result.zones.Z4}%, Z5 ${result.zones.Z5}%`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Sezon antrenman dağılımı' : 'Season training distribution'}
      style={{ ...S.card, animationDelay: '300ms', borderLeft: `3px solid ${bandColor}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'ANTRENMAN DAĞILIMI — 84G' : 'TRAINING DISTRIBUTION — 84D'}
      </div>

      {/* Zone bars row (single stacked bar) ----------------------------------- */}
      <div
        role="img"
        aria-label={zoneAria}
        style={{
          display: 'flex',
          width: '100%',
          height: '18px',
          borderRadius: '3px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          marginBottom: '6px',
        }}
      >
        {ZONE_KEYS.map(z => {
          const pct = result.zones[z] || 0
          if (pct <= 0) return null
          return (
            <div
              key={z}
              title={`${z} ${pct}%`}
              style={{
                width: `${pct}%`,
                background: ZONE_COLORS[z],
                height: '100%',
              }}
            />
          )
        })}
      </div>

      {/* Zone legend (label + percentage) ------------------------------------- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '4px',
          marginBottom: '10px',
          flexWrap: 'wrap',
        }}
      >
        {ZONE_KEYS.map(z => (
          <div
            key={z}
            style={{
              ...S.mono,
              fontSize: '10px',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                background: ZONE_COLORS[z],
                borderRadius: '2px',
              }}
            />
            <span style={{ fontWeight: 600 }}>{z}</span>
            <span style={{ color: 'var(--sub)' }}>{result.zones[z]}%</span>
          </div>
        ))}
      </div>

      {/* Polarized match badge ------------------------------------------------ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <div
          style={{
            ...S.mono,
            fontSize: '10px',
            color: 'var(--muted)',
            letterSpacing: '0.04em',
          }}
        >
          {isTR ? 'POLARİZE 80/20' : 'POLARIZED 80/20'}
        </div>
        <div
          style={{
            ...S.mono,
            fontSize: '10px',
            fontWeight: 700,
            color: bandColor,
            background: `${bandColor}18`,
            border: `1px solid ${bandColor}55`,
            borderRadius: '3px',
            padding: '2px 8px',
            letterSpacing: '0.04em',
          }}
        >
          {bandLbl}
        </div>
      </div>

      {/* Polarized note ------------------------------------------------------- */}
      <div
        aria-live="polite"
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${bandColor}`,
          marginBottom: '10px',
        }}
      >
        {result.polarizedNote[isTR ? 'tr' : 'en']}
      </div>

      {/* Weekly averages ------------------------------------------------------ */}
      <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)', marginBottom: '8px' }}>
        {isTR
          ? `Haftada ${result.weeklyAvg.tss} TSS · ${result.weeklyAvg.durationMin} dk · ${result.weeklyAvg.sessions} seans`
          : `${result.weeklyAvg.tss} TSS · ${result.weeklyAvg.durationMin} min · ${result.weeklyAvg.sessions} sessions per week`}
      </div>

      {/* Intent breakdown ----------------------------------------------------- */}
      <div
        role="list"
        aria-label={isTR ? 'Niyet dağılımı' : 'Intent breakdown'}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 10px',
          marginBottom: '8px',
        }}
      >
        {INTENT_KEYS.map(k => (
          <div
            key={k}
            role="listitem"
            style={{
              ...S.mono,
              fontSize: '10px',
              color: 'var(--sub)',
            }}
          >
            <span style={{ color: 'var(--text)' }}>
              {INTENT_LABEL[k][isTR ? 'tr' : 'en']}
            </span>{' '}
            {result.intents[k]}%
          </div>
        ))}
      </div>

      {/* Citation footer ------------------------------------------------------ */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(TrainingDistributionCard)
