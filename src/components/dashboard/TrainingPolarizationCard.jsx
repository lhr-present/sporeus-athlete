// ─── dashboard/TrainingPolarizationCard.jsx — v8.82.0 Polarization Pattern ──
// Surfaces detectTrainingPolarization(): Esteve-Lanao 2007 categorical pattern
// classifier — pyramidal/polarized/threshold/mixed. Distinct from
// TrainingDistribution (84d polarized fit) — this surface labels the explicit
// template shape and reports the polarization index.
// Cite: Esteve-Lanao 2007; Seiler 2010; Stöggl & Sperlich 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectTrainingPolarization } from '../../lib/athlete/trainingPolarization.js'

const PATTERN_COLOR = {
  polarized: '#28a745',
  pyramidal: '#0064ff',
  threshold: '#dc3545',
  mixed:     '#ff9500',
}

const PATTERN_LABEL = {
  polarized: { en: 'POLARIZED', tr: 'POLARİZE' },
  pyramidal: { en: 'PYRAMIDAL', tr: 'PİRAMİT' },
  threshold: { en: 'THRESHOLD', tr: 'EŞİK' },
  mixed:     { en: 'MIXED',     tr: 'KARIŞIK' },
}

const ZONE_KEYS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
const ZONE_COLORS = {
  Z1: '#28a745',
  Z2: '#9acd32',
  Z3: '#ffd700',
  Z4: '#ff9500',
  Z5: '#dc3545',
}

function TrainingPolarizationCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectTrainingPolarization(log), [log])

  const title = isTR ? 'POLARİZASYON DESENİ' : 'TRAINING POLARIZATION'

  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR
          ? 'Polarizasyon deseni — yetersiz veri'
          : 'Training polarization — insufficient data'}
        style={{ ...S.card, animationDelay: '340ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Desen tespiti için 200+ dk ve 7+ gün veri gerekli'
            : 'Log 200+ minutes over 7+ days to detect pattern'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = PATTERN_COLOR[result.pattern] || PATTERN_COLOR.mixed
  const patternLbl = PATTERN_LABEL[result.pattern]?.[isTR ? 'tr' : 'en']
    || result.pattern.toUpperCase()

  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  const lowSum = Math.round((result.shares.Z1 + result.shares.Z2) * 10) / 10
  const midSum = result.shares.Z3
  const hiSum = Math.round((result.shares.Z4 + result.shares.Z5) * 10) / 10

  const piStr = result.polarizationIndex == null
    ? '—'
    : result.polarizationIndex.toFixed(1)

  const barAria = isTR
    ? `Z1 %${result.shares.Z1}, Z2 %${result.shares.Z2}, Z3 %${result.shares.Z3}, Z4 %${result.shares.Z4}, Z5 %${result.shares.Z5}`
    : `Z1 ${result.shares.Z1}%, Z2 ${result.shares.Z2}%, Z3 ${result.shares.Z3}%, Z4 ${result.shares.Z4}%, Z5 ${result.shares.Z5}%`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Polarizasyon deseni' : 'Training polarization'}
      style={{ ...S.card, animationDelay: '340ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
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
        {patternLbl}
      </div>

      <div
        role="img"
        aria-label={barAria}
        style={{
          display: 'flex',
          width: '100%',
          height: '14px',
          borderRadius: '3px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          marginBottom: '10px',
        }}
      >
        {ZONE_KEYS.map(z => {
          const pct = result.shares[z] || 0
          if (pct <= 0) return null
          return (
            <div
              key={z}
              title={`${z} ${pct}%`}
              aria-label={`${z} ${pct}%`}
              style={{ width: `${pct}%`, background: ZONE_COLORS[z], height: '100%' }}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', padding: '4px 0 8px' }}>
        <div
          aria-live="polite"
          style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {piStr}
        </div>
        <div style={{
          ...S.mono,
          fontSize: '9px',
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          paddingBottom: '4px',
        }}>
          POL INDEX<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>POL ENDEKSİ
        </div>
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '6px',
        letterSpacing: '0.04em',
      }}>
        {`Z1+Z2: ${lowSum}%`}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {`Z3: ${midSum}%`}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {`Z4+Z5: ${hiSum}%`}
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '10px',
        letterSpacing: '0.04em',
      }}>
        {`${result.totalMinutes} min over ${result.windowDays}d`}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {`${result.windowDays}G'de ${result.totalMinutes} dk`}
      </div>

      {message ? (
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
      ) : null}

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

export default memo(TrainingPolarizationCard)
