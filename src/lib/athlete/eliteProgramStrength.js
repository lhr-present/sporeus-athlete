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

// v9.14.0 — Upper-body Base lifts. Closes audit P0 finding: prior strength
// program was lower-body only, violating push/pull movement-balance principle
// (Haff & Triplett NSCA, Beattie 2014). Sport emphasis: rowers/swimmers prioritize
// pulling; cyclists prioritize T-spine/posterior-chain; runners get balanced.
// Common to all sports: 2 movements (1 push, 1 pull) per Base session.
const UPPER_BODY_BASE_COMMON = [
  {
    name: { en: 'Barbell or dumbbell row', tr: 'Barbel veya dumbel kürek' },
    sets: 3,
    reps: '6-8',
    intensity: { en: '70-75% 1RM', tr: '%70-75 1RM' },
    notes: { en: 'Horizontal pull. Drive elbow back, retract scap. Critical for posture under endurance load.', tr: 'Yatay çekiş. Dirseği geri sür, skapulayı geri çek. Dayanıklılık yükü altında postür için kritik.' },
  },
  {
    name: { en: 'Dumbbell bench or push-up progression', tr: 'Dumbel bench veya şınav ilerletme' },
    sets: 3,
    reps: '6-10',
    intensity: { en: '70-75% 1RM (DB) or weighted/feet-elevated push-ups', tr: '%70-75 1RM (DB) veya yüklü/ayak-yukarı şınav' },
    notes: { en: 'Horizontal push balances pulling volume; protects shoulder under freestyle/rowing pull demand.', tr: 'Yatay itme çekiş hacmini dengeler; serbest stil/kürek çekişine karşı omuzu korur.' },
  },
]

// Per-sport additional Base upper-body emphasis. Swim/rowing add extra pull
// volume (vertical or pronated grip); cyclists add overhead press for
// stand-and-attack stability; runners get unilateral work for arm-swing balance.
const UPPER_BODY_BASE_SPORT_EXTRA = {
  run: [
    {
      name: { en: 'Single-arm dumbbell push press', tr: 'Tek-kol dumbel push press' },
      sets: 2,
      reps: '5 each side',
      intensity: { en: '60% 1RM', tr: '%60 1RM' },
      notes: { en: 'Asymmetric overhead loading mimics arm-swing under fatigue.', tr: 'Asimetrik üst-baş yükleme yorgunlukta kol-savruşunu taklit eder.' },
    },
  ],
  bike: [
    {
      name: { en: 'Standing overhead press', tr: 'Ayakta üst-baş press' },
      sets: 3,
      reps: '6-8',
      intensity: { en: '65-75% 1RM', tr: '%65-75 1RM' },
      notes: { en: 'Builds standing-attack stability; activates serratus + lower trap.', tr: 'Ayakta-saldırı stabilitesi geliştirir; serratus + alt trap aktive eder.' },
    },
  ],
  swim: [
    {
      name: { en: 'Pull-up or lat pulldown', tr: 'Pull-up veya lat pulldown' },
      sets: 3,
      reps: '5-8 (or weighted as fitness allows)',
      intensity: { en: 'Body weight + load as needed', tr: 'Vücut ağırlığı + gerektiğinde yük' },
      notes: { en: 'Vertical pull for catch-phase strength. Pronated grip mimics swim pull pattern.', tr: 'Yakalama fazı kuvveti için dikey çekiş. Pronatik tutuş yüzme çekiş kalıbını taklit eder.' },
    },
  ],
  rowing: [
    {
      name: { en: 'Pull-up or chin-up', tr: 'Pull-up veya chin-up' },
      sets: 3,
      reps: '5-8 (weighted if able)',
      intensity: { en: 'Body weight + load', tr: 'Vücut ağırlığı + yük' },
      notes: { en: 'Vertical pull; transfers directly to drive-phase rowing pull.', tr: 'Dikey çekiş; çekiş fazı kürek hareketine doğrudan transfer.' },
    },
    {
      name: { en: 'Bent-over barbell row (heavy)', tr: 'Eğilmiş barbel kürek (ağır)' },
      sets: 3,
      reps: '5',
      intensity: { en: '80% 1RM', tr: '%80 1RM' },
      notes: { en: 'Heaviest pulling pattern matches stroke-load demand; prioritize over bench.', tr: 'En ağır çekiş kalıbı stroke yükünü karşılar; bench\'ten önce öncelendir.' },
    },
  ],
  triathlon: [
    {
      name: { en: 'Pull-up or lat pulldown', tr: 'Pull-up veya lat pulldown' },
      sets: 3,
      reps: '5-8',
      intensity: { en: 'Body weight + load as needed', tr: 'Vücut ağırlığı + gerektiğinde yük' },
      notes: { en: 'Swim-leg shoulder strength — vertical pull pattern.', tr: 'Yüzme ayağı omuz kuvveti — dikey çekiş kalıbı.' },
    },
  ],
}

function getUpperBodyBase(sport) {
  const extra = UPPER_BODY_BASE_SPORT_EXTRA[sport] || []
  return [...UPPER_BODY_BASE_COMMON, ...extra]
}

// v9.14.0 — Upper-body Build movements (power conversion). Med-ball throws +
// explosive row/press with reduced load + maximal velocity intent. Same
// philosophy as lower-body Build (Rønnestad & Mujika 2014: 50-60% 1RM,
// bar-speed metric not load).
const UPPER_BODY_BUILD = [
  {
    name: { en: 'Med-ball chest pass (power throw)', tr: 'Sağlık topu göğüs pas (güç fırlatma)' },
    sets: 3,
    reps: '6',
    intensity: { en: '4-6kg ball, max velocity', tr: '4-6kg top, maks hız' },
    notes: { en: 'Horizontal-push power output. Throw against wall or to partner; full extension each rep.', tr: 'Yatay-itme güç çıktısı. Duvara veya partnere fırlat; her tekrar tam ekstansiyon.' },
  },
  {
    name: { en: 'Explosive bent-over row', tr: 'Patlayıcı eğilmiş kürek' },
    sets: 3,
    reps: '5',
    intensity: { en: '50-60% 1RM with maximal pull velocity', tr: '%50-60 1RM, maksimal çekiş hızı' },
    notes: { en: 'Pull velocity is the metric, not load. Drive elbow back hard; controlled eccentric.', tr: 'Yük değil çekiş hızı metriktir. Dirseği sert geri sür; kontrollü eksantrik.' },
  },
]

// v9.14.0 — Upper-body Peak (maintenance dose). Single push + pull at
// reduced volume; preserves pattern under taper-approach race-specific load.
const UPPER_BODY_PEAK = [
  {
    name: { en: 'Dumbbell row (light)', tr: 'Dumbel kürek (hafif)' },
    sets: 2,
    reps: '6',
    intensity: { en: '60-65% 1RM', tr: '%60-65 1RM' },
    notes: { en: 'Maintain pulling pattern; no fatigue intent.', tr: 'Çekiş kalıbını koru; yorgunluk niyeti yok.' },
  },
  {
    name: { en: 'Push-up or DB press (light)', tr: 'Şınav veya DB press (hafif)' },
    sets: 2,
    reps: '8',
    intensity: { en: 'Body weight or 60% 1RM', tr: 'Vücut ağırlığı veya %60 1RM' },
    notes: { en: 'Pattern maintenance. Skip if shoulder fatigued from sport-specific work.', tr: 'Kalıp koruma. Spora-özel işten omuz yorgunsa atla.' },
  },
]

function makeBase(sport) {
  const plyo = SPORT_PLYO_BASE[sport] || []
  // v9.14.0 — interleave lower-body lifts → upper-body lifts → plyo so the
  // session naturally alternates push/pull/squat/hinge per Beattie 2014.
  return {
    phase: 'Base',
    emphasis: {
      en: 'Heavy max-strength + sport-specific plyometrics + balanced upper-body push/pull. Prehab opens every session; core progression closes it.',
      tr: 'Ağır maksimal-kuvvet + spora-özel plyometrik + dengeli üst-vücut itme/çekiş. Her seansı prehab açar; core ilerlemesi kapatır.',
    },
    frequencyPerWeek: 2,
    sessionDurationMin: 60,
    prehab: getPrehab(sport),
    movements: [...BASE_LIFTS, ...getUpperBodyBase(sport), ...plyo],
    core: CORE_BASE,
    warning: {
      en: 'Schedule on a non-key-quality endurance day. Allow 6-8h before next aerobic session.',
      tr: 'Anahtar kaliteli aerobik günden farklı bir günde planla. Sonraki aerobik seansa 6-8 saat bırak.',
    },
    citation: 'Rønnestad & Mujika 2014; Beattie et al. 2014; Haff & Triplett (NSCA); Page 2010 (prehab); Cibulka 2008 (glute act)',
  }
}

function makeBuild(sport) {
  return {
    ...BUILD_TEMPLATE,
    prehab: getPrehab(sport),
    movements: [...BUILD_TEMPLATE.movements, ...UPPER_BODY_BUILD],
  }
}
function makePeak(sport) {
  return {
    ...PEAK_TEMPLATE,
    prehab: getPrehab(sport),
    movements: [...PEAK_TEMPLATE.movements, ...UPPER_BODY_PEAK],
  }
}
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

// v9.164.0 (EP-5) — Strength cohort overrides. Pre-fix the strength
// program was one-size-fits-all: every athlete got 2× heavy lifts/wk at
// 60min in Base regardless of training history. Beattie 2016 + general
// S&C norms: novices need lower volume and longer movement-quality
// runways before adding load; elite athletes tolerate (and require)
// higher dose for adaptation.
//
// Overrides are MULTIPLICATIVE on the generic template (set in
// makeBase/makeBuild/makePeak/makeTaper). Intensity notes are bilingual
// strings appended to the phase plan so the UI can surface the
// cohort-specific dose without recomputing the movement list.
//
// Frequency floor 1 / ceiling 4 — Rønnestad 2014 + Beattie 2014.
// Duration floor 15 / ceiling 80 — practical session length.
const STRENGTH_COHORT_FREQ_MULT = {
  beginner:     { Base: 0.5, Build: 0.5, Peak: 1.0, Taper: 1.0 },
  intermediate: { Base: 1.0, Build: 1.0, Peak: 1.0, Taper: 1.0 },
  elite:        { Base: 1.5, Build: 1.5, Peak: 1.5, Taper: 1.5 },
}
const STRENGTH_COHORT_DUR_MULT = {
  beginner:     { Base: 0.75, Build: 0.70, Peak: 0.70, Taper: 0.60 },
  intermediate: { Base: 1.00, Build: 1.00, Peak: 1.00, Taper: 1.00 },
  elite:        { Base: 1.20, Build: 1.10, Peak: 1.10, Taper: 1.00 },
}
const STRENGTH_COHORT_NOTES = {
  beginner: {
    en: 'Beginner: focus on movement quality over load. Skip plyometrics first 2 weeks. Stop short of failure.',
    tr: 'Başlangıç: yük yerine hareket kalitesine odaklan. İlk 2 hafta plyometriği atla. Başarısızlığa varmadan dur.',
  },
  intermediate: {
    en: 'Intermediate: standard dose. Heavy lifts 75-85% 1RM; explosive lifts 50-60% 1RM at speed.',
    tr: 'Orta seviye: standart doz. Ağır kaldırışlar %75-85 1RM; patlayıcı kaldırışlar hızda %50-60 1RM.',
  },
  elite: {
    en: 'Elite: high-volume periodized (hypertrophy→strength→power 2-week microcycles). Heavy lifts 85-95% 1RM.',
    tr: 'Elit: yüksek-hacim periyodize (hipertrofi→kuvvet→güç 2-haftalık mikrosiklüsler). Ağır kaldırışlar %85-95 1RM.',
  },
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function applyCohortToPhase(phasePlan, phase, cohort) {
  if (!cohort || !STRENGTH_COHORT_FREQ_MULT[cohort]) return phasePlan
  const fMult = STRENGTH_COHORT_FREQ_MULT[cohort][phase] ?? 1.0
  const dMult = STRENGTH_COHORT_DUR_MULT[cohort][phase] ?? 1.0
  return {
    ...phasePlan,
    frequencyPerWeek:   clamp(Math.round(phasePlan.frequencyPerWeek * fMult), 1, 4),
    sessionDurationMin: clamp(Math.round(phasePlan.sessionDurationMin * dMult), 15, 80),
    cohort,
    cohortNote: STRENGTH_COHORT_NOTES[cohort],
  }
}

/**
 * @public
 * @param {{ phases: Array<{phase:string}>, sport?: string, cohort?: 'beginner'|'intermediate'|'elite'|null }} input
 * @returns {Record<string, StrengthPhasePlan>}
 */
export function buildStrengthProgram(input) {
  const present = new Set((input?.phases || []).map(p => p.phase))
  const sport = input?.sport
  const cohort = input?.cohort || null
  const out = {}
  if (present.has('Base'))  out.Base  = applyCohortToPhase(makeBase(sport),  'Base',  cohort)
  if (present.has('Build')) out.Build = applyCohortToPhase(makeBuild(sport), 'Build', cohort)
  if (present.has('Peak'))  out.Peak  = applyCohortToPhase(makePeak(sport),  'Peak',  cohort)
  if (present.has('Taper')) out.Taper = applyCohortToPhase(makeTaper(sport), 'Taper', cohort)
  return out
}

export const STRENGTH_CITATION = 'Rønnestad & Mujika 2014; Beattie et al. 2014; Sáez de Villarreal et al. 2010; Page 2010; Cibulka 2008; Mujika 2003; Mendiguchia 2012; Brumitt 2010; Cools 2003; Wilson 2014'

/**
 * v9.351.0 — Derive a strength program for a FREE-TIER generated plan, giving
 * free-tier athletes the same S&C science the elite-program path already gets
 * (Rønnestad/Beattie max-strength + plyo, phase-periodized). Reads the distinct
 * phases present in the plan's weeks and builds the matching strength phases.
 * Race / Recovery weeks have no strength phase (buildStrengthProgram only emits
 * Base/Build/Peak/Taper) — correct: don't add heavy lifting in race week.
 *
 * Pure. Returns {} when the plan has no usable phases.
 *
 * @param {{ weeks?: Array<{phase?: string}> }} plan
 * @param {string} [sport]
 * @returns {Record<string, object>} phase-keyed strength program (StrengthSection-ready)
 */
export function strengthProgramForPlan(plan, sport) {
  if (!plan || !Array.isArray(plan.weeks)) return {}
  const phases = [...new Set(plan.weeks.map(w => w && w.phase).filter(Boolean))]
  if (phases.length === 0) return {}
  return buildStrengthProgram({ phases: phases.map(phase => ({ phase })), sport })
}
