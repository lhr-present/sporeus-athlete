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
import { criticalSwimSpeed, cssToSecPer100m } from '../../lib/sport/swimming.js'
import { findRecentBest } from '../../lib/athlete/recentBest.js'
import { getPlanLifecycle } from '../../lib/athlete/planLifecycle.js'

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

// v8.95.0 — MM:SS form-input format from a number of seconds.
function fmtMmSs(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0))
  const m = Math.floor(s / 60), r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

// v8.95.0 — Find the bucket label for a given (sport, distanceM).
function bucketLabel(sport, distanceM) {
  const opts = DISTANCES[sport] || []
  const hit = opts.find(o => o.m === distanceM)
  return hit?.lbl || `${distanceM}m`
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

// Wakayoshi 2-TT distance options (per side: short trial + long trial dropdowns)
const SWIM_TT_SHORT = [
  { m: 200, lbl: '200m' },
  { m: 400, lbl: '400m' },
  { m: 800, lbl: '800m' },
]
const SWIM_TT_LONG = [
  { m: 400, lbl: '400m' },
  { m: 800, lbl: '800m' },
  { m: 1500, lbl: '1500m' },
]

function FormMode({ isTR, onGenerate, persistedForm, savePersistedForm, recentBest = null, defaultSport = 'run' }) {
  const initialSport = persistedForm?.sport || defaultSport || 'run'
  const initialDistDefault = (DISTANCES[initialSport] || DISTANCES.run)[1]?.m ?? (DISTANCES[initialSport] || DISTANCES.run)[0].m
  const [sport, setSport] = useState(initialSport)
  const [curD, setCurD] = useState(persistedForm?.currentDist || initialDistDefault)
  const [curT, setCurT] = useState(persistedForm?.currentTime || '')
  const [tgtD, setTgtD] = useState(persistedForm?.targetDist || initialDistDefault)
  const [tgtT, setTgtT] = useState(persistedForm?.targetTime || '')
  const [date, setDate] = useState(persistedForm?.raceDate || '')

  // v8.94.0 — bike: FTP direct watts toggle
  const [bikeFtpDirect, setBikeFtpDirect] = useState(!!persistedForm?.bikeFtpDirect)
  const [curW, setCurW] = useState(persistedForm?.currentWatts || '')
  const [tgtW, setTgtW] = useState(persistedForm?.targetWatts || '')

  // v8.96.0 — general-user toggles: no race date + no target time
  const [noRaceDate, setNoRaceDate] = useState(!!persistedForm?.noRaceDate)
  const initialWeeksOverride = (() => {
    const w = persistedForm?.weeksOverride
    if (w === 12 || w === 16 || w === 24) return w
    return 12
  })()
  const [weeksOverride, setWeeksOverride] = useState(initialWeeksOverride)
  const [noTarget, setNoTarget] = useState(!!persistedForm?.noTarget)

  // v8.94.0 — swim: Wakayoshi 2-TT toggle (4 (D, T) pairs total)
  const [swim2TT, setSwim2TT] = useState(!!persistedForm?.swim2TT)
  const [swCurD1, setSwCurD1] = useState(persistedForm?.swim2TT_curD1 || 200)
  const [swCurT1, setSwCurT1] = useState(persistedForm?.swim2TT_curT1 || '')
  const [swCurD2, setSwCurD2] = useState(persistedForm?.swim2TT_curD2 || 400)
  const [swCurT2, setSwCurT2] = useState(persistedForm?.swim2TT_curT2 || '')
  const [swTgtD1, setSwTgtD1] = useState(persistedForm?.swim2TT_tgtD1 || 200)
  const [swTgtT1, setSwTgtT1] = useState(persistedForm?.swim2TT_tgtT1 || '')
  const [swTgtD2, setSwTgtD2] = useState(persistedForm?.swim2TT_tgtD2 || 400)
  const [swTgtT2, setSwTgtT2] = useState(persistedForm?.swim2TT_tgtT2 || '')

  const opts = DISTANCES[sport] || DISTANCES.run

  function pickSport(k) {
    setSport(k)
    const def = (DISTANCES[k] || DISTANCES.run)[1]?.m ?? (DISTANCES[k] || DISTANCES.run)[0].m
    setCurD(def); setTgtD(def)
    // Reset bike-only toggle when leaving bike
    if (k !== 'bike') setBikeFtpDirect(false)
    // Reset swim-only toggle when leaving swim
    if (k !== 'swim') setSwim2TT(false)
  }

  const cs = parseMmSs(curT), ts = parseMmSs(tgtT)
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)

  // Compute readiness + Wakayoshi-derived swim payload (when 2-TT mode)
  const isBikeFtp = sport === 'bike' && bikeFtpDirect
  const isSwim2TT = sport === 'swim' && swim2TT

  const curWattsN = isBikeFtp ? parseInt(curW, 10) : NaN
  const tgtWattsN = isBikeFtp ? parseInt(tgtW, 10) : NaN
  const bikeReady = isBikeFtp && Number.isFinite(curWattsN) && curWattsN > 0
    && (noTarget || (Number.isFinite(tgtWattsN) && tgtWattsN > 0))

  let swimCssCur = null, swimCssTgt = null, swimSecPer100mCur = null, swimSecPer100mTgt = null
  if (isSwim2TT) {
    const t1c = parseMmSs(swCurT1), t2c = parseMmSs(swCurT2)
    const t1t = parseMmSs(swTgtT1), t2t = parseMmSs(swTgtT2)
    if (t1c != null && t2c != null) {
      swimCssCur = criticalSwimSpeed(Number(swCurD1), t1c, Number(swCurD2), t2c)
      if (swimCssCur != null) swimSecPer100mCur = cssToSecPer100m(swimCssCur)
    }
    if (t1t != null && t2t != null) {
      swimCssTgt = criticalSwimSpeed(Number(swTgtD1), t1t, Number(swTgtD2), t2t)
      if (swimCssTgt != null) swimSecPer100mTgt = cssToSecPer100m(swimCssTgt)
    }
  }
  const swimReady = isSwim2TT && swimSecPer100mCur != null
    && (noTarget || swimSecPer100mTgt != null)

  // v8.96.0 — horizon ready when raceDate provided OR noRaceDate toggle on
  const horizonReady = noRaceDate || dateOk

  let ready = false
  if (isBikeFtp) ready = bikeReady && horizonReady
  else if (isSwim2TT) ready = swimReady && horizonReady
  else ready = !!sport && cs != null && (noTarget || ts != null) && horizonReady

  function submit(e) {
    e.preventDefault()
    if (!ready) return
    const horizonPayload = noRaceDate
      ? { raceDate: null, weeksOverride: Number(weeksOverride) }
      : { raceDate: date }
    if (isBikeFtp) {
      savePersistedForm({
        sport, raceDate: noRaceDate ? '' : date,
        noRaceDate, weeksOverride: Number(weeksOverride), noTarget,
        bikeFtpDirect: true,
        currentWatts: String(curWattsN),
        targetWatts: noTarget ? '' : String(tgtWattsN),
        // keep existing TT keys preserved if user toggles off later
        currentDist: curD, currentTime: curT, targetDist: tgtD, targetTime: tgtT,
      })
      onGenerate({
        currentPR: { distanceM: 0, timeSec: curWattsN },
        targetPR:  noTarget ? null : { distanceM: 0, timeSec: tgtWattsN },
        sport,
        noTarget,
        ...horizonPayload,
      })
      return
    }
    if (isSwim2TT) {
      savePersistedForm({
        sport, raceDate: noRaceDate ? '' : date,
        noRaceDate, weeksOverride: Number(weeksOverride), noTarget,
        swim2TT: true,
        swim2TT_curD1: swCurD1, swim2TT_curT1: swCurT1,
        swim2TT_curD2: swCurD2, swim2TT_curT2: swCurT2,
        swim2TT_tgtD1: swTgtD1, swim2TT_tgtT1: swTgtT1,
        swim2TT_tgtD2: swTgtD2, swim2TT_tgtT2: swTgtT2,
        currentDist: curD, currentTime: curT, targetDist: tgtD, targetTime: tgtT,
      })
      // Synthesize a single-TT payload that the lib's tPaceFromTT(200, X) → X/2
      // path reproduces the exact CSS we computed via Wakayoshi.
      const synthCurT = swimSecPer100mCur * 2
      const synthTgtT = noTarget ? null : (swimSecPer100mTgt * 2)
      onGenerate({
        currentPR: { distanceM: 200, timeSec: synthCurT },
        targetPR:  noTarget ? null : { distanceM: 200, timeSec: synthTgtT },
        sport,
        noTarget,
        ...horizonPayload,
      })
      return
    }
    savePersistedForm({
      sport,
      currentDist: curD, currentTime: curT, targetDist: tgtD, targetTime: tgtT,
      raceDate: noRaceDate ? '' : date,
      noRaceDate, weeksOverride: Number(weeksOverride), noTarget,
      bikeFtpDirect: false, swim2TT: false,
    })
    onGenerate({
      currentPR: { distanceM: Number(curD), timeSec: cs },
      targetPR:  noTarget ? null : { distanceM: Number(tgtD), timeSec: ts },
      sport,
      noTarget,
      ...horizonPayload,
    })
  }

  const checkboxRowStyle = { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input-bg)' }

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

      {sport === 'bike' ? (
        <label style={checkboxRowStyle} data-toggle="bike-ftp-direct">
          <input type="checkbox" checked={bikeFtpDirect} onChange={e => setBikeFtpDirect(e.target.checked)}
            aria-label={isTR ? 'FTP doğrudan watt girişi' : 'FTP direct watts entry'}
            style={{ marginTop: '2px' }} />
          <span style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              {isTR ? 'FTP DOĞRUDAN' : 'FTP DIRECT'}
              <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
              {isTR ? 'FTP DIRECT' : 'FTP DOĞRUDAN'}
            </span>
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
              {isTR ? "FTP'yi watt cinsinden gir, TT sonucu yerine" : 'Enter your FTP in watts instead of a TT result'}
            </span>
          </span>
        </label>
      ) : null}

      {sport === 'swim' ? (
        <label style={checkboxRowStyle} data-toggle="swim-2tt">
          <input type="checkbox" checked={swim2TT} onChange={e => setSwim2TT(e.target.checked)}
            aria-label={isTR ? 'Wakayoshi 2-TT modu' : 'Wakayoshi 2-TT mode'}
            style={{ marginTop: '2px' }} />
          <span style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              {isTR ? 'WAKAYOSHI 2-TT' : 'WAKAYOSHI 2-TT'}
              <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
              {isTR ? 'WAKAYOSHI 2-TT' : 'WAKAYOSHI 2-TT'}
            </span>
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
              {isTR ? 'İki TT daha doğru CSS verir — önerilir' : 'Two time trials produce a more accurate CSS — recommended'}
            </span>
          </span>
        </label>
      ) : null}

      {/* v8.96.0 — NO TARGET TIME toggle (placement above target inputs) */}
      <div style={checkboxRowStyle} data-toggle="no-target">
        <input type="checkbox" checked={noTarget} onChange={e => setNoTarget(e.target.checked)}
          aria-label={isTR ? 'Hedef süre yok seçeneği' : 'General build mode (auto target)'}
          style={{ marginTop: '2px' }} />
        <span aria-hidden="true" style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.4 }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
            {isTR ? 'HEDEF SÜRE YOK' : 'NO TARGET TIME'}
            <span style={{ margin: '0 4px' }}>·</span>
            {isTR ? 'NO TARGET TIME' : 'HEDEF SÜRE YOK'}
          </span>
          <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
            {isTR ? 'Mevcut seviyeden geliştir (otomatik hedef)' : 'Improve from current level (auto-target)'}
          </span>
        </span>
      </div>

      {isBikeFtp ? (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }} data-mode="bike-ftp-direct">
          {[
            { lbl: isTR ? 'MEVCUT FTP' : 'CURRENT FTP', val: curW, setVal: setCurW, aria: isTR ? 'Mevcut FTP (watt)' : 'Current FTP (watts)', isCurrent: true },
            { lbl: isTR ? 'HEDEF FTP' : 'TARGET FTP', val: tgtW, setVal: setTgtW, aria: isTR ? 'Hedef FTP (watt)' : 'Target FTP (watts)', isCurrent: false },
          ].filter(f => !(noTarget && !f.isCurrent)).map(f => (
            <div key={f.lbl} style={{ flex: '1 1 140px', minWidth: '120px' }}>
              <label style={LBL}>{f.lbl}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>W</label>
              <input type="number" inputMode="numeric" min={50} max={600} placeholder="245"
                value={f.val} onChange={e => f.setVal(e.target.value)} aria-label={f.aria} style={INP} />
            </div>
          ))}
        </div>
      ) : isSwim2TT ? (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }} data-mode="swim-2tt">
          {[
            { isCurrent: true,
              lbl: isTR ? 'MEVCUT' : 'CURRENT',
              d1: swCurD1, setD1: setSwCurD1, t1: swCurT1, setT1: setSwCurT1,
              d2: swCurD2, setD2: setSwCurD2, t2: swCurT2, setT2: setSwCurT2,
              aria1d: isTR ? 'Mevcut TT1 mesafesi' : 'Current TT1 distance',
              aria1t: isTR ? 'Mevcut TT1 süresi' : 'Current TT1 time',
              aria2d: isTR ? 'Mevcut TT2 mesafesi' : 'Current TT2 distance',
              aria2t: isTR ? 'Mevcut TT2 süresi' : 'Current TT2 time' },
            { isCurrent: false,
              lbl: isTR ? 'HEDEF' : 'TARGET',
              d1: swTgtD1, setD1: setSwTgtD1, t1: swTgtT1, setT1: setSwTgtT1,
              d2: swTgtD2, setD2: setSwTgtD2, t2: swTgtT2, setT2: setSwTgtT2,
              aria1d: isTR ? 'Hedef TT1 mesafesi' : 'Target TT1 distance',
              aria1t: isTR ? 'Hedef TT1 süresi' : 'Target TT1 time',
              aria2d: isTR ? 'Hedef TT2 mesafesi' : 'Target TT2 distance',
              aria2t: isTR ? 'Hedef TT2 süresi' : 'Target TT2 time' },
          ].filter(f => !(noTarget && !f.isCurrent)).map(f => (
            <div key={f.lbl} style={{ flex: '1 1 140px', minWidth: '120px' }}>
              <label style={LBL}>{f.lbl}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>TT1</label>
              <select value={f.d1} onChange={e => f.setD1(Number(e.target.value))} aria-label={f.aria1d} style={{ ...INP, marginBottom: '4px' }}>
                {SWIM_TT_SHORT.map(o => <option key={o.m} value={o.m}>{o.lbl}</option>)}
              </select>
              <input type="text" inputMode="numeric" placeholder="MM:SS" value={f.t1}
                onChange={e => f.setT1(e.target.value)} aria-label={f.aria1t} style={{ ...INP, marginBottom: '6px' }} />
              <label style={LBL}>{f.lbl}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>TT2</label>
              <select value={f.d2} onChange={e => f.setD2(Number(e.target.value))} aria-label={f.aria2d} style={{ ...INP, marginBottom: '4px' }}>
                {SWIM_TT_LONG.map(o => <option key={o.m} value={o.m}>{o.lbl}</option>)}
              </select>
              <input type="text" inputMode="numeric" placeholder="MM:SS" value={f.t2}
                onChange={e => f.setT2(e.target.value)} aria-label={f.aria2t} style={INP} />
            </div>
          ))}
        </div>
      ) : (
        <>
        {recentBest && recentBest.sport === sport && !curT ? (() => {
          const blbl = bucketLabel(sport, recentBest.distanceM)
          const ts = fmtMmSs(recentBest.timeSec)
          const da = recentBest.daysAgo
          const txtEN = `USE MY RECENT BEST · ${ts} / ${blbl} · ${da} day${da === 1 ? '' : 's'} ago`
          const txtTR = `EN İYİ EFORUMU KULLAN · ${ts} / ${blbl} · ${da} gün önce`
          const aria = isTR
            ? `${txtTR} — günlüğünden otomatik doldur`
            : `${txtEN} — autofill from your training log`
          return (
            <button
              type="button"
              data-recent-best-chip
              aria-label={aria}
              onClick={() => {
                setCurD(recentBest.distanceM)
                setCurT(ts)
                announce(isTR ? 'Günlükten otomatik dolduruldu' : 'Filled from recent log entry')
              }}
              style={{
                ...S.mono,
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '8px 10px',
                marginBottom: '10px',
                width: '100%',
                minHeight: '36px',
                background: 'transparent',
                color: '#ff6600',
                border: '1px dashed #ff660088',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#ff660014'; e.currentTarget.style.borderColor = '#ff6600' }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#ff660088' }}
            >
              {isTR ? txtTR : txtEN}
            </button>
          )
        })() : null}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {[
            { isCurrent: true,  lbl: isTR ? 'MEVCUT PR' : 'CURRENT PR', dist: curD, setDist: setCurD, t: curT, setT: setCurT, distAria: isTR ? 'Mevcut PR mesafesi' : 'Current PR distance', tAria: isTR ? 'Mevcut PR süresi (MM:SS)' : 'Current PR time (MM:SS)' },
            { isCurrent: false, lbl: isTR ? 'HEDEF PR' : 'TARGET PR', dist: tgtD, setDist: setTgtD, t: tgtT, setT: setTgtT, distAria: isTR ? 'Hedef PR mesafesi' : 'Target PR distance', tAria: isTR ? 'Hedef PR süresi (MM:SS)' : 'Target PR time (MM:SS)' },
          ].filter(f => !(noTarget && !f.isCurrent)).map(f => (
            <div key={f.lbl} style={{ flex: '1 1 140px', minWidth: '120px' }}>
              <label style={LBL}>{f.lbl}</label>
              <select value={f.dist} onChange={e => f.setDist(Number(e.target.value))} aria-label={f.distAria} style={{ ...INP, marginBottom: '4px' }}>
                {opts.map(o => <option key={o.m} value={o.m}>{o.lbl}</option>)}
              </select>
              <input type="text" inputMode="numeric" placeholder="MM:SS" value={f.t} onChange={e => f.setT(e.target.value)} aria-label={f.tAria} style={INP} />
            </div>
          ))}
        </div>
        </>
      )}

      {!noRaceDate ? (
        <div style={{ marginBottom: '10px' }}>
          <label style={LBL}>{isTR ? 'YARIŞ TARİHİ' : 'RACE DATE'}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label={isTR ? 'Yarış tarihi' : 'Race date'} style={INP} />
        </div>
      ) : null}

      {/* v8.96.0 — NO RACE DATE toggle (placement: between race date input and submit) */}
      <div style={checkboxRowStyle} data-toggle="no-race-date">
        <input type="checkbox" checked={noRaceDate} onChange={e => setNoRaceDate(e.target.checked)}
          aria-label={isTR ? 'Yarış tarihim yok seçeneği' : 'General build mode (no event)'}
          style={{ marginTop: '2px' }} />
        <span aria-hidden="true" style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.4 }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
            {isTR ? 'YARIŞ TARİHİM YOK' : 'NO RACE DATE'}
            <span style={{ margin: '0 4px' }}>·</span>
            {isTR ? 'NO RACE DATE' : 'YARIŞ TARİHİM YOK'}
          </span>
          <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
            {isTR ? 'Bunun yerine ___ hafta için program' : 'Build for ___ weeks instead'}
          </span>
        </span>
      </div>

      {noRaceDate ? (
        <div role="group" data-weeks-override aria-label={isTR ? 'Hafta sayısı seçici' : 'Weeks selector'}
          style={{ display: 'flex', gap: '4px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {[12, 16, 24].map(n => {
            const a = Number(weeksOverride) === n
            return (
              <button key={n} type="button" onClick={() => setWeeksOverride(n)} aria-pressed={a}
                aria-label={isTR ? `${n} hafta için program` : `Build for ${n} weeks`}
                style={{ ...S.mono, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', padding: '8px 12px', flex: '1 1 70px', minHeight: '40px', background: a ? '#0064ff' : 'var(--input-bg)', color: a ? '#fff' : 'var(--text)', border: `1px solid ${a ? '#0064ff' : 'var(--input-border)'}`, borderRadius: '4px', cursor: 'pointer' }}>
                {n}{isTR ? 'h' : 'w'}
              </button>
            )
          })}
        </div>
      ) : null}

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
          <rect key={i} x={r.x} y={PAD} width={r.w} height={H - PAD * 2} fill={r.color} opacity="0.30" />
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
  const [programStart, setStart] = useLocalStorage(START_KEY, null)
  const [yearlyPlanLs] = useLocalStorage(YEARLY_PLAN_KEY, null)

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

  // v8.95.0 — recent-best autofill chip + sport-default detection.
  const recentBest = useMemo(() => findRecentBest(_log, {
    today: new Date().toISOString().slice(0, 10),
    primarySport: _profile?.primarySport || null,
  }), [_log, _profile?.primarySport])

  const defaultSport = (_profile?.primarySport && _profile.primarySport !== 'triathlon')
    ? _profile.primarySport
    : (recentBest?.sport || _profile?.primarySport || 'run')

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

  // ── v8.97.0 — lifecycle pill (athlete-facing plan-status surface) ─────────
  // Computed unconditionally so hook order remains stable across mode switches.
  const lifecycle = useMemo(() => {
    if (!result) return null
    const programForLifecycle = {
      input: persisted?.input || null,
      feasibility: result.feasibility || null,
      sport: result.sport || null,
      resolvedTargetPR: result.resolvedTargetPR || null,
    }
    const todayIso = new Date().toISOString().slice(0, 10)
    return getPlanLifecycle(programForLifecycle, _log || [], {
      today: todayIso,
      yearlyPlan: yearlyPlanLs,
      programStart,
    })
  }, [result, persisted, _log, yearlyPlanLs, programStart])

  const ariaLabel = isTR ? 'Elit antrenman programı' : 'Elite training program'
  const cardBase = { ...S.card, animationDelay: '440ms', padding: '20px' }
  const titleEN = 'ELITE PROGRAM', titleTR = 'ELİT PROGRAM'

  function handleGenerate(input) {
    const enriched = { ...input, profile: derivedProfile }
    // Read latest form from localStorage rather than React state, since
    // savePersistedForm may have just written within the same event handler.
    let latestForm = persisted?.form
    try {
      const raw = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(STORAGE_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.form) latestForm = parsed.form
      }
    } catch { /* fallback to React state */ }
    setPersisted({ input: enriched, form: latestForm })
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
          recentBest={recentBest}
          defaultSport={defaultSport}
        />
      </div>
    )
  }

  // ── v8.97.0 — SHARE WITH COACH payload (developer-facing API contract) ───
  function shareWithCoach() {
    if (!result) return
    const todayIso = new Date().toISOString().slice(0, 10)
    const distanceM = persisted.input?.targetPR?.distanceM
      ?? result?.resolvedTargetPR?.distanceM
      ?? null
    const targetTimeSec = persisted.input?.targetPR?.timeSec
      ?? result?.resolvedTargetPR?.timeSec
      ?? null
    const payload = {
      v: 1,
      kind: 'sporeus-elite-program-share',
      athleteSnapshot: {
        sport: persisted.input?.sport || result?.sport || null,
        distanceM,
        currentTime: persisted.input?.currentPR?.timeSec ?? null,
        targetTime: targetTimeSec,
        raceDate: persisted.input?.raceDate
          || result?.feasibility?.effectiveRaceDate
          || null,
        weeksAvailable: result.feasibility?.weeksAvailable ?? null,
        weeksNeeded: result.feasibility?.weeksNeeded ?? null,
        feasibilityBand: result.feasibility?.band || null,
      },
      physiology: {
        currentVDOT: result.currentLevel?.vdot ?? null,
        targetVDOT:  result.targetLevel?.vdot ?? null,
        currentFTP:  result.currentLevel?.ftp ?? null,
        targetFTP:   result.targetLevel?.ftp ?? null,
        currentCSS:  result.currentLevel?.css ?? null,
        targetCSS:   result.targetLevel?.css ?? null,
      },
      phases: Array.isArray(result.phases)
        ? result.phases.map(p => ({
            phase: p.phase,
            weeks: Array.isArray(p.weeks) ? p.weeks.length : 0,
          }))
        : [],
      synthetic: result.synthetic || null,
      lifecycle: lifecycle ? {
        state: lifecycle.state,
        percentComplete: lifecycle.percentComplete,
        daysToRace: lifecycle.daysToRace,
      } : null,
      citation: result.citation || null,
      generatedAt: todayIso,
    }
    const json = JSON.stringify(payload, null, 2)
    const successMsg = isTR
      ? 'Plan özeti panoya kopyalandı. Koç mesajına yapıştır.'
      : 'Plan summary copied to clipboard. Paste into your coach messaging.'
    const fallbackMsg = isTR
      ? 'Plan özeti dosya olarak indirildi.'
      : 'Plan summary downloaded as a file.'

    function fallbackDownload() {
      if (typeof document === 'undefined' || typeof URL === 'undefined') return
      try {
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'elite-program-share.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        announce(fallbackMsg)
      } catch {
        announce(isTR ? 'Paylaşım başarısız' : 'Share failed')
      }
    }

    const clip = (typeof navigator !== 'undefined' && navigator.clipboard)
      ? navigator.clipboard
      : null
    if (clip && typeof clip.writeText === 'function') {
      try {
        const p = clip.writeText(json)
        if (p && typeof p.then === 'function') {
          p.then(() => announce(successMsg)).catch(() => fallbackDownload())
        } else {
          announce(successMsg)
        }
      } catch {
        fallbackDownload()
      }
    } else {
      fallbackDownload()
    }
  }

  function applyToCalendar() {
    if (typeof window === 'undefined' || !window.localStorage) return
    const yearly = eliteProgramToYearlyWeeks(
      result,
      new Date().toISOString().slice(0, 10),
      {
        raceDate: persisted.input?.raceDate || null,
        raceName: 'Goal Race',
        raceDistanceM: persisted.input?.targetPR?.distanceM ?? result?.resolvedTargetPR?.distanceM ?? null,
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
  // v8.96.0 — when targetPR was synthesized by the orchestrator, fall back to resolvedTargetPR
  const effectiveTargetPR = persisted.input?.targetPR ?? result?.resolvedTargetPR ?? null
  const tgtStr = fmtSec(effectiveTargetPR?.timeSec)
  const synthetic = result.synthetic || null
  const isGeneralBuild = !!(synthetic && synthetic.targetPR && synthetic.raceDate)
  const generalBuildSuffix = isGeneralBuild
    ? (isTR ? ' · GENEL YAPIM' : ' · GENERAL BUILD')
    : ''

  return (
    <div className="sp-card" role="region" aria-label={ariaLabel} style={{ ...cardBase, borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }} data-general-build={isGeneralBuild ? 'true' : 'false'}>
          {titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}{generalBuildSuffix}
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
          <button type="button"
            data-share-with-coach
            onClick={shareWithCoach}
            aria-label={isTR ? 'Plan özetini koçla paylaş' : 'Share plan summary with coach'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', color: '#0064ff', border: '1px solid #0064ff', borderRadius: '3px', cursor: 'pointer', minHeight: '32px' }}>
            {isTR ? 'KOÇLA PAYLAŞ' : 'SHARE WITH COACH'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'SHARE WITH COACH' : 'KOÇLA PAYLAŞ'}
          </button>
          <button type="button" onClick={handleReset}
            aria-label={isTR ? 'Programı sıfırla' : 'Reset program'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', color: '#ff6600', border: '1px solid #ff6600', borderRadius: '3px', cursor: 'pointer', minHeight: '32px' }}>
            {isTR ? 'SIFIRLA' : 'RESET'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'RESET' : 'SIFIRLA'}
          </button>
        </div>
      </div>

      {lifecycle && lifecycle.reliable ? (() => {
        const lc = lifecycle
        const lcLabel = lc.label?.[isTR ? 'tr' : 'en'] || lc.state.toUpperCase()
        const showPct = lc.percentComplete > 5 && lc.percentComplete < 95
        const ariaLbl = isTR
          ? `Plan durumu: ${lcLabel}`
          : `Plan status: ${lcLabel}`
        return (
          <div role="status" data-lifecycle={lc.state}
            aria-label={ariaLbl}
            style={{ display: 'inline-block', ...S.mono, fontSize: '10px', fontWeight: 700, color: '#fff', background: lc.color, padding: '3px 8px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '6px', marginRight: '6px' }}>
            {lcLabel}{showPct ? ` · ${lc.percentComplete}%` : ''}
          </div>
        )
      })() : null}

      <div aria-live="polite" aria-label={isTR ? `Fizibilite: ${bandLbl}` : `Feasibility: ${bandLbl}`} data-band={result.feasibility.band}
        style={{ display: 'inline-block', ...S.mono, fontSize: '11px', fontWeight: 700, color: '#fff', background: accent, padding: '4px 10px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '4px' }}>
        {bandLbl}
      </div>
      <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', marginBottom: '10px' }}>
        {weeksAvail}{isTR ? 'h' : 'w'} {isTR ? 'mevcut' : 'available'} <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span> {weeksNeeded}{isTR ? 'h' : 'w'} {isTR ? 'gerekli' : 'needed'}
      </div>

      {synthetic ? (() => {
        const parts = []
        if (synthetic.targetPR) parts.push(isTR ? 'hedef otomatik' : 'auto target')
        if (synthetic.raceDate) parts.push(isTR ? 'tarih sentetik' : 'synthetic horizon')
        const detail = parts.length ? ` (${parts.join(', ')})` : ''
        const ariaLabelText = isTR
          ? `Otomatik türetilmiş${detail}`
          : `Auto-derived${detail}`
        return (
          <div data-synthetic-badge
            aria-label={ariaLabelText}
            title={ariaLabelText}
            style={{ display: 'inline-block', ...S.mono, fontSize: '10px', fontWeight: 700, color: '#fff', background: '#9966cc', padding: '3px 8px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '10px', marginRight: '6px' }}>
            {isTR ? 'OTOMATİK TÜRETİLMİŞ' : 'AUTO-DERIVED'}
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            {isTR ? 'AUTO-DERIVED' : 'OTOMATİK TÜRETİLMİŞ'}
          </div>
        )
      })() : null}

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
