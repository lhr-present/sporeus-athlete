// ─── TaperComplianceCard.jsx — Taper Compliance Detector (warning surface) ──
// Companion to TaperAdvisorCard. TaperAdvisorCard surfaces what the PLAN
// prescribes; this card surfaces whether the LOG actually shows the taper
// happening. Silent on success (ON_TARGET → renders null) — only fires as
// a warning when volume drop diverges from Mujika 2010 / Bosquet 2007
// expectations.
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { detectTaperCompliance } from '../../lib/athlete/taperCompliance.js'

const MONO = "'IBM Plex Mono', monospace"

const COLOR = {
  UNDERCUT: '#ff6600', // orange — under-tapering, common failure mode
  OVERCUT:  '#e03030', // red    — over-tapering, detraining risk
}

const RECOMMENDATION = {
  UNDERCUT: {
    en: 'Cut volume more this week — keep intensity',
    tr: 'Bu hafta hacmi daha çok azalt — yoğunluğu koru',
  },
  OVERCUT: {
    en: 'Volume cut too aggressive — risk of detraining',
    tr: 'Çok agresif kesim — fitness kaybı riski',
  },
}

/**
 * @param {{ log: Array, profile: object }} props
 */
function TaperComplianceCard({ log, profile }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => detectTaperCompliance({ log, profile }),
    [log, profile]
  )

  // Silent on no race / out-of-window / ON_TARGET — warning surface only.
  if (!result) return null
  if (result.compliance === 'ON_TARGET') return null

  const color = COLOR[result.compliance] || COLOR.UNDERCUT
  const heading = isTR ? '◈ POTA UYUMU' : '◈ TAPER COMPLIANCE'
  const ariaLabel = isTR ? 'Pota uyum dedektörü' : 'Taper compliance detector'

  const stateLabel = isTR
    ? (result.compliance === 'UNDERCUT' ? 'YETERSİZ KESİM' : 'AŞIRI KESİM')
    : result.compliance

  const rec = RECOMMENDATION[result.compliance] || RECOMMENDATION.UNDERCUT
  const recText = `${rec.en} / ${rec.tr}`

  const expectedStr = `${result.expectedVolumeCutPct}%`
  const actualStr   = `${result.actualVolumeCutPct}%`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-taper-compliance-card
      data-compliance={result.compliance}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `4px solid ${color}`,
        borderRadius: 6,
        padding: 14,
        marginBottom: 12,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Title + state badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          fontFamily: MONO, fontSize: 11, fontWeight: 700,
          color, letterSpacing: '0.08em',
        }}>
          {heading}
        </div>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          color, border: `1px solid ${color}66`,
          padding: '1px 6px', borderRadius: 2, letterSpacing: '0.07em',
        }}>
          {stateLabel}
        </span>
      </div>

      {/* Metrics row */}
      <div style={{
        display: 'flex', gap: 18, flexWrap: 'wrap',
        marginBottom: 10, alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
            {result.daysToRace}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 9, color: 'var(--muted, #888)',
            marginTop: 2, letterSpacing: '0.06em',
          }}>
            {isTR ? 'YARIŞA GÜN' : 'DAYS TO RACE'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text)' }}>
            {isTR ? 'Beklenen kesim' : 'Expected cut'}:{' '}
            <span style={{ color, fontWeight: 700 }} data-expected-cut>{expectedStr}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text)' }}>
            {isTR ? 'Gerçek kesim' : 'Actual cut'}:{' '}
            <span style={{ color, fontWeight: 700 }} data-actual-cut>{actualStr}</span>
          </div>
        </div>
      </div>

      {/* Bilingual recommendation */}
      <div style={{
        fontFamily: MONO, fontSize: 10, color: 'var(--text)',
        lineHeight: 1.5, marginBottom: 8,
      }}>
        {recText}
      </div>

      {/* Citation */}
      <div style={{
        fontFamily: MONO, fontSize: 8, color: '#555',
        borderTop: '1px solid var(--border, #222)',
        paddingTop: 6, letterSpacing: '0.04em',
        fontStyle: 'italic',
      }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(TaperComplianceCard)
