// src/lib/athlete/raceStrategy.js
//
// v9.172.0 (EP-12) — Race-type + pack-strategy guidance.
//
// `buildEliteProgram` knows the distance and the sport but treats every
// race as a generic "go fast for X km". Real race day is shaped by the
// FORMAT (track / road / trail / ultra / time-trial / crit / sprint
// triathlon / Ironman / head-race) and by whether it is a mass-start
// pack race or a solo effort.
//
// This module emits race-day pacing, fueling cadence, gear notes, pack
// tactics, opener / closer guidance, and warnings per race format.
// Pure function — no I/O, no React.
//
// Citations:
//   Foster C., Snyder A.C., Welsh R. 1999. Monitoring of training,
//     warm up, and performance in athletes. Sports Med 27(3):195-203.
//   Coggan A.R., Allen H. 2010. Training and Racing with a Power Meter.
//   Skiba P.F. 2014. The Critical Power Manual.
//   Maughan R.J., Shirreffs S.M. 2010. Dehydration and rehydration in
//     competitive sport. Scand J Med Sci Sports 20 Suppl 3:40-7.
//   Jeukendrup A.E. 2014. A step towards personalized sports nutrition:
//     carbohydrate intake during exercise. Sports Med 44 Suppl 1:S25-33.
//   ITU coaching framework (triathlon).
//   British Rowing race-tactics curriculum (2k + head race).

export const RACE_STRATEGY_CITATION = 'Foster 1999; Coggan & Allen 2010; Skiba 2014; Maughan 2010; Jeukendrup 2014; ITU; British Rowing'

const RACE_TYPES = {
  run:      ['track', 'road', 'trail', 'ultra', 'xc'],
  bike:     ['road', 'tt', 'crit', 'gran-fondo', 'mtb'],
  swim:     ['pool', 'open-water'],
  triathlon:['sprint', 'olympic', '70.3', 'ironman'],
  rowing:   ['2k', 'head-race'],
}

// Pack races (mass start, drafting / positioning matters)
const PACK_RACES = new Set([
  'run:road', 'run:trail', 'run:ultra', 'run:xc',
  'bike:road', 'bike:crit', 'bike:gran-fondo', 'bike:mtb',
  'swim:open-water',
  'triathlon:sprint', 'triathlon:olympic', 'triathlon:70.3', 'triathlon:ironman',
  'rowing:head-race',
])

const RUN_STRATEGIES = {
  track: {
    pacing: { en: 'Even or slight negative split. Lap-by-lap pace consistency is everything — drift past 1-2s/lap and the bell-lap finish disappears.', tr: 'Eşit veya hafif negatif split. Tur-tur tempo tutarlılığı esastır — 1-2sn/tur sapma son turu götürür.' },
    opener: { en: 'First 200m at race pace, settle in second 200m. Do NOT chase early break-aways unless they are at your pace.', tr: 'İlk 200m yarış tempo, ikinci 200m\'de yerleş. Erken kaçışları kendi tempondaysa kovala — değilse boşver.' },
    closer: { en: 'Bell-lap kick from 300m out. Track training has prepared you for the lactate punch — trust it.', tr: 'Son tur 300m kala kalkış. Pist antrenmanı laktat şokuna hazırladı — güven.' },
    fueling: { en: 'No on-course fuel. Pre-race carb load 1-2 g/kg 2h prior.', tr: 'Pist içi yakıt yok. Yarış öncesi 2sa karbonhidrat 1-2 g/kg.' },
    gear: { en: 'Spike type: middle-distance (4-6 pins) for 800-5000m, sprint spikes (8 pins) only for 1500m down.', tr: 'Çivi tipi: orta mesafe için (4-6 çivi), sprint çivileri sadece 1500m ve altı.' },
  },
  road: {
    pacing: { en: 'Even pace or negative split. Marathon = sub-LT effort (HR ~88-92% threshold); 10K = LT effort; 5K = above LT.', tr: 'Eşit tempo veya negatif split. Maraton = LT-altı (HR ~%88-92 eşik); 10K = LT; 5K = LT üstü.' },
    opener: { en: 'First 1K at goal pace MINUS 5-10s. Adrenaline always pushes pace early — discipline saves the second half.', tr: 'İlk 1K hedef tempodan 5-10sn yavaş. Adrenalin tempoyu erken iter — disiplin ikinci yarıyı kurtarır.' },
    closer: { en: 'Last 5K (marathon) or last 1K (5K-HM): if HR has stayed in zone, accelerate to race-pace + 5%.', tr: 'Son 5K (maraton) veya son 1K (5K-HM): HR bölgede kaldıysa yarış-tempo + %5\'e hızlan.' },
    fueling: { en: '5K-10K: water only. HM: 30-40 g CHO at km 10. Marathon: 60-90 g CHO/h, alternating gels + electrolytes.', tr: '5K-10K: sadece su. HM: km 10\'da 30-40 g CHO. Maraton: 60-90 g CHO/sa, jel + elektrolit dönüşümlü.' },
    gear: { en: 'Carbon-plate racers for road; well-tested, not new. Calf compression optional, never new on race day.', tr: 'Karbon-plakalı yarış ayakkabısı; iyi test edilmiş, yeni değil. İsteğe bağlı baldır sıkıştırma, asla yarış günü yeni değil.' },
  },
  trail: {
    pacing: { en: 'Effort-based, not pace-based. Hike steep climbs (>10%) — running uphill burns 2-3× the energy of hiking. Run flats + downhills.', tr: 'Tempo değil, efor odaklı. Dik yokuşlarda (>%10) yürü — yokuş yukarı koşmak yürüyüşün 2-3 katı enerji yakar. Düz + iniş koş.' },
    opener: { en: 'First 30 min at conversational pace. Position before first technical section but DO NOT race for it.', tr: 'İlk 30 dk sohbet tempo. İlk teknik bölüm öncesi pozisyon al ama yarışma.' },
    closer: { en: 'Save legs for last technical descent — quad fatigue + dehydration is the #1 DNF cause. Run by feel.', tr: 'Bacakları son teknik inişe sakla — kuadriseps yorgunluğu + dehidrasyon DNF\'in 1 numaralı sebebi. His ile koş.' },
    fueling: { en: 'Solid food OK on long trail (peanut butter, banana). 60-90 g CHO/h. Salt tabs 1/h if hot.', tr: 'Uzun patikada katı yiyecek tamam (fıstık ezmesi, muz). 60-90 g CHO/sa. Sıcaksa saatte 1 tuz tableti.' },
    gear: { en: 'Trail shoes with 4-6mm lugs. Hydration vest with 1.5L + 2 soft flasks. Headlamp if start before sunrise.', tr: 'Patika ayakkabısı 4-6mm dişli. 1.5L + 2 yumuşak şişeli hidrasyon yeleği. Gün doğumu öncesi başlarsa kafa lambası.' },
  },
  ultra: {
    pacing: { en: '"Walk early, run late." Aim for negative split — front 50% should feel embarrassingly easy.', tr: '"Erken yürü, geç koş." Negatif split hedefle — ilk %50 utanç verici kadar kolay olmalı.' },
    opener: { en: 'First quarter at 60-70% of perceived race pace. Heart rate cap = aerobic threshold (lactate < 2 mmol).', tr: 'İlk çeyrek algılanan yarış temposunun %60-70\'i. HR sınırı = aerobik eşik (laktat < 2 mmol).' },
    closer: { en: 'Final 25%: drop pace 5-10% to compensate for cumulative fatigue, not to "race."', tr: 'Son %25: birikmiş yorgunluğu telafi için tempoyu %5-10 düşür, "yarışmak" için değil.' },
    fueling: { en: '60-90 g CHO/h consistently from km 5. Solid food at aid stations (pierogi, broth, potato). Sodium 500-700 mg/h.', tr: 'km 5\'ten itibaren tutarlı 60-90 g CHO/sa. Yardım istasyonunda katı (pierogi, çorba, patates). Sodyum 500-700 mg/sa.' },
    gear: { en: 'Worn-in trail shoes, drop bags every 25-50km with fresh socks/lube/food.', tr: 'Yıpranmış patika ayakkabısı, her 25-50km\'de bırakma çantası (yedek çorap/krem/yiyecek).' },
  },
  xc: {
    pacing: { en: 'Hard start to establish position before first bottleneck (woods entry / hill). Then even effort by terrain.', tr: 'İlk darboğaz öncesi (orman girişi / yokuş) pozisyon almak için sert başlangıç. Sonra arazi ile eşit efor.' },
    opener: { en: 'Sprint first 200-400m to clear the line. The race for top 20 is usually decided in the first km.', tr: 'Çizgiyi temizlemek için ilk 200-400m sprint. İlk 20 yarışı genellikle ilk km\'de belirlenir.' },
    closer: { en: 'Reel in 1 person at a time from 500m out. Surge on flat ground; recover on small inclines.', tr: '500m kala teker teker yakala. Düzlükte hücum; küçük yokuşlarda toparlan.' },
    fueling: { en: 'No fuel during race (typically <30 min for college XC). Pre-race carbs 1-2h prior.', tr: 'Yarış sırasında yakıt yok (kolej XC genelde <30 dk). Yarış öncesi 1-2sa karbonhidrat.' },
    gear: { en: 'XC spikes (6-9mm pins, depending on grass/mud), thin gloves if cold, racing flats only if course is firm.', tr: 'XC çivileri (çim/çamura göre 6-9mm), soğuksa ince eldiven, sadece sert parkurda yarış flatı.' },
  },
}

const BIKE_STRATEGIES = {
  road: {
    pacing: { en: 'Effort by terrain, not by pace. Save matches for: KOM climbs, breakaway bridges, sprint. Goal: stay top 15 wheels.', tr: 'Tempo değil, arazi-bazlı efor. Kibritleri şuraya sakla: KOM tırmanışları, kaçış köprüleri, sprint. Hedef: top 15 tekerlek içinde kal.' },
    opener: { en: 'First 30 min at endurance effort. Race rarely won in km 0-10 — sit in, observe, conserve.', tr: 'İlk 30 dk dayanıklılık eforu. Yarış nadiren km 0-10\'da kazanılır — otur, gözle, biriktir.' },
    closer: { en: 'Move to top 10 wheels 5K before sprint. Open sprint from 200m, not 400m (most amateurs go too early).', tr: 'Sprint 5K öncesi top 10 tekerleğe çık. Sprinti 200m\'den aç, 400m\'den değil (çoğu amatör çok erken açar).' },
    fueling: { en: '60-90 g CHO/h. Bottles every 20 min minimum. Solid food first 2h only (gels later — easier to digest).', tr: '60-90 g CHO/sa. En az her 20 dk şişe. Katı yiyecek sadece ilk 2sa (sonra jel — sindirimi kolay).' },
    gear: { en: 'Race wheels (≥50mm depth if not crosswind > 30 km/h), race tires, latex tubes, helmet straps tight.', tr: 'Yarış jantı (yan rüzgar < 30 km/sa ise ≥50mm derinlik), yarış lastiği, lateks iç lastik, kask kayışları sıkı.' },
  },
  tt: {
    pacing: { en: 'Even power. Target: 95-100% FTP for 40K TT; 100-105% FTP for 10-mile TT. Pacing is everything — no surges.', tr: 'Eşit güç. Hedef: 40K TT için %95-100 FTP; 10-mil TT için %100-105 FTP. Tempolama her şey — hücum yok.' },
    opener: { en: 'Ramp to target power in first 60-90 seconds. Going out 10% over target costs 20% extra time at the back.', tr: 'İlk 60-90 saniyede hedef güce çık. Hedefin %10 üstüne çıkmak sonda %20 ekstra zamana mal olur.' },
    closer: { en: 'Increase power 3-5% in final 5 min. Pace cleanly through the turn-back (TT-specific bottleneck).', tr: 'Son 5 dk\'da gücü %3-5 arttır. TT\'ye özgü darboğazı (dönüş noktası) temiz geç.' },
    fueling: { en: '20-40 g CHO bottle for sub-1h TT; for 40K+ add gel at midpoint. Sip every 5 min, do NOT chug.', tr: '1sa altı TT için 20-40 g CHO şişesi; 40K+ için orta noktada jel ekle. Her 5 dk yudum al, GÜRT etme.' },
    gear: { en: 'TT bike with disc rear + deep front (≥80mm). Skin suit. Aero helmet. Time-trial overshoes.', tr: 'TT bisikleti, arka disk + ön derin (≥80mm). Kayak takım. Aero kask. TT botları.' },
  },
  crit: {
    pacing: { en: 'High-variability. Surge out of every corner; recover on straights. Field-sit in middle third for safety.', tr: 'Yüksek değişkenlik. Her virajdan çıkışta hücum; düzlükte toparlan. Güvenlik için ortadaki üçte birde otur.' },
    opener: { en: 'Sprint hard for first corner — back of pack is where crashes happen. Goal: top 20 wheels by lap 3.', tr: 'İlk viraj için sert sprint — kazalar arkada olur. Hedef: tur 3 itibarıyla top 20 tekerlek.' },
    closer: { en: 'Last 5 laps: protect wheel of strong sprinter. Last lap: take inside line through final corner, sprint from 150m.', tr: 'Son 5 tur: güçlü sprinterin arkasını koru. Son tur: son virajdan iç hat, 150m\'den sprint.' },
    fueling: { en: 'Single bottle (or none for <30 min crits). Pre-race coffee + carbs. Energy mainly anaerobic — fuel matters less.', tr: 'Tek şişe (30 dk altı kritlerde belki hiç). Yarış öncesi kahve + karbonhidrat. Enerji anaerobik — yakıt daha az önemli.' },
    gear: { en: 'Reliable race wheels (NOT super-deep — crosswind risk in tight corners). Crit-specific stiff frame. Helmet light not needed.', tr: 'Güvenilir yarış jantı (süper derin DEĞİL — dar virajda yan rüzgar riski). Krite özgü sert kadro. Kask ışığı gerekmez.' },
  },
  'gran-fondo': {
    pacing: { en: 'Even endurance pace 65-75% FTP for first 2h. Crank to 80% on KOM climbs. Avoid hero efforts km 0-50.', tr: 'İlk 2sa eşit dayanıklılık tempo %65-75 FTP. KOM tırmanışlarında %80\'e çık. Km 0-50\'de kahramanlık eforları yok.' },
    opener: { en: 'First 30 min at Z2 endurance. Settle into a group at your pace; drafting saves 25% of power.', tr: 'İlk 30 dk Z2 dayanıklılık. Kendi tempondaki bir grupta yerleş; çekme %25 güç tasarrufu sağlar.' },
    closer: { en: 'Final climb: drop to Z3-Z4 if energy systems still firing. Otherwise hold endurance pace.', tr: 'Son tırmanış: enerji sistemleri ateşliyorsa Z3-Z4\'e in. Aksi takdirde dayanıklılık tempoyu koru.' },
    fueling: { en: '60-80 g CHO/h consistently from km 30. Solid food (energy bars) early, gels later. Salt 500 mg/h if hot.', tr: 'Km 30\'dan itibaren tutarlı 60-80 g CHO/sa. Erken katı (enerji barı), sonra jel. Sıcaksa 500 mg/sa tuz.' },
    gear: { en: 'Endurance setup: 25-28mm tires, comfortable saddle. Hydration: 2 bottles + aid station stops every 50km.', tr: 'Dayanıklılık kurulumu: 25-28mm lastik, rahat sele. Hidrasyon: 2 şişe + her 50km\'de yardım istasyonu.' },
  },
  mtb: {
    pacing: { en: 'Effort by trail feature: anaerobic on tech sections, recovery on flow. Cadence drops in chunk — accept it.', tr: 'Patika özelliğine göre efor: teknik bölümlerde anaerobik, akıcı yerlerde toparlanma. Engebede kadans düşer — kabul et.' },
    opener: { en: 'Quick start to clear single-track entry. Sit-skill is fine on mass-start fire roads; tech section needs leg power.', tr: 'Tek-iz girişini temizlemek için hızlı başlangıç. Mass-start toprak yolda otur-yetenek tamam; teknik bölüm bacak gücü ister.' },
    closer: { en: 'Hard final descent: focus on line, not power. A crash in last 3km is far more costly than 30s gained pedaling.', tr: 'Sert son iniş: güç değil, hat odaklı. Son 3km\'de düşmek 30sn kazançtan çok daha pahalıdır.' },
    fueling: { en: 'Soft flask in jersey + bottle. Gel every 30 min. Tech sections may not allow drinking — pre-load before them.', tr: 'Forma cebinde yumuşak şişe + şişe. Her 30 dk jel. Teknik bölümler içmeye izin vermeyebilir — öncesinde yükle.' },
    gear: { en: 'Tubeless tires with sealant; check pressure morning of (24-28 PSI front / 26-30 rear typical). Spare tube + CO2.', tr: 'Sızdırmaz tubeless lastik; yarış sabahı basınç kontrol (genelde 24-28 PSI ön / 26-30 arka). Yedek iç lastik + CO2.' },
  },
}

const SWIM_STRATEGIES = {
  pool: {
    pacing: { en: 'Distance-specific split: 100 free = even or negative; 400 = descending 100s; 1500 = even at CSS pace.', tr: 'Mesafeye özgü split: 100 serbest = eşit veya negatif; 400 = azalan 100\'ler; 1500 = CSS\'de eşit.' },
    opener: { en: 'Reactive start (don\'t over-jump the buzzer). First lap controlled — stroke rate above target risks early lactate.', tr: 'Reaktif başlangıç (buzzer\'ı aşma). İlk tur kontrollü — vuruş oranı hedefin üstü erken laktat riski.' },
    closer: { en: 'Final 100 or final 50: increase stroke rate by 2-3 spm. Hold technique — DPS (distance per stroke) drops late.', tr: 'Son 100 veya son 50: vuruş oranını 2-3 spm arttır. Tekniği koru — DPS (vuruş başına mesafe) sonda düşer.' },
    fueling: { en: 'Pool meets are short — pre-race carbs 2h prior + electrolyte sip between heats. No on-course fueling.', tr: 'Havuz yarışları kısa — yarış öncesi 2sa karbonhidrat + heat\'ler arası elektrolit yudum. Yarış içi yakıt yok.' },
    gear: { en: 'Racing suit (jammers / kneeskin), goggles tested in warm-up, cap. Backup goggles in bag.', tr: 'Yarış mayosu (jammer / kneeskin), ısınmada test edilen gözlük, bone. Çantada yedek gözlük.' },
  },
  'open-water': {
    pacing: { en: 'CSS-based effort but expect 5-10% slower than pool due to chop, sighting, drafting. Even pace beats surge.', tr: 'CSS-bazlı efor ama dalga, sighting, çekme nedeniyle havuzdan %5-10 yavaş bekle. Eşit tempo hücumdan iyi.' },
    opener: { en: 'Sprint first 200m to break clear of crowd, then settle. Sighting every 6-8 strokes.', tr: 'Kalabalığı temizlemek için ilk 200m sprint, sonra yerleş. Her 6-8 vuruşta sighting.' },
    closer: { en: 'Final 200m: increase kick to wake up legs for the run-out (or T1 in triathlon).', tr: 'Son 200m: çıkışa (veya triatlon T1\'e) bacakları uyandırmak için tekmeyi arttır.' },
    fueling: { en: 'No on-course feeding. Pre-race carb 2h + caffeine 30 min prior. Race usually < 30 min for 1500m mark.', tr: 'Yarış içi yakıt yok. Yarış öncesi 2sa karbonhidrat + 30 dk önce kafein. 1500m yarış genelde < 30 dk.' },
    gear: { en: 'Wetsuit if water < 22 °C (legal under FINA). Anti-fog goggle treatment. Body Glide on neck/underarms.', tr: 'Su < 22 °C ise mayo (FINA yasal). Anti-fog gözlük. Boyun/koltuk altına Body Glide.' },
  },
}

const TRI_STRATEGIES = {
  sprint: {
    pacing: { en: 'Front-load swim (max-effort 750m), hammer the bike (95% FTP), all-out run (Z5-equivalent for 5K).', tr: 'Yüzmeyi öne yükle (maks 750m), bisikleti çakallıkla sür (%95 FTP), koşuyu sonuna kadar (5K için Z5-eşdeğeri).' },
    opener: { en: 'Swim start = sprint to clear water. T1 < 90s. Bike opener: 5 min at 90% FTP to clear traffic.', tr: 'Yüzme başı = suyu temizlemek için sprint. T1 < 90sn. Bisiklet açılışı: trafiği temizlemek için 5 dk %90 FTP.' },
    closer: { en: 'Final 1K run: empty the tank. Sprint races are decided by who manages the last km.', tr: 'Son 1K koşu: depoyu boşalt. Sprint yarışları son km\'yi yönetenle belirlenir.' },
    fueling: { en: '40-50 g CHO on bike (one bottle). Gel at T2 if HR > 175. Total race < 90 min.', tr: 'Bisiklette 40-50 g CHO (tek şişe). HR > 175 ise T2\'de jel. Toplam yarış < 90 dk.' },
    gear: { en: 'Wetsuit if legal. Race-day TT bike. Bike-mounted shoes (T1 saves 30s+). Visor cap for run.', tr: 'Yasalsa mayo. Yarış günü TT bisikleti. Bisiklete monte ayakkabı (T1\'de 30sn+ kazandırır). Koşuda vizör.' },
  },
  olympic: {
    pacing: { en: 'Even effort across legs. Swim at CSS, bike at 90% FTP, run at LT pace. Olympic-distance is even, not front-loaded.', tr: 'Etaplar arası eşit efor. Yüzme CSS, bisiklet %90 FTP, koşu LT tempo. Olimpik mesafe eşit, öne yüklü değil.' },
    opener: { en: 'Swim out hard (200m), settle to CSS. T1 < 2 min. Bike opener at endurance, ramp by min 5.', tr: 'Yüzme sert çık (200m), CSS\'e yerleş. T1 < 2 dk. Bisiklet açılış dayanıklılık, dk 5\'te yüksel.' },
    closer: { en: 'Final 2K run: target negative-split. If HR holds in zone, kick to Z5 from km 8.', tr: 'Son 2K koşu: negatif-split hedefle. HR bölgede tutuyorsa km 8\'den Z5\'e kalk.' },
    fueling: { en: '60-90 g CHO/h on bike. Gel + water at T2. Salt tab 1/h if temp > 25 °C.', tr: 'Bisiklette 60-90 g CHO/sa. T2\'de jel + su. Sıcaklık > 25 °C ise saatte 1 tuz tableti.' },
    gear: { en: 'Same as sprint but: full bottle cage system on bike, run-cooling sponges grabbed at aid stations.', tr: 'Sprint ile aynı ama: bisiklette tam şişe kafes sistemi, yardım istasyonunda koşu-soğutma süngerleri.' },
  },
  '70.3': {
    pacing: { en: 'Under-bike to over-run. Bike at 80-83% FTP (Coggan IF target 0.80). Run starts conservative — pace blows you up.', tr: 'Bisikleti kontrollü, koşuyu sert. Bisiklet %80-83 FTP (Coggan IF hedef 0.80). Koşu muhafazakar başlar — tempo seni patlatır.' },
    opener: { en: 'Swim moderate, T1 controlled (2 min OK). Bike first 30 min at endurance — settling matters more than positioning.', tr: 'Yüzme orta, T1 kontrollü (2 dk tamam). Bisiklet ilk 30 dk dayanıklılık — yerleşmek pozisyondan önemli.' },
    closer: { en: 'Run: first 10K at Z2-Z3, second 11K at Z3-Z4. Negative split is the day-saver.', tr: 'Koşu: ilk 10K Z2-Z3, ikinci 11K Z3-Z4. Negatif split günü kurtarır.' },
    fueling: { en: '90 g CHO/h on bike (4 gels + 2 bottles). Run: 1 gel per aid station + water. Sodium 700-1000 mg/h.', tr: 'Bisiklette 90 g CHO/sa (4 jel + 2 şişe). Koşu: yardım istasyonunda jel + su. Sodyum 700-1000 mg/sa.' },
    gear: { en: 'TT bike for ≥20 km/h flat course; road bike OK for hilly. Bento box for bike fuel. Run belt with 4 gel pockets.', tr: 'Düz parkurda ≥20 km/sa için TT bisikleti; engebeli için yol bisikleti tamam. Bisiklet yakıtı için bento. 4 jel cebi koşu kemeri.' },
  },
  ironman: {
    pacing: { en: '"You cannot win Ironman in the first 4 hours, but you can lose it." Bike at 70-75% FTP (IF 0.70-0.75). Run by HR cap.', tr: '"Ironman\'i ilk 4 saatte kazanamazsın ama kaybedebilirsin." Bisiklet %70-75 FTP (IF 0.70-0.75). Koşu HR sınırı ile.' },
    opener: { en: 'Swim at training pace (you have 14h+ ahead). Bike first hour at IF 0.65, ramp through hour 2.', tr: 'Yüzme antrenman tempo (önünde 14sa+ var). Bisiklet ilk saat IF 0.65, saat 2\'de yüksel.' },
    closer: { en: 'Run: walk aid stations from km 20 (saves more time over IM than it costs). Final 5K = decide based on HR.', tr: 'Koşu: km 20\'den itibaren yardım istasyonlarında yürü (IM\'de kaybettirdiğinden çok kazandırır). Son 5K = HR\'ye göre karar.' },
    fueling: { en: '90-120 g CHO/h on bike (mostly bottles + bento bars). Run: every aid station = walk + drink + gel. Salt 1000 mg/h.', tr: 'Bisiklette 90-120 g CHO/sa (çoğunlukla şişe + bento bar). Koşu: her yardım istasyonu = yürü + iç + jel. Tuz 1000 mg/sa.' },
    gear: { en: 'Tested TT setup. Cooling sleeves for hot races. Special-needs bag pre-packed with backup gels + nausea-tested snack.', tr: 'Test edilmiş TT kurulumu. Sıcak yarışlar için soğutma kolları. Yedek jel + bulantı-test edilmiş atıştırmalık dolu özel-ihtiyaç çantası.' },
  },
}

const ROWING_STRATEGIES = {
  '2k': {
    pacing: { en: 'Classic 2k split: 500m hard, 500m settle (race split), 500m hold, 500m push. Avg power ~110% FTP.', tr: 'Klasik 2k split: 500m sert, 500m yerleş (yarış split), 500m tut, 500m it. Ort güç ~%110 FTP.' },
    opener: { en: 'High-rate start (36-40 spm for 10 strokes), settle to race-rate by 250m. Mistake: holding 38 spm to 1000m.', tr: 'Yüksek-oran başlangıç (10 vuruş 36-40 spm), 250m\'de yarış-oranına yerleş. Hata: 38 spm\'yi 1000m\'ye tutmak.' },
    closer: { en: 'Last 500m: power-10 every 250m. Rate up 2 spm in final 30 strokes. Empty the tank — recovery hits at 600m.', tr: 'Son 500m: her 250m\'de güç-10. Son 30 vuruşta oran 2 spm yüksek. Depoyu boşalt — toparlanma 600m\'de başlar.' },
    fueling: { en: 'Pre-race carbs 2h prior + caffeine 30 min before. No on-water fuel for 2k (race < 7 min).', tr: 'Yarış öncesi 2sa karbonhidrat + 30 dk önce kafein. 2k için su-üstü yakıt yok (yarış < 7 dk).' },
    gear: { en: 'Race shell (single / double / quad / pair / eight). Heart-rate monitor + SpeedCoach (or Coxbox for eight).', tr: 'Yarış teknesi (tek / çift / dört / pair / sekiz). Nabız + SpeedCoach (sekiz için Coxbox).' },
  },
  'head-race': {
    pacing: { en: 'Even effort throughout 5-7K. NOT a 2k race — settle at AT pace (race-pace + 8-12 sec/500m). Steer cleanly.', tr: '5-7K boyunca eşit efor. 2k yarış DEĞİL — AT tempo (yarış-tempo + 8-12 sn/500m) yerleş. Temiz dümen tut.' },
    opener: { en: 'First 500m at race rate to clear start line, settle to AT pace by 1k. Pass on the outside, not through gaps.', tr: 'Başlangıç çizgisini temizlemek için ilk 500m yarış oranı, 1k\'da AT tempo yerleş. Boşluktan değil, dıştan geç.' },
    closer: { en: 'Last 750m: 5-stroke power-pushes every 250m. Final 250m: race-rate push to the line.', tr: 'Son 750m: her 250m\'de 5-vuruş güç-itim. Son 250m: çizgiye yarış oranı itim.' },
    fueling: { en: 'Pre-race carbs 2h + gel 30 min prior. Mid-race water/gel only if course > 8K and stop is legal.', tr: 'Yarış öncesi 2sa karbonhidrat + 30 dk önce jel. Yarış ortası sadece su/jel parkur > 8K ve yasalsa.' },
    gear: { en: 'Tide-resistant rigging for tidal courses. Heart-rate monitor visible. Course map memorized for blind turns.', tr: 'Gel-git parkurları için gel-git dirençli ayar. Görünür nabız. Kör virajlar için parkur haritası ezbere.' },
  },
}

const STRATEGY_BY_SPORT = {
  run: RUN_STRATEGIES,
  bike: BIKE_STRATEGIES,
  swim: SWIM_STRATEGIES,
  triathlon: TRI_STRATEGIES,
  rowing: ROWING_STRATEGIES,
}

// Pack strategy — used only when race is in PACK_RACES
const PACK_STRATEGY = {
  small:  { en: 'Small pack (<15): rotate pulls; recovery + cooperation > attacks. Defection from a small pack = race-loss.',   tr: 'Küçük peloton (<15): çekiş dön; saldırı yerine toparlanma + işbirliği. Küçük pelotondan ayrılmak = yarış kaybı.' },
  medium: { en: 'Medium pack (15-50): sit in middle third. Wheel choice matters — pick a reliable rider, not the strongest.', tr: 'Orta peloton (15-50): ortadaki üçte birde otur. Tekerlek seçimi önemli — en güçlü değil, güvenilir sürücü seç.' },
  large:  { en: 'Large pack (>50): stay in front quarter — crashes happen in middle/back. Use the wind: leeward side in crosswind.', tr: 'Büyük peloton (>50): ön çeyrekte kal — kazalar ortada/arkada. Rüzgarı kullan: yan rüzgar varsa rüzgar-üstü taraf.' },
  default:{ en: 'Pack tactics: maintain top 30% positioning, conserve early, position before key features (climbs / sprints / aid stations).', tr: 'Peloton taktikleri: top %30\'da pozisyon, erken biriktir, anahtar bölümler (tırmanış / sprint / yardım istasyonu) öncesi pozisyon al.' },
}

function packBucketFor(packSize) {
  if (!Number.isFinite(packSize) || packSize <= 1) return null  // solo
  if (packSize < 15) return 'small'
  if (packSize < 50) return 'medium'
  return 'large'
}

/**
 * Build race-day strategy for a specific sport + race type.
 *
 * @param {{
 *   sport: 'run'|'bike'|'swim'|'triathlon'|'rowing',
 *   raceType: string,
 *   packSize?: number,
 *   distanceM?: number,
 *   conditions?: { tempC?: number, windKph?: number, altitudeM?: number },
 * }} input
 * @returns {{
 *   sport: string,
 *   raceType: string,
 *   isPackRace: boolean,
 *   pacing: { en: string, tr: string },
 *   opener: { en: string, tr: string },
 *   closer: { en: string, tr: string },
 *   fueling: { en: string, tr: string },
 *   gear: { en: string, tr: string },
 *   packStrategy: { en: string, tr: string } | null,
 *   warnings: Array<{ code: string, en: string, tr: string }>,
 *   citation: string,
 *   _rejected?: true,
 *   reason?: string,
 * } | null}
 */
export function buildRaceStrategy(input) {
  if (!input || typeof input !== 'object') return null
  const { sport, raceType, packSize = null, conditions = null } = input
  if (!sport || !STRATEGY_BY_SPORT[sport]) {
    return { _rejected: true, reason: 'invalid-sport' }
  }
  const sportMap = STRATEGY_BY_SPORT[sport]
  if (!raceType || !sportMap[raceType]) {
    return { _rejected: true, reason: 'invalid-race-type', validTypes: RACE_TYPES[sport] }
  }

  const key = `${sport}:${raceType}`
  const isPackRace = PACK_RACES.has(key)
  const strat = sportMap[raceType]

  // Pack strategy lookup — only meaningful for pack races
  let packStrategy = null
  if (isPackRace) {
    const bucket = packBucketFor(packSize)
    packStrategy = bucket ? PACK_STRATEGY[bucket] : PACK_STRATEGY.default
  }

  // Warnings for race conditions
  const warnings = []
  if (conditions && typeof conditions === 'object') {
    if (Number.isFinite(conditions.tempC) && conditions.tempC > 28) {
      warnings.push({
        code: 'heat-warning',
        en: `Race-day temperature ${conditions.tempC}°C — slow pace 3-5% per °C above 25°C; add salt to fueling (Maughan 2010).`,
        tr: `Yarış günü sıcaklık ${conditions.tempC}°C — 25°C üstü her °C için tempo %3-5 yavaşla; yakıta tuz ekle (Maughan 2010).`,
      })
    }
    if (Number.isFinite(conditions.tempC) && conditions.tempC < 5) {
      warnings.push({
        code: 'cold-warning',
        en: `Cold race-day (${conditions.tempC}°C) — extended warm-up + layered clothing; carb metabolism declines in cold.`,
        tr: `Soğuk yarış günü (${conditions.tempC}°C) — uzatılmış ısınma + katmanlı giyim; soğukta karbonhidrat metabolizması düşer.`,
      })
    }
    if (Number.isFinite(conditions.windKph) && conditions.windKph > 25 && (sport === 'bike' || sport === 'triathlon')) {
      warnings.push({
        code: 'crosswind-warning',
        en: `High wind (${conditions.windKph} km/h) — re-consider deep wheels; echelon positioning is critical in pack races.`,
        tr: `Yüksek rüzgar (${conditions.windKph} km/sa) — derin jantları yeniden düşün; pelotonda yan-dizilim pozisyonu kritik.`,
      })
    }
    if (Number.isFinite(conditions.altitudeM) && conditions.altitudeM > 1800) {
      warnings.push({
        code: 'altitude-warning',
        en: `Altitude ${conditions.altitudeM}m — expect 5-10% performance drop above 1800m if unacclimatized. Slow opener by 5%.`,
        tr: `Rakım ${conditions.altitudeM}m — adapte değilsen 1800m üstünde %5-10 performans düşüşü bekle. Açılışı %5 yavaşlat.`,
      })
    }
  }

  return {
    sport,
    raceType,
    isPackRace,
    pacing: strat.pacing,
    opener: strat.opener,
    closer: strat.closer,
    fueling: strat.fueling,
    gear: strat.gear,
    packStrategy,
    warnings,
    citation: RACE_STRATEGY_CITATION,
  }
}

export { RACE_TYPES, PACK_RACES }
