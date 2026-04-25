// ─── ChallengeWidget.jsx — Athlete-side Squad Challenge widget (E11) ───────────
import { useContext, useState, useEffect } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeAthleteProgress, rankAthletes } from '../../lib/squadChallenge.js'

const LS_CHALLENGE = 'sporeus-squad-challenge'
const LS_ENTRIES   = 'sporeus-squad-challenge-entries'

function readChallenge() {
  try { return JSON.parse(localStorage.getItem(LS_CHALLENGE)) } catch { return null }
}
function readEntries() {
  try { return JSON.parse(localStorage.getItem(LS_ENTRIES)) || [] } catch { return [] }
}

/**
 * @param {{ log: Array<Object> }} props
 */
export default function ChallengeWidget({ log }) {
  const { t } = useContext(LangCtx)
  const [challenge, setChallenge] = useState(readChallenge)
  const [entries,   setEntries]   = useState(readEntries)

  // React to challenge being set/removed by coach in same browser session
  useEffect(() => {
    const handler = () => {
      setChallenge(readChallenge())
      setEntries(readEntries())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  if (!challenge) return null

  const progress = computeAthleteProgress(log || [], challenge)

  // Compute rank — find "me" entry in LS_ENTRIES + build leaderboard
  const ranked  = rankAthletes(
    entries.map(e => ({
      athleteId: e.athleteId || e.name,
      name: e.name || e.athleteId,
      value: computeAthleteProgress(e.sessions || [], challenge).value,
    }))
  )
  const total = ranked.length
  // If athlete entries are empty, still show personal progress; rank shows n/a
  const myRank = total > 0 ? (ranked.findIndex(r => r.athleteId === 'me') + 1 || null) : null

  const rankText = (rank, tot) => {
    const template = t('squadChallengeRank')
    return template
      .replace('{rank}', rank)
      .replace('{total}', tot)
  }

  const card = {
    background: 'var(--card-bg, #111)',
    border: '1px solid #ff6600',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '12px',
    fontFamily: '"IBM Plex Mono", monospace',
  }

  return (
    <div style={card}>
      <div style={{ fontSize: '10px', color: '#ff6600', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>
        {t('squadChallenge')}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #eee)', marginBottom: '10px' }}>
        {challenge.title}
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted, #666)', marginBottom: '4px' }}>
        <span>{progress.value} / {challenge.targetValue}</span>
        <span>{progress.pct}%</span>
      </div>
      <div style={{ height: '8px', background: 'var(--surface, #1a1a1a)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
        <div style={{
          height: '100%',
          width: `${progress.pct}%`,
          background: progress.pct >= 100 ? '#00cc66' : '#ff6600',
          borderRadius: '4px',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Rank line */}
      {myRank && total > 0 && (
        <div style={{ fontSize: '10px', color: 'var(--muted, #888)', letterSpacing: '0.04em' }}>
          {rankText(myRank, total)}
        </div>
      )}
      {(!myRank || total === 0) && (
        <div style={{ fontSize: '10px', color: 'var(--muted, #666)' }}>
          {challenge.startDate} → {challenge.endDate}
        </div>
      )}
    </div>
  )
}
