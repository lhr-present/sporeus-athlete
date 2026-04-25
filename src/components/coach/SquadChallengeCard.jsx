// ─── SquadChallengeCard.jsx — Coach-side Squad Monthly Challenge card (E11) ────
import { useContext, useState, useEffect } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { createChallenge, computeAthleteProgress, rankAthletes } from '../../lib/squadChallenge.js'

const LS_CHALLENGE = 'sporeus-squad-challenge'
const LS_ENTRIES   = 'sporeus-squad-challenge-entries'

const METRIC_OPTS = [
  { value: 'distance', en: 'Distance (km)',    tr: 'Mesafe (km)' },
  { value: 'duration', en: 'Duration (hours)', tr: 'Süre (saat)' },
  { value: 'sessions', en: 'Sessions (count)', tr: 'Antrenman (adet)' },
]

function readChallenge() {
  try { return JSON.parse(localStorage.getItem(LS_CHALLENGE)) } catch { return null }
}
function readEntries() {
  try { return JSON.parse(localStorage.getItem(LS_ENTRIES)) || [] } catch { return [] }
}

export default function SquadChallengeCard() {
  const { t, lang } = useContext(LangCtx)
  const [challenge, setChallenge] = useState(readChallenge)
  const [entries,   setEntries]   = useState(readEntries)
  const [showForm,  setShowForm]  = useState(false)

  // Form state
  const [form, setForm] = useState({
    title: '',
    metric: 'distance',
    targetValue: '',
    startDate: '',
    endDate: '',
  })

  // Refresh entries from localStorage (could be updated by ChallengeWidget writes)
  useEffect(() => {
    const handler = () => setEntries(readEntries())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  function handleSave() {
    if (!form.title.trim() || !form.targetValue || !form.startDate || !form.endDate) return
    const c = createChallenge(form)
    localStorage.setItem(LS_CHALLENGE, JSON.stringify(c))
    setChallenge(c)
    setShowForm(false)
    setForm({ title: '', metric: 'distance', targetValue: '', startDate: '', endDate: '' })
  }

  function handleEnd() {
    localStorage.removeItem(LS_CHALLENGE)
    setChallenge(null)
  }

  // Build ranked list from entries
  const ranked = challenge
    ? rankAthletes(
        entries.map(e => ({
          athleteId: e.athleteId || e.name,
          name: e.name || e.athleteId,
          value: computeAthleteProgress(e.sessions || [], challenge).value,
        }))
      )
    : []

  const metricLabel = (metric) => {
    const opt = METRIC_OPTS.find(o => o.value === metric)
    return opt ? (lang === 'tr' ? opt.tr : opt.en) : metric
  }

  const card = {
    background: 'var(--card-bg, #111)',
    border: '1px solid var(--border, #222)',
    borderRadius: '6px',
    padding: '16px',
    marginTop: '16px',
    fontFamily: '"IBM Plex Mono", monospace',
  }
  const title = {
    fontSize: '11px',
    fontWeight: 700,
    color: '#ff6600',
    letterSpacing: '0.08em',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
  const btn = {
    background: '#ff6600',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: '"IBM Plex Mono", monospace',
    letterSpacing: '0.05em',
  }
  const btnGhost = {
    ...btn,
    background: 'transparent',
    color: 'var(--muted, #666)',
    border: '1px solid var(--border, #333)',
  }
  const label = { fontSize: '10px', color: 'var(--muted, #666)', display: 'block', marginBottom: '3px' }
  const input = {
    background: 'var(--input-bg, #1a1a1a)',
    border: '1px solid var(--border, #333)',
    borderRadius: '4px',
    padding: '5px 8px',
    color: 'var(--text, #eee)',
    fontSize: '11px',
    fontFamily: '"IBM Plex Mono", monospace',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={card}>
      <div style={title}>
        <span>{t('squadChallenge')}</span>
        <button style={btn} onClick={() => setShowForm(f => !f)}>
          {t('squadChallengeNew')}
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <span style={label}>{t('squadChallengeTitle')}</span>
            <input
              style={input}
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Run 200km in May"
            />
          </div>
          <div>
            <span style={label}>{t('squadChallengeMetric')}</span>
            <select
              style={input}
              value={form.metric}
              onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
            >
              {METRIC_OPTS.map(o => (
                <option key={o.value} value={o.value}>
                  {lang === 'tr' ? o.tr : o.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={label}>{t('squadChallengeTarget')}</span>
            <input
              style={input}
              type="number"
              min="1"
              value={form.targetValue}
              onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
              placeholder="200"
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <span style={label}>Start</span>
              <input
                style={input}
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={label}>End</span>
              <input
                style={input}
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button style={btn} onClick={handleSave}>Save</button>
            <button style={btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Active challenge */}
      {!challenge ? (
        <div style={{ fontSize: '11px', color: 'var(--muted, #666)' }}>
          {t('squadChallengeNone')}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text, #eee)', marginBottom: '4px' }}>
            {challenge.title}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted, #666)', marginBottom: '8px' }}>
            {metricLabel(challenge.metric)} · {t('squadChallengeTarget')}: {challenge.targetValue} · {challenge.startDate} → {challenge.endDate}
          </div>

          {/* Athlete progress bars */}
          {ranked.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {ranked.map(({ athleteId, name, value, rank }) => {
                const pct = challenge.targetValue > 0
                  ? Math.min(100, (value / challenge.targetValue) * 100)
                  : 0
                return (
                  <div key={athleteId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text, #ccc)', marginBottom: '3px' }}>
                      <span>#{rank} {name}</span>
                      <span>{value} / {challenge.targetValue}</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--surface, #1a1a1a)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#ff6600', borderRadius: '3px', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: '10px', color: 'var(--muted, #666)', marginBottom: '12px' }}>
              No athlete entries yet.
            </div>
          )}

          <button style={btnGhost} onClick={handleEnd}>
            {t('squadChallengeEnd')}
          </button>
        </div>
      )}
    </div>
  )
}
