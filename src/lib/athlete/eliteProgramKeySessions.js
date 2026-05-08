// ─── eliteProgramKeySessions.js — Key-session library per phase per sport ───
//
// Each phase has 3-5 named key workouts that an athlete can actually run.
// Each workout: name + 1-line purpose + structure + warm-up + cool-down +
// intensity target + alternates (for missed/weather/injury) + citation.
//
// Run zones map to Daniels VDOT pace categories (E/M/T/I/R).
// Bike zones map to Coggan FTP-derived L1-L7.
// Swim zones reference CSS (critical swim speed) per Wakayoshi 1992.
//
// All bilingual EN+TR. Pure data — no React, no side effects.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   key: string,
 *   name: Bilingual,
 *   purpose: Bilingual,
 *   structure: Bilingual,
 *   warmup: Bilingual,
 *   cooldown: Bilingual,
 *   intensity: Bilingual,
 *   alternates: Bilingual[],
 *   citation: string
 * }} KeySession
 */

const RUN_BASE = [
  {
    key: 'run-base-long-aerobic',
    name: { en: 'Long aerobic run', tr: 'Uzun aerobik koşu' },
    purpose: {
      en: 'Build mitochondrial density and capillarisation; foundation of aerobic capacity.',
      tr: 'Mitokondri yoğunluğu ve kapillerlerin gelişimi; aerobik kapasitenin temeli.',
    },
    structure: {
      en: '60-150 min continuous at conversational E-pace (Daniels Easy zone).',
      tr: '60-150 dk kesintisiz E-tempo (Daniels Kolay bölgesi), konuşabilecek tempoda.',
    },
    warmup: { en: '10 min walking + easy jog into pace.', tr: '10 dk yürüyüş + tempoya kademeli geçiş.' },
    cooldown: { en: '5-10 min walk + light static stretch.', tr: '5-10 dk yürüyüş + hafif statik esneme.' },
    intensity: { en: '@E-pace · 65-79% HRmax · RPE 4-6/10', tr: '@E-tempo · %65-79 HRmax · RPE 4-6/10' },
    alternates: [
      { en: 'If injured: 90 min easy bike at Z2.', tr: 'Sakatlıkta: 90 dk kolay bisiklet Z2.' },
      { en: 'If short on time: split into 2x AM/PM 45 min.', tr: 'Zaman dar ise: 2x sabah/akşam 45 dk böl.' },
    ],
    citation: 'Daniels 2014',
  },
  {
    key: 'run-base-strides',
    name: { en: 'Easy + 6-8x100m strides', tr: 'Kolay + 6-8x100m adım' },
    purpose: {
      en: 'Maintain neuromuscular sharpness during high-volume aerobic phase.',
      tr: 'Yüksek hacimli aerobik fazda nöromüsküler keskinliği korumak.',
    },
    structure: {
      en: '40-50 min easy + 6-8x100m strides at R-pace with full walk recovery.',
      tr: '40-50 dk kolay + 6-8x100m R-tempo adım, tam yürüyüş toparlanması.',
    },
    warmup: { en: 'Built into easy run.', tr: 'Kolay koşunun içinde.' },
    cooldown: { en: '5 min easy jog after last stride.', tr: 'Son adımdan sonra 5 dk hafif jog.' },
    intensity: { en: 'E + 100m @R-pace (~mile pace) ×6-8', tr: 'E + 100m @R-tempo (~mil temposu) ×6-8' },
    alternates: [
      { en: 'Indoor treadmill: 1% incline + 8x30s @R-pace.', tr: 'Kapalı koşubandı: %1 eğim + 8x30s @R.' },
    ],
    citation: 'Daniels 2014',
  },
  {
    key: 'run-base-tempo-light',
    name: { en: 'Steady-state run', tr: 'Sabit-tempo koşu' },
    purpose: {
      en: 'Bridge from easy aerobic to threshold work; raises ventilatory threshold.',
      tr: 'Kolay aerobikten eşiğe köprü; ventilatör eşiği yükseltir.',
    },
    structure: {
      en: '40-60 min total: 10 min easy + 20-30 min @M-pace + 10 min easy.',
      tr: '40-60 dk toplam: 10 dk kolay + 20-30 dk @M-tempo + 10 dk kolay.',
    },
    warmup: { en: '10 min easy jog into pace.', tr: '10 dk hafif jog tempoya geçiş.' },
    cooldown: { en: '10 min easy jog.', tr: '10 dk hafif jog.' },
    intensity: { en: '@M-pace · 80-89% HRmax · RPE 6/10', tr: '@M-tempo · %80-89 HRmax · RPE 6/10' },
    alternates: [
      { en: 'If fatigued: drop to 15 min @M and add 10 min easy.', tr: 'Yorgunsa: 15 dk @M\'e düşür, 10 dk kolay ekle.' },
    ],
    citation: 'Daniels 2014; Seiler 2010',
  },
  {
    key: 'run-base-hill-circuit',
    name: { en: 'Hill circuits', tr: 'Tepe koşuları' },
    purpose: {
      en: 'Develop running-specific strength and elastic energy return without anaerobic load.',
      tr: 'Anaerobik yük olmadan koşuya özgü kuvvet ve elastik enerji geri dönüşü.',
    },
    structure: {
      en: '15 min warm-up + 8-10x60-90s uphill at hard effort + jog/walk down recovery + 10 min cool-down.',
      tr: '15 dk ısınma + 8-10x60-90s yokuş yukarı sert + jog/yürü dönüş + 10 dk soğuma.',
    },
    warmup: { en: '15 min easy jog + dynamic mobility.', tr: '15 dk hafif jog + dinamik mobilite.' },
    cooldown: { en: '10 min flat easy jog.', tr: '10 dk düz hafif jog.' },
    intensity: { en: '6-8% grade · RPE 8/10 uphill', tr: '%6-8 eğim · RPE 8/10 yukarı' },
    alternates: [
      { en: 'No hills: 8x60s tempo on flat + 90s jog rest.', tr: 'Tepe yok: düzde 8x60s tempo + 90s jog dinlenme.' },
    ],
    citation: 'Barnes & Kilding 2015',
  },
]

const RUN_BUILD = [
  {
    key: 'run-build-threshold-2x20',
    name: { en: 'Threshold 2x20 min', tr: 'Eşik 2x20 dk' },
    purpose: {
      en: 'Raise lactate threshold velocity; hallmark of marathon-distance preparation.',
      tr: 'Laktat eşik hızını yükseltmek; maraton hazırlığının imzası.',
    },
    structure: {
      en: '15 min warm-up + 2x20 min @T-pace with 3 min jog between + 10 min cool-down.',
      tr: '15 dk ısınma + 2x20 dk @T-tempo arada 3 dk jog + 10 dk soğuma.',
    },
    warmup: { en: '15 min easy + 4x100m strides.', tr: '15 dk kolay + 4x100m adım.' },
    cooldown: { en: '10 min easy.', tr: '10 dk kolay.' },
    intensity: { en: '@T-pace · 88-92% HRmax · RPE 7/10', tr: '@T-tempo · %88-92 HRmax · RPE 7/10' },
    alternates: [
      { en: 'Cruise intervals: 4x10 min @T with 90s jog (same total).', tr: 'Cruise interval: 4x10 dk @T, 90s jog (aynı toplam).' },
    ],
    citation: 'Daniels 2014',
  },
  {
    key: 'run-build-cruise',
    name: { en: 'Cruise intervals 5x1km', tr: 'Cruise interval 5x1km' },
    purpose: {
      en: 'Reps long enough to lock in lactate-clearance pacing without excessive fatigue.',
      tr: 'Aşırı yorgunluk olmadan laktat temizleme temposunu sabitleyen tekrarlar.',
    },
    structure: {
      en: '15 min warm-up + 5x1km @T-pace with 60-90s jog recovery + 10 min cool-down.',
      tr: '15 dk ısınma + 5x1km @T-tempo, 60-90s jog dinlenme + 10 dk soğuma.',
    },
    warmup: { en: '15 min easy + drills + strides.', tr: '15 dk kolay + drill + adım.' },
    cooldown: { en: '10 min easy.', tr: '10 dk kolay.' },
    intensity: { en: '@T-pace · RPE 7/10', tr: '@T-tempo · RPE 7/10' },
    alternates: [
      { en: 'Treadmill: same prescription, 1% incline.', tr: 'Koşubandı: aynı reçete, %1 eğim.' },
    ],
    citation: 'Daniels 2014',
  },
  {
    key: 'run-build-progression',
    name: { en: 'Progression long run', tr: 'Aşamalı uzun koşu' },
    purpose: {
      en: 'Teach pacing from aerobic to marathon to threshold under accumulated fatigue.',
      tr: 'Birikmiş yorgunluk altında aerobikten maraton-eşiğe tempolama öğretmek.',
    },
    structure: {
      en: '90-120 min total: first third E-pace, middle third M-pace, last third @T-pace.',
      tr: '90-120 dk toplam: ilk üçte bir E, orta M, son üçte bir @T.',
    },
    warmup: { en: 'First third functions as warm-up.', tr: 'İlk üçte bir ısınma görevi görür.' },
    cooldown: { en: '5 min walk after.', tr: 'Sonrasında 5 dk yürüyüş.' },
    intensity: { en: 'E → M → T (graduated)', tr: 'E → M → T (kademeli)' },
    alternates: [
      { en: 'Shorter version: 60 min E/M/T in 20-min blocks.', tr: 'Kısa versiyon: 60 dk 20\'şer dk E/M/T blokları.' },
    ],
    citation: 'Daniels 2014; Pfitzinger 2014',
  },
  {
    key: 'run-build-hill-strength',
    name: { en: 'Long hill repeats', tr: 'Uzun tepe tekrarları' },
    purpose: {
      en: 'Strength endurance specific to climbing race profiles.',
      tr: 'Tırmanış profilli yarışlara özgü kuvvet dayanıklılığı.',
    },
    structure: {
      en: '15 min warm-up + 5-6x3 min uphill @T-effort + jog down recovery + 10 min cool-down.',
      tr: '15 dk ısınma + 5-6x3 dk yokuş yukarı @T-efor + jog dönüş + 10 dk soğuma.',
    },
    warmup: { en: '15 min easy + drills.', tr: '15 dk kolay + drill.' },
    cooldown: { en: '10 min easy flat.', tr: '10 dk kolay düz.' },
    intensity: { en: '5-7% grade · RPE 7-8/10', tr: '%5-7 eğim · RPE 7-8/10' },
    alternates: [
      { en: 'No hills: 5-6x3 min @T with 2 min jog.', tr: 'Tepe yok: 5-6x3 dk @T, 2 dk jog.' },
    ],
    citation: 'Barnes & Kilding 2015',
  },
]

const RUN_PEAK = [
  {
    key: 'run-peak-vo2-5x3',
    name: { en: 'VO2max 5x3 min', tr: 'VO2max 5x3 dk' },
    purpose: {
      en: 'Maximise time at VO2max — the most potent stimulus for aerobic ceiling.',
      tr: 'VO2max\'ta geçen süreyi en üst düzeye çıkarmak — aerobik tavan için en güçlü uyarı.',
    },
    structure: {
      en: '15 min warm-up + 5x3 min @I-pace (~95-100% VO2max) with 3 min easy jog + 10 min cool-down.',
      tr: '15 dk ısınma + 5x3 dk @I-tempo (~%95-100 VO2max) 3 dk kolay jog + 10 dk soğuma.',
    },
    warmup: { en: '15 min easy + drills + 4x100m strides.', tr: '15 dk kolay + drill + 4x100m adım.' },
    cooldown: { en: '10 min easy.', tr: '10 dk kolay.' },
    intensity: { en: '@I-pace · 95-100% HRmax · RPE 8-9/10', tr: '@I-tempo · %95-100 HRmax · RPE 8-9/10' },
    alternates: [
      { en: 'Tired: 4x3 min instead of 5; do not chase pace.', tr: 'Yorgunsa: 5 yerine 4x3 dk; tempo zorlama.' },
    ],
    citation: 'Billat 2001; Daniels 2014',
  },
  {
    key: 'run-peak-vo2-6x800',
    name: { en: 'VO2max 6x800m', tr: 'VO2max 6x800m' },
    purpose: {
      en: 'Distance-specific VO2max work for 5-10k race preparation.',
      tr: '5-10k yarış için mesafeye özgü VO2max çalışması.',
    },
    structure: {
      en: '15 min warm-up + 6x800m @I-pace with 2:30 jog recovery + 10 min cool-down.',
      tr: '15 dk ısınma + 6x800m @I-tempo, 2:30 jog dinlenme + 10 dk soğuma.',
    },
    warmup: { en: '15 min easy + 4x100m strides.', tr: '15 dk kolay + 4x100m adım.' },
    cooldown: { en: '10 min easy.', tr: '10 dk kolay.' },
    intensity: { en: '@I-pace · RPE 8-9/10', tr: '@I-tempo · RPE 8-9/10' },
    alternates: [
      { en: 'Track unavailable: 6x3 min on grass/path.', tr: 'Pist yoksa: çim/parkurda 6x3 dk.' },
    ],
    citation: 'Daniels 2014',
  },
  {
    key: 'run-peak-race-pace',
    name: { en: 'Race-pace specific 5x1km', tr: 'Yarış-temposu 5x1km' },
    purpose: {
      en: 'Lock target race pace into neuromuscular memory under controlled fatigue.',
      tr: 'Hedef yarış temposunu kontrollü yorgunlukta nöromüsküler hafızaya yerleştirmek.',
    },
    structure: {
      en: '15 min warm-up + 5x1km at goal race pace with 90s jog + 10 min cool-down.',
      tr: '15 dk ısınma + 5x1km hedef yarış temposunda, 90s jog + 10 dk soğuma.',
    },
    warmup: { en: '15 min easy + drills + 4x100m.', tr: '15 dk kolay + drill + 4x100m.' },
    cooldown: { en: '10 min easy.', tr: '10 dk kolay.' },
    intensity: { en: 'Goal race pace · RPE 7-8/10', tr: 'Hedef yarış temposu · RPE 7-8/10' },
    alternates: [
      { en: 'Less rest: 60s jog to simulate end-of-race.', tr: 'Daha az dinlenme: yarış sonunu taklit için 60s jog.' },
    ],
    citation: 'Daniels 2014; Pfitzinger 2014',
  },
  {
    key: 'run-peak-tempo-strides',
    name: { en: 'Tempo + strides', tr: 'Tempo + adımlar' },
    purpose: {
      en: 'Quality medium session; preserves freshness while sharpening race feel.',
      tr: 'Kaliteli orta seans; yarış hissini bilerken tazeliği korur.',
    },
    structure: {
      en: '10 min easy + 20 min @T-pace + 6x100m strides with full walk recovery + 5 min cool-down.',
      tr: '10 dk kolay + 20 dk @T-tempo + 6x100m adım tam yürü dinlenme + 5 dk soğuma.',
    },
    warmup: { en: '10 min easy.', tr: '10 dk kolay.' },
    cooldown: { en: '5 min easy.', tr: '5 dk kolay.' },
    intensity: { en: '@T-pace + R-strides', tr: '@T-tempo + R-adım' },
    alternates: [],
    citation: 'Daniels 2014',
  },
]

const RUN_TAPER = [
  {
    key: 'run-taper-race-pace-short',
    name: { en: 'Race-pace primer 4x400m', tr: 'Yarış-tempo açılış 4x400m' },
    purpose: {
      en: 'Recall race-pace neural patterns at low total volume during taper.',
      tr: 'Taper sırasında düşük toplam hacimde yarış-temposu nöral kalıpları hatırlatmak.',
    },
    structure: {
      en: '10 min warm-up + 4x400m at goal race pace with 90s walk + 5 min cool-down.',
      tr: '10 dk ısınma + 4x400m hedef yarış temposunda, 90s yürüyüş + 5 dk soğuma.',
    },
    warmup: { en: '10 min easy + 4x100m strides.', tr: '10 dk kolay + 4x100m adım.' },
    cooldown: { en: '5 min easy walk-jog.', tr: '5 dk kolay yürü-jog.' },
    intensity: { en: 'Goal race pace · RPE 7/10 (controlled)', tr: 'Hedef yarış temposu · RPE 7/10 (kontrollü)' },
    alternates: [
      { en: 'Substitute 4x60s @R-pace if track unavailable.', tr: 'Pist yoksa 4x60s @R-tempo.' },
    ],
    citation: 'Mujika 2003; Pfitzinger 2014',
  },
  {
    key: 'run-taper-shakeout',
    name: { en: 'Pre-race shakeout', tr: 'Yarış öncesi açılış' },
    purpose: {
      en: 'Wake up the legs without inducing any fatigue before race day.',
      tr: 'Yarış gününden önce bacakları, yorgunluk yaratmadan açmak.',
    },
    structure: {
      en: '15-20 min easy + 4x20s strides at race pace with full walk recovery.',
      tr: '15-20 dk kolay + 4x20s yarış temposunda adım, tam yürü dinlenme.',
    },
    warmup: { en: 'First 5 min functions as warm-up.', tr: 'İlk 5 dk ısınma görevi görür.' },
    cooldown: { en: '5 min walk after.', tr: 'Sonrasında 5 dk yürüyüş.' },
    intensity: { en: 'E + 4 short race-pace touches', tr: 'E + 4 kısa yarış-tempo dokunuşu' },
    alternates: [],
    citation: 'Mujika 2003',
  },
  {
    key: 'run-taper-easy-short',
    name: { en: 'Short easy + form', tr: 'Kısa kolay + form' },
    purpose: {
      en: 'Maintain blood flow and movement quality during taper week.',
      tr: 'Taper haftasında kan akışı ve hareket kalitesini korumak.',
    },
    structure: { en: '20-30 min easy with light drills.', tr: '20-30 dk kolay + hafif drill.' },
    warmup: { en: 'Built into easy run.', tr: 'Kolay koşunun içinde.' },
    cooldown: { en: '5 min walk + stretch.', tr: '5 dk yürüyüş + esneme.' },
    intensity: { en: '@E-pace', tr: '@E-tempo' },
    alternates: [],
    citation: 'Mujika 2003',
  },
]

const BIKE_BASE = [
  {
    key: 'bike-base-z2-long',
    name: { en: 'Long Z2 endurance ride', tr: 'Uzun Z2 dayanıklılık sürüşü' },
    purpose: {
      en: 'Aerobic base — primary driver of fat oxidation and capillary density.',
      tr: 'Aerobik temel — yağ oksidasyonu ve kapiller yoğunluğunun ana itici gücü.',
    },
    structure: {
      en: '90-240 min steady at Coggan Z2 (56-75% FTP) with the last 30 min slightly higher if fresh.',
      tr: '90-240 dk Coggan Z2 (FTP\'nin %56-75) sabit; tazelse son 30 dk biraz daha yüksek.',
    },
    warmup: { en: '15 min Z1 progressing into Z2.', tr: '15 dk Z1 → Z2 kademeli.' },
    cooldown: { en: '10 min Z1 spin.', tr: '10 dk Z1 dönüş.' },
    intensity: { en: 'Z2 · 56-75% FTP · RPE 4-5/10', tr: 'Z2 · FTP\'nin %56-75 · RPE 4-5/10' },
    alternates: [
      { en: 'Indoor: 90 min Z2 with 4x10 min @75% FTP focus blocks.', tr: 'Kapalı: 90 dk Z2 + 4x10 dk %75 FTP odak blokları.' },
    ],
    citation: 'Coggan 2010',
  },
  {
    key: 'bike-base-tempo',
    name: { en: 'Tempo 3x15 min', tr: 'Tempo 3x15 dk' },
    purpose: {
      en: 'Bridge from Z2 base to sweet-spot work; raises aerobic durability.',
      tr: 'Z2 temelinden sweet-spot\'a köprü; aerobik dayanıklılığı yükseltir.',
    },
    structure: {
      en: '15 min Z1-Z2 + 3x15 min @76-85% FTP with 5 min Z1 between + 10 min cool-down.',
      tr: '15 dk Z1-Z2 + 3x15 dk @FTP %76-85, arada 5 dk Z1 + 10 dk soğuma.',
    },
    warmup: { en: '15 min Z1-Z2 progressive.', tr: '15 dk Z1-Z2 kademeli.' },
    cooldown: { en: '10 min Z1 spin.', tr: '10 dk Z1 dönüş.' },
    intensity: { en: 'Z3 (Tempo) · RPE 6/10', tr: 'Z3 (Tempo) · RPE 6/10' },
    alternates: [
      { en: 'Indoor short: 2x20 min Z3 with 5 min easy.', tr: 'Kapalı kısa: 2x20 dk Z3, 5 dk kolay.' },
    ],
    citation: 'Coggan 2010; Allen & Coggan 2019',
  },
  {
    key: 'bike-base-sweet-spot',
    name: { en: 'Sweet-spot 2x20 min', tr: 'Sweet-spot 2x20 dk' },
    purpose: {
      en: 'High aerobic stimulus per minute; classic late-base session.',
      tr: 'Dakika başına yüksek aerobik uyarı; klasik geç-temel seansı.',
    },
    structure: {
      en: '15 min warm-up + 2x20 min @88-93% FTP with 8 min easy + 10 min cool-down.',
      tr: '15 dk ısınma + 2x20 dk @FTP %88-93, 8 dk kolay arada + 10 dk soğuma.',
    },
    warmup: { en: '15 min Z1-Z2.', tr: '15 dk Z1-Z2.' },
    cooldown: { en: '10 min Z1 spin.', tr: '10 dk Z1 dönüş.' },
    intensity: { en: 'Sweet-spot (Z3-Z4) · RPE 6-7/10', tr: 'Sweet-spot (Z3-Z4) · RPE 6-7/10' },
    alternates: [
      { en: 'Outdoor with hills: 2x20 min steady climb at SS effort.', tr: 'Tepeli açık: 2x20 dk sabit tırmanış SS efor.' },
    ],
    citation: 'Coggan 2010',
  },
]

const BIKE_BUILD = [
  {
    key: 'bike-build-threshold-2x20',
    name: { en: 'Threshold 2x20 min', tr: 'Eşik 2x20 dk' },
    purpose: {
      en: 'Elevate FTP directly; flagship build-phase session.',
      tr: 'FTP\'yi doğrudan yükseltmek; build fazının amiral gemisi seansı.',
    },
    structure: {
      en: '15 min warm-up + 2x20 min @95-105% FTP with 8 min easy + 10 min cool-down.',
      tr: '15 dk ısınma + 2x20 dk @FTP %95-105, 8 dk kolay arada + 10 dk soğuma.',
    },
    warmup: { en: '15 min Z1-Z2 + 3x1 min openers.', tr: '15 dk Z1-Z2 + 3x1 dk açılışlar.' },
    cooldown: { en: '10 min Z1.', tr: '10 dk Z1.' },
    intensity: { en: 'Z4 (LT) · RPE 8/10', tr: 'Z4 (LT) · RPE 8/10' },
    alternates: [
      { en: 'Less rest: 2x20 with 5 min easy for higher load.', tr: 'Daha az dinlenme: 2x20, 5 dk kolay (daha yüksek yük).' },
    ],
    citation: 'Coggan 2010; Allen & Coggan 2019',
  },
  {
    key: 'bike-build-ovbu',
    name: { en: 'Over-under 4x6 min', tr: 'Over-under 4x6 dk' },
    purpose: {
      en: 'Train lactate clearance under repeated supra-threshold pulses.',
      tr: 'Tekrarlanan eşik-üstü darbeler altında laktat temizleme antrenmanı.',
    },
    structure: {
      en: '15 min warm-up + 4x6 min alternating 90s @95% / 30s @110% FTP, with 4 min easy between sets + 10 min cool-down.',
      tr: '15 dk ısınma + 4x6 dk; 90s @%95 / 30s @%110 FTP dönüşümlü, setler arası 4 dk kolay + 10 dk soğuma.',
    },
    warmup: { en: '15 min progressive.', tr: '15 dk kademeli.' },
    cooldown: { en: '10 min Z1.', tr: '10 dk Z1.' },
    intensity: { en: 'Z4-Z5 oscillating · RPE 8-9/10', tr: 'Z4-Z5 dalgalı · RPE 8-9/10' },
    alternates: [
      { en: 'Reduce to 3x6 min if VL begins to drop on third set.', tr: 'Üçüncü sette güç düşerse 3x6 dk\'ya indir.' },
    ],
    citation: 'Coggan 2010',
  },
  {
    key: 'bike-build-vo2-5x4',
    name: { en: 'VO2max 5x4 min', tr: 'VO2max 5x4 dk' },
    purpose: {
      en: 'Lift aerobic ceiling; supports breakaway/climb capacity.',
      tr: 'Aerobik tavanı yükseltir; atak/tırmanış kapasitesini destekler.',
    },
    structure: {
      en: '15 min warm-up + 5x4 min @106-120% FTP with 4 min Z1 + 10 min cool-down.',
      tr: '15 dk ısınma + 5x4 dk @FTP %106-120, 4 dk Z1 + 10 dk soğuma.',
    },
    warmup: { en: '15 min progressive + 3x30s @110%.', tr: '15 dk kademeli + 3x30s @%110.' },
    cooldown: { en: '10 min Z1.', tr: '10 dk Z1.' },
    intensity: { en: 'Z5 · RPE 9/10', tr: 'Z5 · RPE 9/10' },
    alternates: [
      { en: '5x3 min @115% if 4 min reps unsustainable.', tr: '4 dk sürdürülemiyorsa 5x3 dk @%115.' },
    ],
    citation: 'Rønnestad 2014; Coggan 2010',
  },
]

const BIKE_PEAK = [
  {
    key: 'bike-peak-vo2-30-15',
    name: { en: 'VO2 30/15s ×13', tr: 'VO2 30/15s ×13' },
    purpose: {
      en: 'Time-at-VO2max maximised by short on/off — Rønnestad 2020.',
      tr: 'Kısa on/off ile VO2max\'ta geçen süreyi en üst düzeye çıkarır — Rønnestad 2020.',
    },
    structure: {
      en: '15 min warm-up + 3 sets of 13x(30s @115% FTP / 15s @60% FTP) with 4 min Z1 between sets + 10 min cool-down.',
      tr: '15 dk ısınma + 3 set 13x(30s @FTP %115 / 15s @%60), setler arası 4 dk Z1 + 10 dk soğuma.',
    },
    warmup: { en: '15 min progressive + 3x30s openers.', tr: '15 dk kademeli + 3x30s açılış.' },
    cooldown: { en: '10 min Z1.', tr: '10 dk Z1.' },
    intensity: { en: 'Z5/Z2 oscillating · RPE 9/10', tr: 'Z5/Z2 dalgalı · RPE 9/10' },
    alternates: [
      { en: '2 sets if first session of this protocol.', tr: 'Bu protokolün ilk denemesinde 2 set.' },
    ],
    citation: 'Rønnestad et al. 2020',
  },
  {
    key: 'bike-peak-race-sim',
    name: { en: 'Race-pace simulation 60-90 min', tr: 'Yarış temposu simülasyonu 60-90 dk' },
    purpose: {
      en: 'Rehearse race-day pacing, fueling, position, equipment.',
      tr: 'Yarış günü tempolama, beslenme, pozisyon ve ekipman provası.',
    },
    structure: {
      en: '15 min warm-up + 60-90 min at goal race power with race-day fueling + 10 min cool-down.',
      tr: '15 dk ısınma + 60-90 dk hedef yarış gücü + yarış günü beslenmesi + 10 dk soğuma.',
    },
    warmup: { en: '15 min progressive + race openers.', tr: '15 dk kademeli + yarış açılışları.' },
    cooldown: { en: '10 min Z1.', tr: '10 dk Z1.' },
    intensity: { en: 'Goal race power', tr: 'Hedef yarış gücü' },
    alternates: [
      { en: 'Indoor: same on smart trainer with race profile.', tr: 'Kapalı: yarış profilli akıllı trainer\'da aynı.' },
    ],
    citation: 'Allen & Coggan 2019',
  },
  {
    key: 'bike-peak-anaerobic-bursts',
    name: { en: 'Anaerobic bursts 8x1 min', tr: 'Anaerobik patlamalar 8x1 dk' },
    purpose: {
      en: 'Top-end power for surges, attacks, and final efforts.',
      tr: 'Atak, sıçrama ve son efor için tepe güç.',
    },
    structure: {
      en: '15 min warm-up + 8x1 min @130-150% FTP with 3 min Z1 + 10 min cool-down.',
      tr: '15 dk ısınma + 8x1 dk @FTP %130-150, 3 dk Z1 + 10 dk soğuma.',
    },
    warmup: { en: '15 min progressive + 3x30s openers.', tr: '15 dk kademeli + 3x30s açılış.' },
    cooldown: { en: '10 min Z1.', tr: '10 dk Z1.' },
    intensity: { en: 'Z6 · RPE 9-10/10', tr: 'Z6 · RPE 9-10/10' },
    alternates: [
      { en: 'Reduce to 6 reps if power drops >10% on later reps.', tr: 'Son tekrarlarda güç >%10 düşerse 6 tekrar.' },
    ],
    citation: 'Coggan 2010',
  },
]

const BIKE_TAPER = [
  {
    key: 'bike-taper-openers',
    name: { en: 'Openers 5x1 min', tr: 'Açılışlar 5x1 dk' },
    purpose: {
      en: 'Wake the system 2-3 days pre-race without depleting glycogen.',
      tr: 'Yarıştan 2-3 gün önce sistemi açmak; glikojeni tüketmeden.',
    },
    structure: {
      en: '20-30 min easy + 5x1 min @ goal race power with 2 min Z1 + 5 min cool-down.',
      tr: '20-30 dk kolay + 5x1 dk hedef yarış gücü, 2 dk Z1 + 5 dk soğuma.',
    },
    warmup: { en: '20 min Z1-Z2 progressive.', tr: '20 dk Z1-Z2 kademeli.' },
    cooldown: { en: '5 min Z1 spin.', tr: '5 dk Z1 dönüş.' },
    intensity: { en: 'Goal race power · RPE 7/10', tr: 'Hedef yarış gücü · RPE 7/10' },
    alternates: [],
    citation: 'Mujika 2003',
  },
  {
    key: 'bike-taper-easy-spin',
    name: { en: 'Easy spin 30-45 min', tr: 'Kolay dönüş 30-45 dk' },
    purpose: {
      en: 'Active recovery; preserve aerobic engine without fatigue.',
      tr: 'Aktif toparlanma; yorulmadan aerobik motoru korumak.',
    },
    structure: { en: '30-45 min Z1-Z2 cadence-focused.', tr: '30-45 dk Z1-Z2, kadans odaklı.' },
    warmup: { en: 'First 10 min functions as warm-up.', tr: 'İlk 10 dk ısınma görevi görür.' },
    cooldown: { en: '5 min walk off bike.', tr: 'Bisikletten 5 dk sonra yürüyüş.' },
    intensity: { en: 'Z1-Z2 · RPE 3-4/10', tr: 'Z1-Z2 · RPE 3-4/10' },
    alternates: [],
    citation: 'Mujika 2003',
  },
]

const SWIM_BASE = [
  {
    key: 'swim-base-aerobic-volume',
    name: { en: 'Aerobic volume 3000-4000m', tr: 'Aerobik hacim 3000-4000m' },
    purpose: {
      en: 'Build swim-specific aerobic base — high meterage, moderate intensity.',
      tr: 'Yüzmeye özgü aerobik temel — yüksek metre, orta şiddet.',
    },
    structure: {
      en: '400m WU + 8x100m drill/swim + 20x100m @CSS+15s on 2:00 + 200m cool-down (~3000-4000m total).',
      tr: '400m ısınma + 8x100m drill/yüzme + 20x100m @CSS+15s 2:00 üzerinde + 200m soğuma (~3000-4000m).',
    },
    warmup: { en: '400m mixed strokes + drills.', tr: '400m karışık stiller + drill.' },
    cooldown: { en: '200m easy backstroke/freestyle.', tr: '200m kolay sırtüstü/serbest.' },
    intensity: { en: 'CSS+15s · RPE 5-6/10', tr: 'CSS+15s · RPE 5-6/10' },
    alternates: [
      { en: 'Open water: 60 min steady at perceived CSS effort.', tr: 'Açık su: 60 dk algılanan CSS efor sabit.' },
    ],
    citation: 'Wakayoshi 1992; Maglischo 2003',
  },
  {
    key: 'swim-base-technique',
    name: { en: 'Technique + drills 1500-2000m', tr: 'Teknik + drill 1500-2000m' },
    purpose: {
      en: 'Improve stroke economy; cheap meterage with high carryover.',
      tr: 'Stroke ekonomisini iyileştir; ucuz metre, yüksek getiri.',
    },
    structure: {
      en: '300m WU + 12x50m drill (catch-up, single-arm, fingertip drag, fist) + 4x200m smooth swim + 200m cool-down.',
      tr: '300m ısınma + 12x50m drill (catch-up, tek kol, parmak ucu, yumruk) + 4x200m akıcı yüzme + 200m soğuma.',
    },
    warmup: { en: '300m easy + 4x50m kick.', tr: '300m kolay + 4x50m vuruş.' },
    cooldown: { en: '200m easy.', tr: '200m kolay.' },
    intensity: { en: 'Easy-moderate · RPE 4-6/10', tr: 'Kolay-orta · RPE 4-6/10' },
    alternates: [],
    citation: 'Maglischo 2003',
  },
  {
    key: 'swim-base-css-intro',
    name: { en: 'CSS intro 8x100m', tr: 'CSS giriş 8x100m' },
    purpose: {
      en: 'First exposure to threshold pace work in swim.',
      tr: 'Yüzmede eşik temposuyla ilk tanışma.',
    },
    structure: {
      en: '300m WU + 8x100m @CSS pace on 1:50 + 200m cool-down.',
      tr: '300m ısınma + 8x100m @CSS temposu 1:50 üzerinde + 200m soğuma.',
    },
    warmup: { en: '300m easy + 4x50m build.', tr: '300m kolay + 4x50m artarak.' },
    cooldown: { en: '200m easy.', tr: '200m kolay.' },
    intensity: { en: 'CSS · RPE 7/10', tr: 'CSS · RPE 7/10' },
    alternates: [],
    citation: 'Wakayoshi 1992',
  },
]

const SWIM_BUILD = [
  {
    key: 'swim-build-css-set',
    name: { en: 'CSS 12x100m', tr: 'CSS 12x100m' },
    purpose: {
      en: 'Threshold pace at race-relevant volume.',
      tr: 'Yarışla ilgili hacimde eşik tempo.',
    },
    structure: {
      en: '400m WU + 12x100m @CSS on 1:45 (or +5s above CSS) + 200m cool-down.',
      tr: '400m ısınma + 12x100m @CSS 1:45 (veya CSS+5s) + 200m soğuma.',
    },
    warmup: { en: '400m mixed + 4x50m build.', tr: '400m karışık + 4x50m artarak.' },
    cooldown: { en: '200m easy.', tr: '200m kolay.' },
    intensity: { en: 'CSS · RPE 8/10', tr: 'CSS · RPE 8/10' },
    alternates: [
      { en: 'Reduce to 10x100m if pace drift >2s on later reps.', tr: 'Son tekrarlarda tempo >2s kayıyorsa 10x100m\'e düş.' },
    ],
    citation: 'Wakayoshi 1992; Maglischo 2003',
  },
  {
    key: 'swim-build-broken-200',
    name: { en: 'Broken 200s 6x', tr: 'Bölünmüş 200\'ler 6x' },
    purpose: {
      en: 'Race-specific lactate tolerance under 200/400m profile.',
      tr: '200/400m profil altında yarışa özgü laktat toleransı.',
    },
    structure: {
      en: '400m WU + 6x(200m broken: 100/50/50 with 10s rest within set) on 4:00 send-off + 200m cool-down.',
      tr: '400m ısınma + 6x(200m bölünmüş: 100/50/50 set içinde 10s dinlenme) 4:00 üzerinde + 200m soğuma.',
    },
    warmup: { en: '400m mixed + 4x100m build.', tr: '400m karışık + 4x100m artarak.' },
    cooldown: { en: '200m easy.', tr: '200m kolay.' },
    intensity: { en: 'Faster than CSS · RPE 9/10', tr: 'CSS\'den hızlı · RPE 9/10' },
    alternates: [],
    citation: 'Maglischo 2003',
  },
  {
    key: 'swim-build-pull-set',
    name: { en: 'Pull set 8x200m', tr: 'Çekiş seti 8x200m' },
    purpose: {
      en: 'Upper-body strength endurance; bridge to race fatigue.',
      tr: 'Üst-vücut kuvvet dayanıklılığı; yarış yorgunluğuna köprü.',
    },
    structure: {
      en: '300m WU + 8x200m pull (paddles + buoy) @CSS+5s on 3:30 + 200m cool-down.',
      tr: '300m ısınma + 8x200m çekiş (kürek + şamandıra) @CSS+5s 3:30 üzerinde + 200m soğuma.',
    },
    warmup: { en: '300m mixed.', tr: '300m karışık.' },
    cooldown: { en: '200m easy.', tr: '200m kolay.' },
    intensity: { en: 'CSS+5s · RPE 7-8/10', tr: 'CSS+5s · RPE 7-8/10' },
    alternates: [
      { en: 'No equipment: same set freestyle.', tr: 'Ekipman yoksa: aynı set serbest.' },
    ],
    citation: 'Maglischo 2003',
  },
]

const SWIM_PEAK = [
  {
    key: 'swim-peak-vo2-12x50',
    name: { en: 'VO2 12x50m hard', tr: 'VO2 12x50m sert' },
    purpose: {
      en: 'Sharpen top-end aerobic power.',
      tr: 'Üst-uç aerobik gücü keskinleştirir.',
    },
    structure: {
      en: '400m WU + 12x50m all-out on 1:30 send-off + 200m cool-down.',
      tr: '400m ısınma + 12x50m sonuna kadar 1:30 üzerinde + 200m soğuma.',
    },
    warmup: { en: '400m + 4x50m build.', tr: '400m + 4x50m artarak.' },
    cooldown: { en: '200m easy.', tr: '200m kolay.' },
    intensity: { en: 'Faster than 200m race pace · RPE 9/10', tr: '200m yarış temposundan hızlı · RPE 9/10' },
    alternates: [],
    citation: 'Maglischo 2003',
  },
  {
    key: 'swim-peak-race-pace',
    name: { en: 'Race-pace 4x400m', tr: 'Yarış-tempo 4x400m' },
    purpose: {
      en: 'Specific race-pace rehearsal at distance.',
      tr: 'Mesafede özgül yarış-temposu provası.',
    },
    structure: {
      en: '400m WU + 4x400m at goal race pace on 7:00 send-off + 200m cool-down.',
      tr: '400m ısınma + 4x400m hedef yarış temposunda 7:00 üzerinde + 200m soğuma.',
    },
    warmup: { en: '400m mixed + 4x50m build.', tr: '400m karışık + 4x50m artarak.' },
    cooldown: { en: '200m easy.', tr: '200m kolay.' },
    intensity: { en: 'Goal race pace · RPE 8-9/10', tr: 'Hedef yarış temposu · RPE 8-9/10' },
    alternates: [],
    citation: 'Maglischo 2003',
  },
]

const SWIM_TAPER = [
  {
    key: 'swim-taper-short-sharp',
    name: { en: 'Short + sharp 6x50m', tr: 'Kısa + keskin 6x50m' },
    purpose: {
      en: 'Maintain race speed feel without volume load.',
      tr: 'Hacim yükü olmadan yarış hızı hissini korumak.',
    },
    structure: {
      en: '300m WU + 6x50m at race pace on 2:00 + 200m cool-down.',
      tr: '300m ısınma + 6x50m yarış temposunda 2:00 üzerinde + 200m soğuma.',
    },
    warmup: { en: '300m mixed.', tr: '300m karışık.' },
    cooldown: { en: '200m easy.', tr: '200m kolay.' },
    intensity: { en: 'Race pace · RPE 7-8/10', tr: 'Yarış temposu · RPE 7-8/10' },
    alternates: [],
    citation: 'Mujika 2003',
  },
  {
    key: 'swim-taper-easy',
    name: { en: 'Easy technique 1500m', tr: 'Kolay teknik 1500m' },
    purpose: {
      en: 'Maintain feel for the water during taper.',
      tr: 'Taper boyunca su hissini korumak.',
    },
    structure: { en: '1500m total: 500m drills + 1000m steady at CSS+20s.', tr: '1500m toplam: 500m drill + 1000m sabit @CSS+20s.' },
    warmup: { en: 'First 200m functions as warm-up.', tr: 'İlk 200m ısınma görevi görür.' },
    cooldown: { en: '100m easy backstroke.', tr: '100m kolay sırtüstü.' },
    intensity: { en: 'Easy · RPE 4/10', tr: 'Kolay · RPE 4/10' },
    alternates: [],
    citation: 'Mujika 2003',
  },
]

const LIBRARY = {
  run:  { Base: RUN_BASE,  Build: RUN_BUILD,  Peak: RUN_PEAK,  Taper: RUN_TAPER  },
  bike: { Base: BIKE_BASE, Build: BIKE_BUILD, Peak: BIKE_PEAK, Taper: BIKE_TAPER },
  swim: { Base: SWIM_BASE, Build: SWIM_BUILD, Peak: SWIM_PEAK, Taper: SWIM_TAPER },
}

/**
 * @public
 * @param {'run'|'bike'|'swim'|'triathlon'} sport
 * @returns {Record<'Base'|'Build'|'Peak'|'Taper', KeySession[]>}
 */
export function getKeySessionsBySport(sport) {
  if (sport === 'triathlon') {
    // Triathlon merges run + bike + swim — return run by default; UI may surface all 3.
    return LIBRARY.run
  }
  return LIBRARY[sport] || LIBRARY.run
}

/**
 * @public
 * @param {{ sport: 'run'|'bike'|'swim'|'triathlon', phases: Array<{phase:string}> }} input
 * @returns {{ Base: KeySession[], Build: KeySession[], Peak: KeySession[], Taper: KeySession[] }}
 */
export function buildKeySessionLibrary(input) {
  const { sport, phases } = input || {}
  const lib = getKeySessionsBySport(sport)
  const present = new Set((phases || []).map(p => p.phase))
  return {
    Base:  present.has('Base')  ? lib.Base  : [],
    Build: present.has('Build') ? lib.Build : [],
    Peak:  present.has('Peak')  ? lib.Peak  : [],
    Taper: present.has('Taper') ? lib.Taper : [],
  }
}

/** @public Triathlon-specific: returns swim + bike + run sessions for the phase. */
export function buildTriathlonKeySessions(phase) {
  return {
    swim: LIBRARY.swim[phase] || [],
    bike: LIBRARY.bike[phase] || [],
    run:  LIBRARY.run[phase]  || [],
  }
}

export const KEY_SESSION_CITATION = 'Daniels 2014; Coggan 2010; Wakayoshi 1992; Maglischo 2003; Rønnestad 2020; Mujika 2003; Pfitzinger 2014; Billat 2001; Barnes & Kilding 2015'
