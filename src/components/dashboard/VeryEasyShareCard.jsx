// ─── VeryEasyShareCard.jsx — Maffetone RPE-based Very-Easy Share ─────────────
//
// Surfaces `analyzeVeryEasyShare` (src/lib/athlete/veryEasyShare.js).
// Maffetone (2010) + Seiler (2010): mitochondrial / fat-oxidation
// adaptation is driven by time spent at TRULY easy effort — not just
// "Z1/Z2" zones but subjectively very-easy (RPE ≤ 3 on Borg CR10).
//
// DIFFERENT lens from sibling cards:
//   - WeeklyEnduranceTimeCard       — absolute Z1+Z2 minutes/week (zone-based)
//   - TimeInZoneCard                — zone share snapshot
//   - PolarizationComplianceCard    — Seiler 80/20 model compliance
//
// This card is RPE-based — no zone field needed — and tracks the 30-day
// share of training minutes at very-easy RPE. Also surfaces data hygiene
// (unrated session count) so athletes can fix their logging habits.
//
// Bilingual via LangCtx. Renders null only when the pure-fn returns null
// (today cannot be resolved).
//
// Citations: Maffetone 2010; Seiler 2010.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeVeryEasyShare } from '../../lib/athlete/veryEasyShare.js'

const MONO = "'IBM Plex Mono', monospace"

const COLOR_VERY_EASY = '#5bc25b' // green — very-easy share
const COLOR_RATED_HARD = '#ff6600' // orange — rated but not very-easy
const COLOR_UNRATED = '#666666'    // grey — data hygiene
const MUTED_COLOR = '#888888'

const BAND_COLOR = {
  INSUFFICIENT_DATA: '#555555',
  INSUFFICIENT_BASE: '#e03030', // red — too little easy
  BUILDING_BASE:     '#ff9800', // amber — getting there
  STRONG_BASE:       '#5bc25b', // green — target
  EXCESSIVE_EASY:    '#0064ff', // blue — too easy
}

const BAND_LABEL_EN = {
  INSUFFICIENT_DATA: 'NEED MORE DATA',
  INSUFFICIENT_BASE: 'INSUFFICIENT BASE',
  BUILDING_BASE:     'BUILDING BASE',
  STRONG_BASE:       'STRONG BASE',
  EXCESSIVE_EASY:    'EXCESSIVE EASY',
}

const BAND_LABEL_TR = {
  INSUFFICIENT_DATA: 'YETERSİZ VERİ',
  INSUFFICIENT_BASE: 'YETERSİZ TEMEL',
  BUILDING_BASE:     'TEMEL GELİŞİYOR',
  STRONG_BASE:       'GÜÇLÜ TEMEL',
  EXCESSIVE_EASY:    'AŞIRI KOLAY',
}

const HINT_EN = {
  INSUFFICIENT_DATA:
    'Log at least 60 minutes of RPE-rated sessions in the last 30 days to see your very-easy share.',
  INSUFFICIENT_BASE:
    'Less than 30% of training is truly easy (RPE ≤ 3). Aerobic-base adaptations stall when most sessions feel moderate or harder (Maffetone 2010).',
  BUILDING_BASE:
    'Building aerobic base (30-55% very-easy). Push toward 55%+ to maximise mitochondrial and fat-oxidation gains (Seiler 2010).',
  STRONG_BASE:
    'Strong aerobic base (55-80% very-easy). Mitochondrial / fat-oxidation stimulus is well-supported alongside hard work (Seiler 2010).',
  EXCESSIVE_EASY:
    'More than 80% very-easy. Aerobic base is well-protected, but high-intensity stimulus may be missing for peak performance.',
}

const HINT_TR = {
  INSUFFICIENT_DATA:
    'Çok kolay payını görmek için son 30 günde RPE ile etiketlenmiş en az 60 dakika antrenman kaydet.',
  INSUFFICIENT_BASE:
    'Antrenmanın %30\'dan azı gerçekten kolay (RPE ≤ 3). Çoğu seans orta veya üstü hissedildiğinde aerobik temel duraklar (Maffetone 2010).',
  BUILDING_BASE:
    'Aerobik temel gelişiyor (%30-55 çok kolay). Mitokondri ve yağ-oksidasyonu kazanımını maksimize etmek için %55+ hedefle (Seiler 2010).',
  STRONG_BASE:
    'Güçlü aerobik temel (%55-80 çok kolay). Sert çalışmayla birlikte mitokondri / yağ-oksidasyonu uyarımı iyi destekleniyor (Seiler 2010).',
  EXCESSIVE_EASY:
    'Çok kolay oranı %80\'in üzerinde. Aerobik temel iyi korunuyor ama zirve performans için yüksek şiddet uyarımı eksik olabilir.',
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

function formatPct(frac) {
  const v = Number(frac)
  if (!Number.isFinite(v) || v < 0) return '—'
  const pct = v * 100
  return `${(Math.round(pct * 10) / 10).toFixed(1)}%`
}

/**
 * Dashboard card for 30-day RPE-based very-easy share (Maffetone aerobic base).
 *
 * @param {{ log: Array }} props
 */
export default function VeryEasyShareCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeVeryEasyShare({ log, today: todayIso(), windowDays: 30 }),
    [log]
  )

  if (!result) return null

  const {
    band,
    veryEasyMin,
    totalRatedMin,
    veryEasyShare,
    unratedSessionCount,
    citation,
  } = result

  const color = BAND_COLOR[band] || MUTED_COLOR
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]
  const title = isTR
    ? 'ÇOK KOLAY ANTRENMAN PAYI · 30G'
    : 'VERY-EASY SHARE · 30D'
  const ariaLabel = isTR
    ? 'Çok kolay antrenman payı kartı (Maffetone 2010; Seiler 2010)'
    : 'Very-Easy training share card (Maffetone 2010; Seiler 2010)'

  const ratedHardMin = Math.max(totalRatedMin - veryEasyMin, 0)

  // Stacked bar widths — proportional to (veryEasy : ratedHard : unrated).
  // Unrated is *count-of-sessions* not minutes; we surface it as a thin
  // grey bar segment proportional to count, with a max cap so a single
  // unrated session doesn't overwhelm the bar visually.
  const veryEasySeg = totalRatedMin > 0 ? veryEasyMin : 0
  const ratedHardSeg = totalRatedMin > 0 ? ratedHardMin : 0
  // Treat each unrated session as ~30 "equivalent units" for visual weight,
  // capped to 25% of the total bar so it stays a hint, not the headline.
  const unratedWeight = Math.min(
    unratedSessionCount * 30,
    Math.max(totalRatedMin * 0.25, 30)
  )
  const segSum = veryEasySeg + ratedHardSeg + unratedWeight
  const pctVeryEasy = segSum > 0 ? (veryEasySeg / segSum) * 100 : 0
  const pctRatedHard = segSum > 0 ? (ratedHardSeg / segSum) * 100 : 0
  const pctUnrated = segSum > 0 ? (unratedWeight / segSum) * 100 : 0

  const insufficient = band === 'INSUFFICIENT_DATA'

  const veryEasyLabel = isTR ? 'çok kolay' : 'very-easy'
  const totalLabel = isTR ? 'toplam etiketli' : 'total rated'
  const unratedLabel = isTR
    ? `${unratedSessionCount} etiketlenmemiş seans (RPE eksik)`
    : `${unratedSessionCount} unrated session${unratedSessionCount === 1 ? '' : 's'} (missing RPE)`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="very-easy-share"
      data-very-easy-share-card
      data-band={band}
      data-very-easy-min={veryEasyMin}
      data-total-rated-min={totalRatedMin}
      data-very-easy-share={veryEasyShare}
      data-unrated-session-count={unratedSessionCount}
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

      {/* Large headline stat: very-easy share % */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 14,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        <div>
          <div data-share-display style={{
            fontSize: 32, fontWeight: 700, color, lineHeight: 1,
          }}>
            {insufficient ? '—' : formatPct(veryEasyShare)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)', marginTop: 4,
            letterSpacing: '0.05em',
          }}>
            {isTR ? 'RPE ≤ 3 payı' : 'share at RPE ≤ 3'}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div data-volume-display style={{
            fontSize: 12, color: 'var(--text)', fontWeight: 700,
          }}>
            {formatHoursMinutes(veryEasyMin)} {veryEasyLabel}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)', marginTop: 4,
          }}>
            {totalLabel}: {formatHoursMinutes(totalRatedMin)}
          </div>
        </div>
      </div>

      {/* Stacked bar: very-easy | rated-not-easy | unrated */}
      <div
        data-stacked-bar
        style={{
          display: 'flex',
          height: 14,
          borderRadius: 3,
          overflow: 'hidden',
          background: '#1a1a1a',
          width: '100%',
          marginBottom: 10,
        }}
      >
        {pctVeryEasy > 0 && (
          <div
            data-seg="very-easy"
            title={`${veryEasyLabel}: ${formatPct(veryEasyShare)}`}
            style={{
              width: `${pctVeryEasy}%`,
              background: COLOR_VERY_EASY,
              height: '100%',
            }}
          />
        )}
        {pctRatedHard > 0 && (
          <div
            data-seg="rated-hard"
            title={isTR ? 'etiketli ama kolay değil' : 'rated but not very-easy'}
            style={{
              width: `${pctRatedHard}%`,
              background: COLOR_RATED_HARD,
              height: '100%',
            }}
          />
        )}
        {pctUnrated > 0 && (
          <div
            data-seg="unrated"
            title={unratedLabel}
            style={{
              width: `${pctUnrated}%`,
              background: COLOR_UNRATED,
              height: '100%',
            }}
          />
        )}
      </div>

      {/* Data hygiene note — only when unrated sessions exist */}
      {unratedSessionCount > 0 && (
        <div
          data-hygiene-note
          style={{
            fontSize: 9,
            color: 'var(--muted, #888)',
            marginBottom: 8,
            letterSpacing: '0.03em',
          }}
        >
          ⚠ {unratedLabel}
        </div>
      )}

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

      {/* Target hint */}
      <div
        data-target-hint
        style={{
          fontSize: 9,
          color: 'var(--muted, #888)',
          marginBottom: 6,
          letterSpacing: '0.03em',
        }}
      >
        {isTR
          ? 'hedef: %55-80 çok kolay (RPE ≤ 3)'
          : 'target: 55-80% very-easy (RPE ≤ 3)'}
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
