// ─── FieldTestHistoryCard.jsx — Field-test history (v9.179.0) ──────────────
//
// Read-only history of every field test the athlete has recorded via
// FieldTestModal (v9.177.0+). Reads `sporeus-field-test-results`
// directly — same pattern as EliteProgramCard reading
// `sporeus-eliteProgram` directly.
//
// Renders null when no entries exist (sport-gated like the other 74
// dashboard cards). Groups by metric field (vdot / ftp / cssSec /
// split2kSec) so a triathlete sees separate sections per discipline.
//
// Within each group: one-line trend summary (first → latest), then a
// table newest-first with date / value / delta / RPE / notes columns.
// Color coding on delta — green when moving in the "better" direction
// for the metric (higher VDOT/FTP is better; lower CSS/split is better).
//
// Read-only by design: editing historical entries is physiologically
// nonsensical (the training already happened against the actual recorded
// number). The Undo button on FieldTestModal handles capture-time typos
// within the same session.

import { memo, useContext, useMemo  } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'

const STORAGE = 'sporeus-field-test-results'
const MONO    = "'IBM Plex Mono', monospace"

const FIELD_META = {
  vdot:       { label: { en: 'VDOT',          tr: 'VDOT' },          unit: '',      higherBetter: true,  decimals: 1 },
  ftp:        { label: { en: 'FTP',           tr: 'FTP' },           unit: 'W',     higherBetter: true,  decimals: 0 },
  cssSec:     { label: { en: 'CSS',           tr: 'CSS' },           unit: 's/100m', higherBetter: false, decimals: 1 },
  split2kSec: { label: { en: '2k Split',      tr: '2k Split' },      unit: 's/500m', higherBetter: false, decimals: 1 },
}

function fmtVal(v, decimals) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n))
}

function fmtDelta(delta, higherBetter, decimals) {
  if (!Number.isFinite(delta) || delta === 0) return { text: '—', color: '#666' }
  const sign = delta > 0 ? '+' : ''
  const text = `${sign}${fmtVal(delta, decimals)}`
  const better = higherBetter ? delta > 0 : delta < 0
  return { text, color: better ? '#5bc25b' : '#e03030' }
}

function weeksBetween(aISO, bISO) {
  try {
    const a = new Date(aISO + 'T00:00:00Z').getTime()
    const b = new Date(bISO + 'T00:00:00Z').getTime()
    if (Number.isNaN(a) || Number.isNaN(b)) return null
    return Math.round((b - a) / (7 * 86400000))
  } catch { return null }
}

function FieldTestHistoryCard() {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'
  const [entries] = useLocalStorage(STORAGE, [])

  const grouped = useMemo(() => {
    if (!Array.isArray(entries) || entries.length === 0) return null
    const g = {}
    for (const e of entries) {
      if (!e || !e.field || !FIELD_META[e.field]) continue
      if (!Number.isFinite(Number(e.value))) continue
      if (!g[e.field]) g[e.field] = []
      g[e.field].push(e)
    }
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => String(b.date).localeCompare(String(a.date)))
    }
    return g
  }, [entries])

  if (!grouped || Object.keys(grouped).length === 0) return null

  return (
    <div style={{
      background: 'var(--card-bg, #0f0f0f)',
      border: '1px solid var(--border, #222)',
      borderRadius: 6,
      padding: 16,
      marginBottom: 16,
      fontFamily: MONO,
      color: 'var(--text, #ccc)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>📊</span>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text, #fff)', letterSpacing: '0.08em' }}>
          {isTR ? 'SAHA TESTİ GEÇMİŞİ' : 'FIELD TEST HISTORY'}
        </h3>
      </div>

      {Object.keys(grouped).map(field => {
        const list = grouped[field]
        const meta = FIELD_META[field]
        const newest = list[0]
        const oldest = list[list.length - 1]
        const firstVal = Number(oldest.value)
        const latestVal = Number(newest.value)
        const totalDelta = latestVal - firstVal
        const totalDeltaFmt = fmtDelta(totalDelta, meta.higherBetter, meta.decimals)
        const wks = list.length > 1 ? weeksBetween(oldest.date, newest.date) : null

        return (
          <div key={field} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: 'var(--muted, #888)', letterSpacing: '0.06em', marginBottom: 4, textTransform: 'uppercase' }}>
              {isTR ? meta.label.tr : meta.label.en} {meta.unit && `(${meta.unit})`}
            </div>

            {list.length > 1 ? (
              <div style={{ fontSize: 11, color: 'var(--text, #ccc)', marginBottom: 8 }}>
                {fmtVal(firstVal, meta.decimals)} → <strong style={{ color: 'var(--text, #fff)' }}>{fmtVal(latestVal, meta.decimals)}</strong>{' '}
                <span style={{ color: totalDeltaFmt.color, fontWeight: 700 }}>{totalDeltaFmt.text}</span>
                {wks != null && (
                  <span style={{ color: 'var(--muted, #888)', marginLeft: 6 }}>
                    {isTR ? `${wks} hafta içinde` : `over ${wks} week${wks === 1 ? '' : 's'}`}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginBottom: 8 }}>
                {isTR ? 'Henüz tek test — eğilim göstermek için en az 2 gerekir.' : 'Single test — need ≥ 2 to show a trend.'}
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ color: 'var(--muted, #888)', textAlign: 'left', borderBottom: '1px solid var(--border, #222)' }}>
                  <th style={cellHead}>{isTR ? 'TARİH' : 'DATE'}</th>
                  <th style={cellHead}>{isTR ? 'DEĞER' : 'VALUE'}</th>
                  <th style={cellHead}>Δ</th>
                  <th style={cellHead}>RPE</th>
                  <th style={cellHead}>{isTR ? 'NOT' : 'NOTES'}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e, i) => {
                  const prev = list[i + 1]  // next in display order = earlier in time
                  const v = Number(e.value)
                  const delta = prev ? v - Number(prev.value) : null
                  const dfmt = delta != null ? fmtDelta(delta, meta.higherBetter, meta.decimals) : { text: '—', color: 'var(--muted, #666)' }
                  return (
                    <tr key={`${e.date}-${i}`} style={{ borderBottom: '1px solid var(--border, #1a1a1a)' }}>
                      <td style={cell}>{e.date}</td>
                      <td style={{ ...cell, fontWeight: 700 }}>{fmtVal(v, meta.decimals)}</td>
                      <td style={{ ...cell, color: dfmt.color, fontWeight: 700 }}>{dfmt.text}</td>
                      <td style={cell}>{Number.isFinite(Number(e.rpe)) ? e.rpe : '—'}</td>
                      <td style={{ ...cell, color: 'var(--muted, #888)', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.notes || ''}>
                        {e.notes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

const cellHead = { padding: '4px 6px', fontWeight: 600, letterSpacing: '0.05em' }
const cell     = { padding: '5px 6px' }

export default memo(FieldTestHistoryCard)
