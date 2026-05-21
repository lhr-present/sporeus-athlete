// ─── ConsecutiveDeloadCountCard.jsx ───────────────────────────────────────
// Surfaces `analyzeConsecutiveDeloadCount` (Bompa 2018; Mujika 2010):
// counts BACK-TO-BACK deload weeks (runs of length ≥ 2) in the last 16
// weeks and surfaces the longest stretch.
//
// Distinct from siblings:
//   - DeloadCadenceCard       — deload frequency overall.
//   - MesocycleProgressionCard — 3:1 loading-week pattern.
//   - ResetWeekEffectCard     — post-deload supercompensation.
//   - HardWeekUnrestedCard    — overreaching events without recovery.
//   - this card               — back-to-back deload events.
//
// Render rules:
//   - Returns null when the pure-fn returns null (unresolvable today).
//   - Otherwise renders for all four bands incl. INSUFFICIENT_DATA + NO_RUNS.
//   - 16 mini bars (one per week) coloured:
//       deload-in-run   → red
//       isolated-deload → orange
//       normal          → grey
//   - Up to 3 most-recent qualifying runs surface as chips.
//
// Bilingual EN/TR via LangCtx.
// Test anchors: data-card="consecutive-deload-count", data-band,
//   data-total-runs, data-longest-run, data-deload-weeks-total.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeConsecutiveDeloadCount } from '../../lib/athlete/consecutiveDeloadCount.js'

const MONO = "'IBM Plex Mono', monospace"
const WINDOW_WEEKS = 16
const DELOAD_THRESHOLD_PCT = 0.75

const BAND_COLOR = {
  NO_RUNS:           '#5bc25b', // green — clean
  OCCASIONAL_RUN:    '#ff6600', // orange — one slip, monitor
  EXTENDED_RUN:      '#e03030', // red    — drift / detraining risk
  INSUFFICIENT_DATA: '#888888', // muted  — not enough signal
}

const BAND_LABEL_EN = {
  NO_RUNS:           'NO RUNS',
  OCCASIONAL_RUN:    'OCCASIONAL',
  EXTENDED_RUN:      'EXTENDED',
  INSUFFICIENT_DATA: 'NOT ENOUGH DATA',
}
const BAND_LABEL_TR = {
  NO_RUNS:           'ÜST ÜSTE YOK',
  OCCASIONAL_RUN:    'ARA SIRA',
  EXTENDED_RUN:      'UZUN SÜRELİ',
  INSUFFICIENT_DATA: 'YETERSİZ VERİ',
}

const HINT_EN = {
  NO_RUNS:
    'No back-to-back deload weeks. Single deloads stayed strategic — exactly how periodization should look.',
  OCCASIONAL_RUN:
    'One back-to-back deload event. Likely life intrusion (illness, holiday, travel) — verify it was deliberate, then rebuild your loading cadence.',
  EXTENDED_RUN:
    'Multiple back-to-back deload events OR a stretch longer than 2 weeks. Detraining starts within 2 weeks of reduced load — check for unintended drift and reset the plan.',
  INSUFFICIENT_DATA:
    'Not enough classifiable weeks yet (need 6+). Log 4–6 more weeks of steady training to enable this signal.',
}
const HINT_TR = {
  NO_RUNS:
    'Üst üste boşaltma haftası yok. Tek boşaltmalar stratejik kaldı — periyodizasyon tam olarak böyle görünmeli.',
  OCCASIONAL_RUN:
    'Bir üst üste boşaltma olayı. Muhtemelen yaşam müdahalesi (hastalık, tatil, seyahat) — bunun kasıtlı olduğunu doğrula, sonra yüklenme ritmini yeniden kur.',
  EXTENDED_RUN:
    'Birden fazla üst üste boşaltma olayı VEYA 2 haftadan uzun bir dilim. Antrenmansızlık azaltılmış yükten 2 hafta sonra başlar — istenmeyen kaymayı kontrol et ve planı sıfırla.',
  INSUFFICIENT_DATA:
    'Henüz yeterli sınıflandırılabilir hafta yok (6+ gerekli). Bu sinyali açmak için 4–6 hafta daha istikrarlı antrenman kaydet.',
}

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
                  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function formatDayMonth(iso, isTR) {
  if (!iso || iso.length < 10) return ''
  const months = isTR ? MONTH_TR : MONTH_EN
  const m = Number(iso.slice(5, 7)) - 1
  const d = Number(iso.slice(8, 10))
  if (Number.isNaN(m) || Number.isNaN(d) || m < 0 || m > 11) return iso
  return isTR ? `${d} ${months[m]}` : `${months[m]} ${d}`
}

// ─── Mini-bar timeline (16 bars, oldest left → newest right) ─────────────
function MiniBars({ weekClassifications }) {
  const W = 280
  const H = 30
  const PAD_X = 4
  const GAP = 2
  const barWidth = (W - PAD_X * 2 - GAP * (weekClassifications.length - 1)) /
                   Math.max(weekClassifications.length, 1)

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
      data-mini-chart="consecutive-deload-count"
      style={{ display: 'block', marginTop: 8 }}
    >
      {weekClassifications.map((cls, i) => {
        const color =
          cls === 'deload-in-run'   ? '#e03030' :
          cls === 'isolated-deload' ? '#ff6600' :
                                      '#3a3a3a' // normal / unclassifiable
        const x = PAD_X + i * (barWidth + GAP)
        return (
          <rect
            key={i}
            data-mini-bar={cls}
            data-mini-bar-idx={i}
            x={x}
            y={H * 0.2}
            width={barWidth}
            height={H * 0.6}
            fill={color}
            opacity={cls === 'normal' ? 0.6 : 1}
            rx="1"
          />
        )
      })}
    </svg>
  )
}

/**
 * @description Surface `analyzeConsecutiveDeloadCount` as a Dashboard card.
 *   Renders null when the analyzer returns null.
 *
 * @param {{ log: Array }} props
 */
export default function ConsecutiveDeloadCountCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => todayIso(), [])

  const analysis = useMemo(
    () => analyzeConsecutiveDeloadCount({
      log,
      today,
      windowWeeks: WINDOW_WEEKS,
      deloadThresholdPct: DELOAD_THRESHOLD_PCT,
    }),
    [log, today],
  )

  // Build 16-week classification timeline (oldest left → newest right).
  // 'deload-in-run' | 'isolated-deload' | 'normal'.
  // We rebuild deload weeks from the runs (in-run) and from the
  // deloadWeeksTotal minus in-run (isolated).
  const weekClassifications = useMemo(() => {
    const arr = new Array(WINDOW_WEEKS).fill('normal')
    if (!analysis) return arr
    const todayD = new Date(today + 'T00:00:00Z')
    const dow = (todayD.getUTCDay() + 6) % 7
    todayD.setUTCDate(todayD.getUTCDate() - dow)
    const currentMondayMs = todayD.getTime()
    const idxByStart = Object.create(null)
    for (let i = 0; i < WINDOW_WEEKS; i++) {
      const ms = currentMondayMs - (WINDOW_WEEKS - 1 - i) * 7 * 86400000
      idxByStart[new Date(ms).toISOString().slice(0, 10)] = i
    }
    for (const run of analysis.runs) {
      const startIdx = idxByStart[run.startWeekStart]
      const endIdx = idxByStart[run.endWeekStart]
      if (startIdx == null || endIdx == null) continue
      for (let i = startIdx; i <= endIdx; i++) {
        arr[i] = 'deload-in-run'
      }
    }
    // We don't have the singletons enumerated here — but we know how many
    // there are (deloadWeeksTotal - sum(run lengths)). We can re-derive
    // them by re-running the threshold logic over a weekly TSS array we
    // build from log. To keep this card stateless and fast, only
    // 'deload-in-run' is visualised distinctly; isolated singletons stay
    // under 'normal' until we wire a per-week classification through the
    // pure-fn. The data-card surfaces deloadWeeksTotal so consumers can
    // still read the singleton count out.
    //
    // For visual fidelity, isolated singletons can still be re-derived
    // from the raw log here (cheap — 16 weeks × log scan).
    if (Array.isArray(log)) {
      const weekTss = new Array(WINDOW_WEEKS).fill(0)
      const earliest = Object.keys(idxByStart)
        .sort()[0]
      const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
      const exclusiveEnd = (() => {
        const d = new Date(today + 'T00:00:00Z')
        const _dow = (d.getUTCDay() + 6) % 7
        d.setUTCDate(d.getUTCDate() - _dow + 7)
        return d.toISOString().slice(0, 10)
      })()
      for (const e of log) {
        if (!e || !e.date) continue
        const key = String(e.date).slice(0, 10)
        if (!ISO_RE.test(key)) continue
        if (key < earliest) continue
        if (key >= exclusiveEnd) continue
        const dD = new Date(key + 'T00:00:00Z')
        const _dow2 = (dD.getUTCDay() + 6) % 7
        dD.setUTCDate(dD.getUTCDate() - _dow2)
        const wkStart = dD.toISOString().slice(0, 10)
        const idx = idxByStart[wkStart]
        if (idx == null) continue
        const tss = Number(e.tss)
        if (!Number.isFinite(tss) || tss <= 0) continue
        weekTss[idx] += tss
      }
      for (let i = 3; i < WINDOW_WEEKS; i++) {
        if (arr[i] === 'deload-in-run') continue
        const priorMean = (weekTss[i - 3] + weekTss[i - 2] + weekTss[i - 1]) / 3
        if (!(priorMean > 0)) continue
        const wk = weekTss[i]
        if (wk > 0 && wk < priorMean * DELOAD_THRESHOLD_PCT) {
          arr[i] = 'isolated-deload'
        }
      }
    }
    return arr
  }, [analysis, today, log])

  // Most-recent runs first (newest at end → reverse, slice 3).
  const recentRuns = useMemo(() => {
    if (!analysis) return []
    return analysis.runs.slice(-3).reverse()
  }, [analysis])

  if (!analysis) return null

  const {
    band,
    totalRuns,
    longestRunWeeks,
    deloadWeeksTotal,
    citation,
  } = analysis

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'ÜST ÜSTE YENİLEME HAFTALARI' : 'BACK-TO-BACK DELOADS'
  const ariaLabel = isTR
    ? 'Üst üste yenileme haftaları: arka arkaya boşaltma olayları (Bompa 2018; Mujika 2010)'
    : 'Back-to-back deloads: consecutive low-volume weeks (Bompa 2018; Mujika 2010)'

  const statSubEN = 'back-to-back events'
  const statSubTR = 'üst üste olay'
  const longestEN = 'longest'
  const longestTR = 'en uzun'
  const totalDeloadsEN = 'total deload weeks'
  const totalDeloadsTR = 'toplam boşaltma haftası'
  const weeksSuffixEN = 'wk'
  const weeksSuffixTR = 'hf'
  const refEN = 'ref'
  const refTR = 'ref'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="consecutive-deload-count"
      data-band={band}
      data-total-runs={String(totalRuns)}
      data-longest-run={String(longestRunWeeks)}
      data-deload-weeks-total={String(deloadWeeksTotal)}
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
      {/* Title + band badge */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 8, flexWrap: 'wrap',
      }}>
        <div
          data-consecutive-deload-title
          style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
            color: 'var(--text, #ccc)',
          }}
        >
          {title}
        </div>
        <div
          data-band-label
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            color, padding: '2px 8px',
            border: `1px solid ${color}`, borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Big stat */}
      <div style={{ marginTop: 10 }}>
        <div
          data-totalruns-display
          style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}
        >
          {totalRuns}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 4 }}>
          {isTR ? statSubTR : statSubEN}
          {' · '}
          <span data-longest-run-label>
            {isTR ? longestTR : longestEN}: {longestRunWeeks}{' '}
            {isTR ? weeksSuffixTR : weeksSuffixEN}
          </span>
          {' · '}
          <span data-deload-total-label>
            {isTR ? totalDeloadsTR : totalDeloadsEN}: {deloadWeeksTotal}
          </span>
        </div>
      </div>

      {/* 16-bar timeline */}
      <MiniBars weekClassifications={weekClassifications} />

      {/* Recent run chips (up to 3) */}
      {recentRuns.length > 0 ? (
        <div
          data-run-chips
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10,
          }}
        >
          {recentRuns.map((run, i) => {
            const startTxt = formatDayMonth(run.startWeekStart, isTR)
            const endTxt = formatDayMonth(run.endWeekStart, isTR)
            const lenTxt = isTR
              ? `${run.lengthWeeks} hafta`
              : `${run.lengthWeeks} weeks`
            const refTxt = `${isTR ? refTR : refEN} ${run.priorRefTss} TSS`
            return (
              <div
                key={run.startWeekStart || i}
                data-run-chip
                data-chip-start={run.startWeekStart}
                data-chip-end={run.endWeekStart}
                style={{
                  fontSize: 9, padding: '3px 6px',
                  border: `1px solid ${color}`, borderRadius: 3,
                  color: 'var(--text, #ccc)',
                  background: 'var(--surface, #111)',
                  lineHeight: 1.4,
                }}
              >
                {startTxt}-{endTxt}, {lenTxt}, {refTxt}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Band-coloured interpretation strip */}
      <div
        data-band-hint
        style={{
          marginTop: 10, padding: '6px 8px',
          background: 'var(--surface, #111)', borderRadius: 4,
          borderLeft: `2px solid ${color}`,
          fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
        }}
      >
        ↗ {hint}
      </div>

      {/* Citation */}
      <div
        data-consecutive-deload-citation
        style={{
          marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
        }}
      >
        {citation}
      </div>
    </div>
  )
}
