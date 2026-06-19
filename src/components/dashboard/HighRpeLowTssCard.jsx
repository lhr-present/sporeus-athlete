// ─── dashboard/HighRpeLowTssCard.jsx — Effort-Load Mismatch Fatigue Card ────
// Surfaces analyzeHighRpeLowTss(): sessions where the athlete reported HIGH
// effort (RPE) for LOW objective load (TSS) compared to their personal
// baseline. One mismatch is noise; a pattern is a fatigue / illness /
// under-recovery flag.
//
// Distinct from sessionRPEDrift (plan-vs-actual) and rpeStability
// (within-type variance). This card asks: is the body returning less
// objective load for the same subjective effort?
//
// Cite: Foster 2017; Halson 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeHighRpeLowTss } from '../../lib/athlete/highRpeLowTss.js'

const BAND_COLOR = {
  WELL_MATCHED:        '#28a745',
  OCCASIONAL_MISMATCH: '#ff9500',
  PERSISTENT_FATIGUE:  '#dc3545',
  INSUFFICIENT_DATA:   '#888',
}

const BAND_LABEL = {
  WELL_MATCHED:        { en: 'WELL MATCHED',        tr: 'UYUMLU' },
  OCCASIONAL_MISMATCH: { en: 'OCCASIONAL MISMATCH', tr: 'ARA SIRA UYUMSUZ' },
  PERSISTENT_FATIGUE:  { en: 'PERSISTENT FATIGUE',  tr: 'KALICI YORGUNLUK' },
  INSUFFICIENT_DATA:   { en: 'INSUFFICIENT DATA',   tr: 'YETERSİZ VERİ' },
}

const HINT = {
  WELL_MATCHED: {
    en: 'Effort and objective load track together — no fatigue signal in the recent window.',
    tr: 'Efor ve objektif yük birlikte hareket ediyor — son pencerede yorgunluk sinyali yok.',
  },
  OCCASIONAL_MISMATCH: {
    en: 'Some sessions are feeling harder than the load explains — watch for sleep, fueling, illness.',
    tr: 'Bazı seanslar yükün açıkladığından zor geliyor — uyku, beslenme, hastalığa dikkat.',
  },
  PERSISTENT_FATIGUE: {
    en: 'Recurring effort-load mismatch — back off intensity and review recovery factors.',
    tr: 'Tekrarlayan efor-yük uyumsuzluğu — yoğunluğu düşür ve toparlanma etkenlerini gözden geçir.',
  },
  INSUFFICIENT_DATA: {
    en: 'Need 20+ baseline sessions with RPE and TSS to build a personal mismatch threshold.',
    tr: 'Kişisel uyumsuzluk eşiği için RPE ve TSS içeren 20+ temel seans gerekli.',
  },
}

function fmtPct(rate) {
  if (!Number.isFinite(rate)) return '0%'
  return `${Math.round(rate * 100)}%`
}

function fmtDateShort(iso, isTR) {
  if (typeof iso !== 'string' || iso.length < 10) return ''
  const md = iso.slice(5, 10) // MM-DD
  if (!isTR) return md
  // Turkish: DD/MM short form
  return `${md.slice(3)}/${md.slice(0, 2)}`
}

function HighRpeLowTssCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzeHighRpeLowTss({ log }), [log])

  if (!result) return null

  const {
    band,
    mismatches,
    totalSessionsAnalyzed,
    mismatchCount,
    mismatchRate,
    baselineSessionsUsed,
    citation,
  } = result

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = BAND_LABEL[band]?.[isTR ? 'tr' : 'en'] || band
  const hint = HINT[band]?.[isTR ? 'tr' : 'en'] || ''

  const title = isTR ? 'EFOR-YÜK UYUMSUZLUĞU' : 'EFFORT-LOAD MISMATCH'
  const ariaLabel = isTR
    ? 'Efor-yük uyumsuzluğu — yüksek RPE düşük TSS yorgunluk dedektörü'
    : 'Effort-load mismatch — high-RPE low-TSS fatigue detector'

  // ─── Insufficient data short-circuit ──────────────────────────────────────
  if (band === 'INSUFFICIENT_DATA') {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={ariaLabel}
        data-card="high-rpe-low-tss"
        data-band={band}
        data-baseline-sessions={String(baselineSessionsUsed)}
        style={{
          ...S.card,
          animationDelay: '500ms',
          borderLeft: `4px solid ${color}`,
          padding: '20px',
        }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          display: 'inline-block',
          ...S.mono,
          fontSize: '10px',
          fontWeight: 700,
          color: '#fff',
          background: color,
          padding: '4px 10px',
          borderRadius: '3px',
          letterSpacing: '0.08em',
          marginBottom: '12px',
        }}>
          {bandLabel}
        </div>

        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${color}`,
          marginBottom: '8px',
        }}>
          {hint}
        </div>

        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          marginBottom: '8px',
        }}>
          {isTR
            ? `Temel seans: ${baselineSessionsUsed} / 20`
            : `Baseline sessions: ${baselineSessionsUsed} / 20`}
        </div>

        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {citation}
        </div>
      </div>
    )
  }

  // ─── Populated render (any of the three real bands) ───────────────────────
  const recentMismatches = mismatches.slice(-3).reverse() // newest first, max 3

  const statAria = isTR
    ? `${mismatchCount} uyumsuz seans, toplam ${totalSessionsAnalyzed} seansta`
    : `${mismatchCount} mismatched sessions out of ${totalSessionsAnalyzed}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="high-rpe-low-tss"
      data-band={band}
      data-mismatch-count={String(mismatchCount)}
      data-mismatch-rate={mismatchRate.toFixed(4)}
      data-total-sessions={String(totalSessionsAnalyzed)}
      data-baseline-sessions={String(baselineSessionsUsed)}
      style={{
        ...S.card,
        animationDelay: '500ms',
        borderLeft: `4px solid ${color}`,
        padding: '20px',
      }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* ── Band chip ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'inline-block',
        ...S.mono,
        fontSize: '10px',
        fontWeight: 700,
        color: '#fff',
        background: color,
        padding: '4px 10px',
        borderRadius: '3px',
        letterSpacing: '0.08em',
        marginBottom: '12px',
      }}>
        {bandLabel}
      </div>

      {/* ── Big stat ──────────────────────────────────────────────────────── */}
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '2px 0 6px' }}
      >
        <div
          aria-live="polite"
          aria-label={statAria}
          style={{
            ...S.mono,
            fontSize: '36px',
            fontWeight: 700,
            color,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {mismatchCount}
        </div>
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          paddingBottom: '6px',
        }}>
          {isTR ? 'UYUMSUZ' : 'MISMATCHES'}
          <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--muted)' }}>·</span>
          <span style={{ color, fontWeight: 700 }}>{fmtPct(mismatchRate)}</span>
        </div>
      </div>

      <div style={{
        ...S.mono,
        fontSize: '11px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '10px',
        letterSpacing: '0.03em',
      }}>
        {isTR
          ? `${totalSessionsAnalyzed} seansın ${mismatchCount}'i`
          : `${mismatchCount} of ${totalSessionsAnalyzed} sessions`}
      </div>

      {/* ── Recent mismatch chips (max 3) ─────────────────────────────────── */}
      {recentMismatches.length > 0 ? (
        <div
          data-mismatch-chips=""
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '12px',
          }}
        >
          {recentMismatches.map((m) => {
            const dateStr = fmtDateShort(m.date, isTR)
            const chipAria = isTR
              ? `${dateStr} — RPE ${m.rpe}, TSS ${Math.round(m.tss)}, beklenen ${Math.round(m.expectedTss)}`
              : `${dateStr} — RPE ${m.rpe}, TSS ${Math.round(m.tss)}, expected ${Math.round(m.expectedTss)}`
            return (
              <span
                key={m.date}
                data-mismatch-chip=""
                data-chip-date={m.date}
                aria-label={chipAria}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  ...S.mono,
                  fontSize: '10px',
                  color: 'var(--text)',
                  background: 'var(--surface, rgba(255, 255, 255, 0.04))',
                  border: `1px solid ${color}`,
                  borderRadius: '3px',
                  padding: '3px 8px',
                  letterSpacing: '0.04em',
                }}
              >
                <span style={{ fontWeight: 600 }}>{dateStr}</span>
                <span style={{ color: 'var(--muted)' }}>
                  RPE {m.rpe}
                </span>
                <span style={{ color }}>
                  {Math.round(m.tss)}/{Math.round(m.expectedTss)} TSS
                </span>
              </span>
            )
          })}
        </div>
      ) : null}

      {/* ── Hint ──────────────────────────────────────────────────────────── */}
      <div style={{
        ...S.mono,
        fontSize: '11px',
        color: 'var(--text)',
        lineHeight: 1.6,
        paddingLeft: '8px',
        borderLeft: `2px solid ${color}`,
        marginBottom: '8px',
      }}>
        {hint}
      </div>

      <div style={{
        ...S.mono,
        fontSize: '9px',
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        marginBottom: '4px',
      }}>
        {isTR
          ? `Temel: ${baselineSessionsUsed} seans`
          : `Baseline: ${baselineSessionsUsed} sessions`}
      </div>

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(HighRpeLowTssCard)
