// ─── scienceNotes.js — Triggered science facts (bilingual) ───────────────────
// Each note: { id, trigger(log, recovery, profile) → bool, en, tr, source }
// Used by Dashboard "DID YOU KNOW?" widget.

export const SCIENCE_NOTES = [
  // ── Load & Adaptation ────────────────────────────────────────────────────────
  {
    id: 'polarized_80_20',
    trigger: () => true,
    en: 'Elite endurance athletes train ~80% easy and ~20% hard. This "polarized" model outperforms threshold-heavy plans for long-term development.',
    tr: 'Elit dayanıklılık sporcuları zamanlarının ~%80\'ini kolay, ~%20\'sini zorlu antrenman yaparak geçirir. Bu "polarize" model uzun vadede eşik ağırlıklı planları geride bırakır.',
    source: 'Seiler & Tønnessen (2009), IJSPP'
  },
  {
    id: 'acwr_sweet_spot',
    trigger: (log) => log.length >= 10,
    en: 'Keeping your ACWR between 0.8 and 1.3 cuts injury risk by 50% compared to ratios above 1.5.',
    tr: 'ACWR\'ını 0.8–1.3 arasında tutmak, 1.5 üzerindeki orana kıyasla yaralanma riskini %50 düşürür.',
    source: 'Hulin et al. (2016), BJSM'
  },
  {
    id: 'ctl_decay',
    trigger: (log) => log.length >= 20,
    en: 'CTL (Fitness) decays with a 42-day half-life. Two weeks of full rest costs ~25% of your fitness base.',
    tr: 'KTY (Kondisyon) 42 günlük yarı ömrüyle azalır. İki haftalık tam dinlenme kondisyon tabanının ~%25\'ini kaybettirir.',
    source: 'Banister et al. (1975), Impulse-Response Model'
  },
  {
    id: 'supercompensation',
    trigger: () => true,
    en: 'Fitness gains don\'t happen during training — they happen in the 24–72h recovery window after. Sleep is when adaptation is locked in.',
    tr: 'Kondisyon kazanımları antrenman sırasında değil, sonrasındaki 24–72 saatlik toparlanma penceresinde gerçekleşir. Adaptasyon, uyku sırasında pekişir.',
    source: 'Bompa & Haff (2009), Periodization'
  },
  {
    id: 'deload_performance',
    trigger: (log) => log.length >= 14,
    en: 'A planned 20–30% deload week every 3–4 weeks increases performance by allowing full super-compensation before the next loading block.',
    tr: 'Her 3–4 haftada bir planlanan %20–30\'luk boşaltma haftası, bir sonraki yükleme bloğu öncesinde tam süper kompanzasyona izin vererek performansı artırır.',
    source: 'Issurin (2010), Block Periodization'
  },
  {
    id: 'two_a_day',
    trigger: (log) => log.some(e => e.duration && e.duration >= 120),
    en: 'Two-a-day training triggers double glycogen depletion-replenishment cycles, accelerating mitochondrial biogenesis vs single daily sessions.',
    tr: 'Günde iki antrenman, tek günlük seansa kıyasla çift glikojen tükenme-yenileme döngüsü tetikler ve mitokondriyal biyogenezi hızlandırır.',
    source: 'Hansen et al. (2005), J Appl Physiol'
  },
  // ── Zone & Intensity ─────────────────────────────────────────────────────────
  {
    id: 'z2_mitochondria',
    trigger: () => true,
    en: 'Zone 2 training — sustained effort at ~60–70% HRmax — is the most powerful stimulus for mitochondrial density, the foundation of endurance.',
    tr: 'Zon 2 antrenmanı — %60–70 maks. KA\'da sürekli efor — dayanıklılığın temeli olan mitokondri yoğunluğu için en güçlü uyarımdır.',
    source: 'Iaia & Bangsbo (2010), Scand J Med Sci Sports'
  },
  {
    id: 'threshold_lactate',
    trigger: () => true,
    en: 'Lactate threshold marks the highest intensity where lactate production and clearance balance. Training just below it raises the threshold, delaying fatigue at race pace.',
    tr: 'Laktat eşiği, laktat üretimi ve temizlenmesinin dengelendiği en yüksek yoğunluğu işaret eder. Hemen altında yapılan antrenman eşiği yükseltir ve yarış temposunda yorulmayı geciktirir.',
    source: 'Jones (2006), J Sports Sci'
  },
  {
    id: 'hiit_vo2max',
    trigger: (log) => log.some(e => (e.rpe || 0) >= 8),
    en: 'HIIT (≥8 RPE intervals) is the fastest route to raising VO₂max — but needs 48h recovery between sessions to avoid overreaching.',
    tr: 'HIIT (≥8 ZY aralıklar) VO₂maks\'ı artırmanın en hızlı yoludur; ancak aşırı yorgunluğu önlemek için seanslar arasında 48 saat toparlanma gerektirir.',
    source: 'Laursen & Jenkins (2002), Sports Med'
  },
  {
    id: 'grey_zone_problem',
    trigger: (log, _, p) => {
      const recent = log.filter(e => { const d = new Date(); d.setDate(d.getDate()-28); return e.date >= d.toISOString().slice(0,10) })
      const z3 = recent.filter(e => (e.rpe||0) >= 6 && (e.rpe||0) <= 7).length
      return z3 / (recent.length || 1) > 0.3
    },
    en: 'The "grey zone" (RPE 6–7, moderate intensity) accumulates fatigue without eliciting the adaptations of either easy base work or hard intervals.',
    tr: '"Gri zon" (ZY 6–7, orta yoğunluk) hem kolay baz çalışması hem de zorlu aralıkların adaptasyonlarını tetiklemeden yorgunluk biriktirir.',
    source: 'Seiler (2010), Int J Sports Physiol Perform'
  },
  // ── Recovery & Sleep ─────────────────────────────────────────────────────────
  {
    id: 'sleep_performance',
    trigger: (_, rec) => rec.length >= 3,
    en: 'Sleep extension to 10h/night improved sprint speed by 5% and reaction time by 12% in collegiate athletes (Mah et al.).',
    tr: 'Gecelik 10 saatlik uyku uzatması, üniversite sporcularında sprint hızını %5, reaksiyon süresini %12 iyileştirdi (Mah ve ark.).',
    source: 'Mah et al. (2011), Sleep'
  },
  {
    id: 'hrv_training',
    trigger: (_, rec) => rec.length >= 7,
    en: 'HRV-guided training (easy on low-HRV days) produces 7–14% greater performance gains than fixed periodization plans.',
    tr: 'KDV (HRV) rehberli antrenman (düşük KDV günleri kolay), sabit periyodizasyon planlarına göre %7–14 daha fazla performans kazanımı sağlar.',
    source: 'Kiviniemi et al. (2007), IJSPP'
  },
  {
    id: 'napping',
    trigger: () => true,
    en: 'A 20–30 min post-lunch nap improves alertness for 2–3h. For athletes training twice daily, it is a low-cost performance enhancer.',
    tr: 'Öğlen sonrası 20–30 dakikalık kısa uyku 2–3 saat uyanıklığı artırır. Günde iki antrenman yapan sporcular için düşük maliyetli performans artırıcıdır.',
    source: 'Dutheil et al. (2021), Int J Environ Res Public Health'
  },
  {
    id: 'ice_bath_caution',
    trigger: () => true,
    en: 'Cold water immersion speeds subjective recovery but may blunt strength adaptations if used after resistance training. Reserve for competition blocks.',
    tr: 'Soğuk su daldırması öznel toparlanmayı hızlandırır ancak direnç antrenmanı sonrası uygulanırsa güç adaptasyonlarını köreltilebilir. Müsabaka bloklarına sakla.',
    source: 'Roberts et al. (2015), J Physiol'
  },
  {
    id: 'massage_recovery',
    trigger: () => true,
    en: 'Sports massage reduces DOMS (delayed onset muscle soreness) by 30% and cortisol by 25% — not a luxury, a training tool.',
    tr: 'Spor masajı DOMS\'u (gecikmeli kas ağrısı) %30, kortizolü %25 azaltır — lüks değil, bir antrenman aracı.',
    source: 'Weerapong et al. (2005), Sports Med'
  },
  // ── Physiology ────────────────────────────────────────────────────────────────
  {
    id: 'vo2max_trainability',
    trigger: () => true,
    en: 'VO₂max is ~50% genetic and ~50% trainable. The trainable portion responds most in the first 2–3 years of structured endurance training.',
    tr: 'VO₂maks %50 genetik, %50 antrenmanla kazanılabilir. Kazanılabilir bölüm en çok yapılandırılmış dayanıklılık antrenmanının ilk 2–3 yılında yanıt verir.',
    source: 'Bouchard et al. (1999), J Appl Physiol'
  },
  {
    id: 'cardiac_remodeling',
    trigger: (log) => log.length >= 30,
    en: 'Chronic endurance training causes cardiac remodeling — increased left-ventricular volume — giving you more stroke volume per beat. This takes 6–24 months.',
    tr: 'Kronik dayanıklılık antrenmanı kardiyak yeniden şekillenmeye neden olur — sol ventrikül hacmi artar — her atımda daha fazla atım hacmi sağlar. Bu 6–24 ay alır.',
    source: 'Morganroth et al. (1975), Ann Intern Med'
  },
  {
    id: 'fat_oxidation',
    trigger: () => true,
    en: 'Trained athletes oxidize fat at intensities where untrained people rely on carbs. This "metabolic flexibility" delays the wall in long events.',
    tr: 'Antrenman yapmış sporcular, eğitimsiz kişilerin karbonhidrat kullandığı yoğunluklarda yağ yakar. Bu "metabolik esneklik" uzun yarışlarda duvarı geciktirir.',
    source: 'Volek et al. (2016), Metabolism'
  },
  {
    id: 'capillary_density',
    trigger: (log) => log.filter(e => e.date >= (() => { const d = new Date(); d.setDate(d.getDate()-90); return d.toISOString().slice(0,10) })()).length >= 20,
    en: 'Sustained Z1/Z2 training increases capillary density in muscle by up to 40%, improving oxygen delivery without extra cardiac stress.',
    tr: 'Sürdürülen Z1/Z2 antrenmanı, ekstra kalp stresi olmaksızın oksijen iletimini iyileştirerek kas kılcal damar yoğunluğunu %40\'a kadar artırır.',
    source: 'Andersen & Henriksson (1977), J Physiol'
  },
  // ── Nutrition & Fueling ───────────────────────────────────────────────────────
  {
    id: 'carb_timing',
    trigger: () => true,
    en: 'Consuming 30–75g of carbohydrate per hour during exercise >90 min maintains performance. Mouth-rinsing with carb solution helps even in shorter sessions.',
    tr: '90 dakikadan uzun egzersizde saatte 30–75g karbonhidrat tüketimi performansı korur. Daha kısa seanslarla bile karbonhidratlı solüsyonla ağız çalkalamak yardımcı olur.',
    source: 'Jeukendrup (2011), Nutrition Reviews'
  },
  {
    id: 'protein_synthesis',
    trigger: () => true,
    en: 'Muscle protein synthesis peaks 30–120 min post-exercise. 20–40g of high-quality protein in this window maximises adaptation.',
    tr: 'Kas protein sentezi egzersizden 30–120 dakika sonra zirveye ulaşır. Bu pencerede 20–40g yüksek kaliteli protein adaptasyonu maksimize eder.',
    source: 'Schoenfeld & Aragon (2018), JISSN'
  },
  {
    id: 'glycogen_restore',
    trigger: () => true,
    en: 'Full glycogen restoration after a depleting session takes 20–24 hours with optimal carbohydrate intake (~8–10g/kg/day).',
    tr: 'Tüketici bir seans sonrası tam glikojen restorasyonu optimal karbonhidrat alımıyla (~8–10g/kg/gün) 20–24 saat alır.',
    source: 'Burke et al. (2011), J Sports Sci'
  },
  {
    id: 'caffeine_boost',
    trigger: () => true,
    en: 'Caffeine (3–6 mg/kg) taken 60 min before exercise improves endurance performance by 2–4%. It delays perceived fatigue and improves fat mobilisation.',
    tr: 'Egzersizden 60 dakika önce alınan kafein (3–6 mg/kg) dayanıklılık performansını %2–4 artırır. Algılanan yorgunluğu geciktirir ve yağ mobilizasyonunu geliştirir.',
    source: 'Doherty & Smith (2005), J Sports Sci'
  },
  {
    id: 'iron_endurance',
    trigger: () => true,
    en: 'Iron deficiency without anemia reduces VO₂max and endurance performance. Runners lose iron through foot-strike hemolysis — monitor ferritin levels.',
    tr: 'Anemi olmaksızın demir eksikliği VO₂maks\'ı ve dayanıklılık performansını düşürür. Koşucular topuk darbesiyle hemoliz yoluyla demir kaybeder — ferritin düzeylerini izle.',
    source: 'Hinton (2014), Nutrients'
  },
  // ── Mental & Motivation ───────────────────────────────────────────────────────
  {
    id: 'attentional_focus',
    trigger: () => true,
    en: 'During races, elite athletes use an "associative" strategy (monitoring body signals) while novices dissociate. Training yourself to associate improves pacing.',
    tr: 'Yarışlar sırasında elit sporcular "birleştirici" strateji kullanır (vücut sinyallerini izler), acemiler ayrıştırır. Birleştirici olmayı öğrenmek tempo kontrolünü geliştirir.',
    source: 'Morgan & Pollock (1977), Ann NY Acad Sci'
  },
  {
    id: 'self_talk',
    trigger: () => true,
    en: 'Motivational self-talk during hard efforts reduces perceived effort by up to 18% and delays time to exhaustion by up to 18%.',
    tr: 'Zorlu eforlarda motivasyonel iç konuşma algılanan çabayı %18\'e kadar azaltır ve tükenme zamanını %18\'e kadar geciktirir.',
    source: 'Blanchfield et al. (2014), Med Sci Sports Exerc'
  },
  {
    id: 'consistency_beats_intensity',
    trigger: (log) => log.length >= 5,
    en: 'Consistent training over months and years outperforms sporadic high-intensity blocks. The champion\'s advantage is turning up every day.',
    tr: 'Aylarca ve yıllarca süren tutarlı antrenman, aralıklı yüksek yoğunluklu blokları geride bırakır. Şampiyonun avantajı her gün sahaya çıkmaktır.',
    source: 'Ericsson et al. (1993), Psychol Rev'
  },
  {
    id: 'visualisation',
    trigger: () => true,
    en: 'Mental rehearsal (visualisation) activates the same motor cortex pathways as physical practice. Top athletes spend 5–10 min/day on it.',
    tr: 'Zihinsel prova (görselleştirme), fiziksel pratikle aynı motor korteks yollarını aktive eder. En iyi sporcular buna günde 5–10 dakika harcıyor.',
    source: 'Guillot & Collet (2008), J Sports Sci'
  },
  // ── Biomechanics & Technique ─────────────────────────────────────────────────
  {
    id: 'running_cadence',
    trigger: (log, _, p) => (p?.primarySport || p?.sport || '').toLowerCase().includes('run'),
    en: 'Running cadence of 170–180 spm reduces impact forces and overstriding, lowering injury risk. Increase yours by 5% at a time.',
    tr: 'Dakikada 170–180 adım koşu kadansı darbe kuvvetlerini ve aşırı adım atmayı azaltır, yaralanma riskini düşürür. Kadansını her seferinde %5 artır.',
    source: 'Heiderscheit et al. (2011), Med Sci Sports Exerc'
  },
  {
    id: 'swim_efficiency',
    trigger: (log, _, p) => (p?.primarySport || p?.sport || '').toLowerCase().includes('swim'),
    en: 'In swimming, DPS (distance per stroke) matters more than stroke rate for efficiency. Drills before fast sets lock in technique under fatigue.',
    tr: 'Yüzmede, verimlilik için vuruş hızından çok DPS (vuruş başına mesafe) önemlidir. Hızlı setlerden önce yapılan driller yorgunluk altında tekniği pekiştirir.',
    source: 'Costill et al. (1985), Med Sci Sports Exerc'
  },
  {
    id: 'cycling_position',
    trigger: (log, _, p) => ['cycling', 'triathlon'].includes((p?.primarySport || p?.sport || '').toLowerCase()),
    en: 'A 5° change in saddle height alters power output and knee joint loading significantly. Professional bike fit returns more watts than most upgrades.',
    tr: 'Sele yüksekliğinde 5° değişiklik güç çıkışını ve diz eklem yükünü önemli ölçüde değiştirir. Profesyonel bisiklet fit, çoğu yükseltmeden daha fazla watt kazandırır.',
    source: 'Too (1990), Ergonomics'
  },
  // ── Environmental & Practical ─────────────────────────────────────────────────
  {
    id: 'heat_acclimatization',
    trigger: () => true,
    en: 'Heat acclimatization (10–14 days of exercise in heat) expands plasma volume by ~10%, reducing race-day HR and improving performance in all conditions.',
    tr: 'Isı aklimatizasyonu (sıcakta 10–14 gün egzersiz) plazma hacmini ~%10 genişletir, yarış günü KA\'yı düşürür ve tüm koşullarda performansı artırır.',
    source: 'Lorenzo et al. (2010), J Appl Physiol'
  },
  {
    id: 'altitude_training',
    trigger: () => true,
    en: 'Live High, Train Low altitude protocols increase EPO and RBC, delivering gains of 1–3% in sea-level endurance performance within 2–4 weeks.',
    tr: 'Yüksekte yaşa, Alçakta antrenman yap protokolleri EPO ve alyuvarı artırarak 2–4 hafta içinde deniz seviyesi dayanıklılık performansında %1–3 kazanım sağlar.',
    source: 'Levine & Stray-Gundersen (1997), J Appl Physiol'
  },
  {
    id: 'dehydration_performance',
    trigger: (_, rec) => rec.length >= 2,
    en: 'Even 2% body mass loss from sweat degrades endurance performance by up to 10%. Drink before you feel thirsty.',
    tr: 'Ter yoluyla %2 vücut kütlesi kaybı bile dayanıklılık performansını %10\'a kadar düşürür. Sussamadan önce iç.',
    source: 'Cheuvront & Haymes (2001), Int J Sport Nutr Exerc Metab'
  },
  {
    id: 'overtraining_cortisol',
    trigger: (log) => log.filter(e => { const d = new Date(); d.setDate(d.getDate()-14); return e.date >= d.toISOString().slice(0,10) }).length > 12,
    en: 'Overtraining syndrome elevates basal cortisol and suppresses testosterone. Early signs: performance plateau, mood decline, persistent fatigue.',
    tr: 'Aşırı antrenman sendromu bazal kortizolü yükseltir ve testosteronu baskılar. Erken belirtiler: performans platoya girmesi, ruh hali düşüşü, kalıcı yorgunluk.',
    source: 'Kreher & Schwartz (2012), Sports Health'
  },
  {
    id: 'periodization_phases',
    trigger: () => true,
    en: 'Structured periodization (Base → Build → Peak → Race → Recovery) consistently outperforms random training by 5–12% in controlled trials.',
    tr: 'Yapılandırılmış periyodizasyon (Baz → Geliştirme → Doruk → Yarış → Toparlanma) kontrollü deneylerde rastgele antrenmanı tutarlı biçimde %5–12 geride bırakır.',
    source: 'Rhea & Alderman (2004), JSCR'
  },
  {
    id: 'training_age',
    trigger: (log) => log.length >= 50,
    en: 'Training age matters as much as chronological age. A 50-year-old with 20 years of training often outperforms a 30-year-old with 2 years.',
    tr: 'Antrenman yaşı, kronolojik yaş kadar önemlidir. 20 yıllık antrenman geçmişine sahip bir 50 yaşlı, 2 yıllık bir 30 yaşlıyı çoğu zaman geride bırakır.',
    source: 'Tanaka & Seals (2008), J Physiol'
  },
  {
    id: 'injury_asymmetry',
    trigger: (log) => log.length >= 15,
    en: '> 10% left-right asymmetry in running gait is a strong predictor of future injury. Single-leg strength work reduces asymmetry by up to 40%.',
    tr: '>%10 sol-sağ asimetri koşu yürüyüşünde güçlü bir yaralanma tahmincisidir. Tek bacak güç çalışması asimetriyi %40\'a kadar azaltır.',
    source: 'Chaouachi et al. (2017), IJSPP'
  },
  {
    id: 'breathing_efficiency',
    trigger: () => true,
    en: 'Inspiratory muscle training (breathing exercises) improves cycling TT performance by ~2% and delays the onset of blood flow competition between legs and breathing muscles.',
    tr: 'Solunum kası antrenmanı (nefes egzersizleri) bisiklet TT performansını ~%2 artırır ve bacaklar ile solunum kasları arasındaki kan akışı rekabetinin başlangıcını geciktirir.',
    source: 'McConnell & Romer (2004), Sports Med'
  },
  {
    id: 'tapering_science',
    trigger: (log) => log.length >= 20,
    en: 'A 7–21 day taper that reduces volume by 40–60% while maintaining intensity produces performance gains of 2–3% in most endurance events.',
    tr: 'Yoğunluğu korurken hacmi %40–60 azaltan 7–21 günlük taper, çoğu dayanıklılık yarışmasında %2–3 performans kazanımı sağlar.',
    source: 'Bosquet et al. (2007), Med Sci Sports Exerc'
  },
]

// Returns notes triggered by current data, excluding recently shown ones.
export function getTriggeredNotes(log, recovery, profile, shownIds) {
  const shown = new Set(shownIds || [])
  return SCIENCE_NOTES.filter(n => {
    if (shown.has(n.id)) return false
    try { return n.trigger(log || [], recovery || [], profile || {}) }
    catch { return false }
  })
}
