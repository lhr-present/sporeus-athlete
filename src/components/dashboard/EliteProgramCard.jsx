// ─── dashboard/EliteProgramCard.jsx — Headline 4-field "ready-to-go" UI ─────
// Athlete inputs current PR + target PR + race date + sport → sees full
// periodized scientific yearly program. Two render modes: form / plan.
// Source: buildEliteProgram() — see src/lib/athlete/eliteProgram.js spec.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { buildEliteProgram } from '../../lib/athlete/eliteProgram.js'

const STORAGE_KEY = 'sporeus-eliteProgram'

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

function TSSSparkline({ tss }) {
  if (!Array.isArray(tss) || tss.length < 2) return null
  const w = 280, h = 36, pad = 2
  const max = Math.max(...tss, 1)
  const step = (w - pad * 2) / (tss.length - 1)
  const pts = tss.map((v, i) => `${(pad + i * step).toFixed(1)},${(h - pad - (Math.max(0, v) / max) * (h - pad * 2)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="weekly TSS curve" style={{ width: '100%', height: '36px', marginBottom: '12px', display: 'block' }}>
      <polyline points={pts} fill="none" stroke="#ff6600" strokeWidth="1.5" />
    </svg>
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

export default function EliteProgramCard({ log: _log = [], profile: _profile = {} }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [persisted, setPersisted] = useLocalStorage(STORAGE_KEY, null)

  const result = useMemo(() => {
    if (!persisted?.input) return null
    try {
      const r = buildEliteProgram(persisted.input)
      if (!r || r._rejected || !r.feasibility) return null
      return r
    } catch { return null }
  }, [persisted])

  const ariaLabel = isTR ? 'Elit antrenman programı' : 'Elite training program'
  const cardBase = { ...S.card, animationDelay: '440ms', padding: '20px' }
  const titleEN = 'ELITE PROGRAM', titleTR = 'ELİT PROGRAM'

  if (!persisted || !result) {
    return (
      <div className="sp-card" role="region" aria-label={ariaLabel} style={{ ...cardBase, borderLeft: '4px solid #ff6600' }}>
        <div style={S.cardTitle}>{titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}</div>
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub, var(--muted))', lineHeight: 1.6, marginBottom: '12px' }}>
          {isTR ? 'Hedefini gir: program bilime dayalı tüm sezonu çıkarsın.' : 'Enter your target — get a science-based full-season program.'}
        </div>
        <FormMode
          isTR={isTR}
          onGenerate={input => setPersisted({ input, form: persisted?.form })}
          persistedForm={persisted?.form}
          savePersistedForm={form => setPersisted({ input: persisted?.input || null, form })}
        />
      </div>
    )
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
        <button type="button" onClick={() => setPersisted(null)}
          style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', color: '#ff6600', border: '1px solid #ff6600', borderRadius: '3px', cursor: 'pointer', minHeight: '32px' }}>
          {isTR ? 'SIFIRLA' : 'RESET'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'RESET' : 'SIFIRLA'}
        </button>
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

      {Array.isArray(result.phases) && result.phases.length > 0 ? <PhaseSplitBar phases={result.phases} isTR={isTR} /> : null}
      <TSSSparkline tss={result.weeklyTSS} />

      {result.sampleWeeks ? (
        <div style={{ marginBottom: '10px' }}>
          {['Base', 'Build', 'Peak', 'Taper'].map((p, i) => (
            <SamplePhase key={p} phase={p} days={result.sampleWeeks[p]} isTR={isTR} defaultOpen={i === 0} />
          ))}
        </div>
      ) : null}

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
