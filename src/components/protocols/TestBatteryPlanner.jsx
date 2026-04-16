// ─── TestBatteryPlanner — test battery scheduling + result entry ──────────────
import { useState } from 'react'
import { S } from '../../styles.js'
import { logger } from '../../lib/logger.js'
import { TEST_BATTERY, deriveMetrics } from '../../lib/sport/testBattery.js'

export default function TestBatteryPlanner() {
  const [batteryOpen, setBatteryOpen] = useState(false)
  const [selectedTests, setSelectedTests] = useState([])
  const [batteryDate, setBatteryDate] = useState(new Date().toISOString().slice(0, 10))
  const [batteryResults, setBatteryResults] = useState({})
  const [batterySaved, setBatterySaved] = useState(false)
  const [batteryMetrics, setBatteryMetrics] = useState({})

  const allSelected = selectedTests.length === TEST_BATTERY.length
  const allResultsEntered = selectedTests.length > 0 && selectedTests.every(id => batteryResults[id] !== undefined && batteryResults[id] !== '')

  const profile = (() => { try { return JSON.parse(localStorage.getItem('sporeus_profile') || '{}') } catch { return {} } })()

  const savePlan = () => {
    try {
      const existing = JSON.parse(localStorage.getItem('sporeus-test-battery') || '[]')
      existing.push({ date: batteryDate, tests: selectedTests })
      localStorage.setItem('sporeus-test-battery', JSON.stringify(existing))
      setBatterySaved(true)
      setTimeout(() => setBatterySaved(false), 3000)
    } catch (e) { logger.warn('localStorage:', e.message) }
  }

  const calculateMetrics = () => {
    const derived = {}
    selectedTests.forEach(id => {
      const raw = parseFloat(batteryResults[id])
      if (!isNaN(raw)) derived[id] = deriveMetrics(id, raw, profile)
    })
    setBatteryMetrics(derived)
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'110ms' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={S.cardTitle}>TEST BATTERY {batteryOpen ? '▾' : '▸'}</div>
        <button onClick={() => setBatteryOpen(o => !o)} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'16px', fontFamily:"'IBM Plex Mono',monospace" }}>
          {batteryOpen ? '▾' : '▸'}
        </button>
      </div>
      {batteryOpen && (
        <div style={{ marginTop:'12px' }}>
          {/* Date picker */}
          <div style={{ marginBottom:'14px' }}>
            <label style={S.label}>TEST DATE</label>
            <input
              type="date"
              value={batteryDate}
              onChange={e => setBatteryDate(e.target.value)}
              style={{ ...S.input, maxWidth:'180px' }}
            />
          </div>

          {/* Test list with checkboxes */}
          <div style={{ marginBottom:'14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.08em' }}>SELECT TESTS FOR THIS BATTERY</div>
              <button
                onClick={() => setSelectedTests(allSelected ? [] : TEST_BATTERY.map(t => t.id))}
                style={{ ...S.mono, fontSize:'9px', padding:'2px 8px', border:'1px solid #ff660044', background:'transparent', color:'#ff6600', borderRadius:'3px', cursor:'pointer' }}>
                {allSelected ? 'DESELECT ALL' : 'SELECT ALL'}
              </button>
            </div>
            {TEST_BATTERY.map(test => {
              const checked = selectedTests.includes(test.id)
              return (
                <div key={test.id} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'8px 0', borderBottom:'1px solid #1a1a1a' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelectedTests(prev => checked ? prev.filter(x => x !== test.id) : [...prev, test.id])}
                    style={{ accentColor:'#ff6600', marginTop:'2px', cursor:'pointer', flexShrink:0 }}
                  />
                  <div style={{ flex:1, fontFamily:"'IBM Plex Mono',monospace" }}>
                    <div style={{ fontSize:'11px', color:'#e0e0e0', fontWeight:600 }}>{test.name}</div>
                    <div style={{ fontSize:'9px', color:'#555', marginTop:'2px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
                      <span>Sport: {test.sport}</span>
                      <span>{test.duration_min} min</span>
                      <span>Equip: {test.equipment.join(', ')}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Save plan button */}
          <div style={{ display:'flex', gap:'8px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
            <button
              onClick={savePlan}
              disabled={selectedTests.length === 0}
              style={{ ...S.btn, fontSize:'10px', opacity: selectedTests.length === 0 ? 0.5 : 1, cursor: selectedTests.length === 0 ? 'not-allowed' : 'pointer' }}>
              ↓ SAVE PLAN
            </button>
            {batterySaved && <span style={{ ...S.mono, fontSize:'10px', color:'#5bc25b' }}>✓ Plan saved</span>}
            {selectedTests.length > 0 && <span style={{ ...S.mono, fontSize:'9px', color:'#555' }}>{selectedTests.length} test{selectedTests.length > 1 ? 's' : ''} selected · est. {TEST_BATTERY.filter(t => selectedTests.includes(t.id)).reduce((s,t) => s + t.duration_min + t.rest_after_min, 0)} min</span>}
          </div>

          {/* Result inputs for selected tests */}
          {selectedTests.length > 0 && (
            <div style={{ marginBottom:'14px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.08em', marginBottom:'10px' }}>ENTER RESULTS</div>
              {selectedTests.map(id => {
                const test = TEST_BATTERY.find(t => t.id === id)
                if (!test) return null
                const measure = test.measures[0]
                return (
                  <div key={id} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', flexWrap:'wrap' }}>
                    <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', flex:'1 1 140px', minWidth:'140px' }}>{test.name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', flex:'0 0 auto' }}>
                      <input
                        type="number"
                        placeholder={measure.replace(/_/g,' ')}
                        value={batteryResults[id] ?? ''}
                        onChange={e => setBatteryResults(prev => ({ ...prev, [id]: e.target.value }))}
                        style={{ ...S.input, maxWidth:'110px', marginBottom:0 }}
                      />
                      <span style={{ ...S.mono, fontSize:'9px', color:'#555' }}>{measure.replace(/_/g,' ')}</span>
                    </div>
                    {batteryMetrics[id] && (
                      <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600', flex:'0 0 auto' }}>
                        → {batteryMetrics[id].metric}: <span style={{ fontWeight:700 }}>{batteryMetrics[id].value}</span> {batteryMetrics[id].unit}
                      </div>
                    )}
                  </div>
                )
              })}
              <button
                onClick={calculateMetrics}
                disabled={!allResultsEntered}
                style={{ ...S.btn, fontSize:'10px', marginTop:'8px', opacity: allResultsEntered ? 1 : 0.5, cursor: allResultsEntered ? 'pointer' : 'not-allowed' }}>
                ▶ CALCULATE METRICS
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
