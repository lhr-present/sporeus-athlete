// ─── WeeklyEnduranceTimeCard.jsx — Weekly Aerobic Hours Tracker ──────────────
//
// Surfaces `analyzeWeeklyEnduranceTime` (src/lib/athlete/weeklyEnduranceTime.js).
// Maffetone (2010) + Seiler (2010) + Stöggl (2014): aerobic adaptations
// (mitochondrial density, capillarisation, fat-oxidation) are driven by
// the ABSOLUTE volume of easy Z1+Z2 work per week — not the share alone.
// This card tracks weekly easy minutes against amateur (180-360),
// intermediate (360-600), and advanced (≥600) target bands.
//
// DIFFERENT from TimeInZoneCard / PolarizationComplianceCard /
// IntensityBalanceCard — those show shares or polarization compliance;
// this one shows the absolute aerobic-base-building dose in minutes/week.
//
// Bilingual via LangCtx. Renders null only when the pure-fn returns null
// (fewer than 6 weeks with any classifiable load in the 12-week window).
//
// Citations: Maffetone 2010; Seiler 2010; Stöggl 2014.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeWeeklyEnduranceTime } from '../../lib/athlete/weeklyEnduranceTime.js'

const MONO = "'IBM Plex Mono', monospace"
const BAR_AREA_HEIGHT = 56
const MIN_BAR_H = 3
const MUTED_COLOR = '#888888'

const BAND_COLOR = {
  BELOW_AMATEUR:     '#888888', // muted — not yet a base
  AMATEUR_BAND:      '#5bc25b', // green
  INTERMEDIATE_BAND: '#0064ff', // blue
  ADVANCED_BAND:     '#ff6600', // orange (signature)
}

const BAND_LABEL_EN = {
  BELOW_AMATEUR:     'BELOW AMATEUR',
  AMATEUR_BAND:      'AMATEUR',
  INTERMEDIATE_BAND: 'INTERMEDIATE',
  ADVANCED_BAND:     'ADVANCED',
}

const BAND_LABEL_TR = {
  BELOW_AMATEUR:     'AMATÖR ALTI',
  AMATEUR_BAND:      'AMATÖR',
  INTERMEDIATE_BAND: 'ORTA SEVİYE',
  ADVANCED_BAND:     'İLERİ',
}

const HINT_EN = {
  BELOW_AMATEUR:
    'Below the amateur aerobic-base target (180-360 min/wk Z1+Z2). Build easy volume first — mitochondrial gains scale with absolute easy minutes (Seiler 2010).',
  AMATEUR_BAND:
    'In the amateur base zone (180-360 min/wk Z1+Z2). Solid foundation; aim to grow toward 360+ min/wk for intermediate-level adaptations.',
  INTERMEDIATE_BAND:
    'In the intermediate aerobic-base zone (360-600 min/wk Z1+Z2). Sustainable platform for high-intensity work above it (Stöggl 2014).',
  ADVANCED_BAND:
    'In the advanced aerobic-base zone (≥600 min/wk Z1+Z2). Volume sufficient for elite-pattern adaptations — protect with easy days (Maffetone 2010).',
}

const HINT_TR = {
  BELOW_AMATEUR:
    'Amatör aerobik-temel hedefinin altında (180-360 dk/hf Z1+Z2). Önce kolay hacmi kur — mitokondri kazanımı mutlak kolay dakikalarla ölçeklenir (Seiler 2010).',
  AMATEUR_BAND:
    'Amatör temel bandındasın (180-360 dk/hf Z1+Z2). Sağlam zemin; orta seviye adaptasyon için 360+ dk/hf hedefle.',
  INTERMEDIATE_BAND:
    'Orta seviye aerobik-temel bandındasın (360-600 dk/hf Z1+Z2). Yüksek şiddet için sürdürülebilir platform (Stöggl 2014).',
  ADVANCED_BAND:
    'İleri aerobik-temel bandındasın (≥600 dk/hf Z1+Z2). Elit-örüntü adaptasyonları için yeterli hacim — kolay günlerle koru (Maffetone 2010).',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function formatHoursMinutes(min) {
  const v = Number(min)
  if (!Number.isFinite(v) || v <= 0) return '0 min'
  const whole = Math.round(v)
  if (whole < 60) return `${whole} min`
  const h = Math.floor(whole / 60)
  const m = whole - h * 60
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function formatPctSigned(frac) {
  const v = Number(frac)
  if (!Number.isFinite(v)) return '—'
  const pct = v * 100
  const rounded = Math.round(pct * 10) / 10
  if (rounded > 0) return `+${rounded.toFixed(1)}%`
  if (rounded < 0) return `${rounded.toFixed(1)}%`
  return '0.0%'
}

function formatPctUnsigned(frac) {
  const v = Number(frac)
  if (!Number.isFinite(v) || v < 0) return '—'
  const pct = v * 100
  return `${(Math.round(pct * 10) / 10).toFixed(1)}%`
}

/**
 * Dashboard card for weekly aerobic-foundation minutes (12 ISO weeks).
 *
 * @param {{ log: Array }} props
 */
export default function WeeklyEnduranceTimeCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeWeeklyEnduranceTime({ log, today: todayIso(), windowWeeks: 12 }),
    [log]
  )

  if (!result) return null

  const {
    band,
    weeks,
    meanEasyMinPerWeek,
    meanTotalMinPerWeek,
    easyShare,
    trendPctPerWeek,
    citation,
  } = result

  const color = BAND_COLOR[band] || MUTED_COLOR
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]
  const title = isTR ? 'HAFTALIK AEROBİK SAATLER · 12H' : 'WEEKLY AEROBIC HOURS · 12W'
  const ariaLabel = isTR
    ? 'Haftalık aerobik saatler kartı (Maffetone 2010; Seiler 2010; Stöggl 2014)'
    : 'Weekly aerobic hours card (Maffetone 2010; Seiler 2010; Stöggl 2014)'

  const meanLabel = isTR ? 'ort. kolay/hf' : 'mean easy/wk'
  const shareLabel = isTR ? 'antrenmanın kolay yüzdesi' : 'of total training easy'
  const slopeLabel = isTR ? 'eğim/hafta' : 'slope/wk'
  const targetHint = isTR
    ? 'amatör 180-360 · orta 360-600 · ileri 600+ dk/hf'
    : 'amateur 180-360 · intermediate 360-600 · advanced 600+ min/wk'

  const maxTotal = weeks.reduce(
    (m, w) => Math.max(m, w.totalMin || 0, w.easyMin || 0),
    0
  )

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="weekly-endurance-time"
      data-weekly-endurance-time-card
      data-band={band}
      data-mean-easy-min={meanEasyMinPerWeek}
      data-mean-total-min={meanTotalMinPerWeek}
      data-easy-share={easyShare}
      data-trend-pct-per-week={trendPctPerWeek}
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
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-band-label
          style={{
            fontSize: 10,
            letterSpacing: '0.05em',
            fontWeight: 700,
            padding: '3px 8px',
            background: `${color}22`,
            color,
            border: `1px solid ${color}`,
            borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Headline numbers row */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 14,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        <div>
          <div data-mean-easy-display style={{
            fontSize: 28, fontWeight: 700, color, lineHeight: 1,
          }}>
            {formatHoursMinutes(meanEasyMinPerWeek)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)', marginTop: 4,
            letterSpacing: '0.05em',
          }}>
            {meanLabel}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div data-share-display style={{
            fontSize: 12, color: 'var(--text)', fontWeight: 700,
          }}>
            {formatPctUnsigned(easyShare)} {shareLabel}
          </div>
          <div data-slope-display style={{
            fontSize: 12, color, fontWeight: 700, marginTop: 4,
          }}>
            {slopeLabel}: {formatPctSigned(trendPctPerWeek)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)', marginTop: 4,
          }}>
            {isTR ? 'ort. toplam/hf' : 'mean total/wk'}: {formatHoursMinutes(meanTotalMinPerWeek)}
          </div>
        </div>
      </div>

      {/* 12 vertical bars — one per ISO week. Filled portion = easy min,
          grey marker on top of that = total min (the "ceiling"). */}
      <div
        data-week-bars
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: BAR_AREA_HEIGHT + 4,
          marginTop: 6,
          marginBottom: 10,
        }}
      >
        {weeks.map(w => {
          const totalH = maxTotal > 0
            ? Math.max(MIN_BAR_H, Math.round((w.totalMin / maxTotal) * BAR_AREA_HEIGHT))
            : MIN_BAR_H
          const easyH = maxTotal > 0
            ? Math.max(0, Math.round((w.easyMin / maxTotal) * BAR_AREA_HEIGHT))
            : 0
          const hasData = w.totalMin > 0
          return (
            <div
              key={w.weekStart}
              data-week-bar
              data-week-start={w.weekStart}
              data-week-easy-min={w.easyMin}
              data-week-total-min={w.totalMin}
              title={`${w.weekStart} · easy ${Math.round(w.easyMin)}m / total ${Math.round(w.totalMin)}m`}
              style={{
                flex: 1,
                position: 'relative',
                height: totalH,
                background: hasData ? `${MUTED_COLOR}33` : 'transparent',
                border: `1px solid ${hasData ? MUTED_COLOR : MUTED_COLOR}`,
                borderRadius: 2,
                minWidth: 6,
                opacity: hasData ? 1 : 0.35,
                overflow: 'hidden',
              }}
            >
              <div
                data-week-bar-easy
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: easyH,
                  background: color,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Band-coloured interpretation strip */}
      <div
        data-hint
        style={{
          fontSize: 10,
          color: 'var(--text)',
          lineHeight: 1.5,
          padding: 8,
          background: `${color}14`,
          border: `1px solid ${color}33`,
          borderRadius: 3,
          marginBottom: 6,
        }}
      >
        {hint}
      </div>

      {/* Target band hint */}
      <div
        data-target-hint
        style={{
          fontSize: 9,
          color: 'var(--muted, #888)',
          marginBottom: 6,
          letterSpacing: '0.03em',
        }}
      >
        {targetHint}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}
