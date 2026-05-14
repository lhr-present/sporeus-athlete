// src/components/ui/Citation.jsx
// v9.147.0 — Progressive disclosure for sport-science citations.
//
// TodayView has 15+ inline citation render sites (Banister, Bompa,
// Bosquet, Friman & Wesslen, Plews, Mujika, Friel, Foster, Hulin,
// Daniels, Coggan, Halson, Seiler, Burke). For sport-science readers
// these are the right depth — for casual users they're visual noise.
//
// This component renders a small "?" button that expands to show the
// citation. First-time expansion persists user preference to
// localStorage so subsequent mounts default to open. Users who never
// click "?" stay in compact mode forever.

import { useState, useEffect } from 'react'

const PREF_KEY = 'sporeus-citations-preferred'

function readPref() {
  try { return localStorage.getItem(PREF_KEY) === 'expanded' }
  catch { return false }
}

function writePref() {
  try { localStorage.setItem(PREF_KEY, 'expanded') }
  catch { /* fail open */ }
}

/**
 * @param {object} props
 * @param {string} props.text  the citation body (e.g., "Banister 1991 (…)")
 * @param {string} [props.color]  text color override; defaults to muted
 */
export default function Citation({ text, color }) {
  const [open, setOpen] = useState(() => readPref())

  // Re-check pref on mount in case another Citation expanded it
  useEffect(() => {
    if (!open && readPref()) setOpen(true)
  }, [open])

  if (!text) return null

  if (open) {
    return (
      <div style={{
        fontSize: '9px',
        color: color || '#666',
        fontStyle: 'italic',
        marginTop: '2px',
        lineHeight: 1.5,
      }}>
        {text}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setOpen(true); writePref() }}
      aria-expanded="false"
      aria-label="Show citation"
      style={{
        marginTop: '2px',
        padding: '1px 6px',
        fontSize: '9px',
        fontFamily: "'IBM Plex Mono', monospace",
        color: '#555',
        background: 'transparent',
        border: '1px solid #333',
        borderRadius: '8px',
        cursor: 'pointer',
        letterSpacing: '0.04em',
      }}
    >
      ? Why
    </button>
  )
}
