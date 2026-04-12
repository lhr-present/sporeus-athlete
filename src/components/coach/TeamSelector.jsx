// ─── coach/TeamSelector.jsx — Team pill selector ─────────────────────────────
// Extracted from CoachSquadView.jsx inline render.

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const YELLOW = '#f5c542'

/**
 * TeamSelector
 * Props:
 *   teams        — array of { id, name, age_group }
 *   activeTeamId — currently active team id ('all' for no filter)
 *   onSelect     — (teamId) => void
 *   gated        — boolean (true = show upgrade prompt instead)
 *   upgradeMsg   — string (message shown when gated)
 */
export default function TeamSelector({ teams, activeTeamId, onSelect, gated, upgradeMsg }) {
  if (teams.length === 0) return null

  if (gated) {
    return (
      <div style={{ fontFamily: MONO, fontSize: 10, color: YELLOW, marginBottom: 8, padding: '4px 8px', border: `1px solid ${YELLOW}44`, borderRadius: 3 }}>
        {upgradeMsg}
      </div>
    )
  }

  const all = [{ id: 'all', name: 'All', age_group: '' }, ...teams]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>TEAM</span>
      {all.map(t => {
        const active = activeTeamId === t.id
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              fontFamily: MONO, fontSize: 9, padding: '2px 9px', borderRadius: 2, cursor: 'pointer',
              background: active ? ORANGE : 'transparent',
              color:      active ? '#fff' : '#666',
              border:     `1px solid ${active ? ORANGE : '#333'}`,
              fontWeight: active ? 700 : 400,
            }}
          >
            {t.name}{t.age_group ? ` (${t.age_group})` : ''}
          </button>
        )
      })}
    </div>
  )
}
