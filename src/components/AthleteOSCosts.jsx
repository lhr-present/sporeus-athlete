import { useState } from 'react'
import { S } from '../styles.js'

// ─── AthleteOSCosts ────────────────────────────────────────────────────────────
// Developer reference: MVP infrastructure cost breakdown + Claude prompt library.
// Two collapsible panels, every item copyable.

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const GREEN  = '#5bc25b'
const MUTED  = '#888'

// ── Cost data ──────────────────────────────────────────────────────────────────
const COSTS = [
  { service: 'Supabase Free',                       cost: '$0',        note: 'DB + auth + edge functions' },
  { service: 'Vercel Free',                         cost: '$0',        note: 'Hosting + preview deploys' },
  { service: 'Resend (3K emails/mo)',               cost: '$0',        note: 'Transactional + digest emails' },
  { service: 'Claude API (Haiku + caching)',        cost: '~$2–8/mo',  note: 'Main variable; chatbot gated paid' },
  { service: 'Self-hosted Plausible analytics',     cost: '$4/mo',     note: 'VPS, privacy-first' },
]
const TOTAL_RANGE = '~$4–12/month until $500 MRR'
const CACHING_NOTE = `Biggest cost lever: caching strategy on daily summaries.\n40 athletes × cached summary regenerated once at 6am → ~40 × $0.001 = $0.04/day on Haiku.\nChatbot is the only variable cost and is gated behind paid tiers.`

// ── Prompt library ─────────────────────────────────────────────────────────────
const PROMPTS = [
  {
    name:  'Daily Athlete Summary',
    model: 'Haiku',
    when:  'Nightly batch, cached',
    color: GREEN,
    template: `You are a sport science assistant. Analyze the athlete's last 7 days of training data and generate a concise daily summary.

Athlete data: {{athlete_json}}

Output exactly 3 sentences:
1. Training load trend (CTL/TSB direction and what it means).
2. Readiness score interpretation (today's wellness vs 28-day baseline).
3. One specific, actionable recommendation for tomorrow.

Use plain language. No markdown. No emojis. Under 80 words.`,
  },
  {
    name:  'Coach Chatbot',
    model: 'Sonnet',
    when:  'Streaming, on demand',
    color: ORANGE,
    template: `You are an expert endurance coach assistant with deep knowledge of periodization, sport physiology, and athlete development. You have access to the athlete's full profile and recent training data.

Athlete context:
- Name: {{name}}, Sport: {{sport}}, Level: {{level}}
- CTL: {{ctl}}, TSB: {{tsb}}, ACWR: {{acwr}}
- Last 7 days: {{recent_sessions}}
- Wellness trend: {{wellness_trend}}

Coach question: {{question}}

Answer concisely and practically. Reference specific data when relevant. If a question requires data not provided, say so clearly. Keep responses under 150 words unless the question demands more detail.`,
  },
  {
    name:  'Weekly Digest',
    model: 'Haiku',
    when:  'Sunday night cron',
    color: BLUE,
    template: `Generate a weekly training digest for an endurance athlete.

Weekly data: {{weekly_json}}

Format your response exactly as:
WEEK SUMMARY: [one sentence covering sessions, volume, TSS]
LOAD STATUS: [CTL trend arrow, TSB value, ACWR status]
TOP SESSION: [date, type, why notable]
NEXT WEEK: [two specific recommendations]

Under 100 words total. No markdown headers. Plain text only.`,
  },
  {
    name:  'Training Plan Generator',
    model: 'Sonnet',
    when:  'Coach/solo user trigger',
    color: ORANGE,
    template: `You are an expert periodization coach. Generate a structured training plan based on this athlete's profile and goals.

Profile:
- Sport: {{sport}}, Level: {{level}}, FTP: {{ftp}}, VO2max: {{vo2max}}
- Available weeks: {{weeks}}, Hours/week: {{hours_per_week}}
- Goal: {{goal}}, Target race date: {{race_date}}

Output a valid JSON object matching this schema exactly:
{
  "goal": string,
  "level": string,
  "hoursPerWeek": number,
  "generatedAt": "YYYY-MM-DD",
  "weeks": [
    {
      "phase": "base"|"build"|"peak"|"taper"|"competition"|"transition",
      "sessions": [
        { "type": string, "duration": number, "rpe": number, "tss": number,
          "zone": string, "zoneIdx": number, "color": string, "description": string }
      ]
    }
  ]
}

Sessions array has exactly 7 items (Mon–Sun). Rest days: type="Rest", duration=0, tss=0.`,
  },
  {
    name:  'Anomaly Detection',
    model: 'Haiku',
    when:  'Every check-in submit',
    color: GREEN,
    template: `Analyze this athlete's latest wellness check-in against their personal baseline. Identify any anomalies that warrant coach attention.

28-day baseline: mean={{baseline_mean}}, sd={{baseline_sd}}, n={{baseline_n}}
Today's score: {{today_score}} (sleep={{sleep}}, energy={{energy}}, soreness={{soreness}})
Recent ACWR: {{acwr}}
Days since last rest: {{days_no_rest}}

Return ONLY valid JSON, no explanation:
{
  "anomaly": boolean,
  "severity": "none" | "mild" | "significant",
  "flag": string | null,
  "recommendation": string
}`,
  },
  {
    name:  'Injury Risk Score',
    model: 'Haiku',
    when:  'Weekly per athlete',
    color: '#e03030',
    template: `Calculate injury risk for this endurance athlete based on training load and wellness patterns.

Training load (28d):
- ACWR: {{acwr}} (sweet spot: 0.8–1.3)
- Monotony: {{monotony}} (flag if > 2.0)
- Strain: {{strain}}
- Week-over-week TSS change: {{tss_change_pct}}%

Wellness trend (14d):
- Average score: {{avg_wellness}}/100
- Trend: {{wellness_trend}} (improving/stable/declining)
- Days with score < 50: {{low_wellness_days}}

Return ONLY valid JSON:
{
  "risk_score": number (0–100),
  "risk_level": "low" | "moderate" | "high",
  "primary_factor": string,
  "recommendation": string
}`,
  },
]

// ── Component ──────────────────────────────────────────────────────────────────
export default function AthleteOSCosts() {
  const [costsOpen,   setCostsOpen]   = useState(true)
  const [promptsOpen, setPromptsOpen] = useState(true)
  const [expandedIdx, setExpandedIdx] = useState(null)
  const [copied, setCopied] = useState(null)

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyAllCosts = () => {
    const lines = [
      `MVP INFRASTRUCTURE — ${TOTAL_RANGE}`,
      '─'.repeat(50),
      ...COSTS.map(c => `${c.service.padEnd(38)} ${c.cost.padEnd(10)} ${c.note}`),
      '',
      CACHING_NOTE,
    ].join('\n')
    copy(lines, 'costs-all')
  }

  const copyAllPrompts = () => {
    const lines = PROMPTS.flatMap(p => [
      `── ${p.name} (${p.model} · ${p.when}) ──`,
      p.template,
      '',
    ])
    copy(lines.join('\n'), 'prompts-all')
  }

  const hdr = (label, open, toggle, onCopyAll, copyKey) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: open ? '14px' : 0 }}>
      <div style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {copied === copyKey
          ? <span style={{ fontFamily: MONO, fontSize: '9px', color: GREEN }}>✓ COPIED</span>
          : <button style={{ ...S.btnSec, fontSize: '9px', padding: '2px 8px' }} onClick={onCopyAll}>⎘ COPY ALL</button>
        }
        <button style={{ ...S.btnSec, fontSize: '9px', padding: '2px 8px' }} onClick={toggle}>
          {open ? '▲' : '▼'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ marginTop: '16px' }}>
      {/* ── Cost Cuts ─────────────────────────────────────────────── */}
      <div style={{ ...S.card, borderLeft: `3px solid ${ORANGE}`, marginBottom: '12px' }}>
        {hdr('◈ COST CUTS — MVP INFRASTRUCTURE', costsOpen, () => setCostsOpen(o => !o), copyAllCosts, 'costs-all')}

        {costsOpen && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: '11px', marginBottom: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: MUTED, fontSize: '9px' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0 8px', fontWeight: 600 }}>SERVICE</th>
                  <th style={{ textAlign: 'right', padding: '4px 0 8px', fontWeight: 600 }}>COST</th>
                  <th style={{ textAlign: 'left', padding: '4px 12px 8px', fontWeight: 600 }}>NOTE</th>
                  <th style={{ width: 32 }}/>
                </tr>
              </thead>
              <tbody>
                {COSTS.map((c, i) => (
                  <tr key={c.service} style={{ borderBottom: '1px solid var(--border)', opacity: 0.92 }}>
                    <td style={{ padding: '7px 0', color: 'var(--text)' }}>{c.service}</td>
                    <td style={{ padding: '7px 0', textAlign: 'right', color: c.cost === '$0' ? GREEN : ORANGE, fontWeight: 700 }}>
                      {c.cost}
                    </td>
                    <td style={{ padding: '7px 12px', color: MUTED, fontSize: '10px' }}>{c.note}</td>
                    <td style={{ padding: '4px 0' }}>
                      <button
                        style={{ ...S.btnSec, fontSize: '8px', padding: '2px 6px' }}
                        onClick={() => copy(`${c.service}: ${c.cost} — ${c.note}`, `cost-${i}`)}>
                        {copied === `cost-${i}` ? '✓' : '⎘'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', background: '#ff660012', borderRadius: '4px', borderLeft: `3px solid ${ORANGE}`, marginBottom: '12px' }}>
              <div style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 700, color: ORANGE }}>{TOTAL_RANGE}</div>
              <button style={{ ...S.btnSec, fontSize: '9px', padding: '2px 8px' }} onClick={() => copy(TOTAL_RANGE, 'total')}>
                {copied === 'total' ? '✓' : '⎘'}
              </button>
            </div>

            {/* Caching note */}
            <div style={{ padding: '10px 12px', background: 'var(--card-bg)', borderRadius: '4px', position: 'relative' }}>
              <div style={{ fontFamily: MONO, fontSize: '9px', color: ORANGE, letterSpacing: '0.08em', marginBottom: '6px' }}>
                ◈ CACHING STRATEGY
              </div>
              <div style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
                {CACHING_NOTE}
              </div>
              <button
                style={{ ...S.btnSec, fontSize: '9px', padding: '2px 8px', position: 'absolute', top: '10px', right: '10px' }}
                onClick={() => copy(CACHING_NOTE, 'caching')}>
                {copied === 'caching' ? '✓' : '⎘'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Prompt Library ────────────────────────────────────────── */}
      <div style={{ ...S.card, borderLeft: `3px solid ${BLUE}` }}>
        {hdr('◈ PROMPT LIBRARY — CLAUDE API', promptsOpen, () => setPromptsOpen(o => !o), copyAllPrompts, 'prompts-all')}

        {promptsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PROMPTS.map((p, i) => {
              const isOpen = expandedIdx === i
              return (
                <div key={p.name} style={{ border: `1px solid var(--border)`, borderRadius: '4px', borderLeft: `3px solid ${p.color}`, overflow: 'hidden' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                    background: 'var(--card-bg)', cursor: 'pointer', flexWrap: 'wrap' }}
                    onClick={() => setExpandedIdx(isOpen ? null : i)}>
                    <div style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: 'var(--text)', flex: '1 1 120px' }}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontFamily: MONO, fontSize: '9px', color: p.color, border: `1px solid ${p.color}44`, borderRadius: '2px', padding: '1px 6px', fontWeight: 700 }}>
                        {p.model.toUpperCase()}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: '9px', color: MUTED, border: '1px solid var(--border)', borderRadius: '2px', padding: '1px 6px' }}>
                        {p.when}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button
                        style={{ ...S.btnSec, fontSize: '9px', padding: '2px 8px' }}
                        onClick={e => { e.stopPropagation(); copy(p.template, `prompt-${i}`) }}>
                        {copied === `prompt-${i}` ? '✓ COPIED' : '⎘ COPY'}
                      </button>
                      <button style={{ ...S.btnSec, fontSize: '9px', padding: '2px 6px' }}>
                        {isOpen ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded template */}
                  {isOpen && (
                    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: '#0a0a0a' }}>
                      <pre style={{ fontFamily: MONO, fontSize: '10px', color: '#ccc', lineHeight: 1.8, margin: 0,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {p.template}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
