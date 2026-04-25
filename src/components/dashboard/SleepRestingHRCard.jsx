// ─── dashboard/SleepRestingHRCard.jsx — E50 sleep hours + resting HR ─────────
// Reference: Plews et al. (2012) — RHR as autonomic recovery marker
import { memo, useMemo, useContext } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeSleepRHR, parseSleepHrs, parseRHR } from '../../lib/athlete/sleepRestingHR.js'

// ── Status colour map ─────────────────────────────────────────────────────────
const SLEEP_COLOR = { good: '#5bc25b', fair: '#f5c542', low: '#e03030' }

function statusColor(s) { return SLEEP_COLOR[s] || '#888' }

// ── Inline SVG sparkline for sleep hours ─────────────────────────────────────
// 120×24px bar chart; 7h reference dashed line
function SleepSparkline({ entries }) {
  const W = 120, H = 24
  if (!entries || entries.length === 0) return null

  const vals = entries.map(e => parseSleepHrs(e) ?? 0)
  const maxV  = Math.max(...vals, 7)           // always show 7h reference
  const minV  = 0
  const range = maxV - minV || 1

  const barW  = Math.max(2, Math.floor((W - entries.length) / entries.length))
  const gap   = Math.max(1, Math.floor((W - entries.length * barW) / Math.max(entries.length - 1, 1)))
  const ref7Y = H - Math.round(((7 - minV) / range) * H)  // y-coord for 7h line

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Sleep hours sparkline"
    >
      {/* 7h reference line */}
      <line
        x1={0} y1={ref7Y}
        x2={W} y2={ref7Y}
        stroke="#888"
        strokeWidth={1}
        strokeDasharray="3,2"
        opacity={0.5}
      />
      {/* bars */}
      {vals.map((v, i) => {
        const x    = i * (barW + gap)
        const barH = Math.max(1, Math.round((v / range) * H))
        const y    = H - barH
        const entry = entries[i]
        const status = v >= 7 ? 'good' : v >= 6 ? 'fair' : 'low'
        return (
          <rect
            key={entry.date}
            x={x}
            y={y}
            width={barW}
            height={barH}
            fill={statusColor(status)}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
}

// ── Inline SVG sparkline for resting HR ──────────────────────────────────────
// 120×24px dot/bar chart; lower = better (inverted scale)
function RHRSparkline({ entries, avgRHR }) {
  const W = 120, H = 24
  if (!entries || entries.length === 0) return null

  const vals = entries.map(e => parseRHR(e) ?? 0)
  const maxV  = Math.max(...vals)
  const minV  = Math.min(...vals)
  const range = maxV - minV || 1

  const barW  = Math.max(2, Math.floor((W - entries.length) / entries.length))
  const gap   = Math.max(1, Math.floor((W - entries.length * barW) / Math.max(entries.length - 1, 1)))

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Resting HR sparkline"
    >
      {vals.map((v, i) => {
        const x      = i * (barW + gap)
        // invert: higher HR = taller bar (visually shows elevation)
        const barH   = Math.max(1, Math.round(((v - minV) / range) * (H - 4) + 4))
        const y      = H - barH
        // color: below avg = improving (green), above avg = caution (orange)
        const color  = avgRHR !== null && v <= avgRHR ? '#5bc25b' : '#f5c542'
        return (
          <rect
            key={entries[i].date}
            x={x}
            y={y}
            width={barW}
            height={barH}
            fill={color}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

function SleepRestingHRCard({ recovery }) {
  const { lang } = useContext(LangCtx)

  const data = useMemo(() => computeSleepRHR(recovery, 28), [recovery])

  if (!data) return null

  const {
    avgSleep, sleepStatus, sleepEntries,
    avgRHR, latestRHR, rhrAvg7, rhrEntries,
  } = data

  const isTR = lang === 'tr'

  const title       = isTR ? '◈ UYKU & İSTİRAHAT KALBİ'       : '◈ SLEEP & RESTING HR'
  const sleepLabel  = isTR ? 'ORT UYKU'                         : 'AVG SLEEP'
  const rhrLabel    = isTR ? 'İSTİRAHAT KALBİ'                 : 'RESTING HR'
  const avg7Label   = isTR ? '7g ort'                           : '7d avg'
  const badgeGood   = isTR ? 'İYİ'                              : 'GOOD'
  const badgeFair   = isTR ? 'ORTA'                             : 'FAIR'
  const badgeLow    = isTR ? 'DÜŞÜK'                            : 'LOW'

  const sleepBadge = sleepStatus === 'good' ? badgeGood
    : sleepStatus === 'fair' ? badgeFair
    : sleepStatus === 'low'  ? badgeLow
    : null

  const sColor = statusColor(sleepStatus)

  // RHR display value: prefer latestRHR, fall back to avgRHR
  const rhrDisplay = latestRHR ?? avgRHR
  // Color: latestRHR < avgRHR → improving (green), else caution (orange)
  const rhrColor = latestRHR !== null && avgRHR !== null
    ? latestRHR < avgRHR ? '#5bc25b' : '#f5c542'
    : '#888'

  return (
    <div style={{ ...S.card, fontFamily: 'IBM Plex Mono, monospace' }}>

      {/* Title */}
      <div style={{ ...S.cardTitle, color: '#ff6600', letterSpacing: '0.08em', marginBottom: '10px' }}>
        {title}
      </div>

      {/* ── Sleep section ── */}
      {avgSleep !== null && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.08em' }}>
              {sleepLabel}:
            </span>
            <span style={{
              ...S.mono,
              fontSize: '14px',
              fontWeight: 700,
              color: sColor,
              letterSpacing: '0.04em',
            }}>
              {avgSleep}h
            </span>
            {sleepBadge && (
              <span style={{
                ...S.mono,
                fontSize: '9px',
                fontWeight: 700,
                color: sColor,
                border: `1px solid ${sColor}`,
                borderRadius: '2px',
                padding: '1px 4px',
                letterSpacing: '0.06em',
              }}>
                {sleepBadge}
              </span>
            )}
          </div>
          <SleepSparkline entries={sleepEntries} />
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '2px' }}>
            {isTR ? '— 7s referans çizgisi' : '— 7h reference line'}
          </div>
        </div>
      )}

      {/* ── Resting HR section ── */}
      {avgRHR !== null && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.08em' }}>
              {rhrLabel}:
            </span>
            <span style={{
              ...S.mono,
              fontSize: '14px',
              fontWeight: 700,
              color: rhrColor,
              letterSpacing: '0.04em',
            }}>
              {rhrDisplay} bpm
            </span>
            {rhrAvg7 !== null && (
              <span style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.04em' }}>
                {avg7Label}: {rhrAvg7} bpm
              </span>
            )}
          </div>
          <RHRSparkline entries={rhrEntries} avgRHR={avgRHR} />
        </div>
      )}

      {/* Citation */}
      <div style={{
        ...S.mono,
        fontSize: '9px',
        color: 'var(--muted)',
        marginTop: '8px',
        letterSpacing: '0.04em',
        opacity: 0.7,
        borderTop: '1px solid var(--border)',
        paddingTop: '6px',
      }}>
        ℹ Plews et al. (2012) — RHR as autonomic recovery marker
      </div>

    </div>
  )
}

export default memo(SleepRestingHRCard)
