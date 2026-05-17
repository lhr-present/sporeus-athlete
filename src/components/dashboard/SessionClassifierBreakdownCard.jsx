// ─── SessionClassifierBreakdownCard.jsx — Weekly session-type distribution ───
//
// Surfaces the pure-fn `classifySession` (src/lib/coach/classifySession.js)
// — fully tested, but until now only consumed by coach-side tooling. This
// card extracts the current Mon-Sun week from `log`, classifies each
// session, and renders a compact distribution (count + total minutes per
// type). Helps the athlete spot polarization issues:
// too-much-grey-zone / not-enough-true-Z2 / missed-planned-sessions, per
// Daniels 2014; Coggan 2010; Seiler 2010 polarized training.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  classifySession,
  aggregateWeekClassification,
} from '../../lib/coach/classifySession.js'

const MONO = "'IBM Plex Mono', monospace"

// Bilingual labels covering both the live classifier outputs (test, junk,
// recovery, planned_match, planned_miss, unplanned_high, unplanned_low,
// moderate) AND the polarized-training type names listed in the card spec
// (z2, vo2, threshold, tempo, long, race, other). Any tag the classifier
// emits that has no explicit row here renders with its raw key uppercased.
const LABELS = {
  // Polarized training categories (spec)
  z2:        { en: 'Z2 Easy',      tr: 'Z2 Hafif' },
  vo2:       { en: 'VO2 Max',      tr: 'VO2 Maks' },
  threshold: { en: 'Threshold',    tr: 'Eşik' },
  tempo:     { en: 'Tempo',        tr: 'Tempo' },
  long:      { en: 'Long',         tr: 'Uzun' },
  race:      { en: 'Race',         tr: 'Yarış' },
  recovery:  { en: 'Recovery',     tr: 'Toparlanma' },
  other:     { en: 'Other',        tr: 'Diğer' },
  // Live classifier tags (classifySession.js)
  test:           { en: 'Test',           tr: 'Test' },
  junk:           { en: 'Junk',           tr: 'Verimsiz' },
  planned_match:  { en: 'Plan Match',     tr: 'Plan Uyumu' },
  planned_miss:   { en: 'Plan Miss',      tr: 'Plan Eksik' },
  unplanned_high: { en: 'Unplanned High', tr: 'Plansız Yüksek' },
  unplanned_low:  { en: 'Unplanned Low',  tr: 'Plansız Düşük' },
  moderate:       { en: 'Moderate',       tr: 'Orta' },
}

const TAG_COLOR = {
  z2:             '#5bc25b',
  vo2:            '#e03030',
  threshold:      '#ff6600',
  tempo:          '#f5c542',
  long:           '#0064ff',
  race:           '#e03030',
  recovery:       '#5bc25b',
  other:          '#888888',
  test:           '#ff6600',
  junk:           '#666666',
  planned_match:  '#5bc25b',
  planned_miss:   '#e03030',
  unplanned_high: '#f5c542',
  unplanned_low:  '#888888',
  moderate:       '#0064ff',
}

// Mon-Sun week containing the given Date. Returns { startISO, endISO }
// as YYYY-MM-DD strings. Uses noon-UTC anchoring to avoid TZ drift
// (matches src/lib/intelligence.js pattern).
function getMonSunWeek(today) {
  const ref = new Date(`${today.toISOString().slice(0, 10)}T12:00:00Z`)
  const dow = (ref.getUTCDay() + 6) % 7 // Mon=0, Sun=6
  const monday = new Date(ref)
  monday.setUTCDate(ref.getUTCDate() - dow)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return {
    startISO: monday.toISOString().slice(0, 10),
    endISO: sunday.toISOString().slice(0, 10),
  }
}

export default function SessionClassifierBreakdownCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const breakdown = useMemo(() => {
    if (!Array.isArray(log) || log.length === 0) return null

    const { startISO, endISO } = getMonSunWeek(new Date())
    const thisWeek = log.filter(e => {
      const d = e?.date
      return typeof d === 'string' && d >= startISO && d <= endISO
    })

    if (thisWeek.length < 2) return null

    // Classify each session and collect tag + minutes side-by-side.
    // We reuse aggregateWeekClassification for the counts contract,
    // and tally minutes ourselves (the helper only exposes counts).
    const classified = thisWeek.map(s => {
      // Allow synthetic test sessions to pre-declare a tag.
      const tag = (typeof s?.tag === 'string' && s.tag)
        ? s.tag
        : classifySession(s).tag
      return { ...s, tag }
    })

    const counts = aggregateWeekClassification(classified)
    // counts may not include synthetic tags like 'z2' — supplement with
    // a direct tally so any unrecognized tag still surfaces a row.
    const tally = {}
    const minutes = {}
    for (const s of classified) {
      const t = s.tag || 'moderate'
      tally[t] = (tally[t] || 0) + 1
      minutes[t] = (minutes[t] || 0) + (Number(s.duration) || 0)
    }
    // Reconcile classifier counts back in so the shape is stable.
    for (const k of Object.keys(counts)) {
      if (k === 'compliance') continue
      if (counts[k] > 0 && !tally[k]) tally[k] = counts[k]
    }

    const rows = Object.keys(tally)
      .filter(t => tally[t] >= 1)
      .sort((a, b) => tally[b] - tally[a])
      .map(t => ({
        tag: t,
        count: tally[t],
        minutes: Math.round(minutes[t] || 0),
      }))

    return { rows, total: thisWeek.length, startISO, endISO }
  }, [log])

  if (!breakdown) return null

  const heading = isTR ? 'HAFTA · SINIFLAMA' : 'WEEK · CLASSIFIED'
  const ariaLabel = isTR
    ? 'Haftalık antrenman sınıflandırma dağılımı'
    : 'Weekly session classification breakdown'
  const typesPresent = breakdown.rows.map(r => r.tag).join(',')

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-session-classifier-breakdown-card
      data-types-present={typesPresent}
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
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 10,
      }}>
        <span style={{ color: '#0064ff' }}>◢</span>
        <span style={{
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.06em',
        }}>
          {heading}
        </span>
        <span style={{ color: 'var(--muted, #888)', fontSize: 10 }}>
          · {breakdown.total} {isTR ? 'antrenman' : 'sessions'}
        </span>
      </div>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 11,
        marginBottom: 8,
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border, #222)' }}>
            <th style={{
              textAlign: 'left',
              padding: '4px 6px',
              color: 'var(--muted, #888)',
              fontWeight: 400,
              fontSize: 10,
              letterSpacing: '0.05em',
            }}>
              {isTR ? 'TİP' : 'TYPE'}
            </th>
            <th style={{
              textAlign: 'right',
              padding: '4px 6px',
              color: 'var(--muted, #888)',
              fontWeight: 400,
              fontSize: 10,
              letterSpacing: '0.05em',
            }}>
              {isTR ? 'ADET' : 'COUNT'}
            </th>
            <th style={{
              textAlign: 'right',
              padding: '4px 6px',
              color: 'var(--muted, #888)',
              fontWeight: 400,
              fontSize: 10,
              letterSpacing: '0.05em',
            }}>
              {isTR ? 'DAKİKA' : 'MIN'}
            </th>
          </tr>
        </thead>
        <tbody>
          {breakdown.rows.map(row => {
            const lbl = LABELS[row.tag]
            const text = lbl
              ? (isTR ? lbl.tr : lbl.en)
              : row.tag.toUpperCase()
            const color = TAG_COLOR[row.tag] || '#888888'
            return (
              <tr
                key={row.tag}
                data-tag={row.tag}
                style={{ borderBottom: '1px solid var(--border, #1a1a1a)' }}
              >
                <td style={{ padding: '4px 6px', color: 'var(--text, #ccc)' }}>
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    background: color,
                    borderRadius: 2,
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }} />
                  {text}
                </td>
                <td
                  data-count
                  style={{
                    textAlign: 'right',
                    padding: '4px 6px',
                    color: 'var(--text, #ccc)',
                    fontWeight: 700,
                  }}
                >
                  {row.count}
                </td>
                <td
                  data-minutes
                  style={{
                    textAlign: 'right',
                    padding: '4px 6px',
                    color: 'var(--muted, #888)',
                  }}
                >
                  {row.minutes}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Daniels 2014; Coggan 2010; Seiler 2010
      </div>
    </div>
  )
}
