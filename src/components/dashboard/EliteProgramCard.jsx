// ─── dashboard/EliteProgramCard.jsx — Headline 4-field "ready-to-go" UI ─────
// Athlete inputs current PR + target PR + race date + sport → sees full
// periodized scientific yearly program. Two render modes: form / plan.
// Source: buildEliteProgram() — see src/lib/athlete/eliteProgram.js spec.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
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
import BroaderPlanSections from './BroaderPlanSections.jsx'
import { computePlanStaleness } from '../../lib/athlete/eliteProgramStaleness.js'
import CoachEditsBanner, { ATHLETE_EDITS_KEY } from './CoachEditsBanner.jsx'
import { applyCoachEdits } from '../../lib/athlete/coachEditEngine.js'
import { eliteProgramToYearlyWeeks } from '../../lib/athlete/eliteProgramToYearly.js'
import { computePhysiologyGapInsight } from '../../lib/athlete/physiologyGapInsight.js'
import { isCycleGateAvailable } from '../../lib/athlete/cyclePhaseGate.js'
import { buildRaceStrategy, RACE_TYPES } from '../../lib/athlete/raceStrategy.js'
import { downloadEliteProgramCSV } from '../../lib/athlete/eliteProgramExport.js'
import { calculatePMC } from '../../lib/trainingLoad.js'
import { announce } from '../../lib/a11y/announcer.js'
import { criticalSwimSpeed, cssToSecPer100m } from '../../lib/sport/swimming.js'
import { findRecentBest } from '../../lib/athlete/recentBest.js'
import { getPlanLifecycle } from '../../lib/athlete/planLifecycle.js'
import { buildPlanAdherence, buildReprojectionSuggestion } from '../../lib/athlete/planAdherence.js'
import { buildLogEntryFromSession } from '../../lib/athlete/quickLogFromSession.js'
import { getReference } from '../../lib/sport/sportsRecords.js'
import ConfirmModal from '../ui/ConfirmModal.jsx'

const STORAGE_KEY = 'sporeus-eliteProgram'
const START_KEY = 'sporeus-eliteProgramStart'
const YEARLY_PLAN_KEY = 'sporeus-yearly-plan'
const YEARLY_RACES_KEY = 'sporeus-plan-races'

const SPORTS = [
  { k: 'run',       en: 'RUN',    tr: 'KOŞU' },
  { k: 'bike',      en: 'BIKE',   tr: 'BİSİKLET' },
  { k: 'swim',      en: 'SWIM',   tr: 'YÜZME' },
  { k: 'rowing',    en: 'ROWING', tr: 'KÜREK' },
  { k: 'triathlon', en: 'TRI',    tr: 'TRİ' },
]

// v9.50.0 — DISTANCES expanded to cover beginner → world-record range for every
// sport. Keys must match src/lib/sport/sportsRecords.js exactly so the inline
// WR / BEGINNER reference chips can resolve a hit. Rowing added (was absent
// from picker pre-v9.50.0) with full Concept2 erg distance set.
const DISTANCES = {
  run: [
    { m: 1500,   lbl: '1500m' },
    { m: 1609,   lbl: '1 mi' },
    { m: 3000,   lbl: '3K' },
    { m: 5000,   lbl: '5K' },
    { m: 10000,  lbl: '10K' },
    { m: 15000,  lbl: '15K' },
    { m: 16093,  lbl: '10 mi' },
    { m: 21097,  lbl: 'HM' },
    { m: 42195,  lbl: 'M' },
    { m: 50000,  lbl: '50K' },
    { m: 100000, lbl: '100K' },
    { m: 160934, lbl: '100 mi' },
  ],
  bike: [
    { m: 1000,   lbl: 'Kilo TT' },
    { m: 4000,   lbl: '4K IP' },
    { m: 16093,  lbl: '10 mi TT' },
    { m: 20000,  lbl: '20K' },
    { m: 40000,  lbl: '40K TT' },
    { m: 40234,  lbl: '25 mi TT' },
    { m: 100000, lbl: '100K' },
  ],
  swim: [
    { m: 50,    lbl: '50m' },
    { m: 100,   lbl: '100m' },
    { m: 200,   lbl: '200m' },
    { m: 400,   lbl: '400m' },
    { m: 800,   lbl: '800m' },
    { m: 1500,  lbl: '1500m' },
    { m: 3000,  lbl: '3000m' },
    { m: 5000,  lbl: '5K OW' },
    { m: 10000, lbl: '10K OW' },
    { m: 25000, lbl: '25K OW' },
  ],
  rowing: [
    { m: 500,   lbl: '500m' },
    { m: 1000,  lbl: '1K' },
    { m: 2000,  lbl: '2K' },
    { m: 5000,  lbl: '5K' },
    { m: 6000,  lbl: '6K' },
    { m: 10000, lbl: '10K' },
    { m: 21097, lbl: 'HM erg' },
    { m: 42195, lbl: 'M erg' },
  ],
  triathlon: [
    { m: 25750,  lbl: 'Sprint' },
    { m: 51500,  lbl: 'Olympic' },
    { m: 113000, lbl: '70.3' },
    { m: 226000, lbl: 'Full' },
  ],
}

// v9.50.0 — default distance per sport. With the expanded lists, picking
// DISTANCES[sport][1] would land on niche events (1 mi, 4K IP) rather than
// the canonical "default PR" most athletes think in. This keeps the picker
// landing on the iconic distance for each discipline.
const DEFAULT_DISTANCE_M = {
  run:       10000,
  bike:      40000,
  swim:      1500,
  rowing:    2000,
  triathlon: 51500,
}
const defaultDistanceFor = (sport) => DEFAULT_DISTANCE_M[sport]
  ?? (DISTANCES[sport] || DISTANCES.run)[0].m

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

// v9.49.0 — autoFormatMmSs + parseMmSs extracted to src/lib/format/mmss.js so
// the same lenient mobile-friendly parsing reaches every PR/time input across
// Onboarding, ZoneCalc, SportProgramBuilder, etc. The local re-export below
// preserves the v9.19.0 import path for any test still hitting it.
import { parseMmSs as _sharedParseMmSs, autoFormatMmSs as _sharedAutoFormatMmSs } from '../../lib/format/mmss.js'
const parseMmSs = _sharedParseMmSs

// v9.19.0 — moved to src/lib/format/mmss.js in v9.49.0; re-exported here for
// any external consumer that imports `autoFormatMmSs` from this module.
export const autoFormatMmSs = _sharedAutoFormatMmSs

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

// v9.50.0 — Tap-to-fill reference chips for the PR picker. For the currently
// selected (sport, distance), look up the WR + beginner reference times in
// sportsRecords.js and render two chips that fill the time input on click.
// Hidden when no reference exists for the distance (e.g. distanceM === 0
// bike FTP-direct sentinel).
function ReferenceChips({ isTR, sport, distanceM, onPick }) {
  const ref = getReference(sport, distanceM)
  if (!ref) return null
  const begStr = fmtSec(ref.beginner)
  const wrStr = fmtSec(ref.wr)
  const chipBase = {
    ...S.mono,
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '6px 8px',
    flex: '1 1 0',
    minHeight: '32px',
    border: '1px dashed var(--border)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    textAlign: 'center',
  }
  return (
    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }} role="group"
      aria-label={isTR ? 'Referans süre çipleri' : 'Reference time chips'}>
      <button type="button" onClick={() => onPick(begStr)}
        aria-label={isTR ? `Acemi süresini doldur: ${begStr}` : `Fill beginner time: ${begStr}`}
        style={chipBase}
        onMouseOver={e => { e.currentTarget.style.borderColor = '#28a745'; e.currentTarget.style.color = '#28a745' }}
        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
        {isTR ? 'ACEMİ' : 'BEGINNER'} · {begStr}
      </button>
      <button type="button" onClick={() => onPick(wrStr)}
        aria-label={isTR ? `Dünya rekoru süresini doldur: ${wrStr}` : `Fill world-record time: ${wrStr}`}
        style={chipBase}
        onMouseOver={e => { e.currentTarget.style.borderColor = '#ff6600'; e.currentTarget.style.color = '#ff6600' }}
        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
        {isTR ? 'DR' : 'WR'} · {wrStr}
      </button>
    </div>
  )
}

// v9.54.0 — Coggan FTP W/kg category bands per Allen, Coggan, McGregor 2019
// (Training and Racing with a Power Meter, 3rd ed., Ch. 3, pp. 51-54).
// Adult open-category bands; not age-adjusted (masters benchmarked the same).
// Female bands published separately and lower across the board.
function coggsWkgBand(wkg, gender) {
  if (!wkg || wkg <= 0) return null
  const fem = gender === 'female'
  const t = fem
    ? [{ k: 5.0, en: 'World class',  tr: 'Dünya sınıfı' },
       { k: 4.1, en: 'Pro',           tr: 'Pro' },
       { k: 3.5, en: 'Cat 1',         tr: 'Kat 1' },
       { k: 3.0, en: 'Cat 2',         tr: 'Kat 2' },
       { k: 2.5, en: 'Cat 3',         tr: 'Kat 3' },
       { k: 2.1, en: 'Cat 4',         tr: 'Kat 4' },
       { k: 1.6, en: 'Fair',          tr: 'Orta' }]
    : [{ k: 5.6, en: 'World class',  tr: 'Dünya sınıfı' },
       { k: 4.6, en: 'Pro / Cat 1',   tr: 'Pro / Kat 1' },
       { k: 4.0, en: 'Cat 2',         tr: 'Kat 2' },
       { k: 3.4, en: 'Cat 3',         tr: 'Kat 3' },
       { k: 2.9, en: 'Cat 4',         tr: 'Kat 4' },
       { k: 2.4, en: 'Cat 5',         tr: 'Kat 5' },
       { k: 1.9, en: 'Fair',          tr: 'Orta' }]
  const COL = ['#f5c542','#ff6600','#5bc25b','#4a90d9','#888','#888','#888']
  for (let i = 0; i < t.length; i++) {
    if (wkg >= t[i].k) return { ...t[i], color: COL[i] }
  }
  return { en: 'Untrained', tr: 'Antrenmansız', color: '#888' }
}

function FormMode({ isTR, onGenerate, persistedForm, savePersistedForm, recentBest = null, defaultSport = 'run', profile = {} }) {
  const initialSport = persistedForm?.sport || defaultSport || 'run'
  const initialDistDefault = defaultDistanceFor(initialSport)
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
  // v9.54.0 — Starter-estimator toggle. When on, the form hides the current
  // PR inputs and synthesizes currentPR from the BEGINNER reference at the
  // canonical distance (DEFAULT_DISTANCE_M) on submit. Auto-resets when sport
  // changes. Disabled in bike FTP-direct + swim 2-TT branches because those
  // have their own input shapes that don't map to a time-based reference.
  const [noCurrent, setNoCurrent] = useState(!!persistedForm?.noCurrent)

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
    const def = defaultDistanceFor(k)
    setCurD(def); setTgtD(def)
    // Reset bike-only toggle when leaving bike
    if (k !== 'bike') setBikeFtpDirect(false)
    // Reset swim-only toggle when leaving swim
    if (k !== 'swim') setSwim2TT(false)
    // v9.54.0 — Starter estimator: drop on sport change so the user actively
    // re-confirms it for the new sport (a runner who has no 5K but DOES have
    // a 2k erg shouldn't have noCurrent silently persist after switching).
    setNoCurrent(false)
  }

  const cs = parseMmSs(curT), ts = parseMmSs(tgtT)
  const dateFormatOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
  // v9.26.0 — also reject past race dates inline (was: rejected only on
  // generate, leaving user with a dead-end submit). Compare ISO strings —
  // both are YYYY-MM-DD so lexicographic order = chronological order.
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const dateInPast = dateFormatOk && date < todayISO
  const dateOk = dateFormatOk && !dateInPast

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

  // v9.54.0 — Starter estimator override: in standard mode, when noCurrent is
  // on AND the BEGINNER reference exists for the canonical distance, the form
  // is "ready" without an explicit current-time entry — synthesis happens on
  // submit. We only check the canonical distance because pickSport() resets
  // curD to defaultDistanceFor(sport) on every sport change.
  const starterRef = (!isBikeFtp && !isSwim2TT && noCurrent && sport)
    ? getReference(sport, defaultDistanceFor(sport))
    : null
  const starterReady = !!starterRef && (noTarget || ts != null)

  let ready = false
  if (isBikeFtp) ready = bikeReady && horizonReady
  else if (isSwim2TT) ready = swimReady && horizonReady
  else if (starterRef) ready = starterReady && horizonReady
  else ready = !!sport && cs != null && (noTarget || ts != null) && horizonReady

  // v9.26.0 — Disabled-button reason (bilingual). Returns null when ready.
  // Order matches user-perceived form flow: sport → time → target → date.
  const disabledReason = useMemo(() => {
    if (ready) return null
    if (!sport) return { en: 'Select a sport', tr: 'Bir spor seç' }
    if (isBikeFtp) {
      if (!Number.isFinite(curWattsN) || curWattsN <= 0) return { en: 'Enter current FTP (watts)', tr: 'Mevcut FTP gir (watt)' }
      if (!noTarget && (!Number.isFinite(tgtWattsN) || tgtWattsN <= 0)) return { en: 'Enter target FTP or pick "no target"', tr: 'Hedef FTP gir veya "hedef yok" seç' }
    } else if (isSwim2TT) {
      if (swimSecPer100mCur == null) return { en: 'Enter both swim trial times (TT1 + TT2)', tr: 'Her iki yüzme deneme süresini gir (TT1 + TT2)' }
      if (!noTarget && swimSecPer100mTgt == null) return { en: 'Enter target trial times or pick "no target"', tr: 'Hedef deneme sürelerini gir veya "hedef yok" seç' }
    } else {
      // v9.54.0 — When noCurrent is on AND starter ref exists, current time
      // is auto-synthesized — only target / horizon can hold readiness back.
      if (!starterRef && cs == null) return { en: 'Enter current time as MM:SS', tr: 'Mevcut süreyi MM:SS olarak gir' }
      if (!noTarget && ts == null) return { en: 'Enter target time or pick "no target"', tr: 'Hedef süre gir veya "hedef yok" seç' }
    }
    if (!noRaceDate) {
      if (!dateFormatOk) return { en: 'Enter race date (YYYY-MM-DD)', tr: 'Yarış tarihini gir (YYYY-AA-GG)' }
      // dateInPast case: inline alert under the date field already tells
      // the user — no need to duplicate above the submit button.
      if (dateInPast) return null
    }
    return null
  }, [ready, sport, isBikeFtp, isSwim2TT, curWattsN, tgtWattsN, swimSecPer100mCur, swimSecPer100mTgt, cs, ts, noTarget, noRaceDate, dateFormatOk, dateInPast, starterRef])

  // v9.26.0 — Debounced auto-save on any field change. Previously persistence
  // ONLY fired on submit, so users who filled the form, switched tabs to
  // check their watch, then came back lost everything. Now every field
  // change snapshots after 600ms of inactivity. We capture the latest values
  // via a ref so the effect itself doesn't need to depend on every state.
  const latestFormRef = useRef(null)
  latestFormRef.current = {
    sport, raceDate: noRaceDate ? '' : date,
    noRaceDate, weeksOverride: Number(weeksOverride), noTarget, noCurrent,
    bikeFtpDirect: isBikeFtp, swim2TT: isSwim2TT,
    currentDist: curD, currentTime: curT, targetDist: tgtD, targetTime: tgtT,
    currentWatts: curW, targetWatts: tgtW,
    swim2TT_curD1: swCurD1, swim2TT_curT1: swCurT1,
    swim2TT_curD2: swCurD2, swim2TT_curT2: swCurT2,
    swim2TT_tgtD1: swTgtD1, swim2TT_tgtT1: swTgtT1,
    swim2TT_tgtD2: swTgtD2, swim2TT_tgtT2: swTgtT2,
  }
  // Single field-watcher: any non-empty form snapshot fires save after 600ms
  // idle. JSON.stringify of the snapshot is the dependency so React only
  // re-schedules when something actually changed.
  const formSnapshotJSON = JSON.stringify(latestFormRef.current)
  useEffect(() => {
    const id = setTimeout(() => {
      // Only persist if user has entered SOMETHING beyond defaults — avoids
      // stomping a previously-saved form with a blank initial state.
      const snap = latestFormRef.current
      if (!snap) return
      const hasInput = !!(snap.currentTime || snap.targetTime || snap.raceDate
        || snap.currentWatts || snap.targetWatts
        || snap.swim2TT_curT1 || snap.swim2TT_curT2)
      if (!hasInput) return
      savePersistedForm(snap)
    }, 600)
    return () => clearTimeout(id)
  }, [formSnapshotJSON, savePersistedForm])

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
    // v9.54.0 — Starter estimator synthesis. When noCurrent is on, currentPR
    // is filled from the BEGINNER reference at the canonical distance for
    // this sport. The display fields stay empty so the UI doesn't surprise
    // the user with values they didn't type.
    let synthCurD = Number(curD)
    let synthCurT = cs
    if (starterRef) {
      synthCurD = defaultDistanceFor(sport)
      synthCurT = starterRef.beginner
    }
    savePersistedForm({
      sport,
      currentDist: curD, currentTime: curT, targetDist: tgtD, targetTime: tgtT,
      raceDate: noRaceDate ? '' : date,
      noRaceDate, weeksOverride: Number(weeksOverride), noTarget,
      noCurrent,
      bikeFtpDirect: false, swim2TT: false,
    })
    onGenerate({
      currentPR: { distanceM: synthCurD, timeSec: synthCurT },
      targetPR:  noTarget ? null : { distanceM: Number(tgtD), timeSec: ts },
      sport,
      noTarget,
      ...horizonPayload,
    })
  }

  // v9.21.0 — touch target fix per mobile UX audit. Was padding 6x8 (~28px
  // height); Apple HIG min 44pt. Increased to padding 12x10 with minHeight
  // 44 so glove-tap precision works.
  const checkboxRowStyle = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '12px 10px', minHeight: '44px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input-bg)' }

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
              style={{ ...S.mono, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', padding: '8px 12px', flex: '1 1 70px', minHeight: '44px', background: a ? '#ff6600' : 'var(--input-bg)', color: a ? '#fff' : 'var(--text)', border: `1px solid ${a ? '#ff6600' : 'var(--input-border)'}`, borderRadius: '4px', cursor: 'pointer' }}>
              {isTR ? s.tr : s.en}
            </button>
          )
        })}
      </div>

      {/* v9.54.0 — Starter estimator. Available in standard mode only (bike
          FTP-direct + swim 2-TT have their own input shapes). Toggle hides
          current PR inputs; on submit we synthesize currentPR from the
          BEGINNER reference at the canonical distance for this sport. */}
      {!bikeFtpDirect && !swim2TT ? (
        <label style={checkboxRowStyle} data-toggle="no-current">
          <input type="checkbox" checked={noCurrent} onChange={e => setNoCurrent(e.target.checked)}
            aria-label={isTR ? 'Bunu yapmadıysam — acemi referansını otomatik doldur' : "I haven't done this yet — autofill beginner reference"}
            style={{ marginTop: '2px' }} />
          <span aria-hidden="true" style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              {isTR ? 'BUNU YAPMADIYSAM' : "I HAVEN'T DONE THIS YET"}
              <span style={{ margin: '0 4px' }}>·</span>
              {isTR ? "I HAVEN'T DONE THIS YET" : 'BUNU YAPMADIYSAM'}
            </span>
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
              {isTR ? 'Sıfırdan başla — acemi referansından otomatik doldurulur' : 'Start from zero — autofill from beginner reference'}
            </span>
          </span>
        </label>
      ) : null}

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
          ].filter(f => !(noTarget && !f.isCurrent)).map(f => {
            // v9.54.0 — Coggan W/kg live readout when profile.weight is set.
            const weightKg = parseFloat(profile?.weight || 0)
            const watts = parseFloat(f.val || 0)
            const wkg = (weightKg > 0 && watts > 0) ? Math.round((watts / weightKg) * 100) / 100 : null
            const band = wkg ? coggsWkgBand(wkg, profile?.gender) : null
            return (
              <div key={f.lbl} style={{ flex: '1 1 140px', minWidth: '120px' }}>
                <label style={LBL}>{f.lbl}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>W</label>
                <input type="number" inputMode="numeric" min={50} max={600} placeholder="245"
                  value={f.val} onChange={e => f.setVal(e.target.value)} aria-label={f.aria} style={INP} />
                {band ? (
                  <div style={{ ...S.mono, fontSize: '10px', color: band.color, marginTop: '3px', letterSpacing: '0.04em', fontWeight: 600 }}
                    aria-live="polite">
                    {wkg} W/kg · {band[isTR ? 'tr' : 'en']}
                  </div>
                ) : null}
              </div>
            )
          })}
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
                onChange={e => f.setT1(autoFormatMmSs(e.target.value))}
                onBlur={e => f.setT1(autoFormatMmSs(e.target.value, { padOnBlur: true }))}
                aria-label={f.aria1t} style={{ ...INP, marginBottom: '6px' }} />
              <label style={LBL}>{f.lbl}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>TT2</label>
              <select value={f.d2} onChange={e => f.setD2(Number(e.target.value))} aria-label={f.aria2d} style={{ ...INP, marginBottom: '4px' }}>
                {SWIM_TT_LONG.map(o => <option key={o.m} value={o.m}>{o.lbl}</option>)}
              </select>
              <input type="text" inputMode="numeric" placeholder="MM:SS" value={f.t2}
                onChange={e => f.setT2(autoFormatMmSs(e.target.value))}
                onBlur={e => f.setT2(autoFormatMmSs(e.target.value, { padOnBlur: true }))}
                aria-label={f.aria2t} style={INP} />
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
          ].filter(f => !(noTarget && !f.isCurrent) && !(noCurrent && f.isCurrent)).map(f => (
            <div key={f.lbl} style={{ flex: '1 1 140px', minWidth: '120px' }}>
              <label style={LBL}>{f.lbl}</label>
              <select value={f.dist} onChange={e => f.setDist(Number(e.target.value))} aria-label={f.distAria} style={{ ...INP, marginBottom: '4px' }}>
                {opts.map(o => <option key={o.m} value={o.m}>{o.lbl}</option>)}
              </select>
              <input type="text" inputMode="numeric" placeholder="MM:SS" value={f.t}
                onChange={e => f.setT(autoFormatMmSs(e.target.value))}
                onBlur={e => f.setT(autoFormatMmSs(e.target.value, { padOnBlur: true }))}
                aria-label={f.tAria} style={INP} />
              {(() => {
                // v9.53.0 — Live % of WR readout. Updates as user types so they see
                // their effort-grade against the world record without leaving the form.
                // Hidden when time invalid or no reference for distance.
                const sec = parseMmSs(f.t)
                const ref = sec != null ? getReference(sport, Number(f.dist)) : null
                if (!ref || !ref.wr) return null
                const pct = Math.round((ref.wr / sec) * 1000) / 10
                return (
                  <div style={{ ...S.mono, fontSize: '10px', color: '#ff6600', marginTop: '3px', letterSpacing: '0.04em' }}
                    aria-live="polite">
                    {pct}% {isTR ? 'DR' : 'WR'}
                  </div>
                )
              })()}
              <ReferenceChips
                isTR={isTR} sport={sport} distanceM={Number(f.dist)} onPick={f.setT} />
            </div>
          ))}
        </div>
        </>
      )}

      {!noRaceDate ? (
        <div style={{ marginBottom: '10px' }}>
          <label style={LBL}>{isTR ? 'YARIŞ TARİHİ' : 'RACE DATE'}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            min={todayISO}
            aria-label={isTR ? 'Yarış tarihi' : 'Race date'}
            aria-invalid={dateInPast || undefined}
            style={INP} />
          {dateInPast ? (
            <div role="alert" aria-live="polite"
              style={{ ...S.mono, fontSize: '10px', color: '#e03030', marginTop: '4px', letterSpacing: '0.04em' }}>
              {isTR ? 'Yarış tarihi gelecekte olmalı' : 'Race date must be in the future'}
            </div>
          ) : null}
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
                style={{ ...S.mono, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', padding: '8px 12px', flex: '1 1 70px', minHeight: '44px', background: a ? '#0064ff' : 'var(--input-bg)', color: a ? '#fff' : 'var(--text)', border: `1px solid ${a ? '#0064ff' : 'var(--input-border)'}`, borderRadius: '4px', cursor: 'pointer' }}>
                {n}{isTR ? 'h' : 'w'}
              </button>
            )
          })}
        </div>
      ) : null}

      {disabledReason ? (
        <div role="status" aria-live="polite"
          style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '6px', textAlign: 'center', letterSpacing: '0.04em' }}>
          {isTR ? disabledReason.tr : disabledReason.en}
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

// v9.46.0 — Mark-done cell for sample-week rows. Mirrors the NextTrainingCard
// "DID THIS" button: builds a log entry via buildLogEntryFromSession with
// today's date, prepends to log, then renders a green "✓ done · HH:MM"
// chip in the same slot. Dedupes by (date, sport, source='sporeus-plan').
// Skipped on Rest days (durationMin === 0) since there's nothing to log.
function MarkDoneCell({ session, sport, isTR, log, setLog, profile }) {
  const dur = Number(session?.durationMin || session?.duration || 0)
  if (!dur) return null
  // v9.46.0 — when no setLog handler is wired (e.g., legacy callers or tests
  // without DataContext), render a static "—" placeholder rather than a dead
  // button. Athlete still sees the row content; the action just isn't surfaced.
  if (typeof setLog !== 'function') return null
  const todayISO = (() => {
    const d = new Date()
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })()
  const safeLog = Array.isArray(log) ? log : []
  const effectiveSport = (typeof session?.discipline === 'string' && session.discipline !== 'rest')
    ? session.discipline.toLowerCase()
    : (sport || 'run').toLowerCase()
  const alreadyLogged = safeLog.some(e =>
    e?.date === todayISO
    && e?.source === 'sporeus-plan'
    && (e?.sport || '').toLowerCase() === effectiveSport
  )
  if (alreadyLogged) {
    const matchEntry = safeLog.find(e => e?.date === todayISO && e?.source === 'sporeus-plan')
    const ts = matchEntry?.doneAt ? new Date(matchEntry.doneAt) : null
    const hhmm = ts ? `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}` : null
    return (
      <span style={{ flex: '0 0 auto', color: '#28a745', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}>
        ✓ {isTR ? 'tamamlandı' : 'done'}{hhmm ? ` · ${hhmm}` : ''}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-mark-done
      aria-label={isTR ? 'Bu seansı bugün tamamlandı işaretle' : 'Mark this session done today'}
      onClick={() => {
        const entry = buildLogEntryFromSession(session, todayISO, effectiveSport, profile)
        if (!entry) return
        entry.doneAt = new Date().toISOString()
        setLog([entry, ...safeLog])
      }}
      style={{
        flex: '0 0 auto',
        minHeight: '24px',
        padding: '2px 8px',
        background: '#28a745',
        color: '#fff',
        border: 'none',
        borderRadius: 3,
        fontFamily: 'inherit',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        cursor: 'pointer',
      }}
    >
      ✓ {isTR ? 'YAPILDI' : 'DONE'}
    </button>
  )
}

function SamplePhase({ phase, days, isTR, defaultOpen, sport, log, setLog, profile }) {
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
              <div key={i} style={{ borderBottom: '1px dashed var(--border)', padding: '3px 0' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ flex: '0 0 36px', color: 'var(--text)' }}>{d.day || `D${i + 1}`}</span>
                  <span style={{ flex: '1 1 90px' }}>{dayIntent(d.intent, isTR)}</span>
                  <span style={{ flex: '0 0 56px' }}>{dur != null ? `${dur}${isTR ? 'dk' : 'min'}` : ''}</span>
                  {z ? <span style={{ flex: '0 0 90px', fontSize: '9px' }}>{z}</span> : null}
                  {pace ? <span style={{ flex: '0 0 70px' }}>{pace}</span> : null}
                  {(() => {
                    // v9.53.0 — Cadence/rate chip per sport. Rowing → spmTarget
                    // (v9.51.0), running → cadenceTarget, cycling → rpmTarget.
                    // All other sports / rest days render nothing.
                    const rate = sport === 'rowing' ? d.spmTarget
                      : sport === 'run' || sport === 'triathlon' ? d.cadenceTarget
                      : sport === 'bike' ? d.rpmTarget
                      : null
                    return rate
                      ? <span style={{ flex: '0 0 78px', fontSize: '9px', color: 'var(--muted)' }}>{rate}</span>
                      : null
                  })()}
                  <MarkDoneCell session={d} sport={sport} isTR={isTR} log={log} setLog={setLog} profile={profile} />
                </div>
                {d.strength ? (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px', paddingLeft: '36px', fontSize: '9px', color: '#a85d00' }}>
                    <span style={{ flex: '0 0 14px', fontWeight: 700 }}>+</span>
                    <span style={{ flex: '1 1 90px' }}>{dayIntent(d.strength.intent, isTR)}</span>
                    <span style={{ flex: '0 0 56px' }}>{d.strength.durationMin}{isTR ? 'dk' : 'min'}</span>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

// ── PlanStalenessBanner (v9.32.0) ─────────────────────────────────────────────
// Shown above PhysiologyRow when the saved plan's currentLevel has drifted
// from the athlete's current profile (e.g., athlete re-tested 5K and VDOT
// jumped from 50 to 55). Severity 'major' renders red; 'minor' renders amber.
// No render when computePlanStaleness returns null.
function PlanStalenessBanner({ result, profile, isTR }) {
  if (!result || !profile) return null
  const profileLevel = {
    vdot:        profile.vdot,
    ftp:         profile.ftp,
    cssSec:      profile.cssSec ?? profile.css,
    split2kSec:  profile.split2kSec ?? profile.split2k,
  }
  const report = computePlanStaleness(result, profileLevel)
  if (!report) return null
  const isMajor = report.severity === 'major'
  const accent = isMajor ? '#dc3545' : '#ff9900'
  const bg     = isMajor ? 'rgba(220,53,69,0.10)' : 'rgba(255,153,0,0.10)'
  const labelEn = isMajor ? '⚠ PLAN OUT OF DATE' : '⚡ PLAN MAY BE STALE'
  const labelTr = isMajor ? '⚠ PLAN GÜNCEL DEĞİL' : '⚡ PLAN ESKİYOR OLABİLİR'
  return (
    <div role="status" aria-live="polite"
      style={{
        marginBottom: '10px', padding: '10px 12px', borderLeft: `3px solid ${accent}`,
        background: bg, borderRadius: 4, ...S.mono, fontSize: 11, lineHeight: 1.55,
      }}>
      <div style={{ fontWeight: 700, color: accent, letterSpacing: '0.06em', marginBottom: 4 }}>
        {isTR ? labelTr : labelEn}
      </div>
      <div style={{ color: 'var(--text)' }}>{isTR ? report.message.tr : report.message.en}</div>
      <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)' }}>
        {report.drifted.map(d => `${d.metric.toUpperCase()}: ${d.planValue} → ${d.currentValue}`).join(' · ')}
      </div>
    </div>
  )
}

// ── PhysiologyGapBlock (v9.165.0, EP-6) ──────────────────────────────────────
// Renders the verdict from computePhysiologyGapInsight: current → target,
// numeric gap, gain rate at this fitness level (Daniels/Coggan/Wakayoshi
// progression curves), and a physiology-translated feasibility verdict.
// Pre-fix the card showed current → target paces but no signal about
// whether the goal was physiologically plausible given the timeline.
const VERDICT_COLOR = {
  'already-met':         '#0064ff',
  comfortable:           '#5bc25b',
  realistic:             '#5bc25b',
  'stretching-ceiling':  '#f5c542',
  unrealistic:           '#e03030',
  unknown:               '#888888',
}
const VERDICT_LABEL = {
  'already-met':        { en: 'ALREADY MET',         tr: 'ZATEN KARŞILANDI' },
  comfortable:          { en: 'COMFORTABLE',         tr: 'RAHAT' },
  realistic:            { en: 'REALISTIC',           tr: 'GERÇEKÇİ' },
  'stretching-ceiling': { en: 'STRETCHING CEILING',  tr: 'TAVANI ZORLUYOR' },
  unrealistic:          { en: 'UNREALISTIC',         tr: 'GERÇEKÇİ DEĞİL' },
  unknown:              { en: 'UNKNOWN',             tr: 'BİLİNMİYOR' },
}

function PhysiologyGapBlock({ program, isTR }) {
  const insight = computePhysiologyGapInsight(program)
  if (!insight) return null
  const color = VERDICT_COLOR[insight.physVerdict] || '#888'
  const label = (VERDICT_LABEL[insight.physVerdict]?.[isTR ? 'tr' : 'en']) || insight.physVerdict.toUpperCase()
  const aria  = isTR ? 'Fizyoloji boşluğu' : 'Physiology gap'
  return (
    <div
      role="region"
      aria-label={aria}
      data-physiology-gap={insight.physVerdict}
      style={{
        marginBottom: 8, padding: 8,
        background: `${color}14`,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        fontFamily: 'inherit',
      }}
    >
      <div style={{
        fontSize: 9, letterSpacing: '0.08em', fontWeight: 700,
        color, marginBottom: 4,
      }}>
        ◆ {insight.metric} · {label}
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.55 }}>
        <span style={{ color: 'var(--text)', fontWeight: 700 }}>{insight.current}</span>
        <span aria-hidden="true"> → </span>
        <span style={{ color: 'var(--text)', fontWeight: 700 }}>{insight.target}</span>
        <span> · Δ{insight.gap > 0 ? '+' : ''}{insight.gap}</span>
        {insight.weeksAvailable != null && (
          <span> · {insight.weeksAvailable}w {isTR ? 'mevcut' : 'available'}</span>
        )}
        {insight.weeksToBridge != null && insight.weeksToBridge > 0 && (
          <span> · ~{insight.weeksToBridge}w {isTR ? 'kapatmak için' : 'to bridge'}</span>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text)', lineHeight: 1.5 }}>
        {isTR ? insight.note.tr : insight.note.en}
      </div>
      <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)', fontStyle: 'italic' }}>
        {insight.citation}
      </div>
    </div>
  )
}

// ── CyclePhaseBlock (v9.182.0, EP-9 UI surface) ──────────────────────────────
// Renders the 4-week cycle-phase forecast from program.cycleGate. Privacy
// gate: `isCycleGateAvailable(profile)` must be true (gender=female AND
// lastPeriodStart set). Non-female / non-opted-in athletes get an early
// `return null` — zero cycle UI is rendered for them.
const CYCLE_PHASE_LABEL = {
  menstruation: { en: 'Menstruation', tr: 'Adet' },
  follicular:   { en: 'Follicular',   tr: 'Foliküler' },
  ovulation:    { en: 'Ovulation',    tr: 'Ovülasyon' },
  luteal:       { en: 'Luteal',       tr: 'Luteal' },
}
const CYCLE_PHASE_COLOR = {
  menstruation: '#e0457b',
  follicular:   '#5bc25b',
  ovulation:    '#0064ff',
  luteal:       '#b87bd8',
}

function CyclePhaseBlock({ program, profile, isTR }) {
  if (!isCycleGateAvailable(profile)) return null
  const gate = program?.cycleGate
  if (!gate || !Array.isArray(gate.weeks) || gate.weeks.length === 0) return null
  const wk0 = gate.weeks[0]
  const phase0 = wk0.dominantPhase
  const color = CYCLE_PHASE_COLOR[phase0] || '#888'
  const phaseLbl = CYCLE_PHASE_LABEL[phase0]?.[isTR ? 'tr' : 'en'] || phase0
  const mult = wk0.tssMultiplier
  const multPct = Math.round((mult - 1) * 100)
  const multStr = multPct > 0 ? `+${multPct}%` : `${multPct}%`
  const aria = isTR ? 'Döngü fazı önerisi' : 'Cycle phase guidance'
  return (
    <div
      role="region"
      aria-label={aria}
      data-cycle-phase={phase0}
      style={{
        marginBottom: 8, padding: 8,
        background: `${color}14`,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.08em', fontWeight: 700, color, marginBottom: 4 }}>
        ◐ {isTR ? 'BU HAFTA' : 'THIS WEEK'} · {phaseLbl.toUpperCase()} · TSS {multStr}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.55, marginBottom: 6 }}>
        {isTR ? wk0.note.tr : wk0.note.en}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {gate.weeks.map((w, i) => {
          const c = CYCLE_PHASE_COLOR[w.dominantPhase] || '#888'
          const lbl = CYCLE_PHASE_LABEL[w.dominantPhase]?.[isTR ? 'tr' : 'en'] || w.dominantPhase
          const pct = Math.round((w.tssMultiplier - 1) * 100)
          return (
            <div key={i} style={{
              flex: '1 1 90px', minWidth: 90,
              padding: '4px 6px',
              background: `${c}22`,
              border: `1px solid ${c}55`,
              borderRadius: 3,
              fontSize: 9,
            }}>
              <div style={{ color: c, fontWeight: 700, letterSpacing: '0.05em' }}>
                {isTR ? `H${w.weekIdx}` : `W${w.weekIdx}`}
              </div>
              <div style={{ color: 'var(--text)', marginTop: 2 }}>{lbl}</div>
              <div style={{ color: 'var(--muted)', marginTop: 1 }}>
                {pct > 0 ? `+${pct}%` : `${pct}%`}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
        {isTR ? gate.privacyNote.tr : gate.privacyNote.en}
      </div>
      <div style={{ marginTop: 4, fontSize: 9, color: '#555' }}>
        {gate.citation}
      </div>
    </div>
  )
}

// ── RaceStrategyBlock (v9.183.0, EP-12 UI surface) ───────────────────────────
// Surfaces buildRaceStrategy() for athletes whose program has a confirmed
// race date. The athlete picks their race FORMAT (track / road / trail /
// ultra / xc / tt / crit / 70.3 / etc.) and the block renders pacing /
// opener / closer / fueling / gear bilingual guidance + any condition
// warnings. Race format is persisted per-program in localStorage so the
// athlete doesn't re-pick on every visit.
const RACE_STRATEGY_STORAGE_KEY = 'sporeus-eliteProgram-raceStrategy'
// v9.191.0 — Shared conditions key with the standalone RaceStrategyCard
// (v9.190). Cross-surface: editing tempC here surfaces in the standalone
// card and vice-versa. buildRaceStrategy guards each numeric field, so
// empty inputs short-circuit to "no warnings".
const RACE_CONDITIONS_KEY = 'sporeus-raceConditions'
const RACE_TYPE_LABEL = {
  // run
  track: { en: 'Track', tr: 'Pist' },
  road:  { en: 'Road',  tr: 'Yol' },
  trail: { en: 'Trail', tr: 'Patika' },
  ultra: { en: 'Ultra', tr: 'Ultra' },
  xc:    { en: 'XC',    tr: 'XC' },
  // bike
  tt:           { en: 'Time Trial',  tr: 'Zaman Denemesi' },
  crit:         { en: 'Criterium',   tr: 'Kriteryum' },
  'gran-fondo': { en: 'Gran Fondo',  tr: 'Gran Fondo' },
  mtb:          { en: 'MTB',         tr: 'MTB' },
  // swim
  pool:         { en: 'Pool',        tr: 'Havuz' },
  'open-water': { en: 'Open Water',  tr: 'Açık Su' },
  // triathlon
  sprint:       { en: 'Sprint',      tr: 'Sprint' },
  olympic:      { en: 'Olympic',     tr: 'Olimpik' },
  '70.3':       { en: 'Half (70.3)', tr: 'Yarım (70.3)' },
  ironman:      { en: 'Ironman',     tr: 'Ironman' },
  // rowing
  '2k':         { en: '2k',          tr: '2k' },
  'head-race':  { en: 'Head Race',   tr: 'Head Race' },
}

function RaceStrategyBlock({ program, isTR }) {
  const sport = program?.sport
  const types = sport ? RACE_TYPES[sport] : null
  const [stored, setStored] = useLocalStorage(RACE_STRATEGY_STORAGE_KEY, {})
  const [conditions, setConditions] = useLocalStorage(RACE_CONDITIONS_KEY, {
    expanded: false, tempC: '', windKph: '', altitudeM: '',
  })
  if (!sport || !Array.isArray(types) || types.length === 0) return null

  const raceType = stored?.[sport] || ''

  const conditionsForStrategy = {}
  const tempNum = Number(conditions?.tempC)
  const windNum = Number(conditions?.windKph)
  const altNum  = Number(conditions?.altitudeM)
  if (conditions?.tempC !== '' && Number.isFinite(tempNum)) conditionsForStrategy.tempC = tempNum
  if (conditions?.windKph !== '' && Number.isFinite(windNum)) conditionsForStrategy.windKph = windNum
  if (conditions?.altitudeM !== '' && Number.isFinite(altNum)) conditionsForStrategy.altitudeM = altNum

  const strategy = raceType
    ? buildRaceStrategy({ sport, raceType, conditions: Object.keys(conditionsForStrategy).length ? conditionsForStrategy : null })
    : null
  const valid = strategy && !strategy._rejected

  const aria = isTR ? 'Yarış stratejisi' : 'Race strategy'
  const accent = '#0064ff'
  const setRaceType = (rt) => setStored({ ...(stored || {}), [sport]: rt })
  const updateConditions = (patch) => setConditions({ ...(conditions || {}), ...patch })
  const conditionsExpanded = !!conditions?.expanded

  return (
    <div
      role="region"
      aria-label={aria}
      data-race-strategy={raceType || 'unselected'}
      style={{
        marginBottom: 8, padding: 8,
        background: `${accent}10`,
        border: `1px solid ${accent}44`,
        borderRadius: 4,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.08em', fontWeight: 700, color: accent, marginBottom: 6 }}>
        ◇ {isTR ? 'YARIŞ GÜNÜ STRATEJİSİ' : 'RACE-DAY STRATEGY'} · {sport.toUpperCase()}
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 10, color: 'var(--muted)', marginRight: 6 }}>
          {isTR ? 'Yarış formatı:' : 'Race format:'}
        </label>
        <select
          aria-label={isTR ? 'Yarış formatı seç' : 'Select race format'}
          value={raceType}
          onChange={e => setRaceType(e.target.value)}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            padding: '4px 8px',
            background: 'var(--input-bg)',
            color: 'var(--text)',
            border: '1px solid var(--input-border)',
            borderRadius: 3,
          }}
        >
          <option value="">{isTR ? '— seç —' : '— select —'}</option>
          {types.map(rt => (
            <option key={rt} value={rt}>
              {RACE_TYPE_LABEL[rt]?.[isTR ? 'tr' : 'en'] || rt}
            </option>
          ))}
        </select>
      </div>
      <div data-race-strategy-conditions style={{ marginBottom: 8 }}>
        <button
          type="button"
          aria-expanded={conditionsExpanded}
          onClick={() => updateConditions({ expanded: !conditionsExpanded })}
          style={{
            background: 'transparent', border: 'none', color: 'var(--muted)',
            cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, padding: 0,
          }}
        >
          {conditionsExpanded ? '▾' : '▸'} {isTR ? 'Yarış günü koşulları (isteğe bağlı)' : 'Race-day conditions (optional)'}
        </button>
        {conditionsExpanded ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'rsb-tempc', key: 'tempC',    lblEn: 'TEMP (°C)',  lblTr: 'SICAKLIK (°C)',  ph: '22' },
              { id: 'rsb-wind',  key: 'windKph',  lblEn: 'WIND (km/h)',lblTr: 'RÜZGAR (km/sa)', ph: '10' },
              { id: 'rsb-alt',   key: 'altitudeM',lblEn: 'ALTITUDE (m)',lblTr: 'RAKIM (m)',     ph: '0' },
            ].map(f => (
              <div key={f.key} style={{ flex: '1 1 100px' }}>
                <label htmlFor={f.id} style={{ display: 'block', fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>
                  {isTR ? f.lblTr : f.lblEn}
                </label>
                <input
                  id={f.id}
                  type="number"
                  inputMode="numeric"
                  value={conditions?.[f.key] ?? ''}
                  onChange={e => updateConditions({ [f.key]: e.target.value })}
                  placeholder={f.ph}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
                    padding: '4px 6px', background: 'var(--input-bg)',
                    color: 'var(--text)', border: '1px solid var(--input-border)',
                    borderRadius: 3, width: '100%', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {valid ? (
        <div data-race-strategy-output style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['pacing', isTR ? 'Tempolama'    : 'Pacing'],
            ['opener', isTR ? 'Açılış'        : 'Opener'],
            ['closer', isTR ? 'Kapanış'       : 'Closer'],
            ['fueling',isTR ? 'Beslenme'      : 'Fueling'],
            ['gear',   isTR ? 'Ekipman'       : 'Gear'],
          ].map(([key, label]) => (
            <div key={key} style={{ fontSize: 10, lineHeight: 1.55 }}>
              <span style={{ fontWeight: 700, color: accent, marginRight: 6 }}>{label}:</span>
              <span style={{ color: 'var(--text)' }}>{isTR ? strategy[key].tr : strategy[key].en}</span>
            </div>
          ))}
          {Array.isArray(strategy.warnings) && strategy.warnings.length > 0 ? (
            <div style={{ marginTop: 4, padding: 6, background: '#ff660014', border: '1px solid #ff660055', borderRadius: 3 }}>
              {strategy.warnings.map(w => (
                <div key={w.code} style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.5 }}>
                  ⚠ {isTR ? w.tr : w.en}
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ marginTop: 4, fontSize: 9, color: '#555', fontStyle: 'italic' }}>
            {strategy.citation}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
          {isTR
            ? 'Yarış formatını seç — tempolama, açılış, kapanış, beslenme ve ekipman önerileri görünecek.'
            : 'Select a race format — pacing, opener, closer, fueling, and gear guidance will appear.'}
        </div>
      )}
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

// ── AdherenceSection (v8.98.0) ───────────────────────────────────────────────
// Surfaces the planned-vs-actual reconciliation. Renders only in
// in-progress lifecycle state when the adherence builder reports reliable=true.
const TRAJECTORY_COLOR = {
  'on-track': '#28a745',
  behind: '#ff9500',
  critical: '#dc3545',
  ahead: '#0064ff',
}
const TRAJECTORY_LABEL = {
  'on-track': { en: 'ON TRACK', tr: 'YOLDA' },
  behind:     { en: 'BEHIND',   tr: 'GERİDE' },
  critical:   { en: 'CRITICAL', tr: 'KRİTİK' },
  ahead:      { en: 'AHEAD',    tr: 'İLERİDE' },
}
const INTENT_LABEL = {
  long:      { en: 'long run',    tr: 'uzun koşu' },
  threshold: { en: 'threshold',   tr: 'eşik' },
  intervals: { en: 'intervals',   tr: 'interval' },
}

function AdherenceSection({ adherence, reprojection, onReproject, isTR }) {
  if (!adherence || !adherence.reliable) return null
  const traj = adherence.trajectory
  const color = TRAJECTORY_COLOR[traj] || '#6c757d'
  const trajLabel = TRAJECTORY_LABEL[traj]?.[isTR ? 'tr' : 'en'] || traj.toUpperCase()
  const pct = Math.max(0, Math.min(100, Math.round(adherence.adherencePct || 0)))
  const barWidthPct = Math.max(0, Math.min(100, pct))
  const recommendation = adherence.recommendation?.[isTR ? 'tr' : 'en'] || ''
  const message = adherence.message?.[isTR ? 'tr' : 'en'] || ''
  const missed = Array.isArray(adherence.missedKeySessions) ? adherence.missedKeySessions : []
  const showMissed = missed.length > 0 && missed.length <= 3
  const showReproject = !!(reprojection && reprojection.reliable && onReproject)

  return (
    <div role="region" data-adherence-section
      data-trajectory={traj}
      aria-label={isTR ? 'Plan uygulama' : 'Plan adherence'}
      style={{ marginBottom: '12px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}>
      <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
        {isTR ? 'UYGULAMA' : 'ADHERENCE'}
        <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
        {isTR ? 'ADHERENCE' : 'UYGULAMA'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
        <div style={{ ...S.mono, fontSize: '20px', fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.02em' }}
          data-adherence-pct>{pct}%</div>
        <div role="img" aria-label={`${pct}%`} data-adherence-bar
          style={{ flex: '1 1 80px', height: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '2px', overflow: 'hidden', minWidth: '80px' }}>
          <div style={{ width: `${barWidthPct}%`, height: '100%', background: color }} />
        </div>
        <div data-adherence-trajectory style={{ ...S.mono, fontSize: '10px', fontWeight: 700, color: '#fff', background: color, padding: '2px 8px', borderRadius: '3px', letterSpacing: '0.08em' }}>
          {trajLabel}
        </div>
      </div>
      {message ? (
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '4px' }}>
          {message}
        </div>
      ) : null}
      {recommendation ? (
        <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', lineHeight: 1.5, paddingLeft: '8px', borderLeft: `2px solid ${color}` }}>
          {recommendation}
        </div>
      ) : null}
      {showMissed ? (
        <ul data-adherence-missed style={{ ...S.mono, fontSize: '10px', color: 'var(--text)', lineHeight: 1.5, marginTop: '6px', paddingLeft: '18px' }}>
          {missed.map((m, i) => {
            const intentLbl = INTENT_LABEL[m.intent]?.[isTR ? 'tr' : 'en'] || m.intent
            return (
              <li key={`${m.date}-${i}`}>
                {isTR
                  ? `${m.date} · ${intentLbl} kaçırıldı`
                  : `${m.date} · missed ${intentLbl}`}
              </li>
            )
          })}
        </ul>
      ) : null}
      {showReproject ? (
        <button type="button" onClick={onReproject}
          data-reproject-btn data-reproject-strategy={reprojection.strategy}
          aria-label={isTR ? 'Programı yeniden hesapla' : 'Re-project program'}
          style={{ ...S.mono, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', padding: '6px 10px', marginTop: '8px', background: color, color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', minHeight: '32px' }}>
          {isTR ? 'YENİDEN HESAPLA' : 'RE-PROJECT'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'RE-PROJECT' : 'YENİDEN HESAPLA'}
        </button>
      ) : null}
    </div>
  )
}

export default function EliteProgramCard({ log: _log = [], profile: _profile = {}, setLog }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [persisted, setPersisted] = useLocalStorage(STORAGE_KEY, null)
  const [programStart, setStart] = useLocalStorage(START_KEY, null)
  const [yearlyPlanLs] = useLocalStorage(YEARLY_PLAN_KEY, null)

  // v9.83.0 — confirm modal state replacing window.confirm() calls
  const [confirmResetOpen, setConfirmResetOpen]             = useState(false)
  const [confirmReprojectOpen, setConfirmReprojectOpen]     = useState(false)
  const [reprojectMsg, setReprojectMsg]                     = useState('')
  const [confirmOverwriteOpen, setConfirmOverwriteOpen]     = useState(false)
  const [pendingYearly, setPendingYearly]                   = useState(null)

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
    // v9.182.0 — EP-9 cycle gate consumes these from input.profile. Pass-through
    // gender + lastPeriodStart + cycleLength so buildCyclePhaseGate can resolve.
    // Privacy: buildCyclePhaseGate is a hard no-op for non-female / non-opted-in;
    // pre-existing privacy contract is unchanged.
    if (_profile?.gender) out.gender = _profile.gender
    if (_profile?.lastPeriodStart) out.lastPeriodStart = _profile.lastPeriodStart
    if (_profile?.cycleLength) out.cycleLength = _profile.cycleLength
    return out
  }, [_log, _profile?.weeklyHours, _profile?.trainingDays, _profile?.gender, _profile?.lastPeriodStart, _profile?.cycleLength])

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
      // v9.182.0 — Re-inject *live* cycle fields (gender / lastPeriodStart /
      // cycleLength) so the cycle gate fires when an athlete enters tracking
      // data after a program is already running, without forcing regeneration.
      // Snapshot fields (currentCTL, weeklyHours, trainingDays) MUST remain
      // as persisted — they reflect the athlete's state at generation time,
      // and adherence calculations rely on that snapshot being stable.
      const cycleLive = {}
      if (_profile?.gender)          cycleLive.gender = _profile.gender
      if (_profile?.lastPeriodStart) cycleLive.lastPeriodStart = _profile.lastPeriodStart
      if (_profile?.cycleLength)     cycleLive.cycleLength = _profile.cycleLength
      const inputWithProfile = {
        ...persisted.input,
        profile: { ...(persisted.input.profile || {}), ...cycleLive },
      }
      const r = buildEliteProgram(inputWithProfile)
      if (!r) return { result: null, rejection: null }
      if (r._rejected) return { result: null, rejection: r }
      if (!r.feasibility) return { result: null, rejection: null }
      return { result: r, rejection: null }
    } catch {
      return { result: null, rejection: null }
    }
  }, [persisted, _profile?.gender, _profile?.lastPeriodStart, _profile?.cycleLength])
  const baseResult = evaluation.result
  const rejection = evaluation.rejection

  // ── v9.3.0 — apply accepted coach edits on top of orchestrator result ───────
  const [coachEditsStored] = useLocalStorage(ATHLETE_EDITS_KEY, null)
  const coachEdits = useMemo(() =>
    Array.isArray(coachEditsStored?.edits) ? coachEditsStored.edits : [],
    [coachEditsStored])
  const result = useMemo(() => {
    if (!baseResult) return null
    if (!coachEdits.length) return baseResult
    return applyCoachEdits(baseResult, coachEdits)
  }, [baseResult, coachEdits])

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

  // ── v8.98.0 — plan adherence (planned vs actual TSS reconciliation) ───────
  // Pure derivation. Renders only in `in-progress` lifecycle when reliable.
  const adherence = useMemo(() => {
    if (!result) return null
    const todayIso = new Date().toISOString().slice(0, 10)
    return buildPlanAdherence(result, _log || [], {
      programStart,
      today: todayIso,
      raceDate: persisted?.input?.raceDate
        || result?.feasibility?.effectiveRaceDate
        || null,
    })
  }, [result, _log, programStart, persisted])

  // ── v8.99.0 — reprojection suggestion ─────────────────────────────────────
  // When adherence trajectory is behind/critical, computeReprojection produces
  // a concrete adjustment (extend race date and/or soften target) that the
  // RE-PROJECT button writes back to the form.
  const reprojection = useMemo(() => {
    if (!result || !adherence) return null
    const programWithInput = { ...result, input: persisted?.input || {} }
    const todayIso = new Date().toISOString().slice(0, 10)
    return buildReprojectionSuggestion(programWithInput, adherence, { today: todayIso })
  }, [result, adherence, persisted])

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
    setConfirmResetOpen(true)
  }

  function doReset() {
    setConfirmResetOpen(false)
    setPersisted(null)
    setStart(null)
  }

  function handleReproject() {
    if (!reprojection || !reprojection.reliable || !persisted?.input) return
    const reasoning = reprojection.reasoning?.[isTR ? 'tr' : 'en'] || ''
    setReprojectMsg(isTR
      ? `Önerilen ayarlama:\n\n${reasoning}\n\nFormu yeni değerlerle önceden doldurmak istiyor musun? (Mevcut planı yeniden oluşturman gerekecek.)`
      : `Suggested adjustment:\n\n${reasoning}\n\nPre-fill the form with the new values? (You'll need to regenerate the plan.)`)
    setConfirmReprojectOpen(true)
  }

  function doReproject() {
    setConfirmReprojectOpen(false)
    if (!reprojection || !reprojection.reliable || !persisted?.input) return

    // Build adjusted form payload mirroring FormMode.savePersistedForm shape.
    const inp = persisted.input
    const sport = inp.sport
    const cur = inp.currentPR || {}
    const tgt = inp.targetPR || {}
    const targetTimeSec = reprojection.adjustedTargetTimeSec ?? tgt.timeSec
    const fmtMmSsLocal = (sec) => {
      if (sec == null) return ''
      const s = Math.round(sec)
      const m = Math.floor(s / 60), r = s % 60
      return `${m}:${String(r).padStart(2, '0')}`
    }
    const form = {
      sport,
      currentDist: cur.distanceM ?? 0,
      currentTime: fmtMmSsLocal(cur.timeSec),
      targetDist: tgt.distanceM ?? cur.distanceM ?? 0,
      targetTime: fmtMmSsLocal(targetTimeSec),
      raceDate: reprojection.newRaceDate,
      // Sport-mode toggles preserved
      bikeFtpDirect: !!persisted.form?.bikeFtpDirect,
      currentWatts: persisted.form?.currentWatts || '',
      targetWatts: persisted.form?.targetWatts || '',
      swim2TT: !!persisted.form?.swim2TT,
      noRaceDate: false,
      weeksOverride: persisted.form?.weeksOverride || 16,
      noTarget: false,
    }
    setPersisted({ input: null, form })
    setStart(null)
    announce(isTR
      ? `Form yeni hedef tarihiyle dolduruldu: ${reprojection.newRaceDate}. Devam etmek için OLUŞTUR'a bas.`
      : `Form pre-filled with new race date ${reprojection.newRaceDate}. Press GENERATE to continue.`)
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
          profile={_profile}
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
      ? 'Plan özeti kopyalandı. Koç, panodaki SPORCU PROGRAMI kartına yapıştırabilir.'
      : 'Plan summary copied. Coach can paste it into ATHLETE PROGRAM card on their dashboard.'
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
      setPendingYearly(yearly)
      setConfirmOverwriteOpen(true)
      return
    }
    writeYearlyToCalendar(yearly)
  }

  function writeYearlyToCalendar(yearly) {
    if (!yearly || typeof window === 'undefined' || !window.localStorage) return
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

  function doOverwriteYearly() {
    const y = pendingYearly
    setConfirmOverwriteOpen(false)
    setPendingYearly(null)
    if (y) writeYearlyToCalendar(y)
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
  // v9.52.0 — % of WR. For rowing direct-2k (distanceM === 0), substitute 2000m
  // so the chip resolves; for bike direct-FTP we skip — no time-based WR.
  const sport = persisted.input?.sport
  const curPR = persisted.input?.currentPR
  const tgtPR = effectiveTargetPR
  const pctOfWR = (pr) => {
    if (!sport || !pr || !pr.timeSec) return null
    let dist = pr.distanceM
    if (sport === 'rowing' && (!dist || dist === 0)) dist = 2000
    if (!dist) return null
    const ref = getReference(sport, dist)
    if (!ref || !ref.wr) return null
    return Math.round((ref.wr / pr.timeSec) * 1000) / 10
  }
  const curPctWR = pctOfWR(curPR)
  const tgtPctWR = pctOfWR(tgtPR)
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
        <div data-action-bar
          style={{
            display: 'flex',
            gap: '6px',
            // On narrow viewports, allow horizontal scrolling instead of
            // wrapping into an awkward 2-row grid where bilingual button
            // widths drift. Buttons stay one row, scrollable.
            flexWrap: 'nowrap',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            maxWidth: '100%',
          }}>
          <button type="button"
            onClick={() => {
              const ok = downloadEliteProgramCSV(
                result,
                `elite-program-${persisted.input?.sport || 'run'}-${persisted.input?.raceDate || 'plan'}.csv`,
              )
              if (ok) announce(isTR ? 'Dışa aktarma tamamlandı' : 'Export complete')
            }}
            aria-label={isTR ? 'CSV olarak dışa aktar' : 'Export program as CSV'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', minHeight: '32px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {isTR ? 'CSV İNDİR' : 'EXPORT CSV'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'EXPORT CSV' : 'CSV İNDİR'}
          </button>
          <button type="button"
            onClick={applyToCalendar}
            aria-label={isTR ? 'Programı yıllık takvime uygula' : 'Apply program to yearly calendar'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: '#0064ff', color: '#fff', border: '1px solid #0064ff', borderRadius: '3px', cursor: 'pointer', minHeight: '32px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {isTR ? 'TAKVİME UYGULA' : 'APPLY TO CALENDAR'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'APPLY TO CALENDAR' : 'TAKVİME UYGULA'}
          </button>
          <button type="button"
            data-share-with-coach
            data-export-summary
            onClick={shareWithCoach}
            aria-label={isTR ? 'Plan özetini koçla paylaş' : 'Share plan summary with coach'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', color: '#0064ff', border: '1px solid #0064ff', borderRadius: '3px', cursor: 'pointer', minHeight: '32px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {isTR ? 'KOÇLA PAYLAŞ' : 'SHARE WITH COACH'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'SHARE WITH COACH' : 'KOÇLA PAYLAŞ'}
          </button>
          <button type="button" onClick={handleReset}
            aria-label={isTR ? 'Programı sıfırla' : 'Reset program'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', color: '#ff6600', border: '1px solid #ff6600', borderRadius: '3px', cursor: 'pointer', minHeight: '32px', flexShrink: 0, whiteSpace: 'nowrap' }}>
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
        const editCount = coachEdits.filter(e => e.accepted === true).length
        return (
          <>
            <div role="status" data-lifecycle={lc.state}
              aria-label={ariaLbl}
              style={{ display: 'inline-block', ...S.mono, fontSize: '10px', fontWeight: 700, color: '#fff', background: lc.color, padding: '3px 8px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '6px', marginRight: '6px' }}>
              {lcLabel}{showPct ? ` · ${lc.percentComplete}%` : ''}
            </div>
            {editCount > 0 ? (
              <div role="status" data-coach-modified-pill
                aria-label={isTR ? `Koç tarafından düzenlendi: ${editCount}` : `Coach-modified: ${editCount}`}
                style={{ display: 'inline-block', ...S.mono, fontSize: '10px', fontWeight: 700, color: '#fff', background: '#9966cc', padding: '3px 8px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '6px', marginRight: '6px' }}>
                {isTR ? `KOÇ DÜZENLEMESİ · ${editCount}` : `COACH-MODIFIED · ${editCount}`}
              </div>
            ) : null}
          </>
        )
      })() : null}

      <CoachEditsBanner />


      {lifecycle && lifecycle.state === 'in-progress' && adherence && adherence.reliable ? (
        <AdherenceSection
          adherence={adherence}
          reprojection={reprojection}
          onReproject={handleReproject}
          isTR={isTR}
        />
      ) : null}

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
        {curPctWR != null ? (
          <div style={{ flex: '1 1 100px' }} aria-label={isTR ? 'Dünya rekoruna oran' : 'Percent of world record'}>
            <div style={{ ...S.mono, fontSize: '15px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
              {curPctWR}%
              {tgtPctWR != null ? <span style={{ color: 'var(--muted)' }}> → </span> : null}
              {tgtPctWR != null ? `${tgtPctWR}%` : ''}
            </div>
            <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
              {isTR ? 'DR ORANI' : '% OF WR'}
            </div>
          </div>
        ) : null}
      </div>

      {/* v9.32.0 — Plan freshness banner. Detects when the saved plan's
          currentLevel has drifted from the athlete's current profile (athlete
          re-tested VDOT/FTP/CSS, or detrained). Shows above the physiology
          row so the user sees it before reading the prescribed paces. */}
      <PlanStalenessBanner result={result} profile={_profile} isTR={isTR} />

      <PhysiologyRow
        sport={result.sport}
        currentLevel={result.currentLevel}
        targetLevel={result.targetLevel}
        isTR={isTR}
      />

      {/* v9.165.0 (EP-6) — physiology-specific feasibility verdict */}
      <PhysiologyGapBlock program={result} isTR={isTR} />

      {/* v9.182.0 (EP-9 UI surface) — cycle-phase forecast; gated on profile */}
      <CyclePhaseBlock program={result} profile={_profile} isTR={isTR} />

      {Array.isArray(result.phases) && result.phases.length > 0 ? <PhaseSplitBar phases={result.phases} isTR={isTR} /> : null}
      <WeeklyTSSChart weeklyTSS={result.weeklyTSS} phases={result.phases} isTR={isTR} />

      {result.sampleWeeks ? (
        <div style={{ marginBottom: '10px' }}>
          {['Base', 'Build', 'Peak', 'Taper'].map((p, i) => (
            <SamplePhase key={p} phase={p} days={result.sampleWeeks[p]} isTR={isTR} defaultOpen={i === 0} sport={result.sport || persisted?.input?.sport} log={_log} setLog={setLog} profile={_profile} />
          ))}
        </div>
      ) : null}

      <BroaderPlanSections result={result} isTR={isTR} />

      {/* v9.183.0 (EP-12 UI surface) — race-day strategy by format */}
      <RaceStrategyBlock program={result} isTR={isTR} />

      <AboutThisModel isTR={isTR} />

      {note ? <div style={{ ...S.mono, fontSize: '10px', color: 'var(--sub, var(--muted))', marginBottom: '8px', lineHeight: 1.5 }}>{note}</div> : null}
      {recommendation ? (
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.6, paddingLeft: '8px', borderLeft: `2px solid ${accent}`, marginBottom: '8px' }}>
          {recommendation}
        </div>
      ) : null}
      {result.citation ? <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>{result.citation}</div> : null}

      {/* v9.83.0 — confirm modals replacing window.confirm() */}
      <ConfirmModal
        open={confirmResetOpen}
        title={isTR ? 'Programı sıfırla' : 'Reset program'}
        body={isTR
          ? 'Programı sıfırlamak istediğinden emin misin?'
          : 'Are you sure you want to reset this program?'}
        confirmLabel={isTR ? 'Sıfırla' : 'Reset'}
        cancelLabel={isTR ? 'İptal' : 'Cancel'}
        dangerous
        onConfirm={doReset}
        onCancel={() => setConfirmResetOpen(false)}
      />
      <ConfirmModal
        open={confirmReprojectOpen}
        title={isTR ? 'Formu yeniden doldur' : 'Re-project plan'}
        body={reprojectMsg}
        confirmLabel={isTR ? 'Doldur' : 'Pre-fill'}
        cancelLabel={isTR ? 'İptal' : 'Cancel'}
        onConfirm={doReproject}
        onCancel={() => setConfirmReprojectOpen(false)}
      />
      <ConfirmModal
        open={confirmOverwriteOpen}
        title={isTR ? 'Yıllık planın üzerine yaz' : 'Overwrite yearly plan'}
        body={isTR
          ? 'Mevcut yıllık planın üzerine yazılacak. Devam edilsin mi?'
          : 'This will overwrite your existing yearly plan. Continue?'}
        confirmLabel={isTR ? 'Üzerine yaz' : 'Overwrite'}
        cancelLabel={isTR ? 'İptal' : 'Cancel'}
        dangerous
        onConfirm={doOverwriteYearly}
        onCancel={() => { setConfirmOverwriteOpen(false); setPendingYearly(null) }}
      />
    </div>
  )
}
