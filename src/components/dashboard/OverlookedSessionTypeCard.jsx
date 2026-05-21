// ─── dashboard/OverlookedSessionTypeCard.jsx — Dropped-stimulus detector ────
// Surfaces analyzeOverlookedSessionType() output: session types that used to be
// a meaningful part of the athlete's training 30–180 days ago but have
// disappeared from the last 30 days. Bompa 2018 / Issurin 2010 periodization
// — silently abandoned stimuli are flagged so the athlete can decide whether
// the drop is purposeful (block-periodised) or accidental.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeOverlookedSessionType } from '../../lib/athlete/overlookedSessionType.js'

const BAND_COLOR = {
  COMPLETE_REPERTOIRE:  '#5bc25b',
  MINOR_DROPS:          '#f5c542',
  MULTIPLE_DROPS:       '#ff6600',
  INSUFFICIENT_HISTORY: '#888',
}

const BAND_LABEL = {
  COMPLETE_REPERTOIRE:  { en: 'COMPLETE REPERTOIRE', tr: 'TAM REPERTUVAR' },
  MINOR_DROPS:          { en: 'MINOR DROPS',         tr: 'AZ KAYIP' },
  MULTIPLE_DROPS:       { en: 'MULTIPLE DROPS',      tr: 'ÇOKLU KAYIP' },
  INSUFFICIENT_HISTORY: { en: 'NEED MORE HISTORY',   tr: 'YETERSİZ GEÇMİŞ' },
}

const BAND_HINT = {
  COMPLETE_REPERTOIRE: {
    en: 'Every recurrent session type is still appearing in your last 30 days — repertoire intact.',
    tr: 'Tüm tekrar eden seans türleri son 30 günde de görülüyor — repertuvar eksiksiz.',
  },
  MINOR_DROPS: {
    en: 'A small piece of your repertoire has gone quiet recently. Confirm whether the drop is intentional.',
    tr: 'Repertuvarınızın küçük bir kısmı son zamanlarda sessizleşti. Bu kaybın bilinçli olup olmadığını kontrol edin.',
  },
  MULTIPLE_DROPS: {
    en: 'Several once-regular session types are missing from the last 30 days. Likely an unintentional rotation drift.',
    tr: 'Bir zamanlar düzenli olan birkaç seans türü son 30 günden eksik. Muhtemelen istemsiz bir rotasyon kayması.',
  },
  INSUFFICIENT_HISTORY: {
    en: 'Not enough baseline history yet to detect dropped session types — keep logging.',
    tr: 'Düşen seans türlerini tespit etmek için henüz yeterli geçmiş yok — kayıt tutmaya devam edin.',
  },
}

const EXPLAIN_HINT = {
  en: 'Periodisation rotates stimuli in and out across a macrocycle. Athletes can silently drop entire modalities — strength, sprints, long runs — without realising. This flag separates purposeful rotation from accidental drift.',
  tr: 'Periyodizasyon, makro döngü boyunca uyaranları döndürür. Sporcular farkında olmadan tüm modaliteleri — kuvvet, sprint, uzun koşu — sessizce bırakabilir. Bu uyarı, bilinçli rotasyonu kazara sapmadan ayırır.',
}

function fmtDays(n, isTR) {
  if (isTR) return `${n} gün`
  return `${n} day${n === 1 ? '' : 's'}`
}

function fmtBaselineCount(n, isTR) {
  if (isTR) return `${n} seans`
  return `${n} session${n === 1 ? '' : 's'}`
}

export default function OverlookedSessionTypeCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzeOverlookedSessionType({ log }), [log])

  if (!result) return null

  const title = isTR ? 'UNUTULAN ANTRENMAN TÜRLERİ' : 'DROPPED SESSION TYPES'
  const ariaLabel = isTR ? 'Unutulan antrenman türleri' : 'Dropped session types'
  const accent = BAND_COLOR[result.band] || '#888'
  const bandLabel = BAND_LABEL[result.band][isTR ? 'tr' : 'en']
  const bandHint = BAND_HINT[result.band][isTR ? 'tr' : 'en']
  const explain = EXPLAIN_HINT[isTR ? 'tr' : 'en']

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="overlooked-session-type"
      style={{ ...S.card, animationDelay: '470ms', borderLeft: `3px solid ${accent}` }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* Headline stat — count of dropped types */}
      <div
        data-stat="overlooked-count"
        style={{
          ...S.mono,
          fontSize: '32px',
          fontWeight: 700,
          color: accent,
          lineHeight: 1.1,
          marginBottom: '6px',
        }}
      >
        {result.overlookedTypes.length}
      </div>
      <div
        style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '12px',
        }}
      >
        {isTR ? 'son 30 günde eksik tür' : 'types missing in last 30 days'}
      </div>

      {/* Band-coloured status strip */}
      <div
        data-band={result.band}
        style={{
          display: 'inline-block',
          ...S.mono,
          fontSize: '10px',
          fontWeight: 700,
          color: '#fff',
          background: accent,
          padding: '3px 8px',
          borderRadius: '3px',
          letterSpacing: '0.08em',
          marginBottom: '10px',
        }}
      >
        {bandLabel}
      </div>

      {/* Band hint */}
      <div
        aria-live="polite"
        style={{
          ...S.mono,
          fontSize: '12px',
          color: 'var(--text)',
          lineHeight: 1.6,
          marginBottom: '10px',
        }}
      >
        {bandHint}
      </div>

      {/* Positive message on COMPLETE_REPERTOIRE */}
      {result.band === 'COMPLETE_REPERTOIRE' && (
        <div
          data-positive-message="true"
          style={{
            ...S.mono,
            fontSize: '11px',
            color: '#5bc25b',
            lineHeight: 1.6,
            marginBottom: '10px',
            padding: '6px 8px',
            background: 'var(--surface, transparent)',
            borderLeft: '2px solid #5bc25b',
            borderRadius: '3px',
          }}
        >
          {isTR
            ? 'Tüm tekrar eden seans türleri korunuyor — herhangi bir kayıp yok.'
            : 'All recurring session types are being maintained — nothing has fallen off.'}
        </div>
      )}

      {/* Overlooked-type chips */}
      {result.overlookedTypes.length > 0 && (
        <div
          role="list"
          aria-label={isTR ? 'Eksik türler listesi' : 'List of dropped types'}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}
        >
          {result.overlookedTypes.map((o) => (
            <div
              key={o.type}
              role="listitem"
              data-overlooked-type={o.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderLeft: `2px solid ${accent}`,
                background: 'var(--surface, transparent)',
                borderRadius: '3px',
              }}
            >
              <span
                style={{
                  ...S.mono,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: accent,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  flex: '1 1 auto',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.type}
              </span>
              <span
                data-baseline-count={o.baselineCount}
                style={{
                  display: 'inline-block',
                  ...S.mono,
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#fff',
                  background: accent,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  letterSpacing: '0.04em',
                }}
              >
                {fmtBaselineCount(o.baselineCount, isTR)}
              </span>
              <span
                style={{
                  ...S.mono,
                  fontSize: '10px',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                }}
              >
                {isTR
                  ? `${fmtDays(o.daysSinceLastSeen, true)} önce`
                  : `${fmtDays(o.daysSinceLastSeen, false)} ago`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Explainer */}
      <div
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--sub, var(--muted))',
          lineHeight: 1.6,
          marginBottom: '8px',
        }}
      >
        {explain}
      </div>

      {/* Citation footer */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
