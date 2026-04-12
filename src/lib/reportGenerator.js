// src/lib/reportGenerator.js — Bloomberg-styled athlete PDF report (Phase 3.3)
// Opens an HTML document in a new window. User saves as PDF via browser print.

import {
  analyzeLoadTrend, analyzeZoneBalance, predictInjuryRisk,
  predictFitness, computeRaceReadiness, predictRacePerformance,
  analyzeRecoveryCorrelation,
} from './intelligence.js'

const TODAY = new Date().toISOString().slice(0, 10)

function fmt(v, fallback = '—') {
  return v != null && v !== '' ? String(v) : fallback
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
function signNum(n) {
  return n >= 0 ? `+${n}` : String(n)
}

// Convert CTL/ATL/TSB to a sparkline-style inline SVG string
function tsbBar(tsb) {
  const col = tsb > 5 ? '#5bc25b' : tsb < -10 ? '#e03030' : '#f5c542'
  return `<span style="color:${col};font-weight:700">${signNum(tsb)}</span>`
}

function zoneBars(zDist) {
  const COLS = ['#4a90d9','#5bc25b','#f5c542','#ff6600','#e03030']
  if (!zDist || !Array.isArray(zDist)) return ''
  const total = zDist.reduce((s, v) => s + (v || 0), 0) || 1
  const bars = zDist.map((v, i) => {
    const pct = Math.round(v / total * 100)
    return pct > 0
      ? `<div style="width:${pct}%;background:${COLS[i]};display:inline-block;height:10px;" title="Z${i+1}: ${pct}%"></div>`
      : ''
  }).join('')
  return `<div style="display:flex;height:10px;border-radius:2px;overflow:hidden;background:#333;margin-top:4px">${bars}</div>`
}

// Map log entries to zone distribution
function buildZoneDistFromLog(log, days = 28) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const recent = log.filter(e => e.date >= since)
  const totals = [0, 0, 0, 0, 0]
  for (const e of recent) {
    if (Array.isArray(e.zones) && e.zones.length === 5) {
      e.zones.forEach((v, i) => { totals[i] += v || 0 })
    }
  }
  return totals
}

function computeLoad(log) {
  if (!log.length) return { ctl: 0, atl: 0, tsb: 0 }
  const sorted = [...log].sort((a, b) => a.date > b.date ? 1 : -1)
  let ctl = 0, atl = 0
  for (const s of sorted) {
    ctl = ctl + ((s.tss || 0) - ctl) / 42
    atl = atl + ((s.tss || 0) - atl) / 7
  }
  return { ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(ctl - atl) }
}

function buildRecentTable(log, n = 10) {
  const recent = [...log].sort((a, b) => b.date > a.date ? 1 : -1).slice(0, n)
  if (!recent.length) return '<div style="color:#888;font-size:11px">No sessions logged.</div>'
  return `
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="border-bottom:1px solid #444;color:#888;font-size:10px;letter-spacing:0.06em">
          <th style="text-align:left;padding:3px 8px 6px 0">DATE</th>
          <th style="text-align:left;padding:3px 8px 6px 0">TYPE</th>
          <th style="text-align:center;padding:3px 8px 6px 0">DUR</th>
          <th style="text-align:center;padding:3px 8px 6px 0">TSS</th>
          <th style="text-align:center;padding:3px 8px 6px 0">RPE</th>
          <th style="text-align:left;padding:3px 0 6px 0">NOTES</th>
        </tr>
      </thead>
      <tbody>
        ${recent.map(e => `
          <tr style="border-bottom:1px solid #222">
            <td style="padding:5px 8px 5px 0;color:#888">${esc(e.date)}</td>
            <td style="padding:5px 8px 5px 0;color:#e0e0e0;font-weight:600">${esc(e.type)}</td>
            <td style="text-align:center;padding:5px 8px 5px 0">${fmt(e.duration)} min</td>
            <td style="text-align:center;padding:5px 8px 5px 0;color:#ff6600">${fmt(e.tss, '—')}</td>
            <td style="text-align:center;padding:5px 8px 5px 0;color:#aaa">${fmt(e.rpe, '—')}</td>
            <td style="padding:5px 0 5px 0;color:#666;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.notes)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function openAthleteReport({ name, log, recovery, coachNotes, coachName }) {
  log      = log || []
  recovery = recovery || []

  // Compute all intelligence metrics
  const load       = computeLoad(log)
  const loadTrend  = analyzeLoadTrend(log)
  const zoneBalance = analyzeZoneBalance(log)
  const injRisk    = predictInjuryRisk(log, recovery)
  const fitness    = predictFitness(log)
  const readiness  = computeRaceReadiness(log, recovery)
  const racePerf   = predictRacePerformance(log)
  const recovCorr  = analyzeRecoveryCorrelation(log, recovery)

  const zDist28    = buildZoneDistFromLog(log, 28)

  const tsbColor   = load.tsb > 5 ? '#5bc25b' : load.tsb < -10 ? '#e03030' : '#f5c542'
  const injColor   = injRisk.level === 'HIGH' ? '#e03030' : injRisk.level === 'MODERATE' ? '#f5c542' : '#5bc25b'
  const readGrade  = readiness.grade || '—'
  const readScore  = readiness.score ?? '—'
  const readColor  = readScore >= 75 ? '#5bc25b' : readScore >= 50 ? '#f5c542' : '#e03030'

  const last28 = log.filter(e => e.date >= new Date(Date.now() - 28*86400000).toISOString().slice(0,10))
  const totalH = (last28.reduce((s, e) => s + (e.duration || 0), 0) / 60).toFixed(1)
  const totalTSS28 = Math.round(last28.reduce((s, e) => s + (e.tss || 0), 0))
  const sessions28 = last28.length

  // Pace card
  const paces = racePerf.trainingPaces
  const paceRows = paces ? [
    ['Easy',      paces.easy],
    ['Threshold', paces.threshold],
    ['Interval',  paces.interval],
    ['VDOT',      paces.vdot ? `${paces.vdot}` : null],
  ].filter(([,v]) => v) : []

  const coachNotesHtml = (coachNotes || []).length
    ? coachNotes.map(n => `
        <div style="padding:8px 10px;border-left:3px solid #ff6600;background:#ff66000d;margin-bottom:8px;border-radius:0 4px 4px 0">
          <div style="font-size:9px;color:#888;margin-bottom:4px;letter-spacing:0.06em">${esc(n.created_at?.slice(0,10) || '')} · ${esc(n.author || coachName || 'Coach')}</div>
          <div style="font-size:12px;color:#e0e0e0;line-height:1.6">${esc(n.note || n.text || '')}</div>
        </div>`).join('')
    : '<div style="color:#888;font-size:11px">No coach notes recorded.</div>'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Sporeus Athlete Report — ${esc(name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'IBM Plex Mono', monospace; background: #0a0a0a; color: #e0e0e0;
           padding: 40px 48px; max-width: 900px; margin: 0 auto; font-size: 12px; }
    .page-break { page-break-before: always; padding-top: 32px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 10px; color: #ff6600; letter-spacing: 0.12em; font-weight: 600;
                     text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 6px;
                     margin-bottom: 14px; }
    .row { display: flex; gap: 16px; flex-wrap: wrap; }
    .stat { flex: 1 1 100px; text-align: center; padding: 12px 8px; border: 1px solid #333;
            border-radius: 5px; background: #111; }
    .stat-val { font-size: 24px; font-weight: 700; }
    .stat-lbl { font-size: 9px; color: #888; letter-spacing: 0.08em; margin-top: 4px; }
    .insight { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px;
               background: #111; border-radius: 4px; margin-bottom: 8px; }
    .insight-badge { min-width: 90px; }
    .insight-lbl { font-size: 8px; color: #888; letter-spacing: 0.06em; }
    .insight-val { font-size: 12px; font-weight: 600; }
    .insight-txt { font-size: 10px; color: #888; line-height: 1.6; padding-top: 2px; }
    @media print {
      body { background: #fff !important; color: #000 !important; padding: 20px 28px; }
      .no-print { display: none !important; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #ff6600">
    <div>
      <div style="font-size:9px;color:#888;letter-spacing:0.12em;margin-bottom:6px">SPOREUS ATHLETE REPORT</div>
      <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:0.02em">${esc(name || 'ATHLETE')}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;color:#888">Generated: ${esc(TODAY)}</div>
      ${coachName ? `<div style="font-size:10px;color:#888">Coach: ${esc(coachName)}</div>` : ''}
      <div style="font-size:9px;color:#444;margin-top:8px">sporeus.com — Athlete Performance Console</div>
    </div>
  </div>

  <!-- FITNESS METRICS -->
  <div class="section">
    <div class="section-title">◈ CURRENT FITNESS METRICS</div>
    <div class="row">
      ${[
        { label:'CTL', value: load.ctl, color:'#ff6600', sub:'Chronic (42d)' },
        { label:'ATL', value: load.atl, color:'#0064ff', sub:'Acute (7d)' },
        { label:'TSB', value: signNum(load.tsb), color: tsbColor, sub:'Form (CTL−ATL)' },
        { label:'RACE READINESS', value: `${readScore}%`, color: readColor, sub: `Grade ${readGrade}` },
        { label:'INJURY RISK', value: injRisk.level || '—', color: injColor, sub: `Score ${injRisk.score}/100` },
      ].map(s => `
        <div class="stat">
          <div class="stat-val" style="color:${s.color}">${esc(String(s.value))}</div>
          <div style="font-size:10px;color:#888;margin-top:2px">${esc(s.sub)}</div>
          <div class="stat-lbl">${esc(s.label)}</div>
        </div>`).join('')}
    </div>
  </div>

  <!-- 4-WEEK SUMMARY -->
  <div class="section">
    <div class="section-title">◈ LAST 28 DAYS</div>
    <div class="row" style="margin-bottom:16px">
      ${[
        { label:'SESSIONS', value: sessions28, color:'#e0e0e0' },
        { label:'HOURS',    value: `${totalH}h`, color:'#4a90d9' },
        { label:'TOTAL TSS', value: totalTSS28, color:'#ff6600' },
        { label:'FITNESS TREND', value: `CTL ${fitness.current}→${fitness.in4w}`, color: fitness.trajectory==='improving'?'#5bc25b':fitness.trajectory==='declining'?'#e03030':'#f5c542' },
      ].map(s => `
        <div class="stat">
          <div class="stat-val" style="color:${s.color};font-size:18px">${esc(String(s.value))}</div>
          <div class="stat-lbl">${esc(s.label)}</div>
        </div>`).join('')}
    </div>
    <div>
      <div style="font-size:9px;color:#888;letter-spacing:0.06em;margin-bottom:6px">ZONE DISTRIBUTION (28d)</div>
      ${zoneBars(zDist28)}
      <div style="display:flex;gap:12px;margin-top:6px;font-size:9px;color:#888;flex-wrap:wrap">
        ${['Z1 Recovery','Z2 Aerobic','Z3 Tempo','Z4 Threshold','Z5 VO₂max'].map((z,i) => {
          const COLS = ['#4a90d9','#5bc25b','#f5c542','#ff6600','#e03030']
          return `<span><span style="color:${COLS[i]};font-weight:700">${z.split(' ')[0]}</span> ${z.split(' ').slice(1).join(' ')}</span>`
        }).join('')}
      </div>
    </div>
  </div>

  <!-- INTELLIGENCE ANALYSIS -->
  <div class="section">
    <div class="section-title">◈ INTELLIGENCE ANALYSIS</div>
    <div>
      ${[
        { lbl:'LOAD TREND', val: esc((loadTrend.trend||'').toUpperCase()), c: loadTrend.trend==='building'?'#5bc25b':loadTrend.trend==='recovering'?'#4a90d9':'#f5c542', txt: esc(loadTrend.advice.en) },
        { lbl:'ZONE BALANCE', val: esc((zoneBalance.status||'').replace('_',' ').toUpperCase()), c: zoneBalance.status==='polarized'?'#5bc25b':zoneBalance.status==='too_hard'?'#e03030':'#f5c542', txt: esc(zoneBalance.recommendation.en) },
        { lbl:'INJURY RISK', val: esc(injRisk.level||'—'), c: injColor, txt: esc(injRisk.advice.en) },
        { lbl:'FITNESS TRAJECTORY', val: esc((fitness.trajectory||'').toUpperCase()), c: fitness.trajectory==='improving'?'#5bc25b':fitness.trajectory==='declining'?'#e03030':'#f5c542', txt: esc(fitness.label.en) },
        ...(recovCorr.correlation !== null ? [{ lbl:'LOAD↔RECOVERY', val: recovCorr.correlation > 0.5 ? 'CORRELATED' : 'WEAK', c:'#4a90d9', txt: esc(recovCorr.insight?.en || '') }] : []),
      ].map(row => `
        <div class="insight" style="border-left:3px solid ${row.c}">
          <div class="insight-badge">
            <div class="insight-lbl">${row.lbl}</div>
            <div class="insight-val" style="color:${row.c}">${row.val}</div>
          </div>
          <div class="insight-txt">${row.txt}</div>
        </div>`).join('')}
    </div>
  </div>

  ${injRisk.factors && injRisk.factors.length ? `
  <!-- INJURY RISK FACTORS -->
  <div class="section">
    <div class="section-title">◈ INJURY RISK FACTORS</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="border-bottom:1px solid #444;color:#888;font-size:9px;letter-spacing:0.06em">
          <th style="text-align:left;padding:3px 8px 6px 0">FACTOR</th>
          <th style="text-align:center;padding:3px 8px 6px 0">WEIGHT</th>
          <th style="text-align:left;padding:3px 0 6px 0">DETAIL</th>
        </tr>
      </thead>
      <tbody>
        ${injRisk.factors.map(f => `
          <tr style="border-bottom:1px solid #222">
            <td style="padding:5px 8px 5px 0;font-weight:600;color:#e0e0e0">${esc(f.label)}</td>
            <td style="text-align:center;padding:5px 8px 5px 0;color:#f5c542">${esc(f.weight)}</td>
            <td style="padding:5px 0;color:#888">${esc(f.detail?.en || '')}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div style="font-size:10px;color:#888;margin-top:8px;padding:8px 10px;background:#111;border-radius:4px;border-left:3px solid ${injColor}">
      ${esc(injRisk.advice.en)}
    </div>
  </div>` : ''}

  ${paceRows.length ? `
  <!-- TRAINING PACES (VDOT) -->
  <div class="section">
    <div class="section-title">◈ TRAINING PACES${paces?.vdot ? ` · VDOT ${paces.vdot}` : ''}</div>
    <div class="row">
      ${paceRows.map(([label, pace]) => `
        <div class="stat" style="flex:1 1 80px">
          <div class="stat-val" style="color:#ff6600;font-size:18px">${esc(String(pace))}</div>
          <div class="stat-lbl">${esc(label)}</div>
        </div>`).join('')}
    </div>
    <div style="font-size:9px;color:#888;margin-top:8px">min/km · Based on Daniels VDOT table</div>
  </div>` : ''}

  <!-- RECENT TRAINING LOG -->
  <div class="section page-break">
    <div class="section-title">◈ RECENT TRAINING LOG (LAST 10 SESSIONS)</div>
    ${buildRecentTable(log, 10)}
  </div>

  <!-- COACH NOTES -->
  <div class="section">
    <div class="section-title">◈ COACH NOTES</div>
    ${coachNotesHtml}
  </div>

  <!-- READINESS BREAKDOWN -->
  ${readiness.factors && readiness.factors.length ? `
  <div class="section">
    <div class="section-title">◈ RACE READINESS BREAKDOWN</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="border-bottom:1px solid #444;color:#888;font-size:9px;letter-spacing:0.06em">
          <th style="text-align:left;padding:3px 8px 6px 0">FACTOR</th>
          <th style="text-align:center;padding:3px 8px 6px 0">SCORE</th>
          <th style="text-align:center;padding:3px 0 6px 0">MAX</th>
        </tr>
      </thead>
      <tbody>
        ${readiness.factors.map(f => {
          const fColor = f.score >= f.max * 0.8 ? '#5bc25b' : f.score >= f.max * 0.5 ? '#f5c542' : '#e03030'
          return `
          <tr style="border-bottom:1px solid #222">
            <td style="padding:5px 8px 5px 0;color:#e0e0e0">${esc(f.label)}</td>
            <td style="text-align:center;padding:5px 8px 5px 0;font-weight:700;color:${fColor}">${f.score}</td>
            <td style="text-align:center;padding:5px 0;color:#555">${f.max}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- FOOTER -->
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #333;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#555">
    <span>SPOREUS ATHLETE CONSOLE — sporeus.com</span>
    <span>sporeus.com — Science-based endurance training console</span>
  </div>

  <!-- PRINT BUTTON -->
  <div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px">
    <button onclick="window.print()" style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;padding:10px 20px;background:#ff6600;border:none;color:#fff;border-radius:4px;cursor:pointer;letter-spacing:0.06em">
      ↓ SAVE AS PDF
    </button>
    <button onclick="window.close()" style="font-family:'IBM Plex Mono',monospace;font-size:11px;padding:10px 14px;background:#222;border:1px solid #444;color:#888;border-radius:4px;cursor:pointer">
      ✕
    </button>
  </div>

</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  // Free URL after the window loads
  if (win) win.addEventListener('load', () => URL.revokeObjectURL(url))
}
