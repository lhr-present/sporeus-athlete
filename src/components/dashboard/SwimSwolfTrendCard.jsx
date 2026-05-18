// ─── SwimSwolfTrendCard.jsx — SWOLF 28-day efficiency trend (Maglischo 2003) ─
//
// Pool-swim efficiency over time. SWOLF = strokes per length + seconds per
// length. Lower = better technique. Most apps only show a per-session
// value; this card trends the 28-day rolling mean so falling = improving
// technique and rising = fatigue-driven breakdown.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeSwimSwolfTrend } from '../../lib/athlete/swimSwolfTrend.js'

const MONO = "'IBM Plex Mono', monospace"

const TREND_COLOR = {
  improving: '#5bc25b', // green
  stable:    '#0064ff', // blue
  declining: '#f5a040', // orange
}
const TREND_ARROW = {
  improving: '↓',
  stable:    '→',
  declining: '↑',
}

const BAND_LABEL_EN = {
  ELITE:        'ELITE',
  COMPETITIVE:  'COMPETITIVE',
  TRAINED:      'TRAINED',
  RECREATIONAL: 'RECREATIONAL',
  BEGINNER:     'BEGINNER',
}
const BAND_LABEL_TR = {
  ELITE:        'ELİT',
  COMPETITIVE:  'YARIŞMACI',
  TRAINED:      'ANTRENMANLI',
  RECREATIONAL: 'AMATÖR',
  BEGINNER:     'BAŞLANGIÇ',
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function SwimSwolfTrendCard({ log = [], profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  // ── Sport gate: triathlete, swimmer, or any swim entries in log ────────────
  const isSwimmer = useMemo(() => {
    const sport = (profile?.primarySport || '').toLowerCase()
    if (sport.includes('swim')) return true
    if (sport === 'triathlon') return true
    if (Array.isArray(log)) {
      return log.some(e => /swim/i.test(e?.type || '') || /swim/i.test(e?.sport || ''))
    }
    return false
  }, [profile?.primarySport, log])

  const data = useMemo(() => {
    if (!isSwimmer) return null
    return computeSwimSwolfTrend({ log, today: todayISO() })
  }, [isSwimmer, log])

  if (!isSwimmer) return null
  if (!data) return null

  const { avgSwolf, n, band, weeklyMeans, trend, citation } = data
  const color  = TREND_COLOR[trend] || '#888'
  const arrow  = TREND_ARROW[trend] || '→'
  const bandLabel = (isTR ? BAND_LABEL_TR : BAND_LABEL_EN)[band] || band

  const title = isTR ? 'SWOLF · 28G' : 'SWOLF · 28D'
  const ariaLabel = isTR
    ? '28 günlük SWOLF verim eğilimi'
    : '28-day SWOLF efficiency trend'

  const interpretation = (() => {
    if (trend === 'improving') {
      return isTR
        ? 'Düşen eğilim — teknik gelişiyor (vuruş başına daha fazla mesafe).'
        : 'Falling trend — technique improving (more distance per stroke).'
    }
    if (trend === 'declining') {
      return isTR
        ? 'Yükselen eğilim — yorgunluk altında teknik bozulması olabilir.'
        : 'Rising trend — possible technique breakdown under fatigue.'
    }
    return isTR
      ? 'Sabit eğilim — verim son 28 günde tutarlı.'
      : 'Stable trend — efficiency consistent over the last 28 days.'
  })()

  // ── Sparkline ──────────────────────────────────────────────────────────────
  const W = 120
  const H = 28
  const PAD = 2
  const numericMeans = weeklyMeans.filter(m => m != null)
  let path = null
  let points = []
  if (numericMeans.length >= 2) {
    const min = Math.min(...numericMeans)
    const max = Math.max(...numericMeans)
    const range = Math.max(1, max - min)
    const xs = weeklyMeans.map((m, i) => PAD + (i * (W - 2 * PAD)) / 3)
    points = weeklyMeans.map((m, i) => {
      if (m == null) return null
      const y = PAD + (H - 2 * PAD) * (1 - (m - min) / range)
      return { x: xs[i], y, m }
    }).filter(Boolean)
    path = points.length >= 2
      ? 'M' + points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')
      : null
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-swim-swolf-trend-card=""
      data-trend={trend}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* ── Title ───────────────────────────────────────────────────────────── */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#ff6600',
        marginBottom: 12,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 8,
      }}>
        ◈ {title}
      </div>

      {/* ── Big SWOLF value + band + arrow ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <div style={{
          fontSize: 34,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}>
          {avgSwolf}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            padding: '2px 8px',
            borderRadius: 2,
            color,
            border: `1px solid ${color}55`,
            background: `${color}15`,
          }}>
            {bandLabel}
          </span>
          <span
            data-swolf-trend-arrow={trend}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color,
              letterSpacing: '0.05em',
            }}
          >
            {arrow} {isTR
              ? (trend === 'improving' ? 'GELİŞİYOR' : trend === 'declining' ? 'KÖTÜLEŞİYOR' : 'STABİL')
              : (trend === 'improving' ? 'IMPROVING' : trend === 'declining' ? 'DECLINING' : 'STABLE')}
          </span>
        </div>
      </div>

      {/* ── Sparkline (4 weekly means) ──────────────────────────────────────── */}
      <div style={{ marginBottom: 10 }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          aria-label={isTR ? '4 haftalık SWOLF hareketli grafiği' : '4-week SWOLF sparkline'}
          style={{ display: 'block' }}
        >
          {path ? (
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={2}
              fill={color}
            />
          ))}
        </svg>
        <div style={{
          fontSize: 9,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          marginTop: 2,
        }}>
          {isTR ? `${n} seans · 4 hafta` : `${n} sessions · 4 weeks`}
        </div>
      </div>

      {/* ── Interpretation ──────────────────────────────────────────────────── */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        marginBottom: 10,
      }}>
        {interpretation}
      </div>

      {/* ── Citation ────────────────────────────────────────────────────────── */}
      <div style={{
        fontSize: 9,
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        borderTop: '1px solid var(--border)',
        paddingTop: 6,
      }}>
        {citation}
      </div>
    </div>
  )
}
