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
      en: tier === 'extreme'
        ? 'Live-high-train-low ideal. Arrive 14-21 days early or use altitude tent 4 weeks prior. Without acclimatization, expect significant DNF risk.'
        : tier === 'high'
          ? 'Arrive 7-14 days early OR <24 h pre-race (avoid the dip 3-5 days post-arrival). 2-3 hypoxic sessions in Build phase recommended.'
          : 'Arrive 4-7 days early. Single hypoxic session (e.g., breath-holding tempo) in Build can help.',
      tr: tier === 'extreme'
        ? 'Yüksek-yaşa-düşük-antrene ideal. 14-21 gün erken var ya da 4 hafta önce rakım çadırı. Adapte olmadan ciddi DNF riski.'
        : tier === 'high'
          ? '7-14 gün erken var YA DA <24 sa yarış-öncesi (varıştan 3-5 gün sonraki düşüşü önle). Build fazında 2-3 hipoksik seans önerilir.'
          : '4-7 gün erken var. Build fazında tek hipoksik seans (ör. nefes-tutma tempo) yardımcı olur.',
    },
    pacing: {
      en: 'Reduce goal pace by 5% at 1500m, 8% at 2000m, 12-15% at 3000m+. Expect higher HR for given pace.',
      tr: '1500m\'de hedef tempoyu %5, 2000m\'de %8, 3000m+\'da %12-15 azalt. Verilen tempoda daha yüksek nabız bekle.',
    },
    fueling: {
      en: 'Increase iron-rich foods 4 weeks pre-race (2x daily red meat or supplement). Hydration needs +30%. Watch for AMS symptoms.',
      tr: 'Yarıştan 4 hafta önce demir-zengin yiyecekleri arttır (günde 2x kırmızı et veya takviye). Hidrasyon ihtiyacı +%30. AMS belirtilerine dikkat.',
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
export function buildRaceWeekProtocol(input) {
  const sport = input?.sport
  const schedule =
    sport === 'bike'   ? BIKE_SCHEDULE :
    sport === 'swim'   ? SWIM_SCHEDULE :
    sport === 'rowing' ? ROWING_SCHEDULE :
    RUN_SCHEDULE
  const raceDay =
    sport === 'bike'   ? RACE_DAY_BIKE :
    sport === 'swim'   ? RACE_DAY_SWIM :
    sport === 'rowing' ? RACE_DAY_ROWING :
    RACE_DAY_RUN
  // v9.8.0 — conditional advisories
  const travel    = buildTravelProtocol(input?.timeZoneShiftHrs)
  const altitude  = buildAltitudeProtocol(input?.raceAltitudeM)
  const heat      = buildHeatProtocol(input?.raceHeatC)
  const out = {
    schedule,
    raceDay,
    citation: 'Mujika 2003; Bosquet et al. 2007; Stellingwerf 2018; Burke 2017; Zurawlew 2016 (heat); Wilber 2007 (altitude)',
  }
  if (travel)   out.travel = travel
  if (altitude) out.altitude = altitude
  if (heat)     out.heat = heat
  return out
}

export const RACE_WEEK_CITATION = 'Mujika 2003; Bosquet et al. 2007; Stellingwerf 2018; Burke 2017'
