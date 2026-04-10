import { useState, useEffect, useRef, useContext } from 'react'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { LangCtx } from '../contexts/LangCtx.jsx'

const TABS = ['JOURNAL', 'MANTRAS', 'BREATHING']

const DURATION_OPTIONS = [
  { label: '2 min', seconds: 120 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
]

const PHASES = [
  { label: 'INHALE',  color: '#0064ff', seconds: 4 },
  { label: 'HOLD',    color: '#f5c542', seconds: 4 },
  { label: 'EXHALE',  color: '#5bc25b', seconds: 4 },
  { label: 'HOLD',    color: '#f5c542', seconds: 4 },
]

const CIRCLE_R = 52
const CIRC = 2 * Math.PI * CIRCLE_R

function today() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Journal sub-component ────────────────────────────────────────────────────
function Journal() {
  const [entries, setEntries] = useLocalStorage('sporeus-confidence', [])
  const [text, setText] = useState('')
  const [boost, setBoost] = useState(null)

  const save = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setEntries([...entries, { date: today(), text: trimmed }])
    setText('')
    setBoost(null)
  }

  const del = (idx) => {
    const next = entries.filter((_, i) => i !== idx)
    setEntries(next)
    if (boost && entries[idx] && boost === entries[idx].text) setBoost(null)
  }

  const randomBoost = () => {
    if (entries.length === 0) return
    const pick = entries[Math.floor(Math.random() * entries.length)]
    setBoost(pick.text)
  }

  const last5 = [...entries].slice(-5).reverse()

  return (
    <div>
      <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '0.06em' }}>
        WHAT WENT WELL TODAY?
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What went well today?"
        rows={3}
        style={{ ...S.input, resize: 'vertical', fontSize: '13px', marginBottom: '10px' }}
      />
      <button style={{ ...S.btn, fontSize: '11px', padding: '8px 16px', marginBottom: '16px' }} onClick={save}>
        SAVE
      </button>

      {boost && (
        <div style={{ ...S.mono, fontSize: '16px', fontStyle: 'italic', color: '#ff6600', padding: '12px', background: '#ff660011', border: '1px solid #ff660033', borderRadius: '6px', marginBottom: '14px', lineHeight: 1.5 }}>
          "{boost}"
        </div>
      )}

      {last5.length > 0 && (
        <>
          <button
            style={{ ...S.btnSec, fontSize: '10px', padding: '6px 12px', marginBottom: '14px' }}
            onClick={randomBoost}
          >
            RANDOM BOOST
          </button>
          <div>
            {last5.map((e, i) => {
              const realIdx = entries.length - 1 - i
              return (
                <div
                  key={realIdx}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', gap: '8px' }}
                >
                  <div>
                    <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginBottom: '3px' }}>{e.date}</div>
                    <div style={{ ...S.mono, fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 }}>{e.text}</div>
                  </div>
                  <button
                    onClick={() => del(realIdx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e03030', fontSize: '16px', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                  >×</button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Mantras sub-component ────────────────────────────────────────────────────
function Mantras() {
  const [mantras, setMantras] = useLocalStorage('sporeus-mantras', [])
  const [input, setInput] = useState('')
  const [display, setDisplay] = useState(null)

  const add = () => {
    const trimmed = input.trim()
    if (!trimmed || mantras.includes(trimmed)) return
    setMantras([...mantras, trimmed])
    setInput('')
  }

  const del = (idx) => {
    const next = mantras.filter((_, i) => i !== idx)
    setMantras(next)
    if (display && mantras[idx] === display) setDisplay(null)
  }

  const random = () => {
    if (mantras.length === 0) return
    setDisplay(mantras[Math.floor(Math.random() * mantras.length)])
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Enter a mantra..."
          style={{ ...S.input, fontSize: '13px', flex: 1 }}
        />
        <button style={{ ...S.btn, fontSize: '11px', padding: '8px 14px', whiteSpace: 'nowrap' }} onClick={add}>
          ADD MANTRA
        </button>
      </div>

      {/* Pills */}
      {mantras.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {mantras.map((m, i) => (
            <div
              key={i}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0064ff18', border: '1px solid #0064ff44', borderRadius: '20px', padding: '5px 12px', ...S.mono, fontSize: '12px', color: '#0064ff' }}
            >
              <span>{m}</span>
              <button
                onClick={() => del(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e03030', fontSize: '14px', lineHeight: 1, padding: 0 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {mantras.length > 0 && (
        <button
          style={{ ...S.btnSec, fontSize: '11px', padding: '8px 14px', marginBottom: '14px' }}
          onClick={random}
        >
          RANDOM MANTRA
        </button>
      )}

      {display && (
        <div style={{ textAlign: 'center', padding: '16px', border: '1px solid #0064ff', borderRadius: '8px', background: '#0064ff0a', ...S.mono, fontSize: '20px', fontWeight: 600, color: '#0064ff', lineHeight: 1.4 }}>
          {display}
        </div>
      )}
    </div>
  )
}

// ─── Breathing sub-component ─────────────────────────────────────────────────
function Breathing() {
  const [durationIdx, setDurationIdx] = useState(1) // default 5 min
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [complete, setComplete] = useState(false)
  const intervalRef = useRef(null)

  const totalSeconds = DURATION_OPTIONS[durationIdx].seconds
  const remaining = Math.max(0, totalSeconds - elapsed)
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  // Determine current phase
  const cycleDuration = PHASES.reduce((s, p) => s + p.seconds, 0) // 16s
  const posInCycle = elapsed % cycleDuration
  let phaseIdx = 0
  let cumulative = 0
  for (let i = 0; i < PHASES.length; i++) {
    if (posInCycle < cumulative + PHASES[i].seconds) {
      phaseIdx = i
      break
    }
    cumulative += PHASES[i].seconds
  }
  const phase = PHASES[phaseIdx]
  const posInPhase = posInCycle - cumulative
  const dashOffset = CIRC * (posInPhase / phase.seconds)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(e => {
          const next = e + 1
          if (next >= totalSeconds) {
            clearInterval(intervalRef.current)
            setRunning(false)
            setComplete(true)
            return totalSeconds
          }
          return next
        })
        setPhaseElapsed(pe => pe + 1)
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, totalSeconds])

  const start = () => {
    setElapsed(0)
    setPhaseElapsed(0)
    setComplete(false)
    setRunning(true)
  }

  const stop = () => {
    setRunning(false)
    setElapsed(0)
    setPhaseElapsed(0)
    setComplete(false)
  }

  return (
    <div>
      {/* Duration selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
        {DURATION_OPTIONS.map((opt, i) => (
          <button
            key={i}
            onClick={() => { if (!running) setDurationIdx(i) }}
            style={{
              ...S.mono,
              fontSize: '11px',
              fontWeight: 600,
              padding: '7px 14px',
              border: `1px solid ${durationIdx === i ? '#ff6600' : 'var(--border)'}`,
              borderRadius: '4px',
              background: durationIdx === i ? '#ff6600' : 'transparent',
              color: durationIdx === i ? '#fff' : 'var(--muted)',
              cursor: running ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Circle + phase display */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* Track */}
          <circle cx="60" cy="60" r={CIRCLE_R} fill="none" stroke="var(--border)" strokeWidth="8" />
          {/* Progress arc */}
          <circle
            cx="60" cy="60" r={CIRCLE_R}
            fill="none"
            stroke={running ? phase.color : 'var(--border)'}
            strokeWidth="8"
            strokeDasharray={CIRC}
            strokeDashoffset={running ? dashOffset : 0}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
          />
          {/* Center text */}
          <text
            x="60" y="56"
            textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="12"
            fontWeight="700"
            fill={running ? phase.color : 'var(--muted)'}
          >
            {running ? phase.label : (complete ? 'DONE' : 'READY')}
          </text>
          <text
            x="60" y="72"
            textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="20"
            fontWeight="700"
            fill="var(--text)"
          >
            {mm}:{ss}
          </text>
        </svg>

        {/* Phase label (large) */}
        {running && (
          <div style={{ ...S.mono, fontSize: '18px', fontWeight: 700, color: phase.color, letterSpacing: '0.12em' }}>
            {phase.label}
          </div>
        )}

        {complete && (
          <div style={{ ...S.mono, fontSize: '14px', fontWeight: 600, color: '#5bc25b', letterSpacing: '0.08em' }}>
            Session complete ✓
          </div>
        )}
      </div>

      {/* Start / Stop */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        {!running ? (
          <button style={{ ...S.btn, fontSize: '12px', padding: '10px 24px' }} onClick={start}>
            {complete ? 'RESTART' : 'START'}
          </button>
        ) : (
          <button style={{ ...S.btnSec, fontSize: '12px', padding: '10px 24px' }} onClick={stop}>
            STOP
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function MentalTools() {
  useContext(LangCtx)
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('JOURNAL')

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(x => !x)}
        style={{
          ...S.mono,
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 0,
          color: 'var(--text)',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        <span>MENTAL PERFORMANCE TOOLS</span>
        <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: '16px' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '18px' }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  ...S.mono,
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  padding: '8px 14px',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #ff6600' : '2px solid transparent',
                  background: 'transparent',
                  color: activeTab === tab ? '#ff6600' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  marginBottom: '-1px',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'JOURNAL'   && <Journal />}
          {activeTab === 'MANTRAS'   && <Mantras />}
          {activeTab === 'BREATHING' && <Breathing />}
        </div>
      )}
    </div>
  )
}
