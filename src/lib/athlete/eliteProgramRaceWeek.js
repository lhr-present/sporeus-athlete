// ─── eliteProgramRaceWeek.js — T-7 to T-0 race-week protocol ────────────────
//
// Day-by-day race-week schedule with sport-specific tune-ups, fueling cues,
// and race-day pacing strategy. Per Mujika 2003, Bosquet et al. 2007 (taper
// meta-analysis), and Stellingwerf 2018 (race-week fueling).
//
// All bilingual EN+TR. Pure data — no React.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   tMinus: number,
 *   day: string,
 *   session: Bilingual,
 *   fueling: Bilingual,
 *   notes: Bilingual
 * }} RaceWeekDay
 * @typedef {{
 *   schedule: RaceWeekDay[],
 *   raceDay: {
 *     wakeUp: Bilingual,
 *     breakfast: Bilingual,
 *     warmup: Bilingual,
 *     pacing: Bilingual,
 *     fueling: Bilingual,
 *     mental: Bilingual,
 *   },
 *   citation: string
 * }} RaceWeekProtocol
 */

const RUN_SCHEDULE = [
  { tMinus: 7, day: 'T-7',
    session: { en: 'Last full quality session: 4-5x1km @T-pace, then easy.', tr: 'Son tam kaliteli seans: 4-5x1km @T-tempo, sonrası kolay.' },
    fueling: { en: 'Normal Build-phase fueling.', tr: 'Normal Build-fazı beslenmesi.' },
    notes: { en: 'No new shoes after this point.', tr: 'Bu noktadan sonra yeni ayakkabı yok.' },
  },
  { tMinus: 6, day: 'T-6',
    session: { en: '40-50 min easy + 4x100m strides.', tr: '40-50 dk kolay + 4x100m adım.' },
    fueling: { en: 'Maintain CHO ~7 g/kg.', tr: 'CHO ~7 g/kg sürdür.' },
    notes: { en: 'Last regular workout day.', tr: 'Son normal antrenman günü.' },
  },
  { tMinus: 5, day: 'T-5',
    session: { en: 'Rest or 25 min easy walk.', tr: 'Dinlenme veya 25 dk kolay yürüyüş.' },
    fueling: { en: 'CHO ~7 g/kg, normal hydration.', tr: 'CHO ~7 g/kg, normal hidrasyon.' },
    notes: { en: 'Begin sleep priority.', tr: 'Uyku önceliğine başla.' },
  },
  { tMinus: 4, day: 'T-4',
    session: { en: '30 min easy + 4x60s @goal race pace with full recovery.', tr: '30 dk kolay + 4x60s hedef yarış temposunda, tam dinlenme.' },
    fueling: { en: 'CHO ~8 g/kg.', tr: 'CHO ~8 g/kg.' },
    notes: { en: 'Race-pace primer.', tr: 'Yarış-tempo açılışı.' },
  },
  { tMinus: 3, day: 'T-3',
    session: { en: 'Rest or 20 min very easy walk.', tr: 'Dinlenme veya 20 dk çok kolay yürüyüş.' },
    fueling: { en: 'Begin carb load: CHO 10 g/kg.', tr: 'Karbonhidrat yüklemeye başla: CHO 10 g/kg.' },
    notes: { en: 'Cut high-fiber and high-fat foods.', tr: 'Yüksek lifli ve yağlı yiyecekleri kes.' },
  },
  { tMinus: 2, day: 'T-2',
    session: { en: '20-25 min easy + 3x20s strides at race pace.', tr: '20-25 dk kolay + 3x20s yarış temposunda adım.' },
    fueling: { en: 'CHO 10-12 g/kg, hydration with electrolytes.', tr: 'CHO 10-12 g/kg, elektrolitli hidrasyon.' },
    notes: { en: 'Light dinner; no novel foods from here.', tr: 'Hafif akşam yemeği; bundan sonra yeni yiyecek yok.' },
  },
  { tMinus: 1, day: 'T-1',
    session: { en: '15-20 min very easy + 2x20s race-pace touches OR full rest.', tr: '15-20 dk çok kolay + 2x20s yarış-tempo dokunuşu YA DA tam dinlenme.' },
    fueling: { en: 'CHO 10-12 g/kg; pre-race dinner before 19:00.', tr: 'CHO 10-12 g/kg; yarış öncesi akşam yemeği 19:00 öncesi.' },
    notes: { en: 'Lay out kit. Set alarm. Sleep early.', tr: 'Ekipmanı hazırla. Alarmı kur. Erken uyu.' },
  },
  { tMinus: 0, day: 'T-0 (Race day)',
    session: { en: 'Race.', tr: 'Yarış.' },
    fueling: { en: 'See race-day fueling block.', tr: 'Yarış günü beslenme bloğunu gör.' },
    notes: { en: 'Trust the work.', tr: 'Çalışmaya güven.' },
  },
]

const BIKE_SCHEDULE = [
  { tMinus: 7, day: 'T-7',
    session: { en: 'Last full quality: 2x20 min @95-100% FTP.', tr: 'Son tam kalite: 2x20 dk @FTP %95-100.' },
    fueling: { en: 'Normal Build-phase fueling.', tr: 'Normal Build-fazı beslenmesi.' },
    notes: { en: 'No equipment changes from now.', tr: 'Bundan sonra ekipman değişikliği yok.' },
  },
  { tMinus: 6, day: 'T-6',
    session: { en: '60-90 min Z2 with 4x1 min Z3 surges.', tr: '60-90 dk Z2 + 4x1 dk Z3 atak.' },
    fueling: { en: 'CHO ~7 g/kg.', tr: 'CHO ~7 g/kg.' },
    notes: { en: 'Practice race nutrition.', tr: 'Yarış beslenmesi prova.' },
  },
  { tMinus: 5, day: 'T-5',
    session: { en: 'Rest or 30 min Z1 spin.', tr: 'Dinlenme veya 30 dk Z1 dönüş.' },
    fueling: { en: 'CHO ~7 g/kg.', tr: 'CHO ~7 g/kg.' },
    notes: { en: 'Bike check: tire pressure, drivetrain, brakes.', tr: 'Bisiklet kontrolü: lastik basıncı, aktarma, fren.' },
  },
  { tMinus: 4, day: 'T-4',
    session: { en: '45-60 min Z2 + 5x1 min @ goal race power.', tr: '45-60 dk Z2 + 5x1 dk hedef yarış gücünde.' },
    fueling: { en: 'CHO ~8 g/kg.', tr: 'CHO ~8 g/kg.' },
    notes: { en: 'Race-power primer.', tr: 'Yarış-gücü açılışı.' },
  },
  { tMinus: 3, day: 'T-3',
    session: { en: 'Rest or 30 min Z1.', tr: 'Dinlenme veya 30 dk Z1.' },
    fueling: { en: 'Begin carb load: CHO 10 g/kg.', tr: 'Karbonhidrat yüklemeye başla: CHO 10 g/kg.' },
    notes: { en: 'Cut fiber.', tr: 'Lifi kes.' },
  },
  { tMinus: 2, day: 'T-2',
    session: { en: 'Openers: 30 min Z1 + 5x1 min race power.', tr: 'Açılışlar: 30 dk Z1 + 5x1 dk yarış gücü.' },
    fueling: { en: 'CHO 10-12 g/kg.', tr: 'CHO 10-12 g/kg.' },
    notes: { en: 'Race-bike final check.', tr: 'Yarış bisikleti son kontrol.' },
  },
  { tMinus: 1, day: 'T-1',
    session: { en: '20 min very easy spin OR full rest.', tr: '20 dk çok kolay dönüş YA DA tam dinlenme.' },
    fueling: { en: 'CHO 10-12 g/kg; pre-race dinner before 19:00.', tr: 'CHO 10-12 g/kg; yarış öncesi akşam yemeği 19:00 öncesi.' },
    notes: { en: 'Pack kit, bottles, nutrition.', tr: 'Kıyafet, bidon, beslenme paketi hazırla.' },
  },
  { tMinus: 0, day: 'T-0 (Race day)',
    session: { en: 'Race.', tr: 'Yarış.' },
    fueling: { en: 'See race-day fueling block.', tr: 'Yarış günü beslenme bloğunu gör.' },
    notes: { en: 'Trust the work.', tr: 'Çalışmaya güven.' },
  },
]

const SWIM_SCHEDULE = [
  { tMinus: 7, day: 'T-7',
    session: { en: 'Last full quality: 8x100m @CSS, then easy.', tr: 'Son tam kalite: 8x100m @CSS, sonrası kolay.' },
    fueling: { en: 'Normal Build-phase fueling.', tr: 'Normal Build-fazı beslenmesi.' },
    notes: { en: 'No new equipment from here.', tr: 'Bundan sonra yeni ekipman yok.' },
  },
  { tMinus: 6, day: 'T-6',
    session: { en: '1500-2000m technique + 6x50m race pace.', tr: '1500-2000m teknik + 6x50m yarış temposu.' },
    fueling: { en: 'Maintain CHO ~7 g/kg.', tr: 'CHO ~7 g/kg sürdür.' },
    notes: { en: 'Suit fit check.', tr: 'Mayo uyum kontrolü.' },
  },
  { tMinus: 5, day: 'T-5',
    session: { en: 'Rest or 1000m easy with drills.', tr: 'Dinlenme veya 1000m kolay drill.' },
    fueling: { en: 'CHO ~7 g/kg.', tr: 'CHO ~7 g/kg.' },
    notes: { en: 'Sleep priority begins.', tr: 'Uyku önceliği başlar.' },
  },
  { tMinus: 4, day: 'T-4',
    session: { en: '1500m: 500m WU + 6x50m race pace + 200m CD.', tr: '1500m: 500m ısınma + 6x50m yarış temposu + 200m soğuma.' },
    fueling: { en: 'CHO ~8 g/kg.', tr: 'CHO ~8 g/kg.' },
    notes: { en: 'Last race-pace touch.', tr: 'Son yarış-tempo dokunuşu.' },
  },
  { tMinus: 3, day: 'T-3',
    session: { en: 'Rest or 800m very easy.', tr: 'Dinlenme veya 800m çok kolay.' },
    fueling: { en: 'Begin carb load: CHO 10 g/kg.', tr: 'Karbonhidrat yüklemeye başla: CHO 10 g/kg.' },
    notes: { en: 'Reduce fiber, fat.', tr: 'Lif ve yağ azalt.' },
  },
  { tMinus: 2, day: 'T-2',
    session: { en: '1000m: 400m WU + 4x50m race pace + 200m CD.', tr: '1000m: 400m ısınma + 4x50m yarış temposu + 200m soğuma.' },
    fueling: { en: 'CHO 10-12 g/kg.', tr: 'CHO 10-12 g/kg.' },
    notes: { en: 'Light dinner; no novel foods.', tr: 'Hafif akşam yemeği; yeni yiyecek yok.' },
  },
  { tMinus: 1, day: 'T-1',
    session: { en: '600m very easy with 4x25m race-pace touches.', tr: '600m çok kolay + 4x25m yarış-tempo dokunuş.' },
    fueling: { en: 'CHO 10-12 g/kg.', tr: 'CHO 10-12 g/kg.' },
    notes: { en: 'Pack goggles + spare goggles + cap + nutrition.', tr: 'Gözlük + yedek gözlük + bone + beslenme paketle.' },
  },
  { tMinus: 0, day: 'T-0 (Race day)',
    session: { en: 'Race.', tr: 'Yarış.' },
    fueling: { en: 'See race-day fueling block.', tr: 'Yarış günü beslenme bloğunu gör.' },
    notes: { en: 'Trust the work.', tr: 'Çalışmaya güven.' },
  },
]

const RACE_DAY_RUN = {
  wakeUp: { en: '3-4 h before race start. Hydrate immediately (300-500 ml water + electrolytes).', tr: 'Yarış başlangıcından 3-4 saat önce. Hemen hidrate ol (300-500 ml su + elektrolit).' },
  breakfast: { en: 'CHO 1.5-2 g/kg, low-fiber, low-fat. Familiar foods only. 3 h pre-race.', tr: 'CHO 1.5-2 g/kg, düşük lif, düşük yağ. Sadece bilinen yiyecekler. Yarıştan 3 sa önce.' },
  warmup: { en: '15-20 min: 10 min easy + drills + 4x20s strides ending 10 min before race.', tr: '15-20 dk: 10 dk kolay + drill + 4x20s adım, yarıştan 10 dk önce bitir.' },
  pacing: {
    en: 'First 5k: 5-10s/km slower than goal. Middle: lock goal pace. Last 25%: free if able.',
    tr: 'İlk 5km: hedeften 5-10s/km yavaş. Orta: hedef tempoyu sabitle. Son %25: gücün varsa serbest.',
  },
  fueling: { en: 'Mid-race: 60-90 g CHO/h with 200-400 ml water/h. Practiced gel/sports drink only.', tr: 'Yarış ortası: 60-90 g CHO/sa, 200-400 ml su/sa. Sadece denenmiş jel/spor içeceği.' },
  mental: { en: 'Stay present. Compete only against the next km, not the finish.', tr: 'Anda kal. Bitiş ile değil, sadece bir sonraki km ile yarış.' },
}

const RACE_DAY_BIKE = {
  wakeUp: { en: '3-4 h before race start. 500 ml water + electrolytes.', tr: 'Yarış başlangıcından 3-4 saat önce. 500 ml su + elektrolit.' },
  breakfast: { en: 'CHO 1.5-2 g/kg, low-fiber. 3 h pre-race.', tr: 'CHO 1.5-2 g/kg, düşük lif. Yarıştan 3 sa önce.' },
  warmup: { en: '20-30 min: 15 min Z1-Z2 + 3x1 min @ race power + 5 min easy.', tr: '20-30 dk: 15 dk Z1-Z2 + 3x1 dk yarış gücünde + 5 dk kolay.' },
  pacing: {
    en: 'Conservative first 20%. Stay at goal power; do not chase. Last 10% free if reserves.',
    tr: 'İlk %20 muhafazakar. Hedef güçte kal; takip etme. Son %10 yedek varsa serbest.',
  },
  fueling: { en: 'Aim 80-100 g CHO/h with 500-750 ml fluid/h. Practiced products only.', tr: '80-100 g CHO/sa, 500-750 ml sıvı/sa hedefle. Sadece denenmiş ürünler.' },
  mental: { en: 'Numbers, not feelings, in the first hour.', tr: 'İlk saatte hisler değil, rakamlar.' },
}

const RACE_DAY_SWIM = {
  wakeUp: { en: '3 h before race start. Hydrate (300 ml).', tr: 'Yarış başlangıcından 3 saat önce. Hidrate ol (300 ml).' },
  breakfast: { en: 'CHO 1-1.5 g/kg, low-fiber. 2-3 h pre-race.', tr: 'CHO 1-1.5 g/kg, düşük lif. Yarıştan 2-3 sa önce.' },
  warmup: { en: '600-1000m in pool: 400m mixed + 4x50m race pace + 200m easy. Ends 15-20 min before start.', tr: 'Havuzda 600-1000m: 400m karışık + 4x50m yarış temposu + 200m kolay. Başlangıçtan 15-20 dk önce bitir.' },
  pacing: {
    en: 'First 100m controlled. Middle stable. Last 100m all-out.',
    tr: 'İlk 100m kontrollü. Orta sabit. Son 100m sonuna kadar.',
  },
  fueling: { en: 'For races >30 min: 30 g CHO 30 min pre-race.', tr: '30 dk üstü yarışlar için: yarıştan 30 dk önce 30 g CHO.' },
  mental: { en: 'Smooth stroke first. Speed comes from rhythm.', tr: 'Önce akıcı stroke. Hız ritimden gelir.' },
}

/**
 * @public
 * @param {{ sport?: string, raceDate?: string }} input
 * @returns {RaceWeekProtocol}
 */
export function buildRaceWeekProtocol(input) {
  const sport = input?.sport
  const schedule =
    sport === 'bike' ? BIKE_SCHEDULE :
    sport === 'swim' ? SWIM_SCHEDULE :
    RUN_SCHEDULE
  const raceDay =
    sport === 'bike' ? RACE_DAY_BIKE :
    sport === 'swim' ? RACE_DAY_SWIM :
    RACE_DAY_RUN
  return {
    schedule,
    raceDay,
    citation: 'Mujika 2003; Bosquet et al. 2007; Stellingwerf 2018; Burke 2017',
  }
}

export const RACE_WEEK_CITATION = 'Mujika 2003; Bosquet et al. 2007; Stellingwerf 2018; Burke 2017'
