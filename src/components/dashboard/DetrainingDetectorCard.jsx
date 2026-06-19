// ─── dashboard/DetrainingDetectorCard.jsx — E130: Detraining Detector ───────
// Surfaces detectDetraining(): scans the training log for gaps ≥7 days and
// outputs a return-to-training recommendation per Mujika & Padilla 2000.
// Severity bands: minor 7-13d, moderate 14-21d, major 22-42d, severe >42d.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectDetraining } from '../../lib/athlete/detrainingDetector.js'

const BAND_COLOR = {
  minor:    '#f5c542',
  moderate: '#ff8c00',
  major:    '#e03030',
  severe:   '#a40000',
}

const BAND_LABEL = {
  minor:    { en: 'MINOR',    tr: 'HAFİF' },
  moderate: { en: 'MODERATE', tr: 'ORTA' },
  major:    { en: 'MAJOR',    tr: 'BÜYÜK' },
  severe:   { en: 'SEVERE',   tr: 'ŞİDDETLİ' },
}

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function daysBetween(earlier, later) {
  const a = new Date(earlier + 'T00:00:00Z').getTime()
  const b = new Date(later + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

// ─── Ramp guidance per band (consumer-friendly, derived from lib spec) ──────
const RAMP_GUIDANCE = {
  minor: {
    en: 'Ramp: 1-3 days easy (RPE 3-4), then resume planned training.',
    tr: 'Rampa: 1-3 gün kolay (RPE 3-4), sonra planlı antrenmana dön.',
  },
  moderate: {
    en: 'Ramp: 7 days Z1-Z2 only before introducing any quality work.',
    tr: 'Rampa: 7 gün sadece Z1-Z2, sonra kalite çalışmasına başla.',
  },
  major: {
    en: 'Ramp: 2-week aerobic base block; cut peak target by 10-15%.',
    tr: 'Rampa: 2 hafta aerobik temel; pik hedefi %10-15 düşür.',
  },
  severe: {
    en: 'Ramp: 4 weeks progressive; restart at 50% of prior CTL.',
    tr: 'Rampa: 4 hafta artan; önceki CTL\'nin %50\'sinde başla.',
  },
}

function DetrainingDetectorCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectDetraining(log), [log])

  const title = isTR ? 'FORM KAYBI DEDEKTÖRÜ' : 'DETRAINING DETECTOR'

  // ─── Insufficient history ───────────────────────────────────────────────────
  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Form kaybı dedektörü — yetersiz geçmiş' : 'Detraining detector — insufficient history'}
        style={{ ...S.card, animationDelay: '180ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Form kaybını izlemek için 14+ seans kaydet'
            : 'Log 14+ sessions to track detraining'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── No active gap → most recently closed gap (if any) drives "back" line ──
  const sortedGaps = [...result.gaps].sort((a, b) => a.endDate < b.endDate ? -1 : 1)
  const lastClosedGap = sortedGaps
    .filter(g => g.endDate < todayStr())
    .slice(-1)[0] || null

  // ─── Healthy state — no active gap and no recent closed gap to surface ────
  if (!result.inActiveGap && !lastClosedGap) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Form kaybı dedektörü — temiz' : 'Detraining detector — no recent gap'}
        style={{ ...S.card, animationDelay: '180ms', borderLeft: '4px solid #5bc25b' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '12px', color: 'var(--text)',
          padding: '10px 0', lineHeight: 1.6,
        }}>
          {isTR
            ? 'Son haftalarda 7 günden uzun ara yok — süreklilik korunmuş.'
            : 'No gap longer than 7 days recently — continuity intact.'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Gap exists: pick the active gap if present, else most recent closed ──
  const focusGap = result.inActiveGap
    ? sortedGaps[sortedGaps.length - 1]
    : lastClosedGap

  const severity = focusGap.severity
  const accent = BAND_COLOR[severity]
  const bandLbl = BAND_LABEL[severity][isTR ? 'tr' : 'en']
  const gapDays = focusGap.durationDays
  const description = focusGap.description?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.inActiveGap
    ? (result.recommendation[isTR ? 'tr' : 'en'] || '')
    : ''
  const rampGuidance = RAMP_GUIDANCE[severity]?.[isTR ? 'tr' : 'en'] || ''

  // daysSinceReturn = days between gap end and today, only if gap is closed
  const daysSinceReturn = !result.inActiveGap
    ? Math.max(0, daysBetween(focusGap.endDate, todayStr()))
    : null

  const gapAria = isTR
    ? `${gapDays} gün ara, ${bandLbl.toLowerCase()} seviye`
    : `${gapDays} days off, ${severity} severity`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Form kaybı dedektörü' : 'Detraining detector'}
      style={{ ...S.card, animationDelay: '180ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* ─── Severity badge ────────────────────────────────────────────────── */}
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

      {/* ─── Big gap-days number ──────────────────────────────────────────── */}
      <div
        aria-live="polite"
        aria-label={gapAria}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '10px',
          padding: '4px 0 8px',
        }}
      >
        <div style={{
          ...S.mono,
          fontSize: '44px',
          fontWeight: 700,
          color: accent,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          {gapDays}
        </div>
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {isTR ? 'GÜN ARA' : 'DAYS OFF'}
          <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
          {isTR ? 'DAYS OFF' : 'GÜN ARA'}
        </div>
      </div>

      {/* ─── Date range (mono, small) ─────────────────────────────────────── */}
      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '10px',
        letterSpacing: '0.04em',
      }}>
        {focusGap.startDate} → {focusGap.endDate}
      </div>

      {/* ─── daysSinceReturn line (closed gaps only) ──────────────────────── */}
      {daysSinceReturn !== null && daysSinceReturn > 0 && (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: '#5bc25b',
          marginBottom: '10px',
        }}>
          {isTR
            ? `${daysSinceReturn} gün döndü`
            : `${daysSinceReturn} day${daysSinceReturn === 1 ? '' : 's'} back`}
        </div>
      )}

      {/* ─── Bilingual description (gap message) ──────────────────────────── */}
      {description && (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${accent}`,
          marginBottom: '8px',
        }}>
          {description}
        </div>
      )}

      {/* ─── Bilingual recommendation (active gap only) ───────────────────── */}
      {recommendation && (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--sub, var(--muted))',
          lineHeight: 1.6,
          marginBottom: '8px',
        }}>
          {recommendation}
        </div>
      )}

      {/* ─── Ramp guidance callout ────────────────────────────────────────── */}
      {rampGuidance && (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: accent,
          background: `${accent}14`,
          border: `1px solid ${accent}44`,
          borderRadius: '3px',
          padding: '6px 8px',
          lineHeight: 1.5,
          marginBottom: '8px',
        }}>
          {rampGuidance}
        </div>
      )}

      {/* ─── Citation footer ──────────────────────────────────────────────── */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(DetrainingDetectorCard)
