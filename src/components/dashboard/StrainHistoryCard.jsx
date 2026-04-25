// ─── StrainHistoryCard.jsx — E23: 8-week monotony+strain history (Foster 1998) ─
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  computeStrainReport,
  MONOTONY_HIGH_THRESHOLD,
} from '../../lib/athlete/strainHistory.js'

// ─── Chart constants ───────────────────────────────────────────────────────────
const SVG_W   = 240
const SVG_H   = 70
const BAR_W   = 22
const BAR_GAP = 6
const PAD_L   = 4
const PAD_B   = 16   // space for week labels below
const CHART_H = SVG_H - PAD_B  // usable bar height area
const MAX_MONOTONY_DISPLAY = 3.0  // cap for visual scaling

// Status → bar fill colour (Foster 1998 palette)
const STATUS_COLOR = {
  high_monotony: '#e03030',
  high_strain:   '#f5c542',
  ok:            '#5bc25b',
  low_load:      '#333',
}

export default function StrainHistoryCard({ log = [] }) {
  const { t, lang } = useContext(LangCtx)

  const report = computeStrainReport(log)
  if (!report) return null

  const { weeks, hasHighMonotony, hasHighStrain, citation } = report

  // ── Latest week values (last entry) ──────────────────────────────────────────
  const latest = weeks[weeks.length - 1] ?? null
  const latestMonotony = latest?.monotony ?? null
  const latestStrain   = latest?.strain   ?? null

  // ── Threshold line Y coordinate (monotony = 2.0) ─────────────────────────────
  const threshY = CHART_H - (MONOTONY_HIGH_THRESHOLD / MAX_MONOTONY_DISPLAY) * CHART_H

  return (
    <div className="sp-card" style={{ ...S.card }}>
      {/* Title + optional high-monotony badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <div style={{ ...S.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff6600' }}>
          ◈ {t('strainTitle')}
        </div>
        {hasHighMonotony && (
          <span style={{ ...S.mono, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: '2px', background: '#e0303022', color: '#e03030', border: '1px solid #e0303044' }}>
            {t('strainHighMonotony')}
          </span>
        )}
        {!hasHighMonotony && hasHighStrain && (
          <span style={{ ...S.mono, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: '2px', background: '#f5c54222', color: '#f5c542', border: '1px solid #f5c54244' }}>
            {t('strainHighStrain')}
          </span>
        )}
      </div>

      {/* Dual SVG chart — monotony bars + threshold line */}
      <svg
        width={SVG_W}
        height={SVG_H}
        style={{ display: 'block', overflow: 'visible', marginBottom: '10px' }}
        aria-label={t('strainTitle')}
      >
        {weeks.map((w, i) => {
          const x = PAD_L + i * (BAR_W + BAR_GAP)
          const mono = w.monotony ?? 0
          const barH = Math.min(mono / MAX_MONOTONY_DISPLAY, 1) * CHART_H
          const barY = CHART_H - barH
          const color = STATUS_COLOR[w.status] ?? '#333'
          // Extract week number for label e.g. "2026-W17" → "W17"
          const wLabel = w.isoWeek.replace(/^\d{4}-/, '')

          return (
            <g key={w.isoWeek}>
              {/* Bar — only draw if there is actual load */}
              {barH > 0 && (
                <rect
                  x={x}
                  y={barY}
                  width={BAR_W}
                  height={barH}
                  fill={color}
                  rx="1"
                  opacity={0.9}
                />
              )}
              {/* Zero-load placeholder */}
              {barH === 0 && (
                <rect
                  x={x}
                  y={CHART_H - 2}
                  width={BAR_W}
                  height={2}
                  fill="#333"
                  rx="1"
                />
              )}
              {/* Week label */}
              <text
                x={x + BAR_W / 2}
                y={SVG_H - 2}
                textAnchor="middle"
                fontFamily="'IBM Plex Mono', monospace"
                fontSize="7"
                fill="#666"
              >
                {wLabel}
              </text>
            </g>
          )
        })}

        {/* Horizontal threshold line at monotony = 2.0 */}
        <line
          x1={PAD_L}
          y1={threshY}
          x2={PAD_L + weeks.length * (BAR_W + BAR_GAP) - BAR_GAP}
          y2={threshY}
          stroke="#e03030"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity={0.7}
        />
        {/* Threshold label */}
        <text
          x={PAD_L + weeks.length * (BAR_W + BAR_GAP) - BAR_GAP + 3}
          y={threshY + 3}
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="7"
          fill="#e03030"
          opacity={0.8}
        >
          2.0 {t('strainThreshold')}
        </text>
      </svg>

      {/* Latest values — two column row */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
        <div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('strainMonotony')}
          </div>
          <div style={{ ...S.mono, fontSize: '18px', fontWeight: 600, color: latestMonotony !== null && latestMonotony >= MONOTONY_HIGH_THRESHOLD ? '#e03030' : 'var(--text)' }}>
            {latestMonotony !== null ? latestMonotony.toFixed(2) : '—'}
          </div>
        </div>
        <div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('strainStrain')}
          </div>
          <div style={{ ...S.mono, fontSize: '18px', fontWeight: 600, color: latestStrain !== null && latestStrain >= 6000 ? '#f5c542' : 'var(--text)' }}>
            {latestStrain !== null ? latestStrain.toLocaleString() : '—'}
          </div>
        </div>
      </div>

      {/* Foster citation */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#444', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '6px', letterSpacing: '0.04em' }}>
        {citation}
      </div>
    </div>
  )
}
