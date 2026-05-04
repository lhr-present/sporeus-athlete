// ─── dashboard/SessionRPEDriftCard.jsx — v8.77.0 Session RPE Drift (28d) ───
// Surfaces detectSessionRPEDrift(): RPE-vs-plan drift across ALL typed
// sessions in the last 28 days. Distinct from EasyDayCompliance (easy days
// only) — this watches every type and flags systematic over-execution.
// Cite: Foster 2001 session RPE; Seiler 2010 polarized.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectSessionRPEDrift } from '../../lib/athlete/sessionRPEDrift.js'

const BAND_COLOR = {
  good:     '#28a745',
  moderate: '#ff9500',
  high:     '#dc3545',
}

const BAND_LABEL = {
  good:     { en: 'ON PLAN',  tr: 'PLANDA' },
  moderate: { en: 'MODERATE', tr: 'ORTA' },
  high:     { en: 'HIGH',     tr: 'YÜKSEK' },
}

const TYPE_LABEL = {
  easy:      { en: 'Easy',      tr: 'Kolay' },
  long:      { en: 'Long',      tr: 'Uzun' },
  steady:    { en: 'Steady',    tr: 'Sürekli' },
  threshold: { en: 'Threshold', tr: 'Eşik' },
  intervals: { en: 'Intervals', tr: 'İnterval' },
}

const TYPE_ORDER = ['easy', 'long', 'steady', 'threshold', 'intervals']

export default function SessionRPEDriftCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectSessionRPEDrift(log), [log])

  const title = isTR ? 'SEANS RPE SAPMASI — 28G' : 'SESSION RPE DRIFT — 28D'

  // ─── Insufficient data ─────────────────────────────────────────────────────
  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Seans RPE sapması — yetersiz veri' : 'Session RPE drift — insufficient data'}
        style={{ ...S.card, animationDelay: '260ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Sapmayı görmek için 8+ tipli seans kaydet'
            : 'Log 8+ typed sessions to see drift'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.band] || BAND_COLOR.good
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()
  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  // ─── Healthy good-band shortcut ────────────────────────────────────────────
  if (result.band === 'good') {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Seans RPE sapması — planda' : 'Session RPE drift — on plan'}
        style={{ ...S.card, animationDelay: '260ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
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

        <div style={{ ...S.mono, fontSize: '12px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '6px' }}>
          {isTR ? 'Seanslar planda' : 'Sessions on plan'}
          <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--muted)' }}>·</span>
          <span aria-live="polite" style={{ color: accent, fontWeight: 700 }}>{result.driftPct}%</span>
        </div>

        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Drift band render (moderate / high) ───────────────────────────────────
  const typeBreakdown = TYPE_ORDER
    .filter(k => result.byType[k] && result.byType[k].drift >= 1)
    .map(k => ({
      key: k,
      label: TYPE_LABEL[k][isTR ? 'tr' : 'en'],
      drift: result.byType[k].drift,
      total: result.byType[k].total,
    }))

  const ariaPct = isTR
    ? `${bandLbl} — %${result.driftPct} sapma, ${result.totalSessions} seansın ${result.driftSessions}'i`
    : `${bandLbl} — ${result.driftPct}% drift, ${result.driftSessions} of ${result.totalSessions} sessions`

  const { mild, moderate: modSev, severe } = result.bySeverity

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Seans RPE sapması' : 'Session RPE drift'}
      style={{ ...S.card, animationDelay: '260ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
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

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', padding: '4px 0 6px' }}>
        <div
          aria-live="polite"
          aria-label={ariaPct}
          style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {result.driftPct}
          <span style={{ fontSize: '18px', fontWeight: 600, marginLeft: '2px' }}>%</span>
        </div>
        <div style={{
          ...S.mono,
          fontSize: '9px',
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          paddingBottom: '4px',
        }}>
          DRIFT<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>SAPMA
        </div>
      </div>

      <div style={{
        ...S.mono,
        fontSize: '11px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '8px',
        letterSpacing: '0.03em',
      }}>
        {isTR
          ? `${result.totalSessions} seansın ${result.driftSessions}'i`
          : `${result.driftSessions}/${result.totalSessions} sessions`}
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '8px',
        letterSpacing: '0.03em',
      }}>
        {mild} {isTR ? 'hafif' : 'mild'}
        <span aria-hidden="true" style={{ margin: '0 4px', color: 'var(--muted)' }}>·</span>
        {modSev} {isTR ? 'orta' : 'mod'}
        <span aria-hidden="true" style={{ margin: '0 4px', color: 'var(--muted)' }}>·</span>
        {severe} {isTR ? 'şiddetli' : 'severe'}
      </div>

      {typeBreakdown.length > 0 ? (
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--sub, var(--muted))',
          marginBottom: '8px',
          letterSpacing: '0.03em',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 0',
        }}>
          {typeBreakdown.map((t, i) => (
            <span key={t.key}>
              {t.label} {t.drift}/{t.total}
              {i < typeBreakdown.length - 1
                ? <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--muted)' }}>·</span>
                : null}
            </span>
          ))}
        </div>
      ) : null}

      {result.worstType ? (
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: accent,
          marginBottom: '8px',
          letterSpacing: '0.03em',
        }}>
          {isTR
            ? `En kötü: ${TYPE_LABEL[result.worstType]?.tr || result.worstType}`
            : `Worst: ${TYPE_LABEL[result.worstType]?.en || result.worstType}`}
        </div>
      ) : null}

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
