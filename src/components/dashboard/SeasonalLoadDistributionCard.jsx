// ─── SeasonalLoadDistributionCard.jsx ────────────────────────────────────────
// Surfaces `analyzeSeasonalLoadDistribution` (Issurin 2010 + Bompa 2018) —
// a 12-month TSS distribution with periodization-pattern classification.
//
// Render rules:
//   - Returns null when the pure-fn returns null (fewer than 6 months
//     of populated history).
//   - Otherwise renders for all four patterns (BLOCK, TRADITIONAL,
//     VOLATILE, FLAT). Each carries its own interpretation hint.
//
// Bilingual EN/TR via LangCtx.
// Test anchors:
//   data-seasonal-load-card, data-load-pattern, data-peak-month,
//   data-avg-tss, data-cv, data-month-bar, data-month-label, data-month-tss.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeSeasonalLoadDistribution } from '../../lib/athlete/seasonalLoadDistribution.js'

const MONO = "'IBM Plex Mono', monospace"

const PATTERN_COLOR = {
  BLOCK:       '#ff6600', // orange
  TRADITIONAL: '#5bc25b', // green
  VOLATILE:    '#ff4444', // red
  FLAT:        '#888888', // muted
}

const PATTERN_LABEL_EN = {
  BLOCK:       'BLOCK',
  TRADITIONAL: 'TRADITIONAL',
  VOLATILE:    'VOLATILE',
  FLAT:        'FLAT',
}
const PATTERN_LABEL_TR = {
  BLOCK:       'BLOK',
  TRADITIONAL: 'KLASİK',
  VOLATILE:    'DEĞİŞKEN',
  FLAT:        'DÜZ',
}

const RECO_EN = {
  BLOCK:       'Strong block-periodized year — one major peak. Recover fully before the next block.',
  TRADITIONAL: 'Classic periodization — steady ramp and taper. Reliable annual progression.',
  VOLATILE:    'Multiple load spikes without clear taper. Plan recovery weeks between peaks.',
  FLAT:        'Even monthly load — good consistency, but no peak block for major performance gains.',
}
const RECO_TR = {
  BLOCK:       'Blok periyotlu güçlü yıl — tek büyük zirve. Sonraki bloktan önce tam toparlan.',
  TRADITIONAL: 'Klasik periyotlama — sürekli ramp ve azaltma. Güvenilir yıllık ilerleme.',
  VOLATILE:    'Net azaltma olmadan birden çok yük tepesi. Tepeler arasına toparlanma haftaları planla.',
  FLAT:        'Aylar arası eşit yük — iyi tutarlılık, ancak büyük performans kazançları için zirve bloğu yok.',
}

// English month labels are returned by the pure-fn (JAN/FEB/...).
// Provide a Turkish 3-letter mapping keyed by the same index.
const MONTH_LABEL_TR = ['OCA','ŞUB','MAR','NİS','MAY','HAZ','TEM','AĞU','EYL','EKİ','KAS','ARA']

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function trMonthLabel(monthKey) {
  // monthKey: 'YYYY-MM'
  const m = parseInt(monthKey.slice(5, 7), 10) - 1
  if (m < 0 || m > 11) return ''
  return MONTH_LABEL_TR[m]
}

function SeasonalLoadDistributionCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeSeasonalLoadDistribution({ log, today: todayIso() }),
    [log]
  )

  if (!result) return null

  const { pattern, months, peakMonth, avgTss, cv, citation } = result
  const color = PATTERN_COLOR[pattern] || '#888'
  const patternLabel = isTR ? PATTERN_LABEL_TR[pattern] : PATTERN_LABEL_EN[pattern]
  const reco = isTR ? RECO_TR[pattern] : RECO_EN[pattern]

  const title     = isTR ? 'MEVSİMSEL YÜK · 12A' : 'SEASONAL LOAD · 12M'
  const ariaLabel = isTR
    ? '12 aylık mevsimsel yük dağılımı (Issurin 2010)'
    : '12-month seasonal load distribution (Issurin 2010)'
  const peakLbl   = isTR ? 'ZİRVE'    : 'PEAK'
  const avgLbl    = isTR ? 'ORT. TSS' : 'AVG TSS'
  const cvLbl     = 'CV'

  const peakLabel = isTR ? trMonthLabel(peakMonth.month) : peakMonth.monthLabel
  const peakIdx = months.findIndex(m => m.month === peakMonth.month)

  // Bar dimensions
  const maxTss = months.reduce((m, x) => (x.tss > m ? x.tss : m), 0)
  const barAreaHeight = 60 // px max bar height
  const barWidthPct = `${100 / months.length}%`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-seasonal-load-card
      data-load-pattern={pattern}
      data-peak-month={peakMonth.month}
      data-avg-tss={avgTss}
      data-cv={cv}
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
              <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>{peakLbl}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ff6600' }}>
                {peakLabel} · {Math.round(peakMonth.tss)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>{avgLbl}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted, #888)' }}>
                {Math.round(avgTss)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>{cvLbl}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted, #888)' }}>
                {cv.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-pattern-label
            style={{
              fontSize: 16, fontWeight: 700, letterSpacing: '0.05em',
              color, lineHeight: 1.2,
            }}
          >
            {patternLabel}
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

      <div
        data-month-histogram
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          height: barAreaHeight + 18,
        }}
      >
        {months.map((m, i) => {
          const isPeak = i === peakIdx
          const h = maxTss > 0 ? Math.max(1, Math.round((m.tss / maxTss) * barAreaHeight)) : 1
          const barColor = isPeak ? color : 'var(--border, #444)'
          const label = isTR ? trMonthLabel(m.month) : m.monthLabel
          return (
            <div
              key={m.month}
              data-month-bar
              data-month-label={m.monthLabel}
              data-month-tss={m.tss}
              style={{
                flex: `0 0 ${barWidthPct}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
              }}
            >
              <div
                style={{
                  width: '85%',
                  height: h,
                  background: barColor,
                  borderRadius: 1,
                  opacity: isPeak ? 1 : 0.7,
                }}
                title={`${label} · ${Math.round(m.tss)}`}
              />
              <div
                style={{
                  marginTop: 4,
                  fontSize: 8,
                  color: isPeak ? color : 'var(--muted, #888)',
                  fontWeight: isPeak ? 700 : 400,
                  letterSpacing: '0.04em',
                }}
              >
                {label}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(SeasonalLoadDistributionCard)
