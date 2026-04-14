import { canAddAthlete, canUseAI, isFeatureGated } from '../lib/subscription.js'

// ─── Feature row helper ───────────────────────────────────────────────────────
function Row({ label, free, coach, club }) {
  const cell = (val) => (
    <td style={{ textAlign: 'center', padding: '7px 4px', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace" }}>
      <span style={{ color: val ? '#5bc25b' : '#444', fontWeight: 700 }}>{val ? '✓' : '✗'}</span>
    </td>
  )
  return (
    <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
      <td style={{ padding: '7px 10px', fontSize: '10px', color: '#aaa', fontFamily: "'IBM Plex Mono',monospace" }}>{label}</td>
      {cell(free)}
      {cell(coach)}
      {cell(club)}
    </tr>
  )
}

// ─── PricingPage ──────────────────────────────────────────────────────────────
export default function PricingPage({ tier, onClose }) {
  const currentTier = tier || 'free'

  const coachUrl  = import.meta.env.VITE_DODO_CHECKOUT_COACH  || 'mailto:hello@sporeus.com?subject=Coach Plan'
  const clubUrl   = import.meta.env.VITE_DODO_CHECKOUT_CLUB   || 'mailto:hello@sporeus.com?subject=Club Plan'
  const freeUrl   = 'https://lhr-present.github.io/sporeus-athlete/'

  const COL = {
    free:  { bg: '#0a1628', border: '#1a2840', label: 'Free', price: '$0', sub: 'Forever free' },
    coach: { bg: '#0a1628', border: '#d4a017', label: 'Coach', price: '₺500/mo', sub: '~$15 USD', recommended: true },
    club:  { bg: '#0a1628', border: '#1a2840', label: 'Club', price: '₺1.000/mo', sub: '~$30 USD' },
  }

  const FEATURES = [
    // label, free, coach, club
    ['Training log (unlimited)',       true,  true,  true],
    ['PMC charts (CTL/ATL/TSB)',       true,  true,  true],
    ['Daily wellness check-in',        true,  true,  true],
    ['AI summaries (7 days)',          true,  true,  true],
    ['Sport Program Builder',          true,  true,  true],
    ['Recovery protocols',             true,  true,  true],
    ['Coach access',                   false, true,  true],
    ['Squad benchmark dashboard',      false, true,  true],
    ['RSVP system',                    false, true,  true],
    ['Weekly AI digest (Sunday)',      false, true,  true],
    ['Up to 20 athletes',             false, true,  true],
    ['AI summaries (unlimited)',       false, true,  true],
    ['Athlete comparison',             false, true,  true],
    ['Monthly report cards',           false, true,  true],
    ['Team announcements',             false, true,  true],
    ['Unlimited athletes',             false, false, true],
    ['White-label branding',           false, false, true],
    ['KVKK audit log',                 false, false, true],
    ['Priority support',               false, false, true],
    ['Telegram notifications',         false, false, true],
    ['Custom onboarding',              false, false, true],
  ]

  const colKeys = ['free', 'coach', 'club']

  const headerStyle = (key) => ({
    background: COL[key].recommended ? '#1a1400' : '#0d1626',
    border: `1px solid ${COL[key].border}`,
    borderBottom: 'none',
    borderRadius: '8px 8px 0 0',
    padding: '18px 12px 14px',
    textAlign: 'center',
    position: 'relative',
  })

  const badge = (key) => {
    if (currentTier === key) {
      return (
        <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', background: '#5bc25b', color: '#0a0a0a', fontSize: '9px', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", padding: '2px 10px', borderRadius: '12px', whiteSpace: 'nowrap', letterSpacing: '0.08em' }}>
          CURRENT PLAN
        </div>
      )
    }
    if (COL[key].recommended) {
      return (
        <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', background: '#d4a017', color: '#0a0a0a', fontSize: '9px', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", padding: '2px 10px', borderRadius: '12px', whiteSpace: 'nowrap', letterSpacing: '0.08em' }}>
          RECOMMENDED
        </div>
      )
    }
    return null
  }

  const upgradeUrl = { free: freeUrl, coach: coachUrl, club: clubUrl }
  const upgradeLabel = {
    free:  'Sign Up Free',
    coach: currentTier === 'coach' ? 'Current Plan' : 'Upgrade to Coach →',
    club:  currentTier === 'club'  ? 'Current Plan' : 'Upgrade to Club →',
  }

  const btnStyle = (key) => ({
    display: 'block',
    width: '100%',
    padding: '9px 0',
    marginTop: '12px',
    fontSize: '11px',
    fontWeight: 700,
    fontFamily: "'IBM Plex Mono',monospace",
    borderRadius: '4px',
    cursor: currentTier === key ? 'default' : 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
    background: key === 'coach' ? '#d4a017' : key === 'club' ? '#0064ff' : '#1a2840',
    color: key === 'coach' ? '#0a0a0a' : '#f8f8f8',
    border: key === 'free' ? '1px solid #1a2840' : 'none',
    opacity: currentTier === key ? 0.6 : 1,
    letterSpacing: '0.05em',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      overflowY: 'auto',
    }}>
      <div style={{
        background: '#0a1628',
        border: '1px solid #1a2840',
        borderRadius: '10px',
        padding: '28px 24px 24px',
        width: '100%',
        maxWidth: '820px',
        position: 'relative',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '14px', right: '16px',
            background: 'none', border: '1px solid #333', borderRadius: '4px',
            color: '#888', fontSize: '13px', cursor: 'pointer',
            padding: '2px 8px', fontFamily: "'IBM Plex Mono',monospace",
          }}
          aria-label="Close pricing"
        >
          ✕
        </button>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8f8f8', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.08em' }}>
            SPOREUS PLANS
          </div>
          <div style={{ fontSize: '11px', color: '#666', fontFamily: "'IBM Plex Mono',monospace", marginTop: '5px' }}>
            Choose the plan that fits your coaching workflow
          </div>
        </div>

        {/* Pricing table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px 0', minWidth: '520px' }}>
            <thead>
              <tr>
                <th style={{ width: '38%', padding: '0 10px 10px', textAlign: 'left', fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: '#555', fontWeight: 400 }}>
                  FEATURE
                </th>
                {colKeys.map(key => (
                  <th key={key} style={headerStyle(key)}>
                    {badge(key)}
                    <div style={{ fontSize: '13px', fontWeight: 700, color: key === 'coach' ? '#d4a017' : '#f8f8f8', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.05em' }}>
                      {COL[key].label.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8f8f8', fontFamily: "'IBM Plex Mono',monospace", marginTop: '6px' }}>
                      {COL[key].price}
                    </div>
                    <div style={{ fontSize: '9px', color: '#666', fontFamily: "'IBM Plex Mono',monospace", marginTop: '2px' }}>
                      {COL[key].sub}
                    </div>
                    <a
                      href={upgradeUrl[key]}
                      target={key !== 'free' ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      style={btnStyle(key)}
                      onClick={currentTier === key ? (e) => e.preventDefault() : undefined}
                    >
                      {upgradeLabel[key]}
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(([label, free, coach, club]) => (
                <Row key={label} label={label} free={free} coach={coach} club={club} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '9px', color: '#444', fontFamily: "'IBM Plex Mono',monospace" }}>
          Prices in Turkish Lira. International billing available via Stripe. Cancel anytime.
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 600px) {
          .sp-pricing-table { min-width: unset !important; }
          .sp-pricing-table th, .sp-pricing-table td { padding: 5px 3px !important; font-size: 9px !important; }
        }
      `}</style>
    </div>
  )
}
