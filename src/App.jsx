import { useState, useEffect, useCallback } from 'react'

// ─── Persistent storage helpers ───────────────────────────────────────────────
function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch { return defaultValue }
  })
  const set = useCallback((v) => {
    setValue(v)
    try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
  }, [key])
  return [value, set]
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',      label: 'DASHBOARD',     icon: '◈' },
  { id: 'zones',          label: 'ZONE CALC',     icon: '◉' },
  { id: 'tests',          label: 'PROTOCOLS',     icon: '▲' },
  { id: 'log',            label: 'TRAINING LOG',  icon: '≡' },
  { id: 'periodization',  label: 'MACRO PLAN',    icon: '⊞' },
  { id: 'glossary',       label: 'GLOSSARY',      icon: '◇' },
  { id: 'profile',        label: 'PROFILE',       icon: '○' },
]

const SESSION_TYPES = ['Easy Run','Tempo','Interval','Long Run','Recovery','Strength','Swim','Bike','Race','Test']
const RPE_LABELS = ['','1 — Rest','2 — Very Easy','3 — Easy','4 — Moderate','5 — Somewhat Hard','6 — Hard','7 — Very Hard','8 — Very Very Hard','9 — Near Max','10 — Max']

const ZONE_COLORS = ['#4a90d9','#5bc25b','#f5c542','#f08c00','#e03030']
const ZONE_NAMES  = ['Z1 Recovery','Z2 Aerobic','Z3 Tempo','Z4 Threshold','Z5 VO₂max']

const GLOSSARY_TERMS = [
  { term: 'VO₂max', en: 'Maximum oxygen uptake — the ceiling of aerobic power. Expressed in mL/kg/min. Elite marathoners: 70–85.', tr: 'Maksimum oksijen tüketimi — aerobik gücün tavanı. mL/kg/dk olarak ifade edilir.' },
  { term: 'Lactate Threshold (LT1)', en: 'The exercise intensity at which lactate begins to accumulate above resting levels (~2 mmol/L). Corresponds to the upper boundary of Zone 2.', tr: 'Laktatın dinlenme düzeyinin üzerine çıkmaya başladığı egzersiz yoğunluğu (~2 mmol/L). Z2 sınırı.' },
  { term: 'Lactate Threshold (LT2)', en: 'The maximal lactate steady state (~4 mmol/L). Also called MLSS or "threshold pace." The cornerstone of training zones.', tr: 'Maksimal laktat kararlı durumu (~4 mmol/L). Antrenman zonlarının temel referansı.' },
  { term: 'TSS (Training Stress Score)', en: 'A composite metric of training load. TSS = (duration × IF²) × 100. Easy day: ~50. Hard day: ~100+. Weekly 400–600 = well-trained athlete.', tr: 'Antrenman yük skoru. Kolay gün: ~50. Zor gün: ~100+. Haftalık 400–600 = iyi antrenman.' },
  { term: 'ATL (Acute Training Load)', en: 'Rolling 7-day average of TSS — represents current fatigue. Also called "Fatigue" in Training Peaks.', tr: '7 günlük kayan TSS ortalaması — anlık yorgunluğu temsil eder.' },
  { term: 'CTL (Chronic Training Load)', en: 'Rolling 42-day TSS average — represents fitness. Also called "Fitness." CTL – ATL = Form (TSB).', tr: '42 günlük kayan TSS ortalaması — kondisyonu temsil eder. CTL – ATL = Form.' },
  { term: 'FTP (Functional Threshold Power)', en: 'The highest average power you can sustain for ~60 min. Used to set all cycling training zones. Roughly 95% of 20-min power test.', tr: '~60 dakika sürdürülebilecek maksimal ortalama güç. Bisiklet zon hesabının temeli.' },
  { term: 'EPOC', en: 'Excess Post-Exercise Oxygen Consumption — the elevated metabolism after hard training. Responsible for the "afterburn" effect. Duration: minutes to 24h.', tr: 'Egzersiz sonrası fazla oksijen tüketimi — yoğun antrenmanın ardından artmış metabolizma.' },
  { term: 'Periodization', en: 'The systematic organization of training into phases (base, build, peak, taper) to peak for a target event. Popularized by Tudor Bompa in the 1960s.', tr: 'Antrenmanın hedef yarışa göre dönemlere (baz, gelişme, zirve, azaltma) bölünmesi.' },
  { term: 'Polarized Training', en: '80% of volume at low intensity (Z1–Z2), 20% at high intensity (Z4–Z5). Research shows superior adaptations vs. threshold-heavy training for endurance athletes.', tr: 'Hacmin %80\u2019i düşük yoğunlukta (Z1–Z2), %20si yüksek yoğunlukta. Araştırmalar üstün adaptasyon gösteriyor.' },
  { term: 'Central Governor Theory', en: 'Tim Noakes\' model: the brain acts as a "central governor" limiting exercise before physiological damage, based on sensory feedback. Fatigue is a protective emotion, not purely physical.', tr: 'Tim Noakes modeli: beyin, fizyolojik hasarı önlemek için egzersizi sınırlayan bir merkezi vali gibi davranır.' },
  { term: 'Cardiac Drift', en: 'Progressive rise in HR during prolonged exercise at constant pace due to dehydration and plasma volume shifts. Common after 60+ min. Indicates need for pacing strategy.', tr: 'Uzun süreli egzersizde dehidrasyon nedeniyle sabit tempoda kalp atışının kademeli artması.' },
]

const MACRO_PHASES = [
  { week: 1,  phase: 'Base 1',  focus: 'Aerobic Foundation',  zDist: [60,30,10,0,0],  load: 'Low' },
  { week: 2,  phase: 'Base 1',  focus: 'Aerobic Foundation',  zDist: [60,30,10,0,0],  load: 'Low' },
  { week: 3,  phase: 'Base 2',  focus: 'Aerobic Build',       zDist: [55,30,10,5,0],  load: 'Med' },
  { week: 4,  phase: 'Recovery',focus: 'Deload (–30%)',       zDist: [70,25,5,0,0],   load: 'Low' },
  { week: 5,  phase: 'Build 1', focus: 'Threshold Dev.',      zDist: [55,25,10,8,2],  load: 'Med' },
  { week: 6,  phase: 'Build 1', focus: 'Threshold Dev.',      zDist: [50,25,10,10,5], load: 'High' },
  { week: 7,  phase: 'Build 2', focus: 'VO₂max Stimulus',     zDist: [50,20,10,10,10],load: 'High' },
  { week: 8,  phase: 'Recovery',focus: 'Deload (–30%)',       zDist: [65,25,5,5,0],   load: 'Low' },
  { week: 9,  phase: 'Peak 1',  focus: 'Race-Specific',       zDist: [50,20,10,12,8], load: 'High' },
  { week: 10, phase: 'Peak 1',  focus: 'Race-Specific',       zDist: [48,20,10,12,10],load: 'High' },
  { week: 11, phase: 'Peak 2',  focus: 'Sharpen',             zDist: [52,22,8,10,8],  load: 'Med' },
  { week: 12, phase: 'Taper',   focus: 'Volume –40%',         zDist: [60,25,8,5,2],   load: 'Low' },
  { week: 13, phase: 'Race',    focus: 'Race Week',           zDist: [75,20,3,2,0],   load: 'Low' },
]

const LOAD_COLOR = { Low: '#5bc25b', Med: '#f5c542', High: '#e03030' }

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app: {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    minHeight: '100vh',
    maxWidth: '900px',
    margin: '0 auto',
    paddingTop: '3px',
    position: 'relative',
  },
  topBar: {
    height: '3px',
    background: '#ff6600',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  header: {
    background: '#0a0a0a',
    color: '#fff',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #ff6600',
  },
  headerTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#ff6600',
  },
  headerSub: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '10px',
    color: '#888',
    letterSpacing: '0.08em',
  },
  navWrap: {
    background: '#0a0a0a',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    borderBottom: '2px solid #222',
  },
  nav: {
    display: 'flex',
    minWidth: 'max-content',
  },
  navBtn: (active) => ({
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    padding: '10px 16px',
    border: 'none',
    cursor: 'pointer',
    background: active ? '#ff6600' : 'transparent',
    color: active ? '#fff' : '#888',
    borderBottom: active ? '2px solid #ff6600' : '2px solid transparent',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  }),
  content: {
    padding: '20px',
  },
  card: {
    background: '#f8f8f8',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: '12px',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '8px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  label: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '11px',
    color: '#666',
    marginBottom: '4px',
    display: 'block',
  },
  input: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '14px',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    background: '#fff',
    color: '#1a1a1a',
    transition: 'border-color 0.15s',
  },
  select: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '13px',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    width: '100%',
    boxSizing: 'border-box',
    background: '#fff',
    color: '#1a1a1a',
    cursor: 'pointer',
  },
  btn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    padding: '10px 20px',
    background: '#ff6600',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  btnSecondary: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '12px',
    fontWeight: 600,
    padding: '8px 16px',
    background: 'transparent',
    color: '#ff6600',
    border: '1px solid #ff6600',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  stat: {
    flex: '1 1 120px',
    background: '#0a0a0a',
    borderRadius: '6px',
    padding: '14px',
    textAlign: 'center',
  },
  statVal: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '24px',
    fontWeight: 600,
    color: '#ff6600',
    display: 'block',
  },
  statLbl: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '9px',
    color: '#888',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  zoneBar: (pct, color) => ({
    height: '8px',
    width: `${pct}%`,
    background: color,
    borderRadius: '2px',
    transition: 'width 0.4s ease',
    minWidth: pct > 0 ? '2px' : '0',
  }),
  tag: (color) => ({
    display: 'inline-block',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '3px',
    background: color + '22',
    color: color,
    border: `1px solid ${color}44`,
    letterSpacing: '0.06em',
  }),
  footer: {
    textAlign: 'center',
    padding: '20px',
    borderTop: '1px solid #e0e0e0',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '10px',
    color: '#aaa',
    letterSpacing: '0.06em',
  },
}

// ─── Calculation helpers ────────────────────────────────────────────────────────
function hrZones(maxHR) {
  const pcts = [[0.50,0.60],[0.60,0.70],[0.70,0.80],[0.80,0.90],[0.90,1.00]]
  return pcts.map(([lo,hi], i) => ({
    name: ZONE_NAMES[i],
    low: Math.round(maxHR * lo),
    high: Math.round(maxHR * hi),
    color: ZONE_COLORS[i],
  }))
}

function paceZones(thresholdPaceMin) {
  // thresholdPaceMin in decimal minutes/km
  const factors = [1.30, 1.15, 1.06, 1.00, 0.92]
  return ZONE_NAMES.map((name, i) => {
    const p = thresholdPaceMin * factors[i]
    const mins = Math.floor(p)
    const secs = Math.round((p - mins) * 60)
    return { name, pace: `${mins}:${String(secs).padStart(2,'0')} /km`, color: ZONE_COLORS[i] }
  })
}

function powerZones(ftp) {
  const pcts = [[0.55,0.74],[0.75,0.89],[0.90,1.04],[1.05,1.20],[1.21,1.50]]
  return pcts.map(([lo,hi], i) => ({
    name: ZONE_NAMES[i],
    low: Math.round(ftp * lo),
    high: Math.round(ftp * hi),
    color: ZONE_COLORS[i],
  }))
}

function calcTSS(durationMin, rpe) {
  // Simplified: uses RPE as proxy for IF
  const IF = (rpe / 10) * 1.05
  return Math.round((durationMin / 60) * IF * IF * 100)
}

function cooperVO2(distM) {
  return ((distM - 504.9) / 44.73).toFixed(1)
}

function rampTest(finalWatts) {
  return Math.round(finalWatts * 0.75)
}

// ─── Dashboard Tab ──────────────────────────────────────────────────────────────
function Dashboard({ log, profile }) {
  const last7 = log.slice(-7)
  const totalTSS = last7.reduce((s, e) => s + (e.tss || 0), 0)
  const totalMin = last7.reduce((s, e) => s + (e.duration || 0), 0)
  const avgRPE   = last7.length ? (last7.reduce((s,e) => s+(e.rpe||0),0)/last7.length).toFixed(1) : '—'
  const sessions = last7.length

  const today = new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  const readiness = totalTSS > 600 ? { label: 'FATIGUED', color: '#e03030' }
    : totalTSS > 400 ? { label: 'TRAINED', color: '#f5c542' }
    : { label: 'FRESH', color: '#5bc25b' }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#888', marginBottom: '4px' }}>{today.toUpperCase()}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '20px', fontWeight: 600 }}>
          {profile.name ? `ATHLETE: ${profile.name.toUpperCase()}` : 'ATHLETE DASHBOARD'}
        </div>
      </div>

      {/* Readiness indicator */}
      <div style={{ ...S.card, borderLeft: `4px solid ${readiness.color}`, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={S.cardTitle}>READINESS STATUS</div>
            <span style={S.tag(readiness.color)}>{readiness.label}</span>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#666', marginTop: '6px' }}>
              Based on last 7-day TSS load
            </div>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '40px', fontWeight: 600, color: readiness.color }}>
            {totalTSS}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ ...S.row, marginBottom: '16px' }}>
        {[
          { val: sessions, lbl: 'SESSIONS' },
          { val: `${Math.floor(totalMin/60)}h ${totalMin%60}m`, lbl: 'VOLUME' },
          { val: avgRPE, lbl: 'AVG RPE' },
          { val: totalTSS, lbl: '7-DAY TSS' },
        ].map(({ val, lbl }) => (
          <div key={lbl} style={S.stat}>
            <span style={S.statVal}>{val}</span>
            <span style={S.statLbl}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      <div style={S.card}>
        <div style={S.cardTitle}>RECENT SESSIONS</div>
        {last7.length === 0 ? (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '20px 0' }}>
            No sessions logged yet. Use the Training Log tab.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e0e0', color: '#888' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px 8px 0', fontWeight: 600, fontSize: '10px', letterSpacing: '0.08em' }}>DATE</th>
                <th style={{ textAlign: 'left', padding: '4px 8px 8px 0', fontWeight: 600, fontSize: '10px' }}>TYPE</th>
                <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600, fontSize: '10px' }}>MIN</th>
                <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600, fontSize: '10px' }}>RPE</th>
                <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600, fontSize: '10px' }}>TSS</th>
              </tr>
            </thead>
            <tbody>
              {[...last7].reverse().map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '6px 8px 6px 0', color: '#666' }}>{s.date}</td>
                  <td style={{ padding: '6px 8px 6px 0' }}>{s.type}</td>
                  <td style={{ textAlign: 'right', padding: '6px 0' }}>{s.duration}</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', color: s.rpe >= 8 ? '#e03030' : s.rpe >= 6 ? '#f5c542' : '#5bc25b' }}>{s.rpe}</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', color: '#ff6600', fontWeight: 600 }}>{s.tss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick links */}
      <div style={S.card}>
        <div style={S.cardTitle}>QUICK LINKS</div>
        <div style={S.row}>
          {[
            { label: '→ sporeus.com', href: 'https://sporeus.com' },
            { label: '→ EŞİK Kitabı', href: 'https://sporeus.com/esik/' },
            { label: '→ Hesaplayıcılar', href: 'https://sporeus.com/hesaplayicilar/' },
            { label: '→ THRESHOLD Book', href: 'https://sporeus.com/en/threshold/' },
          ].map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#0064ff', textDecoration: 'none', padding: '6px 0' }}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Zone Calculator Tab ────────────────────────────────────────────────────────
function ZoneCalc() {
  const [mode, setMode] = useState('hr')
  const [maxHR, setMaxHR] = useState('')
  const [ftp, setFtp] = useState('')
  const [thresholdPace, setThresholdPace] = useState('')
  const [age, setAge] = useState('')
  const [zones, setZones] = useState([])

  const calcMaxHR = () => age ? 208 - (0.7 * parseInt(age)) : null

  const calculate = () => {
    if (mode === 'hr') {
      const hr = parseInt(maxHR) || calcMaxHR()
      if (!hr) return
      setZones(hrZones(hr))
    } else if (mode === 'power') {
      const f = parseInt(ftp)
      if (!f) return
      setZones(powerZones(f))
    } else {
      // pace: parse MM:SS
      const [m, s] = thresholdPace.split(':').map(Number)
      if (isNaN(m)) return
      const decimal = m + (s || 0) / 60
      setZones(paceZones(decimal))
    }
  }

  const estHR = age ? Math.round(208 - 0.7 * parseInt(age)) : null

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>ZONE CALCULATOR</div>

        {/* Mode selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { id: 'hr', label: 'HEART RATE' },
            { id: 'power', label: 'POWER (W)' },
            { id: 'pace', label: 'RUN PACE' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => { setMode(id); setZones([]) }}
              style={{ ...S.navBtn(mode === id), borderRadius: '4px', fontSize: '11px' }}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'hr' && (
          <div style={S.row}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={S.label}>MAX HEART RATE (bpm)</label>
              <input style={S.input} type="number" placeholder="e.g. 185" value={maxHR} onChange={e => setMaxHR(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label style={S.label}>AGE (optional — Tanaka formula)</label>
              <input style={S.input} type="number" placeholder="e.g. 32" value={age} onChange={e => setAge(e.target.value)} />
              {estHR && !maxHR && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#888', marginTop: '4px' }}>Est. Max HR: {estHR} bpm</div>}
            </div>
          </div>
        )}

        {mode === 'power' && (
          <div style={{ flex: '1 1 200px' }}>
            <label style={S.label}>FTP (watts)</label>
            <input style={S.input} type="number" placeholder="e.g. 280" value={ftp} onChange={e => setFtp(e.target.value)} />
          </div>
        )}

        {mode === 'pace' && (
          <div style={{ flex: '1 1 200px' }}>
            <label style={S.label}>THRESHOLD PACE (MM:SS /km, e.g. 4:45)</label>
            <input style={S.input} type="text" placeholder="4:45" value={thresholdPace} onChange={e => setThresholdPace(e.target.value)} />
          </div>
        )}

        <button style={{ ...S.btn, marginTop: '16px' }} onClick={calculate}>CALCULATE ZONES</button>
      </div>

      {zones.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>
            TRAINING ZONES — {mode === 'hr' ? 'HEART RATE' : mode === 'power' ? 'POWER' : 'PACE'}
          </div>
          {zones.map((z, i) => (
            <div key={i} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: z.color }}>
                  {z.name}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 600 }}>
                  {z.pace || `${z.low} – ${z.high} ${mode === 'hr' ? 'bpm' : 'W'}`}
                </div>
              </div>
              <div style={{ background: '#e8e8e8', height: '8px', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={S.zoneBar((i + 1) * 20, z.color)} />
              </div>
            </div>
          ))}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#aaa', marginTop: '8px' }}>
            Zones based on Coggan (power), Karvonen (HR), and McMillan (pace) models.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Test Protocols Tab ─────────────────────────────────────────────────────────
function TestProtocols() {
  const [activeTest, setActiveTest] = useState('cooper')
  const [dist, setDist] = useState('')
  const [rampWatts, setRampWatts] = useState('')
  const [beepLevel, setBeepLevel] = useState('')
  const [result, setResult] = useState(null)

  const TESTS = [
    { id: 'cooper',    label: 'COOPER 12-MIN',   sport: 'Run' },
    { id: 'ramp',      label: 'RAMP TEST',        sport: 'Bike' },
    { id: 'beep',      label: 'BEEP TEST',        sport: 'Run' },
    { id: 'conconi',   label: 'CONCONI TEST',     sport: 'Run/Bike' },
    { id: 'lactate',   label: 'BLOOD LACTATE',    sport: 'Lab' },
  ]

  const run = () => {
    setResult(null)
    if (activeTest === 'cooper') {
      const d = parseInt(dist)
      if (!d) return
      const vo2 = cooperVO2(d)
      setResult({ title: 'Cooper Test Result', lines: [
        `Distance: ${d}m`,
        `Estimated VO₂max: ${vo2} mL/kg/min`,
        `Classification: ${vo2 >= 52 ? 'Excellent' : vo2 >= 46 ? 'Good' : vo2 >= 40 ? 'Average' : 'Below Average'}`,
        `Note: Valid only when run at maximum effort on flat surface.`,
      ]})
    } else if (activeTest === 'ramp') {
      const w = parseInt(rampWatts)
      if (!w) return
      const ftp = rampTest(w)
      setResult({ title: 'Ramp Test Result', lines: [
        `Final completed step: ${w}W`,
        `Estimated FTP: ${ftp}W (75% of peak power)`,
        `Estimated VO₂max: ${Math.round(w * 10.8 / 70)} mL/kg/min (assumes 70kg)`,
        `Note: Adjust VO₂max for your actual weight.`,
      ]})
    } else if (activeTest === 'beep') {
      const lvl = parseFloat(beepLevel)
      if (!lvl) return
      const shuttles = Math.floor((lvl - 1) * 8 + (lvl % 1) * 8)
      const vo2 = (lvl * 3.46 + 12.2).toFixed(1)
      setResult({ title: 'Beep Test Result', lines: [
        `Level reached: ${beepLevel}`,
        `Estimated VO₂max: ${vo2} mL/kg/min`,
        `Approx shuttles: ${shuttles}`,
        `Classification: ${vo2 >= 55 ? 'Excellent' : vo2 >= 48 ? 'Good' : vo2 >= 40 ? 'Average' : 'Below Average'}`,
      ]})
    } else if (activeTest === 'conconi') {
      setResult({ title: 'Conconi Test Protocol', lines: [
        `1. Run on track. Start at easy pace (8 km/h).`,
        `2. Increase speed 0.5 km/h every 200m.`,
        `3. Record HR at each stage.`,
        `4. Plot HR vs speed — deflection point = anaerobic threshold.`,
        `5. Threshold HR ≈ HR at deflection; threshold speed = deflection speed.`,
        `Note: Requires HR monitor and calibrated track (400m preferred).`,
      ]})
    } else if (activeTest === 'lactate') {
      setResult({ title: 'Blood Lactate Protocol', lines: [
        `Equipment: lactate analyzer (Lactate Pro, Edge), finger-prick lancets.`,
        `Warm-up: 10 min easy. Resting lactate: <1.5 mmol/L.`,
        `Stages: 5 min each, +0.5 km/h per stage. Sample from earlobe or finger.`,
        `LT1 (aerobic threshold): ~2 mmol/L — first sustained rise above baseline.`,
        `LT2 (anaerobic threshold / MLSS): ~4 mmol/L — last sustainable steady state.`,
        `THRESHOLD training zone: pace/power between LT1 and LT2.`,
        `Reference: EŞİK / THRESHOLD, Chapter 4 — Laktat Fizyolojisi.`,
      ]})
    }
  }

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>SELECT PROTOCOL</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {TESTS.map(t => (
            <button key={t.id}
              onClick={() => { setActiveTest(t.id); setResult(null) }}
              style={{ ...S.navBtn(activeTest === t.id), borderRadius: '4px', fontSize: '10px', flexDirection: 'column', display: 'flex', gap: '2px' }}>
              {t.label}
              <span style={{ fontSize: '9px', color: activeTest === t.id ? '#fff9' : '#666' }}>{t.sport}</span>
            </button>
          ))}
        </div>

        {activeTest === 'cooper' && (
          <>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#555', marginBottom: '12px', lineHeight: 1.8 }}>
              Run as far as possible in <strong>12 minutes</strong> on a flat surface. Measure total distance in meters.
            </div>
            <label style={S.label}>DISTANCE (meters)</label>
            <input style={{ ...S.input, maxWidth: '200px' }} type="number" placeholder="e.g. 3200" value={dist} onChange={e => setDist(e.target.value)} />
          </>
        )}

        {activeTest === 'ramp' && (
          <>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#555', marginBottom: '12px', lineHeight: 1.8 }}>
              Increase power by <strong>25W every 1 minute</strong>. Record the last completed step before failure.
            </div>
            <label style={S.label}>FINAL COMPLETED STEP (watts)</label>
            <input style={{ ...S.input, maxWidth: '200px' }} type="number" placeholder="e.g. 350" value={rampWatts} onChange={e => setRampWatts(e.target.value)} />
          </>
        )}

        {activeTest === 'beep' && (
          <>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#555', marginBottom: '12px', lineHeight: 1.8 }}>
              20m shuttle run test. Run between lines to the beep. Enter highest level achieved (e.g. 11.5).
            </div>
            <label style={S.label}>LEVEL REACHED (e.g. 11.5)</label>
            <input style={{ ...S.input, maxWidth: '200px' }} type="text" placeholder="11.5" value={beepLevel} onChange={e => setBeepLevel(e.target.value)} />
          </>
        )}

        {(activeTest === 'conconi' || activeTest === 'lactate') && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#555', marginBottom: '12px' }}>
            Click below to view the full protocol.
          </div>
        )}

        <button style={{ ...S.btn, marginTop: '16px' }} onClick={run}>
          {activeTest === 'conconi' || activeTest === 'lactate' ? 'VIEW PROTOCOL' : 'CALCULATE'}
        </button>
      </div>

      {result && (
        <div style={{ ...S.card, borderLeft: '4px solid #ff6600' }}>
          <div style={S.cardTitle}>{result.title}</div>
          {result.lines.map((line, i) => (
            <div key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', lineHeight: 1.9, color: i === 0 ? '#1a1a1a' : '#444', borderBottom: i < result.lines.length - 1 ? '1px solid #f0f0f0' : 'none', padding: '4px 0' }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Training Log Tab ───────────────────────────────────────────────────────────
function TrainingLog({ log, setLog }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ date: today, type: 'Easy Run', duration: '', rpe: '5', notes: '' })
  const [tssPreview, setTssPreview] = useState(null)

  const preview = () => {
    if (form.duration && form.rpe) {
      setTssPreview(calcTSS(parseInt(form.duration), parseInt(form.rpe)))
    }
  }

  const add = () => {
    if (!form.duration) return
    const tss = calcTSS(parseInt(form.duration), parseInt(form.rpe))
    setLog([...log, { ...form, duration: parseInt(form.duration), rpe: parseInt(form.rpe), tss }])
    setForm({ date: today, type: 'Easy Run', duration: '', rpe: '5', notes: '' })
    setTssPreview(null)
  }

  const remove = (i) => setLog(log.filter((_, idx) => idx !== i))

  return (
    <div>
      {/* Log form */}
      <div style={S.card}>
        <div style={S.cardTitle}>LOG SESSION</div>
        <div style={S.row}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={S.label}>DATE</label>
            <input style={S.input} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={S.label}>SESSION TYPE</label>
            <select style={S.select} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 110px' }}>
            <label style={S.label}>DURATION (min)</label>
            <input style={S.input} type="number" placeholder="60" value={form.duration}
              onChange={e => { setForm({ ...form, duration: e.target.value }); setTssPreview(null) }} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={S.label}>RPE (1–10)</label>
            <select style={S.select} value={form.rpe}
              onChange={e => { setForm({ ...form, rpe: e.target.value }); setTssPreview(null) }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <option key={n} value={n}>{n} — {RPE_LABELS[n].split('—')[1]?.trim()}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          <label style={S.label}>NOTES (optional)</label>
          <input style={S.input} type="text" placeholder="Felt strong at tempo pace…" value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
          <button style={S.btn} onClick={add}>+ ADD SESSION</button>
          <button style={S.btnSecondary} onClick={preview}>PREVIEW TSS</button>
          {tssPreview !== null && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#ff6600', fontWeight: 600 }}>
              TSS: {tssPreview}
            </span>
          )}
        </div>
      </div>

      {/* Log table */}
      <div style={S.card}>
        <div style={S.cardTitle}>SESSION HISTORY ({log.length} entries)</div>
        {log.length === 0 ? (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '20px' }}>
            No sessions logged yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0', color: '#888', fontSize: '10px', letterSpacing: '0.08em' }}>
                  {['DATE','TYPE','MIN','RPE','TSS','NOTES',''].map(h => (
                    <th key={h} style={{ textAlign: h === '' || h === 'TSS' || h === 'MIN' || h === 'RPE' ? 'right' : 'left', padding: '4px 8px 8px 0', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...log].reverse().map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '7px 8px 7px 0', color: '#666' }}>{s.date}</td>
                    <td style={{ padding: '7px 8px 7px 0' }}>{s.type}</td>
                    <td style={{ textAlign: 'right', padding: '7px 8px 7px 0' }}>{s.duration}</td>
                    <td style={{ textAlign: 'right', padding: '7px 8px 7px 0', color: s.rpe >= 8 ? '#e03030' : s.rpe >= 6 ? '#f5c542' : '#5bc25b' }}>{s.rpe}</td>
                    <td style={{ textAlign: 'right', padding: '7px 8px 7px 0', color: '#ff6600', fontWeight: 600 }}>{s.tss}</td>
                    <td style={{ padding: '7px 8px 7px 0', color: '#888', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.notes}</td>
                    <td style={{ textAlign: 'right', padding: '7px 0' }}>
                      <button onClick={() => remove(log.length - 1 - i)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Periodization Planner Tab ──────────────────────────────────────────────────
function Periodization() {
  const [raceDate, setRaceDate] = useState('')
  const [weeklyHours, setWeeklyHours] = useState('10')

  const hours = parseFloat(weeklyHours) || 10

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>13-WEEK MACROCYCLE PLANNER</div>
        <div style={S.row}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={S.label}>TARGET RACE DATE</label>
            <input style={S.input} type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={S.label}>CURRENT WEEKLY HOURS</label>
            <input style={S.input} type="number" step="0.5" placeholder="10" value={weeklyHours} onChange={e => setWeeklyHours(e.target.value)} />
          </div>
        </div>
        {raceDate && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#888', marginTop: '10px' }}>
            Start date: {new Date(new Date(raceDate) - 13 * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
          </div>
        )}
      </div>

      {/* Zone distribution legend */}
      <div style={S.card}>
        <div style={S.cardTitle}>ZONE DISTRIBUTION LEGEND</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {ZONE_NAMES.map((name, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
              <div style={{ width: '12px', height: '12px', background: ZONE_COLORS[i], borderRadius: '2px' }} />
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Macrocycle table */}
      <div style={S.card}>
        <div style={S.cardTitle}>WEEKLY BREAKDOWN</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0', color: '#888', fontSize: '10px', letterSpacing: '0.06em' }}>
                <th style={{ textAlign: 'left', padding: '4px 12px 8px 0', fontWeight: 600 }}>WK</th>
                <th style={{ textAlign: 'left', padding: '4px 12px 8px 0', fontWeight: 600 }}>PHASE</th>
                <th style={{ textAlign: 'left', padding: '4px 12px 8px 0', fontWeight: 600 }}>FOCUS</th>
                <th style={{ textAlign: 'right', padding: '4px 12px 8px 0', fontWeight: 600 }}>HRS</th>
                <th style={{ textAlign: 'center', padding: '4px 0 8px 0', fontWeight: 600, minWidth: '120px' }}>ZONE DIST</th>
                <th style={{ textAlign: 'center', padding: '4px 0 8px 0', fontWeight: 600 }}>LOAD</th>
              </tr>
            </thead>
            <tbody>
              {MACRO_PHASES.map((row) => {
                const phaseHours = row.load === 'Low' ? hours * 0.7 : row.load === 'Med' ? hours * 1.0 : hours * 1.25
                return (
                  <tr key={row.week} style={{ borderBottom: '1px solid #f0f0f0', background: row.phase === 'Recovery' ? '#fffbf0' : row.phase === 'Race' ? '#fff8f8' : 'transparent' }}>
                    <td style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#ff6600' }}>{row.week}</td>
                    <td style={{ padding: '8px 12px 8px 0' }}>{row.phase}</td>
                    <td style={{ padding: '8px 12px 8px 0', color: '#555' }}>{row.focus}</td>
                    <td style={{ textAlign: 'right', padding: '8px 12px 8px 0', fontWeight: 600 }}>{phaseHours.toFixed(1)}</td>
                    <td style={{ padding: '8px 0', minWidth: '120px' }}>
                      <div style={{ display: 'flex', height: '10px', gap: '1px', borderRadius: '2px', overflow: 'hidden' }}>
                        {row.zDist.map((pct, zi) => pct > 0 && (
                          <div key={zi} style={{ width: `${pct}%`, background: ZONE_COLORS[zi] }} title={`${ZONE_NAMES[zi]}: ${pct}%`} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', fontSize: '9px', color: '#aaa', marginTop: '2px', gap: '4px' }}>
                        {row.zDist.map((pct, zi) => pct > 0 && <span key={zi} style={{ color: ZONE_COLORS[zi] }}>{pct}%</span>)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 0' }}>
                      <span style={S.tag(LOAD_COLOR[row.load])}>{row.load}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#aaa', marginTop: '12px' }}>
          Polarized model: ~80% low intensity (Z1–Z2), ~20% high (Z4–Z5). Based on Seiler & Tønnessen (2009).
        </div>
      </div>
    </div>
  )
}

// ─── Glossary Tab ───────────────────────────────────────────────────────────────
function Glossary() {
  const [q, setQ] = useState('')
  const [lang, setLang] = useState('en')
  const filtered = GLOSSARY_TERMS.filter(t =>
    t.term.toLowerCase().includes(q.toLowerCase()) ||
    t[lang].toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>SPORTS SCIENCE GLOSSARY</div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
          <input style={{ ...S.input, flex: 1 }} type="text" placeholder="Search terms…" value={q} onChange={e => setQ(e.target.value)} />
          <div style={{ display: 'flex', gap: '6px' }}>
            {['en','tr'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ ...S.navBtn(lang === l), borderRadius: '4px', padding: '8px 14px', fontSize: '11px' }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#aaa' }}>
          {filtered.length} / {GLOSSARY_TERMS.length} terms — sourced from EŞİK / THRESHOLD (Hüseyin Akbulut, 2026)
        </div>
      </div>

      {filtered.map((t, i) => (
        <div key={i} style={{ ...S.card, marginBottom: '10px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', fontWeight: 600, color: '#0064ff', marginBottom: '8px' }}>
            {t.term}
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', lineHeight: 1.7, color: '#333' }}>
            {t[lang]}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#aaa', padding: '40px 0' }}>
          No terms match your search.
        </div>
      )}
    </div>
  )
}

// ─── Profile Tab ────────────────────────────────────────────────────────────────
function Profile({ profile, setProfile }) {
  const [local, setLocal] = useState(profile)
  const [saved, setSaved] = useState(false)

  const save = () => {
    setProfile(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const FIELDS = [
    { key: 'name',      label: 'NAME',                  placeholder: 'Athlete name' },
    { key: 'age',       label: 'AGE',                   placeholder: '32',          type: 'number' },
    { key: 'weight',    label: 'WEIGHT (kg)',            placeholder: '70',          type: 'number' },
    { key: 'sport',     label: 'PRIMARY SPORT',         placeholder: 'Running / Triathlon…' },
    { key: 'maxhr',     label: 'MAX HEART RATE (bpm)',   placeholder: '185',         type: 'number' },
    { key: 'ftp',       label: 'FTP (watts)',            placeholder: '280',         type: 'number' },
    { key: 'vo2max',    label: 'VO₂max (mL/kg/min)',    placeholder: '55',          type: 'number' },
    { key: 'threshold', label: 'THRESHOLD PACE (/km)',  placeholder: '4:30' },
    { key: 'goal',      label: 'SEASON GOAL',           placeholder: 'Sub-3h marathon at Istanbul 2026' },
  ]

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>ATHLETE PROFILE</div>
        <div style={S.row}>
          {FIELDS.map(f => (
            <div key={f.key} style={{ flex: '1 1 200px' }}>
              <label style={S.label}>{f.label}</label>
              <input style={S.input} type={f.type || 'text'} placeholder={f.placeholder}
                value={local[f.key] || ''}
                onChange={e => setLocal({ ...local, [f.key]: e.target.value })} />
            </div>
          ))}
        </div>
        <button style={{ ...S.btn, marginTop: '16px' }} onClick={save}>
          {saved ? '✓ SAVED' : 'SAVE PROFILE'}
        </button>
      </div>

      {/* About */}
      <div style={S.card}>
        <div style={S.cardTitle}>ABOUT SPOREUS ATHLETE CONSOLE</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', lineHeight: 1.8, color: '#444' }}>
          <p style={{ marginTop: 0 }}>A Bloomberg Terminal-inspired training tool for endurance athletes. Built on the science behind <strong>EŞİK / THRESHOLD</strong> — Turkey's first comprehensive endurance science book.</p>
          <p>Zones, tests, training load, periodization, and sports science glossary — all offline-capable as a PWA.</p>
          <p style={{ marginBottom: 0 }}>
            Author: <a href="https://sporeus.com/huseyin-akbulut/" target="_blank" rel="noreferrer"
              style={{ color: '#0064ff', textDecoration: 'none', fontWeight: 600 }}>Hüseyin Akbulut</a>{' '}
            — BSc &amp; MSc Sport Science, Marmara University<br />
            <a href="https://sporeus.com" target="_blank" rel="noreferrer" style={{ color: '#0064ff', textDecoration: 'none' }}>sporeus.com</a>
            {' · '}
            <a href="https://sporeus.com/esik/" target="_blank" rel="noreferrer" style={{ color: '#ff6600', textDecoration: 'none' }}>EŞİK Kitabı</a>
          </p>
        </div>
      </div>

      {/* Install PWA hint */}
      <div style={{ ...S.card, background: '#0a0a0a', color: '#fff' }}>
        <div style={{ ...S.cardTitle, color: '#ff6600', borderColor: '#333' }}>INSTALL AS APP</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', lineHeight: 1.8, color: '#ccc' }}>
          <div>📱 <strong style={{ color: '#fff' }}>iOS:</strong> Safari → Share → Add to Home Screen</div>
          <div>🤖 <strong style={{ color: '#fff' }}>Android:</strong> Chrome menu → Install App</div>
          <div>💻 <strong style={{ color: '#fff' }}>Desktop:</strong> Chrome/Edge address bar → Install icon</div>
          <div style={{ marginTop: '8px', color: '#888', fontSize: '10px' }}>Works fully offline once installed.</div>
        </div>
      </div>
    </div>
  )
}

// ─── Root App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [log, setLog] = useLocalStorage('sporeus_log', [])
  const [profile, setProfile] = useLocalStorage('sporeus_profile', {})

  return (
    <div style={S.app}>
      <div style={S.topBar} />

      {/* Header */}
      <header style={S.header}>
        <div>
          <div style={S.headerTitle}>◈ SPOREUS ATHLETE CONSOLE</div>
          <div style={S.headerSub}>BLOOMBERG TERMINAL FOR ENDURANCE ATHLETES</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#888' }}>
            {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#555', letterSpacing: '0.06em' }}>
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav style={S.navWrap}>
        <div style={S.nav}>
          {TABS.map(t => (
            <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main style={S.content}>
        {tab === 'dashboard'     && <Dashboard log={log} profile={profile} />}
        {tab === 'zones'         && <ZoneCalc />}
        {tab === 'tests'         && <TestProtocols />}
        {tab === 'log'           && <TrainingLog log={log} setLog={setLog} />}
        {tab === 'periodization' && <Periodization />}
        {tab === 'glossary'      && <Glossary />}
        {tab === 'profile'       && <Profile profile={profile} setProfile={setProfile} />}
      </main>

      <footer style={S.footer}>
        SPOREUS ATHLETE CONSOLE v1.0 · SPOREUS.COM · EŞİK / THRESHOLD 2026
      </footer>
    </div>
  )
}
