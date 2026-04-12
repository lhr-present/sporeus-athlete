// ─── pdfReport.js — Printable athlete season report (HTML → print-to-PDF) ─────
// generateSeasonReport(athlete, log, wellnessData) → HTML string
// All inline CSS, no external fonts, print-safe (no dark backgrounds).

import { getAthleteInsights } from './ruleInsights.js'

// ── Unicode sparkline (TSS → ▁▂▃▄▅▆▇█) ──────────────────────────────────────
const BLOCKS = '▁▂▃▄▅▆▇█'
function toSparkChar(val, min, max) {
  if (val === null || val === undefined) return ' '
  const range = max - min || 1
  const idx   = Math.min(7, Math.floor(((val - min) / range) * 8))
  return BLOCKS[idx]
}

function sparkline(values) {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  return values.map(v => toSparkChar(v, min, max)).join('')
}

// ── Week boundaries ───────────────────────────────────────────────────────────
function getWeekKey(dateStr) {
  const d = new Date(dateStr)
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

// ── PMC helpers (per-entry EWMA, consistent with intelligence.js) ─────────────
function computePMCSeries(log) {
  const sorted = [...log].sort((a, b) => a.date > b.date ? 1 : -1)
  let ctl = 0, atl = 0
  return sorted.map(e => {
    ctl = ctl + ((e.tss || 0) - ctl) / 42
    atl = atl + ((e.tss || 0) - atl) / 7
    return { date: e.date, ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(ctl - atl), tss: e.tss || 0 }
  })
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const BASE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #1a1a1a; background: #fff; }
  h1   { font-size: 20px; font-weight: 700; letter-spacing: 0.05em; }
  h2   { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; margin-bottom: 12px; }
  h3   { font-size: 11px; font-weight: 700; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 10px; }
  th   { background: #f0f0f0; font-weight: 700; }
  .page { page-break-after: always; padding: 24px 28px; min-height: 100vh; }
  .last-page { page-break-after: avoid; padding: 24px 28px; }
  .spark { font-family: monospace; font-size: 11px; letter-spacing: 0; }
  .muted { color: #666; }
  .right { text-align: right; }
  @media print {
    .page { page-break-after: always; }
    body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`

// ── Main export ───────────────────────────────────────────────────────────────
export function generateSeasonReport(athlete, log, wellnessData) {
  const sorted = [...(log || [])].sort((a, b) => a.date > b.date ? 1 : -1)
  const now = new Date().toISOString().slice(0, 10)
  const seasonStart = sorted[0]?.date || now
  const seasonEnd   = sorted[sorted.length - 1]?.date || now

  // ── Week-by-week PMC table ────────────────────────────────────────────────
  const pmcSeries = computePMCSeries(sorted)
  const byWeek = {}
  for (const e of sorted) {
    const wk = getWeekKey(e.date)
    if (!byWeek[wk]) byWeek[wk] = { tss: [], rpe: [], ctl: 0, atl: 0, tsb: 0 }
    byWeek[wk].tss.push(e.tss || 0)
    if (e.rpe) byWeek[wk].rpe.push(e.rpe)
  }
  // Assign end-of-week PMC values
  for (const p of pmcSeries) {
    const wk = getWeekKey(p.date)
    if (byWeek[wk]) { byWeek[wk].ctl = p.ctl; byWeek[wk].atl = p.atl; byWeek[wk].tsb = p.tsb }
  }
  const weeks = Object.entries(byWeek).sort(([a], [b]) => a > b ? 1 : -1)

  const weekRows = weeks.map(([wk, v]) => {
    const totalTss = v.tss.reduce((s, x) => s + x, 0)
    const avgRpe   = v.rpe.length ? (v.rpe.reduce((s, x) => s + x, 0) / v.rpe.length).toFixed(1) : '—'
    const spark    = sparkline(v.tss)
    return `<tr>
      <td>${esc(wk)}</td>
      <td class="right">${totalTss}</td>
      <td class="right">${v.ctl}</td>
      <td class="right">${v.atl}</td>
      <td class="right">${v.tsb > 0 ? '+' : ''}${v.tsb}</td>
      <td>${esc(avgRpe)}</td>
      <td class="spark">${esc(spark)}</td>
    </tr>`
  }).join('')

  // ── 14-week wellness table ─────────────────────────────────────────────────
  const wellness = (wellnessData || []).sort((a, b) => a.date > b.date ? 1 : -1)
  const wellByWeek = {}
  for (const e of wellness) {
    const wk = getWeekKey(e.date)
    if (!wellByWeek[wk]) wellByWeek[wk] = { sleep: [], energy: [], soreness: [] }
    if (e.sleep    !== null && e.sleep    !== undefined) wellByWeek[wk].sleep.push(e.sleep)
    if (e.energy   !== null && e.energy   !== undefined) wellByWeek[wk].energy.push(e.energy)
    if (e.soreness !== null && e.soreness !== undefined) wellByWeek[wk].soreness.push(e.soreness)
  }
  const wellWeeks = Object.entries(wellByWeek).sort(([a], [b]) => a > b ? 1 : -1).slice(-14)
  const avg = (arr) => arr.length ? (arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(1) : '—'

  const wellRows = wellWeeks.map(([wk, v]) => `<tr>
    <td>${esc(wk)}</td>
    <td class="right">${avg(v.sleep)}</td>
    <td class="right">${avg(v.energy)}</td>
    <td class="right">${avg(v.soreness)}</td>
  </tr>`).join('')

  // ── Top 5 peak sessions ────────────────────────────────────────────────────
  const top5 = [...sorted].sort((a, b) => (b.tss || 0) - (a.tss || 0)).slice(0, 5)
  const peakRows = top5.map(e => `<tr>
    <td>${esc(e.date)}</td>
    <td>${esc(e.type || '—')}</td>
    <td class="right">${e.tss ?? '—'}</td>
    <td class="right">${e.rpe ?? '—'}</td>
    <td>${esc(e.notes?.slice(0, 40) || '')}</td>
  </tr>`).join('')

  // ── Injury timeline (entries with rpe >= 9 or notes containing injury keywords) ─
  const injuryKw = /injur|pain|sick|ill|tweak|strain|sprain/i
  const flags = sorted.filter(e => (e.rpe && e.rpe >= 9) || (e.notes && injuryKw.test(e.notes)))
  const injuryRows = flags.map(e => `<tr>
    <td>${esc(e.date)}</td>
    <td>${esc(e.type || '—')}</td>
    <td class="right">${e.rpe ?? '—'}</td>
    <td>${esc((e.notes || '').slice(0, 60))}</td>
  </tr>`).join('')

  // ── Season summary (rule-based insights) ──────────────────────────────────
  const insights = getAthleteInsights({
    today_ctl: pmcSeries[pmcSeries.length - 1]?.ctl || 0,
    today_atl: pmcSeries[pmcSeries.length - 1]?.atl || 0,
    today_tsb: pmcSeries[pmcSeries.length - 1]?.tsb || 0,
    last_session_date: sorted[sorted.length - 1]?.date || null,
    training_status: 'Maintaining',
    adherence_pct: Math.round(weeks.length > 0 ? sorted.length / (weeks.length * 7) * 100 : 0),
  })
  const summaryText = insights.map(i => i.message).join(' ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Season Report — ${esc(athlete?.name || 'Athlete')}</title>
  <style>${BASE}</style>
</head>
<body>

<!-- ── Cover page ─────────────────────────────────────────────────────────── -->
<div class="page" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:16px;">
  <div style="font-size:28px;font-weight:700;letter-spacing:0.12em;">◈ SPOREUS</div>
  <div class="muted" style="font-size:12px;letter-spacing:0.08em;">ATHLETE SEASON REPORT</div>
  <div style="margin-top:24px;">
    <h1>${esc(athlete?.name || 'Athlete')}</h1>
    <div style="font-size:12px;color:#555;margin-top:8px;">${esc(athlete?.sport || '')}</div>
  </div>
  <div style="margin-top:16px;font-size:11px;color:#666;">
    Season: ${esc(seasonStart)} — ${esc(seasonEnd)}<br>
    Generated: ${esc(now)}
  </div>
  <div style="margin-top:32px;font-size:10px;color:#999;letter-spacing:0.06em;">sporeus.com</div>
</div>

<!-- ── Load summary ───────────────────────────────────────────────────────── -->
<div class="page">
  <h2>Load Summary — Week by Week</h2>
  <table>
    <thead>
      <tr><th>Week</th><th class="right">TSS</th><th class="right">CTL</th><th class="right">ATL</th><th class="right">TSB</th><th>sRPE</th><th>Load Spark</th></tr>
    </thead>
    <tbody>${weekRows || '<tr><td colspan="7" class="muted">No training data</td></tr>'}</tbody>
  </table>
  <p class="muted" style="font-size:9px;">CTL=Chronic (42d), ATL=Acute (7d), TSB=Form=CTL−ATL. Sparkline: ▁=low ▇=high TSS.</p>
</div>

<!-- ── Wellness trends ────────────────────────────────────────────────────── -->
<div class="page">
  <h2>Wellness Trends — Last 14 Weeks</h2>
  <table>
    <thead>
      <tr><th>Week</th><th class="right">Sleep (1–5)</th><th class="right">Energy (1–5)</th><th class="right">Soreness (1–5)</th></tr>
    </thead>
    <tbody>${wellRows || '<tr><td colspan="4" class="muted">No wellness data</td></tr>'}</tbody>
  </table>

  <h2 style="margin-top:20px;">Top 5 Peak Sessions</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Type</th><th class="right">TSS</th><th class="right">RPE</th><th>Notes</th></tr>
    </thead>
    <tbody>${peakRows || '<tr><td colspan="5" class="muted">No sessions</td></tr>'}</tbody>
  </table>
</div>

<!-- ── Injury timeline + summary ─────────────────────────────────────────── -->
<div class="last-page">
  ${flags.length > 0 ? `
  <h2>Injury / High-Load Flags</h2>
  <table>
    <thead><tr><th>Date</th><th>Type</th><th class="right">RPE</th><th>Notes</th></tr></thead>
    <tbody>${injuryRows}</tbody>
  </table>
  ` : ''}

  <h2 style="margin-top:${flags.length ? '20px' : '0'};">Season Summary</h2>
  <p style="line-height:1.8;font-size:11px;">${esc(summaryText || 'Log more sessions to generate insights.')}</p>

  <div style="margin-top:24px;font-size:9px;color:#999;border-top:1px solid #e0e0e0;padding-top:8px;">
    Generated by Sporeus — sporeus.com · ${esc(now)}
  </div>
</div>

</body>
</html>`
}
