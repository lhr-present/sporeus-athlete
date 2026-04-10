import { useState, useContext } from 'react'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { LangCtx } from '../contexts/LangCtx.jsx'

const ZONES = [
  { id: 'head',          label: 'Head',          cx: 40,  cy: 20  },
  { id: 'neck',          label: 'Neck',          cx: 40,  cy: 42  },
  { id: 'left_shoulder', label: 'Left Shoulder', cx: 20,  cy: 55  },
  { id: 'right_shoulder',label: 'Right Shoulder',cx: 60,  cy: 55  },
  { id: 'left_elbow',    label: 'Left Elbow',    cx: 14,  cy: 80  },
  { id: 'right_elbow',   label: 'Right Elbow',   cx: 66,  cy: 80  },
  { id: 'left_wrist',    label: 'Left Wrist',    cx: 11,  cy: 102 },
  { id: 'right_wrist',   label: 'Right Wrist',   cx: 69,  cy: 102 },
  { id: 'chest',         label: 'Chest',         cx: 40,  cy: 70  },
  { id: 'upper_back',    label: 'Upper Back',    cx: 40,  cy: 68  },
  { id: 'abdomen',       label: 'Abdomen',       cx: 40,  cy: 95  },
  { id: 'lower_back',    label: 'Lower Back',    cx: 40,  cy: 93  },
  { id: 'left_hip',      label: 'Left Hip',      cx: 27,  cy: 120 },
  { id: 'right_hip',     label: 'Right Hip',     cx: 53,  cy: 120 },
  { id: 'left_knee',     label: 'Left Knee',     cx: 25,  cy: 155 },
  { id: 'right_knee',    label: 'Right Knee',    cx: 55,  cy: 155 },
  { id: 'left_ankle',    label: 'Left Ankle',    cx: 24,  cy: 185 },
  { id: 'right_ankle',   label: 'Right Ankle',   cx: 56,  cy: 185 },
]

const PAIN_TYPES = ['Sharp', 'Dull', 'Stiff', 'Swelling', 'Tingling']

const PAIN_COLORS = ['', '#5bc25b', '#a8c642', '#f5c542', '#ff6600', '#e03030']

function getZoneColor(count) {
  if (count === 0) return '#444'
  if (count <= 2) return '#f5c542'
  return '#e03030'
}

function countRecent(injuries, zoneId) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 14)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return injuries.filter(i => i.zone === zoneId && i.date >= cutoffStr).length
}

export default function InjuryTracker() {
  useContext(LangCtx)
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedZone, setSelectedZone] = useState(null)
  const [form, setForm] = useState({ level: 3, type: 'Sharp', notes: '' })
  const [injuries, setInjuries] = useLocalStorage('sporeus-injuries', [])

  const today = new Date().toISOString().slice(0, 10)

  const activeCount = (() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const zones = new Set(injuries.filter(i => i.date >= cutoffStr).map(i => i.zone))
    return zones.size
  })()

  const saveEntry = () => {
    if (!selectedZone) return
    const entry = {
      id: Date.now(),
      date: today,
      zone: selectedZone.id,
      level: form.level,
      type: form.type,
      notes: form.notes,
    }
    setInjuries([...injuries, entry])
    setSelectedZone(null)
    setForm({ level: 3, type: 'Sharp', notes: '' })
  }

  const deleteEntry = (id) => {
    setInjuries(injuries.filter(i => i.id !== id))
  }

  const recurringZones = ZONES.filter(z => countRecent(injuries, z.id) >= 3)

  const last20 = [...injuries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)

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
        <span>INJURY TRACKER ({activeCount} active)</span>
        <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: '16px' }}>
          {/* SVG Body Map */}
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.08em' }}>
                CLICK ZONE TO LOG INJURY
              </div>
              <svg
                width="180"
                height="280"
                viewBox="-10 0 100 210"
                style={{ background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)', display: 'block' }}
              >
                {/* Silhouette shapes */}
                {/* Head */}
                <ellipse cx="40" cy="18" rx="10" ry="12" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Neck */}
                <rect x="36" y="29" width="8" height="10" rx="2" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Torso */}
                <rect x="22" y="48" width="36" height="52" rx="4" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Left upper arm */}
                <rect x="10" y="50" width="10" height="30" rx="4" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Right upper arm */}
                <rect x="60" y="50" width="10" height="30" rx="4" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Left forearm */}
                <rect x="8" y="82" width="8" height="24" rx="3" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Right forearm */}
                <rect x="64" y="82" width="8" height="24" rx="3" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Hips */}
                <rect x="24" y="100" width="32" height="24" rx="3" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Left thigh */}
                <rect x="22" y="124" width="14" height="32" rx="3" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Right thigh */}
                <rect x="44" y="124" width="14" height="32" rx="3" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Left shin */}
                <rect x="21" y="157" width="12" height="28" rx="3" fill="none" stroke="var(--border)" strokeWidth="1" />
                {/* Right shin */}
                <rect x="47" y="157" width="12" height="28" rx="3" fill="none" stroke="var(--border)" strokeWidth="1" />

                {/* Zone hit targets */}
                {ZONES.map(z => {
                  const cnt = countRecent(injuries, z.id)
                  const col = getZoneColor(cnt)
                  const isSelected = selectedZone && selectedZone.id === z.id
                  return (
                    <g key={z.id} onClick={() => {
                      setSelectedZone(z)
                      setForm({ level: 3, type: 'Sharp', notes: '' })
                    }} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={z.cx} cy={z.cy} r={8}
                        fill={col}
                        fillOpacity={isSelected ? 0.9 : 0.6}
                        stroke={isSelected ? '#ff6600' : col}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                      {cnt > 0 && (
                        <text
                          x={z.cx} y={z.cy + 4}
                          textAnchor="middle"
                          fontSize="7"
                          fontFamily="IBM Plex Mono, monospace"
                          fontWeight="600"
                          fill="#fff"
                          style={{ pointerEvents: 'none' }}
                        >
                          {cnt}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>

              {/* Legend */}
              <div style={{ marginTop: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[['#444', 'None'], ['#f5c542', '1–2'], ['#e03030', '3+']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                    <span style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Inline entry form */}
            {selectedZone && (
              <div style={{ flex: 1, minWidth: '200px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px' }}>
                <div style={{ ...S.mono, fontSize: '12px', fontWeight: 600, color: '#ff6600', marginBottom: '12px', letterSpacing: '0.06em' }}>
                  {selectedZone.label.toUpperCase()}
                </div>

                {/* Pain level */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '0.06em' }}>PAIN LEVEL</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setForm(f => ({ ...f, level: n }))}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: `2px solid ${form.level === n ? PAIN_COLORS[n] : 'var(--border)'}`,
                          background: form.level === n ? PAIN_COLORS[n] : 'transparent',
                          cursor: 'pointer',
                          ...S.mono,
                          fontSize: '11px',
                          fontWeight: 600,
                          color: form.level === n ? '#fff' : PAIN_COLORS[n],
                          transition: 'all 0.15s',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pain type */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '0.06em' }}>PAIN TYPE</div>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    style={{ ...S.select }}
                  >
                    {PAIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '0.06em' }}>NOTES</div>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes..."
                    style={{ ...S.input, fontSize: '12px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={{ ...S.btn, fontSize: '11px', padding: '8px 14px' }} onClick={saveEntry}>SAVE</button>
                  <button style={{ ...S.btnSec, fontSize: '11px', padding: '8px 14px' }} onClick={() => setSelectedZone(null)}>CANCEL</button>
                </div>
              </div>
            )}
          </div>

          {/* Recurring warnings */}
          {recurringZones.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              {recurringZones.map(z => (
                <div key={z.id} style={{ ...S.mono, fontSize: '11px', background: '#f5c54222', border: '1px solid #f5c54244', borderRadius: '4px', padding: '8px 12px', marginBottom: '6px', color: '#f5c542' }}>
                  ⚠ Recurring issue in <strong>{z.label}</strong> — consider rest or professional assessment
                </div>
              ))}
            </div>
          )}

          {/* History toggle */}
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button
              style={{ ...S.btnSec, fontSize: '10px', padding: '6px 12px' }}
              onClick={() => setShowHistory(x => !x)}
            >
              {showHistory ? '▲ HIDE HISTORY' : '▼ SHOW HISTORY'}
            </button>

            {showHistory && (
              <div style={{ marginTop: '12px', overflowX: 'auto' }}>
                {last20.length === 0 ? (
                  <div style={{ ...S.mono, fontSize: '11px', color: 'var(--muted)', padding: '8px 0' }}>No injury entries yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', ...S.mono, fontSize: '11px' }}>
                    <thead>
                      <tr>
                        {['DATE', 'ZONE', 'LEVEL', 'TYPE', 'NOTES', ''].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', borderBottom: '1px solid var(--border)', fontWeight: 600, letterSpacing: '0.06em', fontSize: '10px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {last20.map(entry => {
                        const zone = ZONES.find(z => z.id === entry.zone)
                        return (
                          <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 8px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{entry.date}</td>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{zone ? zone.label : entry.zone}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: PAIN_COLORS[entry.level], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...S.mono, fontSize: '9px', fontWeight: 600, color: '#fff' }}>
                                {entry.level}
                              </div>
                            </td>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{entry.type}</td>
                            <td style={{ padding: '6px 8px', color: 'var(--muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.notes || '—'}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e03030', fontSize: '14px', lineHeight: 1, padding: '0 4px' }}
                              >×</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
