// src/lib/formulaInfo.js — Formula metadata for ⓘ popovers (E71)
// Each key maps to name, formula string, explanation (EN+TR), citation, EŞİK chapter ref.

export const FORMULA_INFO = {
  ctl: {
    name: { en: 'Chronic Training Load (CTL)', tr: 'Kronik Antrenman Yükü (CTL)' },
    formula: 'CTL_t = CTL_{t-1} + (TSS − CTL_{t-1}) / 42',
    explanation: {
      en: '42-day exponential weighted average of daily TSS. Represents your aerobic fitness base — higher is fitter.',
      tr: '42 günlük TSS üstel ağırlıklı ortalaması. Aerobik kondisyon tabanını temsil eder — yüksek = daha iyi form.',
    },
    citation: 'Banister EW (1991); Coggan & Allen, Training and Racing with a Power Meter (2010)',
    esik: { en: 'Ch. 7 — Performance Management Chart', tr: 'Bölüm 7 — Performans Yönetim Grafiği' },
  },
  atl: {
    name: { en: 'Acute Training Load (ATL)', tr: 'Akut Antrenman Yükü (ATL)' },
    formula: 'ATL_t = ATL_{t-1} + (TSS − ATL_{t-1}) / 7',
    explanation: {
      en: '7-day exponential weighted average of TSS. Represents recent training fatigue — peaks after a hard block.',
      tr: '7 günlük TSS üstel ağırlıklı ortalaması. Son antrenman yorgunluğunu temsil eder.',
    },
    citation: 'Banister EW (1991); Coggan & Allen (2010)',
    esik: { en: 'Ch. 7 — ATL and fatigue accumulation', tr: 'Bölüm 7 — ATL ve yorgunluk birikimi' },
  },
  tsb: {
    name: { en: 'Training Stress Balance (TSB / Form)', tr: 'Antrenman Stres Dengesi (TSB / Form)' },
    formula: 'TSB = CTL − ATL',
    explanation: {
      en: 'Fitness minus fatigue. Positive = fresh and race-ready. Negative = accumulated fatigue. Peak form: TSB +15 to +25.',
      tr: 'Kondisyon eksi yorgunluk. Pozitif = dinç, yarışa hazır. Negatif = birikmiş yorgunluk.',
    },
    citation: 'Morton RH et al. (1991); Coggan & Allen (2010)',
    esik: { en: 'Ch. 7 — TSB and race timing', tr: 'Bölüm 7 — TSB ve yarış zamanlaması' },
  },
  acwr: {
    name: { en: 'Acute:Chronic Workload Ratio (ACWR)', tr: 'Akut:Kronik İş Yükü Oranı (ACWR)' },
    formula: 'ACWR = ATL_7d / CTL_28d',
    explanation: {
      en: 'Ratio of recent to baseline load. Safe zone: 0.8–1.3. Caution: >1.5. Danger: >1.8.',
      tr: 'Son yük / baz yük oranı. Güvenli: 0.8–1.3. Dikkat: >1.5. Tehlike: >1.8.',
    },
    citation: 'Gabbett TJ (2016). The training-injury prevention paradox. Br J Sports Med 50:273-280.',
    esik: { en: 'Ch. 9 — Workload and injury prevention', tr: 'Bölüm 9 — İş yükü ve yaralanma önleme' },
  },
  vdot: {
    name: { en: 'VDOT (Daniels Running Formula)', tr: 'VDOT (Daniels Koşu Formülü)' },
    formula: 'VDOT ≈ VO₂ at race pace (Daniels & Gilbert 1979 regression tables)',
    explanation: {
      en: 'Derived from race performance, not lab test. Used to set 5 training pace zones: Easy, Marathon, Threshold, Interval, Rep.',
      tr: 'Yarış performansından türetilir, laboratuvar testi gerekmez. 5 antrenman hız bölgesini belirler.',
    },
    citation: "Daniels J. Daniels' Running Formula, 2nd ed. Human Kinetics (2005).",
    esik: { en: 'Ch. 5 — Running paces and VDOT', tr: 'Bölüm 5 — Koşu hızları ve VDOT' },
  },
  ftp: {
    name: { en: 'Functional Threshold Power (FTP)', tr: 'Fonksiyonel Eşik Gücü (FTP)' },
    formula: 'FTP ≈ 0.95 × (20-min best avg power); or 1-hour TT avg power',
    explanation: {
      en: 'Max average power sustainable for ~1 hour. Foundation of all 7 Coggan power zones.',
      tr: '~1 saatte sürdürülebilir maksimum ortalama güç. 7 Coggan güç bölgesinin temeli.',
    },
    citation: 'Coggan AR. Training and Racing with a Power Meter. VeloPress (2003).',
    esik: { en: 'Ch. 6 — FTP and power zones', tr: 'Bölüm 6 — FTP ve güç bölgeleri' },
  },
  wkg: {
    name: { en: 'Power-to-Weight Ratio (W/kg)', tr: 'Güç/Ağırlık Oranı (W/kg)' },
    formula: 'W/kg = FTP (watts) ÷ body weight (kg)',
    explanation: {
      en: 'The single most important metric for climbing and overall cycling performance. Cat 5 <2.0, Cat 4 <3.0, Cat 3 <3.5, Cat 2 <4.0, Cat 1 <5.0.',
      tr: 'Tırmanma ve genel bisiklet performansı için en önemli metrik.',
    },
    citation: 'Coggan AR. Categorization of cyclists by W/kg (2003).',
    esik: { en: 'Ch. 6 — W/kg athlete categories', tr: 'Bölüm 6 — W/kg sporcu kategorileri' },
  },
  lthr: {
    name: { en: 'Lactate Threshold HR (LTHR)', tr: 'Laktik Eşik Kalp Atış Hızı (LTHR)' },
    formula: 'LTHR ≈ MaxHR × 0.87 (Friel estimate); or avg HR last 20min of 30-min TT',
    explanation: {
      en: 'HR at the crossover from aerobic to anaerobic metabolism. The Z3/Z4 boundary. Training above LTHR is hard; below is aerobic.',
      tr: 'Aerobik/anaerobik metabolizma geçiş noktasındaki KAH. Z3/Z4 sınırı.',
    },
    citation: "Friel J. The Triathlete's Training Bible. VeloPress (2009).",
    esik: { en: 'Ch. 4 — Lactate threshold and zones', tr: 'Bölüm 4 — Laktik eşik ve bölgeler' },
  },
  tss: {
    name: { en: 'Training Stress Score (TSS)', tr: 'Antrenman Stres Skoru (TSS)' },
    formula: 'TSS = duration_hours × IF² × 100',
    explanation: {
      en: 'Quantifies training stress for one session. IF = intensity factor (NP/FTP proxy). 100 TSS ≈ 1-hour max effort.',
      tr: 'Tek antrenman stresini sayısal olarak ifade eder. 100 TSS ≈ 1 saatlik maksimal efor.',
    },
    citation: 'Coggan AR & Allen H (2003). sRPE method: Foster C (1998).',
    esik: { en: 'Ch. 7 — TSS and training quantification', tr: 'Bölüm 7 — TSS ve antrenman nicelendirme' },
  },
}
