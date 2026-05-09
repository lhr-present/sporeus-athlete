// ─── eliteProgramStrength.js — Per-phase S&C prescription ───────────────────
//
// Endurance-specific strength programming aligned with Rønnestad & Mujika 2014
// and Beattie 2014 systematic reviews: heavy strength in Base, power conversion
// in Build, maintenance in Peak, neural prep in Taper.
//
// v9.10.0: depth additions per audit B1 — prehab tier (joint mobility + glute
// activation + ankle dorsiflexion + balance) prepended to each session;
// core progression (anti-rotation, dead bug, bird-dog) replacing static
// plank-only; sport-aware Base plyometrics; minimum-dose taper guidance.
//
// All bilingual EN+TR. Pure data — no React.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   name: Bilingual,
 *   sets: number,
 *   reps: string,
 *   intensity: Bilingual,
 *   notes: Bilingual
 * }} StrengthMovement
 * @typedef {{
 *   phase: string,
 *   emphasis: Bilingual,
 *   frequencyPerWeek: number,
 *   sessionDurationMin: number,
 *   prehab: StrengthMovement[],
 *   movements: StrengthMovement[],
 *   core: StrengthMovement[],
 *   warning: Bilingual,
 *   citation: string
 * }} StrengthPhasePlan
 */

// ── Prehab tier — 5-8 min before main work in every phase ────────────────────
// Per Page 2010 (movement screening); Cibulka 2008 (glute med activation);
// USA Track & Field Level 2 curriculum (mobility-stability sequence).
//
// v9.12.0 — Sport-specific extras layered on top of universal base. Each sport
// has discipline-specific overuse patterns: runners (tib post + hip flexors),
// cyclists (T-spine + neck), swimmers (rotator cuff + scap stab), rowers
// (lumbar erectors + grip). Universal PREHAB_BASE retained as common tier.
const PREHAB_BASE = [
  {
    name: { en: 'Glute med activation (clamshells)', tr: 'Glute med aktivasyon (clamshell)' },
    sets: 2,
    reps: '12 each side',
    intensity: { en: 'Body weight, slow controlled', tr: 'Vücut ağırlığı, yavaş kontrollü' },
    notes: { en: 'Top hip stays vertical; do not roll back.', tr: 'Üst kalça dik kalır; geri dönme.' },
  },
  {
    name: { en: 'Monster walks (band)', tr: 'Canavar yürüyüşü (band)' },
    sets: 2,
    reps: '10 steps each direction',
    intensity: { en: 'Mini-band above knees, slight squat hold', tr: 'Mini-band dizlerin üstünde, hafif squat' },
    notes: { en: 'Builds lateral hip stability for run/cycle stride.', tr: 'Koşu/bisiklet adımı için yan kalça dengesi geliştirir.' },
  },
  {
    name: { en: 'Hip CARs', tr: 'Kalça CARs' },
    sets: 1,
    reps: '5 each side',
    intensity: { en: 'Body weight, full ROM', tr: 'Vücut ağırlığı, tam ROM' },
    notes: { en: 'Controlled articular rotations — slow, deliberate, full circle.', tr: 'Kontrollü eklem rotasyonları — yavaş, kasıtlı, tam daire.' },
  },
  {
    name: { en: 'Ankle dorsiflexion (wall mob)', tr: 'Ayak bileği esnekliği (duvar)' },
    sets: 2,
    reps: '8 each foot',
    intensity: { en: 'Knee to wall, heel flat', tr: 'Diz duvara, topuk yerde' },
    notes: { en: 'Critical for running stride and cycling pedal stroke.', tr: 'Koşu adımı ve pedal vuruşu için kritik.' },
  },
  {
    name: { en: 'Single-leg balance (eyes closed)', tr: 'Tek-bacak denge (gözler kapalı)' },
    sets: 2,
    reps: '20s each leg',
    intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
    notes: { en: 'Proprioception baseline; targets ankle injury resistance.', tr: 'Propriosepsiyon tabanı; ayak bileği sakatlık direncini hedefler.' },
  },
]

// v9.12.0 — Sport-specific prehab extras layered onto PREHAB_BASE.
// Citations: Mendiguchia 2012 (hip flexor for runners); Brumitt 2010 (tib post);
// Reilly 2015 (T-spine cycling); Cools 2003 (rotator cuff swimmers); Newton
// 2011 (scap stab); Wilson 2014 (lumbar erectors rowing); Vossen 2000 (grip).
const PREHAB_SPORT_EXTRAS = {
  run: [
    {
      name: { en: 'Tibialis posterior holds', tr: 'Tibialis posterior tutuş' },
      sets: 2,
      reps: '10s each foot',
      intensity: { en: 'Body weight, single-leg with arch lift', tr: 'Vücut ağırlığı, tek-bacak ark kaldırma' },
      notes: { en: 'Critical for runners; tib post weakness drives plantar fasciitis.', tr: 'Koşucular için kritik; tib post zayıflığı plantar fasiit yapar.' },
    },
    {
      name: { en: 'Couch-stretch hip flexor', tr: 'Couch-stretch kalça fleksörü' },
      sets: 1,
      reps: '45s each side',
      intensity: { en: 'Body weight, rear knee on couch/wall', tr: 'Vücut ağırlığı, arka diz koltukta/duvarda' },
      notes: { en: 'Counters seated-day shortening; preserves stride length.', tr: 'Oturma günü kısalmasını dengeler; adım boyunu korur.' },
    },
  ],
  bike: [
    {
      name: { en: 'T-spine extension over foam roller', tr: 'Foam roller üstünde T-omurga ekstansiyonu' },
      sets: 2,
      reps: '8 segments',
      intensity: { en: 'Body weight, controlled extension', tr: 'Vücut ağırlığı, kontrollü ekstansiyon' },
      notes: { en: 'Counters thoracic kyphosis from saddle position.', tr: 'Sele postüründen gelen torasik kifozu dengeler.' },
    },
    {
      name: { en: 'Chin-tuck + scap retraction', tr: 'Çene-içeri + skapula geri çekme' },
      sets: 2,
      reps: '10',
      intensity: { en: 'Body weight, slow controlled', tr: 'Vücut ağırlığı, yavaş kontrollü' },
      notes: { en: 'Reduces neck-shoulder strain on long rides.', tr: 'Uzun sürüşlerde boyun-omuz gerginliğini azaltır.' },
    },
  ],
  swim: [
    {
      name: { en: 'Band external rotation (rotator cuff)', tr: 'Band dış rotasyon (rotator cuff)' },
      sets: 2,
      reps: '12 each arm',
      intensity: { en: 'Light band, elbow at 90°', tr: 'Hafif band, dirsek 90°' },
      notes: { en: 'Shoulder impingement prevention; mandatory for swimmers.', tr: 'Omuz sıkışma önlemi; yüzücüler için zorunlu.' },
    },
    {
      name: { en: 'Scap stab Y-T-W (prone)', tr: 'Skapula stab Y-T-W (yüzükoyun)' },
      sets: 2,
      reps: '6 each shape',
      intensity: { en: 'Body weight or 1-2kg DBs', tr: 'Vücut ağırlığı veya 1-2kg DB' },
      notes: { en: 'Posterior shoulder activation balances overhead pull.', tr: 'Arka omuz aktivasyonu üst-baş çekişi dengeler.' },
    },
  ],
  rowing: [
    {
      name: { en: 'Bird-dog with reach (lumbar erectors)', tr: 'Bird-dog uzanma (lomber erektörler)' },
      sets: 2,
      reps: '8 each side',
      intensity: { en: 'Body weight, slow controlled', tr: 'Vücut ağırlığı, yavaş kontrollü' },
      notes: { en: 'Trains spinal stiffness under catch loading.', tr: 'Yakalama yüklemesinde omurga sertliğini antrene eder.' },
    },
    {
      name: { en: 'Farmer carry (grip)', tr: 'Çiftçi taşıma (kavrama)' },
      sets: 2,
      reps: '20s walk',
      intensity: { en: 'Heavy DBs/KBs at sides', tr: 'Yanlarda ağır DB/KB' },
      notes: { en: 'Grip endurance for late-race handle hold.', tr: 'Yarış sonunda kulp tutuşu için kavrama dayanıklılığı.' },
    },
  ],
  triathlon: [
    {
      name: { en: 'Tibialis posterior holds', tr: 'Tibialis posterior tutuş' },
      sets: 2,
      reps: '10s each foot',
      intensity: { en: 'Body weight, single-leg with arch lift', tr: 'Vücut ağırlığı, tek-bacak ark kaldırma' },
      notes: { en: 'Run-leg of tri demands tib post resilience post-bike.', tr: 'Tri\'nin koşu ayağı bisiklet sonrası tib post dayanıklılığı ister.' },
    },
    {
      name: { en: 'Band external rotation (rotator cuff)', tr: 'Band dış rotasyon (rotator cuff)' },
      sets: 2,
      reps: '12 each arm',
      intensity: { en: 'Light band, elbow at 90°', tr: 'Hafif band, dirsek 90°' },
      notes: { en: 'Swim-leg shoulder integrity.', tr: 'Yüzme ayağı omuz bütünlüğü.' },
    },
  ],
}

/** Compose universal + sport-specific prehab. */
function getPrehab(sport) {
  const extras = PREHAB_SPORT_EXTRAS[sport] || []
  return [...PREHAB_BASE, ...extras]
}

// ── Core packages — progression across phases ────────────────────────────────
const CORE_BASE = [
  {
    name: { en: 'Plank + side plank', tr: 'Plank + yan plank' },
    sets: 3,
    reps: '30-45s each',
    intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
    notes: { en: 'Anti-extension foundation. Form > duration.', tr: 'Anti-ekstansiyon temeli. Form > süre.' },
  },
  {
    name: { en: 'Dead bug', tr: 'Ölü böcek' },
    sets: 2,
    reps: '10 each side',
    intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
    notes: { en: 'Lower back stays pinned. Slow, controlled.', tr: 'Bel yere yapışık kalır. Yavaş, kontrollü.' },
  },
]

const CORE_BUILD = [
  {
    name: { en: 'Plank progression (45-60s)', tr: 'Plank ilerletmesi (45-60s)' },
    sets: 3,
    reps: '45-60s + 10s leg-lift',
    intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
    notes: { en: 'Add brief leg-lift hold at end of each plank.', tr: 'Her plank sonunda kısa bacak-kaldırma ekle.' },
  },
  {
    name: { en: 'Pallof press (anti-rotation)', tr: 'Pallof press (anti-rotasyon)' },
    sets: 3,
    reps: '10 each side',
    intensity: { en: 'Cable or band, moderate', tr: 'Kablo veya band, orta' },
    notes: { en: 'Resist rotation as arms extend. Trunk stays still.', tr: 'Kollar uzanırken rotasyona direnç. Gövde sabit.' },
  },
  {
    name: { en: 'Dead bug (loaded)', tr: 'Ölü böcek (yüklü)' },
    sets: 3,
    reps: '8 each side',
    intensity: { en: 'Light dumbbell or med-ball overhead', tr: 'Hafif dumbell veya sağlık topu yukarıda' },
    notes: { en: 'Progression from base; same form integrity.', tr: 'Tabandan ilerleme; aynı form bütünlüğü.' },
  },
]

const CORE_PEAK = [
  {
    name: { en: 'Plank with leg lift', tr: 'Bacak-kaldırmalı plank' },
    sets: 2,
    reps: '30s each side',
    intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
    notes: { en: 'Quality maintenance during race-specific phase.', tr: 'Yarışa-özel fazda kaliteli koruma.' },
  },
  {
    name: { en: 'Pallof press', tr: 'Pallof press' },
    sets: 2,
    reps: '10 each side',
    intensity: { en: 'Same as Build', tr: 'Build ile aynı' },
    notes: { en: 'Maintain anti-rotation pattern.', tr: 'Anti-rotasyon kalıbını koru.' },
  },
  {
    name: { en: 'Bird-dog', tr: 'Bird-dog' },
    sets: 2,
    reps: '8 each side',
    intensity: { en: 'Body weight, 2s pause', tr: 'Vücut ağırlığı, 2s bekleme' },
    notes: { en: 'Posterior-chain stability under contralateral load.', tr: 'Karşı-yan yüklenmede arka-zincir denge.' },
  },
]

const CORE_TAPER = [
  {
    name: { en: 'Plank (activation only)', tr: 'Plank (sadece aktivasyon)' },
    sets: 1,
    reps: '30s',
    intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
    notes: { en: 'Wake the system, do not fatigue.', tr: 'Sistemi uyandır, yorma.' },
  },
  {
    name: { en: 'Bird-dog', tr: 'Bird-dog' },
    sets: 1,
    reps: '6 each side',
    intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
    notes: { en: 'Activation only.', tr: 'Sadece aktivasyon.' },
  },
]

// ── Sport-specific Base plyometrics — additive to Base lifts ─────────────────
// Per Beattie 2014: jump training in Base preserves stiffness and prevents
// the strength-without-power trap that pure heavy lifting creates.
const SPORT_PLYO_BASE = {
  run: [
    {
      name: { en: 'Pogo hops', tr: 'Pogo sıçraması' },
      sets: 4,
      reps: '5',
      intensity: { en: 'Body weight, ankle-only stiff bounce', tr: 'Vücut ağırlığı, sadece bilek sertliği' },
      notes: { en: 'Min ground contact time. Builds running stiffness.', tr: 'Min yer-teması süresi. Koşu sertliği geliştirir.' },
    },
    {
      name: { en: 'Bound-skips', tr: 'Sıçramalı koşu adımı' },
      sets: 3,
      reps: '4 each leg',
      intensity: { en: 'Body weight, max horizontal travel per stride', tr: 'Vücut ağırlığı, adım başına maks yatay mesafe' },
      notes: { en: 'Exaggerated single-leg push for hop power.', tr: 'Sıçrama gücü için abartılı tek-bacak itme.' },
    },
  ],
  bike: [
    {
      name: { en: 'Squat jumps', tr: 'Skuat sıçraması' },
      sets: 3,
      reps: '6',
      intensity: { en: 'Body weight, max height', tr: 'Vücut ağırlığı, maks yükseklik' },
      notes: { en: 'Builds standing-attack power for race surges.', tr: 'Yarış ataklarında ayakta-saldırı gücü geliştirir.' },
    },
  ],
  swim: [
    {
      name: { en: 'Streamline vertical jumps', tr: 'Streamline dikey sıçrama' },
      sets: 3,
      reps: '5',
      intensity: { en: 'Body weight, hands clasped overhead in streamline', tr: 'Vücut ağırlığı, eller yukarıda streamline' },
      notes: { en: 'Reinforces dive/wall push posture.', tr: 'Dalış/duvar itme postürünü güçlendirir.' },
    },
  ],
  rowing: [
    {
      name: { en: 'Standing broad jumps', tr: 'Ayakta uzun atlama' },
      sets: 3,
      reps: '5',
      intensity: { en: 'Body weight, max distance', tr: 'Vücut ağırlığı, maks mesafe' },
      notes: { en: 'Replicates hip-extension drive of the rowing catch.', tr: 'Kürek yakalamasındaki kalça-uzanma itmesini taklit eder.' },
    },
  ],
  // triathlon picks run plyo (highest neuromuscular demand)
  triathlon: [
    {
      name: { en: 'Pogo hops', tr: 'Pogo sıçraması' },
      sets: 4,
      reps: '5',
      intensity: { en: 'Body weight, ankle-only stiff bounce', tr: 'Vücut ağırlığı, sadece bilek sertliği' },
      notes: { en: 'Run-specific stiffness for tri brick demand.', tr: 'Tri brick talebi için koşu-spesifik sertlik.' },
    },
  ],
}

const BASE_LIFTS = [
  {
    name: { en: 'Back squat', tr: 'Arka skuat' },
    sets: 4,
    reps: '4-6',
    intensity: { en: '80-85% 1RM', tr: '%80-85 1RM' },
    notes: { en: 'Explosive concentric, 2s eccentric. Belt OK above 80%.', tr: 'Patlayıcı konsantrik, 2s eksantrik. %80 üzerinde kemer serbest.' },
  },
  {
    name: { en: 'Romanian deadlift', tr: 'Romen ölü kaldırma' },
    sets: 4,
    reps: '5-6',
    intensity: { en: '75-80% 1RM', tr: '%75-80 1RM' },
    notes: { en: 'Hinge, neutral spine, controlled eccentric.', tr: 'Kalçadan kır, nötr omurga, kontrollü eksantrik.' },
  },
  {
    name: { en: 'Single-leg press or split squat', tr: 'Tek-bacak press veya split squat' },
    sets: 3,
    reps: '6-8 each leg',
    intensity: { en: '70-75% 1RM', tr: '%70-75 1RM' },
    notes: { en: 'Addresses asymmetry critical for endurance sports.', tr: 'Dayanıklılık sporlarında kritik asimetriyi giderir.' },
  },
  {
    name: { en: 'Calf raise (bent + straight knee)', tr: 'Buzağı kaldırma (bükük + düz diz)' },
    sets: 3,
    reps: '8-10',
    intensity: { en: 'Body weight + dumbbells', tr: 'Vücut ağırlığı + dumbell' },
    notes: { en: 'Both gastroc and soleus; 2s pause at top.', tr: 'Hem gastrok hem soleus; tepede 2s bekleme.' },
  },
]

function makeBase(sport) {
  const plyo = SPORT_PLYO_BASE[sport] || []
  return {
    phase: 'Base',
    emphasis: {
      en: 'Heavy max-strength + sport-specific plyometrics. Prehab opens every session; core progression closes it.',
      tr: 'Ağır maksimal-kuvvet + spora-özel plyometrik. Her seansı prehab açar; core ilerlemesi kapatır.',
    },
    frequencyPerWeek: 2,
    sessionDurationMin: 55,
    prehab: getPrehab(sport),
    movements: [...BASE_LIFTS, ...plyo],
    core: CORE_BASE,
    warning: {
      en: 'Schedule on a non-key-quality endurance day. Allow 6-8h before next aerobic session.',
      tr: 'Anahtar kaliteli aerobik günden farklı bir günde planla. Sonraki aerobik seansa 6-8 saat bırak.',
    },
    citation: 'Rønnestad & Mujika 2014; Beattie et al. 2014; Page 2010 (prehab); Cibulka 2008 (glute act)',
  }
}

function makeBuild(sport) { return { ...BUILD_TEMPLATE, prehab: getPrehab(sport) } }
function makePeak(sport)  { return { ...PEAK_TEMPLATE,  prehab: getPrehab(sport) } }
function makeTaper(sport) { return { ...TAPER_TEMPLATE, prehab: getPrehab(sport) } }

const BUILD_TEMPLATE = {
  phase: 'Build',
  emphasis: {
    en: 'Power conversion: same lifts at lower load with explosive intent + plyometrics added. Core moves to anti-rotation work.',
    tr: 'Güç dönüşümü: aynı hareketler düşük yükle patlayıcı niyetle + plyometrik eklenir. Core anti-rotasyona geçer.',
  },
  frequencyPerWeek: 2,
  sessionDurationMin: 50,
  prehab: PREHAB_BASE,
  movements: [
    {
      name: { en: 'Back squat (explosive)', tr: 'Arka skuat (patlayıcı)' },
      sets: 4,
      reps: '4-5',
      intensity: { en: '50-60% 1RM with maximal bar speed', tr: '%50-60 1RM, maksimal bar hızı' },
      notes: { en: 'Bar speed is the metric, not load.', tr: 'Yük değil, bar hızı ana metrik.' },
    },
    {
      name: { en: 'Trap-bar deadlift', tr: 'Trap-bar ölü kaldırma' },
      sets: 4,
      reps: '4-5',
      intensity: { en: '60-70% 1RM explosive', tr: '%60-70 1RM patlayıcı' },
      notes: { en: 'Lower-injury alternative to conventional DL.', tr: 'Klasik DL\'ye göre düşük sakatlanma riski.' },
    },
    {
      name: { en: 'Box jumps', tr: 'Kutu atlama' },
      sets: 4,
      reps: '5',
      intensity: { en: 'Max height controlled landing', tr: 'Maks yükseklik, kontrollü iniş' },
      notes: { en: 'Step down between reps; never jump down.', tr: 'Tekrarlar arasında in; asla atlama.' },
    },
    {
      name: { en: 'Single-leg hop drills', tr: 'Tek-bacak sıçrama drilleri' },
      sets: 3,
      reps: '6 each leg',
      intensity: { en: 'Body weight, max effort', tr: 'Vücut ağırlığı, maks efor' },
      notes: { en: 'Builds rate of force development.', tr: 'Güç gelişim oranını artırır.' },
    },
    {
      name: { en: 'Med-ball slams', tr: 'Sağlık topu vurma' },
      sets: 3,
      reps: '8',
      intensity: { en: '4-6kg ball, max velocity', tr: '4-6kg top, maks hız' },
      notes: { en: 'Trunk power transfer.', tr: 'Gövde güç aktarımı.' },
    },
  ],
  core: CORE_BUILD,
  warning: {
    en: 'Plyometrics need 48h between sessions and dry surfaces. Skip if fatigued.',
    tr: 'Plyometrik 48s ara ve kuru zemin gerektirir. Yorgunsa atla.',
  },
  citation: 'Rønnestad & Mujika 2014; Sáez de Villarreal et al. 2010',
}

const PEAK_TEMPLATE = {
  phase: 'Peak',
  emphasis: {
    en: 'Maintenance: minimum effective dose to preserve gains while race-specific work dominates. Core: anti-rotation + bird-dog.',
    tr: 'Koruma: yarışa-özel çalışma ağır basarken kazanımları korumaya yetecek minimum doz. Core: anti-rotasyon + bird-dog.',
  },
  frequencyPerWeek: 1,
  sessionDurationMin: 35,
  prehab: PREHAB_BASE,
  movements: [
    {
      name: { en: 'Back squat', tr: 'Arka skuat' },
      sets: 2,
      reps: '4-5',
      intensity: { en: '70-75% 1RM', tr: '%70-75 1RM' },
      notes: { en: 'Quality over quantity.', tr: 'Nicelikten çok nitelik.' },
    },
    {
      name: { en: 'Romanian deadlift', tr: 'Romen ölü kaldırma' },
      sets: 2,
      reps: '5',
      intensity: { en: '70% 1RM', tr: '%70 1RM' },
      notes: { en: 'Maintain pattern.', tr: 'Hareket kalıbını koru.' },
    },
    {
      name: { en: 'Single-leg work (split squat or step-up)', tr: 'Tek-bacak (split squat veya step-up)' },
      sets: 2,
      reps: '6 each leg',
      intensity: { en: 'Body weight + light dumbbells', tr: 'Vücut ağırlığı + hafif dumbell' },
      notes: { en: 'Asymmetry check.', tr: 'Asimetri kontrolü.' },
    },
  ],
  core: CORE_PEAK,
  warning: {
    en: 'Drop strength entirely if endurance load high or feeling overreached. Prehab + core can stay even when lifts skip.',
    tr: 'Dayanıklılık yükü çoksa veya overreach hissediyorsan kuvveti tamamen bırak. Lifeler atlansa bile prehab + core kalabilir.',
  },
  citation: 'Rønnestad & Mujika 2014',
}

const TAPER_TEMPLATE = {
  phase: 'Taper',
  emphasis: {
    en: 'Neural priming only — short, fast, low fatigue. Optional in race week.',
    tr: 'Sadece nöral hazırlık — kısa, hızlı, düşük yorgunluk. Yarış haftasında opsiyonel.',
  },
  frequencyPerWeek: 1,
  sessionDurationMin: 25,
  prehab: PREHAB_BASE,
  movements: [
    {
      name: { en: 'Box jumps (low height)', tr: 'Kutu atlama (düşük)' },
      sets: 2,
      reps: '3',
      intensity: { en: 'Body weight, knee-height box', tr: 'Vücut ağırlığı, diz yüksekliğinde kutu' },
      notes: { en: 'Wake the system without fatigue.', tr: 'Sistemi yorgunluk yaratmadan uyandır.' },
    },
    {
      name: { en: 'Bodyweight squat with jump', tr: 'Sıçramalı vücut-ağırlığı skuat' },
      sets: 2,
      reps: '5',
      intensity: { en: 'Body weight, max velocity', tr: 'Vücut ağırlığı, maks hız' },
      notes: { en: 'Concentric-focused, no eccentric overload.', tr: 'Konsantrik odaklı, eksantrik yüklenme yok.' },
    },
  ],
  core: CORE_TAPER,
  // v9.10.0 — minimum-dose taper guidance (audit B1 finding).
  // Old warning was binary "drop entirely". Real coaches keep a minimum
  // neural-prime stimulus in the final week.
  minimumDose: {
    en: 'Minimum neural-prime dose for race week (T-7 to T-3): 1 short session, 2x3 low box jumps + 5 bodyweight squat-jumps. Skip even this if sleep <6h or if feeling overreached.',
    tr: 'Yarış haftası (T-7 ile T-3) min nöral-hazırlık dozu: 1 kısa seans, 2x3 düşük kutu atlama + 5 vücut-ağırlığı sıçramalı skuat. Uyku <6sa veya overreach hissediyorsan bunu da atla.',
  },
  warning: {
    en: 'Skip strength entirely in the final 5-7 days before race day — UNLESS using the minimum-dose protocol noted above (Tuesday before Sunday race).',
    tr: 'Yarış gününden önceki son 5-7 günde kuvveti tamamen atla — YUKARIDAKİ min-doz protokolü hariç (Pazar yarışı için Salı).',
  },
  citation: 'Mujika 2003; Rønnestad & Mujika 2014',
}

/**
 * @public
 * @param {{ phases: Array<{phase:string}>, sport?: string }} input
 * @returns {Record<string, StrengthPhasePlan>}
 */
export function buildStrengthProgram(input) {
  const present = new Set((input?.phases || []).map(p => p.phase))
  const sport = input?.sport
  const out = {}
  if (present.has('Base'))  out.Base  = makeBase(sport)
  if (present.has('Build')) out.Build = makeBuild(sport)
  if (present.has('Peak'))  out.Peak  = makePeak(sport)
  if (present.has('Taper')) out.Taper = makeTaper(sport)
  return out
}

export const STRENGTH_CITATION = 'Rønnestad & Mujika 2014; Beattie et al. 2014; Sáez de Villarreal et al. 2010; Page 2010; Cibulka 2008; Mujika 2003; Mendiguchia 2012; Brumitt 2010; Cools 2003; Wilson 2014'
