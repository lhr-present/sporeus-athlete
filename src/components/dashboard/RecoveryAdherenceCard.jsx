// ─── dashboard/RecoveryAdherenceCard.jsx — v8.84.0 Recovery-Day Adherence ───
// Surfaces detectRecoveryAdherence(): 28-day check that planned rest days
// stayed restful. Distinct from EasyDayCompliance (RPE drift on easy work)
// and DetrainingDetector (full inactivity gaps).
// Cite: Halson 2014 recovery; Foster 2001 monotony.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectRecoveryAdherence } from '../../lib/athlete/recoveryAdherence.js'

const BAND_COLOR = {
  good:     '#28a745',
  moderate: '#ff9500',
  poor:     '#dc3545',
}

const BAND_LABEL = {
  good:     { en: 'GOOD',     tr: 'İYİ' },
  moderate: { en: 'MODERATE', tr: 'ORTA' },
  poor:     { en: 'POOR',     tr: 'ZAYIF' },
}

function RecoveryAdherenceCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectRecoveryAdherence(log), [log])

  const title = isTR ? 'DİNLENME UYUMU — 28G' : 'RECOVERY ADHERENCE — 28D'

  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  // ─── Vacuous good — no planned rest days at all ────────────────────────────
  if (result.totalRestDaysPlanned === 0 && result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Dinlenme uyumu — planlı dinlenme yok' : 'Recovery adherence — no rest days scheduled'}
        style={{ ...S.card, animationDelay: '380ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: 'var(--text)',
          lineHeight: 1.7, padding: '8px 0',
        }}>
          {message}
        </div>
        {recommendation ? (
          <div style={{
            ...S.mono, fontSize: '11px', color: 'var(--sub, var(--muted))',
            lineHeight: 1.6, marginTop: '6px',
          }}>
            {recommendation}
          </div>
        ) : null}
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '8px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Insufficient data — 1–2 planned rest days ─────────────────────────────
  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Dinlenme uyumu — yetersiz veri' : 'Recovery adherence — insufficient data'}
        style={{ ...S.card, animationDelay: '380ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Uyumu görmek için 3+ planlı dinlenme günü kaydet'
            : 'Log 3+ planned rest days to see adherence'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Reliable render ───────────────────────────────────────────────────────
  const accent = BAND_COLOR[result.band] || BAND_COLOR.good
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()
  const pct = result.adherencePct

  const ariaPct = isTR
    ? `${bandLbl} — %${pct} dinlenme günü uyumu`
    : `${bandLbl} — ${pct}% rest-day adherence`

  const recentDrifts = (result.driftDates || []).slice(0, 3)

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Dinlenme uyumu' : 'Recovery adherence'}
      style={{ ...S.card, animationDelay: '380ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
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

      {/* Big % + bilingual unit label ----------------------------------------- */}
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
          {pct}
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
          ADHERENCE<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>UYUM
        </div>
      </div>

      {/* Sub-line: adherent / planned ---------------------------------------- */}
      <div style={{
        ...S.mono,
        fontSize: '11px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '8px',
        letterSpacing: '0.03em',
      }}>
        {isTR
          ? `${result.totalRestDaysPlanned} dinlenmenin ${result.adherentDays}'i`
          : `${result.adherentDays}/${result.totalRestDaysPlanned} rest days`}
      </div>

      {/* Severity row -------------------------------------------------------- */}
      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '8px',
        letterSpacing: '0.03em',
      }}>
        {result.mildDriftDays} {isTR ? 'hafif' : 'mild'}
        <span aria-hidden="true" style={{ margin: '0 4px', color: 'var(--muted)' }}>·</span>
        {result.severeDriftDays} {isTR ? 'şiddetli sapma' : 'severe drift'}
      </div>

      {/* Recent drift dates (max 3) ------------------------------------------ */}
      {recentDrifts.length > 0 ? (
        <div
          role="list"
          aria-label={isTR ? 'Son sapma tarihleri' : 'Recent drift dates'}
          style={{
            ...S.mono,
            fontSize: '10px',
            color: 'var(--sub, var(--muted))',
            marginBottom: '8px',
            letterSpacing: '0.03em',
          }}
        >
          {isTR ? 'Son sapma: ' : 'Last drift: '}
          {recentDrifts.map((d, i) => (
            <span key={d} role="listitem">
              {d}{i < recentDrifts.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      ) : null}

      {/* Bilingual message --------------------------------------------------- */}
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

      {/* Recommendation ------------------------------------------------------ */}
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

export default memo(RecoveryAdherenceCard)
