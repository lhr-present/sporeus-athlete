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
  // v9.8.0 — concrete meal examples by athlete weight and time-to-race
  preRaceMeals: {
    en: [
      '3h pre-race (70 kg athlete, ~140g CHO): white-rice bowl (1.5 cup cooked = 70g CHO) + 1 banana (27g) + 2 slices toast with honey (40g). No dairy, no high-fiber.',
      '2h pre-race: 1 bagel + 2 tbsp honey (60g CHO) + small black coffee. Test in training.',
      '1h pre-race top-up: 1 sports gel (25g CHO) + 200ml water. Skip if GI-sensitive.',
      '30 min pre-race: small sip 200ml water + 1 dose caffeine (3-6 mg/kg if tolerated, evidence-based).',
      'AVOID: dairy (lactose risk), high-fat (delayed gastric emptying), high-fiber (urgency), novel foods (untested GI).',
    ],
    tr: [
      'Yarıştan 3 sa önce (70 kg sporcu, ~140g CHO): beyaz pilav (1.5 fincan pişmiş = 70g CHO) + 1 muz (27g) + 2 dilim ekmek + bal (40g). Süt ürünü yok, yüksek lif yok.',
      'Yarıştan 2 sa önce: 1 simit + 2 yk bal (60g CHO) + küçük sade kahve. Antrenmanda test et.',
      'Yarıştan 1 sa önce ek: 1 spor jeli (25g CHO) + 200ml su. GI hassasiyetin varsa atla.',
      'Yarıştan 30 dk önce: 200ml su yudumu + 1 doz kafein (3-6 mg/kg toleranslıysa, kanıt-tabanlı).',
      'KAÇIN: süt ürünleri (laktoz), yüksek yağ (geç sindirim), yüksek lif (acil tuvalet), yeni yiyecekler (test edilmemiş GI).',
    ],
  },
  warmup: { en: '15-20 min: 10 min easy + drills + 4x20s strides ending 10 min before race.', tr: '15-20 dk: 10 dk kolay + drill + 4x20s adım, yarıştan 10 dk önce bitir.' },
  pacing: {
    en: 'First 5k: 5-10s/km slower than goal. Middle: lock goal pace. Last 25%: free if able.',
    tr: 'İlk 5km: hedeften 5-10s/km yavaş. Orta: hedef tempoyu sabitle. Son %25: gücün varsa serbest.',
  },
  fueling: { en: 'Mid-race: 60-90 g CHO/h with 200-400 ml water/h. Practiced gel/sports drink only.', tr: 'Yarış ortası: 60-90 g CHO/sa, 200-400 ml su/sa. Sadece denenmiş jel/spor içeceği.' },
  mental: { en: 'Stay present. Compete only against the next km, not the finish.', tr: 'Anda kal. Bitiş ile değil, sadece bir sonraki km ile yarış.' },
  // v9.9.0 — race-plan rehearsal scripts (Vealey 2007; Bull 1996)
  mentalRehearsal: {
    en: [
      'Visualize the start: relaxed shoulders, controlled first 1 km at 5-10 sec/km slower than goal. Avoid surge with the pack.',
      'Mid-race script (5k-10k mark): "I trained for this pace. My breathing is rhythmic. Each km gets me one closer."',
      'When pain arrives (typically km 7-8 of half, 32 of full): "This is the workout I rehearsed. The pain peaks then plateaus."',
      'Last 25%: "Now I race. Pick someone, reel them in. Smooth, strong, fast."',
      'Contingency — fall behind goal: switch to "best possible from here" mindset, not "save the goal."',
      'Contingency — feel great too early: hold goal pace anyway. Negative split is the only safe over-performance.',
    ],
    tr: [
      'Başlangıcı görselleştir: omuzlar gevşek, ilk 1 km hedef tempodan 5-10 sn/km yavaş kontrollü. Grup ile sürüklenme.',
      'Yarış ortası senaryosu (5k-10k noktası): "Bu tempoya antrene ettim. Nefesim ritmik. Her km beni bir adım yaklaştırıyor."',
      'Acı geldiğinde (genelde yarı maraton km 7-8, maraton km 32): "Bu provasını yaptığım antrenman. Acı zirve yapıp plato yapar."',
      'Son %25: "Şimdi yarışıyorum. Birini seç, çek. Pürüzsüz, güçlü, hızlı."',
      'Acil durum — hedeften geri kal: "buradan mümkün olanı yap" zihniyetine geç, "hedefi koru"\'ya değil.',
      'Acil durum — çok iyi hisset: yine de hedef tempoda kal. Negatif bölme tek güvenli aşırı-performans.',
    ],
  },
  // v9.9.0 — caffeine protocol (Burke 2008; Spriet 2014)
  caffeine: {
    en: 'Evidence-based: 3-6 mg/kg, 60 min pre-race. Athletes 70 kg → 210-420 mg. Only if tolerated in training. Skip if anxiety-prone or sleep-poor week. Avoid >6 mg/kg (no further benefit, GI/jitter risk).',
    tr: 'Kanıt-tabanlı: 3-6 mg/kg, yarıştan 60 dk önce. 70 kg sporcu → 210-420 mg. Sadece antrenmanda tolere edildiyse. Anksiyete eğilimi veya zayıf uyku haftasıysa atla. >6 mg/kg sakın (ek fayda yok, GI/titrek riski).',
  },
}

const RACE_DAY_BIKE = {
  wakeUp: { en: '3-4 h before race start. 500 ml water + electrolytes.', tr: 'Yarış başlangıcından 3-4 saat önce. 500 ml su + elektrolit.' },
  breakfast: { en: 'CHO 1.5-2 g/kg, low-fiber. 3 h pre-race.', tr: 'CHO 1.5-2 g/kg, düşük lif. Yarıştan 3 sa önce.' },
  preRaceMeals: {
    en: [
      '3h pre-race (75 kg, ~150g CHO): oatmeal (60g dry oats = 36g CHO) + 1 banana (27g) + 2 tbsp honey (35g) + 2 slices toast (50g). Black coffee.',
      '2h pre-race: 1 bagel + jam (60g CHO) + 250 ml sports drink (15g).',
      '1h pre-race: 1 gel (25g CHO) + 250ml water. Top-up only if comfortable.',
      'On bike (15 min in): start fueling early. Aim 80-100 g CHO/h via mix of solids (bars), gels, and drink mix.',
      'AVOID: high-fat foods (slow gastric emptying), >40g fiber day-before, untrained caffeine doses.',
    ],
    tr: [
      'Yarıştan 3 sa önce (75 kg, ~150g CHO): yulaf ezmesi (60g kuru = 36g CHO) + 1 muz (27g) + 2 yk bal (35g) + 2 dilim ekmek (50g). Sade kahve.',
      'Yarıştan 2 sa önce: 1 simit + reçel (60g CHO) + 250 ml spor içeceği (15g).',
      'Yarıştan 1 sa önce: 1 jel (25g CHO) + 250ml su. Sadece rahat hissediyorsan ek.',
      'Bisiklette (15. dk): erken yakıtlanmaya başla. Katı (bar), jel ve içecek karışımıyla 80-100 g CHO/sa.',
      'KAÇIN: yüksek yağ (yavaş sindirim), yarış-öncesi gün >40g lif, antrene edilmemiş kafein dozları.',
    ],
  },
  warmup: { en: '20-30 min: 15 min Z1-Z2 + 3x1 min @ race power + 5 min easy.', tr: '20-30 dk: 15 dk Z1-Z2 + 3x1 dk yarış gücünde + 5 dk kolay.' },
  pacing: {
    en: 'Conservative first 20%. Stay at goal power; do not chase. Last 10% free if reserves.',
    tr: 'İlk %20 muhafazakar. Hedef güçte kal; takip etme. Son %10 yedek varsa serbest.',
  },
  fueling: { en: 'Aim 80-100 g CHO/h with 500-750 ml fluid/h. Practiced products only.', tr: '80-100 g CHO/sa, 500-750 ml sıvı/sa hedefle. Sadece denenmiş ürünler.' },
  mental: { en: 'Numbers, not feelings, in the first hour.', tr: 'İlk saatte hisler değil, rakamlar.' },
  mentalRehearsal: {
    en: [
      'Pre-start: focus on power numbers, not feelings. First 10 km is data, not racing.',
      'When the group surges: do NOT chase. Watts cap is your race; their pace is theirs.',
      'Climbs: stay seated, find rhythm, hold target NP. Standing only on the steepest 10% sections.',
      'Hour 2: aerodynamic position is non-negotiable. Tuck even when comfortable to spread out.',
      'Last 20%: now feelings can override numbers. If reserves remain, attack the gradient or sprint.',
      'Contingency — mechanical: slow before stop, signal, calm tools work. 2 min mechanical < 10 min crash.',
    ],
    tr: [
      'Başlangıç öncesi: hisler değil, güç rakamlarına odaklan. İlk 10 km veri, yarış değil.',
      'Grup ataklandığında: takip ETME. Watt limiti senin yarışın; onların temposu onların.',
      'Yokuşlar: oturarak kal, ritim bul, hedef NP tut. Sadece en dik %10 kesimde ayağa kalk.',
      '2. saat: aerodinamik pozisyon tartışılmaz. Rahat olduğunda bile yayılmamak için sıkış.',
      'Son %20: artık hisler rakamları ezebilir. Yedek varsa, eğime atak yap veya sprint.',
      'Acil durum — mekanik: durmadan önce yavaşla, sinyal ver, sakin araç kullanımı. 2 dk mekanik < 10 dk kaza.',
    ],
  },
  caffeine: {
    en: 'Evidence-based: 3-6 mg/kg, 60 min pre-race. For long bikes (>3h), split: 200 mg pre + 100 mg at hour 2. Avoid first cycling race with caffeine — test in training.',
    tr: 'Kanıt-tabanlı: 3-6 mg/kg, yarıştan 60 dk önce. Uzun bisiklette (>3sa), böl: ön 200 mg + 2. saatte 100 mg. İlk bisiklet yarışında kafein deneme — antrenmanda test et.',
  },
}

// v9.7.0 — Rowing race-week schedule (Mujika 2003 taper + British Rowing protocol).
const ROWING_SCHEDULE = [
  { tMinus: 7, day: 'T-7',
    session: { en: 'Last full quality: 5x1500m @ AT split.', tr: 'Son tam kalite: 5x1500m AT splitte.' },
    fueling: { en: 'Normal Build-phase fueling.', tr: 'Normal Build-fazı beslenmesi.' },
    notes: { en: 'Final equipment check (oars, footplate, slide).', tr: 'Son ekipman kontrolü (kürekler, ayak desteği, kızak).' },
  },
  { tMinus: 6, day: 'T-6',
    session: { en: 'UT2 60min + 4 power-10s mid-row.', tr: 'UT2 60dk + orta yerde 4 güç-10.' },
    fueling: { en: 'CHO ~7 g/kg.', tr: 'CHO ~7 g/kg.' },
    notes: { en: 'No new equipment from here.', tr: 'Bundan sonra yeni ekipman yok.' },
  },
  { tMinus: 5, day: 'T-5',
    session: { en: 'Rest or 30min UT2 very easy.', tr: 'Dinlenme veya 30dk UT2 çok kolay.' },
    fueling: { en: 'CHO ~7 g/kg.', tr: 'CHO ~7 g/kg.' },
    notes: { en: 'Sleep priority begins.', tr: 'Uyku önceliği başlar.' },
  },
  { tMinus: 4, day: 'T-4',
    session: { en: 'Race-pace primer: 4x500m @ 2k pace, 5min easy between.', tr: 'Yarış-tempo hazırlık: 4x500m 2k temposunda, aralarda 5dk kolay.' },
    fueling: { en: 'CHO ~8 g/kg.', tr: 'CHO ~8 g/kg.' },
    notes: { en: 'Last race-pace touch.', tr: 'Son yarış-tempo dokunuşu.' },
  },
  { tMinus: 3, day: 'T-3',
    session: { en: 'Rest or 25min UT2 very easy.', tr: 'Dinlenme veya 25dk UT2 çok kolay.' },
    fueling: { en: 'Begin carb load: CHO 10 g/kg.', tr: 'Karbonhidrat yüklemeye başla: CHO 10 g/kg.' },
    notes: { en: 'Reduce fiber, fat. Hydration focus.', tr: 'Lif ve yağ azalt. Hidrasyon odak.' },
  },
  { tMinus: 2, day: 'T-2',
    session: { en: 'Sharpener: 6x250m @ AN pace, full recovery.', tr: 'Keskinleştirme: 6x250m AN temposunda, tam toparlanma.' },
    fueling: { en: 'CHO 10-12 g/kg.', tr: 'CHO 10-12 g/kg.' },
    notes: { en: 'Light dinner; no novel foods.', tr: 'Hafif akşam yemeği; yeni yiyecek yok.' },
  },
  { tMinus: 1, day: 'T-1',
    session: { en: 'Pre-race shakeout: 20min total (12 UT2 + 4x100m race-pace + 4 UT2).', tr: 'Yarış öncesi açılış: 20dk toplam (12 UT2 + 4x100m yarış-tempo + 4 UT2).' },
    fueling: { en: 'CHO 10-12 g/kg.', tr: 'CHO 10-12 g/kg.' },
    notes: { en: 'Pack uniform, water bottles, race nutrition, pre-race fuel.', tr: 'Üniforma, su şişeleri, yarış beslenmesi, yarış-öncesi yakıt paketle.' },
  },
  { tMinus: 0, day: 'T-0 (Race day)',
    session: { en: 'Race.', tr: 'Yarış.' },
    fueling: { en: 'See race-day fueling block.', tr: 'Yarış günü beslenme bloğunu gör.' },
    notes: { en: 'Trust the work. First 500m controlled, then build.', tr: 'Çalışmaya güven. İlk 500m kontrollü, sonra kademe.' },
  },
]

const RACE_DAY_SWIM = {
  wakeUp: { en: '3 h before race start. Hydrate (300 ml).', tr: 'Yarış başlangıcından 3 saat önce. Hidrate ol (300 ml).' },
  breakfast: { en: 'CHO 1-1.5 g/kg, low-fiber. 2-3 h pre-race.', tr: 'CHO 1-1.5 g/kg, düşük lif. Yarıştan 2-3 sa önce.' },
  preRaceMeals: {
    en: [
      '2.5h pre-race (65 kg, ~80g CHO): 1 cup white rice (45g CHO) + 1 banana (27g) + small honey drizzle (10g). Lighter than run/bike (no mid-race fueling for short races).',
      '1.5h pre-race: 1 plain bagel + 1 tbsp jam (50g CHO).',
      '30-45 min pre-race: 1 gel (25g CHO) only for races >30 min duration.',
      'AVOID: dairy (cramp risk), spicy food, excess water (open-water swim → urgency).',
    ],
    tr: [
      'Yarıştan 2.5 sa önce (65 kg, ~80g CHO): 1 fincan beyaz pilav (45g CHO) + 1 muz (27g) + biraz bal (10g). Koşu/bisiklete göre daha hafif (kısa yarışlarda yarış-içi beslenme yok).',
      'Yarıştan 1.5 sa önce: 1 sade simit + 1 yk reçel (50g CHO).',
      'Yarıştan 30-45 dk önce: Sadece 30+ dk yarışlar için 1 jel (25g CHO).',
      'KAÇIN: süt ürünleri (kramp riski), baharatlı yiyecek, aşırı su (açık-su yüzme → acil tuvalet).',
    ],
  },
  warmup: { en: '600-1000m in pool: 400m mixed + 4x50m race pace + 200m easy. Ends 15-20 min before start.', tr: 'Havuzda 600-1000m: 400m karışık + 4x50m yarış temposu + 200m kolay. Başlangıçtan 15-20 dk önce bitir.' },
  pacing: {
    en: 'First 100m controlled. Middle stable. Last 100m all-out.',
    tr: 'İlk 100m kontrollü. Orta sabit. Son 100m sonuna kadar.',
  },
  fueling: { en: 'For races >30 min: 30 g CHO 30 min pre-race.', tr: '30 dk üstü yarışlar için: yarıştan 30 dk önce 30 g CHO.' },
  mental: { en: 'Smooth stroke first. Speed comes from rhythm.', tr: 'Önce akıcı stroke. Hız ritimden gelir.' },
  mentalRehearsal: {
    en: [
      'Pre-start: visualize first 100m off the wall — relaxed, smooth, controlled. NOT all-out.',
      'Mid-race (lap 4-6 of 1500): "Long stroke. Drive from the hips, finish at the thigh." Stroke length over rate.',
      'When the wall hits (typically 800m for 1500): "Catch is what propels me. Anchor the catch."',
      'Last 200m: cadence increases, stroke length stays. Sprint kicks in only at last 50m.',
      'Contingency — bad lap split: do NOT overstroke. Reset breathing, hold form, the swim averages.',
      'Open-water — chop interferes: shorten stroke, breathe to non-wave side. Sight every 8-10 strokes.',
    ],
    tr: [
      'Başlangıç öncesi: duvardan ilk 100m\'yi görselleştir — gevşek, akıcı, kontrollü. SONUNA KADAR DEĞİL.',
      'Yarış ortası (1500\'ün 4-6. tur): "Uzun stroke. Kalçadan it, uylukta bitir." Vuruş hızından çok vuruş uzunluğu.',
      'Duvara çarptığında (genelde 1500\'ün 800m\'si): "Yakalama beni iter. Yakalamayı sabitle."',
      'Son 200m: kadans artar, stroke uzunluğu kalır. Sprint sadece son 50m\'de devreye girer.',
      'Acil durum — kötü tur splitsi: AŞIRI VURMA. Nefesi sıfırla, formu koru, yüzme ortalamayı alır.',
      'Açık-su — dalga müdahalesi: stroke\'u kısalt, dalgasız tarafa nefes al. Her 8-10 vuruşta yön kontrolü.',
    ],
  },
  caffeine: {
    en: 'Evidence-based: 3 mg/kg, 45-60 min pre-race. Lower than run/bike (shorter race). Caffeine + dehydration risk in heat: pair with 250 ml fluid.',
    tr: 'Kanıt-tabanlı: 3 mg/kg, yarıştan 45-60 dk önce. Koşu/bisiklete göre daha düşük (daha kısa yarış). Sıcakta kafein + dehidrasyon riski: 250 ml sıvıyla eşleştir.',
  },
}

// v9.7.0 — Rowing race-day protocol. 2k race lasts ~6-8 min so fueling is
// pre-loaded; warmup is comprehensive because cold rowing strokes risk poor
// catch and back injury.
// v9.30.0 — Triathlon race-week schedule. Previously sport==='triathlon'
// fell through to RUN_SCHEDULE — triathletes got a run-only race protocol
// despite multi-sport reality. This schedule covers brick rehearsal,
// transition layout walk-through, and reduced-volume per-discipline taper.
//   Citations: Mujika 2003 (multi-sport taper); Stellingwerf 2018
//   (triathlon-specific fueling); Friel 2014 (transition efficiency);
//   Bonci 2011 (T1/T2 logistical errors → DNF).
const TRIATHLON_SCHEDULE = [
  { tMinus: 7, day: 'T-7',
    session: { en: 'Last full brick: 60-90 min bike @goal race pace + 15 min off-bike run @T-pace.', tr: 'Son tam brick: 60-90 dk bisiklet hedef yarış temposunda + 15 dk bisiklet sonrası koşu T-tempoda.' },
    fueling: { en: 'Practice exact race-day in-race fueling on the brick.', tr: 'Brick üzerinde tam yarış-günü beslenmesini prova et.' },
    notes: { en: 'No new gear after this point — wetsuit, bike, shoes locked.', tr: 'Bu noktadan sonra yeni ekipman yok — neopren, bisiklet, ayakkabı sabit.' },
  },
  { tMinus: 6, day: 'T-6',
    session: { en: '30-40 min easy run + 1500-2000m easy swim, technique focus.', tr: '30-40 dk kolay koşu + 1500-2000m kolay yüzme, teknik odaklı.' },
    fueling: { en: 'Maintain Build CHO ~7 g/kg. Hydration baseline.', tr: 'Build CHO ~7 g/kg sürdür. Bazal hidrasyon.' },
    notes: { en: 'Last regular triple-discipline day.', tr: 'Son normal üç-disiplin günü.' },
  },
  { tMinus: 5, day: 'T-5',
    session: { en: 'Rest OR 30 min easy spin only. Transition rehearsal: lay out T1/T2 mentally.', tr: 'Dinlenme YA DA sadece 30 dk kolay bisiklet. Geçiş provası: T1/T2 zihinsel olarak yerleştir.' },
    fueling: { en: 'CHO ~7 g/kg. Begin sleep priority.', tr: 'CHO ~7 g/kg. Uyku önceliğine başla.' },
    notes: { en: 'Walk through bike rack location, swim exit path, run exit path.', tr: 'Bisiklet park yeri, yüzme çıkışı, koşu çıkışı yollarını yürüyerek incele.' },
  },
  { tMinus: 4, day: 'T-4',
    session: { en: 'Short brick primer: 20-25 min bike @goal pace + 10 min run @goal pace, then easy.', tr: 'Kısa brick açılışı: 20-25 dk bisiklet hedef tempoda + 10 dk koşu hedef tempoda, sonrası kolay.' },
    fueling: { en: 'CHO ~8 g/kg. Practice gel-on-bike timing.', tr: 'CHO ~8 g/kg. Bisiklet üstü jel zamanlamasını prova et.' },
    notes: { en: 'Race-pace neuromuscular primer for both bike + run.', tr: 'Hem bisiklet hem koşu için yarış-tempo nöromusküler açılış.' },
  },
  { tMinus: 3, day: 'T-3',
    session: { en: 'Rest OR 1500m easy swim, drill-focus only. No bike, no run.', tr: 'Dinlenme YA DA 1500m kolay yüzme, sadece drill odaklı. Bisiklet yok, koşu yok.' },
    fueling: { en: 'Begin carb load: CHO 10 g/kg. Cut high-fiber.', tr: 'Karbonhidrat yüklemeye başla: CHO 10 g/kg. Yüksek lifi kes.' },
    notes: { en: 'Swim drill keeps stroke feel without leg load.', tr: 'Yüzme drill\'i bacak yüklemeden stroke hissini korur.' },
  },
  { tMinus: 2, day: 'T-2',
    session: { en: '20 min light spin + 4x20s strides on run + 5 min open-water swim feel (if accessible).', tr: '20 dk hafif bisiklet + 4x20s koşu adımı + 5 dk açık-su yüzme hissi (mümkünse).' },
    fueling: { en: 'CHO 10-12 g/kg, electrolyte hydration.', tr: 'CHO 10-12 g/kg, elektrolitli hidrasyon.' },
    notes: { en: 'Light dinner; no novel foods from here. Lay out T1/T2 kit.', tr: 'Hafif akşam yemeği; bundan sonra yeni yiyecek yok. T1/T2 ekipmanını hazırla.' },
  },
  { tMinus: 1, day: 'T-1',
    session: { en: '10 min spin + 5-10 min easy run with 2x15s race-pace touches + 200-400m swim feel. OR full rest.', tr: '10 dk bisiklet + 5-10 dk kolay koşu, 2x15s yarış-tempo dokunuşu + 200-400m yüzme hissi. YA DA tam dinlenme.' },
    fueling: { en: 'CHO 10-12 g/kg; pre-race dinner before 19:00.', tr: 'CHO 10-12 g/kg; yarış öncesi akşam yemeği 19:00 öncesi.' },
    notes: { en: 'Bike check (tires, chain, gears, hydration mounts). T1/T2 layout walk-through. Pin race number. Sleep early.', tr: 'Bisiklet kontrolü (lastik, zincir, vites, sıvı tutacakları). T1/T2 düzenini yürüyerek incele. Yarış numarasını iliştir. Erken uyu.' },
  },
  { tMinus: 0, day: 'T-0 (Race day)',
    session: { en: 'Triathlon: swim → T1 → bike → T2 → run.', tr: 'Triatlon: yüzme → T1 → bisiklet → T2 → koşu.' },
    fueling: { en: 'See race-day fueling block. Critical: refuel in T1 before bike mount.', tr: 'Yarış günü beslenme bloğunu gör. Kritik: T1\'de bisiklete binmeden önce yakıt al.' },
    notes: { en: 'Trust the work. Pace conservatively in swim; race begins on the bike.', tr: 'Çalışmaya güven. Yüzmede ihtiyatlı tempola; yarış bisiklette başlar.' },
  },
]

const RACE_DAY_TRIATHLON = {
  wakeUp: { en: '4-5 h before swim start. 500 ml water + electrolytes immediately.', tr: 'Yüzme başlangıcından 4-5 saat önce. Hemen 500 ml su + elektrolit.' },
  breakfast: { en: 'CHO 1.5-2 g/kg, low-fiber. 3-4 h pre-swim-start. NOT pre-race-start — the gun fires earlier than the bike start.', tr: 'CHO 1.5-2 g/kg, düşük lif. Yüzme başlangıcından 3-4 sa önce. Yarış başlangıcından DEĞİL — start düdüğü bisiklet başlangıcından önce çalar.' },
  preRaceMeals: {
    en: [
      '3.5h pre-swim (75 kg, ~150g CHO): oatmeal (60g dry oats = 36g CHO) + 1 banana (27g) + 2 slices toast + honey (50g) + black coffee.',
      '2h pre-swim: 1 bagel + jam (60g CHO) + 250ml sports drink (15g).',
      '1h pre-swim: 1 gel (25g CHO) + 200ml water. Skip if GI-sensitive.',
      'In T1 (post-swim, before bike mount): immediate gel (25g CHO) — CRITICAL refuel window. Glycogen drained from swim.',
      'AVOID: dairy day-of (lactose + cold-water swallowing), high-fat (gastric emptying), high-fiber (urgency).',
    ],
    tr: [
      'Yüzmeden 3.5 sa önce (75 kg, ~150g CHO): yulaf (60g kuru yulaf = 36g CHO) + 1 muz (27g) + 2 dilim ekmek + bal (50g) + sade kahve.',
      'Yüzmeden 2 sa önce: 1 simit + reçel (60g CHO) + 250ml spor içeceği (15g).',
      'Yüzmeden 1 sa önce: 1 jel (25g CHO) + 200ml su. GI hassasiyet varsa atla.',
      'T1\'de (yüzme sonrası, bisiklete binmeden): hemen jel (25g CHO) — KRİTİK yakıt penceresi. Yüzmeden glikojen tükenmiş.',
      'KAÇIN: yarış günü süt ürünleri (laktoz + soğuk-su yutma), yüksek yağ (mide boşalması), yüksek lif (acil tuvalet).',
    ],
  },
  warmup: { en: '30-40 min total: 10 min easy run with strides + 10 min bike spin + 10-15 min swim with sighting practice (open water) ending 5-10 min before swim start.', tr: '30-40 dk toplam: 10 dk kolay koşu + adım + 10 dk bisiklet + 10-15 dk yüzme, sighting prova (açık su), yüzme başlangıcından 5-10 dk önce bitir.' },
  pacing: {
    en: 'Swim: 5-10% under goal pace — energy budget for bike-run. Bike: upper-Z2/lower-Z3 (88-92% goal FTP, NOT TT effort). Run: first 1-2 km feels SLOW, accept it. Last 25%: free if able.',
    tr: 'Yüzme: hedef tempodan %5-10 altında — bisiklet-koşu için enerji bütçesi. Bisiklet: üst-Z2/alt-Z3 (%88-92 hedef FTP, TT eforu DEĞİL). Koşu: ilk 1-2 km YAVAŞ hisseder, kabul et. Son %25: gücün varsa serbest.',
  },
  fueling: { en: 'On-bike: 60-90 g CHO/h with 600-800 ml fluid/h. Last gel 10-15 min before T2 dismount. On-run: 1 gel every 4-5 km. Salt cap if hot/heavy sweater.', tr: 'Bisiklette: 60-90 g CHO/sa, 600-800 ml sıvı/sa. T2 inişinden 10-15 dk önce son jel. Koşuda: her 4-5 km\'de 1 jel. Sıcak/ağır terleyen: tuz kapsülü.' },
  mental: { en: 'Swim: stay smooth, sight every 6-8 strokes. T1: deliberate, not rushed — losing 30s here is fine; losing focus costs more. Bike: settle in by km 5; race begins at km 25 of bike. Run: walk-jog T2 area, then settle into the marathon-shuffle pattern.', tr: 'Yüzme: pürüzsüz kal, her 6-8 stroke\'ta sighting. T1: bilinçli, acelesiz — burada 30s kayıp tamam; odak kaybı daha pahalı. Bisiklet: 5. km\'de yerleşin; yarış bisikletin 25. km\'sinde başlar. Koşu: T2 alanını yürü-koş, sonra maraton-shuffle desenine yerleş.' },
  // v9.30.0 — Mental rehearsal scripts (Vealey 2007; Bull 1996) adapted for tri.
  mentalRehearsal: {
    en: [
      'Visualize the swim start: deliberate pacing, smooth bilateral breathing, sighting every 6-8 strokes. Do not chase the front pack.',
      'T1 mental script: "Deliberate, not rushed. Wetsuit strip, helmet, glasses, mount line." Practice this sequence 5 times in training week.',
      'Bike first 10 min: "Settle. Breathing rhythmic. Power steady — not pushing, not coasting." Suppress the urge to chase.',
      'Bike middle: anchor on aero position, hydration cadence, gel timing. Race begins at km 25.',
      'T2 mental script: "Bike racked, helmet off, shoes on, hat on, GO." Pre-rehearsed = autopilot.',
      'Run first 1-2 km: legs feel heavy and slow — THIS IS NORMAL. "Rubber-band release" comes around km 2-3.',
      'Run final 25%: "Reel them in." Pick one runner, close the gap, repeat. The marathon-shuffle wins.',
    ],
    tr: [
      'Yüzme başlangıcını görselleştir: bilinçli tempo, pürüzsüz çift-taraflı nefes, her 6-8 stroke\'ta sighting. Ön grubu kovalama.',
      'T1 zihinsel senaryosu: "Bilinçli, acelesiz. Neopren çıkar, kask, gözlük, biniş çizgisi." Antrenman haftası 5 kez prova et.',
      'Bisiklet ilk 10 dk: "Yerleş. Nefes ritmik. Güç sabit — ittirme yok, kaykılma yok." Kovalama dürtüsünü bastır.',
      'Bisiklet ortası: aero pozisyon, hidrasyon kadansı, jel zamanlaması. Yarış 25. km\'de başlar.',
      'T2 zihinsel senaryosu: "Bisiklet rafta, kask çıktı, ayakkabı, şapka, GİT." Önceden prova = otomatik pilot.',
      'Koşu ilk 1-2 km: bacaklar ağır ve yavaş hisseder — BU NORMAL. "Lastik-bant gevşemesi" 2-3. km civarında gelir.',
      'Koşu son %25: "Onları çek." Bir koşucu seç, mesafeyi kapat, tekrar et. Maraton-shuffle kazanır.',
    ],
  },
  caffeine: {
    en: 'Evidence-based: 3-6 mg/kg, 60 min pre-swim-start. Take with breakfast, not last-minute. 75 kg → 225-450 mg. Skip if anxiety-prone or sleep-poor week. Avoid >6 mg/kg (GI/jitter risk magnified by swim cold-water swallowing).',
    tr: 'Kanıt-tabanlı: 3-6 mg/kg, yüzme başlangıcından 60 dk önce. Kahvaltıyla al, son dakika değil. 75 kg → 225-450 mg. Anksiyete eğilimi veya zayıf uyku haftasıysa atla. >6 mg/kg sakın (yüzme soğuk-su yutmasıyla GI/titrek riski büyür).',
  },
  // v9.30.0 — Triathlon-specific transition layout protocol (Bonci 2011 —
  // logistical errors are the leading cause of triathlon DNF, more than fitness).
  transitionLayout: {
    en: 'T1 layout (front-to-back, in execution order): wetsuit-strip mat, goggles+cap drop bag, helmet (open + on bike rail), bike shoes (clipped to pedals or on ground), race belt, water bottle. T2 layout: run shoes pre-loosened, hat, sunglasses, gel #1 in pocket. Walk through both transitions twice on T-1 day. Time the layout. Bike-mount line: clip-in OUTSIDE the line.',
    tr: 'T1 düzeni (önden arkaya, uygulama sırasında): neopren-çıkarma matı, gözlük+kep çantası, kask (açık + bisiklet ray\'inde), bisiklet ayakkabısı (pedala kilitli veya yerde), yarış kemeri, suluk. T2 düzeni: koşu ayakkabıları önceden gevşetilmiş, şapka, gözlük, 1. jel cepte. T-1 gününde her iki geçişi iki kez yürüyerek incele. Düzeni zamanla. Biniş çizgisi: kilitlenmeyi çizginin DIŞINDA yap.',
  },
  // v9.30.0 — Brick refuel window. Glycogen drains aggressively on swim
  // (anaerobic + cold-water + tension); the 0-10 min post-swim T1 window
  // is the highest fueling-failure risk in triathlon (Stellingwerf 2018).
  brickRefuelWindow: {
    en: 'T1 immediate-CHO rule: take 25-30 g gel within 60s of mounting bike. Glycogen depletion from swim is steeper than most athletes expect; failing to refuel pre-bike causes the classic "felt fine until km 30 of bike" bonk. Practice this on every brick session in training.',
    tr: 'T1 hemen-CHO kuralı: bisiklete binişten sonraki 60 saniye içinde 25-30 g jel al. Yüzmeden glikojen tükenmesi çoğu sporcunun beklediğinden dik; bisiklet-öncesi yakıt almama klasik "bisikletin 30. km\'sine kadar iyi hissettim" bonk\'una neden olur. Antrenmanda her brick seansında prova et.',
  },
}

const RACE_DAY_ROWING = {
  wakeUp: { en: '3-4 h before race start. Hydrate (400 ml + electrolytes).', tr: 'Yarış başlangıcından 3-4 saat önce. Hidrate ol (400 ml + elektrolit).' },
  breakfast: { en: 'CHO 1.5-2 g/kg, low-fiber, low-fat. Familiar foods. 3 h pre-race.', tr: 'CHO 1.5-2 g/kg, düşük lif, düşük yağ. Bilinen yiyecekler. Yarıştan 3 sa önce.' },
  preRaceMeals: {
    en: [
      '3h pre-race (80 kg, ~140g CHO): 1.5 cup oatmeal (50g CHO) + 1 banana (27g) + 2 slices toast + jam (60g). Coffee.',
      '1.5h pre-race: 1 sports drink 500ml (30g CHO) + 1 small bagel (50g).',
      '30 min pre-race: 1 gel (25g CHO) + small sip water. Caffeine 3 mg/kg if tolerated.',
      'NO mid-race fueling needed (race <8 min). Pre-load is everything.',
      'AVOID: dairy (cramp risk during max effort), excess fluid (uncomfortable in seat), unfamiliar foods.',
    ],
    tr: [
      'Yarıştan 3 sa önce (80 kg, ~140g CHO): 1.5 fincan yulaf (50g CHO) + 1 muz (27g) + 2 dilim ekmek + reçel (60g). Kahve.',
      'Yarıştan 1.5 sa önce: 1 spor içeceği 500ml (30g CHO) + 1 küçük simit (50g).',
      'Yarıştan 30 dk önce: 1 jel (25g CHO) + biraz su. Toleranslıysan kafein 3 mg/kg.',
      'Yarış-içi beslenme YOK (yarış <8 dk). Ön-yükleme her şey.',
      'KAÇIN: süt ürünleri (max efor sırasında kramp), aşırı sıvı (oturakta rahatsız), bilinmeyen yiyecekler.',
    ],
  },
  warmup: { en: '20-25 min: 10 min UT2 + 4x250m build + 4 power-10s + 6 min easy. Ends 10-15 min before start.', tr: '20-25 dk: 10 dk UT2 + 4x250m kademeli + 4 güç-10 + 6 dk kolay. Başlangıçtan 10-15 dk önce bitir.' },
  pacing: {
    en: 'First 500m: 1-2 sec/500m above goal split (avoid lactate spike). Middle 1000m: lock goal split. Last 500m: open up rate, drop split if able.',
    tr: 'İlk 500m: hedef splitten 1-2 sn/500m yavaş (laktat sıçraması yok). Orta 1000m: hedef splitte sabit. Son 500m: hız aç, gücün varsa split düşür.',
  },
  fueling: { en: 'Pre-race only: 30 g CHO 30-45 min pre-race. No mid-race fueling needed (race <8 min).', tr: 'Sadece yarış öncesi: yarıştan 30-45 dk önce 30 g CHO. Yarış sırasında beslenme gerekmez (yarış <8 dk).' },
  mental: { en: 'Trust the rhythm. First 500m is the hardest mental gate; after that you are committed.', tr: 'Ritme güven. İlk 500m en zor zihinsel kapıdır; sonrası bağlanmıştır.' },
  mentalRehearsal: {
    en: [
      'Pre-race: visualize the first 5 strokes — explosive but clean. Do NOT chase others off the line.',
      'First 500m: "Long, strong, controlled." Hold target split + 1 sec. Keep stroke at 32 spm.',
      'Middle 1000m: this is the dark zone. Mantra: "Patience. The race is won here by holding split."',
      'When at 1500m mark and lungs burn: "I have ~2 min left. Anyone can hold for 2 min. Stroke pattern."',
      'Last 250m: rate up to 36-38, drop split, sprint. Visualize the line.',
      'Contingency — caught a crab: stay calm, recover the blade, get back to rhythm. Do not panic; you have time.',
    ],
    tr: [
      'Yarış öncesi: ilk 5 vuruşu görselleştir — patlayıcı ama temiz. Başlangıç çizgisinde başkalarını TAKİP ETME.',
      'İlk 500m: "Uzun, güçlü, kontrollü." Hedef split + 1 sn tut. Vuruş 32 spm\'de kal.',
      'Orta 1000m: karanlık bölge. Mantra: "Sabır. Yarış burada split tutarak kazanılır."',
      '1500m\'de akciğerler yandığında: "Yaklaşık 2 dk kaldı. Herkes 2 dk tutabilir. Vuruş paterni."',
      'Son 250m: hızı 36-38\'e çıkar, split düşür, sprint. Çizgiyi görselleştir.',
      'Acil durum — yakaladın bir yengeç: sakin kal, bıçağı kurtar, ritmi yakala. Panikleme; zamanın var.',
    ],
  },
  caffeine: {
    en: 'Evidence-based: 3-6 mg/kg, 60 min pre-race. Short max-effort event = ideal caffeine ergogenic. Test in training; pre-race day-before should already be standard.',
    tr: 'Kanıt-tabanlı: 3-6 mg/kg, yarıştan 60 dk önce. Kısa max-efor etkinliği = ideal kafein ergojeniği. Antrenmanda test et; yarış-öncesi gün zaten standart olmalı.',
  },
}

// v9.8.0 — Travel / altitude / heat conditional protocol.
//
// Inputs from race conditions:
//   - timeZoneShiftHrs: signed integer (e.g. -8 for EU→East Asia, +5 for EU→US-East)
//   - raceAltitudeM: race elevation in meters
//   - raceHeatC: forecast race-day temperature in °C
//
// Returns null if no special conditions, else a structured advisory block.

function buildTravelProtocol(timeZoneShiftHrs) {
  if (!timeZoneShiftHrs || Math.abs(timeZoneShiftHrs) < 3) return null
  const direction = timeZoneShiftHrs > 0 ? 'eastward' : 'westward'
  const days = Math.abs(timeZoneShiftHrs)
  return {
    summary: {
      en: `Time-zone shift of ${Math.abs(timeZoneShiftHrs)}h ${direction}. Plan ${days}-${days + 2} days early arrival. Body adapts ~1h/day on average.`,
      tr: `${Math.abs(timeZoneShiftHrs)} saat ${direction === 'eastward' ? 'doğu' : 'batı'} zaman dilimi farkı. ${days}-${days + 2} gün erken varış planla. Vücut günde ~1 saat adapte olur.`,
    },
    sleep: {
      en: timeZoneShiftHrs > 0
        ? 'Eastbound: shift bedtime 1h earlier per day, starting 5 days pre-departure. On arrival: morning sun exposure 30+ min. Melatonin 0.5-3 mg 30 min before target bedtime.'
        : 'Westbound: shift bedtime 1h later per day. On arrival: afternoon sun exposure. Avoid bright morning light on day 1.',
      tr: timeZoneShiftHrs > 0
        ? 'Doğuya: kalkıştan 5 gün önce başlayarak yatak saatini günde 1 saat erken al. Varışta: sabah 30+ dk güneş. Hedef yatak saatinden 30 dk önce melatonin 0.5-3 mg.'
        : 'Batıya: yatak saatini günde 1 saat geç al. Varışta: öğleden sonra güneş. 1. günde sabah parlak ışıktan kaçın.',
    },
    fueling: {
      en: 'Hydrate aggressively in flight (250 ml/h). Avoid alcohol and excess caffeine. Eat on destination time from boarding.',
      tr: 'Uçuşta agresif hidrasyon (250 ml/sa). Alkol ve aşırı kafeinden kaçın. Biniş anından itibaren varış saatinde ye.',
    },
  }
}

function buildAltitudeProtocol(raceAltitudeM) {
  if (!raceAltitudeM || raceAltitudeM < 1500) return null
  const tier = raceAltitudeM >= 3000 ? 'extreme' : raceAltitudeM >= 2000 ? 'high' : 'moderate'
  return {
    summary: {
      en: `Race at ${raceAltitudeM}m (${tier} altitude). Expect 5-15% performance decrement in aerobic events; recovery extended.`,
      tr: `Yarış ${raceAltitudeM}m'de (${tier === 'extreme' ? 'aşırı' : tier === 'high' ? 'yüksek' : 'orta'} rakım). Aerobik etkinliklerde %5-15 performans kaybı bekle; toparlanma uzar.`,
    },
    acclimatization: {
      // v9.36.0 — Added LHTL duration cap (>21 days plateaus, Robertson 2010)
      // and minimum CTL floor (athletes <5 h/week shouldn't attempt LHTL —
      // hypoxic stress on top of low aerobic base risks illness, Wilber 2007).
      // Also added <1 week worthlessness to close the "I'll arrive 4 days
      // early" window where you get the dip without the gain.
      en: tier === 'extreme'
        ? 'Live-high-train-low (LHTL) ideal. Arrive 14-21 days early OR use altitude tent 4 weeks prior. CRITICAL caps: >21 days yields no further gain (Robertson 2010 plateau); <7 days arrival is worse than <24h (you get the post-arrival dip without the adaptation). Minimum CTL >5 h/week before LHTL exposure — hypoxic stress on top of low aerobic base risks illness (Wilber 2007). Without acclimatization, expect significant DNF risk.'
        : tier === 'high'
          ? 'Arrive 7-14 days early OR <24 h pre-race (avoid the dip 3-5 days post-arrival). >14 days yields diminishing returns. Minimum CTL >4 h/week before exposure. 2-3 hypoxic sessions in Build phase recommended.'
          : 'Arrive 4-7 days early. >10 days yields no extra benefit at this elevation. Single hypoxic session (e.g., breath-holding tempo) in Build can help.',
      tr: tier === 'extreme'
        ? 'Yüksek-yaşa-düşük-antrene (LHTL) ideal. 14-21 gün erken var YA DA 4 hafta önce rakım çadırı. KRİTİK SINIRLAR: >21 gün ek kazanç vermez (Robertson 2010 platosu); <7 gün varış <24 sa\'den daha kötü (adaptasyon olmadan dip alırsın). LHTL maruziyetinden önce minimum CTL >5 sa/hafta — düşük aerobik taban üzerine hipoksik stres hastalık riski (Wilber 2007). Adapte olmadan ciddi DNF riski.'
        : tier === 'high'
          ? '7-14 gün erken var YA DA <24 sa yarış-öncesi (varıştan 3-5 gün sonraki düşüşü önle). >14 gün azalan getiri. Maruziyetten önce minimum CTL >4 sa/hafta. Build fazında 2-3 hipoksik seans önerilir.'
          : '4-7 gün erken var. Bu rakımda >10 gün ek fayda yok. Build fazında tek hipoksik seans (ör. nefes-tutma tempo) yardımcı olur.',
    },
    pacing: {
      en: 'Reduce goal pace by 5% at 1500m, 8% at 2000m, 12-15% at 3000m+. Expect higher HR for given pace.',
      tr: '1500m\'de hedef tempoyu %5, 2000m\'de %8, 3000m+\'da %12-15 azalt. Verilen tempoda daha yüksek nabız bekle.',
    },
    fueling: {
      en: 'Increase iron-rich foods 4 weeks pre-race (2x daily red meat or supplement). Hydration needs +30%. Watch for AMS symptoms (headache + nausea + sleep disturbance + altitude-related anorexia). If AMS persists >48h despite acetazolamide consideration, descend.',
      tr: 'Yarıştan 4 hafta önce demir-zengin yiyecekleri arttır (günde 2x kırmızı et veya takviye). Hidrasyon ihtiyacı +%30. AMS belirtilerine dikkat (baş ağrısı + bulantı + uyku bozukluğu + rakıma bağlı iştahsızlık). Asetazolamid değerlendirmesine rağmen AMS >48 sa sürerse, in.',
    },
  }
}

// v9.31.0 — Cold-weather race protocol. Heat had a builder since v9.8.0
// but cold (<5°C) was a complete blind spot despite its own physiological
// challenges: peripheral vasoconstriction reduces working-muscle perfusion,
// GI absorption slows with cold fluids, frostbite risk on extremities for
// races >2h, and heart-rate-pace dissociation widens. Mirrors heat shape
// (summary / acclimatization / pacing / fueling) for UI consistency with
// the existing RaceWeekConditional renderer.
//   Citations: Tipton 2017 (cold-water immersion + cold stress);
//   Castellani 2006 (frostbite thresholds); Febbraio 2000 (cold +
//   fatigue spiral); Doubt 1991 (GI absorption in cold).
function buildColdProtocol(raceTempC) {
  if (raceTempC == null || raceTempC >= 5) return null
  const tier = raceTempC <= -10 ? 'extreme' : raceTempC < 0 ? 'severe' : 'moderate'
  return {
    summary: {
      en: `Race-day cold ${raceTempC}°C (${tier}). Cold acclimatization required: 7-14 days improves vasoregulation and reduces shivering threshold. Below 0°C, frostbite risk on extremities for races >2h.`,
      tr: `Yarış-günü soğuk ${raceTempC}°C (${tier === 'extreme' ? 'aşırı' : tier === 'severe' ? 'şiddetli' : 'orta'}). Soğuğa adaptasyon gerekli: 7-14 gün vazoregülasyonu iyileştirir, titreme eşiğini düşürür. 0°C altı, >2 sa yarışlarda ekstremitelerde donmaya bağlı doku hasarı riski.`,
    },
    acclimatization: {
      en: tier === 'extreme'
        ? '14-day protocol: 4-5 outdoor easy sessions in race-similar cold (or cold-shower 3-5 min post-easy-day, 5-7 sessions). Test ALL race kit (gloves, hat, layers, shoe covers) in training before race week.'
        : tier === 'severe'
          ? '7-10 days: 4-6 cold-exposure sessions (30-60 min outdoor easy in <5°C OR cold shower 3 min post-session). Test layering. Identify mitten vs glove preference for hands.'
          : '5-7 days light cold exposure (outdoor easy in <10°C). Test single-layer-baselayer + windproof shell combo. Verify shoe-cover fit on race shoes.',
      tr: tier === 'extreme'
        ? '14 günlük protokol: yarışa benzer soğukta 4-5 dış mekan kolay seans (veya kolay-gün sonrası 3-5 dk soğuk duş, 5-7 seans). Yarış haftasından önce TÜM ekipmanı (eldiven, bere, kat, ayakkabı kılıfı) test et.'
        : tier === 'severe'
          ? '7-10 gün: 4-6 soğuk-maruziyet seansı (<5°C dış mekan 30-60 dk kolay VEYA seans sonrası 3 dk soğuk duş). Katlamayı test et. El için eldiven mi tek-parça mı tercihini belirle.'
          : '5-7 gün hafif soğuk maruziyeti (<10°C dış mekan kolay). Tek-kat-içlik + rüzgar geçirmez dış kat kombosunu test et. Yarış ayakkabısında kılıf uyumunu doğrula.',
    },
    pacing: {
      en: `Cold pacing: HR runs 5-10 bpm LOWER for the same effort (peripheral vasoconstriction). Trust pace/power, not HR. Goal pace ${tier === 'extreme' ? 'may be 3-5%' : 'should be unchanged or 1-2%'} slower if effort feels disproportionate. Warmup should be 25-50% LONGER than normal — cold muscles take longer to come online.`,
      tr: `Soğuk tempo: aynı eforda nabız 5-10 bpm DAHA DÜŞÜK (periferik damar daralması). Nabıza değil tempo/güce güven. Efor orantısız hissederse hedef tempo ${tier === 'extreme' ? '%3-5' : 'aynı veya %1-2'} yavaş olabilir. Isınma normalden %25-50 UZUN olmalı — soğuk kaslar daha geç açılır.`,
    },
    fueling: {
      en: `Cold fueling: warm fluids preferred (40°C water bottle in jacket pocket). Cold fluids slow gastric emptying 30-50% (Doubt 1991). Pre-race hot meal 90 min pre-start (oatmeal + tea). Glycogen burn ~10-15% higher than warm-condition same effort (shivering thermogenesis).${tier === 'extreme' || tier === 'severe' ? ' Frostbite watch: cover ears, nose, fingers, toes. White waxy skin = stop and rewarm.' : ''}`,
      tr: `Soğuk beslenme: ılık sıvı tercih (montta 40°C suluk). Soğuk sıvı mide boşalmasını %30-50 yavaşlatır (Doubt 1991). Yarıştan 90 dk önce sıcak öğün (yulaf + çay). Aynı eforla glikojen yakımı ılık koşula göre %10-15 daha yüksek (titreme termogenezi).${tier === 'extreme' || tier === 'severe' ? ' Donma izlemi: kulak, burun, parmaklar, ayak parmakları kapalı. Beyaz balmumu cilt = dur ve ısıt.' : ''}`,
    },
  }
}

function buildHeatProtocol(raceHeatC) {
  if (raceHeatC == null || raceHeatC < 25) return null
  const tier = raceHeatC >= 32 ? 'extreme' : raceHeatC >= 28 ? 'high' : 'moderate'
  return {
    summary: {
      en: `Race-day heat ${raceHeatC}°C (${tier}). Heat acclimatization required: 5-14 days improves thermoregulation 5-15%.`,
      tr: `Yarış-günü sıcaklığı ${raceHeatC}°C (${tier === 'extreme' ? 'aşırı' : tier === 'high' ? 'yüksek' : 'orta'}). Sıcağa adaptasyon gerekli: 5-14 gün termorregülasyonu %5-15 geliştirir.`,
    },
    acclimatization: {
      en: tier === 'extreme'
        ? '14 days protocol: 5-7 sessions @ 60-90 min in heat (hot bath post-easy-session can substitute). Short sessions ineffective.'
        : '7-10 days: 4-6 heat sessions, 45-75 min each. Hot bath (40°C, 30-40 min) post-easy-day is evidence-backed alternative (Zurawlew 2016).',
      tr: tier === 'extreme'
        ? '14 günlük protokol: sıcakta 5-7 seans 60-90 dk (kolay-seans sonrası sıcak banyo ikame). Kısa seanslar etkisiz.'
        : '7-10 gün: 4-6 sıcak seans, her biri 45-75 dk. Sıcak banyo (40°C, 30-40 dk) kolay-gün sonrası kanıt-tabanlı alternatif (Zurawlew 2016).',
    },
    pacing: {
      en: `Slow goal pace by ${tier === 'extreme' ? '8-12' : tier === 'high' ? '4-7' : '2-4'}%. Drink 750-1000 ml/h with 800-1200 mg sodium/h. Pre-cool with ice slushie 30 min pre-race.`,
      tr: `Hedef tempoyu %${tier === 'extreme' ? '8-12' : tier === 'high' ? '4-7' : '2-4'} yavaşlat. 750-1000 ml/sa içecek + 800-1200 mg sodyum/sa. Yarıştan 30 dk önce buzlu içecekle ön-soğut.`,
    },
    fueling: {
      en: 'Sodium critical: 800-1200 mg/h. Test sweat rate in heat sessions. Cold fluids preferred (improves gastric emptying).',
      tr: 'Sodyum kritik: 800-1200 mg/sa. Sıcak seanslarda terleme oranını test et. Soğuk sıvı tercih edilir (mide boşalmasını iyileştirir).',
    },
  }
}

/**
 * @public
 * @param {{
 *   sport?: string,
 *   raceDate?: string,
 *   timeZoneShiftHrs?: number,
 *   raceAltitudeM?: number,
 *   raceHeatC?: number,
 * }} input
 * @returns {RaceWeekProtocol}
 */
// v9.35.0 — DNF triage decision tree. Closes a P1 from the race-week
// completeness audit. Athletes lacked criteria for "when to stop racing"
// vs "push through pain" — leading to two opposite failure modes:
// (a) DNF on a fixable issue (mild cramp, minor mechanical) when continuation
// would have been safe, and (b) pushing through a stop-condition (heat illness,
// rhabdomyolysis-onset, cardiac event) until medical intervention.
//
// The decision tree below is universal across sports — the categories mirror
// the standard sports-medicine DNS/DNF/DNS-medical triage.
//
//   Citations: Bahr 2016 (cramping etiology multi-factorial); Noakes 2000
//   (central governor + organ-protective shutdown); Maron 2007 (race-day
//   cardiac event signs); Sawka 2007 ACSM (heat illness exit criteria).
// v9.38.0 — Restructured into severity-tiered buckets so the UI can render
// each tier as its own color-coded callout (red/orange/blue) instead of a
// 480-word run-on paragraph. The bilingual blob `DNF_TRIAGE_DECISION_TREE`
// is now derived from the buckets so existing tests + downstream consumers
// (export, share, JSON) keep working unchanged.
const DNF_TRIAGE_BUCKETS = [
  {
    severity: 'stop',
    title: { en: 'STOP IMMEDIATELY (medical, not optional)', tr: 'HEMEN DUR (tıbbi, opsiyon değil)' },
    items: {
      en: [
        'Chest pain or pressure',
        'Severe shortness of breath',
        'Syncope (fainting) or near-syncope (about to faint)',
        'Collapse',
        'Blurred or tunnel vision',
        'Sudden severe headache (especially with aura — stroke risk)',
        'Confusion',
        'No sweat in heat AND core-temp sensation rising (heat-stroke onset)',
      ],
      tr: [
        'Göğüs ağrısı veya baskı',
        'Şiddetli nefes darlığı',
        'Bayılma veya bayılma hissi',
        'Çökme',
        'Bulanık veya tünel görüş',
        'Ani şiddetli baş ağrısı (özellikle aura ile — felç riski)',
        'Zihin bulanıklığı',
        'Sıcakta terlemeyi DURDURMA + iç-vücut ısısının yükseldiğini hissetme',
      ],
    },
  },
  {
    severity: 'exit',
    title: { en: 'EXIT TO WALK / DNF (sports-injury caution)', tr: 'YÜRÜYÜŞE GEÇ / DNF (spor-yaralanma uyarısı)' },
    items: {
      // v9.41.0 — Added 4-6 word plain-English appositives for medical Latin
      // (rhabdomyolysis, compartment syndrome, viral myocarditis) so a
      // non-clinician athlete reading under race stress doesn't skim past
      // safety-critical bullets. The Latin term stays as a hook but the
      // plain explanation rides with it in the same bullet.
      en: [
        'Tea-colored or dark-cola urine (rhabdomyolysis — muscle breakdown leaking protein into blood, kidney damage risk)',
        'Severe localized joint or bone pain (stress fracture or compartment syndrome — swelling that traps blood inside a muscle group, ER-level)',
        'Unilateral leg weakness (one leg failing — neurological warning, do NOT push through)',
        'Fever + chills + sore throat (infection — viral myocarditis risk: heart inflammation triggered by viral illness, sudden-cardiac risk)',
        'One-sided gait failure (you can\'t make one leg drive forward symmetrically)',
      ],
      tr: [
        'Çay rengi veya koyu kola idrar (rabdomyoliz — kası parçalayıp kan akımına protein bırakır, böbrek hasarı riski)',
        'Şiddetli lokal eklem veya kemik ağrısı (stres kırığı veya kompartman sendromu — kası saran zarın içinde kan birikmesi, ER seviyesi acil)',
        'Tek-taraflı bacak zayıflığı (tek bacağın çekilmesi — nörolojik uyarı, üstüne gitme)',
        'Ateş + titreme + boğaz ağrısı (enfeksiyon — viral miyokardit riski: viral hastalık tetikli kalp iltihabı, ani kalp riski)',
        'Tek-taraflı yürüyüş bozukluğu (bir bacağı simetrik öne süremiyor olman)',
      ],
    },
  },
  {
    severity: 'continue',
    title: { en: 'CONTINUE WITH ADJUSTMENT', tr: 'AYARLAYARAK DEVAM ET' },
    items: {
      en: [
        'Mild cramp → slow 20-30s, electrolyte + 100 ml water, resume at -5% pace',
        'Mid-race nausea → switch to liquid-only fueling, smaller boluses',
        'Pacing miscalculation (off goal pace) → switch mindset to "best possible from here," do NOT chase original goal',
        'Mechanical (flat, chain) → solo fix <5 min OK; >10 min = DNF unless near aid station with neutral support',
      ],
      tr: [
        'Hafif kramp → 20-30s yavaşla, elektrolit + 100 ml su, %5 yavaş tempoda devam',
        'Yarış-ortası bulantı → küçük dozlarda sadece sıvı yakıta geç',
        'Tempo hatası (hedef tempodan sapma) → "buradan mümkün olanı yap" zihniyetine geç, orijinal hedefi kovalama',
        'Mekanik arıza (patlak, zincir) → tek başına <5 dk tamir tamam; >10 dk = aid istasyonu + tarafsız destek yoksa DNF',
      ],
    },
  },
]

const _flattenBuckets = (lang) => DNF_TRIAGE_BUCKETS
  .map(b => `${b.title[lang]}: ${b.items[lang].join('; ')}.`)
  .join(' ')

const DNF_TRIAGE_DECISION_TREE = {
  en: _flattenBuckets('en'),
  tr: _flattenBuckets('tr'),
}

// v9.35.0 — Last 3 nights sleep hygiene protocol. Closes a P1 from the
// race-week audit: prior protocol said only "begin sleep priority" on T-5
// and "sleep early" on T-1 — too vague. Specific protocol below from
// Czeisler 2005 (circadian misalignment cuts performance 5-10%) and Mah
// 2011 (cumulative pre-race sleep debt, not the night before, is what
// matters). Protocol covers caffeine cutoff, melatonin gating, bedroom
// environment, screen hygiene, wake-time anchoring.
const LAST_3_NIGHTS_SLEEP_HYGIENE = {
  en: 'T-3: zero caffeine after 14:00 (caffeine half-life 5-6h; residual at bedtime cuts deep-sleep 30%). T-2: if travel zone shift >5h, 0.5-3 mg melatonin 30 min before target bedtime (Czeisler 2005). T-1: bedroom 16-19°C (optimal for slow-wave sleep), full blackout (eye mask if needed), white noise or earplugs, zero screens 90 min pre-bed (or blue-light blockers). Last 3 nights: consistent wake time ±30 min to anchor circadian phase — sleeping in 2h "to bank rest" actually impairs race-morning alertness. Race morning HRV: if >5% elevated above 30-day baseline, consider executing race plan more conservatively in first 25%.',
  tr: 'T-3: 14:00 sonrası kafein YOK (kafein yarı ömrü 5-6 sa; yatakta kalan derin uykuyu %30 düşürür). T-2: seyahat zaman dilimi >5 sa ise hedef yatma saatinden 30 dk önce 0,5-3 mg melatonin (Czeisler 2005). T-1: yatak odası 16-19°C (yavaş-dalga uykusu için optimal), tam karartma (gerekirse uyku maskesi), beyaz gürültü veya kulak tıkacı, yatmadan 90 dk önce ekran YOK (veya mavi-ışık engelleyici). Son 3 gece: tutarlı uyanma saati ±30 dk, sirkadiyen fazı sabitlemek için — "dinlenme biriktirmek" için 2 sa fazla uyumak aslında yarış-sabahı dikkatini bozar. Yarış sabahı HRV: 30-günlük bazalın %5\'inden fazla yüksekse, ilk %25\'te yarış planını daha ihtiyatlı uygula.',
}

// v9.33.0 — Post-race recovery first 48h. Closes a P1 from the race-week
// completeness audit: protocol previously ended at T-0 race day with no
// guidance for the immediate post-race window. Stellingwerff 2014 shows
// CHO+protein timing in the first 2h post-race materially affects glycogen
// resynthesis and muscle protein-synthesis rebound. Macaluso 2012 sets
// inflammation timeline expectations (DOMS peaks 24-48h, ice vs heat
// decision depends on injury type). Banister 1997 shows TSS / fatigue
// signal stays elevated 36+ hours post-race regardless of perceived
// readiness.
//
// Universal across sports — the recovery physiology is sport-invariant.
// Surfaced in raceDay output so UI renders inline with the race-day block.
const POST_RACE_RECOVERY_48H = {
  hour0to2: {
    en: 'Hour 0-2 (CRITICAL refuel window): 1.0-1.2 g/kg CHO + 20-30 g protein. Liquid form preferred (milkshake, recovery drink) — solids often nauseating immediately post-race. Aim within 30 min of finish line.',
    tr: 'Saat 0-2 (KRİTİK yakıt penceresi): 1,0-1,2 g/kg CHO + 20-30 g protein. Sıvı form tercih (milkshake, toparlanma içeceği) — yarış sonrası anında katı yiyecek genelde mide bulandırır. Bitiş çizgisinden sonraki 30 dk içinde hedefle.',
  },
  hour2to4: {
    en: 'Hour 2-4: 1.0 g/kg CHO solid meal (rice, pasta, sandwich). Rehydrate 150% of estimated sweat loss across 4 hours (~100 ml/15 min if 1.5 L lost). Sodium 800-1000 mg/L of replacement fluid.',
    tr: 'Saat 2-4: 1,0 g/kg CHO katı öğün (pilav, makarna, sandviç). Tahmin edilen ter kaybının %150\'sini 4 saat içinde geri al (1,5 L kaybedildiyse ~100 ml/15 dk). Yenileme sıvısının her L\'sinde 800-1000 mg sodyum.',
  },
  day1: {
    en: 'Day 1 post-race: easy walking ONLY (20-30 min low-intensity). NO strength, NO running, NO bike. Soreness peaks 24-48h (Macaluso 2012). Ice bath 10-15 min ONLY if visible swelling or restricted ROM. Heat preferred for purely muscular soreness without inflammation.',
    tr: 'Yarış sonrası 1. gün: SADECE kolay yürüyüş (20-30 dk düşük yoğunluk). Kuvvet YOK, koşu YOK, bisiklet YOK. Ağrı 24-48 sa\'de zirve yapar (Macaluso 2012). Görünür şişlik veya hareket kısıtı varsa SADECE 10-15 dk buz banyosu. Salt kas ağrısı + inflamasyon yoksa sıcak tercih.',
  },
  day2: {
    en: 'Day 2 post-race: still easy. 30-45 min Z1 movement (walk, easy spin, easy swim). HRV check on AM: if still >10% elevated above baseline, extend easy days to 3-4 (parasympathetic hasn\'t reset). Eat to appetite — caloric needs remain elevated 24-48h post-race.',
    tr: 'Yarış sonrası 2. gün: hâlâ kolay. 30-45 dk Z1 hareket (yürüyüş, kolay bisiklet, kolay yüzme). Sabah HRV kontrolü: bazalın %10\'undan fazla yüksekse kolay günleri 3-4\'e uzat (parasempatik resetlenmedi). İştaha göre ye — kalori ihtiyacı yarış sonrası 24-48 sa boyunca yüksek kalır.',
  },
  day3plus: {
    en: 'Day 3+: gradual return to training. Run/bike: 50% normal volume Z1-Z2 only. Strength: skip first week post-major-race. NO key/quality session before Day 7. Each "felt great too soon" return cuts ~3% off future ceiling (Banister 1997 supercompensation window).',
    tr: '3. gün+: antrenmana kademeli dönüş. Koşu/bisiklet: normal hacmin %50\'si, sadece Z1-Z2. Kuvvet: büyük yarış sonrası ilk haftayı atla. 7. günden önce anahtar/kaliteli seans YOK. Her "erken iyi hissettim" dönüşü gelecekteki tavan kapasiteyi ~%3 düşürür (Banister 1997 süperkompansasyon penceresi).',
  },
  warningSigns: {
    // v9.41.0 — Plain-English appositives for medical Latin so post-race
    // athletes (likely tired, low-EQ on jargon) catch the safety triggers.
    en: 'Warning signs needing medical review (do NOT train through): tea-colored or dark-cola urine (rhabdomyolysis — muscle protein leaking into blood, kidney risk), persistent dizziness or fainting, severe localized pain (stress fracture or compartment syndrome — swelling trapped inside a muscle group), no urination 4+ h post-race despite drinking, fever 24-72h post-race (immune dip + infection — viral myocarditis risk if you train through).',
    tr: 'Tıbbi inceleme gerektiren uyarı işaretleri (antrenmanla GEÇİŞTİRME): çay rengi veya koyu kola idrar (rabdomyoliz — kasın kan akımına protein bırakması, böbrek riski), kalıcı baş dönmesi veya bayılma, şiddetli lokal ağrı (stres kırığı veya kompartman sendromu — kası saran zarın içinde sıkışmış şişlik), içmesine rağmen yarıştan 4+ sa sonra idrar yok, yarıştan 24-72 sa sonra ateş (immün düşüş + enfeksiyon — antrenman sürdürülürse viral miyokardit riski).',
  },
}

// v9.16.0 — Event-distance tier classifier. Closes audit P0 finding: prior
// race-day protocol applied identical pre-race meal + warmup + pacing logic
// regardless of event duration. Real coaches differentiate sprint (<10k run /
// <40km bike / <800m swim / <2k row) vs short (10k-half / 40-90km / 800-1500m
// / 2-5k row) vs mid (half-mara / 90-180km / 1500-3000m / 5-10k row) vs long
// (mara+ / 180km+ / 3km+ / >10k or 8k+).
//
// Per Stellingwerf 2018, Burke 2017, McCormick 2018, Friel 2014.
function classifyDistanceTier(sport, distanceM) {
  const m = Number(distanceM)
  if (!m || m <= 0) return null
  if (sport === 'run' || sport === 'triathlon') {
    if (m < 10000)  return 'sprint'   // 5k or shorter
    if (m < 15000)  return 'short'    // 10k bracket
    if (m < 30000)  return 'mid'      // half-marathon (21097m)
    return 'long'                     // marathon and beyond
  }
  if (sport === 'bike') {
    if (m < 40000)  return 'sprint'
    if (m < 90000)  return 'short'
    if (m < 180000) return 'mid'
    return 'long'                     // century+ / IM bike
  }
  if (sport === 'swim') {
    if (m < 800)    return 'sprint'
    if (m < 1500)   return 'short'
    if (m < 3000)   return 'mid'
    return 'long'                     // open-water marathon
  }
  if (sport === 'rowing') {
    if (m <= 2000)  return 'sprint'   // 2k standard race distance is short-tier
    if (m < 5000)   return 'short'
    if (m < 10000)  return 'mid'
    return 'long'                     // 10k+ ergathon
  }
  return null
}

// v9.16.0 — Distance-tier overrides applied on top of sport raceDay default.
// Each tier shifts pre-race meal CHO + warmup duration + pacing strategy.
// Stellingwerf 2018 + McCormick 2018 + Reilly 2007 + Burke 2018.
const DISTANCE_TIER_OVERRIDES = {
  sprint: {
    preRaceMealsNote: {
      en: 'Sprint-distance override: lighter, faster meal. CHO 1.0 g/kg, 2h pre-start. No solids <90 min before start. Optional 25g CHO gel 15 min before.',
      tr: 'Sprint mesafe: daha hafif, hızlı yemek. CHO 1,0 g/kg, başlangıçtan 2 sa önce. Başlangıca <90 dk varsa katı gıda yok. Opsiyonel 25g CHO jel 15 dk önce.',
    },
    warmupNote: {
      en: 'Sprint warmup: extend by 10-20% — sprint events demand near-max effort from gun. 5-7 min @ race pace within warmup, ending 5 min before start.',
      tr: 'Sprint ısınma: %10-20 uzat — sprint etkinlikleri başlangıçtan max-yakını efor ister. Isınma içinde 5-7 dk yarış temposunda, başlangıçtan 5 dk önce bitir.',
    },
    pacingNote: {
      en: 'Sprint pacing: NEGATIVE-SPLIT or even split. Hold back first third (5-10s slow per km/per 100m); progressively faster toward finish. Last 25% all-out — sprint reserve must stay until line.',
      tr: 'Sprint tempo: NEGATIF-SPLIT veya eşit. İlk üçte birde tut (km/100m\'de 5-10s yavaş); finişe doğru kademeli hızlan. Son %25 tam-açık — sprint rezervi çizgiye kadar.',
    },
  },
  short: {
    preRaceMealsNote: {
      en: 'Short-distance override (10-15k run / 40-90km bike / 800-1500m swim / 2-5k row): CHO 1.5 g/kg, 2.5h pre-start. Final 25g gel 30 min before. Standard liquid hydration (3-4 ml/kg per 15 min until 30 min pre-start).',
      tr: 'Kısa mesafe (10-15k koşu / 40-90km bisiklet / 800-1500m yüzme / 2-5k kürek): CHO 1,5 g/kg, başlangıçtan 2,5 sa önce. Son 25g jel 30 dk önce. Standart sıvı hidrasyonu (her 15 dk\'da 3-4 ml/kg, başlangıca 30 dk varana dek).',
    },
    warmupNote: {
      en: 'Short warmup: standard 15-20 min sport-default; pre-race-pace strides at end (4x100m strides for run, 3x1min surges for bike). 10k-specific: extend strides to 6 (race demands threshold-pace from gun).',
      tr: 'Kısa ısınma: standart 15-20 dk spor varsayılanı; sonda yarış-tempo adımlar (koşu 4x100m adım, bisiklet 3x1dk atak). 10k için: adımı 6\'ya uzat (yarış pistten itibaren eşik-tempo ister).',
    },
    pacingNote: {
      en: 'Short pacing: EVEN-SPLIT (10k pace ≈ T-pace/threshold). 10k specifically — this IS a threshold race, not a sprint. First 2k 1-2s slow per km, lock goal pace 2-8k, final 2k free if intact. 12-15k: same logic, hold goal slightly longer first half. McCormick 2018: even-split is the most predictable PR strategy here.',
      tr: 'Kısa tempo: EŞİT-SPLIT (10k tempo ≈ T-tempo/eşik). 10k özel — bu BIR EŞİK yarışıdır, sprint değil. İlk 2km km\'de 1-2s yavaş, 2-8km hedef tempo sabit, son 2km sağlamsa serbest. 12-15k: aynı mantık, ilk yarıda hedef tempoyu biraz daha uzun tut. McCormick 2018: eşit-split bu mesafede en güvenilir PR stratejisidir.',
    },
  },
  mid: {
    preRaceMealsNote: {
      en: 'Mid-distance override: CHO 2.0 g/kg, 3h pre-start. Top-up 25-30g CHO 30-45 min before. Carb-load Day -2/-1 critical (10-12 g/kg/d).',
      tr: 'Orta mesafe: CHO 2,0 g/kg, başlangıçtan 3 sa önce. 30-45 dk önce 25-30g CHO ile destekle. -2/-1. gün karbonhidrat yükleme kritik (10-12 g/kg/gün).',
    },
    warmupNote: {
      en: 'Mid warmup: shortened — save glycogen. 10-15 min easy + 2-3 strides only. Don\'t practice race-pace; first 5-10 min of race is your final warmup.',
      tr: 'Orta ısınma: kısaltılmış — glikojen koru. 10-15 dk kolay + sadece 2-3 adım. Yarış tempoyu prova etme; yarışın ilk 5-10 dk\'sı son ısınma görevi görür.',
    },
    pacingNote: {
      en: 'Mid pacing: PATIENCE FIRST HALF, controlled push second half. First half 1-3% slower than goal pace; second half lock goal pace; final 15% open up. The "feel slow" is normal — trust the data, not the feel.',
      tr: 'Orta tempo: İLK YARI SABIRLI, ikinci yarı kontrollü baskı. İlk yarı hedef tempodan %1-3 yavaş; ikinci yarı hedef tempo; son %15 aç. "Yavaş hissetme" normal — hisse değil veriye güven.',
    },
  },
  long: {
    preRaceMealsNote: {
      en: 'Long-distance override: STAGED fed state. Solid CHO 2-2.5 g/kg at 3h pre-start; liquid CHO 30-50g at 90 min pre-start; final gel 25g at 15 min. Total carb-load 36-48h prior 10-12 g/kg/d critical (Bussau 2002).',
      tr: 'Uzun mesafe: AŞAMALI doyma durumu. Katı CHO 2-2,5 g/kg başlangıçtan 3 sa önce; sıvı CHO 30-50g 90 dk önce; son jel 25g 15 dk önce. 36-48 sa önce toplam karbonhidrat yükleme 10-12 g/kg/gün kritik (Bussau 2002).',
    },
    warmupNote: {
      en: 'Long warmup: minimal — 5-10 min walk + 5 min easy jog/spin/glide. Conserve every kJ. The first 30-60 min of race IS your warmup; race start is the slowest segment by design.',
      tr: 'Uzun ısınma: minimal — 5-10 dk yürü + 5 dk kolay jog/dön/kay. Her kJ\'yi koru. Yarışın ilk 30-60 dk\'sı ısınmadır; yarış başı tasarım gereği en yavaş bölümdür.',
    },
    pacingNote: {
      en: 'Long pacing: PRONOUNCED NEGATIVE-SPLIT. First 25% should feel ABSURDLY easy (3-5% slower than goal). Lock goal pace 25-50%. Push 50-75%. Free 75-100% if intact. The marathon "wall" hits at km 30-35 — discipline now buys finish-line speed.',
      tr: 'Uzun tempo: BELIRGIN NEGATIF-SPLIT. İlk %25 ABSÜRT-kolay hissetmeli (hedeften %3-5 yavaş). %25-50 hedef tempo sabit. %50-75 baskı. %75-100 sağlamsa serbest. Maraton "duvar" 30-35. km\'de — şimdi disiplin finiş çizgisi hızı satın alır.',
    },
  },
}

// v9.16.0 — Race-delayed contingency. Stellingwerf 2018: meal timing shifts
// ±2h with race postponement; nervous system leaves no room to re-fuel if
// start moves. Universal across all distances/sports.
const RACE_DELAYED_CONTINGENCY = {
  en: 'Race delayed >1h on race morning: every 60 min of delay, take 25-30g CHO + 200ml water. If delay >2h: small banana or 30g rice cake plus 25g gel. Avoid fat/fiber. Re-warmup 15 min before NEW start time.',
  tr: 'Yarış sabahı >1 sa gecikme: her 60 dk gecikme için 25-30g CHO + 200ml su. Gecikme >2 sa: küçük muz veya 30g pirinç kek artı 25g jel. Yağ/lif kaçın. YENİ başlangıçtan 15 dk önce yeniden ısın.',
}

// v9.16.0 — Bonk-wall mid-race contingency. Burke 2017 + endurance nutrition:
// glycogen depletion wall hits marathon runners at ~km 30-35, swim/bike at
// 85-90% of race. The cause is fueling, not fitness — the script reframes
// the failure to action, preventing DNF spirals.
const BONK_WALL_CONTINGENCY = {
  en: 'WALL CONTINGENCY: if pace collapses suddenly mid-race (sudden -10s/km drift, vision narrowing, leg seize) — slow 20-30s, drink 200ml sports drink + take 25g gel NOW, walk 60s if needed. Reset to 15s slower than goal pace. Wall is fueling, not fitness — the next 5-10 min recover.',
  tr: 'DUVAR KONTENJANSI: yarış ortasında tempo aniden çökerse (ani -10s/km kayma, görüşün daralması, bacak takılması) — 20-30s yavaşla, 200ml spor içeceği iç + 25g jel HEMEN al, gerekirse 60s yürü. Hedef tempodan 15s yavaşa sıfırla. Duvar yakıt, fitness değil — sonraki 5-10 dk toparlanırsın.',
}

// v9.17.0 — Pre-race anxiety / stress reframe. Crum 2017: stress reactivity
// reframed as performance fuel ("stress is enhancing"). Beedie 2007: placebo/
// reframe response is real and large. Reduces pre-start panic without
// requiring beta-blocker meds. Universal across distances.
const PRE_RACE_ANXIETY_REFRAME = {
  en: 'PRE-RACE ANXIETY REFRAME: pre-start jitter, racing heart, butterflies are NOT the enemy — they are your body preparing for peak effort. Say aloud: "I am energized, not nervous. This feeling means I\'m ready." Take 4 slow breaths (4-7-8 box). Anxiety = fuel, not threat (Crum 2017).',
  tr: 'YARIŞ-ÖNCESİ ANKSİYETE YENİDEN ÇERÇEVELEME: başlangıç-öncesi titrek, hızlı kalp, kelebek hissi düşmanın DEĞİL — vücudun zirve eforuna hazırlanıyor. Sesli söyle: "Enerjiklenmişim, gergin değilim. Bu his hazır olduğum anlamına gelir." 4 yavaş nefes al (4-7-8 kutu). Anksiyete = yakıt, tehdit değil (Crum 2017).',
}

// v9.17.0 — Motor imagery / movement priming (Brown 2017). 3-5 min mental
// rehearsal of one perfect movement before warmup primes muscle memory and
// raises motor cortex excitability. Universal: works for run/bike/swim/row.
const MOTOR_IMAGERY = {
  en: 'MOTOR IMAGERY (3-5 min before warmup): lie or sit eyes closed. Mentally rehearse ONE perfect movement (one stride / one pedal stroke / one arm cycle / one drive) in vivid detail — feel the footfall rhythm, the smooth pull, the catch timing. Repeat 10 times. Then walk it once physically. Brown 2017: motor cortex excitability rises measurably. Improves first-km execution.',
  tr: 'MOTOR İMGELEM (ısınmadan 3-5 dk önce): gözler kapalı yat veya otur. TEK kusursuz hareketi (bir adım / bir pedal vuruşu / bir kol çevrimi / bir çekiş) zihninde canlı detayla prova et — ayak vuruş ritmini, yumuşak çekişi, yakalama zamanlamasını hisset. 10 kez tekrarla. Sonra fiziksel olarak bir kez yürü. Brown 2017: motor korteks uyarılabilirliği ölçülebilir yükselir. İlk-km icrasını iyileştirir.',
}

// v9.17.0 — Caffeine cohort safety flags. Burke 2008 + Spriet 2014 cite the
// 3-6 mg/kg dose-response, but never warn caffeine-naïve athletes or
// anxiety-prone cohorts. This block enforces test-in-training protocol +
// reduces dose for caffeine-naïve / high-anxiety / sleep-poor cohorts.
// v9.18.0 — Caffeine naïve cap fix. Prior version specified "200 mg ONLY"
// for caffeine-naïve athletes, which is 43-186% above the safe naïve dose
// per Spriet 2014 + Burke 2008 (1-2 mg/kg max for first exposure). For a
// 70 kg athlete that's 70-140 mg, NOT 200. The old cap risked GI distress,
// jitter, and headache in untrained users — corrected to 1-2 mg/kg.
const CAFFEINE_SAFETY_FLAGS = {
  en: 'CAFFEINE SAFETY (read before dosing): (1) NEVER first-time caffeine on race day — must be tested in 2+ training sessions at race-equivalent dose. (2) Caffeine-naïve (no daily coffee for 30+ days)? Cap first dose at 1-2 mg/kg ONLY (≈70-140 mg for 70 kg athlete; do not exceed 3 mg/kg even after a few exposures). (3) High anxiety history? Cut to 3 mg/kg or skip entirely. (4) Sleep <6h previous night? Skip — caffeine on cortisol spike worsens jitter. (5) Combine with practiced gel format only — caffeine + novel gel = GI distress. (6) Never exceed 6 mg/kg — diminishing returns + GI/jitter risk.',
  tr: 'KAFEİN GÜVENLİK (dozlamadan önce oku): (1) Yarış gününde İLK KEZ kafein ASLA — yarış-eşdeğer dozda 2+ antrenmanda test edilmeli. (2) Kafein-naif (30+ gündür günlük kahve yok)? İlk doz 1-2 mg/kg ile sınırla (70 kg sporcu için ≈70-140 mg; birkaç deneyimden sonra bile 3 mg/kg\'ı geçme). (3) Yüksek anksiyete geçmişi? 3 mg/kg\'a düşür veya tamamen atla. (4) Önceki gece <6sa uyku? Atla — kortizol piki üzerine kafein titreği kötüleştirir. (5) Sadece denenmiş jel formatı ile kombine — kafein + yeni jel = GI sıkıntısı. (6) 6 mg/kg\'ı asla geçme — azalan getiri + GI/titrek riski.',
}

// v9.43.0 — Same content, structured as a 6-rule checklist (preface + rules
// array). UI renders one bullet per rule with the dose math bolded. The
// flat blob above is preserved for back-compat with existing tests + JSON
// consumers — derived from the rules in a future ship if helpful.
const CAFFEINE_SAFETY_RULES = {
  preface: {
    en: '☕ Read before dosing on race morning:',
    tr: '☕ Yarış sabahı dozlamadan önce oku:',
  },
  rules: {
    en: [
      'NEVER first-time caffeine on race day — must be tested in 2+ training sessions at race-equivalent dose.',
      'Caffeine-naïve (no daily coffee for 30+ days)? Cap first dose at 1–2 mg/kg ONLY (≈70–140 mg for 70 kg). Do not exceed 3 mg/kg even after a few exposures.',
      'High anxiety history? Cut to 3 mg/kg or skip entirely.',
      'Slept <6 h last night? Skip — caffeine on top of a cortisol spike worsens jitter, not focus.',
      'Combine only with a gel format you have tested — caffeine + novel gel = GI distress.',
      'Never exceed 6 mg/kg — diminishing returns + GI/jitter risk.',
    ],
    tr: [
      'Yarış gününde İLK KEZ kafein ASLA — yarış-eşdeğer dozda 2+ antrenmanda test edilmeli.',
      'Kafein-naif (30+ gündür günlük kahve yok)? İlk doz 1–2 mg/kg ile sınırla (70 kg için ≈70–140 mg). Birkaç deneyimden sonra bile 3 mg/kg\'ı geçme.',
      'Yüksek anksiyete geçmişi? 3 mg/kg\'a düşür veya tamamen atla.',
      'Önceki gece <6 sa uyku? Atla — kortizol piki üzerine kafein titreği kötüleştirir, odağı değil.',
      'Sadece denenmiş bir jel formatı ile kombine — kafein + yeni jel = GI sıkıntısı.',
      '6 mg/kg\'ı asla geçme — azalan getiri + GI/titrek riski.',
    ],
  },
}

// v9.17.0 — Morning RHR / HRV readiness check. Itterum 2009 / Plews &
// Buchheit 2017: resting HR > +8-10 bpm above 7-day baseline = autonomic
// fatigue or sub-clinical illness signal. Provides concrete decision tree
// rather than vague "trust how you feel." Race-morning version.
const MORNING_READINESS_CHECK = {
  en: 'RACE-MORNING READINESS CHECK (do this in bed before standing): take resting HR for 60s. Compare to 7-day baseline. (a) Within ±5 bpm: full race plan. (b) +8-10 bpm: hold back first 5-10% of race intensity, expect 2-3% slower PR. (c) +10-15 bpm with sore throat / fever / fatigue: serious — consider holding back significantly or DNS. (d) >+15 bpm: DNS likely correct call (illness; race not worth chronic-fatigue cost). HRV (if tracked): >7% drop sustained = match the +10 bpm protocol.',
  tr: 'YARIŞ-SABAHI HAZIRLIK KONTROLÜ (kalkmadan yatakta yap): 60s dinlenme HR ölç. 7-günlük baz ile karşılaştır. (a) ±5 bpm içinde: tam yarış planı. (b) +8-10 bpm: yarış şiddetinin ilk %5-10\'unda tut, %2-3 yavaş PR bekle. (c) +10-15 bpm ile boğaz ağrısı / ateş / yorgunluk: ciddi — büyük ölçüde tut veya DNS düşün. (d) >+15 bpm: muhtemelen DNS doğru karar (hastalık; yarış kronik-yorgunluk maliyetine değmez). HRV (takip ediliyorsa): >%7 düşüş sürerse +10 bpm protokolü ile aynı.',
}

/**
 * @public
 * @param {{
 *   sport: 'run'|'bike'|'swim'|'triathlon'|'rowing',
 *   timeZoneShiftHrs?: number,
 *   raceAltitudeM?: number,
 *   raceHeatC?: number,
 *   raceDistanceM?: number,
 * }} input
 * @returns {RaceWeekProtocol}
 */
export function buildRaceWeekProtocol(input) {
  const sport = input?.sport
  // v9.30.0 — triathlon was previously falling through to RUN protocol.
  // Now selects sport-specific TRIATHLON_SCHEDULE + RACE_DAY_TRIATHLON
  // with brick rehearsal, T1/T2 layout, and post-swim refuel window.
  const schedule =
    sport === 'bike'      ? BIKE_SCHEDULE :
    sport === 'swim'      ? SWIM_SCHEDULE :
    sport === 'rowing'    ? ROWING_SCHEDULE :
    sport === 'triathlon' ? TRIATHLON_SCHEDULE :
    RUN_SCHEDULE
  const baseRaceDay =
    sport === 'bike'      ? RACE_DAY_BIKE :
    sport === 'swim'      ? RACE_DAY_SWIM :
    sport === 'rowing'    ? RACE_DAY_ROWING :
    sport === 'triathlon' ? RACE_DAY_TRIATHLON :
    RACE_DAY_RUN

  // v9.16.0 — distance-tier overrides + universal contingencies
  // v9.17.0 — universal mental + caffeine + readiness blocks
  const distanceTier = classifyDistanceTier(sport, input?.raceDistanceM)
  const tierOverride = distanceTier ? DISTANCE_TIER_OVERRIDES[distanceTier] : null
  const raceDay = {
    ...baseRaceDay,
    ...(distanceTier ? { distanceTier } : {}),
    ...(tierOverride ? {
      preRaceMealsTierNote: tierOverride.preRaceMealsNote,
      warmupTierNote: tierOverride.warmupNote,
      pacingTierNote: tierOverride.pacingNote,
    } : {}),
    raceDelayedContingency: RACE_DELAYED_CONTINGENCY,
    bonkWallContingency: BONK_WALL_CONTINGENCY,
    preRaceAnxietyReframe: PRE_RACE_ANXIETY_REFRAME,
    motorImagery: MOTOR_IMAGERY,
    caffeineSafetyFlags: CAFFEINE_SAFETY_FLAGS,
    caffeineSafetyRules: CAFFEINE_SAFETY_RULES,
    morningReadinessCheck: MORNING_READINESS_CHECK,
    // v9.33.0 — universal post-race recovery first 48h protocol.
    // Sport-invariant; surfaces in raceDay output for inline render.
    postRaceRecovery48h: POST_RACE_RECOVERY_48H,
    // v9.35.0 — DNF triage decision tree (when to STOP, when to adjust).
    dnfTriageDecisionTree: DNF_TRIAGE_DECISION_TREE,
    // v9.38.0 — structured buckets so the UI can render each severity tier
    // as its own color-coded callout (red/orange/blue) instead of a wall.
    dnfTriageBuckets: DNF_TRIAGE_BUCKETS,
    // v9.35.0 — Last 3 nights specific sleep hygiene (caffeine cutoff,
    // melatonin gating, bedroom environment, wake-time anchoring).
    last3NightsSleepHygiene: LAST_3_NIGHTS_SLEEP_HYGIENE,
  }

  // v9.8.0 — conditional advisories
  const travel    = buildTravelProtocol(input?.timeZoneShiftHrs)
  const altitude  = buildAltitudeProtocol(input?.raceAltitudeM)
  const heat      = buildHeatProtocol(input?.raceHeatC)
  // v9.31.0 — cold-weather race protocol; activates when raceTempC<5°C.
  const cold      = buildColdProtocol(input?.raceTempC)
  const out = {
    schedule,
    raceDay,
    citation: 'Mujika 2003; Bosquet et al. 2007; Stellingwerf 2018; Burke 2017; Zurawlew 2016 (heat); Tipton 2017 + Castellani 2006 (cold); Wilber 2007 (altitude); McCormick 2018 (pacing); Crum 2017 (anxiety reframe); Brown 2017 (motor imagery); Plews & Buchheit 2017 (HRV); Burke 2008 + Spriet 2014 (caffeine)',
  }
  if (travel)   out.travel = travel
  if (altitude) out.altitude = altitude
  if (heat)     out.heat = heat
  if (cold)     out.cold = cold
  return out
}

export { classifyDistanceTier }

export const RACE_WEEK_CITATION = 'Mujika 2003; Bosquet et al. 2007; Stellingwerf 2018; Burke 2017; McCormick 2018; Bussau 2002; Crum 2017; Brown 2017; Burke 2008; Spriet 2014; Plews & Buchheit 2017'
