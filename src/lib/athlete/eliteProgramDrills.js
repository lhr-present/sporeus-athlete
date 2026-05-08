// ─── eliteProgramDrills.js — Sport-specific drills per phase (v9.9.0) ────────
//
// Drills are short, technique-focused supplements to the main aerobic/threshold
// sessions. They build the neuromuscular pattern the athlete will need at
// race speed without adding meaningful aerobic load.
//
// Each sport ships 4-6 drills with phase tags. Phases:
//   Base   — technique foundation (high reps, low intensity, focus on form)
//   Build  — power transfer (medium reps, compound movements)
//   Peak   — race speed (low reps, race-cadence neuromuscular firing)
//   Taper  — minimal volume, neural priming only
//
// Bilingual EN+TR. Pure data — no React, no side effects.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   key: string,
 *   name: Bilingual,
 *   purpose: Bilingual,
 *   structure: Bilingual,
 *   phases: ('Base'|'Build'|'Peak'|'Taper')[],
 *   frequencyPerWeek: number,
 *   citation: string,
 * }} Drill
 */

const RUN_DRILLS = [
  {
    key: 'run-drill-a-skip',
    name: { en: 'A-skip', tr: 'A-skip' },
    purpose: {
      en: 'Reinforces high knee drive, foot recovery under hip, and cadence rhythm.',
      tr: 'Yüksek diz itimi, kalçanın altında ayak toparlanması ve kadans ritmini güçlendirir.',
    },
    structure: { en: '4x20m with walk-back recovery, focus on quick foot strikes.', tr: '4x20m yürüyüş geri dönüşle, hızlı ayak temasına odaklan.' },
    phases: ['Base', 'Build'],
    frequencyPerWeek: 2,
    citation: 'Pfitzinger 2014; Daniels 2014',
  },
  {
    key: 'run-drill-b-skip',
    name: { en: 'B-skip', tr: 'B-skip' },
    purpose: {
      en: 'Adds active hamstring engagement; teaches forward-pawing foot strike.',
      tr: 'Aktif arka bacak çalışmasını ekler; ileri-pençe ayak temasını öğretir.',
    },
    structure: { en: '4x20m with walk-back; extend leg forward then sweep down.', tr: '4x20m yürüyüş geri; bacağı öne uzat sonra aşağı süpür.' },
    phases: ['Base', 'Build'],
    frequencyPerWeek: 2,
    citation: 'Pfitzinger 2014',
  },
  {
    key: 'run-drill-strides',
    name: { en: 'Strides 6x100m', tr: 'Adımlar 6x100m' },
    purpose: {
      en: 'Neuromuscular sharpening at race pace + 5-10s/km. Maintains top-end without adding load.',
      tr: 'Yarış temposunda + 5-10s/km nöromüsküler keskinleştirme. Yük eklemeden üst-uç korur.',
    },
    structure: { en: '6x100m at R-pace with full walk recovery (60-90s). 30-50m progressive accel.', tr: '6x100m R-tempo, tam yürüyüş dinlenme (60-90s). 30-50m kademeli hızlanma.' },
    phases: ['Base', 'Build', 'Peak', 'Taper'],
    frequencyPerWeek: 2,
    citation: 'Daniels 2014; Beattie 2014',
  },
  {
    key: 'run-drill-hill-bounding',
    name: { en: 'Hill bounding 4x30m', tr: 'Tepe sıçraması 4x30m' },
    purpose: {
      en: 'Develops elastic strength and ground-contact stiffness. Plyometric without high impact.',
      tr: 'Elastik güç ve yer-teması sertliği geliştirir. Yüksek darbe olmadan plyometrik.',
    },
    structure: { en: '4x30m exaggerated bounding up 5-7% grade. Walk down recovery. After warm-up, before main session.', tr: '4x30m abartılı sıçrama %5-7 eğimde. Yürüyerek geri dön. Isınmadan sonra, ana seansdan önce.' },
    phases: ['Build'],
    frequencyPerWeek: 1,
    citation: 'Beattie 2014; Saunders 2006',
  },
  {
    key: 'run-drill-cadence',
    name: { en: 'Cadence 180+ check', tr: 'Kadans 180+ kontrolü' },
    purpose: {
      en: 'Establish 175-185 spm baseline; over-stride risk drops with higher cadence.',
      tr: '175-185 spm taban kur; daha yüksek kadansla aşırı-adım riski azalır.',
    },
    structure: { en: 'During easy run, 4x60s at 180+ cadence (count L-foot strikes for 30s, ×4 = spm).', tr: 'Kolay koşuda, 4x60s 180+ kadansta (sol ayak vuruşunu 30s say, ×4 = spm).' },
    phases: ['Base'],
    frequencyPerWeek: 1,
    citation: 'Hannah Heffernan 2014; Daniels 2014',
  },
]

const BIKE_DRILLS = [
  {
    key: 'bike-drill-single-leg',
    name: { en: 'Single-leg drill 4x60s', tr: 'Tek-bacak 4x60s' },
    purpose: {
      en: 'Reveals dead-spots in pedal stroke; teaches smooth round-stroke firing pattern.',
      tr: 'Pedal vuruşundaki ölü-noktaları açığa çıkarır; pürüzsüz yuvarlak vuruş ateşleme paterni öğretir.',
    },
    structure: { en: 'Indoor: unclip one foot, rest on frame, pedal 60s with the other. Switch. 4 each side.', tr: 'Kapalıda: bir ayağı çıkar, kadroda dinlendir, diğeriyle 60s pedal. Değiş. Her tarafta 4.' },
    phases: ['Base', 'Build'],
    frequencyPerWeek: 2,
    citation: 'Coggan & Allen 2010',
  },
  {
    key: 'bike-drill-cadence-ladder',
    name: { en: 'Cadence ladder 80→110 rpm', tr: 'Kadans merdiveni 80→110 rpm' },
    purpose: {
      en: 'Trains the neuromuscular range from 80 to 110 rpm; race cadence usually 90-100 rpm.',
      tr: '80\'den 110 rpm\'a nöromüsküler aralığı antrene eder; yarış kadansı genelde 90-100 rpm.',
    },
    structure: { en: '5x2 min: 80-90-100-105-110 rpm at Z2 power. 90s recovery at 90 rpm between.', tr: '5x2 dk: 80-90-100-105-110 rpm Z2 güçte. Aralarda 90s 90 rpm toparlanma.' },
    phases: ['Base', 'Build'],
    frequencyPerWeek: 1,
    citation: 'Coggan & Allen 2010',
  },
  {
    key: 'bike-drill-standing-sprints',
    name: { en: 'Standing sprints 6x10s', tr: 'Ayakta sprintler 6x10s' },
    purpose: {
      en: 'Top-end neuromuscular peak power; replicates climb-out-of-saddle race demand.',
      tr: 'Üst-uç nöromüsküler tepe gücü; eyer-dışı yokuş yarış talebini taklit eder.',
    },
    structure: { en: '6x10s all-out standing on rolling false-flat or low-resistance trainer. 90s easy spin between.', tr: '6x10s ayakta sonuna kadar hafif yokuş veya düşük dirençli antrenörde. Aralarda 90s kolay.' },
    phases: ['Build', 'Peak'],
    frequencyPerWeek: 1,
    citation: 'Rønnestad 2017',
  },
  {
    key: 'bike-drill-cornering',
    name: { en: 'Cornering practice', tr: 'Viraj pratiği' },
    purpose: {
      en: 'Builds confidence in race-relevant cornering line and braking points.',
      tr: 'Yarışla ilgili viraj çizgisi ve fren noktalarında özgüven geliştirir.',
    },
    structure: { en: 'On a quiet 4-corner loop: 5 laps focusing on outside-inside-outside line. Practice braking before turn-in.', tr: 'Sessiz 4-virajlı bir parkurda: 5 tur dış-iç-dış çizgisine odaklan. Viraj girişinden önce fren pratiği.' },
    phases: ['Peak'],
    frequencyPerWeek: 1,
    citation: 'USA Cycling skills curriculum',
  },
]

const SWIM_DRILLS = [
  {
    key: 'swim-drill-catch-up',
    name: { en: 'Catch-up drill 4x100m', tr: 'Yakalama drili 4x100m' },
    purpose: {
      en: 'Slows stroke rate to feel each phase: catch, pull, recovery. Improves stroke length.',
      tr: 'Vuruş hızını yavaşlatır, her aşamayı hissetmek için: yakalama, çekiş, toparlanma. Vuruş uzunluğunu iyileştirir.',
    },
    structure: { en: '4x100m freestyle: lead arm waits at full extension until trailing arm catches up. 20s rest between.', tr: '4x100m serbest: önder kol tam uzanmada bekler, takip eden kol yakalayana kadar. Aralarda 20s.' },
    phases: ['Base'],
    frequencyPerWeek: 2,
    citation: 'Maglischo 2003',
  },
  {
    key: 'swim-drill-fingertip-drag',
    name: { en: 'Fingertip drag 4x50m', tr: 'Parmak ucu sürükleme 4x50m' },
    purpose: {
      en: 'Promotes high elbow recovery and proximal-to-distal arm sequencing.',
      tr: 'Yüksek dirsek toparlanmasını ve yakından-uzağa kol sıralamasını destekler.',
    },
    structure: { en: '4x50m with fingertips skimming water surface during recovery. Slow, deliberate.', tr: '4x50m parmak uçları toparlanma sırasında suyun yüzeyinden sıyırarak. Yavaş, kasıtlı.' },
    phases: ['Base', 'Build'],
    frequencyPerWeek: 2,
    citation: 'Maglischo 2003',
  },
  {
    key: 'swim-drill-side-kick',
    name: { en: 'Side kick 4x50m', tr: 'Yan tekme 4x50m' },
    purpose: {
      en: 'Trains body rotation and core engagement; develops streamlined alignment.',
      tr: 'Vücut rotasyonunu ve kor angajmanını antrene eder; akıcı hizalama geliştirir.',
    },
    structure: { en: '4x50m on side, lower arm extended, breathing every 10 kicks. Switch sides each 50.', tr: '4x50m yanda, alt kol uzanmış, her 10 tekmede nefes. Her 50\'de tarafları değiştir.' },
    phases: ['Base'],
    frequencyPerWeek: 1,
    citation: 'Maglischo 2003; Counsilman 1968',
  },
  {
    key: 'swim-drill-stroke-count',
    name: { en: 'Stroke count 4x100m', tr: 'Vuruş sayma 4x100m' },
    purpose: {
      en: 'Targets distance-per-stroke; competitive swimmers aim 14-18 strokes per 25m.',
      tr: 'Vuruş başına mesafeyi hedefler; rekabetçi yüzücüler 25m\'de 14-18 vuruş hedefler.',
    },
    structure: { en: '4x100m at moderate pace, count strokes per 25m. Goal: hold same count across all 4 reps.', tr: '4x100m orta tempoda, 25m\'deki vuruşları say. Hedef: 4 tekrar boyunca aynı sayıyı koru.' },
    phases: ['Build', 'Peak'],
    frequencyPerWeek: 1,
    citation: 'Maglischo 2003',
  },
  {
    key: 'swim-drill-sculling',
    name: { en: 'Sculling drill 4x50m', tr: 'Kürek-eli drili 4x50m' },
    purpose: {
      en: 'Refines feel for water; teaches active pulling surface.',
      tr: 'Su hissini rafine eder; aktif çekiş yüzeyini öğretir.',
    },
    structure: { en: '4x50m flutter kick + small sculling movements with hands (no full pull). Focus on water pressure on palms.', tr: '4x50m fır tekmesi + ellerle küçük kürek hareketleri (tam çekiş yok). Avuçlardaki su basıncına odaklan.' },
    phases: ['Base'],
    frequencyPerWeek: 1,
    citation: 'Counsilman 1968; Maglischo 2003',
  },
]

const ROWING_DRILLS = [
  {
    key: 'row-drill-pause',
    name: { en: 'Pause drill at catch', tr: 'Yakalama duraksaması' },
    purpose: {
      en: 'Builds catch-position muscle memory; eliminates rushing the slide.',
      tr: 'Yakalama pozisyonu kas hafızası kurar; kızağa acele etmeyi önler.',
    },
    structure: { en: '4x500m at UT2: pause 1s at catch position before each drive. Forces clean, controlled stroke.', tr: '4x500m UT2\'de: her itimden önce yakalama pozisyonunda 1s duraksa. Temiz, kontrollü vuruş.' },
    phases: ['Base', 'Build'],
    frequencyPerWeek: 2,
    citation: 'Nolte 2005; British Rowing Technique',
  },
  {
    key: 'row-drill-square-blade',
    name: { en: 'Square-blade rowing 4x250m', tr: 'Kare-bıçak küreği 4x250m' },
    purpose: {
      en: 'Sharpens catch entry and finish extraction; reveals slop in blade work.',
      tr: 'Yakalama girişini ve bitiş çıkarmasını keskinleştirir; bıçak işindeki gevşekliği gösterir.',
    },
    structure: { en: '4x250m at UT2: row with blades square (no feathering). 30s rest between.', tr: '4x250m UT2\'de: bıçaklar kare (tüyleme yok) küreği. Aralarda 30s.' },
    phases: ['Base'],
    frequencyPerWeek: 1,
    citation: 'Nolte 2005',
  },
  {
    key: 'row-drill-stroke-rate-ladder',
    name: { en: 'Stroke-rate ladder', tr: 'Vuruş-hızı merdiveni' },
    purpose: {
      en: 'Trains the rate range needed for race: open at 36 spm, settle to 32, push final at 38+.',
      tr: 'Yarış için gereken vuruş aralığını antrene eder: 36 spm\'de aç, 32\'ye yerleş, son 38+ ile it.',
    },
    structure: { en: '5x2 min ladder: 18 spm → 22 → 26 → 30 → 34 spm at AT split. 90s easy at 18 spm between.', tr: '5x2 dk merdiven: 18 → 22 → 26 → 30 → 34 spm AT splitte. Aralarda 90s 18 spm kolay.' },
    phases: ['Build', 'Peak'],
    frequencyPerWeek: 1,
    citation: 'Paul 1969; British Rowing rate-strategy curriculum',
  },
  {
    key: 'row-drill-power-ten',
    name: { en: 'Power-10 micro-drill', tr: 'Güç-10 mikro-drili' },
    purpose: {
      en: 'Rehearses race-tactic of accelerating mid-piece. Critical for closing speed.',
      tr: 'Yarış-taktiği orta-parça hızlanmasını prova eder. Kapanış hızı için kritik.',
    },
    structure: { en: 'During UT2 row: every 4 minutes, do 10 power strokes at 2k pressure. Settle back.', tr: 'UT2 küreği sırasında: her 4 dk, 2k basıncında 10 güç vuruşu. Geri yerleş.' },
    phases: ['Build', 'Peak'],
    frequencyPerWeek: 1,
    citation: 'British Rowing race tactics',
  },
]

// Triathlon merges run + bike + swim drills + a tri-specific brick drill.
const TRI_DRILLS_EXTRA = [
  {
    key: 'tri-drill-brick-transition',
    name: { en: 'Bike-to-run transition (T2)', tr: 'Bisiklet-koşu geçişi (T2)' },
    purpose: {
      en: 'Race-specific: trains heavy-leg run-off-bike adaptation. The first 800m off the bike feels alien without practice.',
      tr: 'Yarış-spesifik: ağır-bacak bisiklet-sonrası koşu adaptasyonunu antrene eder. Pratik yapmadan ilk 800m yabancı hisseder.',
    },
    structure: { en: 'Easy 30 min bike → 5 min easy run @ goal MP, focus quick cadence (180+ spm) the first km.', tr: 'Kolay 30 dk bisiklet → 5 dk kolay koşu hedef MP\'de, ilk km hızlı kadansa odak (180+ spm).' },
    phases: ['Build', 'Peak'],
    frequencyPerWeek: 2,
    citation: 'ITU coaching framework; Olbrecht 2000',
  },
  {
    key: 'tri-drill-swim-to-bike',
    name: { en: 'Swim-to-bike (T1) rehearsal', tr: 'Yüzme-bisiklet (T1) provası' },
    purpose: {
      en: 'Practice the dizzy-walk after open-water swim, equipment shuffle, and getting on the bike.',
      tr: 'Açık-su yüzmesinden sonra başı dönmüş yürüyüşü, ekipman değişimini ve bisiklete binmeyi prova et.',
    },
    structure: { en: '500m swim → run to bike → mount and ride 5 min. Practice helmet/shoes routine. Goal: T1 under 2 min.', tr: '500m yüzme → bisiklete koş → bin ve 5 dk sür. Kask/ayakkabı rutini prova. Hedef: T1 2 dk altında.' },
    phases: ['Peak'],
    frequencyPerWeek: 1,
    citation: 'ITU coaching framework',
  },
]

const LIBRARY = {
  run:    RUN_DRILLS,
  bike:   BIKE_DRILLS,
  swim:   SWIM_DRILLS,
  rowing: ROWING_DRILLS,
}

/**
 * @public
 * @param {{ sport: 'run'|'bike'|'swim'|'triathlon'|'rowing', phases: Array<{phase:string}> }} input
 * @returns {Record<'Base'|'Build'|'Peak'|'Taper', Drill[]>}
 */
export function buildDrillsLibrary(input) {
  const { sport, phases } = input || {}
  const present = new Set((phases || []).map(p => p.phase))

  // Triathlon merges run + bike + swim + tri-specific extras (with discipline tags).
  if (sport === 'triathlon') {
    const tagged = [
      ...RUN_DRILLS.map(d => ({ ...d, discipline: 'run'  })),
      ...BIKE_DRILLS.map(d => ({ ...d, discipline: 'bike' })),
      ...SWIM_DRILLS.map(d => ({ ...d, discipline: 'swim' })),
      ...TRI_DRILLS_EXTRA.map(d => ({ ...d, discipline: 'tri' })),
    ]
    const out = { Base: [], Build: [], Peak: [], Taper: [] }
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      if (!present.has(phase)) continue
      out[phase] = tagged.filter(d => d.phases.includes(phase))
    }
    return out
  }

  const drills = LIBRARY[sport] || LIBRARY.run
  const out = { Base: [], Build: [], Peak: [], Taper: [] }
  for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
    if (!present.has(phase)) continue
    out[phase] = drills.filter(d => d.phases.includes(phase))
  }
  return out
}

export const DRILLS_CITATION = 'Daniels 2014; Pfitzinger 2014; Maglischo 2003; Counsilman 1968; Coggan & Allen 2010; Rønnestad 2017; Nolte 2005; Beattie 2014; Saunders 2006; ITU coaching framework'
