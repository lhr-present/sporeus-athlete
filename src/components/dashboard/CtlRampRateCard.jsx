// ─── CtlRampRateCard.jsx ─────────────────────────────────────────────────────
// Surfaces `computeCtlRampRate` (Gabbett 2016 + Banister 1975) — the
// week-over-week CTL ramp rate, complementary to the existing ACWR card.
// ACWR is a ratio; this is the raw weekly delta against Gabbett's
// "sweet spot" of 3–8 TSS/week.
//
// Render rules:
//   - Returns null when the pure-fn returns null (log too short).
//   - Otherwise renders for ALL four bands. The UNDERTRAINED band
//     carries a useful "you can push a bit more" signal mid-training.
//
// Bilingual EN/TR via LangCtx.
// Test anchors: data-ctl-ramp-rate-card, data-ramp-band.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeCtlRampRate } from '../../lib/athlete/ctlRampRate.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  UNDERTRAINED: '#ff6600', // orange — under sweet spot
  OPTIMAL:      '#5bc25b', // green  — Gabbett sweet spot
  AGGRESSIVE:   '#ff6600', // orange — overreach territory
  HIGH_RISK:    '#e03030', // red    — injury risk rises sharply
}

const BAND_LABEL_EN = {
  UNDERTRAINED: 'UNDERTRAINED',
  OPTIMAL:      'OPTIMAL',
  AGGRESSIVE:   'AGGRESSIVE',
  HIGH_RISK:    'HIGH RISK',
}
const BAND_LABEL_TR = {
  UNDERTRAINED: 'AZ ANTRENMAN',
  OPTIMAL:      'OPTIMUM',
  AGGRESSIVE:   'AGRESİF',
  HIGH_RISK:    'YÜKSEK RİSK',
}

const RECO_EN = {
  UNDERTRAINED: 'Below Gabbett sweet spot (3–8). Add a moderate session next week to keep building.',
  OPTIMAL:      'Inside Gabbett sweet spot (3–8 TSS/week). Maintain current load.',
  AGGRESSIVE:   'Above 8 TSS/week. Injury risk rises — flatten next week’s ramp.',
  HIGH_RISK:    'Above 12 TSS/week. Insert a recovery week before continuing.',
}
const RECO_TR = {
  UNDERTRAINED: 'Gabbett güvenli aralığının altında (3–8). Önümüzdeki hafta orta yoğunluklu bir seans ekle.',
  OPTIMAL:      'Gabbett güvenli aralığında (3–8 TSS/hafta). Mevcut yükü koru.',
  AGGRESSIVE:   '8 TSS/hafta üzerinde. Sakatlık riski yükseliyor — önümüzdeki haftanın artışını yatıştır.',
  HIGH_RISK:    '12 TSS/hafta üzerinde. Devam etmeden önce bir toparlanma haftası ekle.',
}

function todayIso() {
  const d = new Date()
  // Match formulas.js convention: UTC date slice.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

export default function CtlRampRateCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => computeCtlRampRate({ log, today: todayIso(), weeks: 4 }),
    [log]
  )

  if (!result) return null

  const { rampRate, currentCtl, baselineCtl, band, weeklyDeltas, citation } = result
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const reco = isTR ? RECO_TR[band] : RECO_EN[band]

  const title       = isTR ? 'CTL ARTIŞ HIZI · 4H' : 'CTL RAMP RATE · 4W'
  const ariaLabel   = isTR
    ? 'CTL haftalık artış hızı (Gabbett 2016)'
    : 'Weekly CTL ramp rate (Gabbett 2016)'
  const rampLabel   = isTR ? 'TSS/HAFTA' : 'TSS/WEEK'
  const baselineLbl = isTR ? 'BAŞLANGIÇ' : 'BASELINE'
  const currentLbl  = isTR ? 'BUGÜN'      : 'CURRENT'
  const sparkLabel  = isTR ? '4 HAFTALIK ARTIŞ' : '4-WEEK DELTAS'

  // Sparkline of weeklyDeltas (oldest → newest), centered on 0.
  const svgW = 200
  const svgH = 36
  const maxAbs = Math.max(1, ...weeklyDeltas.map(d => Math.abs(d)))
  const mid = svgH / 2
  const pts = weeklyDeltas.map((d, i) => {
    const x = weeklyDeltas.length > 1
      ? Math.round((i * (svgW - 2)) / (weeklyDeltas.length - 1)) + 1
      : Math.round(svgW / 2)
    const y = Math.round(mid - (d / maxAbs) * (mid - 2))
    return `${x},${y}`
  }).join(' ')

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-ctl-ramp-rate-card
      data-ramp-band={band}
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
          <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>{baselineLbl}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted, #888)' }}>
                {baselineCtl.toFixed(1)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>{currentLbl}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ff6600' }}>
                {currentCtl.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-ramp-rate-value
            style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}
          >
            {rampRate >= 0 ? '+' : ''}{rampRate.toFixed(1)}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 4 }}>
            {rampLabel}
          </div>
          <div
            data-ramp-band-label
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              color, marginTop: 4,
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
        ↗ {reco}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 4 }}>
          {sparkLabel}
        </div>
        <svg
          width={svgW}
          height={svgH}
          role="img"
          aria-label={sparkLabel}
          data-ramp-sparkline
          style={{ display: 'block' }}
        >
          <line
            x1="0" y1={mid} x2={svgW} y2={mid}
            stroke="var(--border, #333)" strokeWidth="1" strokeDasharray="2 2"
          />
          <polyline
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {weeklyDeltas.map((d, i) => {
            const x = weeklyDeltas.length > 1
              ? Math.round((i * (svgW - 2)) / (weeklyDeltas.length - 1)) + 1
              : Math.round(svgW / 2)
            const y = Math.round(mid - (d / maxAbs) * (mid - 2))
            return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
          })}
        </svg>
      </div>

      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}
