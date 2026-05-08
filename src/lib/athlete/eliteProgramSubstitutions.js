// ─── eliteProgramSubstitutions.js — Session substitution map ────────────────
//
// Real athletes miss sessions. This module provides scientifically defensible
// substitutions for: indoor / cross-train / injured / weather / missed-makeup
// scenarios, keyed by session intent. Aim is to preserve training stimulus
// without creating compensatory overload.
//
// Per Mujika 2010 (detraining mitigation), Bompa 2009 (load wave), and Issurin
// 2010 (block periodisation makeup logic).
//
// All bilingual EN+TR. Pure data — no React.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   indoor: Bilingual,
 *   crossTrain: Bilingual,
 *   injured: Bilingual,
 *   weather: Bilingual,
 *   missedMakeup: Bilingual
 * }} SubstitutionSet
 */

const SUBSTITUTIONS_RUN = {
  Easy: {
    indoor: { en: 'Treadmill, 1% incline, same duration at E-pace.', tr: 'Koşubandı, %1 eğim, aynı süre @E-tempo.' },
    crossTrain: { en: 'Bike Z1-Z2 for same duration; HR target unchanged.', tr: 'Aynı süre Z1-Z2 bisiklet; HR hedefi aynı.' },
    injured: { en: 'Pool run (deep-water) for same duration at perceived E effort.', tr: 'Aynı süre derin su koşusu, algılanan E efor.' },
    weather: { en: 'Indoor treadmill or postpone — easy runs are not urgent.', tr: 'Kapalı koşubandı veya ertele — kolay koşular acil değil.' },
    missedMakeup: { en: 'Skip; easy sessions accumulate, do not chase.', tr: 'Atla; kolay seanslar birikir, takip etme.' },
  },
  Tempo: {
    indoor: { en: 'Treadmill, 1% incline, same prescription.', tr: 'Koşubandı, %1 eğim, aynı reçete.' },
    crossTrain: { en: 'Bike: 30-40 min sweet-spot @88-93% FTP for similar TSS.', tr: 'Bisiklet: 30-40 dk sweet-spot @FTP %88-93, benzer TSS.' },
    injured: { en: 'Pool run: 30 min hard intervals at threshold effort.', tr: 'Su koşusu: eşik eforda 30 dk sert interval.' },
    weather: { en: 'Move tempo to next available day; do not skip if Build phase.', tr: 'Tempo seansını sonraki güne taşı; Build fazındaysan atlama.' },
    missedMakeup: { en: 'Combine into next quality day as cruise intervals.', tr: 'Sonraki kalite gününe cruise interval olarak birleştir.' },
  },
  Threshold: {
    indoor: { en: 'Treadmill, 1% incline; cap reps at 6x1km if HR drift severe.', tr: 'Koşubandı, %1 eğim; HR kayması büyükse 6x1km ile sınırla.' },
    crossTrain: { en: 'Bike: 2x20 min @95-100% FTP (closest threshold proxy).', tr: 'Bisiklet: 2x20 dk @FTP %95-100 (en yakın eşik karşılığı).' },
    injured: { en: 'Pool run: 2x20 min hard with 3 min easy between.', tr: 'Su koşusu: 2x20 dk sert, arada 3 dk kolay.' },
    weather: { en: 'Indoor only; threshold cannot be skipped in Build/Peak.', tr: 'Sadece kapalı; Build/Peak\'te eşik atlanmaz.' },
    missedMakeup: { en: 'Within 48 h: shorter version (2x10 min @T). Beyond 48 h: skip and progress next week.', tr: '48 saat içinde: kısa versiyon (2x10 dk @T). Sonrası: atla, gelecek hafta ilerle.' },
  },
  VO2: {
    indoor: { en: 'Treadmill: 5x3 min @I-pace, 3 min jog. Capacity-dependent.', tr: 'Koşubandı: 5x3 dk @I-tempo, 3 dk jog. Kapasiteye bağlı.' },
    crossTrain: { en: 'Bike: 5x4 min @106-120% FTP with 4 min Z1.', tr: 'Bisiklet: 5x4 dk @FTP %106-120, 4 dk Z1.' },
    injured: { en: 'Pool run: 5x3 min all-out + 3 min easy. Reduce to 4 if form breaks.', tr: 'Su koşusu: 5x3 dk sonuna kadar + 3 dk kolay. Form bozulursa 4\'e indir.' },
    weather: { en: 'Indoor only; VO2 sessions are date-anchored in Peak phase.', tr: 'Sadece kapalı; VO2 seansları Peak fazında tarih-bağımlıdır.' },
    missedMakeup: { en: 'Do not chase: drop next easy day to 30 min and run VO2 next session.', tr: 'Takip etme: sonraki kolay günü 30 dk\'ya düşür, VO2\'yu sonraki seansta yap.' },
  },
  Long: {
    indoor: { en: 'Treadmill split: 2x same total at 1% incline. Boring but legal.', tr: 'Koşubandı bölünmüş: aynı toplam 2x %1 eğim. Sıkıcı ama geçerli.' },
    crossTrain: { en: '2-3 h Z2 bike for similar mitochondrial stimulus.', tr: '2-3 sa Z2 bisiklet, benzer mitokondriyal uyarı.' },
    injured: { en: 'Pool run 60-90 min at perceived E effort + bike 60 min Z2.', tr: 'Algılanan E eforda 60-90 dk su koşusu + 60 dk Z2 bisiklet.' },
    weather: { en: 'Reduce to 60 min and split; do not skip the long session entirely.', tr: '60 dk\'ya indir ve böl; uzun seansı tamamen atlama.' },
    missedMakeup: { en: 'Add to next available day, cap at +30% normal long.', tr: 'Sonraki güne ekle, normal uzunun en fazla %30 fazlası.' },
  },
  Race: {
    indoor: { en: 'Race day cannot be moved. Use treadmill only if asthma + cold air.', tr: 'Yarış günü değiştirilemez. Sadece astım + soğuk hava için koşubandı.' },
    crossTrain: { en: 'N/A on race day.', tr: 'Yarış günü için geçerli değil.' },
    injured: { en: 'Pull from race; injury risk far outweighs result.', tr: 'Yarıştan çekil; sakatlık riski sonuçtan çok daha ağır basar.' },
    weather: { en: 'Adjust pacing strategy by 5-10s/km if extreme heat or cold.', tr: 'Aşırı sıcak veya soğukta tempolama 5-10s/km ayarla.' },
    missedMakeup: { en: 'N/A.', tr: 'Geçerli değil.' },
  },
}

const SUBSTITUTIONS_BIKE = {
  Easy: {
    indoor: { en: 'Smart trainer Z1-Z2, same duration.', tr: 'Akıllı trainer Z1-Z2, aynı süre.' },
    crossTrain: { en: 'Easy run for half the duration (eg. 60 min bike → 30 min run).', tr: 'Yarısı süre kolay koşu (örn. 60 dk bisiklet → 30 dk koşu).' },
    injured: { en: 'Aqua jogging 30 min easy.', tr: '30 dk kolay aqua jogging.' },
    weather: { en: 'Indoor smart trainer.', tr: 'Kapalı akıllı trainer.' },
    missedMakeup: { en: 'Skip; recovery rides are recoverable.', tr: 'Atla; toparlanma sürüşleri telafi edilebilir.' },
  },
  Tempo: {
    indoor: { en: 'Smart trainer: 3x15 min @76-85% FTP.', tr: 'Akıllı trainer: 3x15 dk @FTP %76-85.' },
    crossTrain: { en: 'Tempo run 30 min @M-pace if running adapted.', tr: 'Koşu adapteyse @M-tempo 30 dk.' },
    injured: { en: 'Pool run intervals: 4x10 min hard.', tr: 'Su koşusu interval: 4x10 dk sert.' },
    weather: { en: 'Indoor preferred.', tr: 'Kapalı tercih.' },
    missedMakeup: { en: 'Combine into next sweet-spot session.', tr: 'Sonraki sweet-spot seansına birleştir.' },
  },
  Threshold: {
    indoor: { en: 'Smart trainer: 2x20 min @95-100% FTP.', tr: 'Akıllı trainer: 2x20 dk @FTP %95-100.' },
    crossTrain: { en: 'Run threshold 2x20 min @T-pace if adapted.', tr: 'Koşu adapteyse 2x20 dk @T-tempo.' },
    injured: { en: 'Pool run: 2x20 min hard.', tr: 'Su koşusu: 2x20 dk sert.' },
    weather: { en: 'Indoor only.', tr: 'Sadece kapalı.' },
    missedMakeup: { en: '48h: 2x15 min @T. Beyond: skip and progress.', tr: '48 sa: 2x15 dk @T. Sonrası: atla, ilerle.' },
  },
  VO2: {
    indoor: { en: 'Smart trainer: 5x4 min @106-120% FTP.', tr: 'Akıllı trainer: 5x4 dk @FTP %106-120.' },
    crossTrain: { en: 'Run VO2 5x3 min @I-pace if adapted.', tr: 'Koşu adapteyse VO2 5x3 dk @I-tempo.' },
    injured: { en: 'Pool run: 5x3 min hard.', tr: 'Su koşusu: 5x3 dk sert.' },
    weather: { en: 'Indoor only.', tr: 'Sadece kapalı.' },
    missedMakeup: { en: 'Do not chase; do at next quality slot.', tr: 'Takip etme; sonraki kalite slotunda yap.' },
  },
  Long: {
    indoor: { en: 'Smart trainer: split 2x60 min Z2 with 5 min easy break.', tr: 'Akıllı trainer: 2x60 dk Z2, arada 5 dk kolay.' },
    crossTrain: { en: 'Long run for 60% of bike time at E-pace.', tr: 'Bisiklet süresinin %60\'ı kadar uzun koşu @E-tempo.' },
    injured: { en: 'Aqua jog 90 min + 30 min easy bike if available.', tr: 'Mümkünse 90 dk aqua jog + 30 dk kolay bisiklet.' },
    weather: { en: 'Indoor split into 2-3 blocks.', tr: 'Kapalı, 2-3 bloğa böl.' },
    missedMakeup: { en: 'Carry to next available weekend.', tr: 'Sonraki müsait hafta sonuna taşı.' },
  },
  Race: {
    indoor: { en: 'N/A.', tr: 'Geçerli değil.' },
    crossTrain: { en: 'N/A.', tr: 'Geçerli değil.' },
    injured: { en: 'Pull from race.', tr: 'Yarıştan çekil.' },
    weather: { en: 'Use rain tires; warm-up extended.', tr: 'Yağmur lastikleri; ısınmayı uzat.' },
    missedMakeup: { en: 'N/A.', tr: 'Geçerli değil.' },
  },
}

const SUBSTITUTIONS_SWIM = {
  Easy: {
    indoor: { en: 'Pool same prescription.', tr: 'Havuzda aynı reçete.' },
    crossTrain: { en: '30-45 min easy bike Z1-Z2.', tr: '30-45 dk kolay bisiklet Z1-Z2.' },
    injured: { en: 'Skip; swim is the lowest-impact option already.', tr: 'Atla; yüzme zaten en düşük etkili seçenek.' },
    weather: { en: 'Indoor pool only.', tr: 'Sadece kapalı havuz.' },
    missedMakeup: { en: 'Skip.', tr: 'Atla.' },
  },
  CSS: {
    indoor: { en: 'Pool: 8x100m @CSS, same prescription.', tr: 'Havuz: 8x100m @CSS, aynı reçete.' },
    crossTrain: { en: 'No direct swap — CSS is swim-specific.', tr: 'Doğrudan değiş yok — CSS yüzmeye özgü.' },
    injured: { en: 'Pull set with paddles only (legs taped or injured leg).', tr: 'Sadece paletli çekiş (bacaklar bantlı veya sakat bacak).' },
    weather: { en: 'Pool only.', tr: 'Sadece havuz.' },
    missedMakeup: { en: 'Combine into next CSS set.', tr: 'Sonraki CSS setine birleştir.' },
  },
  Race: {
    indoor: { en: 'N/A.', tr: 'Geçerli değil.' },
    crossTrain: { en: 'N/A.', tr: 'Geçerli değil.' },
    injured: { en: 'Pull from race.', tr: 'Yarıştan çekil.' },
    weather: { en: 'Open-water: account for current/temperature.', tr: 'Açık su: akıntı/sıcaklığı hesaba kat.' },
    missedMakeup: { en: 'N/A.', tr: 'Geçerli değil.' },
  },
}

// v9.7.0 — Rowing substitutions: erg ↔ on-water, weather, injury alternates.
const SUBSTITUTIONS_ROWING = {
  Easy: {
    indoor: { en: 'Concept2 erg same UT2 prescription.', tr: 'Concept2 erg aynı UT2 reçetesi.' },
    crossTrain: { en: '45-60 min easy bike Z1-Z2 (preserves leg drive).', tr: '45-60 dk kolay bisiklet Z1-Z2 (bacak gücünü korur).' },
    injured: { en: 'Back/shoulder injury: pool aqua-jog 30-45 min.', tr: 'Sırt/omuz sakatlığı: havuzda aqua-jog 30-45 dk.' },
    weather: { en: 'Wind/cold/storm: switch to erg same prescription.', tr: 'Rüzgar/soğuk/fırtına: erge aynı reçete ile geç.' },
    missedMakeup: { en: 'Skip; UT2 volume builds slowly.', tr: 'Atla; UT2 hacmi yavaş kurulur.' },
  },
  Threshold: {
    indoor: { en: 'Erg: 4-5x2000m at AT split, same prescription.', tr: 'Erg: 4-5x2000m AT splitte, aynı reçete.' },
    crossTrain: { en: 'No direct swap — AT pieces require rowing-specific muscle recruitment.', tr: 'Doğrudan değiş yok — AT parçaları küreğe özgü kas grubu gerektirir.' },
    injured: { en: 'Lower-back tweak: cycle 60min Z3-Z4 (sweet-spot) instead.', tr: 'Bel ağrısı: bunun yerine 60dk Z3-Z4 bisiklet (sweet-spot).' },
    weather: { en: 'On water unsafe: erg with mirror for posture check.', tr: 'Su güvensiz: erg, postür kontrolü için ayna.' },
    missedMakeup: { en: 'Combine into next AT session at 80% intensity.', tr: 'Sonraki AT seansına %80 şiddette birleştir.' },
  },
  RacePace: {
    indoor: { en: 'Erg: 8x500m at 2k pace.', tr: 'Erg: 8x500m 2k tempo.' },
    crossTrain: { en: 'No swap — race-pace work is rowing-specific.', tr: 'Değiş yok — yarış-tempo küreğe özgü.' },
    injured: { en: 'Skip — quality cannot be replicated.', tr: 'Atla — kalite taklit edilemez.' },
    weather: { en: 'Erg only when on-water unsafe.', tr: 'Su güvensizse sadece erg.' },
    missedMakeup: { en: 'Reschedule within 48h or skip.', tr: '48 saat içinde yeniden planla veya atla.' },
  },
  Race: {
    indoor: { en: 'Indoor 2k erg race if outdoor cancelled.', tr: 'Dış mekan iptal olursa kapalı 2k erg yarışı.' },
    crossTrain: { en: 'N/A.', tr: 'Geçerli değil.' },
    injured: { en: 'Pull from race; recovery > result.', tr: 'Yarıştan çekil; toparlanma > sonuç.' },
    weather: { en: 'Strong wind/wave: erg backup; head-wind reduces splits 5-10 sec/500m.', tr: 'Şiddetli rüzgar/dalga: erg yedek; baş rüzgar splitleri 5-10 sn/500m yavaşlatır.' },
    missedMakeup: { en: 'N/A.', tr: 'Geçerli değil.' },
  },
}

/**
 * @public
 * @param {{ sport: 'run'|'bike'|'swim'|'triathlon'|'rowing' }} input
 * @returns {Record<string, SubstitutionSet>}
 */
export function buildSubstitutionMap(input) {
  const sport = input?.sport
  if (sport === 'bike')   return SUBSTITUTIONS_BIKE
  if (sport === 'swim')   return SUBSTITUTIONS_SWIM
  if (sport === 'rowing') return SUBSTITUTIONS_ROWING
  return SUBSTITUTIONS_RUN
}

/** @public Triathlon: returns all 3 maps. */
export function buildTriathlonSubstitutionMap() {
  return { run: SUBSTITUTIONS_RUN, bike: SUBSTITUTIONS_BIKE, swim: SUBSTITUTIONS_SWIM }
}

export const SUBSTITUTIONS_CITATION = 'Mujika 2010; Bompa 2009; Issurin 2010'
