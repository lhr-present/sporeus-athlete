// ─── TimeOnFeetCard.jsx ─────────────────────────────────────────────────────
// Surfaces `analyzeTimeOnFeet` (Bennell 2012; Hreljac 2004) — weekly running
// "time on feet" (weight-bearing impact exposure) for runners. This week's
// total is compared against the 12-week chronic mean and classified into
// one of four bands. Spec: high weekly running minutes correlate with bone
// stress injury risk; the trend is a key safety marker for runners ramping
// up.
//
// Render rules:
//   - Returns null when the pure-fn returns null (no running data or
//     fewer than 4 of the 12 completed weeks have any running).
//   - Otherwise renders for all four bands.
//
// Bilingual EN/TR via LangCtx.
// Test anchors:
//   data-time-on-feet-card, data-time-on-feet-band, data-this-week-min,
//   data-avg-12w-min, data-delta-pct, plus per-bar
//   data-week-bar / data-week-start / data-week-minutes.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeTimeOnFeet } from '../../lib/athlete/timeOnFeet.js'

const MONO = "'IBM Plex Mono', monospace"

const BAR_AREA_HEIGHT = 36
const MUTED_COLOR = '#888888'

const BAND_COLOR = {
  SAFE_RAMP:     '#5bc25b', // green
  AGGRESSIVE:    '#ff6600', // orange
  DETRAINING:    '#0064ff', // blue
  BUILDING_BASE: '#888888', // muted
}

const BAND_LABEL_EN = {
  SAFE_RAMP:     'SAFE',
  AGGRESSIVE:    'AGGRESSIVE',
  DETRAINING:    'DETRAINING',
  BUILDING_BASE: 'BUILDING',
}
const BAND_LABEL_TR = {
  SAFE_RAMP:     'GÜVENLİ',
  AGGRESSIVE:    'AGRESİF',
  DETRAINING:    'AZALIYOR',
  BUILDING_BASE: 'İNŞA EDİYOR',
}

const HINT_EN = {
  SAFE_RAMP:
    "Running volume within Gabbett's safe zone (0.8-1.1× chronic load). Sustainable bone-loading exposure.",
  AGGRESSIVE:
    'Running time rising fast versus 12-week average. Bone stress risk increases when ACWR exceeds 1.5 — check ACWR card.',
  DETRAINING:
    'Running time below typical. Brief deload OK; longer absence reduces bone density. Verify intention.',
  BUILDING_BASE:
    'Just starting to log running. Build gradually — bone tissue adapts slower than aerobic capacity.',
}
const HINT_TR = {
  SAFE_RAMP:
    'Koşu hacmi Gabbett güvenli aralığında (0.8-1.1× kronik yük). Sürdürülebilir kemik-yükleme maruziyeti.',
  AGGRESSIVE:
    "Koşu süresi 12-haftalık ortalamaya göre hızla yükseliyor. ACWR 1.5'i aşınca kemik stresi riski artar — ACWR kartını kontrol et.",
  DETRAINING:
    'Koşu süresi normalin altında. Kısa azaltma iyi; uzun ara kemik yoğunluğunu düşürür. Niyetini doğrula.',
  BUILDING_BASE:
    'Koşuyu yeni kaydetmeye başladın. Aşamalı inşa et — kemik dokusu aerobik kapasiteden yavaş adapte olur.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

// Format minutes as `Hh Mm` (e.g. 245 → "4h 5m") when ≥ 60, else `Mm`
// (e.g. 45 → "45m"). Non-finite / negative → "0m".
export function formatMinutes(min) {
  const v = Number(min)
  if (!Number.isFinite(v) || v <= 0) return '0m'
  const whole = Math.round(v)
  if (whole < 60) return `${whole}m`
  const h = Math.floor(whole / 60)
  const m = whole - h * 60
  return `${h}h ${m}m`
}

function signedPct(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  const pct = Math.round(v * 100)
  return pct > 0 ? `+${pct}%` : `${pct}%`
}

export default function TimeOnFeetCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeTimeOnFeet({ log, today: todayIso(), windowWeeks: 12 }),
    [log]
  )

  if (!result) return null

  const { band, thisWeekMin, avg12WeekMin, deltaPct, weeks, citation } = result
  const color = BAND_COLOR[band] || MUTED_COLOR
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'AYAK ÜSTÜNDE SÜRE · 12H' : 'TIME ON FEET · 12W'
  const ariaLabel = isTR
    ? 'Haftalık koşu ayak-üstünde-süre güvenlik göstergesi (Bennell 2012; Hreljac 2004)'
    : 'Weekly running time-on-feet safety tracker (Bennell 2012; Hreljac 2004)'

  const avgLabel = isTR ? 'ort 12h:' : 'avg 12w:'
  const deltaLabel = deltaPct == null ? '—' : signedPct(deltaPct)

  const maxMin = weeks.reduce((m, w) => Math.max(m, w.minutes || 0), 0)

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-time-on-feet-card
      data-time-on-feet-band={band}
      data-this-week-min={thisWeekMin}
      data-avg-12w-min={avg12WeekMin}
      data-delta-pct={deltaPct == null ? '' : deltaPct}
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
              <span>{avgLabel} </span>
              <span style={{ fontWeight: 700 }}>{formatMinutes(avg12WeekMin)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginTop: 2 }}>
              <span style={{ fontWeight: 700, color }}>{deltaLabel}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}
          >
            {formatMinutes(thisWeekMin)}
          </div>
          <div
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              color, marginTop: 8,
            }}
          >
            {bandLabel}
          </div>
        </div>
      </div>

      {/* 12 mini bars — one per completed week, height proportional to minutes */}
      <div
        data-time-on-feet-bars
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: BAR_AREA_HEIGHT,
          marginTop: 12,
          marginBottom: 10,
        }}
      >
        {weeks.map((w, i) => {
          const active = w.minutes > 0
          const barH = active && maxMin > 0
            ? Math.max(4, Math.round((w.minutes / maxMin) * BAR_AREA_HEIGHT))
            : 3
          const barColor = active ? color : MUTED_COLOR
          return (
            <div
              key={`${w.weekStart}-${i}`}
              data-week-bar
              data-week-start={w.weekStart}
              data-week-minutes={w.minutes}
              title={`${w.weekStart} · ${formatMinutes(w.minutes)}`}
              style={{
                flex: 1,
                height: barH,
                background: active ? barColor : `${barColor}55`,
                border: `1px solid ${barColor}`,
                borderRadius: 1,
              }}
            />
          )
        })}
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
