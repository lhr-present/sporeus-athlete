// ─── dashboard/RpeStabilityCard.jsx — Within-Type RPE Stability ─────────────
// Surfaces how consistently the athlete rates the SAME KIND of session
// (Easy, Tempo, Threshold, Long, etc.) across the trailing 28 days. Wide
// variance inside a type means poor subjective-effort calibration. Tight
// clusters mean reliable RPE perception.
//
// Distinct from sessionRPEDrift (plan-vs-actual). This card looks at
// within-type RPE variance — calibration of the reporting itself.
//
// Cite: Foster 2001; Borg 1982.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeRpeStability, classifyStabilityBand } from '../../lib/athlete/rpeStability.js'

const BAND_COLOR = {
  CALIBRATED:    '#5bc25b',
  DEVELOPING:    '#0064ff',
  MISCALIBRATED: '#ff6600',
}

const BAND_LABEL = {
  CALIBRATED:    { en: 'CALIBRATED',    tr: 'KALİBRE' },
  DEVELOPING:    { en: 'DEVELOPING',    tr: 'GELİŞİYOR' },
  MISCALIBRATED: { en: 'MISCALIBRATED', tr: 'KALİBRESİZ' },
}

const HINT = {
  CALIBRATED: {
    en: 'RPE perception is reliable — your subjective effort matches consistently across same-type sessions.',
    tr: 'RPE algısı güvenilir — aynı tür seanslarda öznel efor tutarlı.',
  },
  DEVELOPING: {
    en: 'RPE varies somewhat within session types — keep logging mindfully for cleaner calibration.',
    tr: 'RPE aynı tür seanslarda biraz değişiyor — daha temiz kalibrasyon için kayıtlara dikkat et.',
  },
  MISCALIBRATED: {
    en: "Same-type sessions are rated very differently — re-anchor to Borg 1-10 or compare against HR/power to calibrate.",
    tr: "Aynı tür seanslar çok farklı puanlanıyor — Borg 1-10'a yeniden bağlan veya KAH/güç ile karşılaştırarak kalibre et.",
  },
}

function fmtPct(value) {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value * 100)}%`
}

function fmtOne(value) {
  if (!Number.isFinite(value)) return '0.0'
  return value.toFixed(1)
}

function RpeStabilityCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeRpeStability({ log }),
    [log]
  )

  if (!result) return null

  const { band, weightedCv, groups, totalSessions, citation } = result
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = BAND_LABEL[band]?.[isTR ? 'tr' : 'en'] || band

  const title = isTR ? 'RPE KARARLILIĞI · 28G' : 'RPE STABILITY · 28D'
  const ariaLabel = isTR
    ? 'RPE kararlılığı — 28 günlük tür içi sapma'
    : 'RPE stability — 28-day within-type variance'

  const hint = HINT[band][isTR ? 'tr' : 'en']

  const sessionsLabel = isTR
    ? `${totalSessions} seans`
    : `${totalSessions} session${totalSessions === 1 ? '' : 's'}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-rpe-stability-card=""
      data-stability-band={band}
      data-weighted-cv={weightedCv.toFixed(4)}
      data-group-count={String(groups.length)}
      data-total-sessions={String(totalSessions)}
      style={{ ...S.card, animationDelay: '480ms', padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* ── Score block ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
        <div>
          <div style={{
            ...S.mono,
            fontSize: '36px',
            fontWeight: 700,
            color,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {fmtPct(weightedCv)}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '10px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            marginTop: '4px',
            textTransform: 'uppercase',
          }}>
            {sessionsLabel}
          </div>
        </div>

        <span style={{
          display: 'inline-block',
          ...S.mono,
          fontSize: '10px',
          fontWeight: 700,
          color: '#fff',
          background: color,
          padding: '4px 10px',
          borderRadius: '3px',
          letterSpacing: '0.08em',
        }}>
          {bandLabel}
        </span>
      </div>

      {/* ── Per-group rows ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        {groups.map((g) => {
          const groupBand = classifyStabilityBand(g.cv)
          const chipColor = BAND_COLOR[groupBand] || '#888'
          const typeUpper = g.type.toUpperCase()
          const rpeStr = `${fmtOne(g.meanRpe)} ±${fmtOne(g.stdRpe)}`
          return (
            <div
              key={g.type}
              data-rpe-stability-row=""
              data-row-type={g.type}
              data-row-count={String(g.count)}
              data-row-mean-rpe={g.meanRpe.toFixed(2)}
              data-row-cv={g.cv.toFixed(4)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '11px',
              }}
            >
              <div style={{
                flex: '1 1 auto',
                ...S.mono,
                color: 'var(--text)',
                letterSpacing: '0.04em',
              }}>
                <span style={{ fontWeight: 600 }}>{typeUpper}</span>
                <span style={{ color: 'var(--muted)' }}>{` · ${g.count}× · RPE ${rpeStr}`}</span>
              </div>

              <span style={{
                flex: '0 0 auto',
                ...S.mono,
                fontSize: '9px',
                fontWeight: 700,
                color: '#fff',
                background: chipColor,
                padding: '2px 6px',
                borderRadius: '2px',
                letterSpacing: '0.06em',
              }}>
                {fmtPct(g.cv)}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Interpretation hint ─────────────────────────────────────────── */}
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

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(RpeStabilityCard)
