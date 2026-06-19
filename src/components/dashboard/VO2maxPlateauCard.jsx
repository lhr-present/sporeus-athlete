// ─── VO2maxPlateauCard.jsx — VO2max plateau warning surface ──────────────────
// Renders ONLY when `detectVO2maxPlateau` flags isPlateau=true. Silent in
// every other case — this is a warning card, not a status display. When a
// plateau is detected the athlete sees:
//   - VARIANCE (ml/kg/min + %)
//   - WEEK SPAN across the recent tests
//   - One of three regime-change hints (change-stimulus / deload-restart /
//     add-hills) in bilingual EN/TR
//   - Citation footer (Bompa 2009; Issurin 2010; Daniels 2014)
//
// Pure presentational wrapper around `detectVO2maxPlateau` from
// src/lib/athlete/vo2maxPlateau.js.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { detectVO2maxPlateau } from '../../lib/athlete/vo2maxPlateau.js'

const FONT = "'IBM Plex Mono', monospace"
const WARN_ORANGE = '#ff9500'
const WARN_ORANGE_BG = '#ff950022'
const WARN_ORANGE_BORDER = '#ff950055'

const REC_LABEL = {
  'change-stimulus': {
    en: 'Switch block focus — e.g. rotate from threshold to VO2max intervals.',
    tr: 'Blok odağını değiştir — örn. eşik çalışmasından VO2max intervaline geç.',
  },
  'deload-restart': {
    en: 'Insert a deload week then restart the block with fresh stimulus.',
    tr: 'Bir dinlenme haftası ekle, ardından bloğa taze uyaranla yeniden başla.',
  },
  'add-hills': {
    en: 'Add hill repeats or resisted intervals to introduce a new neuromuscular load.',
    tr: 'Yeni bir nöromüsküler yük için tepe tekrarları veya dirençli intervaller ekle.',
  },
}

function VO2maxPlateauCard({ testResults = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => detectVO2maxPlateau({ testResults }),
    [testResults]
  )

  // Silent unless plateau detected.
  if (!result || result.isPlateau !== true) return null

  const title = isTR ? 'VO2MAX PLATOSU' : 'VO2MAX PLATEAU'
  const ariaLabel = isTR ? 'VO2max platosu uyarısı' : 'VO2max plateau warning'

  const varianceLabel = isTR ? 'VARYANS' : 'VARIANCE'
  const spanLabel = isTR ? 'HAFTA' : 'WEEK SPAN'
  const headline = isTR
    ? 'Mevcut uyaran aerobik tavanı artırmıyor — rejimi değiştirme zamanı.'
    : 'Current stimulus has stopped raising the aerobic ceiling — time to change the regime.'

  const recCopy = result.recommendation
    ? REC_LABEL[result.recommendation]
    : null

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-vo2max-plateau-card
      data-plateau="true"
      className="sp-card"
      style={{
        background: WARN_ORANGE_BG,
        border: `1px solid ${WARN_ORANGE_BORDER}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: FONT,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: WARN_ORANGE,
        marginBottom: 8,
      }}>
        <span style={{ marginRight: 6 }}>◆</span>
        {title}
      </div>

      <div style={{
        fontSize: 11,
        color: 'var(--text, #ddd)',
        lineHeight: 1.5,
        marginBottom: 10,
      }}>
        {headline}
      </div>

      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 10,
        fontSize: 10,
      }}>
        <div>
          <div style={{ color: 'var(--muted, #888)', fontSize: 9, letterSpacing: '0.05em' }}>
            {varianceLabel}
          </div>
          <div style={{ color: WARN_ORANGE, fontWeight: 700, fontSize: 14 }}>
            {result.varianceMlKgMin.toFixed(1)}
            <span style={{ fontSize: 9, color: 'var(--muted, #888)', marginLeft: 4 }}>
              ml/kg/min
            </span>
          </div>
          <div style={{ color: 'var(--muted, #888)', fontSize: 9 }}>
            ({result.variancePct.toFixed(1)}%)
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--muted, #888)', fontSize: 9, letterSpacing: '0.05em' }}>
            {spanLabel}
          </div>
          <div style={{ color: WARN_ORANGE, fontWeight: 700, fontSize: 14 }}>
            {result.weekSpan.toFixed(1)}
            <span style={{ fontSize: 9, color: 'var(--muted, #888)', marginLeft: 4 }}>
              {isTR ? 'hafta' : 'wk'}
            </span>
          </div>
        </div>
      </div>

      {recCopy ? (
        <div
          data-vo2max-plateau-recommendation={result.recommendation}
          style={{
            fontSize: 11,
            color: 'var(--text, #ddd)',
            lineHeight: 1.5,
            padding: 8,
            background: 'var(--surface, #1a1a1a)',
            border: '1px solid var(--border, #333)',
            borderRadius: 3,
            marginBottom: 8,
          }}
        >
          <span style={{ color: WARN_ORANGE, fontWeight: 700, marginRight: 6 }}>↳</span>
          {isTR ? recCopy.tr : recCopy.en}
        </div>
      ) : null}

      <div style={{
        fontSize: 9,
        color: 'var(--muted, #555)',
        fontStyle: 'italic',
        marginTop: 4,
      }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(VO2maxPlateauCard)
