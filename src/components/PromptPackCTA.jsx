// ─── PromptPackCTA.jsx — Prompt pack upsell (collapsed, gated 7+ days) ────────
// Shown in Profile after AI Settings. Collapsed by default.
// Gate: app must be 7+ days old (sporeus-visited-tabs._firstVisit).

import { useState } from 'react'

const MONO   = "'IBM Plex Mono','Courier New',monospace"
const ORANGE = '#ff6600'

const SAMPLE_PROMPTS = [
  {
    label: 'Injury risk scan',
    text:  'My ACWR is {acwr}. Based on my 7-day load trend, what is my injury risk profile and how should I adjust this week?',
  },
  {
    label: 'Peak timing',
    text:  'CTL: {ctl}, ATL: {atl}, TSB: {tsb}. My race is in {n} days. Am I on track to peak in time? What adjustments are needed?',
  },
  {
    label: 'Zone audit',
    text:  'My last 28 days: {zone_dist}% Z1, {zone_dist}% Z2, {zone_dist}% Z3+. I follow a polarized model. What is wrong with my distribution?',
  },
]

const GUMROAD_URL = 'https://gumroad.com/l/sporeus-audit-prompts'

function getAppAgeDays() {
  try {
    const tabs = JSON.parse(localStorage.getItem('sporeus-visited-tabs') || '{}')
    const first = tabs._firstVisit
    if (!first) return 0
    return Math.floor((Date.now() - new Date(first).getTime()) / 86400000)
  } catch { return 0 }
}

export default function PromptPackCTA() {
  const [open, setOpen] = useState(false)

  const age = getAppAgeDays()
  if (age < 7) return null

  return (
    <div style={{
      fontFamily:    MONO,
      background:    'var(--card-bg)',
      border:        '1px solid var(--border)',
      borderLeft:    `3px solid ${ORANGE}`,
      borderRadius:  '8px',
      marginBottom:  '14px',
      overflow:      'hidden',
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '12px 16px',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          textAlign:      'left',
          gap:            8,
        }}
      >
        <div>
          <div style={{ fontSize: '10px', color: ORANGE, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>
            ◈ SPOREUS AUDIT PROMPT PACK
          </div>
          <div style={{ fontSize: '9px', color: '#888', letterSpacing: '0.06em' }}>
            40+ coaching prompts · Used by 40+ auditors · $9
          </div>
        </div>
        <span style={{ color: '#555', fontSize: 10, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: '10px', color: '#888', lineHeight: 1.7, marginBottom: 12 }}>
            Copy-paste prompts that work with the Claude AI integration built into this app.
            Each prompt is pre-filled with your data format so you get precise, actionable answers.
          </div>

          {/* Sample prompt previews */}
          {SAMPLE_PROMPTS.map((p, i) => (
            <div key={i} style={{ marginBottom: 8, background: 'var(--surface)', borderRadius: 4, padding: '8px 10px', borderLeft: `2px solid #2a2a2a` }}>
              <div style={{ fontSize: '8px', color: ORANGE, letterSpacing: '0.1em', marginBottom: 4 }}>
                SAMPLE {i + 1} — {p.label.toUpperCase()}
              </div>
              <div style={{ fontSize: '9px', color: '#666', lineHeight: 1.5, fontStyle: 'italic' }}>
                "{p.text}"
              </div>
            </div>
          ))}

          <div style={{ fontSize: '9px', color: '#555', marginTop: 8, marginBottom: 12, letterSpacing: '0.04em' }}>
            + 37 more prompts covering: periodization, race readiness, HRV interpretation, zone audit, taper strategy, and more.
          </div>

          <a
            href={GUMROAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:        'inline-block',
              fontFamily:     MONO,
              fontSize:       '10px',
              fontWeight:     700,
              letterSpacing:  '0.08em',
              padding:        '7px 18px',
              borderRadius:   '4px',
              background:     ORANGE,
              color:          '#fff',
              textDecoration: 'none',
              border:         'none',
            }}
          >
            Get the Prompt Pack →
          </a>
          <span style={{ display: 'inline-block', fontSize: '9px', color: '#555', marginLeft: 10 }}>
            Instant download · Gumroad
          </span>
        </div>
      )}
    </div>
  )
}
