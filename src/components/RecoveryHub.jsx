// ─── RecoveryHub.jsx — E17 weekly retrospective recovery dashboard ────────────
// 28-day readiness heatmap + HRV sparkline + sleep debt + skipped-session count.
//
// Pure presentation component: pulls `recovery` and `log` from useData() and
// computes per-day readiness using the same lib (computeReadinessScore) that
// MorningCheckIn uses, so heatmap colors stay consistent with what the athlete
// sees on the morning check-in modal.
//
// References:
//   Plews 2013 (HRV rolling baseline) · Foster 1998 (wellness) ·
//   Lastella 2018 (sleep duration vs perf) — same set the readiness lib cites.
// ─────────────────────────────────────────────────────────────────────────────

import { useContext, useMemo } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { computeReadinessScore } from '../lib/recovery/readinessScore.js'
import { S } from '../styles.js'

const MONO = "'IBM Plex Mono', monospace"

// ── Helpers ────────────────────────────────────────────────────────────────

/** YYYY-MM-DD for a given Date in UTC. */
function ymd(d) {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x.toISOString().slice(0, 10)
}

/** Build the 28 dates ending today (oldest → newest). */
function build28Dates() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const out = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    out.push(ymd(d))
  }
  return out
}

/** Score band → color (0–100). Missing → light grey. */
function scoreBandColor(score) {
  if (score == null) return '#444'
  if (score < 40)  return '#e03030'
  if (score < 60)  return '#f5c542'
  if (score <= 80) return '#5bc25b'
  return '#3a8f3a'
}

/** Median utility (sparkline labels). */
function median(arr) {
  if (!arr.length) return null
  const s = arr.slice().sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ── Component ──────────────────────────────────────────────────────────────

export default function RecoveryHub({ idealSleepHrs = 8 }) {
  const { lang } = useContext(LangCtx)
  const { recovery, log } = useData()
  const isTR = lang === 'tr'

  const recList = Array.isArray(recovery) ? recovery : []
  const logList = Array.isArray(log) ? log : []

  // ── Derived: 28-day window ────────────────────────────────────────────────
  const dates28 = useMemo(() => build28Dates(), [])

  // Pre-index recovery entries by date for O(1) lookup.
  const recByDate = useMemo(() => {
    const m = new Map()
    for (const e of recList) if (e && e.date) m.set(e.date, e)
    return m
  }, [recList])

  // For each of the 28 dates compute (or look up) a readiness result.
  // We re-run computeReadinessScore for each day using all entries strictly
  // before that day's date as the rolling baseline (so the score is computed
  // the same way the morning check-in produced it). That gives reliability
  // and a consistent score on days where the athlete checked in.
  const heatmap = useMemo(() => {
    return dates28.map(date => {
      const entry = recByDate.get(date)
      if (!entry) {
        return { date, score: null, reliability: 'low', logged: false }
      }

      // Build histories using only data strictly older than `date` plus this
      // day's own values (mirrors MorningCheckIn.handleSave flow).
      const older = recList.filter(e => e && e.date && e.date < date)
      const hrvHistory = older
        .filter(e => parseFloat(e.hrv) > 0)
        .map(e => ({ date: e.date, hrv: parseFloat(e.hrv) }))
      if (parseFloat(entry.hrv) > 0) {
        hrvHistory.push({ date, hrv: parseFloat(entry.hrv) })
      }

      const sleepHistory = older
        .filter(e => parseFloat(e.sleepHrs) > 0)
        .map(e => ({ date: e.date, sleepHrs: parseFloat(e.sleepHrs) }))
      if (parseFloat(entry.sleepHrs) > 0) {
        sleepHistory.push({ date, sleepHrs: parseFloat(entry.sleepHrs) })
      }

      // soreness (1–5 → 1–10) and mood (use energy as proxy if missing)
      const sore = Number.isFinite(entry.soreness)
        ? (entry.soreness - 1) * (9 / 4) + 1
        : null
      const mood = Number.isFinite(entry.mood) && entry.mood >= 1 && entry.mood <= 5
        ? entry.mood
        : Number.isFinite(entry.energy) ? entry.energy : null

      const result = computeReadinessScore({
        hrvHistory,
        sleepHistory,
        soreness: sore,
        mood,
        asOf: date,
      })

      // Prefer a freshly-computed score; if it returns null but the persisted
      // entry has one, fall back to that.
      const score = result.score != null
        ? result.score
        : (Number.isFinite(entry.score) ? Math.round(entry.score) : null)

      return {
        date,
        score,
        reliability: result.reliability,
        logged: true,
      }
    })
  }, [dates28, recByDate, recList])

  // ── HRV sparkline data ────────────────────────────────────────────────────
  const hrvSeries = useMemo(() => {
    return dates28.map(date => {
      const e = recByDate.get(date)
      const v = e && parseFloat(e.hrv) > 0 ? parseFloat(e.hrv) : null
      return { date, value: v }
    })
  }, [dates28, recByDate])

  const hrvValues = hrvSeries.map(p => p.value).filter(v => v != null)
  const hrvMin = hrvValues.length ? Math.min(...hrvValues) : null
  const hrvMax = hrvValues.length ? Math.max(...hrvValues) : null
  const hrvMed = hrvValues.length ? Math.round(median(hrvValues) * 10) / 10 : null

  // ── Sleep debt (last 7 days) ──────────────────────────────────────────────
  const sleepDebt = useMemo(() => {
    const last7 = dates28.slice(-7)
    let sum = 0
    let n = 0
    for (const d of last7) {
      const e = recByDate.get(d)
      const h = e && parseFloat(e.sleepHrs) > 0 ? parseFloat(e.sleepHrs) : null
      if (h != null) { sum += h; n += 1 }
    }
    // If no sleep data at all → null (don't fabricate a 56h debt).
    if (n === 0) return { debt: null, days: 0 }
    const debt = 7 * idealSleepHrs - sum
    return { debt: Math.round(debt * 10) / 10, days: n }
  }, [dates28, recByDate, idealSleepHrs])

  function debtColor(d) {
    if (d == null) return '#555'
    if (d <= 0) return '#5bc25b'
    if (d <= 4) return '#f5c542'
    return '#e03030'
  }

  // ── Skipped sessions (low readiness AND no log entry that day) ────────────
  const logDates = useMemo(() => {
    const s = new Set()
    for (const e of logList) {
      if (e && e.date) s.add(String(e.date).slice(0, 10))
    }
    return s
  }, [logList])

  const skippedCount = useMemo(() => {
    let c = 0
    for (const cell of heatmap) {
      if (cell.score != null && cell.score < 40 && !logDates.has(cell.date)) {
        c += 1
      }
    }
    return c
  }, [heatmap, logDates])

  // ── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = recList.length === 0

  // ── Sparkline path ────────────────────────────────────────────────────────
  const sparkW = 280, sparkH = 60, padX = 4, padY = 6
  const sparkPath = useMemo(() => {
    if (hrvValues.length < 2) return null
    const min = Math.min(...hrvValues)
    const max = Math.max(...hrvValues)
    const range = max - min || 1
    const stepX = (sparkW - padX * 2) / (hrvSeries.length - 1)
    let d = ''
    let started = false
    hrvSeries.forEach((p, i) => {
      if (p.value == null) return
      const x = padX + i * stepX
      const y = padY + (sparkH - padY * 2) * (1 - (p.value - min) / range)
      d += (started ? ' L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)
      started = true
    })
    return d
  }, [hrvSeries, hrvValues])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '210ms' }} data-testid="recovery-hub">
      <div style={S.cardTitle}>
        {isTR ? 'TOPARLANMA MERKEZİ' : 'RECOVERY HUB'}
      </div>

      {isEmpty ? (
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', padding: '8px 0' }} data-testid="recovery-hub-empty">
          {isTR
            ? 'Toparlanma merkezini görmek için sabah kontrolü yap.'
            : 'Log a few morning check-ins to see your recovery hub.'}
        </div>
      ) : (
        <>
          {/* ── 1. 28-day readiness heatmap ────────────────────────────── */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '6px' }}>
              {isTR ? '28 GÜNLÜK HAZIR OLMA' : '28-DAY READINESS'}
            </div>
            <div
              role="grid"
              aria-label={isTR ? '28 günlük hazır olma ısı haritası' : '28-day readiness heatmap'}
              data-testid="readiness-heatmap"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gridTemplateRows: 'repeat(4, 1fr)',
                gap: '3px',
                maxWidth: '320px',
              }}
            >
              {heatmap.map(cell => {
                const color = scoreBandColor(cell.score)
                const scoreTxt = cell.score == null
                  ? (isTR ? 'veri yok' : 'no data')
                  : `${isTR ? 'puan' : 'score'} ${cell.score} (${isTR ? 'güven' : 'reliability'}: ${cell.reliability})`
                const ariaLabel = `${cell.date}: ${scoreTxt}`
                return (
                  <div
                    key={cell.date}
                    role="gridcell"
                    data-testid={`heatmap-cell-${cell.date}`}
                    data-score={cell.score == null ? '' : String(cell.score)}
                    aria-label={ariaLabel}
                    title={`${cell.date}: ${cell.score == null ? (isTR ? 'veri yok' : 'no data') : 'score ' + cell.score + ' (reliability: ' + cell.reliability + ')'}`}
                    style={{
                      aspectRatio: '1 / 1',
                      background: color,
                      borderRadius: '2px',
                      opacity: cell.score == null ? 0.4 : 1,
                      minHeight: '18px',
                    }}
                  />
                )
              })}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              {[
                { c: '#e03030', l: '<40' },
                { c: '#f5c542', l: '40-60' },
                { c: '#5bc25b', l: '60-80' },
                { c: '#3a8f3a', l: '>80' },
                { c: '#444',    l: isTR ? 'yok' : 'none' },
              ].map(b => (
                <span key={b.l} style={{ ...S.mono, fontSize: '8px', color: '#888', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ width: '8px', height: '8px', background: b.c, borderRadius: '1px', display: 'inline-block' }} />
                  {b.l}
                </span>
              ))}
            </div>
          </div>

          {/* ── 2. HRV 28-day sparkline ─────────────────────────────────── */}
          <div style={{ marginBottom: '16px' }} data-testid="hrv-sparkline-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
              <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.08em' }}>
                {isTR ? 'HRV — 28 GÜN' : 'HRV — 28 DAYS'}
              </div>
              {hrvValues.length >= 2 && (
                <div style={{ ...S.mono, fontSize: '9px', color: '#666' }}>
                  <span style={{ color: '#888' }}>{isTR ? 'min' : 'min'}</span> {hrvMin}
                  {' · '}
                  <span style={{ color: '#888' }}>{isTR ? 'medyan' : 'med'}</span> {hrvMed}
                  {' · '}
                  <span style={{ color: '#888' }}>{isTR ? 'maks' : 'max'}</span> {hrvMax}
                </div>
              )}
            </div>
            {hrvValues.length < 2 ? (
              <div style={{ ...S.mono, fontSize: '10px', color: '#666' }} data-testid="hrv-sparkline-empty">
                {isTR ? 'HRV verisi yetersiz.' : 'Not enough HRV data.'}
              </div>
            ) : (
              <svg
                width="100%"
                height={sparkH}
                viewBox={`0 0 ${sparkW} ${sparkH}`}
                preserveAspectRatio="none"
                role="img"
                aria-label={isTR ? '28 günlük HRV grafiği' : '28-day HRV trend'}
                data-testid="hrv-sparkline-svg"
                style={{ display: 'block' }}
              >
                <path d={sparkPath} fill="none" stroke="#0064ff" strokeWidth="1.5" />
              </svg>
            )}
          </div>

          {/* ── 3. Sleep debt (last 7d) ─────────────────────────────────── */}
          <div style={{ marginBottom: '16px' }} data-testid="sleep-debt-section">
            <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '4px' }}>
              {isTR ? 'UYKU BORCU — SON 7 GÜN' : 'SLEEP DEBT — LAST 7 DAYS'}
            </div>
            {sleepDebt.debt == null ? (
              <div style={{ ...S.mono, fontSize: '10px', color: '#666' }} data-testid="sleep-debt-empty">
                {isTR ? 'Uyku verisi yok.' : 'No sleep data logged.'}
              </div>
            ) : (
              <>
                <div
                  data-testid="sleep-debt-value"
                  style={{
                    ...S.mono,
                    fontSize: '20px',
                    fontWeight: 700,
                    color: debtColor(sleepDebt.debt),
                    lineHeight: 1.1,
                  }}
                >
                  {sleepDebt.debt > 0 ? '+' : ''}{sleepDebt.debt}h
                </div>
                <div style={{
                  height: '8px',
                  background: '#222',
                  borderRadius: '2px',
                  marginTop: '6px',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div
                    data-testid="sleep-debt-bar"
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(0, Math.abs(sleepDebt.debt) / 14 * 100))}%`,
                      background: debtColor(sleepDebt.debt),
                      transition: 'width 240ms ease-out',
                    }}
                  />
                </div>
                <div style={{ ...S.mono, fontSize: '8px', color: '#666', marginTop: '4px' }}>
                  {isTR
                    ? `${sleepDebt.days}/7 gün kaydedildi · ideal ${idealSleepHrs}sa/gün`
                    : `${sleepDebt.days}/7 days logged · ideal ${idealSleepHrs}h/night`}
                </div>
              </>
            )}
          </div>

          {/* ── 4. Skipped sessions correlated with low readiness ───────── */}
          <div data-testid="skipped-sessions-section">
            <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '4px' }}>
              {isTR ? 'DÜŞÜK HAZIRLIKLA ATLANAN SEANSLAR' : 'SESSIONS SKIPPED · LOW READINESS'}
            </div>
            <div
              data-testid="skipped-sessions-text"
              style={{ ...S.mono, fontSize: '11px', color: skippedCount > 0 ? '#f5c542' : '#5bc25b' }}
            >
              {isTR
                ? `Son 28 gün: düşük hazırlıkla ilişkili ${skippedCount} atlanan seans.`
                : `Last 28 days: ${skippedCount} skipped sessions correlated with low readiness.`}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
