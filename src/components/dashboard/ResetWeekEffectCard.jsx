// ─── dashboard/ResetWeekEffectCard.jsx ────────────────────────────────────
// Surfaces `analyzeResetWeekEffect` (src/lib/athlete/resetWeekEffect.js)
// as a Dashboard card: a 3-bar mini chart (pre-deload mean → deload week
// → post-deload mean) with the rebound % shown over the post bar, a
// large stat for the bounce %, a bilingual interpretation strip, and the
// citation.
//
// Render rule:
//   - Renders null when the analyzer returns null (unresolvable today).
//   - Otherwise renders for all four bands incl. NO_DELOAD_FOUND.
//
// Cite: Bompa 2018; Issurin 2010.
// ─────────────────────────────────────────────────────────────────────────

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeResetWeekEffect } from '../../lib/athlete/resetWeekEffect.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  STRONG_BOUNCE:   '#5bc25b', // green   — rebound landed
  MODEST_BOUNCE:   '#0064ff', // blue    — small positive
  NO_BOUNCE:       '#cc3333', // red     — deload did not produce rebound
  NO_DELOAD_FOUND: '#888888', // muted   — nothing to evaluate
}

const BAND_LABEL_EN = {
  STRONG_BOUNCE:   'STRONG BOUNCE',
  MODEST_BOUNCE:   'MODEST BOUNCE',
  NO_BOUNCE:       'NO BOUNCE',
  NO_DELOAD_FOUND: 'NO DELOAD',
}
const BAND_LABEL_TR = {
  STRONG_BOUNCE:   'GÜÇLÜ SIÇRAMA',
  MODEST_BOUNCE:   'HAFİF SIÇRAMA',
  NO_BOUNCE:       'SIÇRAMA YOK',
  NO_DELOAD_FOUND: 'BOŞALTMA YOK',
}

const HINT_EN = {
  STRONG_BOUNCE:
    'Textbook supercompensation — post-deload load is well above pre-deload. Your taper-then-build cycle is working. Repeat.',
  MODEST_BOUNCE:
    'A small rebound — the deload helped but only marginally. Consider deeper recovery (sleep, fuel) before the next deload.',
  NO_BOUNCE:
    'No rebound after your last deload. Either the prior load was untenable, the deload was too long/deep, or recovery infrastructure is missing.',
  NO_DELOAD_FOUND:
    'No deload week in the last 13 weeks — schedule one to enable supercompensation.',
}
const HINT_TR = {
  STRONG_BOUNCE:
    'Ders kitabı süperkompansasyon — boşaltma sonrası yük öncesini açıkça aştı. Daralt-sonra-yükle döngün işliyor. Tekrarla.',
  MODEST_BOUNCE:
    'Küçük bir sıçrama — boşaltma yardım etti ama az. Bir sonraki boşaltma öncesi daha derin toparlanma (uyku, yakıt) düşün.',
  NO_BOUNCE:
    'Son boşaltma sonrası sıçrama yok. Ya önceki yük taşınamazdı, ya boşaltma fazla uzun/derin, ya da toparlanma altyapısı eksik.',
  NO_DELOAD_FOUND:
    'Son 13 haftada boşaltma haftası yok — süperkompansasyonu mümkün kılmak için bir tane planla.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

// ─── Three-bar mini chart: pre / deload / post ───────────────────────────
function ThreeBarChart({ pre, deload, post, postAvailable, color, isTR }) {
  const W = 280
  const H = 70
  const PAD_X = 8
  const PAD_Y = 8
  const LABEL_H = 12

  const values = [pre, deload, post]
  const maxV = Math.max(pre, deload, post, 1)
  const barWidth = (W - PAD_X * 2 - 16) / 3

  const labels = isTR
    ? ['Önce', 'Boşaltma', 'Sonra']
    : ['Pre', 'Deload', 'Post']

  const colors = ['#888', color, color]

  return (
    <svg
      width="100%"
      height={H + LABEL_H + 4}
      viewBox={`0 0 ${W} ${H + LABEL_H + 4}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
      data-mini-chart="reset-week-effect"
      style={{ display: 'block', marginTop: 10 }}
    >
      {values.map((v, i) => {
        if (i === 2 && postAvailable === 0) return null
        const h = maxV > 0 ? Math.max(2, (v / maxV) * (H - PAD_Y * 2)) : 2
        const x = PAD_X + i * (barWidth + 8)
        const y = H - PAD_Y - h
        return (
          <g key={labels[i]}>
            <rect
              data-three-bar={labels[i].toLowerCase()}
              x={x}
              y={y}
              width={barWidth}
              height={h}
              fill={i === 0 ? colors[0] : colors[i]}
              opacity={i === 2 ? 1 : (i === 1 ? 0.6 : 0.5)}
              rx="2"
            />
            <text
              x={x + barWidth / 2}
              y={H + LABEL_H - 2}
              textAnchor="middle"
              fontSize="9"
              fill="#888"
              fontFamily={MONO}
            >
              {labels[i]}
            </text>
            <text
              x={x + barWidth / 2}
              y={y - 2}
              textAnchor="middle"
              fontSize="9"
              fill="#aaa"
              fontFamily={MONO}
            >
              {Math.round(v)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * @description Surface `analyzeResetWeekEffect` as a Dashboard card.
 *   Renders null when the analyzer returns null.
 *
 * @param {{ log: Array }} props
 */
export default function ResetWeekEffectCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => todayIso(), [])

  const analysis = useMemo(
    () => analyzeResetWeekEffect({ log, today, lookbackWeeks: 13 }),
    [log, today],
  )

  if (!analysis) return null

  const {
    band,
    deloadWeekStart,
    deloadWeekTss,
    preMeanTss,
    postMeanTss,
    bouncePct,
    weeksAfterDeloadAvailable,
    citation,
  } = analysis

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'YENİLEME HAFTASI ETKİSİ' : 'RESET WEEK EFFECT'
  const ariaLabel = isTR
    ? 'Yenileme haftası etkisi: son boşaltma sonrası süperkompansasyon kontrolü (Bompa 2018; Issurin 2010)'
    : 'Reset week effect: post-deload supercompensation check (Bompa 2018; Issurin 2010)'

  const isDeloadFound = band !== 'NO_DELOAD_FOUND'

  // Format bouncePct as +X% / -X% / 0%.
  const bouncePctDisplay = (() => {
    if (!isDeloadFound) return '—'
    const pct = Math.round(bouncePct * 1000) / 10 // 1dp
    if (pct === 0) return '0%'
    const sign = pct > 0 ? '+' : ''
    return `${sign}${pct}%`
  })()

  const deloadLbl = isTR ? 'Boşaltma haftası' : 'Deload week'
  const preLbl = isTR ? '3-hafta öncesi ortalama' : '3-week pre mean'
  const postLbl = isTR ? '2-hafta sonrası ortalama' : '2-week post mean'

  const postSuffix = (() => {
    if (!isDeloadFound) return ''
    if (weeksAfterDeloadAvailable === 0) {
      return isTR ? ' (sonrası veri yok)' : ' (no post-data)'
    }
    if (weeksAfterDeloadAvailable === 1) {
      return isTR ? ' (1 hafta)' : ' (1 wk)'
    }
    return ''
  })()

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="reset-week-effect"
      data-band={band}
      data-deload-week-start={deloadWeekStart || ''}
      data-deload-week-tss={String(deloadWeekTss)}
      data-pre-mean-tss={String(preMeanTss)}
      data-post-mean-tss={String(postMeanTss)}
      data-bounce-pct={String(bouncePct)}
      data-weeks-after-deload-available={String(weeksAfterDeloadAvailable)}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Title + band badge */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 8, flexWrap: 'wrap',
      }}>
        <div
          data-reset-week-title
          style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
            color: 'var(--text, #ccc)',
          }}
        >
          {title}
        </div>
        <div
          data-band-label
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            color, padding: '2px 8px',
            border: `1px solid ${color}`, borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {isDeloadFound ? (
        <>
          {/* Deload-week date label */}
          <div
            data-deload-date-label
            style={{
              fontSize: 10, color: 'var(--muted, #888)', marginTop: 8,
            }}
          >
            {deloadLbl}: <span style={{ color: 'var(--text, #ccc)' }}>{deloadWeekStart}</span>
            {' · '}{deloadWeekTss} TSS
          </div>

          {/* Three-bar chart */}
          <ThreeBarChart
            pre={preMeanTss}
            deload={deloadWeekTss}
            post={postMeanTss}
            postAvailable={weeksAfterDeloadAvailable}
            color={color}
            isTR={isTR}
          />

          {/* Big bounce % */}
          <div style={{ marginTop: 10 }}>
            <div
              data-bounce-display
              style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}
            >
              {bouncePctDisplay}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 4 }}>
              {preLbl}: <span style={{ color: 'var(--text, #ccc)' }}>{preMeanTss}</span>
              {' · '}
              {postLbl}: <span style={{ color: 'var(--text, #ccc)' }}>{postMeanTss}</span>
              {postSuffix}
            </div>
          </div>
        </>
      ) : (
        /* NO_DELOAD_FOUND empty state */
        <div
          data-no-deload-state
          style={{
            marginTop: 12, padding: '8px 10px',
            background: 'var(--surface, #111)', borderRadius: 4,
            borderLeft: `2px solid ${color}`,
            fontSize: 11, color: 'var(--text, #ccc)', lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      )}

      {/* Band-coloured interpretation strip (only when deload found — for
          NO_DELOAD_FOUND the hint is the main state). */}
      {isDeloadFound ? (
        <div
          data-band-hint
          style={{
            marginTop: 10, padding: '6px 8px',
            background: 'var(--surface, #111)', borderRadius: 4,
            borderLeft: `2px solid ${color}`,
            fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
          }}
        >
          ↗ {hint}
        </div>
      ) : null}

      {/* Citation */}
      <div
        data-reset-week-citation
        style={{
          marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
        }}
      >
        {citation}
      </div>
    </div>
  )
}
