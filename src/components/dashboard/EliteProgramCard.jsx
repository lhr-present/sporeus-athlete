// ─── dashboard/EliteProgramCard.jsx — Headline 4-field "ready-to-go" UI ─────
// Athlete inputs current PR + target PR + race date + sport → sees full
// periodized scientific yearly program. Two render modes: form / plan.
// Source: buildEliteProgram() — see src/lib/athlete/eliteProgram.js spec.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import {
  buildEliteProgram,
  fmtPaceStr,
  fmtSwimPace,
  MODEL_NAME,
  PHASE_RATIONALE,
  DELOAD_NOTE,
} from '../../lib/athlete/eliteProgram.js'
import { eliteProgramToYearlyWeeks } from '../../lib/athlete/eliteProgramToYearly.js'
import { downloadEliteProgramCSV } from '../../lib/athlete/eliteProgramExport.js'
import { calculatePMC } from '../../lib/trainingLoad.js'
import { announce } from '../../lib/a11y/announcer.js'

const STORAGE_KEY = 'sporeus-eliteProgram'
const START_KEY = 'sporeus-eliteProgramStart'
const YEARLY_PLAN_KEY = 'sporeus-yearly-plan'
const YEARLY_RACES_KEY = 'sporeus-plan-races'

const SPORTS = [
  { k: 'run',       en: 'RUN',  tr: 'KOŞU' },
  { k: 'bike',      en: 'BIKE', tr: 'BİSİKLET' },
  { k: 'swim',      en: 'SWIM', tr: 'YÜZME' },
  { k: 'triathlon', en: 'TRI',  tr: 'TRİ' },
]

const DISTANCES = {
  run:       [{ m: 5000, lbl: '5K' }, { m: 10000, lbl: '10K' }, { m: 15000, lbl: '15K' }, { m: 21097, lbl: '21.1K' }, { m: 42195, lbl: '42.2K' }],
  bike:      [{ m: 20000, lbl: '20K' }, { m: 40000, lbl: '40K' }, { m: 100000, lbl: '100K' }],
  swim:      [{ m: 400, lbl: '400m' }, { m: 800, lbl: '800m' }, { m: 1500, lbl: '1500m' }, { m: 3000, lbl: '3000m' }],
  triathlon: [{ m: 51500, lbl: 'Olympic' }, { m: 113000, lbl: '70.3' }, { m: 226000, lbl: 'Full' }],
}

const BAND_COLOR = { comfortable: '#28a745', realistic: '#0064ff', aggressive: '#ff9500', unrealistic: '#dc3545' }
const BAND_LABEL = {
  comfortable: { en: 'COMFORTABLE', tr: 'RAHAT' },
  realistic:   { en: 'REALISTIC',   tr: 'GERÇEKÇİ' },
  aggressive:  { en: 'AGGRESSIVE',  tr: 'AGRESİF' },
  unrealistic: { en: 'UNREALISTIC', tr: 'GERÇEKDIŞI' },
}
const PHASE_LABEL = {
  Base:  { en: 'BASE',  tr: 'TEMEL' },
  Build: { en: 'BUILD', tr: 'YAPI' },
  Peak:  { en: 'PEAK',  tr: 'ZİRVE' },
  Taper: { en: 'TAPER', tr: 'KÖŞELEME' },
}

function parseMmSs(str) {
  if (!str || typeof str !== 'string') return null
  const m = str.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const h = m[3] != null ? Number(m[1]) : 0
  const min = m[3] != null ? Number(m[2]) : Number(m[1])
  const sec = m[3] != null ? Number(m[3]) : Number(m[2])
  if (sec >= 60) return null
  return h * 3600 + min * 60 + sec
}

function fmtSec(sec) {
  if (sec == null) return '—'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

function dayIntent(intent, isTR) {
  if (!intent) return '—'
  if (typeof intent === 'string') return intent
  return intent[isTR ? 'tr' : 'en'] || intent.en || '—'
}

function zoneSummary(z) {
  if (!z || typeof z !== 'object') return ''
  return ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(k => (Number(z[k]) > 0 ? `${k}:${z[k]}` : '')).filter(Boolean).join(' ')
}

const LBL = { ...S.mono, fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }
const INP = { ...S.mono, fontSize: '12px', padding: '8px 10px', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', width: '100%' }

function FormMode({ isTR, onGenerate, persistedForm, savePersistedForm }) {
  const [sport, setSport] = useState(persistedForm?.sport || 'run')
  const [curD, setCurD] = useState(persistedForm?.currentDist || DISTANCES.run[1].m)
  const [curT, setCurT] = useState(persistedForm?.currentTime || '')
  const [tgtD, setTgtD] = useState(persistedForm?.targetDist || DISTANCES.run[1].m)
  const [tgtT, setTgtT] = useState(persistedForm?.targetTime || '')
  const [date, setDate] = useState(persistedForm?.raceDate || '')
  const opts = DISTANCES[sport] || DISTANCES.run

  function pickSport(k) {
    setSport(k)
    const def = (DISTANCES[k] || DISTANCES.run)[1]?.m ?? (DISTANCES[k] || DISTANCES.run)[0].m
    setCurD(def); setTgtD(def)
  }

  const cs = parseMmSs(curT), ts = parseMmSs(tgtT)
  const ready = sport && cs != null && ts != null && /^\d{4}-\d{2}-\d{2}$/.test(date)

  function submit(e) {
    e.preventDefault()
    if (!ready) return
    savePersistedForm({ sport, currentDist: curD, currentTime: curT, targetDist: tgtD, targetTime: tgtT, raceDate: date })
    onGenerate({
      currentPR: { distanceM: Number(curD), timeSec: cs },
      targetPR:  { distanceM: Number(tgtD), timeSec: ts },
      raceDate: date, sport,
    })
  }

  return (
    <form onSubmit={submit} aria-label={isTR ? 'Elit antrenman programı formu' : 'Elite program form'}>
      <div style={{ ...LBL, marginBottom: '6px' }}>
        {isTR ? 'SPOR' : 'SPORT'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'BRANŞ' : 'DISCIPLINE'}
      </div>
      <div role="group" aria-label={isTR ? 'Spor seçici' : 'Sport selector'} style={{ display: 'flex', gap: '4px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {SPORTS.map(s => {
          const a = s.k === sport
          return (
            <button key={s.k} type="button" onClick={() => pickSport(s.k)} aria-pressed={a}
              style={{ ...S.mono, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', padding: '8px 12px', flex: '1 1 70px', minHeight: '40px', background: a ? '#ff6600' : 'var(--input-bg)', color: a ? '#fff' : 'var(--text)', border: `1px solid ${a ? '#ff6600' : 'var(--input-border)'}`, borderRadius: '4px', cursor: 'pointer' }}>
              {isTR ? s.tr : s.en}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {[
          { lbl: isTR ? 'MEVCUT PR' : 'CURRENT PR', dist: curD, setDist: setCurD, t: curT, setT: setCurT, distAria: isTR ? 'Mevcut PR mesafesi' : 'Current PR distance', tAria: isTR ? 'Mevcut PR süresi (MM:SS)' : 'Current PR time (MM:SS)' },
          { lbl: isTR ? 'HEDEF PR' : 'TARGET PR', dist: tgtD, setDist: setTgtD, t: tgtT, setT: setTgtT, distAria: isTR ? 'Hedef PR mesafesi' : 'Target PR distance', tAria: isTR ? 'Hedef PR süresi (MM:SS)' : 'Target PR time (MM:SS)' },
        ].map(f => (
          <div key={f.lbl} style={{ flex: '1 1 140px', minWidth: '120px' }}>
            <label style={LBL}>{f.lbl}</label>
            <select value={f.dist} onChange={e => f.setDist(Number(e.target.value))} aria-label={f.distAria} style={{ ...INP, marginBottom: '4px' }}>
              {opts.map(o => <option key={o.m} value={o.m}>{o.lbl}</option>)}
            </select>
            <input type="text" inputMode="numeric" placeholder="MM:SS" value={f.t} onChange={e => f.setT(e.target.value)} aria-label={f.tAria} style={INP} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={LBL}>{isTR ? 'YARIŞ TARİHİ' : 'RACE DATE'}</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label={isTR ? 'Yarış tarihi' : 'Race date'} style={INP} />
      </div>

      <button type="submit" disabled={!ready}
        style={{ ...S.mono, fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', padding: '12px 18px', width: '100%', minHeight: '44px', background: ready ? '#ff6600' : '#ff660055', color: '#fff', border: 'none', borderRadius: '4px', cursor: ready ? 'pointer' : 'not-allowed' }}>
        {isTR ? 'OLUŞTUR' : 'GENERATE'}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {isTR ? 'GENERATE' : 'OLUŞTUR'}
      </button>
    </form>
  )
}

function PhaseSplitBar({ phases, isTR }) {
  const total = phases.reduce((a, p) => a + (p.weeks?.length || 0), 0) || 1
  const aria = isTR
    ? `Faz dağılımı: ${phases.map(p => `${PHASE_LABEL[p.phase]?.tr || p.phase} ${p.weeks?.length || 0}h`).join(', ')}`
    : `Phase split: ${phases.map(p => `${PHASE_LABEL[p.phase]?.en || p.phase} ${p.weeks?.length || 0}w`).join(', ')}`
  return (
    <div role="img" aria-label={aria} style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', width: '100%', height: '14px', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {phases.map((p, i) => {
          const w = (p.weeks?.length || 0) / total
          if (w <= 0) return null
          return <div key={i} style={{ flex: `${w} 0 0`, background: p.color || '#888' }} />
        })}
      </div>
      <div style={{ display: 'flex', marginTop: '4px', gap: '6px', flexWrap: 'wrap' }}>
        {phases.map((p, i) => (
          <div key={i} style={{ ...S.mono, fontSize: '9px', color: 'var(--sub, var(--muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span aria-hidden="true" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: p.color || '#888' }} />
            {PHASE_LABEL[p.phase]?.[isTR ? 'tr' : 'en'] || p.phase} · {p.weeks?.length || 0}{isTR ? 'h' : 'w'}
          </div>
        ))}
      </div>
    </div>
  )
}

function WeeklyTSSChart({ weeklyTSS, phases, isTR }) {
  if (!Array.isArray(weeklyTSS) || weeklyTSS.length === 0) return null
  const W = 320, H = 60, PAD = 4
  const max = Math.max(...weeklyTSS, 1)
  const min = Math.min(...weeklyTSS, 0)
  const range = Math.max(max - min, 1)
  const stepX = (W - PAD * 2) / Math.max(weeklyTSS.length - 1, 1)

  const points = weeklyTSS.map((tss, i) => {
    const x = PAD + i * stepX
    const y = H - PAD - ((tss - min) / range) * (H - PAD * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const linePath = 'M ' + points.join(' L ')

  const phaseRects = (Array.isArray(phases) ? phases : []).map(phase => {
    const wks = Array.isArray(phase.weeks) ? phase.weeks : []
    if (wks.length === 0) return null
    const startWeek = Math.min(...wks) - 1
    const endWeek = Math.max(...wks) - 1
    const x = PAD + startWeek * stepX
    const w = (endWeek - startWeek + 1) * stepX
    return { x, w, color: phase.color || '#888' }
  }).filter(Boolean)

  const deloadIndices = []
  weeklyTSS.forEach((tss, i) => {
    if (i === 0 || i === weeklyTSS.length - 1) return
    const prev = weeklyTSS[i - 1]
    const next = weeklyTSS[i + 1]
    if (tss < prev * 0.75 && tss < next * 0.75) deloadIndices.push(i)
  })

  const ariaLabel = isTR
    ? `${weeklyTSS.length} haftalık TSS eğrisi`
    : `${weeklyTSS.length}-week TSS curve`

  return (
    <div style={{ marginTop: '8px', marginBottom: '12px' }}>
      <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: '4px' }}>
        {isTR ? 'HAFTALIK TSS EĞRİSİ' : 'WEEKLY TSS CURVE'}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} style={{ display: 'block', height: '60px' }}>
        {phaseRects.map((r, i) => (
          <rect key={i} x={r.x} y={PAD} width={r.w} height={H - PAD * 2} fill={r.color} opacity="0.15" />
        ))}
        <path d={linePath} fill="none" stroke="#ff6600" strokeWidth="2" />
        {deloadIndices.map(i => {
          const x = PAD + i * stepX
          const y = H - PAD - ((weeklyTSS[i] - min) / range) * (H - PAD * 2)
          return <circle key={i} cx={x} cy={y} r="3" fill="#0064ff" />
        })}
      </svg>
      <div style={{ ...S.mono, fontSize: '8px', color: '#666', marginTop: '2px' }}>
        {isTR ? 'Mavi nokta: deload haftası' : 'Blue dot: deload week'}
      </div>
    </div>
  )
}

function SamplePhase({ phase, days, isTR, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const lbl = PHASE_LABEL[phase]?.[isTR ? 'tr' : 'en'] || phase
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '6px', marginBottom: '4px' }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ ...S.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'left' }}>
        {open ? '▾' : '▸'} {lbl} <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span> {isTR ? 'ÖRNEK HAFTA' : 'SAMPLE WEEK'}
      </button>
      {open && Array.isArray(days) && days.length > 0 ? (
        <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', lineHeight: 1.6, marginTop: '4px' }}>
          {days.map((d, i) => {
            const dur = d.durationMin != null ? d.durationMin : d.duration
            const pace = d.paceTarget != null ? d.paceTarget : d.pace
            const z = zoneSummary(d.zones)
            return (
              <div key={i} style={{ display: 'flex', gap: '6px', borderBottom: '1px dashed var(--border)', padding: '3px 0', flexWrap: 'wrap' }}>
                <span style={{ flex: '0 0 36px', color: 'var(--text)' }}>{d.day || `D${i + 1}`}</span>
                <span style={{ flex: '1 1 90px' }}>{dayIntent(d.intent, isTR)}</span>
                <span style={{ flex: '0 0 56px' }}>{dur != null ? `${dur}${isTR ? 'dk' : 'min'}` : ''}</span>
                {z ? <span style={{ flex: '0 0 90px', fontSize: '9px' }}>{z}</span> : null}
                {pace ? <span style={{ flex: '0 0 70px' }}>{pace}</span> : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

// ── PhysiologyRow (v8.92.0) ──────────────────────────────────────────────────
// Surfaces VDOT/FTP/CSS current → target plus a 5-row pace or zone mini-table
// computed by the orchestrator. Sport-conditional: run/triathlon → paces,
// bike → wattage zones, swim → derived E/M/T/I/R per-100m paces.
function PhysiologyRow({ sport, currentLevel, targetLevel, isTR }) {
  if (!currentLevel || !targetLevel) return null

  const ROW = { display: 'flex', gap: '8px', borderBottom: '1px dashed var(--border)', padding: '3px 0', flexWrap: 'wrap', alignItems: 'baseline' }
  const HEAD = { ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }
  const VAL  = { ...S.mono, fontSize: '11px', color: 'var(--text)' }
  const KEY  = { ...S.mono, fontSize: '10px', color: 'var(--muted)', flex: '0 0 60px', letterSpacing: '0.06em' }

  const aria = isTR ? 'Fizyoloji' : 'Physiology'

  // Helpers
  const curW = { ...VAL, flex: '1 1 80px' }
  const tgtW = { ...VAL, flex: '1 1 80px' }
  const lblTitle = (
    <div style={{ ...HEAD, marginBottom: '4px' }}>
      {isTR ? 'FİZYOLOJİ' : 'PHYSIOLOGY'}
      <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
      {isTR ? 'PHYSIOLOGY' : 'FİZYOLOJİ'}
    </div>
  )

  if (sport === 'run' || sport === 'triathlon') {
    const cv = currentLevel.vdot, tv = targetLevel.vdot
    if (cv == null || tv == null) return null
    const cp = currentLevel.paces, tp = targetLevel.paces
    const rows = ['E', 'M', 'T', 'I', 'R'].map(k => ({
      k,
      cur: cp ? fmtPaceStr(cp[k]) : null,
      tgt: tp ? fmtPaceStr(tp[k]) : null,
    }))
    return (
      <div role="region" aria-label={aria} data-physiology="run" style={{ marginBottom: '12px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}>
        {lblTitle}
        <div style={{ ...ROW, borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '4px' }}>
          <span style={KEY}>VDOT</span>
          <span style={curW}>{cv}</span>
          <span aria-hidden="true" style={{ ...VAL, flex: '0 0 12px' }}>→</span>
          <span style={tgtW}>{tv}</span>
        </div>
        {rows.map(r => (
          <div key={r.k} style={ROW}>
            <span style={KEY}>{r.k}</span>
            <span style={curW}>{r.cur || '—'}</span>
            <span aria-hidden="true" style={{ ...VAL, flex: '0 0 12px' }}>→</span>
            <span style={tgtW}>{r.tgt || '—'}</span>
          </div>
        ))}
      </div>
    )
  }

  if (sport === 'bike') {
    const cf = currentLevel.ftp, tf = targetLevel.ftp
    if (cf == null || tf == null) return null
    // currentLevel.paces holds the cycling zone array (Coggan 1–7); pick Z1..Z5.
    const zones = Array.isArray(currentLevel.paces) ? currentLevel.paces.slice(0, 5) : []
    return (
      <div role="region" aria-label={aria} data-physiology="bike" style={{ marginBottom: '12px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}>
        {lblTitle}
        <div style={{ ...ROW, borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '4px' }}>
          <span style={KEY}>FTP</span>
          <span style={curW}>{cf} W</span>
          <span aria-hidden="true" style={{ ...VAL, flex: '0 0 12px' }}>→</span>
          <span style={tgtW}>{tf} W</span>
        </div>
        {zones.map((z, i) => {
          const lo = z?.minWatts ?? 0
          const hi = z?.maxWatts == null ? '∞' : z.maxWatts
          return (
            <div key={i} style={ROW}>
              <span style={KEY}>Z{z?.id ?? i + 1}</span>
              <span style={{ ...VAL, flex: '1 1 140px' }}>{lo}–{hi} W</span>
              <span style={{ ...VAL, flex: '1 1 80px', color: 'var(--muted)', fontSize: '9px' }}>{z?.name || ''}</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (sport === 'swim') {
    const cc = currentLevel.css, tc = targetLevel.css
    if (cc == null || tc == null) return null
    // Derive E/M/T/I/R from CSS using common multipliers
    // (Threshold ≈ CSS; faster intervals/repetitions; easier endurance/marathon).
    const mult = { E: 1.20, M: 1.08, T: 1.00, I: 0.93, R: 0.88 }
    const rows = ['E', 'M', 'T', 'I', 'R'].map(k => ({
      k,
      cur: fmtSwimPace(cc * mult[k]),
      tgt: fmtSwimPace(tc * mult[k]),
    }))
    return (
      <div role="region" aria-label={aria} data-physiology="swim" style={{ marginBottom: '12px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}>
        {lblTitle}
        <div style={{ ...ROW, borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '4px' }}>
          <span style={KEY}>CSS</span>
          <span style={curW}>{fmtSwimPace(cc) || '—'}</span>
          <span aria-hidden="true" style={{ ...VAL, flex: '0 0 12px' }}>→</span>
          <span style={tgtW}>{fmtSwimPace(tc) || '—'}</span>
        </div>
        {rows.map(r => (
          <div key={r.k} style={ROW}>
            <span style={KEY}>{r.k}</span>
            <span style={curW}>{r.cur || '—'}</span>
            <span aria-hidden="true" style={{ ...VAL, flex: '0 0 12px' }}>→</span>
            <span style={tgtW}>{r.tgt || '—'}</span>
          </div>
        ))}
      </div>
    )
  }

  return null
}

// ── AboutThisModel (v8.92.0) ─────────────────────────────────────────────────
// Collapsible panel exposing the model name, per-phase rationale paragraphs,
// and the deload note. All copy + citations come from eliteProgram.js so the
// lib remains the single source of truth.
function AboutThisModel({ isTR }) {
  const [open, setOpen] = useState(false)
  const lang = isTR ? 'tr' : 'en'
  const phaseLabels = {
    Base:  isTR ? 'TEMEL'  : 'BASE',
    Build: isTR ? 'YAPI'   : 'BUILD',
    Peak:  isTR ? 'ZİRVE'  : 'PEAK',
    Taper: isTR ? 'KÖŞELEME' : 'TAPER',
  }
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '6px', marginBottom: '6px' }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        aria-label={isTR ? 'Bu model hakkında' : 'About this model'}
        style={{ ...S.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'left' }}>
        {open ? '▾' : '▸'} {isTR ? 'MODEL HAKKINDA' : 'ABOUT THIS MODEL'}
        <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
        {isTR ? 'ABOUT THIS MODEL' : 'MODEL HAKKINDA'}
      </button>
      {open ? (
        <div data-about-model-panel style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', lineHeight: 1.6, marginTop: '6px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}>
          <div style={{ ...S.mono, fontSize: '11px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', letterSpacing: '0.04em' }}>
            {MODEL_NAME[lang]}
          </div>
          {['Base', 'Build', 'Peak', 'Taper'].map(p => {
            const r = PHASE_RATIONALE[p]
            if (!r) return null
            return (
              <div key={p} data-phase-rationale={p} style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dashed var(--border)' }}>
                <div style={{ ...S.mono, fontSize: '10px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.06em', marginBottom: '2px' }}>
                  {phaseLabels[p]}
                </div>
                <div style={{ marginBottom: '3px' }}>{r[lang]}</div>
                <div data-cite={r.cite} style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.04em' }}>
                  {isTR ? 'Kaynak' : 'cite'}: {r.cite}
                </div>
              </div>
            )
          })}
          <div data-deload-note style={{ ...S.mono, fontSize: '10px', color: 'var(--text)', paddingTop: '4px' }}>
            {DELOAD_NOTE[lang]}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function EliteProgramCard({ log: _log = [], profile: _profile = {} }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [persisted, setPersisted] = useLocalStorage(STORAGE_KEY, null)
  const [, setStart] = useLocalStorage(START_KEY, null)

  // Derive personalization signal from caller-supplied log+profile so the
  // orchestrator does not silently default everyone to currentCTL=50.
  const derivedProfile = useMemo(() => {
    const out = {}
    try {
      const pmc = calculatePMC(_log || [])
      const last = (Array.isArray(pmc) ? pmc : []).filter(p => !p.isFuture).pop()
      if (last && typeof last.ctl === 'number' && last.ctl > 0) out.currentCTL = last.ctl
    } catch { /* keep defaults */ }
    if (typeof _profile?.weeklyHours === 'number' && _profile.weeklyHours > 0) {
      out.weeklyHours = _profile.weeklyHours
    }
    if (typeof _profile?.trainingDays === 'number' && _profile.trainingDays >= 3) {
      out.trainingDays = _profile.trainingDays
    }
    return out
  }, [_log, _profile?.weeklyHours, _profile?.trainingDays])

  const evaluation = useMemo(() => {
    if (!persisted?.input) return { result: null, rejection: null }
    try {
      const r = buildEliteProgram(persisted.input)
      if (!r) return { result: null, rejection: null }
      if (r._rejected) return { result: null, rejection: r }
      if (!r.feasibility) return { result: null, rejection: null }
      return { result: r, rejection: null }
    } catch {
      return { result: null, rejection: null }
    }
  }, [persisted])
  const result = evaluation.result
  const rejection = evaluation.rejection

  const ariaLabel = isTR ? 'Elit antrenman programı' : 'Elite training program'
  const cardBase = { ...S.card, animationDelay: '440ms', padding: '20px' }
  const titleEN = 'ELITE PROGRAM', titleTR = 'ELİT PROGRAM'

  function handleGenerate(input) {
    const enriched = { ...input, profile: derivedProfile }
    setPersisted({ input: enriched, form: persisted?.form })
    setStart(new Date().toISOString().slice(0, 10))
  }

  function handleReset() {
    const msg = isTR
      ? 'Programı sıfırlamak istediğinden emin misin?'
      : 'Are you sure you want to reset this program?'
    const ok = (typeof window !== 'undefined' && typeof window.confirm === 'function')
      ? window.confirm(msg) : true
    if (!ok) return
    setPersisted(null)
    setStart(null)
  }

  if (!result) {
    const noteText = rejection?.note?.[isTR ? 'tr' : 'en'] || ''
    return (
      <div className="sp-card" role="region" aria-label={ariaLabel}
        style={{ ...cardBase, borderLeft: rejection ? '4px solid #dc3545' : '4px solid #ff6600' }}>
        <div style={S.cardTitle}>{titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}</div>
        {rejection ? (
          <div role="alert" aria-live="polite" data-rejection={rejection.reason || 'rejected'}
            style={{ ...S.mono, fontSize: '11px', fontWeight: 600, color: '#fff', background: '#dc3545', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', lineHeight: 1.5 }}>
            {noteText}
          </div>
        ) : (
          <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub, var(--muted))', lineHeight: 1.6, marginBottom: '12px' }}>
            {isTR ? 'Hedefini gir: program bilime dayalı tüm sezonu çıkarsın.' : 'Enter your target — get a science-based full-season program.'}
          </div>
        )}
        <FormMode
          isTR={isTR}
          onGenerate={handleGenerate}
          persistedForm={persisted?.form}
          savePersistedForm={form => setPersisted({ input: persisted?.input || null, form })}
        />
      </div>
    )
  }

  function applyToCalendar() {
    if (typeof window === 'undefined' || !window.localStorage) return
    const yearly = eliteProgramToYearlyWeeks(
      result,
      new Date().toISOString().slice(0, 10),
      {
        raceDate: persisted.input?.raceDate || null,
        raceName: 'Goal Race',
        raceDistanceM: persisted.input?.targetPR?.distanceM ?? null,
        model: 'traditional',
      },
    )
    if (!yearly) {
      announce(isTR ? 'Plan oluşturulamadı' : 'Plan could not be built')
      return
    }

    // Read existing plan and confirm before overwriting non-empty state.
    let existingRaw = null
    try { existingRaw = window.localStorage.getItem(YEARLY_PLAN_KEY) } catch { existingRaw = null }
    let hasExisting = false
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw)
        hasExisting = !!(parsed && Array.isArray(parsed.weeks) && parsed.weeks.some(w => Number(w?.targetTSS) > 0))
      } catch { hasExisting = false }
    }
    if (hasExisting) {
      const msg = isTR
        ? 'Mevcut yıllık planın üzerine yazılacak. Devam edilsin mi?'
        : 'This will overwrite your existing yearly plan. Continue?'
      const ok = (typeof window.confirm === 'function') ? window.confirm(msg) : true
      if (!ok) return
    }

    try {
      window.localStorage.setItem(YEARLY_PLAN_KEY, JSON.stringify({
        weeks: yearly.weeks,
        model: yearly.model,
        projectedCTL: yearly.projectedCTL,
      }))
      window.localStorage.setItem(YEARLY_RACES_KEY, JSON.stringify(yearly.races || []))
    } catch {
      announce(isTR ? 'Depolama başarısız' : 'Storage failed')
      return
    }
    announce(isTR
      ? 'Plan takvime uygulandı. Görüntülemek için Plan sekmesini aç'
      : 'Plan applied to calendar. Open the Plan tab to view')
  }

  const accent = BAND_COLOR[result.feasibility.band] || '#0064ff'
  const bandLbl = BAND_LABEL[result.feasibility.band]?.[isTR ? 'tr' : 'en'] || (result.feasibility.band || '').toUpperCase()
  const weeksAvail = result.feasibility.weeksAvailable ?? 0
  const weeksNeeded = result.feasibility.weeksNeeded ?? 0
  const deltaPct = result.feasibility.deltaPct ?? 0
  const note = result.feasibility.note?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''
  const curStr = fmtSec(persisted.input?.currentPR?.timeSec)
  const tgtStr = fmtSec(persisted.input?.targetPR?.timeSec)

  return (
    <div className="sp-card" role="region" aria-label={ariaLabel} style={{ ...cardBase, borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          {titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button"
            onClick={() => {
              const ok = downloadEliteProgramCSV(
                result,
                `elite-program-${persisted.input?.sport || 'run'}-${persisted.input?.raceDate || 'plan'}.csv`,
              )
              if (ok) announce(isTR ? 'Dışa aktarma tamamlandı' : 'Export complete')
            }}
            aria-label={isTR ? 'CSV olarak dışa aktar' : 'Export program as CSV'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', minHeight: '32px' }}>
            {isTR ? 'CSV İNDİR' : 'EXPORT CSV'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'EXPORT CSV' : 'CSV İNDİR'}
          </button>
          <button type="button"
            onClick={applyToCalendar}
            aria-label={isTR ? 'Programı yıllık takvime uygula' : 'Apply program to yearly calendar'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: '#0064ff', color: '#fff', border: '1px solid #0064ff', borderRadius: '3px', cursor: 'pointer', minHeight: '32px' }}>
            {isTR ? 'TAKVİME UYGULA' : 'APPLY TO CALENDAR'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'APPLY TO CALENDAR' : 'TAKVİME UYGULA'}
          </button>
          <button type="button" onClick={handleReset}
            aria-label={isTR ? 'Programı sıfırla' : 'Reset program'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', color: '#ff6600', border: '1px solid #ff6600', borderRadius: '3px', cursor: 'pointer', minHeight: '32px' }}>
            {isTR ? 'SIFIRLA' : 'RESET'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'RESET' : 'SIFIRLA'}
          </button>
        </div>
      </div>

      <div aria-live="polite" aria-label={isTR ? `Fizibilite: ${bandLbl}` : `Feasibility: ${bandLbl}`} data-band={result.feasibility.band}
        style={{ display: 'inline-block', ...S.mono, fontSize: '11px', fontWeight: 700, color: '#fff', background: accent, padding: '4px 10px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '4px' }}>
        {bandLbl}
      </div>
      <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', marginBottom: '10px' }}>
        {weeksAvail}{isTR ? 'h' : 'w'} {isTR ? 'mevcut' : 'available'} <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span> {weeksNeeded}{isTR ? 'h' : 'w'} {isTR ? 'gerekli' : 'needed'}
      </div>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ flex: '1 1 120px' }}>
          <div style={{ ...S.mono, fontSize: '15px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{curStr} → {tgtStr}</div>
          <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
            {isTR ? 'MEVCUT → HEDEF' : 'CURRENT → TARGET'}
          </div>
        </div>
        <div style={{ flex: '1 1 80px' }}>
          <div style={{ ...S.mono, fontSize: '22px', fontWeight: 700, color: accent, lineHeight: 1 }}>{Number(deltaPct).toFixed(1)}%</div>
          <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
            IMPROVEMENT<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>İYİLEŞME
          </div>
        </div>
        <div style={{ flex: '1 1 80px' }}>
          <div style={{ ...S.mono, fontSize: '22px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{weeksAvail}</div>
          <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
            WEEKS<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>HAFTA
          </div>
        </div>
      </div>

      <PhysiologyRow
        sport={result.sport}
        currentLevel={result.currentLevel}
        targetLevel={result.targetLevel}
        isTR={isTR}
      />

      {Array.isArray(result.phases) && result.phases.length > 0 ? <PhaseSplitBar phases={result.phases} isTR={isTR} /> : null}
      <WeeklyTSSChart weeklyTSS={result.weeklyTSS} phases={result.phases} isTR={isTR} />

      {result.sampleWeeks ? (
        <div style={{ marginBottom: '10px' }}>
          {['Base', 'Build', 'Peak', 'Taper'].map((p, i) => (
            <SamplePhase key={p} phase={p} days={result.sampleWeeks[p]} isTR={isTR} defaultOpen={i === 0} />
          ))}
        </div>
      ) : null}

      <AboutThisModel isTR={isTR} />

      {note ? <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', marginBottom: '8px', lineHeight: 1.5 }}>{note}</div> : null}
      {recommendation ? (
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.6, paddingLeft: '8px', borderLeft: `2px solid ${accent}`, marginBottom: '8px' }}>
          {recommendation}
        </div>
      ) : null}
      {result.citation ? <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>{result.citation}</div> : null}
    </div>
  )
}
