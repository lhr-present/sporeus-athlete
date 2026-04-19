// src/components/AiFeedbackButtons.jsx — E7: Thumbs up/down for AI cards
// Shown below every AI-generated output surface.
// Submits to Supabase ai_feedback with surface + prompt_version + rating.

import { useState } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'

const S = {
  wrap: {
    display:       'flex',
    gap:           '6px',
    alignItems:    'center',
    marginTop:     '8px',
  },
  btn: {
    background:    'none',
    border:        '1px solid var(--border)',
    borderRadius:  '4px',
    padding:       '3px 8px',
    cursor:        'pointer',
    fontSize:      '14px',
    color:         'var(--muted)',
    transition:    'all 0.15s ease',
  },
  active_up: {
    borderColor:   '#00aa55',
    color:         '#00aa55',
    background:    'rgba(0,170,85,0.08)',
  },
  active_down: {
    borderColor:   '#ff4444',
    color:         '#ff4444',
    background:    'rgba(255,68,68,0.08)',
  },
  thanks: {
    fontSize:      '12px',
    color:         'var(--muted)',
    fontStyle:     'italic',
  },
}

/**
 * Inline thumbs up/down buttons for any AI-generated card.
 *
 * @param {Object}  props
 * @param {string}  props.surface         - AI surface key (e.g. 'analyse_session')
 * @param {string}  props.promptVersion   - e.g. 'v1:a3f2b1c0'
 * @param {string}  [props.insightId]     - optional UUID of the ai_insights row
 * @param {string}  [props.userId]        - authenticated user id
 */
export default function AiFeedbackButtons({ surface, promptVersion, insightId, userId }) {
  const [rating, setRating]     = useState(null)   // 1 | -1 | null
  const [saved, setSaved]       = useState(false)
  const [loading, setLoading]   = useState(false)

  async function submit(value) {
    if (saved || loading) return
    setRating(value)
    setLoading(true)

    if (isSupabaseReady() && userId) {
      try {
        const row = {
          user_id:       userId,
          surface,
          prompt_version: promptVersion || 'v1:unknown',
          rating:        value,
          insight_id:    insightId || null,
        }
        await supabase.from('ai_feedback').insert(row)
      } catch {
        // non-fatal — feedback loss is acceptable
      }
    }

    setLoading(false)
    setSaved(true)
  }

  if (saved) {
    return (
      <div style={S.wrap}>
        <span style={S.thanks}>Thanks for the feedback</span>
      </div>
    )
  }

  return (
    <div style={S.wrap} role="group" aria-label="Was this analysis helpful?">
      <button
        style={{ ...S.btn, ...(rating === 1 ? S.active_up : {}) }}
        onClick={() => submit(1)}
        disabled={loading}
        aria-label="Thumbs up — helpful"
        aria-pressed={rating === 1}
      >
        👍
      </button>
      <button
        style={{ ...S.btn, ...(rating === -1 ? S.active_down : {}) }}
        onClick={() => submit(-1)}
        disabled={loading}
        aria-label="Thumbs down — not helpful"
        aria-pressed={rating === -1}
      >
        👎
      </button>
    </div>
  )
}
