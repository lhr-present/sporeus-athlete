// ─── HRVDashboard.jsx — HRV analysis: readiness + lnRMSSD trend + DFA-α1 ───
import { useState, useMemo, useContext } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import {
  cleanRRIntervals,
  calculateRMSSD,
  calculateLnRMSSD,
  scoreReadiness,
  calculateDFAAlpha1,
  parsePolarHRM,
} from '../lib/hrv.js'

const MONO   = "'IBM Plex Mono', monospace"
const TOOLTIP = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #333', fontFamily: MONO, fontSize: 10 },
  labelStyle:   { color: '#888' },
}

// ── Readiness score display ──────────────────────────────────────────────────
function ReadinessScore({ readiness }) {
  const { score, color, status, recommendation, pct } = readiness
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'16px', padding:'10px 0 14px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        border: `3px solid ${color}`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: '#555' }}>/10</span>
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 11, color, fontWeight: 600, marginBottom: 3 }}>
          {status.toUpperCase()} · {pct}% OF BASELINE
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#aaa' }}>
          {recommendation}
        </div>
      </div>
    </div>
  )
}

// ── lnRMSSD 30-day trend chart ───────────────────────────────────────────────
function LnRMSSDChart({ data, baseline, band }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', marginBottom: 4 }}>
        lnRMSSD (30d) · baseline {baseline ? baseline.toFixed(2) : '—'} · ±1σ band
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis
            dataKey="date"
            tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }}
            interval={Math.max(1, Math.floor(data.length / 5))}
          />
          <YAxis tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }} domain={['auto', 'auto']} />
          <Tooltip
            {...TOOLTIP}
            formatter={(v, name) => [
              typeof v === 'number' ? v.toFixed(3) : v,
              name === 'lnRMSSD' ? 'lnRMSSD' : '7d avg',
            ]}
          />
          {band && (
            <ReferenceArea y1={band.low} y2={band.high} fill="#ff660015" />
          )}
          {baseline && (
            <ReferenceLine y={baseline} stroke="#ff660055" strokeDasharray="4 2" />
          )}
          <Line
            type="monotone" dataKey="lnRMSSD" stroke="#ff6600"
            strokeWidth={1.5} dot={{ r: 2, fill: '#ff6600' }} isAnimationActive={false}
          />
          <Line
            type="monotone" dataKey="avg7" stroke="#0064ff"
            strokeWidth={2} dot={false} strokeDasharray="3 2" isAnimationActive={false}
            name="7d avg"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── DFA-α1 badge ─────────────────────────────────────────────────────────────
function DFABadge({ alpha1, ectopicPct }) {
  const interpret =
    alpha1 > 1.0 ? { label: 'BELOW LT1 — AEROBIC',     color: '#5bc25b' }
    : alpha1 > 0.75 ? { label: 'APPROACHING LT1',       color: '#f5c542' }
    : { label: 'AT OR ABOVE LT1',                       color: '#e03030' }

  return (
    <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center', margin:'8px 0' }}>
      <div style={{
        fontFamily: MONO, fontSize: 10,
        padding: '4px 10px', borderRadius: '2px',
        border: `1px solid ${interpret.color}44`,
        color: interpret.color,
      }}>
        DFA-α1 {alpha1.toFixed(3)} · {interpret.label}
      </div>
      {ectopicPct > 0 && (
        <div style={{
          fontFamily: MONO, fontSize: 9,
          color: ectopicPct > 5 ? '#e03030' : '#888',
          border: `1px solid ${ectopicPct > 5 ? '#e0303044' : '#33333344'}`,
          padding: '4px 8px', borderRadius: '2px',
        }}>
          {ectopicPct > 5 && '⚠ '}ECTOPIC {ectopicPct}%
        </div>
      )}
      <div title="Gronwald et al. 2019, Front. Physiol. DFA-α1 ≈ 0.75 at aerobic threshold (LT1). At rest (morning HRV), values >1.0 are normal."
        style={{ fontFamily: MONO, fontSize: 9, color: '#444', cursor: 'help' }}>
        ⓘ Gronwald 2019
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HRVDashboard({ recovery, setRecovery }) {
  const { t: _t } = useContext(LangCtx)
  const [fileResult, setFileResult]   = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [manualRMSSD, setManualRMSSD] = useState('')
  const [processing, setProcessing]   = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  // ── Build 30-day lnRMSSD series ─────────────────────────────────────────
  const lnSeries = useMemo(() => {
    const sorted = [...(recovery || [])]
      .filter(e => parseFloat(e.rmssd || e.hrv) > 0)
      .sort((a, b) => a.date > b.date ? 1 : -1)
      .slice(-30)

    // Rolling 7-day average
    const vals = sorted.map(e => calculateLnRMSSD(parseFloat(e.rmssd || e.hrv)))
    return sorted.map((e, i) => {
      const win = vals.slice(Math.max(0, i - 6), i + 1)
      return {
        date:      e.date.slice(5),
        fullDate:  e.date,
        lnRMSSD:   Math.round(vals[i] * 1000) / 1000,
        avg7:      Math.round(win.reduce((s, v) => s + v, 0) / win.length * 1000) / 1000,
        dfaAlpha1: e.dfaAlpha1 || null,
      }
    })
  }, [recovery])

  // ── 7-day rolling baseline (excludes today) ──────────────────────────────
  const baseline7 = useMemo(() => {
    const prev = lnSeries.filter(p => p.fullDate !== today).slice(-7)
    if (prev.length < 3) return null
    return prev.reduce((s, p) => s + p.lnRMSSD, 0) / prev.length
  }, [lnSeries, today])

  // ── Baseline ±1σ band ────────────────────────────────────────────────────
  const baselineBand = useMemo(() => {
    if (!baseline7) return null
    const vals = lnSeries.filter(p => p.fullDate !== today).slice(-7).map(p => p.lnRMSSD)
    const std  = Math.sqrt(vals.reduce((s, v) => s + (v - baseline7) ** 2, 0) / vals.length)
    return {
      low:  Math.round((baseline7 - std) * 1000) / 1000,
      high: Math.round((baseline7 + std) * 1000) / 1000,
    }
  }, [lnSeries, baseline7, today])

  // ── Today's readiness ────────────────────────────────────────────────────
  const todayEntry = (recovery || []).find(e => e.date === today)
  const todayLnRMSSD = useMemo(() => {
    if (!todayEntry) return null
    const v = parseFloat(todayEntry.rmssd || todayEntry.hrv)
    return v > 0 ? calculateLnRMSSD(v) : null
  }, [todayEntry])

  const readiness = todayLnRMSSD && baseline7
    ? scoreReadiness(todayLnRMSSD, baseline7)
    : null

  // ── Save HRV fields to today's recovery entry ────────────────────────────
  function saveToEntry(fields) {
    setRecovery(prev => {
      const idx = (prev || []).findIndex(e => e.date === today)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], ...fields }
        return updated
      }
      return [...(prev || []), { date: today, ...fields }]
    })
  }

  // ── .hrm file upload ─────────────────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessing(true)
    setUploadError(null)
    try {
      const text   = await file.text()
      const rrRaw  = parsePolarHRM(text)
      if (rrRaw.length < 50) {
        throw new Error(`Only ${rrRaw.length} RR intervals found — need ≥ 300 for DFA-α1`)
      }
      const { cleaned, ectopicCount, ectopicPct } = cleanRRIntervals(rrRaw)
      const rmssd      = calculateRMSSD(cleaned)
      const lnRMSSD_v  = calculateLnRMSSD(rmssd)
      const dfaAlpha1  = cleaned.length >= 300 ? calculateDFAAlpha1(cleaned) : null
      const result     = { rmssd, lnRMSSD: lnRMSSD_v, dfaAlpha1, ectopicPct, ectopicCount, source: 'polar' }
      setFileResult(result)
      saveToEntry({ rmssd, lnRMSSD: lnRMSSD_v, dfaAlpha1, ectopicPct, source: 'polar', hrv: String(Math.round(rmssd)) })
    } catch (err) {
      setUploadError(err.message || 'Failed to parse file')
    } finally {
      setProcessing(false)
      e.target.value = ''
    }
  }

  // ── Manual RMSSD save ────────────────────────────────────────────────────
  function handleManualSave() {
    const v = parseFloat(manualRMSSD)
    if (!v || v < 5 || v > 300) return
    const lnRMSSD_v = calculateLnRMSSD(v)
    saveToEntry({ rmssd: v, lnRMSSD: lnRMSSD_v, source: 'manual', hrv: String(Math.round(v)) })
    setManualRMSSD('')
  }

  // ── Active DFA-α1 / ectopicPct (from file or stored) ───────────────────
  const activeAlpha1    = fileResult?.dfaAlpha1    ?? todayEntry?.dfaAlpha1    ?? null
  const activeEctopic   = fileResult?.ectopicPct   ?? todayEntry?.ectopicPct   ?? 0

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '70ms' }}>
      <div style={S.cardTitle}>HRV ANALYSIS</div>

      {/* Readiness score */}
      {readiness ? (
        <ReadinessScore readiness={readiness} />
      ) : (
        <div style={{ ...S.mono, fontSize: 10, color: '#555', padding: '8px 0 12px' }}>
          {todayLnRMSSD
            ? 'Need ≥ 3 prior HRV entries to compute readiness baseline.'
            : 'Log morning RMSSD below to see readiness score.'}
        </div>
      )}

      {/* lnRMSSD trend chart */}
      {lnSeries.length >= 3 && (
        <LnRMSSDChart data={lnSeries} baseline={baseline7} band={baselineBand} />
      )}

      {/* DFA-α1 badge */}
      {activeAlpha1 !== null && (
        <DFABadge alpha1={activeAlpha1} ectopicPct={activeEctopic} />
      )}

      {/* Import section */}
      <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <div style={{ ...S.mono, fontSize: 10, color: '#888', marginBottom: '8px' }}>
          IMPORT RR INTERVALS
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* File upload */}
          <label style={{ cursor: 'pointer' }}>
            <span style={{
              ...S.mono, fontSize: 10,
              padding: '4px 10px', border: '1px solid #333', borderRadius: '2px',
              color: processing ? '#555' : '#888', cursor: 'pointer', display: 'block',
            }}>
              {processing ? 'PROCESSING…' : '⬆ POLAR .HRM'}
            </span>
            <input
              type="file" accept=".hrm,.txt"
              onChange={handleFileUpload}
              disabled={processing}
              style={{ display: 'none' }}
            />
          </label>

          {/* Manual RMSSD entry */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              style={{ ...S.input, width: '88px' }}
              type="number" min="5" max="300" placeholder="RMSSD ms"
              value={manualRMSSD}
              onChange={e => setManualRMSSD(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSave()}
            />
            <button
              onClick={handleManualSave}
              style={{
                ...S.mono, fontSize: 10,
                padding: '4px 8px', background: 'transparent',
                border: '1px solid #333', borderRadius: '2px',
                color: '#888', cursor: 'pointer',
              }}
            >
              SAVE
            </button>
          </div>
        </div>

        {/* Parse result summary */}
        {fileResult && (
          <div style={{ ...S.mono, fontSize: 10, color: '#5bc25b', marginTop: '8px' }}>
            ✓ RMSSD {fileResult.rmssd} ms
            {fileResult.dfaAlpha1 !== null ? ` · DFA-α1 ${fileResult.dfaAlpha1.toFixed(3)}` : ''}
            {fileResult.ectopicPct > 0 ? ` · ${fileResult.ectopicPct}% ectopic` : ''}
          </div>
        )}
        {uploadError && (
          <div style={{ ...S.mono, fontSize: 10, color: '#e03030', marginTop: '8px' }}>
            ⚠ {uploadError}
          </div>
        )}

        <div style={{ ...S.mono, fontSize: 9, color: '#444', marginTop: '8px' }}>
          Accepts Polar .hrm files with RR interval recording enabled.
          Manual entry: type RMSSD value from HRV4Training / Elite HRV.
        </div>
      </div>
    </div>
  )
}
