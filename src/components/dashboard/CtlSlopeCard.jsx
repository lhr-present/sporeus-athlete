// ─── CtlSlopeCard.jsx ─────────────────────────────────────────────────────
// Surfaces `analyzeCtlSlope` (Banister 1991 + Coggan 2010) — a linear
// regression fitted to the trailing-6-week CTL series. Smoother than
// CtlRampRateCard's week-over-week deltas, and more interpretable than
// CtlTrajectoryCard's forward projection.
//
// Render rules:
//   - Returns null when the pure-fn returns null (< 28 days of history).
//   - Otherwise renders for all four bands.
//
// Bilingual EN/TR via LangCtx.
// Test anchors:
//   data-ctl-slope-card, data-slope-band, data-slope,
//   data-slope-per-week, data-recent-ctl, data-intercept.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeCtlSlope } from '../../lib/athlete/ctlSlope.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  CLIMBING:  '#ff6600', // orange — sharp build
  STEADY_UP: '#5bc25b', // green  — sustainable build
  PLATEAU:   '#0064ff', // blue   — flat
  DECLINING: '#888888', // muted  — detraining / taper
}

const BAND_LABEL_EN = {
  CLIMBING:  'CLIMBING',
  STEADY_UP: 'STEADY UP',
  PLATEAU:   'PLATEAU',
  DECLINING: 'DECLINING',
}
const BAND_LABEL_TR = {
  CLIMBING:  'TIRMANIYOR',
  STEADY_UP: 'İSTİKRARLI ARTIŞ',
  PLATEAU:   'PLATO',
  DECLINING: 'DÜŞÜYOR',
}

const HINT_EN = {
  CLIMBING:
    'Steep CTL ramp — fitness building fast. Check ACWR for injury risk and protect recovery.',
  STEADY_UP:
    'Sustainable fitness build — slope in the safe zone for long-term adaptation.',
  PLATEAU:
    'Fitness flat. Either maintenance phase, or a sign to introduce a build week.',
  DECLINING:
    'CTL trending down — detraining or intentional taper. Verify which.',
}
const HINT_TR = {
  CLIMBING:
    'Dik CTL rampı — kondisyon hızla artıyor. Sakatlık riski için ACWR’yi kontrol et ve toparlanmayı koru.',
  STEADY_UP:
    'Sürdürülebilir kondisyon inşası — uzun vadeli adaptasyon için güvenli bölgede eğim.',
  PLATEAU:
    'Kondisyon düz. Ya bakım fazı ya da yapı haftası eklemek için bir işaret.',
  DECLINING:
    'CTL düşüyor — detraining ya da bilinçli azaltma. Hangisi olduğunu doğrula.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function signed(n, digits = 1) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  const fixed = v.toFixed(digits)
  return v > 0 ? `+${fixed}` : fixed
}

function CtlSlopeCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeCtlSlope({ log, today: todayIso(), windowDays: 42 }),
    [log]
  )

  if (!result) return null

  const { band, slope, slopePerWeek, intercept, recentCtl, citation } = result
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'CTL EĞİMİ · 6H' : 'CTL SLOPE · 6W'
  const ariaLabel = isTR
    ? 'CTL 6-haftalık doğrusal regresyon eğimi (Banister 1991; Coggan 2010)'
    : '6-week CTL linear-regression slope (Banister 1991; Coggan 2010)'
  const perWeekUnit = isTR ? 'TSS/hafta' : 'TSS/wk'

  const recentLabel = isTR
    ? `CTL ${recentCtl.toFixed(0)} bugün`
    : `CTL ${recentCtl.toFixed(0)} today`
  const interceptLabel = isTR
    ? `CTL ${intercept.toFixed(0)} 6 hafta önce`
    : `CTL ${intercept.toFixed(0)} 6 weeks ago`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-ctl-slope-card
      data-slope-band={band}
      data-slope={slope}
      data-slope-per-week={slopePerWeek}
      data-recent-ctl={recentCtl}
      data-intercept={intercept}
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
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
            color: 'var(--text, #ccc)',
          }}>
            {title}
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted, #888)' }}>
              {recentLabel}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginTop: 2 }}>
              {interceptLabel}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}
          >
            {signed(slopePerWeek)}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 4 }}>
            {perWeekUnit}
          </div>
          <div
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              color, marginTop: 6,
            }}
          >
            {bandLabel}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 10, padding: '6px 8px',
        background: 'var(--surface, #111)', borderRadius: 4,
        fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
      }}>
        ↗ {hint}
      </div>

      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(CtlSlopeCard)
