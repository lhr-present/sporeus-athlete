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
