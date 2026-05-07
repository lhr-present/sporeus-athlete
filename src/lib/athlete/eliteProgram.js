// src/lib/athlete/eliteProgram.js — Elite Program Orchestrator
// Wires existing primitives (raceGoalEngine, running, cycling, swimming, periodization,
// taperEngine) into a single deterministic pipeline:
//   4 inputs (currentPR, targetPR, raceDate, sport) → complete periodized program.
//
// Pure function, no React, no I/O. Bilingual EN+TR output.
//
// References:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Bompa T. & Haff G. (2009). Periodization: Theory and Methodology of Training.
//   Mujika I., Padilla S. (2003). Scientific bases for precompetition tapering. MSSE 35:1182.
//   Coggan A. & Allen H. (2010). Training and Racing with a Power Meter, 2nd ed.
//   Wakayoshi K. et al. (1992). Determination of critical velocity in swimming. Eur J Appl Physiol.
//   Seiler S. (2010). What is best practice for training intensity distribution? IJSPP 5:276–291.

import {
  vdotFromRace,
  trainingPaces,
} from '../sport/running.js'
import {
  getCyclingZones,
} from '../sport/cycling.js'
import {
  tPaceFromTT,
  cssToSecPer100m,
  swimmingZones,
} from '../sport/swimming.js'

const CITATION = 'Daniels 2014; Bompa 2009; Mujika 2003; Coggan 2010; Wakayoshi 1992; Seiler 2010'

// ── Scientific model exposition (v8.92.0) ────────────────────────────────────
// Surfaces the periodization model and per-phase physiological rationale so the
// UI can render an "About this model" panel without duplicating citations.
export const MODEL_NAME = {
  en: 'Traditional Linear Periodization (Bompa 2009)',
  tr: 'Geleneksel Doğrusal Periyodizasyon (Bompa 2009)',
}

export const PHASE_RATIONALE = {
  Base: {
    en: 'High-volume low-intensity work drives aerobic enzymatic adaptation, capillary density, and mitochondrial biogenesis. Easy zone-1/zone-2 mileage builds the substrate the later phases depend on.',
    tr: 'Yüksek hacim ve düşük yoğunluklu çalışma aerobik enzim adaptasyonu, kapiller yoğunluk ve mitokondri biyogenezini tetikler. Kolay 1./2. zon hacmi sonraki fazların dayandığı altyapıyı kurar.',
    cite: 'Daniels 2014; Seiler 2010',
  },
  Build: {
    en: 'Threshold and tempo work raise lactate clearance, while VO2max touches lift the aerobic ceiling. Race-specific load now stresses the same systems that the goal event will tax.',
    tr: 'Eşik ve tempo çalışmaları laktat temizleme kapasitesini yükseltir; VO2max dokunuşları aerobik tavanı kaldırır. Yarışa özgü yük artık hedef yarışın zorlayacağı sistemleri çalıştırır.',
    cite: 'Daniels 2014; Coggan & Allen 2010',
  },
  Peak: {
    en: 'Race-pace specificity and neuromuscular sharpening dominate. Volume holds while intensity converges on goal pace so motor patterns and perceived effort match race day demands.',
    tr: 'Yarış-tempo özgüllüğü ve nöromüsküler keskinleşme baskındır. Hacim korunur, yoğunluk hedef tempoya yakınsar; motor örüntüler ve algılanan efor yarış günü taleplerine uyar.',
    cite: 'Bompa 2009; Issurin 2010',
  },
  Taper: {
    en: 'A 14-day exponential reduction drops acute training load (ATL) while preserving chronic training load (CTL). Freshness rises without erosion of fitness, peaking form on race day.',
    tr: '14 günlük üstel azaltma akut antrenman yükünü (ATL) düşürürken kronik yükü (CTL) korur. Form kaybetmeden tazelik yükselir; yarış günü zirveye çıkar.',
    cite: 'Mujika & Padilla 2003',
  },
}

export const DELOAD_NOTE = {
  en: '3:1 deload — every 4th week drops to ~60% of build target to consolidate adaptations and limit overreaching (Issurin 2010; Mujika 2009)',
  tr: '3:1 deload — her 4. hafta yapı hedefinin ~%60\'ına iner; adaptasyonları pekiştirir ve aşırı yüklenmeyi sınırlar (Issurin 2010; Mujika 2009)',
}

// ── Date helpers (UTC-only, no DST drift) ────────────────────────────────────
function parseUTCDate(s) {
  if (!s || typeof s !== 'string') return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return isNaN(d.getTime()) ? null : d
}

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000)
}

function todayUTC() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// ── Sport-specific feasibility math ──────────────────────────────────────────

// Daniels VDOT gain rate per 12-week block — mirrors raceGoalEngine private fn
function vdotGainPerBlock(vdot) {
  if (vdot < 35) return 3.5
  if (vdot < 45) return 2.5
  if (vdot < 55) return 1.5
  return 0.8
}

// FTP gain rate (W) per 12-week block (Coggan: ~3-5% for trained, ~8% for novices)
function ftpGainPerBlock(ftpW) {
  if (ftpW < 180) return ftpW * 0.10
  if (ftpW < 240) return ftpW * 0.07
  if (ftpW < 300) return ftpW * 0.05
  return ftpW * 0.03
}

// CSS gain rate (sec/100m faster) per 12-week block.
// Trained swimmers: ~3 s; intermediate: ~5 s; novices (CSS slower than 1:50/100m): ~7 s
function cssGainPerBlock(cssSecPer100m) {
  if (cssSecPer100m > 110) return 7
  if (cssSecPer100m > 90)  return 5
  return 3
}

function feasibilityBand(weeksAvailable, weeksNeeded) {
  if (weeksAvailable >= weeksNeeded * 1.25) return 'comfortable'
  if (weeksAvailable >= weeksNeeded * 0.95) return 'realistic'
  if (weeksAvailable >= weeksNeeded * 0.70) return 'aggressive'
  return 'unrealistic'
}

const BAND_NOTES = {
  comfortable: {
    en: 'Goal is comfortable — sustainable progression',
    tr: 'Hedef rahat — sürdürülebilir ilerleme',
  },
  realistic: {
    en: 'Goal is realistic with consistent training',
    tr: 'Hedef tutarlı antrenmanla gerçekçi',
  },
  aggressive: {
    en: 'Goal is aggressive — execution must be near-perfect',
    tr: 'Hedef agresif — uygulama neredeyse kusursuz olmalı',
  },
  unrealistic: {
    en: 'Goal too aggressive for available time — extend race date or moderate target',
    tr: 'Hedef için zaman yetersiz — yarışı ertele veya hedefi yumuşat',
  },
}

// ── Phase split per total available weeks ────────────────────────────────────
function phaseSplit(weeksAvailable) {
  if (weeksAvailable <= 0) {
    return { Base: 0, Build: 0, Peak: 0, Taper: 0 }
  }
  if (weeksAvailable < 4) {
    return { Base: 0, Build: 0, Peak: Math.max(0, weeksAvailable - 1), Taper: Math.min(1, weeksAvailable) }
  }
  if (weeksAvailable <= 7) {
    const taper = Math.max(1, Math.round(weeksAvailable * 0.20))
    const peak  = Math.max(1, Math.round(weeksAvailable * 0.30))
    const build = Math.max(1, weeksAvailable - peak - taper)
    return { Base: 0, Build: build, Peak: peak, Taper: taper }
  }
  if (weeksAvailable <= 15) {
    const taper = Math.max(1, Math.round(weeksAvailable * 0.10))
    const peak  = Math.max(1, Math.round(weeksAvailable * 0.25))
    const build = Math.max(1, Math.round(weeksAvailable * 0.40))
    const base  = Math.max(0, weeksAvailable - peak - taper - build)
    return { Base: base, Build: build, Peak: peak, Taper: taper }
  }
  // 16+ weeks — taper clamped to 2 weeks
  const taper = 2
  const peak  = Math.max(2, Math.round(weeksAvailable * 0.20))
  const build = Math.max(2, Math.round(weeksAvailable * 0.35))
  const base  = Math.max(2, weeksAvailable - peak - taper - build)
  return { Base: base, Build: build, Peak: peak, Taper: taper }
}

const PHASE_COLORS = {
  Base:  '#0064ff',
  Build: '#00aa66',
  Peak:  '#ff6600',
  Taper: '#9966cc',
}

const PHASE_FOCUS = {
  Base:  'Aerobic base, easy volume, technique',
  Build: 'Threshold and tempo, race-specific load',
  Peak:  'VO2max intervals, race-pace specificity',
  Taper: 'Volume reduction, intensity preserved, freshness',
}

// ── Weekly TSS curve ────────────────────────────────────────────────────────
function buildWeeklyTSS(phasesArr, currentCTL) {
  const baseLow  = currentCTL * 7
  const baseHigh = currentCTL * 8.5
  const buildPk  = currentCTL * 9.5
  const peakHigh = currentCTL * 9.5
  const taperW1  = currentCTL * 6
  const taperW2  = currentCTL * 4
  const raceWk   = currentCTL * 2.5

  const tss = []
  let weekIdx = 0

  for (const ph of phasesArr) {
    const len = ph.weeks.length
    for (let i = 0; i < len; i++) {
      let target
      if (ph.phase === 'Base') {
        target = len > 1 ? baseLow + (baseHigh - baseLow) * (i / (len - 1)) : baseHigh
      } else if (ph.phase === 'Build') {
        target = len > 1 ? baseHigh + (buildPk - baseHigh) * (i / (len - 1)) : buildPk
      } else if (ph.phase === 'Peak') {
        target = peakHigh
      } else { // Taper
        if (i === len - 1) target = raceWk
        else if (i === len - 2 && len >= 2) target = taperW2
        else target = taperW1
      }

      // 3:1 deload — every 4th week of phasesArr position drops to 60% of build target
      const isDeloadCandidate = ph.phase === 'Base' || ph.phase === 'Build'
      if (isDeloadCandidate && (weekIdx + 1) % 4 === 0) {
        target = buildPk * 0.6
      }

      tss.push(Math.round(Math.max(0, target)))
      weekIdx++
    }
  }
  return tss
}

// ── Sample week templates ───────────────────────────────────────────────────
export function fmtPaceStr(secPerKm) {
  if (!secPerKm || secPerKm <= 0) return null
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

export function fmtSwimPace(secPer100) {
  if (!secPer100 || secPer100 <= 0) return null
  const m = Math.floor(secPer100 / 60)
  const s = Math.round(secPer100 % 60)
  return `${m}:${String(s).padStart(2, '0')}/100m`
}

function runSampleWeek(phase, paces, trainingDays) {
  const days = Math.max(3, Math.min(7, trainingDays || 5))
  const long = Math.min(120, 60 + Math.floor(days * 6))
  const easy = 45
  const tempo = 50
  const interval = 55

  const weekByPhase = {
    Base: [
      { day: 'Mon', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null },
      { day: 'Tue', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: easy,     zones: { Z1: easy, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Wed', intent: { en: 'Easy + strides', tr: 'Kolay + adımlar' },durationMin: easy,     zones: { Z1: easy - 5, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },    paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Thu', intent: { en: 'Tempo',        tr: 'Tempo' },            durationMin: tempo,    zones: { Z1: 20, Z2: 5, Z3: 25, Z4: 0, Z5: 0 },         paceTarget: fmtPaceStr(paces?.M) },
      { day: 'Fri', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null },
      { day: 'Sat', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: easy + 5, zones: { Z1: easy + 5, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Sun', intent: { en: 'Long run',     tr: 'Uzun koşu' },        durationMin: long,     zones: { Z1: long - 10, Z2: 10, Z3: 0, Z4: 0, Z5: 0 },  paceTarget: fmtPaceStr(paces?.E) },
    ],
    Build: [
      { day: 'Mon', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null },
      { day: 'Tue', intent: { en: 'Threshold 2x20', tr: 'Eşik 2x20' },      durationMin: tempo + 10, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 40, Z5: 0 },        paceTarget: fmtPaceStr(paces?.T) },
      { day: 'Wed', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: easy,     zones: { Z1: easy, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Thu', intent: { en: 'Cruise intervals', tr: 'Cruise interval' }, durationMin: tempo,  zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 30, Z5: 0 },         paceTarget: fmtPaceStr(paces?.T) },
      { day: 'Fri', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null },
      { day: 'Sat', intent: { en: 'Easy + strides', tr: 'Kolay + adımlar' },durationMin: easy,     zones: { Z1: easy - 5, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },    paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Sun', intent: { en: 'Long run + MP', tr: 'Uzun koşu + MP' },  durationMin: long + 10, zones: { Z1: long - 10, Z2: 20, Z3: 0, Z4: 0, Z5: 0 },  paceTarget: fmtPaceStr(paces?.M) },
    ],
    Peak: [
      { day: 'Mon', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null },
      { day: 'Tue', intent: { en: 'VO2max 6x800m', tr: 'VO2max 6x800m' },   durationMin: interval, zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 30 },         paceTarget: fmtPaceStr(paces?.I) },
      { day: 'Wed', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: easy,     zones: { Z1: easy, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Thu', intent: { en: 'Race-pace 5x1k', tr: 'Yarış-tempo 5x1k' }, durationMin: interval, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 0, Z5: 35 },        paceTarget: fmtPaceStr(paces?.I) },
      { day: 'Fri', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null },
      { day: 'Sat', intent: { en: 'Easy + strides', tr: 'Kolay + adımlar' },durationMin: easy,     zones: { Z1: easy - 5, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },    paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Sun', intent: { en: 'Tempo + strides', tr: 'Tempo + adımlar' }, durationMin: tempo + 5, zones: { Z1: 25, Z2: 0, Z3: 25, Z4: 0, Z5: 5 },        paceTarget: fmtPaceStr(paces?.T) },
    ],
    Taper: [
      { day: 'Mon', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null },
      { day: 'Tue', intent: { en: 'Race-pace 4x400m', tr: 'Yarış-tempo 4x400m' }, durationMin: 35, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 0, Z5: 15 },         paceTarget: fmtPaceStr(paces?.I) },
      { day: 'Wed', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: 30,       zones: { Z1: 30, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },          paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Thu', intent: { en: 'Easy + strides', tr: 'Kolay + adımlar' },durationMin: 30,       zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },          paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Fri', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null },
      { day: 'Sat', intent: { en: 'Pre-race shakeout', tr: 'Yarış öncesi açılış' }, durationMin: 20, zones: { Z1: 18, Z2: 0, Z3: 0, Z4: 0, Z5: 2 },         paceTarget: fmtPaceStr(paces?.E) },
      { day: 'Sun', intent: { en: 'Race day',     tr: 'Yarış günü' },       durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null },
    ],
  }
  const wk = weekByPhase[phase]
  if (!wk) return []
  return wk.slice(0, days < 7 ? Math.max(5, days + 2) : 7).map(d => ({
    ...d,
    notes: { en: `${phase} phase ${d.intent.en.toLowerCase()}`, tr: `${phase} fazı ${d.intent.tr.toLowerCase()}` },
  }))
}

function bikeSampleWeek(phase, zones) {
  // zones is array from getCyclingZones(ftp)
  const ftp = zones && zones.length ? Math.round((zones[3]?.minWatts + zones[3]?.maxWatts) / 2 / 0.975) : null
  const tag = ftp ? `${ftp}W FTP` : null
  const baseDays = {
    Base: [
      { day: 'Mon', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null },
      { day: 'Tue', intent: { en: 'Endurance ride', tr: 'Dayanıklılık sürüşü' }, durationMin: 75,  zones: { Z1: 15, Z2: 60, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag },
      { day: 'Wed', intent: { en: 'Recovery spin',  tr: 'Toparlanma' },         durationMin: 45,  zones: { Z1: 45, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },      paceTarget: tag },
      { day: 'Thu', intent: { en: 'Sweet spot 2x15', tr: 'Sweet spot 2x15' },   durationMin: 75,  zones: { Z1: 25, Z2: 20, Z3: 30, Z4: 0, Z5: 0 },    paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null },
      { day: 'Sat', intent: { en: 'Long ride',      tr: 'Uzun sürüş' },        durationMin: 180, zones: { Z1: 30, Z2: 140, Z3: 10, Z4: 0, Z5: 0 },   paceTarget: tag },
      { day: 'Sun', intent: { en: 'Endurance',      tr: 'Dayanıklılık' },      durationMin: 90,  zones: { Z1: 20, Z2: 70, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag },
    ],
    Build: [
      { day: 'Mon', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null },
      { day: 'Tue', intent: { en: 'Threshold 3x12', tr: 'Eşik 3x12' },         durationMin: 80,  zones: { Z1: 25, Z2: 15, Z3: 0, Z4: 40, Z5: 0 },    paceTarget: tag },
      { day: 'Wed', intent: { en: 'Endurance',      tr: 'Dayanıklılık' },      durationMin: 75,  zones: { Z1: 15, Z2: 60, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag },
      { day: 'Thu', intent: { en: 'Over-unders',    tr: 'Over-under' },        durationMin: 80,  zones: { Z1: 25, Z2: 5, Z3: 20, Z4: 30, Z5: 0 },    paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null },
      { day: 'Sat', intent: { en: 'Long + tempo',   tr: 'Uzun + tempo' },      durationMin: 210, zones: { Z1: 30, Z2: 140, Z3: 40, Z4: 0, Z5: 0 },   paceTarget: tag },
      { day: 'Sun', intent: { en: 'Endurance',      tr: 'Dayanıklılık' },      durationMin: 90,  zones: { Z1: 15, Z2: 75, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag },
    ],
    Peak: [
      { day: 'Mon', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null },
      { day: 'Tue', intent: { en: 'VO2max 5x4',     tr: 'VO2max 5x4' },        durationMin: 70,  zones: { Z1: 25, Z2: 5, Z3: 0, Z4: 0, Z5: 40 },     paceTarget: tag },
      { day: 'Wed', intent: { en: 'Recovery spin',  tr: 'Toparlanma' },        durationMin: 45,  zones: { Z1: 45, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },      paceTarget: tag },
      { day: 'Thu', intent: { en: 'Race-pace efforts', tr: 'Yarış-tempo' },    durationMin: 80,  zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 50, Z5: 10 },    paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null },
      { day: 'Sat', intent: { en: 'Long with race-pace', tr: 'Uzun + yarış tempo' }, durationMin: 180, zones: { Z1: 30, Z2: 100, Z3: 0, Z4: 50, Z5: 0 }, paceTarget: tag },
      { day: 'Sun', intent: { en: 'Endurance',      tr: 'Dayanıklılık' },      durationMin: 75,  zones: { Z1: 15, Z2: 60, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag },
    ],
    Taper: [
      { day: 'Mon', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null },
      { day: 'Tue', intent: { en: 'Openers 4x3',    tr: 'Açılış 4x3' },        durationMin: 50,  zones: { Z1: 25, Z2: 5, Z3: 0, Z4: 15, Z5: 5 },     paceTarget: tag },
      { day: 'Wed', intent: { en: 'Easy spin',      tr: 'Kolay sürüş' },       durationMin: 40,  zones: { Z1: 40, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },      paceTarget: tag },
      { day: 'Thu', intent: { en: 'Short tempo',    tr: 'Kısa tempo' },        durationMin: 45,  zones: { Z1: 20, Z2: 5, Z3: 20, Z4: 0, Z5: 0 },     paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null },
      { day: 'Sat', intent: { en: 'Pre-race shakeout', tr: 'Yarış öncesi' },   durationMin: 30,  zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },      paceTarget: tag },
      { day: 'Sun', intent: { en: 'Race day',       tr: 'Yarış günü' },        durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null },
    ],
  }
  const wk = baseDays[phase]
  if (!wk) return []
  return wk.map(d => ({
    ...d,
    notes: { en: `${phase} phase ${d.intent.en.toLowerCase()}`, tr: `${phase} fazı ${d.intent.tr.toLowerCase()}` },
  }))
}

function swimSampleWeek(phase, cssSec) {
  const tag = fmtSwimPace(cssSec)
  const days = {
    Base: [
      { day: 'Mon', intent: { en: 'Rest',           tr: 'Dinlenme' },           durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', intent: { en: 'Aerobic 2000m',   tr: 'Aerobik 2000m' },     durationMin: 50, zones: { Z1: 30, Z2: 20, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: tag },
      { day: 'Wed', intent: { en: 'Technique 1500m', tr: 'Teknik 1500m' },      durationMin: 40, zones: { Z1: 40, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
      { day: 'Thu', intent: { en: 'CSS 8x100',       tr: 'CSS 8x100' },         durationMin: 45, zones: { Z1: 15, Z2: 0, Z3: 30, Z4: 0, Z5: 0 },   paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Sat', intent: { en: 'Long aerobic 3000m', tr: 'Uzun aerobik 3000m' }, durationMin: 65, zones: { Z1: 35, Z2: 30, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: tag },
      { day: 'Sun', intent: { en: 'Easy 1500m',      tr: 'Kolay 1500m' },        durationMin: 35, zones: { Z1: 35, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
    ],
    Build: [
      { day: 'Mon', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', intent: { en: 'CSS 10x200',       tr: 'CSS 10x200' },        durationMin: 60, zones: { Z1: 15, Z2: 0, Z3: 0, Z4: 45, Z5: 0 },   paceTarget: tag },
      { day: 'Wed', intent: { en: 'Aerobic 2500m',   tr: 'Aerobik 2500m' },     durationMin: 55, zones: { Z1: 25, Z2: 30, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: tag },
      { day: 'Thu', intent: { en: 'Threshold 5x300', tr: 'Eşik 5x300' },        durationMin: 60, zones: { Z1: 15, Z2: 0, Z3: 0, Z4: 45, Z5: 0 },   paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Sat', intent: { en: 'Long aerobic 3500m', tr: 'Uzun aerobik 3500m' }, durationMin: 75, zones: { Z1: 35, Z2: 40, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: tag },
      { day: 'Sun', intent: { en: 'Recovery 1500m',  tr: 'Toparlanma 1500m' },  durationMin: 35, zones: { Z1: 35, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
    ],
    Peak: [
      { day: 'Mon', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', intent: { en: 'VO2max 12x100',   tr: 'VO2max 12x100' },     durationMin: 55, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 0, Z5: 35 },   paceTarget: tag },
      { day: 'Wed', intent: { en: 'Recovery 1500m',  tr: 'Toparlanma 1500m' },  durationMin: 35, zones: { Z1: 35, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
      { day: 'Thu', intent: { en: 'Race-pace 6x400', tr: 'Yarış-tempo 6x400' }, durationMin: 65, zones: { Z1: 15, Z2: 0, Z3: 0, Z4: 35, Z5: 15 },  paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Sat', intent: { en: 'Long with race-pace', tr: 'Uzun + yarış tempo' }, durationMin: 70, zones: { Z1: 25, Z2: 30, Z3: 0, Z4: 15, Z5: 0 }, paceTarget: tag },
      { day: 'Sun', intent: { en: 'Easy 1500m',      tr: 'Kolay 1500m' },        durationMin: 35, zones: { Z1: 35, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
    ],
    Taper: [
      { day: 'Mon', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', intent: { en: 'Race-pace 4x200', tr: 'Yarış-tempo 4x200' }, durationMin: 35, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 10, Z5: 5 },   paceTarget: tag },
      { day: 'Wed', intent: { en: 'Easy 1200m',      tr: 'Kolay 1200m' },        durationMin: 30, zones: { Z1: 30, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
      { day: 'Thu', intent: { en: 'Sharpener 8x50',  tr: 'Keskinleştirme 8x50' }, durationMin: 25, zones: { Z1: 18, Z2: 0, Z3: 0, Z4: 0, Z5: 7 },   paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Sat', intent: { en: 'Pre-race feel',   tr: 'Yarış öncesi his' },  durationMin: 20, zones: { Z1: 18, Z2: 0, Z3: 0, Z4: 0, Z5: 2 },    paceTarget: tag },
      { day: 'Sun', intent: { en: 'Race day',        tr: 'Yarış günü' },         durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
    ],
  }
  const wk = days[phase]
  if (!wk) return []
  return wk.map(d => ({
    ...d,
    notes: { en: `${phase} phase ${d.intent.en.toLowerCase()}`, tr: `${phase} fazı ${d.intent.tr.toLowerCase()}` },
  }))
}

// ── Main orchestrator ───────────────────────────────────────────────────────
export function buildEliteProgram(input) {
  if (!input || typeof input !== 'object') return null
  const { currentPR, targetPR, raceDate, sport } = input
  const profile = input.profile || {}
  const options = input.options || {}

  if (!currentPR || !targetPR || !raceDate || !sport) {
    return null
  }
  if (!['run', 'bike', 'swim', 'triathlon'].includes(sport)) return null

  // Validate PR shapes
  const valPR = (pr) => pr && typeof pr.timeSec === 'number' && pr.timeSec > 0
    && (typeof pr.distanceM === 'number' || pr.distanceM === null || pr.distanceM === undefined)
  if (!valPR(currentPR) || !valPR(targetPR)) return null

  // For run/swim/triathlon and bike-TT mode: targetPR must be faster (smaller timeSec).
  // For bike direct-FTP mode (distanceM === 0 || null), timeSec is wattage and must be larger.
  const bikeDirectFtp = sport === 'bike'
    && (currentPR.distanceM === 0 || currentPR.distanceM === null || currentPR.distanceM === undefined)
  if (!bikeDirectFtp) {
    if (targetPR.timeSec >= currentPR.timeSec) {
      return {
        _rejected: true,
        reason: 'target-not-faster',
        note: {
          en: 'Target time must be faster than current time',
          tr: 'Hedef süre mevcut süreden daha hızlı olmalı',
        },
      }
    }
  } else {
    if (targetPR.timeSec <= currentPR.timeSec) {
      return {
        _rejected: true,
        reason: 'target-not-faster',
        note: {
          en: 'Target FTP must exceed current FTP',
          tr: 'Hedef FTP mevcut FTP\'yi aşmalı',
        },
      }
    }
  }

  // Date math
  const today = options.today ? parseUTCDate(options.today) : todayUTC()
  const race  = parseUTCDate(raceDate)
  if (!today || !race) return null
  const daysAvailable = daysBetween(today, race)
  if (daysAvailable < 0) {
    return {
      _rejected: true,
      reason: 'race-in-past',
      note: {
        en: 'Race date is in the past',
        tr: 'Yarış tarihi geçmişte',
      },
    }
  }

  const weeksAvailable = Math.max(0, Math.floor(daysAvailable / 7))
  const profileWithDefaults = {
    currentCTL: typeof profile.currentCTL === 'number' && profile.currentCTL > 0 ? profile.currentCTL : 50,
    weeklyHours: typeof profile.weeklyHours === 'number' && profile.weeklyHours > 0 ? profile.weeklyHours : 8,
    trainingDays: typeof profile.trainingDays === 'number' && profile.trainingDays >= 3 ? profile.trainingDays : 5,
  }

  // Sport-specific levels and weeksNeeded
  let currentLevel = { vdot: null, ftp: null, css: null, paces: null }
  let targetLevel  = { vdot: null, ftp: null, css: null, paces: null }
  let weeksNeeded  = 0
  let deltaPct     = 0

  if (sport === 'run' || sport === 'triathlon') {
    const dist = currentPR.distanceM || 10000
    const tDist = targetPR.distanceM || dist
    const cVdot = vdotFromRace(dist, currentPR.timeSec)
    const gVdot = vdotFromRace(tDist, targetPR.timeSec)
    if (!cVdot || !gVdot) return null
    const gap = Math.max(0, gVdot - cVdot)
    const rate = vdotGainPerBlock(cVdot)
    weeksNeeded = Math.max(4, Math.ceil((gap / rate) * 12))
    deltaPct = ((currentPR.timeSec - targetPR.timeSec) / currentPR.timeSec) * 100
    currentLevel = {
      vdot: Math.round(cVdot * 10) / 10,
      ftp: null, css: null,
      paces: trainingPaces(cVdot),
    }
    targetLevel = {
      vdot: Math.round(gVdot * 10) / 10,
      ftp: null, css: null,
      paces: trainingPaces(gVdot),
    }
  } else if (sport === 'bike') {
    // Convention: currentPR.distanceM === 0 → currentPR.timeSec is FTP wattage directly.
    // Otherwise treat as TT and back-derive FTP from a baseline 35km/h-at-FTP heuristic.
    let cFtp = null, gFtp = null
    if (currentPR.distanceM === 0 || currentPR.distanceM === null) {
      cFtp = currentPR.timeSec  // wattage
      gFtp = targetPR.timeSec
    } else {
      // Reverse the predictCyclingTime simplification: baseSpeedKmh=35 → distanceKm/timeHr * (ftp/250)
      // Approximation: ftp ≈ 250 * (distanceKm / timeHr) / 35
      const cSpeed = (currentPR.distanceM / 1000) / (currentPR.timeSec / 3600)
      const gSpeed = (targetPR.distanceM / 1000) / (targetPR.timeSec / 3600)
      cFtp = Math.round(250 * cSpeed / 35)
      gFtp = Math.round(250 * gSpeed / 35)
    }
    if (!cFtp || !gFtp || cFtp <= 0 || gFtp <= 0) return null
    if (gFtp <= cFtp) {
      return {
        _rejected: true,
        reason: 'target-not-faster',
        note: {
          en: 'Target FTP must exceed current FTP',
          tr: 'Hedef FTP mevcut FTP\'yi aşmalı',
        },
      }
    }
    const gap = gFtp - cFtp
    const rate = ftpGainPerBlock(cFtp)
    weeksNeeded = Math.max(4, Math.ceil((gap / rate) * 12))
    deltaPct = ((gFtp - cFtp) / cFtp) * 100
    currentLevel = { vdot: null, ftp: cFtp, css: null, paces: getCyclingZones(cFtp) }
    targetLevel  = { vdot: null, ftp: gFtp, css: null, paces: getCyclingZones(gFtp) }
  } else if (sport === 'swim') {
    const cDist = currentPR.distanceM || 1500
    const gDist = targetPR.distanceM || cDist
    const cPace = tPaceFromTT(cDist, currentPR.timeSec)
    const gPace = tPaceFromTT(gDist, targetPR.timeSec)
    if (!cPace || !gPace) return null
    // sec/100m: lower = faster
    const gap = cPace - gPace
    const rate = cssGainPerBlock(cPace)
    weeksNeeded = Math.max(4, Math.ceil((gap / rate) * 12))
    deltaPct = ((cPace - gPace) / cPace) * 100
    const cMs = 100 / cPace
    const gMs = 100 / gPace
    currentLevel = {
      vdot: null, ftp: null,
      css: cssToSecPer100m(cMs),
      paces: swimmingZones(cPace),
    }
    targetLevel = {
      vdot: null, ftp: null,
      css: cssToSecPer100m(gMs),
      paces: swimmingZones(gPace),
    }
  }

  const band = feasibilityBand(weeksAvailable, weeksNeeded)

  // Phase split
  const split = phaseSplit(weeksAvailable)
  const phases = []
  let weekCounter = 1
  for (const phaseName of ['Base', 'Build', 'Peak', 'Taper']) {
    const len = split[phaseName] || 0
    if (len <= 0) continue
    const weeks = []
    for (let i = 0; i < len; i++) {
      weeks.push(weekCounter++)
    }
    phases.push({
      phase: phaseName,
      weeks,
      focus: PHASE_FOCUS[phaseName],
      color: PHASE_COLORS[phaseName],
    })
  }

  // Weekly TSS curve
  const weeklyTSS = weeksAvailable > 0
    ? buildWeeklyTSS(phases, profileWithDefaults.currentCTL)
    : []
  // Pad if rounding produced shortfall
  while (weeklyTSS.length < weeksAvailable) weeklyTSS.push(0)
  while (weeklyTSS.length > weeksAvailable) weeklyTSS.pop()

  // Sample weeks per phase
  const sampleWeeks = { Base: [], Build: [], Peak: [], Taper: [] }
  const phasePresent = new Set(phases.map(p => p.phase))
  for (const phaseName of ['Base', 'Build', 'Peak', 'Taper']) {
    if (!phasePresent.has(phaseName)) {
      sampleWeeks[phaseName] = []
      continue
    }
    if (sport === 'run' || sport === 'triathlon') {
      sampleWeeks[phaseName] = runSampleWeek(phaseName, currentLevel.paces, profileWithDefaults.trainingDays)
    } else if (sport === 'bike') {
      sampleWeeks[phaseName] = bikeSampleWeek(phaseName, currentLevel.paces)
    } else if (sport === 'swim') {
      sampleWeeks[phaseName] = swimSampleWeek(phaseName, currentLevel.css)
    }
  }

  // Recommendation — bilingual, with caveats for unrealistic profile params
  const recBaseEn = BAND_NOTES[band].en
  const recBaseTr = BAND_NOTES[band].tr
  const flags = []
  const flagsTr = []
  if (profileWithDefaults.weeklyHours < 3 || profileWithDefaults.weeklyHours > 25) {
    flags.push('Weekly training hours outside the 3-25 h reasonable band')
    flagsTr.push('Haftalık antrenman saatleri 3-25 sa aralığının dışında')
  }
  if (weeksAvailable < 7) {
    flags.push('Race window <7 weeks — degraded mode (no Base, taper-focused)')
    flagsTr.push('Yarış penceresi <7 hafta — sınırlı mod (Base yok, taper odaklı)')
  }
  if (sport === 'triathlon' && !input.triathlonPRs) {
    flags.push('Triathlon mode using run-only feasibility (no per-discipline PRs supplied)')
    flagsTr.push('Triatlon modu sadece koşu fizibilitesi kullanıyor (disiplin başına PR yok)')
  }
  const recommendation = {
    en: flags.length ? `${recBaseEn}. ${flags.join('; ')}` : recBaseEn,
    tr: flagsTr.length ? `${recBaseTr}. ${flagsTr.join('; ')}` : recBaseTr,
  }

  return {
    feasibility: {
      band,
      weeksAvailable,
      weeksNeeded,
      deltaPct: Math.round(deltaPct * 10) / 10,
      note: BAND_NOTES[band],
    },
    sport,
    currentLevel,
    targetLevel,
    phases,
    weeklyTSS,
    sampleWeeks,
    recommendation,
    citation: CITATION,
    reliable: band !== 'unrealistic',
  }
}
