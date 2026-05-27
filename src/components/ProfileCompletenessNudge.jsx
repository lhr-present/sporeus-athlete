// ─── ProfileCompletenessNudge.jsx ─────────────────────────────────────────────
// v9.339.0 — Inline nudge on TodayView for users past first session who still
// have missing key profile fields. Without these, HR zones fall back to
// age-based Tanaka estimate (or generic defaults), and pace/power zones
// can't render at all. Surfacing the gap one tap from the fix.
//
// Render condition (TodayView): log.length >= 1 AND missingFields.length > 0
//
// Fields checked (varies by sport):
//   - All sports: age (Tanaka maxHR needs it as a fallback)
//   - All sports: maxhr (proper HR zones via Friel 2009)
//   - Running:    ltpace (pace zones via Daniels VDOT)
//   - Cycling:    ftp (power zones via Coggan 2003)
//
// Tappable → setTab('profile'). Bilingual EN/TR.

const MONO = "'IBM Plex Mono', monospace"

export default function ProfileCompletenessNudge({ profile, isTR, onGoToProfile }) {
  const sport = profile?.sport || profile?.primarySport || ''
  const missing = []

  const blank = (v) => v == null || v === '' || v === '0'

  if (blank(profile?.age))      missing.push(isTR ? 'yaş'        : 'age')
  if (blank(profile?.maxhr))    missing.push(isTR ? 'maks. KAH'  : 'max HR')

  if (sport === 'Running' || sport === 'Triathlon') {
    if (blank(profile?.ltpace) && blank(profile?.threshold)) {
      missing.push(isTR ? 'eşik temposu' : 'threshold pace')
    }
  }
  if (sport === 'Cycling' || sport === 'Triathlon') {
    if (blank(profile?.ftp)) {
      missing.push(isTR ? 'FTP' : 'FTP')
    }
  }

  if (missing.length === 0) return null

  // v9.339 — Hardcoded uppercase for the headline. JS default toUpperCase
  // mangles Turkish (i → I instead of İ); locale-aware would work but the
  // string is fixed, so just write it pre-uppercased.
  const headlineUpper = isTR ? 'BÖLGELERİ KİŞİSELLEŞTİR' : 'PERSONALIZE YOUR ZONES'

  // Show all missing fields, comma-separated. Capped at 4 in practice
  // (age + maxhr + ltpace OR ftp; Triathlon hits both = 4 max).
  const body = isTR
    ? `${missing.join(', ')} eklenirse antrenman bölgeleri sana özel olur.`
    : `Add ${missing.join(', ')} so your training zones reflect you, not a default.`

  return (
    <div
      role="status"
      style={{
        padding: '10px 14px',
        marginBottom: '14px',
        border: '1px solid #0064ff44',
        borderLeft: '3px solid #0064ff',
        borderRadius: '4px',
        background: 'rgba(0,100,255,0.04)',
        fontFamily: MONO,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div style={{ flex: 1, lineHeight: 1.55 }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0064ff', letterSpacing: '0.06em', marginBottom: '3px' }}>
          ◆ {headlineUpper}
        </div>
        <div style={{ fontSize: '11px', color: '#888' }}>{body}</div>
      </div>
      <button
        onClick={onGoToProfile}
        style={{
          padding: '6px 12px',
          background: '#0064ff',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontFamily: MONO,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {isTR ? 'PROFİL →' : 'PROFILE →'}
      </button>
    </div>
  )
}
