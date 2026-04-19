// src/lib/book/chapterBonuses.js — E16: book-to-app funnel
// Maps each EŞİK/THRESHOLD chapter to interactive app content.
// All 22 chapters covered; every bonus is citation-grounded.
//
// Bonus types:
//   'calculator'  — interactive input/output tool
//   'protocol'    — step-by-step test protocol (links to Protocols tab)
//   'template'    — session template (pre-fills Quick Add)
//   'table'       — reference table (zones, paces, etc.)
//   'simulator'   — "what-if" projection tool
//
// UTM: all chapter landings track as utm_source=esik_book&utm_content=chNNN

export const CHAPTERS = {
  ch1: {
    id: 'ch1',
    title: { en: 'Chapter 1 — Foundations of Endurance', tr: 'Bölüm 1 — Dayanıklılığın Temelleri' },
    bonus: {
      type: 'calculator',
      title: { en: 'Aerobic Age Calculator', tr: 'Aerobik Yaş Hesaplayıcı' },
      description: {
        en: 'Estimate your aerobic training age from VO2max and years of consistent training.',
        tr: 'VO2maks ve düzenli antrenman yıllarına göre aerobik antrenman yaşınızı tahmin edin.',
      },
      inputs: [
        { key: 'vo2max', label: { en: 'VO2max (ml/kg/min)', tr: 'VO2maks (ml/kg/dk)' }, type: 'number', min: 20, max: 90 },
        { key: 'years', label: { en: 'Years training consistently', tr: 'Düzenli antrenman yılı' }, type: 'number', min: 0, max: 40 },
        { key: 'age', label: { en: 'Chronological age', tr: 'Yaşınız' }, type: 'number', min: 15, max: 80 },
      ],
      compute: ({ vo2max, years, age }) => {
        // Aerobic age concept: Uth et al. 2004, VO2max normative ranges
        const aeroAge = Math.round(age - years * 0.7 - (vo2max - 40) * 0.3)
        return {
          aerobic_age: Math.max(15, Math.min(age, aeroAge)),
          label: { en: 'Estimated aerobic age', tr: 'Tahmini aerobik yaş' },
        }
      },
      citation: 'Uth et al. (2004). Estimation of VO2max from the ratio between HRmax and HRrest. Eur J Appl Physiol, 91(1), 111–115.',
    },
    tabTarget: null,
  },

  ch2: {
    id: 'ch2',
    title: { en: 'Chapter 2 — Energy Systems', tr: 'Bölüm 2 — Enerji Sistemleri' },
    bonus: {
      type: 'table',
      title: { en: 'Energy Pathway Reference Table', tr: 'Enerji Yolu Referans Tablosu' },
      description: {
        en: 'Duration vs. dominant energy pathway, per Gastin (2001) updated model.',
        tr: "Süre ile baskın enerji yolu eşleştirmesi — Gastin (2001) güncel modeli.",
      },
      rows: [
        { duration: '0–10s',   pathway: { en: 'Phosphocreatine (PCr)', tr: 'Fosfokre­atin (PCr)' }, intensity: '100%', rpe: '10' },
        { duration: '10–30s',  pathway: { en: 'PCr + Glycolysis',      tr: 'PCr + Glikoliz'      }, intensity: '95%',  rpe: '9–10' },
        { duration: '30–90s',  pathway: { en: 'Fast glycolysis',       tr: 'Hızlı Glikoliz'      }, intensity: '85%',  rpe: '8–9' },
        { duration: '2–8 min', pathway: { en: 'Oxidative + Glycolysis',tr: 'Oksidatif + Glikoliz'}, intensity: '75%',  rpe: '7–8' },
        { duration: '8+ min',  pathway: { en: 'Aerobic oxidative',     tr: 'Aerobik oksidatif'   }, intensity: '60%',  rpe: '4–7' },
      ],
      citation: 'Gastin PB (2001). Energy system interaction and relative contribution during maximal exercise. Sports Med, 31(10), 725–741.',
    },
    tabTarget: null,
  },

  ch3: {
    id: 'ch3',
    title: { en: 'Chapter 3 — VO2max', tr: 'Bölüm 3 — VO2maks' },
    bonus: {
      type: 'calculator',
      title: { en: 'VO2max Estimator (HR-based)', tr: 'VO2maks Tahmin Aracı (KAH tabanlı)' },
      description: {
        en: 'Estimate VO2max from resting and max heart rate (Uth et al. 2004).',
        tr: 'Dinlenim ve maksimum kalp atım hızından VO2maks tahmin edin (Uth vd. 2004).',
      },
      inputs: [
        { key: 'hrmax', label: { en: 'HRmax (bpm)', tr: 'KAHmaks (atım/dk)' }, type: 'number', min: 130, max: 220 },
        { key: 'hrrest', label: { en: 'HRrest (bpm)', tr: 'Dinlenim KAH (atım/dk)' }, type: 'number', min: 30, max: 90 },
      ],
      compute: ({ hrmax, hrrest }) => {
        // Uth et al. 2004: VO2max = 15 × (HRmax / HRrest)
        const vo2 = Math.round(15 * (hrmax / hrrest) * 10) / 10
        return { vo2max: vo2, label: { en: 'Estimated VO2max (ml/kg/min)', tr: 'Tahmini VO2maks (ml/kg/dk)' } }
      },
      citation: 'Uth N et al. (2004). Eur J Appl Physiol, 91(1), 111–115.',
    },
    tabTarget: 'protocols',
  },

  ch4: {
    id: 'ch4',
    title: { en: 'Chapter 4 — Lactate Threshold', tr: 'Bölüm 4 — Laktik Eşik' },
    bonus: {
      type: 'protocol',
      title: { en: 'LT1 / LT2 Field Test Protocol', tr: 'LT1 / LT2 Saha Testi Protokolü' },
      description: {
        en: '7-step submaximal step test to locate LT1 (aerobic threshold) and LT2 (lactate threshold) from HR + pace/power drift.',
        tr: 'LT1 (aerobik eşik) ve LT2 (laktik eşik) için 7 aşamalı submaksimal adım testi.',
      },
      steps: [
        { en: 'Warm up 10 min at RPE 2–3', tr: '10 dk RPE 2–3 ısınma' },
        { en: '6 × 4-min steps at RPE 3, 4, 5, 6, 7, 8 — record avg HR + pace each step', tr: '6 × 4 dk adımı RPE 3,4,5,6,7,8 — her adımda ort. KAH + hız kaydet' },
        { en: 'LT1 = step where HR:pace ratio first increases (aerobic drift)', tr: 'LT1 = KAH:hız oranının ilk arttığı adım (aerobik kayma)' },
        { en: 'LT2 ≈ step where pace drops despite constant RPE increase (Seiler 2010)', tr: 'LT2 ≈ sabit RPE artışına rağmen hızın düştüğü adım (Seiler 2010)' },
        { en: 'Cool down 10 min easy', tr: '10 dk kolay soğuma' },
      ],
      citation: 'Seiler S, Tønnessen E (2009). Intervals, thresholds, and long slow distance. Int J Sports Physiol Perform, 4(3), 365–373.',
    },
    tabTarget: 'protocols',
  },

  ch5: {
    id: 'ch5',
    title: { en: 'Chapter 5 — Heart Rate Zones', tr: 'Bölüm 5 — Kalp Atım Hızı Zonları' },
    bonus: {
      type: 'calculator',
      title: { en: '5-Zone HR Calculator', tr: '5 Zon KAH Hesaplayıcı' },
      description: {
        en: 'Enter HRmax to get all 5 training zones (Seiler/Karvonen method).',
        tr: 'KAHmaks girin, 5 antrenman zonunu hesaplayın (Seiler/Karvonen yöntemi).',
      },
      inputs: [
        { key: 'hrmax', label: { en: 'HRmax (bpm)', tr: 'KAHmaks (atım/dk)' }, type: 'number', min: 130, max: 220 },
        { key: 'hrrest', label: { en: 'HRrest (bpm) — optional, improves Z1 accuracy', tr: 'Dinlenim KAH (atım/dk) — isteğe bağlı' }, type: 'number', min: 30, max: 90, optional: true },
      ],
      compute: ({ hrmax, hrrest = 0 }) => {
        // Karvonen % of HRR if hrrest provided, else % of HRmax
        const base = hrrest || 0
        const reserve = hrmax - base
        const z = (lo, hi) => ({
          lo: Math.round(base + reserve * lo),
          hi: Math.round(base + reserve * hi),
        })
        return {
          z1: z(0.55, 0.65), z2: z(0.65, 0.75),
          z3: z(0.75, 0.85), z4: z(0.85, 0.92), z5: z(0.92, 1.0),
          label: { en: 'HR zones (bpm)', tr: 'KAH zonları (atım/dk)' },
        }
      },
      citation: 'Seiler S (2010). What is best practice for training intensity and duration distribution? IJSPP, 5(3), 276–291.',
    },
    tabTarget: 'zones',
  },

  ch6: {
    id: 'ch6',
    title: { en: 'Chapter 6 — FTP & Power Zones', tr: 'Bölüm 6 — FTP ve Güç Zonları' },
    bonus: {
      type: 'calculator',
      title: { en: 'FTP Zone Calculator (Coggan)', tr: 'FTP Zon Hesaplayıcı (Coggan)' },
      description: {
        en: '7 Coggan power zones from FTP. Enter FTP to see W targets for each zone.',
        tr: 'FTP girin, 7 Coggan güç zonu W hedeflerini görün.',
      },
      inputs: [
        { key: 'ftp', label: { en: 'FTP (watts)', tr: 'FTP (watt)' }, type: 'number', min: 80, max: 500 },
      ],
      compute: ({ ftp }) => ({
        z1: { lo: 0,                hi: Math.round(ftp * 0.55) },
        z2: { lo: Math.round(ftp * 0.56), hi: Math.round(ftp * 0.75) },
        z3: { lo: Math.round(ftp * 0.76), hi: Math.round(ftp * 0.90) },
        z4: { lo: Math.round(ftp * 0.91), hi: Math.round(ftp * 1.05) },
        z5: { lo: Math.round(ftp * 1.06), hi: Math.round(ftp * 1.20) },
        z6: { lo: Math.round(ftp * 1.21), hi: Math.round(ftp * 1.50) },
        z7: { lo: Math.round(ftp * 1.51), hi: null },
        label: { en: 'Power zones (watts)', tr: 'Güç zonları (watt)' },
      }),
      citation: 'Coggan AR, Allen H (2010). Training and Racing with a Power Meter, 2nd ed. VeloPress.',
    },
    tabTarget: 'zones',
  },

  ch7: {
    id: 'ch7',
    title: { en: 'Chapter 7 — Training Stress & Recovery', tr: 'Bölüm 7 — Antrenman Stresi ve Toparlanma' },
    bonus: {
      type: 'calculator',
      title: { en: 'TSS Estimator', tr: 'TSS Tahmin Aracı' },
      description: {
        en: 'Estimate TSS from HR-based TRIMP when power data is unavailable (Banister 1991).',
        tr: 'Güç verisi yoksa KAH tabanlı TRIMP ile TSS tahmini (Banister 1991).',
      },
      inputs: [
        { key: 'duration_min', label: { en: 'Duration (min)', tr: 'Süre (dk)' }, type: 'number', min: 1, max: 300 },
        { key: 'avg_hr', label: { en: 'Avg HR (bpm)', tr: 'Ort. KAH (atım/dk)' }, type: 'number', min: 60, max: 200 },
        { key: 'max_hr', label: { en: 'HRmax (bpm)', tr: 'KAHmaks (atım/dk)' }, type: 'number', min: 130, max: 220 },
      ],
      compute: ({ duration_min, avg_hr, max_hr }) => {
        const hrFrac = Math.min(avg_hr / max_hr, 1)
        const trimp = duration_min * hrFrac * 0.64 * Math.exp(1.92 * hrFrac)
        const tss = Math.round(trimp * 1.2)
        return { tss, label: { en: 'Estimated TSS', tr: 'Tahmini TSS' } }
      },
      citation: 'Banister EW (1991). Modeling elite athletic performance. In: Green H et al. (eds). Physiological Testing of the High-Performance Athlete.',
    },
    tabTarget: 'log',
  },

  ch8: {
    id: 'ch8',
    title: { en: 'Chapter 8 — Polarized Training', tr: 'Bölüm 8 — Polarize Antrenman' },
    bonus: {
      type: 'template',
      title: { en: 'Polarized Week Template', tr: 'Polarize Hafta Şablonu' },
      description: {
        en: '80/20 polarized week: 4 easy Z2 sessions + 1 VO2max interval. Seiler 2010.',
        tr: '80/20 polarize hafta: 4 kolay Z2 antrenmanı + 1 VO2maks interval. Seiler 2010.',
      },
      sessions: [
        { day: 'Mon', type: 'Running', duration: 60, rpe: 3, notes: '[EŞİK Ch.8] Z2 easy run — aerobic base' },
        { day: 'Tue', type: 'Running', duration: 75, rpe: 3, notes: '[EŞİK Ch.8] Z2 long easy — fat oxidation' },
        { day: 'Wed', type: 'Running', duration: 50, rpe: 7, notes: '[EŞİK Ch.8] 5×4 min Z5 intervals, 3 min recovery' },
        { day: 'Thu', type: 'Running', duration: 45, rpe: 3, notes: '[EŞİK Ch.8] Z1 active recovery' },
        { day: 'Sat', type: 'Running', duration: 90, rpe: 3, notes: '[EŞİK Ch.8] Z2 long run — aerobic volume' },
      ],
      citation: 'Seiler S (2010). What is best practice for training intensity distribution? IJSPP, 5(3), 276–291.',
    },
    tabTarget: 'log',
  },

  ch9: {
    id: 'ch9',
    title: { en: 'Chapter 9 — Mitochondrial Density Block', tr: 'Bölüm 9 — Mitokondriyal Yoğunluk Bloğu' },
    bonus: {
      type: 'template',
      title: { en: 'Mitochondrial Density Block — 4 Weeks', tr: 'Mitokondriyal Yoğunluk Bloğu — 4 Hafta' },
      description: {
        en: 'High-volume Z2 block targeting mitochondrial biogenesis. 10–12h/week, RPE 3–4. Holloszy 1967, Egan & Zierath 2013.',
        tr: 'Mitokondriyal biyogenezi hedefleyen yüksek hacimli Z2 bloğu. Haftada 10–12 saat, RPE 3–4.',
      },
      sessions: [
        { day: 'Mon', type: 'Running', duration: 90, rpe: 3, notes: '[EŞİK Ch.9] Mitochondrial block — Z2 threshold session' },
        { day: 'Tue', type: 'Cycling', duration: 120, rpe: 3, notes: '[EŞİK Ch.9] Cross-training Z2 — easy spin' },
        { day: 'Thu', type: 'Running', duration: 75, rpe: 3, notes: '[EŞİK Ch.9] Z2 steady — nose breathing check' },
        { day: 'Sat', type: 'Running', duration: 150, rpe: 3, notes: '[EŞİK Ch.9] Long Z2 run — fat adaptation cue' },
        { day: 'Sun', type: 'Cycling', duration: 100, rpe: 3, notes: '[EŞİK Ch.9] Active recovery spin' },
      ],
      citation: 'Egan B, Zierath JR (2013). Exercise metabolism and the molecular regulation of skeletal muscle adaptation. Cell Metab, 17(2), 162–184.',
    },
    tabTarget: 'log',
  },

  ch10: {
    id: 'ch10',
    title: { en: 'Chapter 10 — Aerobic Base', tr: 'Bölüm 10 — Aerobik Baz' },
    bonus: {
      type: 'calculator',
      title: { en: 'MAF Heart Rate Calculator', tr: 'MAF Kalp Atım Hızı Hesaplayıcı' },
      description: {
        en: 'Phil Maffetone 180-formula: aerobic training ceiling for base building.',
        tr: 'Phil Maffetone 180 formülü: baz dönemi aerobik antrenman tavanı.',
      },
      inputs: [
        { key: 'age', label: { en: 'Age (years)', tr: 'Yaş' }, type: 'number', min: 15, max: 80 },
        { key: 'injury', label: { en: 'Frequent illness/injury in last 2 years? (subtract 5)', tr: 'Son 2 yılda sık hastalık/sakatlık? (5 çıkar)' }, type: 'boolean', optional: true },
        { key: 'training_3plus', label: { en: 'Training consistently 2+ years without injury? (add 5)', tr: '2+ yıl düzenli antrenman? (5 ekle)' }, type: 'boolean', optional: true },
      ],
      compute: ({ age, injury, training_3plus }) => {
        let maf = 180 - age
        if (injury)         maf -= 5
        if (training_3plus) maf += 5
        return { maf_hr: maf, label: { en: 'MAF upper limit (bpm)', tr: 'MAF üst sınırı (atım/dk)' } }
      },
      citation: "Maffetone P (1996). Training for Endurance. David Barmore Productions.",
    },
    tabTarget: 'zones',
  },

  ch11: {
    id: 'ch11',
    title: { en: 'Chapter 11 — Aerobic Decoupling', tr: 'Bölüm 11 — Aerobik Kayma' },
    bonus: {
      type: 'protocol',
      title: { en: 'Decoupling Field Test', tr: 'Kayma Saha Testi' },
      description: {
        en: "Run 60–90 min at Z2. Split at midpoint. If HR rises >5% relative to pace in second half → aerobic drift (Friel 2018). Target: <5% coupling.",
        tr: 'Z2\'de 60–90 dk koşu yapın. Ortadan bölün. İkinci yarıda KAH hıza oranla >%5 artarsa → aerobik kayma (Friel 2018). Hedef: <%5 kayma.',
      },
      steps: [
        { en: '60–90 min steady Z2 run (RPE 3–4)', tr: '60–90 dk sabit Z2 koşusu (RPE 3–4)' },
        { en: 'Note pace + HR at 15 min (first half baseline)', tr: '15. dakikada hız + KAH not et (birinci yarı taban değeri)' },
        { en: 'Note pace + HR at 45/75 min (second half)', tr: '45/75. dakikada hız + KAH not et (ikinci yarı)' },
        { en: 'Drift% = (HR2/Pace2 − HR1/Pace1) / (HR1/Pace1) × 100', tr: 'Kayma% = (KAH2/Hız2 − KAH1/Hız1) / (KAH1/Hız1) × 100' },
        { en: '<5% = aerobic, 5–10% = threshold drift, >10% = fatigue/anaerobic (Friel 2018)', tr: '<%5 = aerobik, %5–10 = eşik kayması, >%10 = yorgunluk/anaerobik (Friel 2018)' },
      ],
      citation: 'Friel J (2018). The Triathlete\'s Training Bible, 4th ed. VeloPress.',
    },
    tabTarget: 'log',
  },

  ch12: {
    id: 'ch12',
    title: { en: 'Chapter 12 — FTP Testing', tr: 'Bölüm 12 — FTP Testi' },
    bonus: {
      type: 'protocol',
      title: { en: 'Ramp Test Protocol', tr: 'Rampa Testi Protokolü' },
      description: {
        en: '1-minute ramp test: FTP = last completed minute × 0.75 (Zwift method, ±5% vs 20 min TT).',
        tr: '1 dakikalık rampa testi: FTP = tamamlanan son dakika × 0.75 (Zwift yöntemi, 20 dk TT ile ±%5).',
      },
      steps: [
        { en: '10 min warm up at Z2', tr: '10 dk Z2 ısınma' },
        { en: 'Each minute: increase by 20W (start at 100W or 50% estimated FTP)', tr: 'Her dakika: 20W artır (100W veya tahmini FTP\'nin %50\'sinden başla)' },
        { en: 'Continue until failure (can\'t maintain cadence >60 rpm)', tr: 'Başarısız olana kadar devam et (kadans >60 rpm tutulamayana kadar)' },
        { en: 'FTP = last fully completed step watts × 0.75', tr: 'FTP = tamamen tamamlanan son adım watı × 0.75' },
        { en: 'Cool down 10 min easy', tr: '10 dk kolay soğuma' },
      ],
      citation: 'Inglis EC et al. (2019). Repeatability of the ramp test vs the 20-min FTP test. IJSPP, 14(10), 1407–1414.',
    },
    tabTarget: 'protocols',
  },

  ch13: {
    id: 'ch13',
    title: { en: 'Chapter 13 — Race Preparation', tr: 'Bölüm 13 — Yarış Hazırlığı' },
    bonus: {
      type: 'simulator',
      title: { en: 'Race Readiness Snapshot', tr: 'Yarış Hazırlığı Anlık Görünümü' },
      description: {
        en: 'Log into Sporeus to see your current CTL, TSB, and readiness score against your goal race.',
        tr: 'CTL, TSB ve hedef yarışa göre hazırlık skorunuzu görmek için Sporeus\'a giriş yapın.',
      },
      requiresAuth: true,
      citation: 'Mujika I, Padilla S (2003). Scientific bases for precompetition tapering strategies. Med Sci Sports Exerc, 35(7), 1182–1187.',
    },
    tabTarget: 'dashboard',
  },

  ch14: {
    id: 'ch14',
    title: { en: 'Chapter 14 — Taper & Peaking', tr: 'Bölüm 14 — Düşüş ve Zirveleme' },
    bonus: {
      type: 'template',
      title: { en: 'Classic 3-Week Taper Template', tr: 'Klasik 3 Haftalık Düşüş Şablonu' },
      description: {
        en: 'Mujika 2003: maintain intensity, reduce volume 40–60% over 3 weeks. TSB should hit +5 to +15 race morning.',
        tr: 'Mujika 2003: yoğunluğu koru, hacmi 3 haftada %40–60 azalt. Yarış sabahı TSB +5 ile +15 olmalı.',
      },
      sessions: [
        { day: 'Mon (W-3)', type: 'Running', duration: 50, rpe: 7, notes: '[EŞİK Ch.14] Taper W-3: quality maintained, volume down 40%' },
        { day: 'Wed (W-3)', type: 'Running', duration: 60, rpe: 3, notes: '[EŞİK Ch.14] Taper W-3: easy Z2' },
        { day: 'Mon (W-2)', type: 'Running', duration: 40, rpe: 7, notes: '[EŞİK Ch.14] Taper W-2: 3×5 min Z4, stay sharp' },
        { day: 'Wed (W-2)', type: 'Running', duration: 40, rpe: 3, notes: '[EŞİK Ch.14] Taper W-2: easy aerobic' },
        { day: 'Mon (W-1)', type: 'Running', duration: 30, rpe: 6, notes: '[EŞİK Ch.14] Taper W-1: 2×4 min race pace — last quality' },
        { day: 'Wed (W-1)', type: 'Running', duration: 25, rpe: 3, notes: '[EŞİK Ch.14] Taper W-1: shake-out run' },
      ],
      citation: 'Mujika I, Padilla S (2003). Med Sci Sports Exerc, 35(7), 1182–1187.',
    },
    tabTarget: 'log',
  },

  ch15: {
    id: 'ch15',
    title: { en: 'Chapter 15 — HRV & Recovery', tr: 'Bölüm 15 — HRV ve Toparlanma' },
    bonus: {
      type: 'calculator',
      title: { en: 'HRV Readiness Threshold', tr: 'HRV Hazırlık Eşiği' },
      description: {
        en: 'If your morning HRV falls >10% below your 7-day rolling mean, take a recovery day (Flatt & Esco 2016).',
        tr: 'Sabah HRV değeriniz 7 günlük ortalamadan >%10 düşüşe geçerse toparlanma günü alın (Flatt & Esco 2016).',
      },
      inputs: [
        { key: 'hrv_today', label: { en: 'Today\'s HRV (ms RMSSD)', tr: 'Bugünkü HRV (ms RMSSD)' }, type: 'number', min: 10, max: 150 },
        { key: 'hrv_7d', label: { en: '7-day HRV average (ms RMSSD)', tr: '7 günlük HRV ortalaması (ms RMSSD)' }, type: 'number', min: 10, max: 150 },
      ],
      compute: ({ hrv_today, hrv_7d }) => {
        const drop_pct = ((hrv_7d - hrv_today) / hrv_7d) * 100
        const status = drop_pct > 10
          ? { en: 'Recovery day recommended', tr: 'Toparlanma günü önerilir' }
          : { en: 'Training as planned', tr: 'Planlandığı gibi antrenman' }
        return { drop_pct: Math.round(drop_pct * 10) / 10, status }
      },
      citation: 'Flatt AA, Esco MR (2016). Evaluating individual training adaptation with HRV. Int J Sports Physiol Perform, 11(3), 391–397.',
    },
    tabTarget: 'log',
  },

  ch16: {
    id: 'ch16',
    title: { en: 'Chapter 16 — Nutrition Timing', tr: 'Bölüm 16 — Beslenme Zamanlaması' },
    bonus: {
      type: 'calculator',
      title: { en: 'Carbohydrate Periodization Calc', tr: 'Karbonhidrat Periyotlama Hesaplayıcı' },
      description: {
        en: 'Fueling by session intensity: low CHO for Z1–Z2, high CHO pre-threshold (Impey et al. 2018).',
        tr: 'Antrenman yoğunluğuna göre yakıt: Z1–Z2 düşük KH, eşik öncesi yüksek KH (Impey vd. 2018).',
      },
      inputs: [
        { key: 'bw_kg', label: { en: 'Body weight (kg)', tr: 'Vücut ağırlığı (kg)' }, type: 'number', min: 40, max: 130 },
        { key: 'rpe', label: { en: 'Session RPE (1–10)', tr: 'Antrenman RPE (1–10)' }, type: 'number', min: 1, max: 10 },
        { key: 'duration_hr', label: { en: 'Duration (hours)', tr: 'Süre (saat)' }, type: 'number', min: 0.5, max: 6 },
      ],
      compute: ({ bw_kg, rpe, duration_hr }) => {
        // Low: 3–5 g/kg/d, moderate: 5–7, high: 7–10
        const base = rpe <= 4 ? 3.5 : rpe <= 7 ? 5.5 : 8.0
        const intra = rpe <= 4 ? 0 : rpe <= 7 ? 30 : 60 // g/hr intra-session
        return {
          daily_cho_g: Math.round(base * bw_kg),
          intra_session_g: Math.round(intra * duration_hr),
          label: { en: 'CHO targets', tr: 'KH hedefleri' },
        }
      },
      citation: 'Impey SG et al. (2018). Fuel for the work required: a theoretical framework for CHO periodization. Sports Med, 48(5), 1031–1048.',
    },
    tabTarget: null,
  },

  ch17: {
    id: 'ch17',
    title: { en: 'Chapter 17 — Sleep & Regeneration', tr: 'Bölüm 17 — Uyku ve Rejenerasyon' },
    bonus: {
      type: 'template',
      title: { en: 'Recovery Week Template', tr: 'Toparlanma Haftası Şablonu' },
      description: {
        en: 'Every 3–4th week: 40–50% volume reduction, no Z4+. Allows supercompensation (Budgett 1998).',
        tr: 'Her 3–4. haftada: %40–50 hacim azaltması, Z4+ yok. Süperkompanzasyona izin verir (Budgett 1998).',
      },
      sessions: [
        { day: 'Tue', type: 'Running', duration: 35, rpe: 3, notes: '[EŞİK Ch.17] Recovery week — easy Z1/Z2 only' },
        { day: 'Thu', type: 'Running', duration: 40, rpe: 3, notes: '[EŞİK Ch.17] Recovery week — aerobic maintenance' },
        { day: 'Sat', type: 'Running', duration: 50, rpe: 3, notes: '[EŞİK Ch.17] Recovery week — long easy, no quality' },
      ],
      citation: 'Budgett R (1998). Fatigue and underperformance in athletes: the overtraining syndrome. Br J Sports Med, 32(2), 107–110.',
    },
    tabTarget: 'log',
  },

  ch18: {
    id: 'ch18',
    title: { en: 'Chapter 18 — Taper Simulation', tr: 'Bölüm 18 — Düşüş Simülasyonu' },
    bonus: {
      type: 'simulator',
      title: { en: 'CTL / TSB Taper Curve Preview', tr: 'CTL / TSB Düşüş Eğrisi Önizlemesi' },
      description: {
        en: 'Log in to simulate your CTL/TSB curve for 2, 3, or 4-week taper options against your goal event.',
        tr: 'Hedef yarışınız için 2, 3 veya 4 haftalık düşüş seçeneklerinin CTL/TSB eğrisini simüle edin.',
      },
      requiresAuth: true,
      citation: 'Mujika I (2010). Intense training: the key to optimal performance before and during the taper. Scand J Med Sci Sports, 20(S2), 24–31.',
    },
    tabTarget: 'dashboard',
  },

  ch19: {
    id: 'ch19',
    title: { en: 'Chapter 19 — Race Day Execution', tr: 'Bölüm 19 — Yarış Günü Uygulaması' },
    bonus: {
      type: 'template',
      title: { en: 'Race Day Log Template', tr: 'Yarış Günü Kayıt Şablonu' },
      description: {
        en: 'Pre-filled race-day session: record gun time, splits, perceived effort, nutrition, and post-race notes.',
        tr: 'Yarış günü için önceden doldurulmuş seans: tabanca zamanı, bölünmeler, algılanan efor, beslenme ve yarış sonrası notlar.',
      },
      sessions: [
        { day: 'Race Day', type: 'Running', duration: 0, rpe: null, notes: '[EŞİK Ch.19] RACE: [distance] — Goal: [time] | Actual: [time] | Splits: [e.g. 23:45 / 24:10] | Nutrition: [gels/water] | Post-race: [recovery plan]' },
      ],
      citation: 'Abbiss CR, Laursen PB (2008). Describing and understanding pacing strategies during athletic competition. Sports Med, 38(3), 239–252.',
    },
    tabTarget: 'log',
  },

  ch20: {
    id: 'ch20',
    title: { en: 'Chapter 20 — Altitude Training', tr: 'Bölüm 20 — İrtifa Antrenmanı' },
    bonus: {
      type: 'calculator',
      title: { en: 'Altitude Performance Adjustment', tr: 'İrtifa Performans Düzeltme Hesabı' },
      description: {
        en: 'Estimate sea-level equivalent pace at altitude. Every 1000m above 1500m ≈ +3–4% race time (Péronnet et al. 1991).',
        tr: 'İrtifada deniz seviyesi eşdeğeri hız tahmini. 1500m üzerinde her 1000m ≈ yarış süresinde +%3–4 (Péronnet vd. 1991).',
      },
      inputs: [
        { key: 'altitude_m', label: { en: 'Race altitude (m)', tr: 'Yarış irtifası (m)' }, type: 'number', min: 0, max: 5000 },
        { key: 'sea_pace_spm', label: { en: 'Sea-level 5K pace (s/km)', tr: 'Deniz seviyesi 5K hızı (s/km)' }, type: 'number', min: 150, max: 600 },
      ],
      compute: ({ altitude_m, sea_pace_spm }) => {
        const excess_m = Math.max(0, altitude_m - 1500)
        const adj_pct  = 1 + (excess_m / 1000) * 0.035
        const adj_pace = Math.round(sea_pace_spm * adj_pct)
        return {
          adjusted_pace_spm: adj_pace,
          adj_pct: Math.round((adj_pct - 1) * 100 * 10) / 10,
          label: { en: 'Altitude-adjusted pace (s/km)', tr: 'İrtifaya göre düzeltilmiş hız (s/km)' },
        }
      },
      citation: 'Péronnet F et al. (1991). A simple method for estimating the effect of altitude on performance. Eur J Appl Physiol, 62(5), 340–344.',
    },
    tabTarget: null,
  },

  ch21: {
    id: 'ch21',
    title: { en: 'Chapter 21 — Annual Periodization', tr: 'Bölüm 21 — Yıllık Periyotlama' },
    bonus: {
      type: 'simulator',
      title: { en: 'Yearly Plan Builder', tr: 'Yıllık Plan Oluşturucu' },
      description: {
        en: 'Log in to generate a full-year periodized plan: base → build → peak → race → recovery cycles.',
        tr: 'Tam yıllık periyotlu plan oluşturun: baz → yapı → zirve → yarış → toparlanma döngüleri.',
      },
      requiresAuth: true,
      citation: 'Bompa TO, Haff GG (2009). Periodization: Theory and Methodology of Training, 5th ed. Human Kinetics.',
    },
    tabTarget: 'periodization',
  },

  ch22: {
    id: 'ch22',
    title: { en: 'Chapter 22 — Mental Performance', tr: 'Bölüm 22 — Zihinsel Performans' },
    bonus: {
      type: 'template',
      title: { en: 'Pre-Race Routine Template', tr: 'Yarış Öncesi Rutin Şablonu' },
      description: {
        en: '48-hour pre-race protocol: carb load, sleep, activation, warm-up, mental cues.',
        tr: '48 saatlik yarış öncesi protokol: karbonhidrat yükleme, uyku, aktivasyon, ısınma, zihinsel ipuçları.',
      },
      sessions: [
        { day: 'T-2', type: 'Running', duration: 25, rpe: 4, notes: '[EŞİK Ch.22] Pre-race T-2: 20 min easy + 4×30s strides — activation, no fatigue' },
        { day: 'T-1', type: 'Running', duration: 15, rpe: 3, notes: '[EŞİK Ch.22] Pre-race T-1: 10 min shake-out, mental rehearsal of race plan' },
      ],
      citation: 'Cotterill S (2011). Experiences of developing pre-performance routines with elite athletes. J Sport Psychol Action, 2(2), 90–98.',
    },
    tabTarget: 'log',
  },
}

/**
 * Get a chapter by ID. Returns null for unknown IDs.
 * @param {string} chapterId — 'ch1' through 'ch22'
 * @returns {Object|null}
 */
export function getChapter(chapterId) {
  return CHAPTERS[chapterId] ?? null
}

/**
 * All chapter IDs in order.
 * @returns {string[]}
 */
export function getAllChapterIds() {
  return Object.keys(CHAPTERS)
}

/**
 * Get all chapters of a specific bonus type.
 * @param {'calculator'|'protocol'|'template'|'table'|'simulator'} type
 * @returns {Object[]}
 */
export function getChaptersByType(type) {
  return Object.values(CHAPTERS).filter(ch => ch.bonus.type === type)
}

/**
 * Validate chapter integrity: every chapter has id, title (en+tr), bonus with citation.
 * Used in tests.
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateAllChapters() {
  const errors = []
  for (const [key, ch] of Object.entries(CHAPTERS)) {
    if (ch.id !== key) errors.push(`${key}: id mismatch`)
    if (!ch.title?.en || !ch.title?.tr) errors.push(`${key}: missing title`)
    if (!ch.bonus?.citation) errors.push(`${key}: missing citation`)
    if (!ch.bonus?.type) errors.push(`${key}: missing bonus.type`)
    if (!ch.bonus?.title?.en) errors.push(`${key}: missing bonus title`)
  }
  return { valid: errors.length === 0, errors }
}
