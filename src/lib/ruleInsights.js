// ─── ruleInsights.js — Rule-based coaching insights (zero API cost) ────────────
// Pure JS module. No external dependencies. All functions are deterministic.
// Each return object includes .message (EN) + .tr (TR) for bilingual display.
// .action (EN) + .actionTr (TR) where applicable.

const COLORS = {
  optimal:  '#5bc25b',
  moderate: '#ff6600',
  high:     '#e03030',
  low:      '#0064ff',
}

// ─── 1. getReadinessLabel ─────────────────────────────────────────────────────
// Returns readiness assessment from ACWR + wellness average.
// acwr: number|null, wellnessAvg: number (0–100)
export function getReadinessLabel(acwr, wellnessAvg) {
  const well = typeof wellnessAvg === 'number' ? wellnessAvg : 50
  const ratio = typeof acwr === 'number' ? acwr : 1.0

  if (ratio > 1.5 || well < 40) {
    const isRatio = ratio > 1.5
    return {
      level:   'high',
      color:   COLORS.high,
      message: isRatio
        ? `ACWR ${ratio.toFixed(2)} — acute load spike. Prioritise recovery today.`
        : `Wellness ${well}/100 — significantly below baseline. Rest recommended.`,
      tr: isRatio
        ? `ACWR ${ratio.toFixed(2)} — akut yük artışı. Bugün toparlanmaya öncelik ver.`
        : `Hazırlık ${well}/100 — baz çizgisinin belirgin altında. Dinlenme önerilir.`,
    }
  }
  if (ratio > 1.3 || well < 60) {
    const isRatio = ratio > 1.3
    return {
      level:   'moderate',
      color:   COLORS.moderate,
      message: isRatio
        ? `ACWR ${ratio.toFixed(2)} — approaching high-risk zone. Monitor fatigue.`
        : `Wellness ${well}/100 — below threshold. Reduce intensity if needed.`,
      tr: isRatio
        ? `ACWR ${ratio.toFixed(2)} — yüksek risk bölgesine yaklaşıyor. Yorgunluğu izle.`
        : `Hazırlık ${well}/100 — eşiğin altında. Gerekirse yoğunluğu azalt.`,
    }
  }
  if (ratio < 0.8 && well >= 70) {
    return {
      level:   'low',
      color:   COLORS.low,
      message: `ACWR ${ratio.toFixed(2)} — undertraining. Capacity to add load if feeling good.`,
      tr:      `ACWR ${ratio.toFixed(2)} — az antrenman. Forma iyiyse yük artırılabilir.`,
    }
  }
  return {
    level:   'optimal',
    color:   COLORS.optimal,
    message: `ACWR ${ratio.toFixed(2)}, wellness ${well}/100 — green light for planned training.`,
    tr:      `ACWR ${ratio.toFixed(2)}, hazırlık ${well}/100 — planlı antrenman için yeşil ışık.`,
  }
}

// ─── 2. getLoadTrendAlert ─────────────────────────────────────────────────────
// Detects >10% week-on-week load spike in a 7-value array (oldest→newest daily TSS).
// loads7days: number[] (length 7, indices 0–6 = Mon–Sun or rolling 7d)
export function getLoadTrendAlert(loads7days) {
  const arr = Array.isArray(loads7days) ? loads7days : []
  const week1 = arr.slice(0, 3).reduce((s, v) => s + (Number(v) || 0), 0)  // first half (3 days)
  const week2 = arr.slice(3).reduce((s, v) => s + (Number(v) || 0), 0)     // second half (4 days)

  if (week1 === 0) {
    return {
      flag:     false,
      message:  'Insufficient prior load data to assess trend.',
      tr:       'Trendi değerlendirmek için yeterli yük verisi yok.',
      action:   'Log more sessions.',
      actionTr: 'Daha fazla seans kaydet.',
    }
  }

  const changePct = ((week2 - week1) / week1) * 100

  if (changePct > 10) {
    return {
      flag:     true,
      message:  `Load up ${Math.round(changePct)}% vs prior period — above 10% safe ramp rate.`,
      tr:       `Yük önceki döneme göre %${Math.round(changePct)} arttı — %10 güvenli rampa hızının üzerinde.`,
      action:   'Cap next session TSS or insert a recovery day.',
      actionTr: 'Sonraki seansın TSS\'ini sınırla veya toparlanma günü ekle.',
    }
  }
  return {
    flag:     false,
    message:  `Load change ${changePct >= 0 ? '+' : ''}${Math.round(changePct)}% — within safe range.`,
    tr:       `Yük değişimi ${changePct >= 0 ? '+' : ''}${Math.round(changePct)}% — güvenli aralıkta.`,
    action:   'Maintain current ramp rate.',
    actionTr: 'Mevcut rampa hızını koru.',
  }
}

// ─── 3. getMonotonyWarning ────────────────────────────────────────────────────
// Flags training monotony > 2.0 (Foster 2001). Monotony = mean / sd.
// loads7days: number[] (7 daily TSS values)
export function getMonotonyWarning(loads7days) {
  const arr = (Array.isArray(loads7days) ? loads7days : []).map(v => Number(v) || 0)
  if (arr.length < 2) {
    return {
      flag:     false,
      message:  'Not enough data to calculate monotony.',
      tr:       'Monotoni hesaplamak için yeterli veri yok.',
      action:   'Log at least 2 days.',
      actionTr: 'En az 2 gün kaydet.',
    }
  }

  const mean = arr.reduce((s, v) => s + v, 0) / arr.length
  if (mean === 0) {
    return {
      flag:     false,
      message:  'No load recorded — monotony not applicable.',
      tr:       'Yük kaydedilmedi — monotoni uygulanamaz.',
      action:   'Log training sessions.',
      actionTr: 'Antrenman seansı kaydet.',
    }
  }

  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length
  const sd = Math.sqrt(variance)

  if (sd === 0) {
    return {
      flag:     true,
      message:  'Monotony ∞ — identical load every day signals extremely repetitive training.',
      tr:       'Monotoni ∞ — her gün özdeş yük, son derece tekdüze antrenman.',
      action:   'Vary session intensity: mix hard, moderate, and easy days.',
      actionTr: 'Yük çeşitlendir: sert, orta ve kolay günler karıştır.',
    }
  }

  const monotony = mean / sd

  if (monotony > 2.0) {
    return {
      flag:     true,
      message:  `Monotony ${monotony.toFixed(2)} — above 2.0 threshold. Training is too uniform.`,
      tr:       `Monotoni ${monotony.toFixed(2)} — 2.0 eşiğinin üzerinde. Antrenman çok tekdüze.`,
      action:   'Add variation: insert a rest day or alternate hard/easy sessions.',
      actionTr: 'Çeşitlilik ekle: dinlenme günü veya sert/kolay seans dönüşümü.',
    }
  }
  return {
    flag:     false,
    message:  `Monotony ${monotony.toFixed(2)} — acceptable training variety.`,
    tr:       `Monotoni ${monotony.toFixed(2)} — kabul edilebilir antrenman çeşitliliği.`,
    action:   'Continue mixing intensities.',
    actionTr: 'Yoğunluk karışımına devam et.',
  }
}

// ─── 4. getFatigueAccumulation ────────────────────────────────────────────────
// Flags low perceived recovery (avg fatigueScore < 2.5 over last 3 days).
// fatigueScores3days: number[] (1–5 scale, 1=very fatigued, 5=fully recovered)
export function getFatigueAccumulation(fatigueScores3days) {
  const arr = (Array.isArray(fatigueScores3days) ? fatigueScores3days : [])
    .map(v => Number(v))
    .filter(v => !isNaN(v) && v >= 1 && v <= 5)

  if (arr.length === 0) {
    return {
      flag:     false,
      message:  'No fatigue scores recorded.',
      tr:       'Yorgunluk skoru kaydedilmedi.',
      action:   'Log daily wellness check-ins.',
      actionTr: 'Günlük durum kontrolü kaydet.',
    }
  }

  const avg = arr.reduce((s, v) => s + v, 0) / arr.length

  if (avg < 2.5) {
    return {
      flag:     true,
      message:  `Average recovery score ${avg.toFixed(1)}/5 — accumulated fatigue detected.`,
      tr:       `Ortalama toparlanma skoru ${avg.toFixed(1)}/5 — birikmiş yorgunluk tespit edildi.`,
      action:   'Schedule a rest or active recovery day. Avoid high-intensity sessions.',
      actionTr: 'Dinlenme veya aktif toparlanma günü planla. Yoğun antrenmanlardan kaçın.',
    }
  }
  return {
    flag:     false,
    message:  `Average recovery score ${avg.toFixed(1)}/5 — fatigue within acceptable range.`,
    tr:       `Ortalama toparlanma skoru ${avg.toFixed(1)}/5 — yorgunluk kabul edilebilir seviyede.`,
    action:   'Proceed with planned training.',
    actionTr: 'Planlanan antrenmanla devam et.',
  }
}

// ─── 5. getMissedRestWarning ──────────────────────────────────────────────────
// Flags ≥6 consecutive training days without a rest day.
// consecutiveTrainingDays: number
export function getMissedRestWarning(consecutiveTrainingDays) {
  const days = typeof consecutiveTrainingDays === 'number' && !isNaN(consecutiveTrainingDays)
    ? Math.max(0, Math.floor(consecutiveTrainingDays))
    : 0

  if (days >= 6) {
    return {
      flag:     true,
      message:  `${days} consecutive training days — a rest day is overdue.`,
      tr:       `${days} ardışık antrenman günü — dinlenme günü gecikmiş.`,
      action:   'Insert a complete rest or active recovery day before the next session.',
      actionTr: 'Bir sonraki seanstan önce tam dinlenme veya aktif toparlanma günü ekle.',
    }
  }
  return {
    flag:     false,
    message:  days === 0
      ? 'Rest day recorded — good recovery practice.'
      : `${days} consecutive training day${days === 1 ? '' : 's'} — still within safe range.`,
    tr: days === 0
      ? 'Dinlenme günü kaydedildi — iyi toparlanma uygulaması.'
      : `${days} ardışık antrenman günü — hâlâ güvenli aralıkta.`,
    action:   days >= 4 ? 'Plan a rest day within the next 2 days.' : 'Continue as planned.',
    actionTr: days >= 4 ? 'Önümüzdeki 2 gün içinde dinlenme günü planla.' : 'Planlandığı gibi devam et.',
  }
}

// ─── 6. getAthleteInsights ────────────────────────────────────────────────────
// Runs all checks and returns sorted array of active alerts.
// athleteData: {
//   acwr, wellnessAvg, loads7days, fatigueScores3days, consecutiveTrainingDays
// }
export function getAthleteInsights(athleteData) {
  if (!athleteData || typeof athleteData !== 'object') return []

  const { acwr, wellnessAvg, loads7days, fatigueScores3days, consecutiveTrainingDays } = athleteData

  const checks = [
    { key: 'readiness', result: getReadinessLabel(acwr, wellnessAvg) },
    { key: 'loadTrend', result: getLoadTrendAlert(loads7days) },
    { key: 'monotony',  result: getMonotonyWarning(loads7days) },
    { key: 'fatigue',   result: getFatigueAccumulation(fatigueScores3days) },
    { key: 'rest',      result: getMissedRestWarning(consecutiveTrainingDays) },
  ]

  const SEVERITY = { high: 0, moderate: 1, low: 2, optimal: 3 }

  const alerts = checks
    .filter(c => c.result.flag === true || c.key === 'readiness')
    .map(c => ({
      key:      c.key,
      flag:     c.result.flag ?? (c.result.level !== 'optimal'),
      severity: c.result.level || (c.result.flag ? 'moderate' : 'optimal'),
      message:  c.result.message,
      tr:       c.result.tr,
      action:   c.result.action,
      actionTr: c.result.actionTr,
      color:    c.result.color || (c.result.flag ? COLORS.moderate : COLORS.optimal),
    }))
    .sort((a, b) => (SEVERITY[a.severity] ?? 99) - (SEVERITY[b.severity] ?? 99))

  return alerts
}
