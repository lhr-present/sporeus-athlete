// ─── eliteProgramCohorts.js — Athlete-level dose personalization (v9.11.0) ───
//
// Closes Mission #1 re-audit's "no dose-matching by ability" gap. Pre-v9.11.0
// every key session prescribed identical reps/intensities regardless of
// athlete level — a 50:00 10k runner and a sub-30 10k runner both got
// "Pogo hops 4x5" and "Long aerobic 60-150 min". Real coaches calibrate by
// ability cohort. v9.11.0 exposes `cohorts: { beginner, intermediate, elite }`
// overrides per session and selects the right cohort from currentLevel.
//
// Cohort thresholds (literature-calibrated):
//   run / triathlon  : VDOT < 38 = beginner ; 38-50 = intermediate ; > 50 = elite
//   bike             : FTP  < 200 W = beginner ; 200-300 = intermediate ; > 300 = elite
//   swim             : CSS  > 110 s/100m = beginner ; 90-110 = intermediate ; < 90 = elite
//   rowing           : 2k > 480 s = beginner ; 420-480 = intermediate ; < 420 = elite
//
// Citations: Daniels VDOT scoring (running); Coggan/Allen W/kg analysis
// (cycling); Wakayoshi 1992 CSS time-to-exhaustion (swimming); Concept2
// RP3 + British Rowing performance pathway (rowing).
//
// Bilingual EN+TR per session override. Pure data — no React, no I/O.

/**
 * @typedef {{ structure?: {en:string,tr:string}, notes?: {en:string,tr:string}, citation?: string }} CohortOverride
 */

/**
 * @public
 * Returns the cohort label ('beginner'|'intermediate'|'elite') for a given
 * sport + currentLevel. Returns null if currentLevel insufficient (e.g.
 * triathlon without run-cohort proxy data).
 */
export function selectCohort(sport, currentLevel) {
  if (!currentLevel || typeof currentLevel !== 'object') return null
  const sportLower = String(sport || '').toLowerCase()

  if (sportLower === 'run' || sportLower === 'triathlon') {
    const v = Number(currentLevel.vdot) || 0
    if (v <= 0) return null
    if (v < 38) return 'beginner'
    if (v < 50) return 'intermediate'
    return 'elite'
  }
  if (sportLower === 'bike') {
    const w = Number(currentLevel.ftp) || 0
    if (w <= 0) return null
    if (w < 200) return 'beginner'
    if (w < 300) return 'intermediate'
    return 'elite'
  }
  if (sportLower === 'swim') {
    // CSS in sec/100m — lower = faster
    const c = Number(currentLevel.css) || 0
    if (c <= 0) return null
    if (c > 110) return 'beginner'
    if (c > 90)  return 'intermediate'
    return 'elite'
  }
  if (sportLower === 'rowing') {
    // 2k split in seconds — lower = faster
    const s2k = Number(currentLevel.split2kSec) || 0
    if (s2k <= 0) return null
    if (s2k > 480) return 'beginner'
    if (s2k > 420) return 'intermediate'
    return 'elite'
  }
  return null
}

// ─── Per-session cohort overrides ────────────────────────────────────────────
// Only the highest-traffic key sessions are overridden in v9.11.0.
// Future ships can extend this map without breaking the existing schema.

/** @type {Record<string, { beginner: CohortOverride, intermediate: CohortOverride, elite: CohortOverride }>} */
export const COHORT_OVERRIDES = {
  // ── RUN
  'run-base-long-aerobic': {
    beginner: {
      structure: { en: '45-90 min continuous at conversational E-pace.', tr: '45-90 dk kesintisiz konuşabilecek E-tempo.' },
      notes:     { en: 'Beginner CTL ceiling lower; volume cap prevents CNS fatigue. Daniels 2014.', tr: 'Başlangıç CTL tavanı düşük; hacim sınırı CNS yorgunluğunu önler.' },
    },
    intermediate: {
      structure: { en: '60-120 min continuous at E-pace.', tr: '60-120 dk kesintisiz E-tempo.' },
      notes:     { en: 'Sweet-spot aerobic load. Daniels 2014.', tr: 'En iyi aerobik yük noktası.' },
    },
    elite: {
      structure: { en: '75-150 min continuous at E-pace.', tr: '75-150 dk kesintisiz E-tempo.' },
      notes:     { en: 'Capillarization demands sustained submaximal hours. Friel 2014.', tr: 'Kapilerleşme uzun süreli alt-maksimal saatler ister.' },
    },
  },
  'run-build-threshold-2x20': {
    beginner: {
      structure: { en: '15 min warm-up + 2x15 min @T-pace, 4 min jog + 10 min cool-down.', tr: '15 dk ısınma + 2x15 dk @T-tempo, 4 dk jog + 10 dk soğuma.' },
      notes:     { en: 'Shorter intervals, longer recovery — beginner LT trainability saturates 30 min total.', tr: 'Kısa interval, uzun toparlanma — başlangıç LT antrenabilirliği 30 dk toplamda doyar.' },
    },
    intermediate: {
      structure: { en: '15 min warm-up + 2x20 min @T-pace, 3 min jog + 10 min cool-down.', tr: '15 dk ısınma + 2x20 dk @T-tempo, 3 dk jog + 10 dk soğuma.' },
      notes:     { en: 'Daniels 2014 standard prescription.', tr: 'Daniels 2014 standart reçete.' },
    },
    elite: {
      structure: { en: '15 min warm-up + 3x20 min @T-pace, 2 min jog + 10 min cool-down.', tr: '15 dk ısınma + 3x20 dk @T-tempo, 2 dk jog + 10 dk soğuma.' },
      notes:     { en: 'Rønnestad & Mujika 2014: trained athletes tolerate 60 min total threshold.', tr: 'Rønnestad & Mujika 2014: antrenmanlı sporcular 60 dk eşik tolere eder.' },
    },
  },
  'run-build-cruise': {
    beginner: {
      structure: { en: '15 min warm-up + 4x1km @T-pace, 2 min jog (equal-time) + 10 min cool-down.', tr: '15 dk ısınma + 4x1km @T-tempo, 2 dk jog (eşit-süre) + 10 dk soğuma.' },
      notes:     { en: 'Reduced rep count; 4 reps achieves clearance pacing at lower total volume.', tr: 'Azaltılmış tekrar sayısı; 4 tekrar düşük toplam hacimde temizlik temposunu sağlar.' },
    },
    intermediate: {
      structure: { en: '15 min warm-up + 5x1km @T-pace, 2 min jog (equal-time) + 10 min cool-down.', tr: '15 dk ısınma + 5x1km @T-tempo, 2 dk jog (eşit-süre) + 10 dk soğuma.' },
      notes:     { en: 'Pfitzinger 2014 standard.', tr: 'Pfitzinger 2014 standardı.' },
    },
    elite: {
      structure: { en: '15 min warm-up + 6-7x1km @T-pace, 90s-2min jog + 10 min cool-down.', tr: '15 dk ısınma + 6-7x1km @T-tempo, 90s-2dk jog + 10 dk soğuma.' },
      notes:     { en: 'Tighter recovery mimics race surges in final km. Pfitzinger 2014.', tr: 'Daha sıkı toparlanma yarışın son km\'lerindeki ataklara benzer.' },
    },
  },
  'run-peak-race-pace': {
    beginner: {
      structure: { en: '15 min warm-up + 4x1km @goal race pace, 4 min jog + 10 min cool-down.', tr: '15 dk ısınma + 4x1km hedef yarış temposunda, 4 dk jog + 10 dk soğuma.' },
      notes:     { en: 'Reduces psychological overreach; beginner race-pace trainability lower.', tr: 'Psikolojik aşırı-ulaşımı azaltır; başlangıç yarış-tempo antrenabilirliği düşük.' },
    },
    intermediate: {
      structure: { en: '15 min warm-up + 5x1km @goal race pace, 4 min jog (equal-time) + 10 min cool-down.', tr: '15 dk ısınma + 5x1km hedef yarış temposunda, 4 dk jog (eşit-süre) + 10 dk soğuma.' },
      notes:     { en: 'Standard. Pfitzinger 2014 equal-time recovery.', tr: 'Standart. Pfitzinger 2014 eşit-süre toparlanma.' },
    },
    elite: {
      structure: { en: '15 min warm-up + 6x1km @goal race pace, 2-3 min jog + 10 min cool-down.', tr: '15 dk ısınma + 6x1km hedef yarış temposunda, 2-3 dk jog + 10 dk soğuma.' },
      notes:     { en: 'Tighter recovery mimics pace demands in race final km.', tr: 'Daha sıkı toparlanma yarışın son km tempo taleplerini taklit eder.' },
    },
  },

  // ── BIKE
  'bike-base-z2-long': {
    beginner: {
      structure: { en: '75-150 min Z2 (56-75% FTP), last 20 min at lower Z2.', tr: '75-150 dk Z2 (FTP %56-75), son 20 dk düşük Z2.' },
      notes:     { en: 'Capillary density plateau at 2-2.5h in beginners; CTL stress beyond exceeds recovery.', tr: 'Başlangıçta 2-2.5sa\'da kapilerlik platosu; sonrasında CTL stresi toparlanmayı aşar.' },
    },
    intermediate: {
      structure: { en: '90-180 min Z2, last 30 min slightly higher if fresh.', tr: '90-180 dk Z2, taze hissediyorsan son 30 dk biraz daha yüksek.' },
      notes:     { en: 'Standard Coggan & Allen 2010.', tr: 'Standart.' },
    },
    elite: {
      structure: { en: '120-240 min Z2, optionally last 30-45 min Z3 steady or 85% FTP.', tr: '120-240 dk Z2, opsiyonel son 30-45 dk Z3 sabit veya %85 FTP.' },
      notes:     { en: 'Elite aerobic flux accommodates 3-4h sessions. Friel 2014.', tr: 'Elit aerobik akış 3-4sa seansları kaldırır.' },
    },
  },
  'bike-build-threshold-2x20': {
    beginner: {
      structure: { en: '15 min WU + 2x15 min @95-105% FTP, 8 min easy + 10 min CD.', tr: '15 dk ısınma + 2x15 dk %95-105 FTP, 8 dk kolay + 10 dk soğuma.' },
      notes:     { en: 'Shorten intervals 5 min; FTP trainability plateau lower in untrained.', tr: 'Aralıkları 5 dk kısalt; antrene olmamışta FTP antrenabilirliği daha düşük.' },
    },
    intermediate: {
      structure: { en: '15 min WU + 2x20 min @95-105% FTP, 8 min easy + 10 min CD.', tr: '15 dk ısınma + 2x20 dk %95-105 FTP, 8 dk kolay + 10 dk soğuma.' },
      notes:     { en: 'Standard.', tr: 'Standart.' },
    },
    elite: {
      structure: { en: '15 min WU + 2x25 min @95-105% FTP, 6-8 min easy + 10 min CD.', tr: '15 dk ısınma + 2x25 dk %95-105 FTP, 6-8 dk kolay + 10 dk soğuma.' },
      notes:     { en: 'Rønnestad 2014: FTP stimulus peaks 20-25 min threshold blocks.', tr: 'Rønnestad 2014: FTP uyaranı 20-25 dk eşik bloklarında zirve yapar.' },
    },
  },

  // ── SWIM
  'swim-build-css-10x200': {
    beginner: {
      structure: { en: '400m WU + 8x100m @CSS on 1:50 + 200m CD.', tr: '400m ısınma + 8x100m @CSS, 1:50 üzerinde + 200m soğuma.' },
      notes:     { en: 'Reduced rep count; beginner lactate buffering saturates <1000m threshold.', tr: 'Azaltılmış tekrar; başlangıç laktat tamponlaması <1000m eşikte doyar.' },
    },
    intermediate: {
      structure: { en: '400m WU + 12x100m @CSS on 1:45 + 200m CD.', tr: '400m ısınma + 12x100m @CSS, 1:45 üzerinde + 200m soğuma.' },
      notes:     { en: 'Wakayoshi 1992 standard.', tr: 'Wakayoshi 1992 standardı.' },
    },
    elite: {
      structure: { en: '400m WU + 14-16x100m @CSS on 1:40 + 200m CD.', tr: '400m ısınma + 14-16x100m @CSS, 1:40 üzerinde + 200m soğuma.' },
      notes:     { en: 'Extended reps; elite CSS work capacity >1500m sustained.', tr: 'Uzatılmış tekrar; elit CSS iş kapasitesi >1500m sürdürülebilir.' },
    },
  },
  'swim-peak-race-pace': {
    beginner: {
      structure: { en: '400m WU + 3x400m @goal pace on 7:30 + 200m CD.', tr: '400m ısınma + 3x400m hedef tempo, 7:30 üzerinde + 200m soğuma.' },
      notes:     { en: 'One fewer rep; beginner race-pace rehearsal saturates <1200m.', tr: 'Bir tekrar az; başlangıç yarış-tempo provası <1200m\'de doyar.' },
    },
    intermediate: {
      structure: { en: '400m WU + 4x400m @goal pace on 7:00 + 200m CD.', tr: '400m ısınma + 4x400m hedef tempo, 7:00 üzerinde + 200m soğuma.' },
      notes:     { en: 'Standard. Maglischo 2003.', tr: 'Standart.' },
    },
    elite: {
      structure: { en: '400m WU + 5x400m @goal pace on 6:45 + 200m CD.', tr: '400m ısınma + 5x400m hedef tempo, 6:45 üzerinde + 200m soğuma.' },
      notes:     { en: 'Elite aerobic stability >1600m at race pace.', tr: 'Elit aerobik denge >1600m yarış tempoda.' },
    },
  },

  // ── ROWING
  'row-base-ut2-long': {
    beginner: {
      structure: { en: '50-75 min continuous at UT2 split (~115% of 2k split). Stroke rate 18-20 spm.', tr: '50-75 dk kesintisiz UT2 split (~2k split %115). Vuruş 18-20 spm.' },
      notes:     { en: 'Concept2 RP3 data: beginner aerobic base peaks 60-75 min steady-state.', tr: 'Concept2 RP3: başlangıç aerobik tabanı 60-75 dk sabitte tepe yapar.' },
    },
    intermediate: {
      structure: { en: '60-90 min continuous at UT2 split. Stroke rate 18-20 spm.', tr: '60-90 dk kesintisiz UT2 split. Vuruş 18-20 spm.' },
      notes:     { en: 'Standard. Paul 1969; Nolte 2005.', tr: 'Standart.' },
    },
    elite: {
      structure: { en: '75-120 min continuous at UT2 split. Stroke rate 18-20 spm.', tr: '75-120 dk kesintisiz UT2 split. Vuruş 18-20 spm.' },
      notes:     { en: 'Elite mitochondrial volume supports 2h+ UT2 steady. Nolte 2005.', tr: 'Elit mitokondri hacmi 2sa+ UT2 sabit destekler.' },
    },
  },
  'row-build-at-pieces': {
    beginner: {
      structure: { en: '4x2000m at AT split, 3 min easy between. Total ~40 min @ AT.', tr: '4x2000m AT split, aralarda 3 dk kolay. Toplam ~40 dk @ AT.' },
      notes:     { en: 'Reduced reps; beginner AT capacity <50 min total threshold.', tr: 'Azaltılmış tekrar; başlangıç AT kapasitesi <50 dk toplam eşik.' },
    },
    intermediate: {
      structure: { en: '5x2000m at AT split, 3 min easy. Total ~50 min @ AT.', tr: '5x2000m AT split, 3 dk kolay. Toplam ~50 dk @ AT.' },
      notes:     { en: 'British Rowing Performance Plan standard.', tr: 'British Rowing Performance Plan standardı.' },
    },
    elite: {
      structure: { en: '6x2000m at AT split, 2-3 min easy. Total ~60 min @ AT.', tr: '6x2000m AT split, 2-3 dk kolay. Toplam ~60 dk @ AT.' },
      notes:     { en: 'Elite MLSS sustainment >50 min.', tr: 'Elit MLSS dayanıklılığı >50 dk.' },
    },
  },

  // v9.12.0 — new staple sessions
  'run-build-lactate-clearance': {
    beginner: {
      structure: { en: '15 min warm-up + 4x3 min @T-pace with 60s float at M-pace + 10 min cool-down.', tr: '15 dk ısınma + 4x3 dk @T-tempo, 60s M-tempo float + 10 dk soğuma.' },
      notes:     { en: 'Reduced reps; beginner float-recovery discipline saturates 4 reps.', tr: 'Azaltılmış tekrar; başlangıç float-toparlanma disiplini 4 tekrarda doyar.' },
    },
    intermediate: {
      structure: { en: '15 min warm-up + 6x3 min @T-pace with 30-60s float at M-pace + 10 min cool-down.', tr: '15 dk ısınma + 6x3 dk @T-tempo, 30-60s M-tempo float + 10 dk soğuma.' },
      notes:     { en: 'Canova / Magness build standard.', tr: 'Canova / Magness build standardı.' },
    },
    elite: {
      structure: { en: '15 min warm-up + 8x3 min @T-pace with 30s float at M-pace + 10 min cool-down.', tr: '15 dk ısınma + 8x3 dk @T-tempo, 30s M-tempo float + 10 dk soğuma.' },
      notes:     { en: 'Tighter float; elite MLSS clearance trained at compressed recovery.', tr: 'Daha sıkı float; elit MLSS temizliği sıkıştırılmış toparlanmada antrene edilir.' },
    },
  },
  'bike-build-sweet-spot': {
    beginner: {
      structure: { en: '15 min WU + 2x15 min @88-92% FTP, 5 min Z1 + 10 min CD.', tr: '15 dk ısınma + 2x15 dk @FTP %88-92, 5 dk Z1 + 10 dk soğuma.' },
      notes:     { en: 'Reduced reps; beginner sweet-spot tolerance <40 min total.', tr: 'Azaltılmış tekrar; başlangıç sweet-spot toleransı <40 dk toplam.' },
    },
    intermediate: {
      structure: { en: '15 min WU + 3x15 min @88-94% FTP, 5 min Z1 + 10 min CD.', tr: '15 dk ısınma + 3x15 dk @FTP %88-94, 5 dk Z1 + 10 dk soğuma.' },
      notes:     { en: 'Coggan & Allen 2019 standard.', tr: 'Coggan & Allen 2019 standardı.' },
    },
    elite: {
      structure: { en: '15 min WU + 3x20 min @90-94% FTP, 5 min Z1 + 10 min CD.', tr: '15 dk ısınma + 3x20 dk @FTP %90-94, 5 dk Z1 + 10 dk soğuma.' },
      notes:     { en: 'Extended duration; elite sweet-spot capacity >60 min total.', tr: 'Uzatılmış süre; elit sweet-spot kapasitesi >60 dk toplam.' },
    },
  },
  'swim-build-descending': {
    beginner: {
      structure: { en: '400m WU + 1x[6x100m descending CSS+5 → CSS] on 2:00 + 200m CD.', tr: '400m ısınma + 1x[6x100m CSS+5 → CSS azalan] 2:00 üzerinde + 200m soğuma.' },
      notes:     { en: 'Single set + relaxed send-off; beginner pacing-discipline saturates 600m.', tr: 'Tek set + rahat send-off; başlangıç tempo disiplini 600m\'de doyar.' },
    },
    intermediate: {
      structure: { en: '400m WU + 2x[6x100m descending CSS+5 → CSS-5] on 1:50 + 200m CD.', tr: '400m ısınma + 2x[6x100m CSS+5 → CSS-5 azalan] 1:50 üzerinde + 200m soğuma.' },
      notes:     { en: 'Maglischo 2003 standard.', tr: 'Maglischo 2003 standardı.' },
    },
    elite: {
      structure: { en: '400m WU + 3x[6x100m descending CSS+5 → CSS-5] on 1:40 + 200m CD.', tr: '400m ısınma + 3x[6x100m CSS+5 → CSS-5 azalan] 1:40 üzerinde + 200m soğuma.' },
      notes:     { en: 'Three sets + tight send-off; elite pacing fidelity sustains 1800m.', tr: 'Üç set + sıkı send-off; elit tempo sadakati 1800m sürdürülebilir.' },
    },
  },
}

/**
 * @public
 * Apply a cohort override to a session (or drill / strength movement).
 * Returns a new object with the cohort fields merged on top of the session.
 * If no override exists for this session.key + cohort, returns the session
 * unchanged. Always preserves session.key, name, purpose, etc.
 */
export function applyCohort(session, cohort) {
  if (!session || !session.key || !cohort) return session
  const overrideMap = COHORT_OVERRIDES[session.key]
  if (!overrideMap) return session
  const override = overrideMap[cohort]
  if (!override) return session
  return { ...session, ...override, cohort }
}

export const COHORTS_CITATION = 'Daniels 2014 (VDOT); Coggan & Allen 2010 (FTP); Wakayoshi 1992 (CSS); Concept2 RP3 + British Rowing 2024 (rowing); Pfitzinger 2014; Rønnestad & Mujika 2014; Maglischo 2003; Friel 2014.'
