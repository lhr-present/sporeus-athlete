// ─── digestEmail.js — Coach weekly digest email renderer ──────────────────────
// generateDigestHTML: returns an HTML string with inline styles only (no flex/grid).
// getRuleBasedWeekSummary: derives a narrative from squad metrics.

// ── helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function statusColor(status) {
  const map = {
    Overreaching: '#e03030',
    Detraining:   '#888888',
    Building:     '#5bc25b',
    Peaking:      '#0064ff',
    Recovering:   '#f0a000',
    Maintaining:  '#aaaaaa',
  }
  return map[status] || '#888'
}

// ── getRuleBasedWeekSummary ───────────────────────────────────────────────────
// Returns a plain-text 1–3 sentence summary derived from squad metrics.
// squadData: array of { display_name, training_status, acwr_ratio, today_ctl }
export function getRuleBasedWeekSummary(squadData) {
  if (!Array.isArray(squadData) || squadData.length === 0) return 'No athlete data available.'

  const total       = squadData.length
  const overreaching = squadData.filter(a => a.training_status === 'Overreaching').length
  const detraining   = squadData.filter(a => a.training_status === 'Detraining').length
  const building     = squadData.filter(a => a.training_status === 'Building').length
  const avgCtl       = Math.round(squadData.reduce((s, a) => s + (a.today_ctl || 0), 0) / total)
  const highAcwr     = squadData.filter(a => (a.acwr_ratio || 0) > 1.3).length

  const parts = []
  parts.push(`Squad of ${total}: avg CTL ${avgCtl}, ${building} building, ${overreaching} overreaching, ${detraining} detraining.`)
  if (highAcwr > 0) parts.push(`${highAcwr} athlete${highAcwr > 1 ? 's' : ''} with ACWR > 1.3 — monitor for injury risk.`)
  if (overreaching > 0) parts.push(`${overreaching} athlete${overreaching > 1 ? 's require' : ' requires'} load reduction this week.`)
  return parts.join(' ')
}

// ── generateAthleteReportCard ─────────────────────────────────────────────────
// Returns an HTML string (inline CSS, monospace, print-safe) for a monthly
// athlete report card.
// athlete: { display_name, sport }
// log: array of { date, tss, type, duration }
// wellnessData: array of { date, sleep_hrs, soreness, mood, score }
// month: 'YYYY-MM' string
export function generateAthleteReportCard(athlete, log, wellnessData, month) {
  const athleteName = (athlete && athlete.display_name) ? String(athlete.display_name) : 'Unknown'
  const sport       = (athlete && athlete.sport)        ? String(athlete.sport)        : ''
  const monthLog    = Array.isArray(log)
    ? log.filter(e => e.date && String(e.date).startsWith(month))
    : []
  const monthWell   = Array.isArray(wellnessData)
    ? wellnessData.filter(w => w.date && String(w.date).startsWith(month))
    : []

  // ── CTL sparkline ──────────────────────────────────────────────────────────
  // Build daily TSS map for entire log (for 42-day EWMA we need history)
  const allLog = Array.isArray(log) ? log : []
  const tssByDate = {}
  for (const e of allLog) {
    if (e.date) tssByDate[e.date] = (tssByDate[e.date] || 0) + (e.tss || 0)
  }

  // Get all dates in the month
  const [yr, mo] = month.split('-').map(Number)
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const monthDates = []
  for (let d = 1; d <= daysInMonth; d++) {
    monthDates.push(`${month}-${String(d).padStart(2, '0')}`)
  }

  // Compute CTL (42-day EWMA) for each day of month using all sorted log dates up to that day
  const allDates = Object.keys(tssByDate).sort()
  function ctlUpTo(targetDate) {
    const relevant = allDates.filter(d => d <= targetDate)
    let ctl = 0
    for (const d of relevant) ctl = ctl + ((tssByDate[d] || 0) - ctl) / 42
    return ctl
  }

  const ctlValues = monthDates.map(d => ctlUpTo(d))
  const ctlStart  = ctlValues[0]
  const ctlEnd    = ctlValues[ctlValues.length - 1]

  // Map CTL values to sparkline chars ▁▂▃▄▅▆▇█
  const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
  const minCtl = Math.min(...ctlValues)
  const maxCtl = Math.max(...ctlValues)
  const range  = maxCtl - minCtl || 1
  const sparkline = ctlValues.map(v => {
    const idx = Math.min(7, Math.floor((v - minCtl) / range * 8))
    return bars[idx]
  }).join('')

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalSessions = monthLog.length
  const totalTSS      = monthLog.reduce((s, e) => s + (e.tss || 0), 0)
  const wellScores    = monthWell.map(w => w.score).filter(s => typeof s === 'number')
  const wellnessAvg   = wellScores.length
    ? Math.round(wellScores.reduce((a, b) => a + b, 0) / wellScores.length * 10) / 10
    : '—'

  // ── Top 3 sessions by TSS ─────────────────────────────────────────────────
  const top3 = [...monthLog]
    .filter(e => e.tss)
    .sort((a, b) => (b.tss || 0) - (a.tss || 0))
    .slice(0, 3)

  const top3Rows = top3.map(e => `
      <tr>
        <td style="padding:5px 10px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#f8f8f8;border-bottom:1px solid #222;">${esc(e.date)}</td>
        <td style="padding:5px 10px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#f8f8f8;border-bottom:1px solid #222;">${esc(e.type || '—')}</td>
        <td style="padding:5px 10px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#ff6600;border-bottom:1px solid #222;text-align:right;">${esc(e.tss)}</td>
      </tr>`).join('')

  // ── Coaching note ─────────────────────────────────────────────────────────
  const last7cutoff = monthDates[Math.max(0, monthDates.length - 7)]
  const sessionsLast7 = monthLog.filter(e => e.date >= last7cutoff).length

  let coachingNote
  if (ctlEnd > ctlStart + 5) {
    coachingNote = 'Fitness building — maintain structure.'
  } else if (sessionsLast7 === 0) {
    coachingNote = 'Detraining risk — check in with athlete.'
  } else {
    coachingNote = 'Consistent training — hold current load.'
  }

  // ── HTML output ───────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Athlete Report — ${esc(athleteName)} — ${esc(month)}</title>
</head>
<body style="margin:0;padding:24px;background:#0a0a0a;font-family:'IBM Plex Mono',monospace;color:#f8f8f8;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #333;">

    <!-- Header -->
    <tr>
      <td colspan="2" style="background:#0a0a0a;padding:18px 20px;border-bottom:2px solid #ff6600;">
        <span style="font-size:18px;font-weight:bold;color:#ff6600;letter-spacing:0.08em;">${esc(athleteName)}</span>
        <span style="font-size:12px;color:#888;margin-left:12px;">${esc(sport)}</span>
        <br>
        <span style="font-size:11px;color:#555;margin-top:4px;display:block;">Monthly Report · ${esc(month)}</span>
      </td>
    </tr>

    <!-- CTL Sparkline -->
    <tr>
      <td colspan="2" style="padding:16px 20px;border-bottom:1px solid #222;">
        <div style="font-size:10px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">CTL Fitness Trend</div>
        <div style="font-size:16px;letter-spacing:1px;color:#ff6600;">${sparkline}</div>
        <div style="font-size:10px;color:#555;margin-top:4px;">${esc(month)}-01 → ${esc(month)}-${String(daysInMonth).padStart(2,'0')}</div>
      </td>
    </tr>

    <!-- Summary Stats -->
    <tr>
      <td colspan="2" style="padding:14px 20px;border-bottom:1px solid #222;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align:center;padding:8px;">
              <div style="font-size:22px;font-weight:bold;color:#f8f8f8;">${esc(totalSessions)}</div>
              <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Sessions</div>
            </td>
            <td style="text-align:center;padding:8px;">
              <div style="font-size:22px;font-weight:bold;color:#ff6600;">${esc(Math.round(totalTSS))}</div>
              <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Total TSS</div>
            </td>
            <td style="text-align:center;padding:8px;">
              <div style="font-size:22px;font-weight:bold;color:#f8f8f8;">${esc(wellnessAvg)}</div>
              <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Wellness Avg</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Top 3 Sessions -->
    <tr>
      <td colspan="2" style="padding:14px 20px;border-bottom:1px solid #222;">
        <div style="font-size:10px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Top Sessions by TSS</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <thead>
            <tr style="background:#111;">
              <th style="padding:5px 10px;text-align:left;font-size:10px;color:#555;letter-spacing:0.08em;text-transform:uppercase;">Date</th>
              <th style="padding:5px 10px;text-align:left;font-size:10px;color:#555;letter-spacing:0.08em;text-transform:uppercase;">Type</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;color:#555;letter-spacing:0.08em;text-transform:uppercase;">TSS</th>
            </tr>
          </thead>
          <tbody>${top3Rows || '<tr><td colspan="3" style="padding:8px 10px;font-size:12px;color:#555;">No sessions recorded.</td></tr>'}</tbody>
        </table>
      </td>
    </tr>

    <!-- Coaching Note -->
    <tr>
      <td colspan="2" style="padding:14px 20px;border-bottom:1px solid #222;background:#111;">
        <div style="font-size:10px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Coaching Note</div>
        <div style="font-size:13px;color:#f8f8f8;">${esc(coachingNote)}</div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td colspan="2" style="padding:10px 20px;background:#0a0a0a;">
        <span style="font-size:10px;color:#333;">Generated by Sporeus · sporeus.com</span>
      </td>
    </tr>

  </table>
</body>
</html>`
}

// ── generateDigestHTML ────────────────────────────────────────────────────────
// Returns an HTML string suitable for email (tables, inline styles, no flex/grid).
// squadData: array of athlete objects (same schema as get_squad_overview)
// weekStart: 'YYYY-MM-DD' string labelling the digest week
export function generateDigestHTML(squadData, weekStart) {
  const athletes = Array.isArray(squadData) ? squadData : []
  const week = weekStart || new Date().toISOString().slice(0, 10)
  const summary = getRuleBasedWeekSummary(athletes)

  const rows = athletes.map(a => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;font-family:'Courier New',monospace;font-size:13px;color:#1a1a1a;">${esc(a.display_name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;font-family:'Courier New',monospace;font-size:13px;text-align:center;">${esc(a.today_ctl ?? '—')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;font-family:'Courier New',monospace;font-size:13px;text-align:center;">${esc(a.today_tsb ?? '—')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;font-family:'Courier New',monospace;font-size:13px;text-align:center;">${esc(a.acwr_ratio ?? '—')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;font-family:'Courier New',monospace;font-size:11px;font-weight:bold;color:${statusColor(a.training_status)}">${esc(a.training_status)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Sporeus Coach Digest — ${esc(week)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#0a0a0a;padding:20px 24px;">
          <span style="font-family:'Courier New',monospace;font-size:16px;font-weight:bold;color:#ff6600;letter-spacing:0.1em;">◈ SPOREUS COACH DIGEST</span>
          <br>
          <span style="font-family:'Courier New',monospace;font-size:11px;color:#888;">Week of ${esc(week)}</span>
        </td></tr>

        <!-- Summary -->
        <tr><td style="padding:20px 24px;border-bottom:2px solid #f0f0f0;">
          <p style="font-family:'Courier New',monospace;font-size:13px;color:#333;line-height:1.6;margin:0;">${esc(summary)}</p>
        </td></tr>

        <!-- Athlete table -->
        <tr><td style="padding:16px 24px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <thead>
              <tr style="background:#f8f8f8;">
                <th style="padding:8px 12px;text-align:left;font-family:'Courier New',monospace;font-size:10px;color:#888;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid #e0e0e0;">Athlete</th>
                <th style="padding:8px 12px;text-align:center;font-family:'Courier New',monospace;font-size:10px;color:#888;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid #e0e0e0;">CTL</th>
                <th style="padding:8px 12px;text-align:center;font-family:'Courier New',monospace;font-size:10px;color:#888;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid #e0e0e0;">TSB</th>
                <th style="padding:8px 12px;text-align:center;font-family:'Courier New',monospace;font-size:10px;color:#888;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid #e0e0e0;">ACWR</th>
                <th style="padding:8px 12px;text-align:left;font-family:'Courier New',monospace;font-size:10px;color:#888;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid #e0e0e0;">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 24px;background:#f8f8f8;border-top:1px solid #e0e0e0;">
          <span style="font-family:'Courier New',monospace;font-size:10px;color:#aaa;">Generated by Sporeus · sporeus.com</span>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
