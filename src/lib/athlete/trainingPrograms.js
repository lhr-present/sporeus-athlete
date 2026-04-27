// src/lib/athlete/trainingPrograms.js — E90
// STATIC training program library. Programs are curated week templates, not generated.
// Structure is fixed (authored); only the pace targets fill in from the athlete's current VDOT.
//
// Rule: programs are named products, not algorithmic output. A coach or expert reviews
// each program before it becomes active (see coachConfirmFlow.js).
//
// Sources: Daniels J. (2014). Daniels' Running Formula (3rd ed.) Human Kinetics.
//          Pfitzinger P. & Douglas S. (2009). Advanced Marathoning (2nd ed.)

import { trainingPaces } from '../sport/running.js'

function fmt(secKm) {
  if (!secKm || secKm <= 0) return null
  return `${Math.floor(secKm / 60)}:${String(Math.round(secKm % 60)).padStart(2, '0')}/km`
}

// ── Week pattern definitions ───────────────────────────────────────────────────
// Each pattern is 7 sessions (Sun-Sat). Sessions with zone=null are rest/cross.
// durMin is the TARGET duration — coach may adjust.
const P = {
  // ── Base patterns ─────────────────────────────────────────────
  BASE_E1: {
    tss: 220,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 30min',      tr: 'Kolay Koşu 30dk',               zone: 'E',  durMin: 30 },
      { type: 'Easy Run 40min',      tr: 'Kolay Koşu 40dk',               zone: 'E',  durMin: 40 },
      { type: 'Easy Run 30min',      tr: 'Kolay Koşu 30dk',               zone: 'E',  durMin: 30 },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 45min',      tr: 'Kolay Koşu 45dk',               zone: 'E',  durMin: 45 },
      { type: 'Long Run 60min',      tr: 'Uzun Koşu 60dk',                zone: 'E',  durMin: 60 },
    ],
  },
  BASE_E2: {
    tss: 250,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy + Strides 6×',  tr: 'Kolay + 6×100m Adım',          zone: 'E',  durMin: 40, detail: '6×100m strides (R pace) after easy portion' },
      { type: 'Easy Run 45min',      tr: 'Kolay Koşu 45dk',               zone: 'E',  durMin: 45 },
      { type: 'Easy + Strides 6×',  tr: 'Kolay + 6×100m Adım',          zone: 'E',  durMin: 40, detail: '6×100m strides (R pace) after easy portion' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 50min',      tr: 'Kolay Koşu 50dk',               zone: 'E',  durMin: 50 },
      { type: 'Long Run 75min',      tr: 'Uzun Koşu 75dk',                zone: 'E',  durMin: 75 },
    ],
  },
  BASE_T1: {
    tss: 280,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 20min',        tr: 'T-tempo 20dk',                  zone: 'T',  durMin: 20, detail: '10min E warm-up + 20min T continuous + 10min E cool-down' },
      { type: 'Easy Run 40min',      tr: 'Kolay Koşu 40dk',               zone: 'E',  durMin: 40 },
      { type: 'Cruise 3×10min',      tr: 'Cruise İnterval 3×10dk',        zone: 'T',  durMin: 30, detail: '3×10min T with 2min jog between; 10min E warmup+cooldown' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 45min',      tr: 'Kolay Koşu 45dk',               zone: 'E',  durMin: 45 },
      { type: 'Long Run 80min',      tr: 'Uzun Koşu 80dk',                zone: 'E',  durMin: 80 },
    ],
  },
  BASE_T2: {
    tss: 300,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 25min',        tr: 'T-tempo 25dk',                  zone: 'T',  durMin: 25, detail: '10min E + 25min T continuous + 10min E' },
      { type: 'Easy Run 45min',      tr: 'Kolay Koşu 45dk',               zone: 'E',  durMin: 45 },
      { type: 'Cruise 4×10min',      tr: 'Cruise İnterval 4×10dk',        zone: 'T',  durMin: 40, detail: '4×10min T with 2min jog; 10min E warmup+cooldown' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 50min',      tr: 'Kolay Koşu 50dk',               zone: 'E',  durMin: 50 },
      { type: 'Long Run 90min',      tr: 'Uzun Koşu 90dk',                zone: 'E',  durMin: 90 },
    ],
  },
  // ── Build patterns ─────────────────────────────────────────────
  BUILD_TI1: {
    tss: 320,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 20min',        tr: 'T-tempo 20dk',                  zone: 'T',  durMin: 20, detail: '10min E + 20min T + 10min E' },
      { type: 'Easy Run 40min',      tr: 'Kolay Koşu 40dk',               zone: 'E',  durMin: 40 },
      { type: 'Intervals 5×1000m',   tr: '5×1000m İnterval',              zone: 'I',  durMin: 30, detail: '5×1000m at I pace; rest = rep time; 10min E warmup+cooldown' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 45min',      tr: 'Kolay Koşu 45dk',               zone: 'E',  durMin: 45 },
      { type: 'Long Run 90min',      tr: 'Uzun Koşu 90dk',                zone: 'E',  durMin: 90 },
    ],
  },
  BUILD_TI2: {
    tss: 340,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 25min',        tr: 'T-tempo 25dk',                  zone: 'T',  durMin: 25, detail: '10min E + 25min T + 10min E' },
      { type: 'Easy Run 45min',      tr: 'Kolay Koşu 45dk',               zone: 'E',  durMin: 45 },
      { type: 'Intervals 6×1000m',   tr: '6×1000m İnterval',              zone: 'I',  durMin: 35, detail: '6×1000m at I pace; rest = rep time; 10min E warmup+cooldown' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy + Strides 6×',  tr: 'Kolay + 6×100m Adım',          zone: 'E',  durMin: 45 },
      { type: 'Long Run 100min',     tr: 'Uzun Koşu 100dk',               zone: 'E',  durMin: 100 },
    ],
  },
  BUILD_M1: {  // Marathon-specific build
    tss: 350,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 20min',        tr: 'T-tempo 20dk',                  zone: 'T',  durMin: 20, detail: '10min E + 20min T + 10min E' },
      { type: 'Easy Run 50min',      tr: 'Kolay Koşu 50dk',               zone: 'E',  durMin: 50 },
      { type: 'M-pace 30min',        tr: 'Maraton Temposu 30dk',          zone: 'M',  durMin: 30, detail: '10min E + 30min M pace + 10min E' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 50min',      tr: 'Kolay Koşu 50dk',               zone: 'E',  durMin: 50 },
      { type: 'Long Run 110min',     tr: 'Uzun Koşu 110dk',               zone: 'E',  durMin: 110 },
    ],
  },
  BUILD_M2: {
    tss: 380,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 25min',        tr: 'T-tempo 25dk',                  zone: 'T',  durMin: 25, detail: '10min E + 25min T + 10min E' },
      { type: 'Easy Run 50min',      tr: 'Kolay Koşu 50dk',               zone: 'E',  durMin: 50 },
      { type: 'M-pace 45min',        tr: 'Maraton Temposu 45dk',          zone: 'M',  durMin: 45, detail: '10min E + 45min M pace + 10min E' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 50min',      tr: 'Kolay Koşu 50dk',               zone: 'E',  durMin: 50 },
      { type: 'Long Run 120min',     tr: 'Uzun Koşu 120dk',               zone: 'E',  durMin: 120 },
    ],
  },
  // ── Peak patterns ──────────────────────────────────────────────
  PEAK_TIR: {
    tss: 360,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 20min',        tr: 'T-tempo 20dk',                  zone: 'T',  durMin: 20, detail: '10min E + 20min T + 10min E' },
      { type: 'Easy Run 40min',      tr: 'Kolay Koşu 40dk',               zone: 'E',  durMin: 40 },
      { type: 'Intervals 5×1200m',   tr: '5×1200m İnterval',              zone: 'I',  durMin: 35, detail: '5×1200m at I pace; rest = rep time; 10min E warmup+cooldown' },
      { type: 'Reps 8×200m',         tr: '8×200m Tekrar',                 zone: 'R',  durMin: 20, detail: '8×200m at R pace; full recovery between; 10min E warmup' },
      { type: 'Easy Run 40min',      tr: 'Kolay Koşu 40dk',               zone: 'E',  durMin: 40 },
      { type: 'Long Run 90min',      tr: 'Uzun Koşu 90dk',                zone: 'E',  durMin: 90 },
    ],
  },
  PEAK_RACE_SIM: {
    tss: 350,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 20min',        tr: 'T-tempo 20dk',                  zone: 'T',  durMin: 20, detail: '10min E + 20min T + 10min E' },
      { type: 'Easy Run 40min',      tr: 'Kolay Koşu 40dk',               zone: 'E',  durMin: 40 },
      { type: 'Race Simulation 5K',  tr: '5K Yarış Simülasyonu',          zone: 'I',  durMin: 25, detail: '10min E + 5K at I/race pace + 10min E — practice race-day routine' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy + Strides 6×',  tr: 'Kolay + 6×100m Adım',          zone: 'E',  durMin: 40 },
      { type: 'Long Run 80min',      tr: 'Uzun Koşu 80dk',                zone: 'E',  durMin: 80 },
    ],
  },
  PEAK_M_RACE_SIM: {
    tss: 380,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 20min',        tr: 'T-tempo 20dk',                  zone: 'T',  durMin: 20, detail: '10min E + 20min T + 10min E' },
      { type: 'Easy Run 50min',      tr: 'Kolay Koşu 50dk',               zone: 'E',  durMin: 50 },
      { type: 'M-pace 60min',        tr: 'Maraton Temposu 60dk',          zone: 'M',  durMin: 60, detail: '10min E + 60min M pace (race simulation) + 10min E' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 45min',      tr: 'Kolay Koşu 45dk',               zone: 'E',  durMin: 45 },
      { type: 'Long Run 130min',     tr: 'Uzun Koşu 130dk',               zone: 'E',  durMin: 130 },
    ],
  },
  // ── Deload patterns ────────────────────────────────────────────
  DELOAD_BASE: {
    tss: 150,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 25min',      tr: 'Kolay Koşu 25dk',               zone: 'E',  durMin: 25 },
      { type: 'Easy Run 30min',      tr: 'Kolay Koşu 30dk',               zone: 'E',  durMin: 30 },
      { type: 'Easy Run 25min',      tr: 'Kolay Koşu 25dk',               zone: 'E',  durMin: 25 },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 30min',      tr: 'Kolay Koşu 30dk',               zone: 'E',  durMin: 30 },
      { type: 'Long Run 50min',      tr: 'Uzun Koşu 50dk',                zone: 'E',  durMin: 50 },
    ],
  },
  DELOAD_BUILD: {
    tss: 180,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 15min',        tr: 'T-tempo 15dk',                  zone: 'T',  durMin: 15, detail: '10min E + 15min T + 10min E — recovery week, keep sharpness' },
      { type: 'Easy Run 35min',      tr: 'Kolay Koşu 35dk',               zone: 'E',  durMin: 35 },
      { type: 'Easy Run 30min',      tr: 'Kolay Koşu 30dk',               zone: 'E',  durMin: 30 },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 35min',      tr: 'Kolay Koşu 35dk',               zone: 'E',  durMin: 35 },
      { type: 'Long Run 60min',      tr: 'Uzun Koşu 60dk',                zone: 'E',  durMin: 60 },
    ],
  },
  // ── Taper patterns ─────────────────────────────────────────────
  TAPER_1: {
    tss: 200,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'T-pace 15min',        tr: 'T-tempo 15dk',                  zone: 'T',  durMin: 15, detail: '10min E + 15min T + 10min E' },
      { type: 'Easy Run 35min',      tr: 'Kolay Koşu 35dk',               zone: 'E',  durMin: 35 },
      { type: 'Intervals 3×1000m',   tr: '3×1000m İnterval',              zone: 'I',  durMin: 20, detail: '3×1000m I pace — maintain sharpness, volume down 30%' },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy + Strides 4×',  tr: 'Kolay + 4×100m Adım',          zone: 'E',  durMin: 30 },
      { type: 'Long Run 60min',      tr: 'Uzun Koşu 60dk',                zone: 'E',  durMin: 60 },
    ],
  },
  TAPER_FINAL: {
    tss: 130,
    sessions: [
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 30min',      tr: 'Kolay Koşu 30dk',               zone: 'E',  durMin: 30 },
      { type: 'Easy + Strides 4×',  tr: 'Kolay + 4×100m Adım',          zone: 'E',  durMin: 25 },
      { type: 'Easy Run 20min',      tr: 'Kolay Koşu 20dk',               zone: 'E',  durMin: 20 },
      { type: 'Rest',                tr: 'Dinlenme',                      zone: null, durMin: 0  },
      { type: 'Easy Run 20min',      tr: 'Kolay Koşu 20dk',               zone: 'E',  durMin: 20 },
      { type: 'Race Day',            tr: 'Yarış Günü',                    zone: null, durMin: 0,  detail: 'Race day — trust the training.' },
    ],
  },
}

// ── Static Program Definitions ────────────────────────────────────────────────
// sequence: array of [patternKey, phase, phaseTR, isDeload, themeEN, themeTR]
export const PROGRAMS = {

  '10k-24w': {
    id:          '10k-24w',
    name:        '10K — Daniels 24 Hafta',
    nameTR:      '10K — Daniels 24 Haftalık Program',
    distanceM:   10000,
    weeks:       24,
    vdotMin:     28,
    vdotMax:     52,
    descEN:      'Classic Daniels 10K program. Four phases: aerobic base, threshold development, VO₂max intervals, taper. 3:1 load:recovery ratio throughout.',
    descTR:      'Klasik Daniels 10K programı. Dört faz: aerobik taban, eşik gelişimi, VO₂maks intervaller, taper. Sürekli 3:1 yük:toparlanma oranı.',
    coachNote:   'Interval günleri ekstra 10 dk ısınma gerektirir. Hasta veya yorgunsa E→Rest dönüşümü uygulayın.',
    sequence: [
      // Phase I: Base (Weeks 1–8)
      ['BASE_E1',   'Base', 'Baz', false, 'Aerobic base — easy running only, build volume.',           'Aerobik taban — sadece kolay koşu, hacim artışı.'],
      ['BASE_E1',   'Base', 'Baz', false, 'Aerobic base — add a second easy run day.',                 'Aerobik taban — ikinci kolay koşu gününü ekle.'],
      ['BASE_E2',   'Base', 'Baz', false, 'Aerobic base — strides to maintain leg turnover.',          'Aerobik taban — adımlarla bacak ritmi.'],
      ['DELOAD_BASE','Base','Baz', true,  'Recovery week — drop volume 35%, keep movement.',           'Toparlanma haftası — hacmi %35 düşür.'],
      ['BASE_T1',   'Base', 'Baz', false, 'Introduce threshold — first quality stimulus.',              'Eşik başlangıcı — ilk kalite uyarımı.'],
      ['BASE_T1',   'Base', 'Baz', false, 'Threshold — build continuous T-run duration.',              'Eşik — sürekli T-koşu süresini artır.'],
      ['BASE_T2',   'Base', 'Baz', false, 'Threshold — longer T-run + cruise intervals.',              'Eşik — uzun T-koşu + cruise interval.'],
      ['DELOAD_BASE','Base','Baz', true,  'Recovery week — absorb Phase I adaptations.',               'Toparlanma — Faz I uyumlarını absorbe et.'],
      // Phase II: Build (Weeks 9–16)
      ['BUILD_TI1', 'Build','Yapı',false, 'Introduce VO₂max intervals — 5×1000m.',                    'VO₂maks interval başlangıcı — 5×1000m.'],
      ['BUILD_TI1', 'Build','Yapı',false, 'Build interval confidence — same sessions, better form.',   'İnterval güveni — aynı seans, daha iyi form.'],
      ['BUILD_TI2', 'Build','Yapı',false, 'Progress to 6×1000m — key quality week.',                  'İlerle: 6×1000m — kilit kalite haftası.'],
      ['DELOAD_BUILD','Build','Yapı',true,'Recovery week — keep threshold, drop interval.',            'Toparlanma — eşiği koru, interval düşür.'],
      ['BUILD_TI2', 'Build','Yapı',false, 'T + Intervals — peak build volume.',                       'T + İnterval — yapı faz zirve hacmi.'],
      ['BUILD_TI2', 'Build','Yapı',false, 'T + Intervals — race-specific fitness building.',          'T + İnterval — yarışa özgü kondisyon.'],
      ['BUILD_TI2', 'Build','Yapı',false, 'T + Intervals — final build stimulus.',                    'T + İnterval — son yapı uyarımı.'],
      ['DELOAD_BUILD','Build','Yapı',true,'Recovery week — consolidate Build phase gains.',           'Toparlanma — Yapı faz kazanımlarını pekiştir.'],
      // Phase III: Peak (Weeks 17–22)
      ['PEAK_TIR',  'Peak', 'Zirve',false,'Peak phase — T + Intervals + Reps for full stimulus.',    'Zirve fazı — T + İnterval + Tekrar tam uyarım.'],
      ['PEAK_TIR',  'Peak', 'Zirve',false,'Peak — highest quality week of the program.',             'Zirve — programın en yüksek kalite haftası.'],
      ['PEAK_RACE_SIM','Peak','Zirve',false,'Race simulation — practice race day routine.',          'Yarış simülasyonu — yarış günü rutinini dene.'],
      ['DELOAD_BUILD','Peak','Zirve',true,'Recovery week — keep race sharpness.',                    'Toparlanma — yarış keskinliğini koru.'],
      ['PEAK_RACE_SIM','Peak','Zirve',false,'Race simulation — final practice race.',               'Yarış simülasyonu — son pratik yarış.'],
      ['PEAK_TIR',  'Peak', 'Zirve',false,'Final peak stimulus before taper.',                     'Taper öncesi son zirve uyarımı.'],
      // Phase IV: Taper (Weeks 23–24)
      ['TAPER_1',   'Taper','Taper',false,'Taper — volume down 30%, intensity maintained.',         'Taper — hacim %30 düşüyor, yoğunluk korunuyor.'],
      ['TAPER_FINAL','Taper','Taper',false,'Race week — easy running, stay fresh, race day.',       'Yarış haftası — kolay koşu, taze kal, yarış.'],
    ],
  },

  'hm-18w': {
    id:          'hm-18w',
    name:        'Yarı Maraton — 18 Hafta',
    nameTR:      'Yarı Maraton — 18 Haftalık Program',
    distanceM:   21097,
    weeks:       18,
    vdotMin:     32,
    vdotMax:     58,
    descEN:      '18-week half marathon program. Emphasis on threshold development and long run progression to 90 minutes. VO₂max intervals in build phase.',
    descTR:      '18 haftalık yarı maraton programı. Eşik gelişimi ve 90 dakikaya çıkan uzun koşu progressyonu. Yapı fazında VO₂maks intervallar.',
    coachNote:   'Uzun koşu yavaş tutun (E hızının üstüne çıkmayın). T seanslarında son 5 dakikada koşucunun konuşabilmesi gerekir.',
    sequence: [
      // Base (Weeks 1–6)
      ['BASE_E1',   'Base', 'Baz', false, 'Build aerobic base — easy running foundation.',             'Aerobik taban — kolay koşu temeli.'],
      ['BASE_E2',   'Base', 'Baz', false, 'Add strides — maintain leg speed during base.',             'Adım ekle — taban fazında bacak hızını koru.'],
      ['BASE_T1',   'Base', 'Baz', false, 'First threshold stimulus.',                                 'İlk eşik uyarımı.'],
      ['DELOAD_BASE','Base','Baz', true,  'Recovery week.',                                             'Toparlanma haftası.'],
      ['BASE_T2',   'Base', 'Baz', false, 'Threshold development — longer T work.',                   'Eşik gelişimi — daha uzun T çalışması.'],
      ['BASE_T2',   'Base', 'Baz', false, 'Threshold — consolidate base fitness.',                    'Eşik — taban kondisyonunu pekiştir.'],
      // Build (Weeks 7–12)
      ['BUILD_TI1', 'Build','Yapı',false, 'Introduce intervals — VO₂max development.',               'İnterval başlangıcı — VO₂maks gelişimi.'],
      ['BUILD_TI2', 'Build','Yapı',false, 'Increase interval volume.',                                'İnterval hacmini artır.'],
      ['BUILD_TI2', 'Build','Yapı',false, 'Peak build — key quality week.',                          'Zirve yapı — kilit kalite haftası.'],
      ['DELOAD_BUILD','Build','Yapı',true,'Recovery week — keep sharpness.',                         'Toparlanma — keskinliği koru.'],
      ['BUILD_TI2', 'Build','Yapı',false, 'Race-specific fitness — HM threshold work.',              'Yarışa özgü kondisyon — HM eşik çalışması.'],
      ['BUILD_TI2', 'Build','Yapı',false, 'Final build stimulus.',                                   'Son yapı uyarımı.'],
      // Peak (Weeks 13–16)
      ['PEAK_TIR',  'Peak', 'Zirve',false,'Peak — full quality stimulus.',                          'Zirve — tam kalite uyarımı.'],
      ['PEAK_RACE_SIM','Peak','Zirve',false,'Race simulation — HM pace practice.',                  'Yarış simülasyonu — HM hız pratiği.'],
      ['PEAK_TIR',  'Peak', 'Zirve',false,'Peak — final race-fitness stimulus.',                   'Zirve — son yarış kondisyon uyarımı.'],
      ['DELOAD_BUILD','Peak','Zirve',true,'Recovery week — prepare for taper.',                     'Toparlanma — tapera hazırlan.'],
      // Taper (Weeks 17–18)
      ['TAPER_1',   'Taper','Taper',false,'Taper — reduce volume, maintain intensity.',             'Taper — hacmi azalt, yoğunluğu koru.'],
      ['TAPER_FINAL','Taper','Taper',false,'Race week — trust the fitness you built.',              'Yarış haftası — kazandığın kondisyona güven.'],
    ],
  },

  'marathon-18w': {
    id:          'marathon-18w',
    name:        'Maraton — 18 Hafta',
    nameTR:      'Maraton — 18 Haftalık Program',
    distanceM:   42195,
    weeks:       18,
    vdotMin:     35,
    vdotMax:     65,
    descEN:      '18-week marathon program. Long run progression to 130min, M-pace work in build phase, race simulation in peak. Designed for 3:30–4:30 runners.',
    descTR:      '18 haftalık maraton programı. 130dk uzun koşu progressyonu, yapı fazında M-tempo, zirvede yarış simülasyonu. 3:30–4:30 koşucular için.',
    coachNote:   'M-tempo günlerinde KAH %80-87 aralığında tutun. Uzun koşu hiçbir zaman M hızının üstüne çıkmamalı.',
    sequence: [
      // Base (Weeks 1–6)
      ['BASE_E1',   'Base', 'Baz', false, 'Easy aerobic base — building weekly volume.',              'Kolay aerobik taban — haftalık hacim artışı.'],
      ['BASE_E2',   'Base', 'Baz', false, 'Easy + strides — leg turnover maintenance.',               'Kolay + adım — bacak devir hızı koruması.'],
      ['BASE_T1',   'Base', 'Baz', false, 'Introduce threshold — aerobic base with quality.',         'Eşik başlangıcı — kaliteli aerobik taban.'],
      ['DELOAD_BASE','Base','Baz', true,  'Recovery week.',                                            'Toparlanma haftası.'],
      ['BASE_T2',   'Base', 'Baz', false, 'Threshold development.',                                   'Eşik gelişimi.'],
      ['BUILD_M1',  'Base', 'Baz', false, 'Introduce marathon pace work — race-specific.',           'Maraton temposu başlangıcı — yarışa özgü.'],
      // Build (Weeks 7–12)
      ['BUILD_M1',  'Build','Yapı',false, 'Marathon pace build — longer M-pace section.',            'Maraton temposu yapısı — daha uzun M-tempo.'],
      ['BUILD_M2',  'Build','Yapı',false, 'Increase M-pace volume + longer long run.',               'M-tempo hacmini ve uzun koşuyu artır.'],
      ['BUILD_M2',  'Build','Yapı',false, 'Peak build week — M-pace + long run.',                   'Zirve yapı haftası — M-tempo + uzun koşu.'],
      ['DELOAD_BUILD', 'Build', 'Yapı', true, 'Recovery week — consolidate build fitness.',          'Toparlanma — yapı kondisyonunu pekiştir.'],
      ['BUILD_M2',  'Build','Yapı',false, 'Race-specific — M-pace endurance.',                      'Yarışa özgü — M-tempo dayanıklılığı.'],
      ['BUILD_M2',  'Build','Yapı',false, 'Final build stimulus — highest volume week.',            'Son yapı uyarımı — en yüksek hacim haftası.'],
      // Peak (Weeks 13–16)
      ['PEAK_M_RACE_SIM','Peak','Zirve',false,'Race simulation — 60min M-pace practice.',          'Yarış simülasyonu — 60dk M-tempo pratiği.'],
      ['PEAK_TIR',  'Peak', 'Zirve',false, 'Peak quality — T + I + R.',                            'Zirve kalite — T + İ + R.'],
      ['PEAK_M_RACE_SIM','Peak','Zirve',false,'Final race simulation.',                            'Son yarış simülasyonu.'],
      ['DELOAD_BUILD', 'Peak', 'Zirve', true, 'Recovery week — prepare for taper.',                 'Toparlanma — tapera hazırlan.'],
      // Taper (Weeks 17–18)
      ['TAPER_1',   'Taper','Taper',false, 'Taper — protect fitness, reduce fatigue.',              'Taper — kondisyonu koru, yorgunluğu azalt.'],
      ['TAPER_FINAL','Taper','Taper',false,'Race week — execute the plan.',                         'Yarış haftası — planı uygula.'],
    ],
  },
}

// ── Build a full week array from a program ────────────────────────────────────
/**
 * Expands a static program into a full week-by-week plan with pace targets filled
 * in from the athlete's current VDOT. Structure is hardcoded; only pace values change.
 *
 * @param {string} programId   Key from PROGRAMS
 * @param {number} vdot        Athlete's current VDOT
 * @param {string} planStart   'YYYY-MM-DD'
 * @returns {Array | null}     Array of week objects, or null if invalid input
 */
export function buildStaticPlan(programId, vdot, planStart) {
  const prog = PROGRAMS[programId]
  if (!prog || !vdot || !planStart) return null

  const paces = trainingPaces(vdot)
  if (!paces) return null

  const start = new Date(planStart + 'T12:00:00Z')

  return prog.sequence.map(([patternKey, phase, phaseTR, isDeload, themeEN, themeTR], idx) => {
    const pattern = P[patternKey]
    if (!pattern) return null

    const weekStart = new Date(start)
    weekStart.setUTCDate(weekStart.getUTCDate() + idx * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)

    const sessions = pattern.sessions.map(s => {
      const paceSecKm = s.zone ? paces[s.zone] : null
      return {
        ...s,
        paceStr: paceSecKm ? fmt(paceSecKm) : null,
        paceSecKm,
      }
    })

    return {
      weekNum:    idx + 1,
      phase,
      phaseTR,
      isDeload,
      tss:        isDeload ? Math.round(pattern.tss * 0.6) : pattern.tss,
      en:         themeEN,
      tr:         themeTR,
      startDate:  weekStart.toISOString().slice(0, 10),
      endDate:    weekEnd.toISOString().slice(0, 10),
      sessions,
      patternKey,
    }
  }).filter(Boolean)
}

/**
 * Find the week a given date falls in, same API as getCurrentPlanWeek in trainingBridge.js
 */
export function getCurrentStaticWeek(plan, today) {
  if (!plan?.length || !today) return null
  if (today < plan[0].startDate) return { week: plan[0], weekIdx: 0 }
  if (today > plan[plan.length - 1].endDate) return { week: plan[plan.length - 1], weekIdx: plan.length - 1 }
  const idx = plan.findIndex(w => today >= w.startDate && today <= w.endDate)
  return idx >= 0 ? { week: plan[idx], weekIdx: idx } : null
}
