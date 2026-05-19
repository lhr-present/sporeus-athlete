// ─── dashboard/MesocycleProgressionCard.jsx ───────────────────────────────
// Surfaces `analyzeMesocycleProgression` (src/lib/athlete/mesocycleProgression.js)
// as a Dashboard card: 12 weekly bars colored by role (BUILD / DELOAD /
// PEAK / UNKNOWN), the detected band, the count of clean 3:1 mesocycles,
// and the mean deload depth as a percentage of preceding peak.
//
// Render rule:
//   - Render NULL when the analyzer returns null (insufficient data).
//
// Cite: Issurin 2010; Bompa 2018.
// ─────────────────────────────────────────────────────────────────────────

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeMesocycleProgression } from '../../lib/athlete/mesocycleProgression.js'

const ROLE_COLOR = {
  BUILD:   '#0064ff',
  DELOAD:  '#5bc25b',
  PEAK:    '#ff6600',
  UNKNOWN: '#888',
}

const BAND_COLOR = {
  ON_PATTERN:      '#5bc25b',
  CONTINUOUS_LOAD: '#0064ff',
  NO_DELOAD:       '#ff6600',
  OVER_DELOADED:   '#ff6600',
  CHAOTIC:         '#cc3333',
}

const BAND_LABEL = {
  ON_PATTERN:      { en: 'ON PATTERN',      tr: 'DESENE UYGUN' },
  CONTINUOUS_LOAD: { en: 'CONTINUOUS LOAD', tr: 'SÜREKLİ YÜK' },
  NO_DELOAD:       { en: 'NO DELOAD',       tr: 'BOŞALTMA YOK' },
  OVER_DELOADED:   { en: 'OVER DELOADED',   tr: 'AŞIRI BOŞALTMA' },
  CHAOTIC:         { en: 'CHAOTIC',         tr: 'KAOTİK' },
}

const BAND_HINT = {
  ON_PATTERN: {
    en: 'Clean 3:1 build-to-deload cadence detected. Issurin block periodization in action — keep stacking.',
    tr: '3:1 yapım-boşaltma temposu tespit edildi. Issurin blok periyodizasyonu uygulanıyor — devam et.',
  },
  CONTINUOUS_LOAD: {
    en: 'Steady load with only one deload in the window. Plan a deload week to bank fitness.',
    tr: 'Pencerede yalnızca bir boşaltma haftası var. Formu kazanmak için boşaltma haftası planla.',
  },
  NO_DELOAD: {
    en: 'No deload weeks detected. Drop ~30 % volume for one week every 4th week to consolidate gains.',
    tr: 'Boşaltma haftası tespit edilmedi. Kazanımları sağlamlaştırmak için her 4 haftada bir ~%30 hacim düşür.',
  },
  OVER_DELOADED: {
    en: 'Too many low-load weeks. Re-anchor a 3-week progressive build before the next deload.',
    tr: 'Düşük yüklü hafta çok fazla. Sonraki boşaltmadan önce 3 haftalık ilerleyen yükleme yap.',
  },
  CHAOTIC: {
    en: 'No clear 3:1 rhythm. Stack three progressive build weeks then a deload to anchor a mesocycle.',
    tr: 'Net bir 3:1 ritmi yok. Bir mezodöngü kurmak için üç ilerleyen yükleme haftası + 1 boşaltma haftası uygula.',
  },
}

const MAX_BAR_HEIGHT = 60

function formatPct(x) {
  if (x == null || !Number.isFinite(x)) return null
  return `${Math.round(x * 100)}%`
}

/**
 * @description Surface `analyzeMesocycleProgression` as a Dashboard card.
 *   Renders null when the analyzer returns null.
 *
 * @param {{ log: Array }} props
 */
export default function MesocycleProgressionCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeMesocycleProgression({ log, today: new Date() }),
    [log]
  )

  if (!analysis) return null
  const { band, weeks, mesocyclesDetected, deloadDepth, citation } = analysis
  if (!Array.isArray(weeks) || weeks.length === 0) return null

  const title = isTR ? 'MEZODÖNGÜ İLERLEYİŞİ' : 'MESOCYCLE PROGRESSION'
  const ariaLabel = isTR
    ? 'Mezodöngü ilerleyişi — 3:1 blok periyodizasyon uyumu'
    : 'Mesocycle progression — 3:1 block periodization adherence'

  const bandColor = BAND_COLOR[band] || '#888'
  const bandLabel = BAND_LABEL[band]?.[isTR ? 'tr' : 'en'] || band
  const hint = BAND_HINT[band]?.[isTR ? 'tr' : 'en'] || ''

  const maxTss = weeks.reduce((m, w) => (w.tss > m ? w.tss : m), 0)

  const mesoLabel = isTR ? 'TEMİZ MEZODÖNGÜ' : 'CLEAN MESOCYCLES'
  const deloadLabel = isTR ? 'BOŞALTMA DERİNLİĞİ' : 'DELOAD DEPTH'
  const deloadDepthStr = formatPct(deloadDepth)

  const ROLE_LABEL = {
    BUILD:   { en: 'BUILD',   tr: 'YAPIM' },
    DELOAD:  { en: 'DELOAD',  tr: 'BOŞALTMA' },
    PEAK:    { en: 'PEAK',    tr: 'ZİRVE' },
    UNKNOWN: { en: '—',       tr: '—' },
  }

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="mesocycle-progression"
      data-band={band}
      data-mesocycles-detected={String(mesocyclesDetected)}
      data-deload-depth={deloadDepth == null ? '' : String(deloadDepth)}
      style={{ ...S.card, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* ── Band + summary chips ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '14px',
          flexWrap: 'wrap',
        }}
      >
        <span
          data-mesocycle-band-badge=""
          style={{
            ...S.mono,
            fontSize: '11px',
            fontWeight: 700,
            color: '#fff',
            background: bandColor,
            padding: '4px 10px',
            borderRadius: '2px',
            letterSpacing: '0.08em',
          }}
        >
          {bandLabel}
        </span>
        <span
          style={{
            ...S.mono,
            fontSize: '10px',
            color: 'var(--muted)',
            letterSpacing: '0.04em',
          }}
        >
          {mesoLabel}: <strong data-mesocycle-count="" style={{ color: 'var(--text)' }}>{mesocyclesDetected}</strong>
        </span>
        {deloadDepthStr && (
          <span
            style={{
              ...S.mono,
              fontSize: '10px',
              color: 'var(--muted)',
              letterSpacing: '0.04em',
            }}
          >
            {deloadLabel}: <strong data-deload-depth-pct="" style={{ color: 'var(--text)' }}>{deloadDepthStr}</strong>
          </span>
        )}
      </div>

      {/* ── 12 weekly bars ────────────────────────────────────────────── */}
      <div
        data-mesocycle-bars=""
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '4px',
          height: `${MAX_BAR_HEIGHT + 8}px`,
          marginBottom: '12px',
          paddingBottom: '6px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {weeks.map((w) => {
          const color = ROLE_COLOR[w.role] || ROLE_COLOR.UNKNOWN
          const h = maxTss > 0
            ? Math.max(2, Math.round((w.tss / maxTss) * MAX_BAR_HEIGHT))
            : 2
          const roleLbl = ROLE_LABEL[w.role]?.[isTR ? 'tr' : 'en'] || w.role
          return (
            <div
              key={w.weekStart}
              data-mesocycle-week=""
              data-week-start={w.weekStart}
              data-week-role={w.role}
              data-week-tss={String(w.tss)}
              title={`${w.weekStart} · ${w.tss} TSS · ${roleLbl}`}
              style={{
                flex: '1 1 auto',
                height: `${h}px`,
                background: color,
                borderRadius: '2px 2px 0 0',
                minWidth: '6px',
              }}
            />
          )
        })}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        {['BUILD', 'PEAK', 'DELOAD', 'UNKNOWN'].map((r) => (
          <span
            key={r}
            style={{
              ...S.mono,
              fontSize: '9px',
              color: 'var(--muted)',
              letterSpacing: '0.06em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                background: ROLE_COLOR[r],
                borderRadius: '1px',
                display: 'inline-block',
              }}
            />
            {ROLE_LABEL[r][isTR ? 'tr' : 'en']}
          </span>
        ))}
      </div>

      {/* ── Interpretation hint ──────────────────────────────────────── */}
      <div
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${bandColor}`,
          marginBottom: '8px',
        }}
      >
        {hint}
      </div>

      {/* ── Citation footer ──────────────────────────────────────────── */}
      <div
        data-mesocycle-citation=""
        style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}
      >
        {citation}
      </div>
    </div>
  )
}
