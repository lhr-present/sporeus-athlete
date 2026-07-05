// ─── MaxHrNudge.jsx ───────────────────────────────────────────────────────────
// v9.471.0 (E5a) — Inline TodayView nudge when a recorded session's max HR
// exceeds the profile max (which feeds every HR zone + TRIMP-TSS calc).
// One-tap update — the athlete decides; never an automatic overwrite.
// Dismissal persists per observed value, so a NEW higher max re-nudges.
// Mirrors the ProfileCompletenessNudge pattern (v9.339).

import { useState } from 'react'
import { detectNewMaxHr, isMaxHrNudgeDismissed, dismissMaxHrNudge } from '../lib/athlete/maxHrNudge.js'

const MONO = "'IBM Plex Mono', monospace"

export default function MaxHrNudge({ log, profile, setProfile, isTR }) {
  const [bump, setBump] = useState(0)
  void bump
  const hit = detectNewMaxHr(log, profile)
  if (!hit) return null
  if (isMaxHrNudgeDismissed(hit.observedMax)) return null

  const profileMax = Number(profile?.maxhr)

  const applyUpdate = () => {
    // Functional form (audit LOW-4): merges over the query cache instead of a
    // render-time snapshot, so a concurrent cross-device profile edit of any
    // OTHER key isn't clobbered with stale values.
    setProfile(p => ({ ...p, maxhr: String(hit.observedMax) }))
    dismissMaxHrNudge(hit.observedMax)
    setBump(b => b + 1)
  }
  const dismiss = () => {
    dismissMaxHrNudge(hit.observedMax)
    setBump(b => b + 1)
  }

  return (
    <div
      role="status"
      style={{
        padding: '10px 14px',
        marginBottom: '14px',
        border: '1px solid #e0303044',
        borderLeft: '3px solid #e03030',
        borderRadius: '4px',
        background: 'rgba(224,48,48,0.04)',
        fontFamily: MONO,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div style={{ flex: 1, lineHeight: 1.55 }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#e03030', letterSpacing: '0.06em', marginBottom: '3px' }}>
          ♥ {isTR ? 'YENİ MAKS. KAH TESPİT EDİLDİ' : 'NEW MAX HR DETECTED'}
        </div>
        <div style={{ fontSize: '11px', color: '#888' }}>
          {isTR
            ? `${hit.entryDate || ''} seansında ${hit.observedMax} bpm görüldü — profildeki ${profileMax} bpm'in üzerinde. Güncellersen tüm KAH bölgeleri ve yük hesapları buna göre ayarlanır.`
            : `A session${hit.entryDate ? ` on ${hit.entryDate}` : ''} hit ${hit.observedMax} bpm — above your profile max of ${profileMax}. Updating retunes every HR zone and load calc.`}
        </div>
      </div>
      <button
        onClick={applyUpdate}
        style={{
          padding: '6px 12px', background: '#e03030', color: '#fff',
          border: 'none', borderRadius: '4px', fontFamily: MONO,
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {isTR ? `${hit.observedMax}'E GÜNCELLE` : `UPDATE TO ${hit.observedMax}`}
      </button>
      <button
        onClick={dismiss}
        aria-label={isTR ? 'Kapat' : 'Dismiss'}
        title={isTR ? 'Bu değer için bir daha gösterme' : "Don't show again for this value"}
        style={{
          background: 'transparent', border: 'none', color: '#666',
          cursor: 'pointer', fontSize: '12px', padding: '2px 6px', lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
