// ─── RowingSplitConsistencyCard.jsx — split CV across same-distance pieces ────
//
// Companion to RowingMetricsCard (absolute pace). This card surfaces the
// CONSISTENCY of /500m splits across same-distance rowing pieces over the
// last 28 days — a technique / pacing-discipline signal, not an absolute
// pace one. See `lib/athlete/rowingSplitConsistency.js` for the math and
// scientific grounding (Foster 2001, Smith 2012, Steinacker 1993).
//
// Behaviour:
//   • Sport-gated: renders only when the athlete looks like a rower
//     (`profile.primarySport` contains "row", OR any log entry has
//     `type`/`sport` matching `/row/i`). Otherwise → null.
//   • Empty / under-threshold data → null.
//   • Renders avgCvPct + band + per-bucket rows (distance, n, mean split,
//     CV %). Bilingual EN/TR. Citation footer.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  computeRowingSplitConsistency,
  rowingConsistencyBlockedByRpe,
} from '../../lib/athlete/rowingSplitConsistency.js'
import { formatSplit } from '../../lib/sport/rowing.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  ELITE:        '#5bc25b',  // green
  COMPETITIVE:  '#0064ff',  // blue
  DEVELOPING:   '#ff6600',  // orange
  INCONSISTENT: '#e03030',  // red
}

const BAND_LABEL_TR = {
  ELITE:        'ELİT',
  COMPETITIVE:  'REKABETÇİ',
  DEVELOPING:   'GELİŞEN',
  INCONSISTENT: 'TUTARSIZ',
}

/**
 * Internal sport-gate: rower if profile.primarySport contains "row" OR
 * any log entry's type/sport matches /row/i.
 * @param {object} profile
 * @param {Array}  log
 * @returns {boolean}
 */
function isRower(profile, log) {
  const ps = (profile?.primarySport || '').toLowerCase()
  if (ps.includes('row')) return true
  if (!Array.isArray(log)) return false
  return log.some(e => /row/i.test(e?.type || '') || /row/i.test(e?.sport || ''))
}

function RowingSplitConsistencyCard({ log = [], profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const rower = useMemo(() => isRower(profile, log), [profile, log])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const result = useMemo(() => {
    if (!rower) return null
    return computeRowingSplitConsistency({ log, today })
  }, [rower, log, today])

  // v9.474 — honest empty state: rowing pieces exist but NONE carry a
  // steady-state RPE (post-v9.469 imports are honest-null), so the analysis
  // is blocked only by a missing effort signal. Tell the athlete instead of
  // silently disappearing.
  const rpeBlocked = useMemo(() => {
    if (!rower || result) return false
    return rowingConsistencyBlockedByRpe({ log, today })
  }, [rower, result, log, today])

  if (!rower) return null
  if (!result && rpeBlocked) {
    return (
      <div role="status" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          {isTR ? 'KÜREK SPLIT CV · 28G' : 'ROWING SPLIT CV · 28D'}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--muted)', lineHeight: 1.55 }}>
          {isTR
            ? 'Kürek parçaların var ama RPE girilmemiş. Split tutarlılığı analizi sabit-tempo seansları (RPE 4–7) gerektirir — logdan seansa RPE ekle.'
            : 'Rowing pieces found, but none carry an RPE. Split-consistency analysis needs steady-state sessions (RPE 4–7) — add RPE to your sessions from the log.'}
        </div>
      </div>
    )
  }
  if (!result) return null

  const color    = BAND_COLOR[result.band] || '#888'
  const bandText = isTR
    ? (BAND_LABEL_TR[result.band] || result.band)
    : result.band

  const title = isTR ? 'KÜREK SPLIT CV · 28G' : 'ROWING SPLIT CV · 28D'
  const ariaLabel = isTR
    ? 'Kürek split tutarlılığı (28 gün)'
    : 'Rowing split consistency (28-day)'

  const labelStyle = {
    fontSize: 10,
    color: 'var(--muted)',
    fontFamily: MONO,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-rowing-split-consistency-card
      data-consistency-band={result.band}
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
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: 'var(--text)',
        marginBottom: 10,
      }}>
        <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
        {title}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={labelStyle}>{isTR ? 'ORT. CV' : 'AVG CV'}</div>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color,
            lineHeight: 1.1,
            fontFamily: MONO,
          }}>
            {result.avgCvPct.toFixed(2)}%
          </div>
        </div>
        <div
          data-band-pill
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            fontSize: 11,
            fontFamily: MONO,
            fontWeight: 700,
            letterSpacing: '0.05em',
            background: `${color}22`,
            color,
            border: `1px solid ${color}55`,
          }}
        >
          {bandText}
        </div>
      </div>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 11,
        marginBottom: 8,
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ ...labelStyle, textAlign: 'left',  padding: '4px 6px' }}>
              {isTR ? 'MESAFE' : 'DIST'}
            </th>
            <th style={{ ...labelStyle, textAlign: 'right', padding: '4px 6px' }}>n</th>
            <th style={{ ...labelStyle, textAlign: 'right', padding: '4px 6px' }}>
              {isTR ? 'ORT. SPLIT' : 'MEAN SPLIT'}
            </th>
            <th style={{ ...labelStyle, textAlign: 'right', padding: '4px 6px' }}>CV%</th>
          </tr>
        </thead>
        <tbody>
          {result.bucketResults.map(b => (
            <tr key={b.distance} data-bucket-row data-bucket-distance={b.distance}>
              <td style={{ padding: '4px 6px', color: 'var(--text)' }}>
                {(b.distance / 1000).toFixed(b.distance < 1000 ? 1 : 0)}k
              </td>
              <td style={{ padding: '4px 6px', color: 'var(--muted)', textAlign: 'right' }}>
                {b.n}
              </td>
              <td style={{ padding: '4px 6px', color: 'var(--text)', textAlign: 'right' }}>
                {formatSplit(b.meanSplitSec)}
              </td>
              <td style={{
                padding: '4px 6px',
                textAlign: 'right',
                color,
                fontWeight: 600,
              }}>
                {b.cvPct.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
        marginTop: 6,
      }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(RowingSplitConsistencyCard)
