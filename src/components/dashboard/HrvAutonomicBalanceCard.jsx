// ─── HrvAutonomicBalanceCard.jsx — autonomic-balance stratification UI ───────
//
// Classifies recent HRV trend into a recovery state (parasympathetic-
// recovered / balanced / sympathetic-strained) and renders it as a
// color-banded card. Distinct from HRVSummaryCard (baseline + 14-dot chart)
// and HRVAlertCard (≥2σ acute drop alert).
//
// Renders nothing when sample is inadequate — under-powered windows would
// only produce noise. The full descriptive HRV cards continue to surface in
// that case.
//
// References: Plews & Buchheit 2017 · Stanley 2013 · Buchheit 2014
// ─────────────────────────────────────────────────────────────────────────────

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  stratifyAutonomicBalance,
  AUTONOMIC_BALANCE_CITATION,
} from '../../lib/athlete/hrvAutonomicBalance.js'

const MONO = "'IBM Plex Mono', monospace"

const STATE_COLOR = {
  PARASYMPATHETIC_RECOVERED: '#5bc25b',  // green
  BALANCED:                  '#0064ff',  // blue
  SYMPATHETIC_STRAINED:      '#ff8c1a',  // orange
}

const STATE_LABEL_EN = {
  PARASYMPATHETIC_RECOVERED: 'PARASYMPATHETIC-RECOVERED',
  BALANCED:                  'BALANCED',
  SYMPATHETIC_STRAINED:      'SYMPATHETIC-STRAINED',
}

const STATE_LABEL_TR = {
  PARASYMPATHETIC_RECOVERED: 'PARASEMPATİK-DİNLENMİŞ',
  BALANCED:                  'DENGELİ',
  SYMPATHETIC_STRAINED:      'SEMPATİK-YORGUN',
}

const STATE_DESC_EN = {
  PARASYMPATHETIC_RECOVERED: 'Vagal tone elevated — autonomic system recovered. High-intensity work likely well tolerated.',
  BALANCED:                  'Vagal tone near baseline — normal autonomic state. Train as planned.',
  SYMPATHETIC_STRAINED:      'Vagal tone suppressed or unstable — sympathetic dominance. Prioritize easy aerobic / recovery.',
}

const STATE_DESC_TR = {
  PARASYMPATHETIC_RECOVERED: 'Vagal tonus yükselmiş — otonom sistem toparlanmış. Yüksek şiddet muhtemelen tolere edilir.',
  BALANCED:                  'Vagal tonus baz çizgisinde — normal otonom durum. Planlandığı gibi antrenman.',
  SYMPATHETIC_STRAINED:      'Vagal tonus baskılı veya kararsız — sempatik baskınlık. Kolay aerobik / toparlanma önceliği.',
}

/**
 * @param {{ recovery?: Array }} props
 */
function HrvAutonomicBalanceCard({ recovery }) {
  const ctx  = useContext(LangCtx) || { lang: 'en' }
  const lang = ctx.lang || 'en'
  const isTR = lang === 'tr'

  const result = useMemo(() => {
    if (!Array.isArray(recovery) || recovery.length === 0) return null
    return stratifyAutonomicBalance(recovery, new Date())
  }, [recovery])

  // Hide card when input is empty OR sample inadequate (under-powered → unreliable)
  if (!result || result.sampleAdequate === false) return null

  const { state, mean7d, baseline28d, cv } = result
  const color = STATE_COLOR[state] || '#888'
  const label = (isTR ? STATE_LABEL_TR : STATE_LABEL_EN)[state]
  const desc  = (isTR ? STATE_DESC_TR : STATE_DESC_EN)[state]

  const titleText = isTR ? 'OTONOM DENGE' : 'AUTONOMIC BALANCE'
  const ariaLabel = isTR ? 'HRV otonom denge sınıflandırması' : 'HRV autonomic balance stratification'

  const labelMean7d   = isTR ? '7 günlük ort' : '7d mean'
  const labelBaseline = isTR ? '28 günlük baz' : '28d baseline'
  const labelCV       = isTR ? 'Değişim katsayısı' : 'CV'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-hrv-autonomic-balance-card={state}
      className="sp-card"
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `4px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Title */}
      <div style={{
        fontFamily: MONO, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff6600',
        marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8,
      }}>
        ◈ {titleText}
      </div>

      {/* State band */}
      <div style={{
        background: `${color}1f`,
        border: `1px solid ${color}66`,
        borderRadius: 4,
        padding: '8px 10px',
        marginBottom: 10,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 12, fontWeight: 700,
          color, letterSpacing: '0.08em', marginBottom: 4,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 10,
          color: 'var(--text)', lineHeight: 1.5,
        }}>
          {desc}
        </div>
      </div>

      {/* Numeric strip */}
      <div style={{
        display: 'flex', gap: 14, flexWrap: 'wrap',
        marginBottom: 8,
      }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.04em' }}>
            {labelMean7d}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {mean7d.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.04em' }}>
            {labelBaseline}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {baseline28d.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.04em' }}>
            {labelCV}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: cv > 12 ? '#ff8c1a' : 'var(--text)' }}>
            {cv.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Citation */}
      <div style={{
        fontFamily: MONO, fontSize: 8,
        color: '#555', letterSpacing: '0.04em', fontStyle: 'italic',
        borderTop: '1px solid var(--border)', paddingTop: 6,
      }}>
        {AUTONOMIC_BALANCE_CITATION}
      </div>
    </div>
  )
}

export default memo(HrvAutonomicBalanceCard)
