// ─── SetupBanner.jsx ──────────────────────────────────────────────────────────
// v9.329.0 — Persistent top-level banner for users who are "onboarded" but
// have not actually picked a sport. This is the recovery path for the 4 prod
// users who clicked "Skip all →" in the pre-v9.328 wizard and ended up with
// profiles.sport=null forever.
//
// Without a sport, the plan generator can't run, the dashboard cards can't
// gate, and TodayView has nothing to recommend. So this banner is critical-
// severity and not snoozable — the only action that clears it is actually
// picking a sport (via reopenWizard → wizard completion).
//
// Render condition (App.jsx): onboarded && !profile?.sport && !profile?.primarySport
// Once sport is set, this component returns null naturally on next render.

const MONO = "'IBM Plex Mono', monospace"

export default function SetupBanner({ profile, lang = 'en', onPickSport }) {
  const sport = profile?.sport || profile?.primarySport
  if (sport) return null

  const isTR = lang === 'tr'

  return (
    <div
      role="alert"
      style={{
        background: '#fff3eb',
        borderBottom: '2px solid #ff6600',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: MONO,
        fontSize: '12px',
        color: '#333',
        position: 'relative',  // v9.370.0 — App banner stack positions it (was sticky top:0)
        zIndex: 10003,
      }}
    >
      <span style={{ color: '#ff6600', fontWeight: 700, fontSize: '14px' }}>◈</span>
      <span style={{ flex: 1, lineHeight: 1.5 }}>
        <strong style={{ color: '#ff6600' }}>
          {isTR ? 'KURULUMU TAMAMLA' : 'FINISH SETUP'}
        </strong>
        <span style={{ marginLeft: '8px', color: '#666' }}>
          {isTR
            ? 'Antrenman planını açmak için sporunu seç.'
            : 'Pick your sport to unlock your training plan.'}
        </span>
      </span>
      <button
        onClick={onPickSport}
        style={{
          background: '#ff6600',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          padding: '6px 14px',
          fontFamily: MONO,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {isTR ? 'SPORU SEÇ →' : 'PICK SPORT →'}
      </button>
    </div>
  )
}
