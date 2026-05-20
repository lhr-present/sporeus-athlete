// ─── ZoneThreeBlackHoleCard.jsx ─────────────────────────────────────────────
// Surfaces analyzeZoneThreeBlackHole (Seiler 2010; Stöggl 2014) — isolates
// Z3 minutes vs (Z4+Z5) minutes across the last 8 ISO weeks. Detects the
// "fitness death zone" anti-pattern (Z3 dominance without Z4/Z5 stimulus).
//
// Distinct from TimeInZoneCard / IntensityBalanceCard /
// PolarizationComplianceCard — those cover all zones or easy-vs-hard share;
// this card *only* asks "of your non-easy time, how much is moderate Z3 vs
// truly hard Z4–Z5?" and surfaces the z3/(z4+z5) ratio.
//
// Render rule: returns null when the analyzer returns null. Otherwise
// renders for all four bands (POLARIZED / BALANCED / BLACK_HOLE /
// INSUFFICIENT_HARD_VOLUME).

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  analyzeZoneThreeBlackHole,
  ZONE_THREE_BLACK_HOLE_CITATION,
} from '../../lib/athlete/zoneThreeBlackHole.js'

const MONO = "'IBM Plex Mono', monospace"
const Z3_COLOR = '#ff9500'    // orange — Z3 / tempo / "death zone"
const HARD_COLOR = '#dc3545'  // red    — Z4+Z5 / threshold + VO2
const NEUTRAL_COLOR = '#888888'

const BAND_COLOR = {
  POLARIZED:                  '#5bc25b', // green
  BALANCED:                   '#f5c542', // amber
  BLACK_HOLE:                 '#e03030', // red
  INSUFFICIENT_HARD_VOLUME:   '#888888', // grey
}

const BAND_LABEL_EN = {
  POLARIZED:                  'POLARIZED',
  BALANCED:                   'BALANCED',
  BLACK_HOLE:                 'BLACK HOLE',
  INSUFFICIENT_HARD_VOLUME:   'INSUFFICIENT DATA',
}
const BAND_LABEL_TR = {
  POLARIZED:                  'POLARİZE',
  BALANCED:                   'DENGELİ',
  BLACK_HOLE:                 'KARA DELİK',
  INSUFFICIENT_HARD_VOLUME:   'YETERSİZ VERİ',
}

const HINT_EN = {
  POLARIZED:
    'Most of your non-easy time is in Z4–Z5. This is the polarized pattern Seiler describes — Z3 is kept low, hard time is truly hard.',
  BALANCED:
    'A meaningful slice of your non-easy time sits in Z3. Some tempo is fine, but watch the share — drift past 60% and the black-hole pattern takes over.',
  BLACK_HOLE:
    'Most of your non-easy time is in Z3 (tempo), not Z4–Z5. This is the canonical "fitness death zone": too hard to recover, too easy to drive VO2/threshold adaptation. Move hard sessions to Z4–Z5; keep easy days truly easy.',
  INSUFFICIENT_HARD_VOLUME:
    'Not enough Z3 or Z4–Z5 time in the last 8 weeks to assess the black-hole pattern. Log more quality sessions with zone or RPE data.',
}
const HINT_TR = {
  POLARIZED:
    'Kolay olmayan zamanının çoğu Z4–Z5\'te. Bu, Seiler\'in tanımladığı polarize desen — Z3 düşük tutuluyor, sert zaman gerçekten sert.',
  BALANCED:
    'Kolay olmayan zamanının anlamlı bir kısmı Z3\'te. Bir miktar tempo kabul edilebilir ama oranı takip et — %60\'ı geçince kara delik deseni baskın olur.',
  BLACK_HOLE:
    'Kolay olmayan zamanının çoğu Z3 (tempo), Z4–Z5 değil. Bu klasik "fitness ölü bölgesi": toparlanmak için çok zor, VO2/eşik adaptasyonu için çok kolay. Sert seansları Z4–Z5\'e taşı; kolay günleri gerçekten kolay tut.',
  INSUFFICIENT_HARD_VOLUME:
    'Son 8 haftada kara delik desenini değerlendirmek için yeterli Z3 veya Z4–Z5 süresi yok. Bölge veya RPE içeren daha fazla kaliteli seans kaydet.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function formatRatio(ratio, totalHardMin) {
  if (totalHardMin === 0 || ratio === null) return '∞'
  const v = Number(ratio)
  if (!Number.isFinite(v)) return '—'
  return `${v.toFixed(1)}×`
}

export default function ZoneThreeBlackHoleCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeZoneThreeBlackHole({ log, today: todayIso(), windowWeeks: 8 }),
    [log],
  )

  if (!result) return null

  const {
    band,
    weeks,
    totalZ3Min,
    totalHardMin,
    z3ToHardRatio,
    z3SharePct,
    citation,
  } = result

  const color = BAND_COLOR[band] || NEUTRAL_COLOR
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'Z3 TUZAĞI · 8H' : 'Z3 BLACK HOLE · 8W'
  const ariaLabel = isTR
    ? 'Z3 tuzağı dedektörü (Seiler 2010; Stöggl 2014)'
    : 'Z3 black-hole detector (Seiler 2010; Stöggl 2014)'

  const ratioStr = formatRatio(z3ToHardRatio, totalHardMin)
  const sharePctStr = `${z3SharePct.toFixed(0)}%`

  const shareLabel = isTR
    ? `sert zamanının %${z3SharePct.toFixed(0)}\'i Z3`
    : `${z3SharePct.toFixed(0)}% of hard time is Z3`

  // ─── Two stacked horizontal bars: Z3 vs HARD totals ────────────────────────
  const maxTotal = Math.max(totalZ3Min, totalHardMin, 1)
  const z3BarPct = (totalZ3Min / maxTotal) * 100
  const hardBarPct = (totalHardMin / maxTotal) * 100

  // ─── Weekly mini-bars: each week shows z3 (orange) + hard (red) stacked ────
  const weekMaxMin = weeks.reduce(
    (m, w) => Math.max(m, (w.z3Min || 0) + (w.hardMin || 0)),
    0,
  )
  const MINI_BAR_AREA_H = 40

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="zone-three-black-hole"
      data-zone-three-band={band}
      data-z3-share-pct={z3SharePct}
      data-z3-to-hard-ratio={z3ToHardRatio == null ? 'infinity' : z3ToHardRatio}
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
      {/* ── Header ───────────────────────────────────────────────────────── */}
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
              {isTR
                ? `Z3: ${totalZ3Min} dk · Z4+Z5: ${totalHardMin} dk`
                : `Z3: ${totalZ3Min} min · Z4+Z5: ${totalHardMin} min`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginTop: 2 }}>
              {isTR
                ? `Z3/(Z4+Z5) oranı: ${ratioStr}`
                : `Z3/(Z4+Z5) ratio: ${ratioStr}`}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-z3-share-display
            style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}
          >
            {sharePctStr}
          </div>
          <div
            data-zone-three-band-label
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              color, marginTop: 8,
            }}
          >
            {bandLabel}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 8, fontSize: 10, color: 'var(--muted, #888)',
      }}>
        {shareLabel}
      </div>

      {/* ── Two stacked horizontal bars: Z3 vs HARD totals ─────────────── */}
      <div
        data-zone-three-totals
        style={{ marginTop: 12, marginBottom: 12 }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10, color: 'var(--muted, #aaa)', marginBottom: 2,
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8,
            background: Z3_COLOR, borderRadius: 1,
          }} aria-hidden="true" />
          <span>Z3</span>
          <span style={{ marginLeft: 'auto' }}>
            {totalZ3Min} {isTR ? 'dk' : 'min'}
          </span>
        </div>
        <div
          data-zone-three-bar-z3
          role="img"
          aria-label={isTR ? `Z3 toplam ${totalZ3Min} dakika` : `Z3 total ${totalZ3Min} minutes`}
          style={{
            width: '100%', height: 10, background: '#1a1a1a',
            borderRadius: 2, overflow: 'hidden', marginBottom: 8,
          }}
        >
          <div style={{
            width: `${z3BarPct}%`, height: '100%', background: Z3_COLOR,
          }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10, color: 'var(--muted, #aaa)', marginBottom: 2,
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8,
            background: HARD_COLOR, borderRadius: 1,
          }} aria-hidden="true" />
          <span>Z4+Z5</span>
          <span style={{ marginLeft: 'auto' }}>
            {totalHardMin} {isTR ? 'dk' : 'min'}
          </span>
        </div>
        <div
          data-zone-three-bar-hard
          role="img"
          aria-label={isTR ? `Z4+Z5 toplam ${totalHardMin} dakika` : `Z4+Z5 total ${totalHardMin} minutes`}
          style={{
            width: '100%', height: 10, background: '#1a1a1a',
            borderRadius: 2, overflow: 'hidden',
          }}
        >
          <div style={{
            width: `${hardBarPct}%`, height: '100%', background: HARD_COLOR,
          }} />
        </div>
      </div>

      {/* ── 8 weekly mini-bars: stacked z3 (orange) + hard (red) ────────── */}
      <div
        data-zone-three-weekly-bars
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 4,
          height: MINI_BAR_AREA_H + 12, marginTop: 12, marginBottom: 10,
        }}
      >
        {weeks.map((w, i) => {
          const totalMin = (w.z3Min || 0) + (w.hardMin || 0)
          const stackH = weekMaxMin > 0
            ? Math.max(2, Math.round((totalMin / weekMaxMin) * MINI_BAR_AREA_H))
            : 2
          const z3H = totalMin > 0
            ? Math.round((w.z3Min / totalMin) * stackH)
            : 0
          const hardH = stackH - z3H
          return (
            <div
              key={`${w.weekStart}-${i}`}
              data-week-bar
              data-week-start={w.weekStart}
              data-week-z3-min={w.z3Min}
              data-week-hard-min={w.hardMin}
              title={
                isTR
                  ? `${w.weekStart} · Z3 ${w.z3Min} dk · Z4+Z5 ${w.hardMin} dk`
                  : `${w.weekStart} · Z3 ${w.z3Min} min · Z4+Z5 ${w.hardMin} min`
              }
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
              }}
            >
              <div style={{
                width: '100%',
                height: stackH,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                border: `1px solid ${totalMin > 0 ? NEUTRAL_COLOR : '#33333355'}`,
                borderRadius: 1,
                overflow: 'hidden',
                background: '#1a1a1a',
              }}>
                {hardH > 0 ? (
                  <div style={{
                    width: '100%', height: hardH, background: HARD_COLOR,
                  }} />
                ) : null}
                {z3H > 0 ? (
                  <div style={{
                    width: '100%', height: z3H, background: Z3_COLOR,
                  }} />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Interpretation strip ──────────────────────────────────────────── */}
      <div
        data-zone-three-interpretation
        style={{
          marginTop: 10, padding: '6px 8px',
          background: 'var(--surface, #111)',
          borderLeft: `2px solid ${color}`,
          borderRadius: 4,
          fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
        }}
      >
        {hint}
      </div>

      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation || ZONE_THREE_BLACK_HOLE_CITATION}
      </div>
    </div>
  )
}
