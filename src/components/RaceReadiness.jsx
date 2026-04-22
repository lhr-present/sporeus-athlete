// ─── RaceReadiness.jsx — E14 Race Readiness Calculator ────────────────────────
// Shows 0–100 readiness score, traffic-light indicator, and top-3 recommendations.
// Uses computeRaceReadiness() from intelligence.js (Banister 1991, Coggan 2003, Morton 1991).

import { useMemo, useContext, useState } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { computeRaceReadiness, predictRacePerformance } from '../lib/intelligence.js'
import { S } from '../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const RED    = '#e03030'
const BLUE   = '#0064ff'

function trafficColor(score) {
  if (score >= 75) return GREEN
  if (score >= 55) return AMBER
  return RED
}

function trafficLabel(score, lang) {
  if (score >= 75) return lang === 'tr' ? 'HAZIR'     : 'RACE READY'
  if (score >= 55) return lang === 'tr' ? 'YAKLAŞIYOR' : 'APPROACHING'
  return lang === 'tr' ? 'HAZIR DEĞİL' : 'NOT READY'
}

export default function RaceReadiness() {
  const { t, lang } = useContext(LangCtx)
  const { log, recovery, injuries, testResults, profile, setProfile } = useData()
  const [plan]       = useLocalStorage('sporeus-plan',        null)
  const [planStatus] = useLocalStorage('sporeus-plan-status', {})

  const [raceDate, setRaceDate] = useState(profile?.nextRaceDate || profile?.raceDate || '')
  const [goal,     setGoal]     = useState(profile?.goal || '')

  // Merge UI inputs into a profile snapshot for readiness computation
  const profileForCalc = useMemo(() => ({
    ...profile,
    raceDate: raceDate || undefined,
    goal:     goal     || undefined,
  }), [profile, raceDate, goal])

  const result = useMemo(
    () => computeRaceReadiness(log, recovery, injuries, profileForCalc, plan, planStatus),
    [log, recovery, injuries, profileForCalc, plan, planStatus],
  )

  const perf = useMemo(
    () => predictRacePerformance(log, testResults, profileForCalc),
    [log, testResults, profileForCalc],
  )

  function handleSave() {
    setProfile(prev => ({ ...prev, nextRaceDate: raceDate, raceDate, goal }))
  }

  const color = trafficColor(result.score)
  const isTR  = lang === 'tr'

  const bottomFactors = [...result.factors].sort((a, b) => a.score - b.score).slice(0, 3)

  return (
    <div style={{ fontFamily: MONO, maxWidth: '640px', margin: '0 auto', padding: '0 0 40px' }}>
      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, letterSpacing: '0.12em', marginBottom: '18px' }}>
        ◈ {isTR ? 'YARIŞ HAZIRLIĞI HESAPLAYICI' : 'RACE READINESS CALCULATOR'}
      </div>

      {/* ── Inputs ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '4px' }}>
            {isTR ? 'YARIŞ TARİHİ' : 'RACE DATE'}
          </label>
          <input
            type="date"
            value={raceDate}
            onChange={e => setRaceDate(e.target.value)}
            style={{ ...S.input, width: '100%' }}
          />
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '4px' }}>
            {isTR ? 'HEDEF / MESAFE' : 'GOAL / DISTANCE'}
          </label>
          <input
            type="text"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder={isTR ? '5k, 10k, half marathon, marathon…' : '5k, 10k, half marathon, marathon…'}
            style={{ ...S.input, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={handleSave} style={{ ...S.btn, fontSize: '10px', padding: '7px 14px' }}>
            {isTR ? 'Kaydet' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Score card ────────────────────────────────────────────────────── */}
      <div style={{
        border: `2px solid ${color}`, borderRadius: '4px', padding: '20px 24px',
        marginBottom: '18px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', fontWeight: 700, color, lineHeight: 1 }}>
            {result.score}
          </div>
          <div style={{ fontSize: '9px', color: '#555', marginTop: '3px' }}>/100</div>
        </div>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color, marginBottom: '4px' }}>
            {result.grade}
          </div>
          <div style={{ fontSize: '11px', color, fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>
            {trafficLabel(result.score, lang)}
          </div>
          <div style={{ fontSize: '10px', color: '#888', lineHeight: 1.5, maxWidth: '340px' }}>
            {result.verdict?.[lang] || result.verdict?.en}
          </div>
          {result.daysToRace !== null && (
            <div style={{ fontSize: '9px', color: '#555', marginTop: '6px' }}>
              {isTR ? `Yarışa ${result.daysToRace} gün` : `${result.daysToRace} days to race`}
              {' · '}{isTR ? 'Güven' : 'Confidence'}: {result.confidence}
            </div>
          )}
        </div>
      </div>

      {/* ── Top-3 recommendations ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>
          {isTR ? '▶ ÖNCELIKLI İYİLEŞTİRME ALANLARI' : '▶ TOP IMPROVEMENT AREAS'}
        </div>
        {bottomFactors.map((f, i) => (
          <div key={f.name} style={{
            display: 'flex', gap: '10px', alignItems: 'flex-start',
            padding: '8px 12px', marginBottom: '6px',
            background: 'var(--surface, #0f0f0f)', borderRadius: '3px',
            borderLeft: `3px solid ${f.score < 50 ? RED : f.score < 75 ? AMBER : GREEN}`,
          }}>
            <div style={{ fontSize: '9px', color: '#555', minWidth: '14px', lineHeight: 1.6 }}>
              {i + 1}.
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#ccc', marginBottom: '2px' }}>
                {f.name}
                <span style={{ fontWeight: 400, color: '#555', marginLeft: '6px' }}>
                  {f.score}/100
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#888', lineHeight: 1.4 }}>
                {f[lang] || f.en}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── All 10 factors breakdown ──────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>
          {isTR ? '◈ 10 FAKTÖR DETAYI' : '◈ 10-FACTOR BREAKDOWN'}
        </div>
        {result.factors.map(f => (
          <div key={f.name} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0', borderBottom: '1px solid #1a1a1a',
          }}>
            <div>
              <span style={{ fontSize: '9px', color: '#888', letterSpacing: '0.06em', marginRight: '8px' }}>
                {f.name}
              </span>
              <span style={{ fontSize: '9px', color: '#444' }}>
                {f[lang] || f.en}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{
                width: '60px', height: '4px', background: '#1a1a1a', borderRadius: '2px',
              }}>
                <div style={{
                  width: `${f.score}%`, height: '100%', borderRadius: '2px',
                  background: f.score >= 75 ? GREEN : f.score >= 55 ? AMBER : RED,
                }} />
              </div>
              <span style={{ fontSize: '9px', color: '#888', minWidth: '30px', textAlign: 'right' }}>
                {f.score}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Predicted race times ──────────────────────────────────────────── */}
      {perf.reliable && perf.predictions.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>
            {isTR ? '◈ TAHMİN YARIŞMA SÜRELERİ' : '◈ PREDICTED RACE TIMES'}
          </div>
          <div style={{
            background: 'var(--surface, #0f0f0f)', borderRadius: '3px',
            padding: '10px 14px', marginBottom: '6px',
          }}>
            {perf.predictions.map(p => (
              <div key={p.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '5px 0', borderBottom: '1px solid #1a1a1a',
              }}>
                <span style={{ fontSize: '10px', color: '#888', letterSpacing: '0.06em', minWidth: '72px' }}>
                  {p.label}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ccc', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {p.predicted}
                </span>
                <span style={{ fontSize: '9px', color: '#444' }}>
                  {p.best} – {p.worst}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '9px', color: '#333', marginTop: '4px' }}>
            {perf.method}
            {perf.vdot ? ` · VDOT ${perf.vdot}` : ''}
          </div>
        </div>
      )}

      {/* ── Daniels Training Paces ────────────────────────────────────────── */}
      {perf.reliable && perf.trainingPaces && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>
            {isTR ? '◈ ANTRENMAN TEMPOLAR (Daniels)' : '◈ TRAINING PACES (Daniels)'}
          </div>
          <div style={{ background: 'var(--surface, #0f0f0f)', borderRadius: '3px', padding: '10px 14px' }}>
            {[
              { key: 'easy',      label: isTR ? 'KOLAY'    : 'EASY'      },
              { key: 'marathon',  label: isTR ? 'MARATON'  : 'MARATHON'  },
              { key: 'threshold', label: isTR ? 'EŞİK'     : 'THRESHOLD' },
              { key: 'interval',  label: isTR ? 'İNTERVAL' : 'INTERVAL'  },
              { key: 'rep',       label: 'REP'                             },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ fontSize: '9px', color: '#555', letterSpacing: '0.06em', minWidth: '80px' }}>{label}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#ccc', fontFamily: "'IBM Plex Mono', monospace" }}>{perf.trainingPaces[key]}{isTR ? '/km' : '/km'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Citation ──────────────────────────────────────────────────────── */}
      <div style={{ fontSize: '9px', color: '#333', marginTop: '16px', lineHeight: 1.6 }}>
        ℹ Banister 1991 (PMC) · Coggan 2003 (TSS/CTL/ATL) · Morton 1991 (dose-response)
        {result.daysToRace !== null && ' · Mujika & Padilla 2003 (taper)'}
        {perf.reliable && ' · Riegel 1981 · Daniels 1998 (VDOT)'}
      </div>
    </div>
  )
}
