// ─── dashboard/TodayReadinessCard.jsx — persistent E17 readiness on home ─────
// Shows today's morning readiness composite score (0–100) + reliability badge,
// top driver, and session recommendation. Reads recovery directly so the
// dashboard reflects the latest MorningCheckIn save without re-opening it.
//
// Pure rendering — defers all math to:
//   • computeReadinessScore  (src/lib/recovery/readinessScore.js)
//   • recommendSession       (src/lib/recovery/sessionRecommendation.js)
//
// Empty / null states:
//   • No recovery entry today → CTA to open MorningCheckIn
//   • Score null              → "Insufficient data" + CTA
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeReadinessScore } from '../../lib/recovery/readinessScore.js'
import { recommendSession } from '../../lib/recovery/sessionRecommendation.js'

const MONO = "'IBM Plex Mono', monospace"
const todayISO = () => new Date().toISOString().slice(0, 10)

// Score → banded color (matches MorningCheckIn cutoffs)
function scoreColor(score) {
  if (score == null) return '#555'
  if (score >= 80) return '#5bc25b'   // push      — green
  if (score >= 60) return '#9bd14b'   // planned   — light green
  if (score >= 40) return '#f5c542'   // easy      — yellow
  return '#e03030'                    // recovery  — red
}

const RELIABILITY_LABEL = {
  full:    { en: 'data complete', tr: 'veri tam' },
  partial: { en: 'partial data',   tr: 'kısmi veri' },
  low:     { en: 'limited data',   tr: 'yetersiz veri' },
}

const SESSION_LABEL = {
  recovery: { en: 'RECOVERY', tr: 'TOPARLANMA' },
  easy:     { en: 'EASY',      tr: 'KOLAY' },
  planned:  { en: 'PLANNED',   tr: 'PLANLI' },
  push:     { en: 'PUSH',      tr: 'YÜKLEN' },
}

/**
 * Persistent readiness card shown on the home dashboard.
 *
 * @param {Object} props
 * @param {Array}  [props.recovery]  recovery entries [{ date, hrv, sleepHrs, soreness, energy, ... }]
 * @param {Array}  [props.log]       training log (kept for forward-compat / parity with sibling cards)
 * @param {Object} [props.profile]   athlete profile (kept for forward-compat)
 * @param {Function} [props.onOpenCheckIn]  optional callback — when omitted the
 *        empty-state button dispatches a `sporeus:open-morning-checkin` window
 *        event so any listener (e.g. TodayView) may pop the modal.
 */
export default function TodayReadinessCard({
  recovery = [],
  log = [],            // eslint-disable-line no-unused-vars
  profile = {},        // eslint-disable-line no-unused-vars
  onOpenCheckIn,
}) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const date = todayISO()

  // Find today's recovery entry — match by exact ISO date string
  const todayEntry = useMemo(
    () => (Array.isArray(recovery) ? recovery.find(e => e && e.date === date) : null) || null,
    [recovery, date]
  )

  // Compute readiness using the SAME wiring shape as MorningCheckIn.handleSave
  const readiness = useMemo(() => {
    if (!todayEntry) return null

    const baseRecovery = Array.isArray(recovery) ? recovery : []
    // History excludes today (we re-append today's value below — same as MorningCheckIn)
    const history = baseRecovery.filter(e => e && e.date !== date)

    const hrvHistory = history
      .filter(e => parseFloat(e.hrv) > 0)
      .map(e => ({ date: e.date, hrv: parseFloat(e.hrv) }))
    if (parseFloat(todayEntry.hrv) > 0) {
      hrvHistory.push({ date, hrv: parseFloat(todayEntry.hrv) })
    }

    const sleepHistory = history
      .filter(e => parseFloat(e.sleepHrs) > 0)
      .map(e => ({ date: e.date, sleepHrs: parseFloat(e.sleepHrs) }))
    if (parseFloat(todayEntry.sleepHrs) > 0) {
      sleepHistory.push({ date, sleepHrs: parseFloat(todayEntry.sleepHrs) })
    }

    // Soreness scale: MorningCheckIn stores 1–5; the lib expects 1–10.
    const sorenessRaw = parseFloat(todayEntry.soreness)
    const sorenessScale10 = !isNaN(sorenessRaw)
      ? (sorenessRaw - 1) * (9 / 4) + 1
      : null

    // Mood proxy = energy slider, same as MorningCheckIn
    const moodVal = parseFloat(todayEntry.energy)
    const mood = !isNaN(moodVal) ? moodVal : null

    return computeReadinessScore({
      hrvHistory,
      sleepHistory,
      soreness: sorenessScale10,
      mood,
      asOf: date,
    })
  }, [todayEntry, recovery, date])

  const recommendation = useMemo(
    () => readiness ? recommendSession(readiness.score, null) : null,
    [readiness]
  )

  // CTA — open MorningCheckIn modal (callback prop OR window event fallback)
  function openCheckIn() {
    if (typeof onOpenCheckIn === 'function') {
      onOpenCheckIn()
      return
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('sporeus:open-morning-checkin'))
    }
  }

  // ── Empty state — no entry for today ─────────────────────────────────────
  if (!todayEntry) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Bugünkü hazır olma' : "Today's readiness"}
        style={{ ...S.card, animationDelay: '0ms' }}
      >
        <div style={{ ...S.cardTitle, marginBottom: '8px' }}>
          {isTR ? 'BUGÜN — HAZIR OLMA' : 'TODAY — READINESS'}
        </div>
        <div
          data-testid="readiness-empty-cta"
          style={{
            fontFamily: MONO, fontSize: '11px', color: 'var(--muted)',
            lineHeight: 1.6, marginBottom: '10px',
          }}
        >
          {isTR ? 'Sabah kontrolünü kaydetmek için dokun' : 'Tap to log morning check-in'}
        </div>
        <button
          type="button"
          onClick={openCheckIn}
          data-testid="open-checkin-btn"
          style={{
            ...S.btnSec, fontFamily: MONO, fontSize: '10px',
            padding: '6px 12px', cursor: 'pointer',
          }}
        >
          {isTR ? 'SABAH KONTROLÜ' : 'MORNING CHECK-IN'}
        </button>
      </div>
    )
  }

  const score    = readiness ? readiness.score : null
  const color    = scoreColor(score)
  const drivers  = readiness && Array.isArray(readiness.drivers) ? readiness.drivers : []
  const driver1  = drivers[0] || null
  const reliKey  = readiness ? readiness.reliability : 'low'
  const reliLbl  = (RELIABILITY_LABEL[reliKey] || RELIABILITY_LABEL.low)
  const reliText = reliLbl[lang] || reliLbl.en

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Bugünkü hazır olma' : "Today's readiness"}
      style={{ ...S.card, borderLeft: `4px solid ${color}`, animationDelay: '0ms' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          {isTR ? 'BUGÜN — HAZIR OLMA' : 'TODAY — READINESS'}
        </div>
        <span
          data-testid="reliability-badge"
          style={{
            fontFamily: MONO, fontSize: '8px', color: '#888',
            letterSpacing: '0.06em', textTransform: 'lowercase',
          }}
        >
          {reliText}
        </span>
      </div>

      {/* Low-reliability hint — tells the user what's thin and that the score
          sharpens with a few days of data. Additive; only in the low band. */}
      {reliKey === 'low' && (
        <div
          data-testid="reliability-hint"
          style={{
            fontFamily: MONO, fontSize: '9px', color: '#888',
            lineHeight: 1.5, marginBottom: '8px',
          }}
        >
          {isTR
            ? 'Sınırlı veriye dayalı — birkaç gün HRV ve uykunu kaydet, bu keskinleşir.'
            : 'Based on limited data — log HRV and sleep for a few days and this sharpens.'}
        </div>
      )}

      {score == null ? (
        <>
          <div
            data-testid="readiness-empty"
            style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}
          >
            {isTR ? 'Yetersiz veri' : 'Insufficient data'}
          </div>
          <button
            type="button"
            onClick={openCheckIn}
            data-testid="open-checkin-btn"
            style={{
              ...S.btnSec, fontFamily: MONO, fontSize: '10px',
              padding: '6px 12px', cursor: 'pointer',
            }}
          >
            {isTR ? 'SABAH KONTROLÜ' : 'MORNING CHECK-IN'}
          </button>
        </>
      ) : (
        <>
          {/* Composite score */}
          <div
            data-testid="readiness-score"
            style={{
              fontFamily: MONO, fontSize: '32px', fontWeight: 700,
              color, lineHeight: 1, marginBottom: '6px',
            }}
          >
            {score}<span style={{ fontSize: '12px', color: '#666', fontWeight: 400 }}>/100</span>
          </div>

          {/* Top driver — single, compact */}
          {driver1 && (
            <div
              data-testid={`driver-${driver1.factor}`}
              style={{
                fontFamily: MONO, fontSize: '10px', color: '#aaa',
                lineHeight: 1.4, paddingLeft: '8px',
                borderLeft: `2px solid ${driver1.delta < 0 ? '#e03030' : '#5bc25b'}`,
                marginBottom: '8px',
              }}
            >
              {driver1.reason[lang] || driver1.reason.en}
            </div>
          )}

          {/* Session recommendation pill */}
          {recommendation && (
            <div
              data-testid="session-recommendation"
              style={{
                display: 'inline-block',
                fontFamily: MONO, fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.08em',
                color, border: `1px solid ${color}55`,
                background: color + '15',
                padding: '3px 8px', borderRadius: '3px',
              }}
            >
              <span data-testid="rec-kind">
                {SESSION_LABEL[recommendation.recommended]?.[lang]
                  || SESSION_LABEL[recommendation.recommended]?.en
                  || (recommendation.recommended || '').toUpperCase()}
              </span>
            </div>
          )}

          {/* Recommendation reason — the WHY behind the pill (incl. the
              high-readiness-on-recovery-day special case, which flows through
              the same `reason` field). */}
          {recommendation?.reason?.[lang] || recommendation?.reason?.en ? (
            <div
              data-testid="rec-reason"
              style={{
                fontFamily: MONO, fontSize: '10px', color: '#aaa',
                lineHeight: 1.5, marginTop: '6px',
              }}
            >
              {recommendation.reason[lang] || recommendation.reason.en}
            </div>
          ) : null}

          {/* Citation — muted italic, matching the card-fleet citation style. */}
          {recommendation?.citation ? (
            <div
              data-testid="rec-citation"
              style={{
                fontFamily: MONO, fontSize: '9px', color: '#666',
                fontStyle: 'italic', marginTop: '4px',
              }}
            >
              {recommendation.citation}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
