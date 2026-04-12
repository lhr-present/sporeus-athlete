// ─── TodayView.jsx — v5.14.0: Single-screen daily HQ ─────────────────────────
import { useState, useMemo, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { getTodayPlannedSession, getSingleSuggestion } from '../lib/intelligence.js'
import { WELLNESS_FIELDS } from '../lib/constants.js'

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const RED    = '#e03030'
const BLUE   = '#0064ff'

function calcStreak(log, today) {
  const dates = new Set((log || []).map(e => e.date))
  const start = new Date(today)
  if (!dates.has(today)) start.setDate(start.getDate() - 1)
  let streak = 0
  while (true) {
    const d = start.toISOString().slice(0, 10)
    if (dates.has(d)) { streak++; start.setDate(start.getDate() - 1) }
    else break
  }
  return streak
}

const QUICK_FIELDS = WELLNESS_FIELDS.filter(f => ['sleep', 'energy', 'soreness'].includes(f.key))

export default function TodayView({ log, profile, setTab, setLogPrefill }) {
  const { t, lang }   = useContext(LangCtx)
  const { recovery, setRecovery } = useData()

  const [plan]       = useLocalStorage('sporeus-plan',        null)
  const [planStatus, setPlanStatus] = useLocalStorage('sporeus-plan-status', {})

  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()

  const plannedSession = useMemo(() => getTodayPlannedSession(plan, today), [plan, today])
  const todayKey       = plannedSession ? `${plannedSession.weekIdx}-${plannedSession.dayIdx}` : null
  const todayStatus    = todayKey ? planStatus[todayKey] : null

  const suggestion = useMemo(() => getSingleSuggestion(log, recovery, profile), [log, recovery, profile])

  const yesterdayLogged = (log || []).some(e => e.date === yesterday)
  const sessions7d      = useMemo(() => {
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) })()
    return (log || []).filter(e => e.date >= cutoff).length
  }, [log])
  const streak = useMemo(() => calcStreak(log, today), [log, today])

  // ── Z-score personal baseline (28-day rolling) ──────────────────────────────
  const wellnessBaseline = useMemo(() => {
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10) })()
    const past = (recovery || []).filter(e => e.date >= cutoff && e.date < today && typeof e.score === 'number')
    if (past.length < 7) return null
    const n    = past.length
    const mean = past.reduce((s, e) => s + e.score, 0) / n
    const variance = past.reduce((s, e) => s + Math.pow(e.score - mean, 2), 0) / (n - 1)
    const sd   = Math.sqrt(variance)
    return { mean: Math.round(mean), sd: Math.round(sd * 10) / 10, n }
  }, [recovery, today])

  const todayRec = (recovery || []).find(e => e.date === today)
  const [wellness, setWellness] = useState({ sleep: 3, energy: 3, soreness: 3 })
  const [wellnessSaved, setWellnessSaved] = useState(false)

  const saveReadiness = () => {
    const score = Math.round((wellness.sleep + wellness.energy + (6 - wellness.soreness)) / 3 * 20)
    const entry = { date: today, sleep: wellness.sleep, energy: wellness.energy, soreness: wellness.soreness, mood: 3, stress: 3, score, id: Date.now() }
    setRecovery(prev => [...(prev || []).filter(e => e.date !== today), entry].slice(-90))
    setWellnessSaved(true)
  }

  const markDone = () => {
    if (!todayKey) return
    setPlanStatus(ps => ({ ...ps, [todayKey]: 'done' }))
  }

  const logThisSession = () => {
    if (plannedSession) {
      setLogPrefill({ type: plannedSession.type, duration: plannedSession.duration, rpe: plannedSession.rpe || 6, date: today })
    }
    setTab('log')
  }

  const suggestColor = suggestion.level === 'warning' ? RED : suggestion.level === 'ok' ? GREEN : BLUE

  const card = {
    background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '20px 18px', marginBottom: '14px', fontFamily: MONO,
  }
  const cardTitle = {
    fontSize: '10px', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase',
    marginBottom: '14px',
  }
  const badge = (color) => ({
    display: 'inline-block', background: color + '18', border: `1px solid ${color}`,
    borderRadius: '4px', padding: '2px 8px', fontSize: '10px', color, letterSpacing: '0.06em',
  })
  const btn = (bg, fg = '#fff') => ({
    fontFamily: MONO, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
    padding: '7px 14px', borderRadius: '4px', border: 'none', background: bg,
    color: fg, cursor: 'pointer',
  })

  return (
    <div className="sp-fade">

      {/* ── Card 1: Today's Session ────────────────────────────────────────── */}
      <div style={{ ...card, borderLeft: `4px solid ${plannedSession && todayStatus === 'done' ? GREEN : ORANGE}` }}>
        <div style={cardTitle}>{t('todaySession')}</div>

        {plannedSession ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>
                {plannedSession.type}
              </span>
              <span style={{ fontSize: '11px', color: '#888' }}>
                {plannedSession.duration} min
                {plannedSession.rpe ? ` · RPE ${plannedSession.rpe}` : ''}
                {plannedSession.weekPhase ? ` · ${plannedSession.weekPhase}` : ''}
              </span>
            </div>
            {plannedSession.description && (
              <p style={{ fontSize: '11px', color: '#888', lineHeight: 1.55, marginBottom: '12px' }}>
                {plannedSession.description}
              </p>
            )}
            {todayStatus === 'done' ? (
              <span style={badge(GREEN)}>✓ {t('todayDone')}</span>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={logThisSession} style={btn(ORANGE)}>{t('todayLogThis')}</button>
                <button onClick={markDone} style={btn('transparent', '#888')}
                  onMouseOver={e => e.currentTarget.style.color = '#ccc'}
                  onMouseOut={e  => e.currentTarget.style.color = '#888'}>
                  {t('todayMarkDone')}
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#555', fontSize: '12px', lineHeight: 1.6 }}>
            {plan
              ? <span style={{ color: AMBER }}>◆ {t('todayRest')}</span>
              : (
                <>
                  <div style={{ color: '#555', marginBottom: '10px' }}>{t('todayNoPlan')}</div>
                  <button onClick={() => setTab('plan')} style={btn(ORANGE)}>{t('t_plan')} →</button>
                </>
              )
            }
          </div>
        )}
      </div>

      {/* ── Card 2: Readiness Quick-Check ─────────────────────────────────── */}
      <div style={{ ...card, borderLeft: `4px solid ${todayRec ? (todayRec.score >= 75 ? GREEN : todayRec.score >= 50 ? AMBER : RED) : '#333'}` }}>
        <div style={cardTitle}>{t('todayReadiness')}</div>

        {todayRec ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '36px', fontWeight: 700, color: todayRec.score >= 75 ? GREEN : todayRec.score >= 50 ? AMBER : RED }}>
              {todayRec.score}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888' }}>{t('readScoreTitle')} / 100</div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                {todayRec.score >= 75 ? t('goLabel') : todayRec.score >= 50 ? t('monitorLabel') : t('restLabel')}
              </div>
              {wellnessBaseline && (() => {
                const z = wellnessBaseline.sd > 0
                  ? (todayRec.score - wellnessBaseline.mean) / wellnessBaseline.sd
                  : 0
                if (z >= -1.0) return null
                const severe = z < -1.5
                const col = severe ? RED : AMBER
                const msg = severe
                  ? (lang === 'tr' ? `Normalin ${Math.abs(z).toFixed(1)}σ altında — belirgin düşüş` : `${Math.abs(z).toFixed(1)}σ below your norm — notable dip`)
                  : (lang === 'tr' ? `Normalin altında (ort. ${wellnessBaseline.mean})` : `Below your 28d avg (${wellnessBaseline.mean})`)
                return (
                  <div style={{ marginTop: '5px', fontSize: '9px', color: col, letterSpacing: '0.06em' }}>
                    {severe ? '⚠ ' : '↓ '}{msg}
                  </div>
                )
              })()}
            </div>
          </div>
        ) : wellnessSaved ? (
          <div style={{ color: GREEN, fontSize: '12px' }}>✓ {t('todaySaved')}</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {QUICK_FIELDS.map(field => (
                <div key={field.key}>
                  <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '6px' }}>{t(field.lk)}</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {field.emoji.map((em, i) => (
                      <button key={i} onClick={() => setWellness(w => ({ ...w, [field.key]: i + 1 }))}
                        style={{ fontSize: '18px', padding: '4px 6px', borderRadius: '5px', cursor: 'pointer', border: `2px solid ${wellness[field.key] === i + 1 ? ORANGE : 'var(--border)'}`, background: wellness[field.key] === i + 1 ? '#2a1800' : 'var(--surface)', lineHeight: 1 }}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={saveReadiness} style={btn(ORANGE)}>{t('todaySaveReadiness')}</button>
            <button onClick={() => setTab('recovery')}
              style={{ ...btn('transparent', '#555'), border: '1px solid var(--border)', marginLeft: '8px' }}>
              {t('t_recovery')} →
            </button>
          </>
        )}
      </div>

      {/* ── Card 3: Quick Stats ────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>{t('todayQuickStats')}</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>

          <div style={{ flex: '1 1 80px', textAlign: 'center', padding: '10px 8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{yesterdayLogged ? '✓' : '—'}</div>
            <div style={{ fontSize: '9px', color: yesterdayLogged ? GREEN : '#444', letterSpacing: '0.08em' }}>{t('todayYesterday')}</div>
          </div>

          <div style={{ flex: '1 1 80px', textAlign: 'center', padding: '10px 8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: ORANGE, marginBottom: '4px' }}>{sessions7d}</div>
            <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.08em' }}>{t('todayThisWeek')}</div>
          </div>

          <div style={{ flex: '1 1 80px', textAlign: 'center', padding: '10px 8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: streak >= 3 ? ORANGE : '#888', marginBottom: '4px' }}>
              {streak}{streak >= 3 ? ' 🔥' : ''}
            </div>
            <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.08em' }}>{t('todayStreak')}</div>
          </div>

        </div>

        {!yesterdayLogged && (log || []).length > 0 && (
          <button onClick={() => { setLogPrefill({ date: yesterday }); setTab('log') }}
            style={{ ...btn('transparent', '#555'), border: '1px solid var(--border)', marginTop: '12px', width: '100%' }}>
            {t('todayLogYesterday')}
          </button>
        )}
      </div>

      {/* ── Card 4: Smart Suggestion ───────────────────────────────────────── */}
      <div style={{ ...card, borderLeft: `4px solid ${suggestColor}` }}>
        <div style={cardTitle}>{t('todaySuggestion')}</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>
            {suggestion.level === 'warning' ? '⚠' : suggestion.level === 'ok' ? '◈' : '→'}
          </span>
          <p style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>
            {suggestion.text[lang] || suggestion.text.en}
          </p>
        </div>
      </div>

    </div>
  )
}
