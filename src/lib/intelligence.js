// ─── intelligence.js — Pure sport-science reasoning (no React) ────────────────
// v4.3: analyzeLoadTrend, analyzeRecoveryCorrelation, analyzeZoneBalance,
//        predictInjuryRisk, predictFitness, scoreSession
// v4.4: generateWeeklyNarrative, detectMilestones

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysAgoDate(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
function tssInWindow(log, startDate, endDate) {
  return log.filter(e => e.date >= startDate && e.date < endDate).reduce((s, e) => s + (e.tss || 0), 0)
}
function computeCTL(log) {
  if (!log.length) return 0
  const sorted = [...log].sort((a, b) => a.date > b.date ? 1 : -1)
  let ctl = 0
  for (const s of sorted) ctl = ctl + ((s.tss || 0) - ctl) / 42
  return Math.round(ctl)
}
function computeATL(log) {
  if (!log.length) return 0
  const sorted = [...log].sort((a, b) => a.date > b.date ? 1 : -1)
  let atl = 0
  for (const s of sorted) atl = atl + ((s.tss || 0) - atl) / 7
  return Math.round(atl)
}

// ─── 1. analyzeLoadTrend ──────────────────────────────────────────────────────
// Returns training load direction and actionable advice.
export function analyzeLoadTrend(log) {
  if (!log || log.length < 4) {
    return { trend: 'insufficient', direction: null, change: 0, advice: { en: 'Log at least 4 sessions to see load trends.', tr: 'Yük trendini görmek için en az 4 antrenman kaydet.' } }
  }

  const now = daysAgoDate(0)
  const w1Start = daysAgoDate(7), w2Start = daysAgoDate(14), w3Start = daysAgoDate(21)
  const tss1 = tssInWindow(log, w1Start, now)
  const tss2 = tssInWindow(log, w2Start, w1Start)
  const tss3 = tssInWindow(log, w3Start, w2Start)

  const change = tss2 > 0 ? Math.round((tss1 - tss2) / tss2 * 100) : 0
  const avg3w  = tss3 > 0 ? (tss1 + tss2 + tss3) / 3 : (tss1 + tss2) / 2

  let trend, advice
  if (change > 15) {
    trend = 'building'
    advice = {
      en: `Load up ${change}% vs last week. Good progression — avoid exceeding 10%/week long-term.`,
      tr: `Yük geçen haftaya göre %${change} arttı. Kademeli artış sağlıklı — uzun vadede haftada %10'u geçmemeye çalış.`
    }
  } else if (change < -15) {
    trend = 'recovering'
    advice = {
      en: `Load down ${Math.abs(change)}% — recovery or deload week. CTL will hold; TSB improving.`,
      tr: `Yük %${Math.abs(change)} düştü — toparlanma ya da boşaltma haftası. KTY stabil kalacak, form artıyor.`
    }
  } else if (Math.abs(change) <= 5 && tss1 > avg3w * 0.9) {
    trend = 'peaking'
    advice = {
      en: 'Stable high load — classic peak block. Monitor recovery scores closely.',
      tr: 'Sabit yüksek yük — klasik doruk blok. Toparlanma skorlarını yakından izle.'
    }
  } else {
    trend = 'inconsistent'
    advice = {
      en: 'Variable load pattern — aim for 3-4 sessions/week with consistent TSS.',
      tr: 'Değişken yük örüntüsü — haftada 3-4 antrenman ve tutarlı TSS hedefle.'
    }
  }

  const ctl = computeCTL(log)
  const atl = computeATL(log)
  return { trend, direction: change, change, tss1, tss2, ctl, atl, advice }
}

// ─── 2. analyzeRecoveryCorrelation ────────────────────────────────────────────
// Finds whether high training days predict worse next-day recovery.
export function analyzeRecoveryCorrelation(log, recovery) {
  if (!log?.length || !recovery?.length) {
    return { correlation: null, insight: { en: 'Need both training and recovery data.', tr: 'Hem antrenman hem toparlanma verisine ihtiyaç var.' }, highLoadThreshold: 0, avgRecAfterHard: null, avgRecAfterEasy: null }
  }

  const recMap = {}
  recovery.forEach(e => { recMap[e.date] = e.score || 0 })

  const pairs = []
  log.forEach(e => {
    const nextDay = new Date(e.date)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextStr = nextDay.toISOString().slice(0, 10)
    if (recMap[nextStr] !== undefined) {
      pairs.push({ tss: e.tss || 0, rpe: e.rpe || 5, nextRec: recMap[nextStr] })
    }
  })

  if (pairs.length < 3) {
    return { correlation: null, insight: { en: 'Not enough paired data yet.', tr: 'Henüz yeterli eşleştirilmiş veri yok.' }, highLoadThreshold: 0, avgRecAfterHard: null, avgRecAfterEasy: null }
  }

  const meanTSS = pairs.reduce((s, p) => s + p.tss, 0) / pairs.length
  const hard = pairs.filter(p => p.tss >= meanTSS)
  const easy = pairs.filter(p => p.tss <  meanTSS)
  const avgRecAfterHard = hard.length ? Math.round(hard.reduce((s, p) => s + p.nextRec, 0) / hard.length) : null
  const avgRecAfterEasy = easy.length ? Math.round(easy.reduce((s, p) => s + p.nextRec, 0) / easy.length) : null
  const diff = (avgRecAfterHard !== null && avgRecAfterEasy !== null) ? avgRecAfterEasy - avgRecAfterHard : 0

  let insight
  if (diff > 10) {
    insight = {
      en: `Hard sessions reduce next-day readiness by ~${diff} pts. Plan easy days after hard efforts.`,
      tr: `Zorlu antrenmanlar ertesi gün hazırlığı ~${diff} puan düşürüyor. Zorlu sonrası kolay günler planla.`
    }
  } else if (diff > 4) {
    insight = {
      en: `Mild load-recovery link (+${diff} pts easier days). Your recovery is resilient.`,
      tr: `Hafif yük-toparlanma ilişkisi (kolay günler +${diff} puan). Toparlanman güçlü.`
    }
  } else {
    insight = {
      en: 'Recovery scores are consistent regardless of session intensity — well-managed stress.',
      tr: 'Toparlanma skorları antrenman yoğunluğundan bağımsız — stres iyi yönetiliyor.'
    }
  }

  return { correlation: diff, insight, highLoadThreshold: Math.round(meanTSS), avgRecAfterHard, avgRecAfterEasy }
}

// ─── 3. analyzeZoneBalance ────────────────────────────────────────────────────
// Checks polarized training model (80/20): Z1+Z2 ≥80%, Z4+Z5 ≤20%.
export function analyzeZoneBalance(log) {
  if (!log?.length) {
    return { z1z2Pct: 0, z4z5Pct: 0, status: 'no_data', recommendation: { en: 'Log sessions to analyze zone balance.', tr: 'Zon dengesini analiz etmek için antrenman kaydet.' } }
  }

  const recent = log.filter(e => e.date >= daysAgoDate(28))
  if (!recent.length) return { z1z2Pct: 0, z4z5Pct: 0, status: 'no_data', recommendation: { en: 'No sessions in last 28 days.', tr: 'Son 28 günde antrenman yok.' } }

  const zTotals = [0, 0, 0, 0, 0]
  recent.forEach(e => {
    const dur = e.duration || 0
    if (e.zones && e.zones.some(z => z > 0)) {
      e.zones.forEach((z, i) => { if (i < 5) zTotals[i] += z })
    } else {
      const r = e.rpe || 5
      const zi = r <= 3 ? 0 : r <= 5 ? 1 : r <= 7 ? 2 : r === 8 ? 3 : 4
      zTotals[zi] += dur
    }
  })

  const total = zTotals.reduce((s, v) => s + v, 0) || 1
  const pcts  = zTotals.map(v => Math.round(v / total * 100))
  const z1z2Pct = pcts[0] + pcts[1]
  const z4z5Pct = pcts[3] + pcts[4]
  const z3Pct   = pcts[2]

  let status, recommendation
  if (z1z2Pct >= 75 && z4z5Pct <= 25) {
    status = 'polarized'
    recommendation = {
      en: `Good polarized balance: ${z1z2Pct}% easy / ${z4z5Pct}% high intensity. Matches Seiler's 80/20 model.`,
      tr: `İyi polarize denge: %${z1z2Pct} kolay / %${z4z5Pct} yüksek yoğunluk. Seiler'ın 80/20 modeline uyuyor.`
    }
  } else if (z3Pct > 35) {
    status = 'threshold_heavy'
    recommendation = {
      en: `${z3Pct}% in Z3 (moderate intensity). This "grey zone" adds fatigue without peak adaptations. Push easy sessions easier.`,
      tr: `%${z3Pct} Z3'te (orta yoğunluk). Bu "gri zon" adaptasyon olmadan yorgunluk yaratır. Kolay seansları daha kolay yap.`
    }
  } else if (z1z2Pct < 60) {
    status = 'too_hard'
    recommendation = {
      en: `Only ${z1z2Pct}% easy volume. Increase Z1/Z2 to ≥75% for sustainable aerobic base (Seiler, 2010).`,
      tr: `Yalnızca %${z1z2Pct} kolay hacim. Sürdürülebilir aerobik baz için Z1/Z2'yi ≥%75'e çıkar (Seiler, 2010).`
    }
  } else {
    status = 'balanced'
    recommendation = {
      en: `${z1z2Pct}% easy, ${z4z5Pct}% hard. Close to polarized model — small improvement possible.`,
      tr: `%${z1z2Pct} kolay, %${z4z5Pct} zorlu. Polarize modele yakın — küçük iyileştirme mümkün.`
    }
  }

  return { z1z2Pct, z4z5Pct, z3Pct, pcts, status, recommendation }
}

// ─── 4. predictInjuryRisk ─────────────────────────────────────────────────────
// Multi-factor injury risk: ACWR + monotony + recovery deficit + consecutive days.
export function predictInjuryRisk(log, recovery) {
  const factors = []
  let riskScore = 0

  if (!log?.length) {
    return { level: 'unknown', score: 0, factors: [], advice: { en: 'Log sessions to assess injury risk.', tr: 'Yaralanma riskini değerlendirmek için antrenman kaydet.' } }
  }

  // Factor 1: ACWR
  const now = daysAgoDate(0)
  const w1 = daysAgoDate(7), w4 = daysAgoDate(28)
  const acute = tssInWindow(log, w1, now)
  const chronic28 = tssInWindow(log, w4, now) / 4
  if (chronic28 > 0) {
    const acwr = acute / chronic28
    if (acwr > 1.5) {
      riskScore += 35; factors.push({ label: 'ACWR > 1.5', severity: 'high', detail: { en: `Load spike (ACWR ${acwr.toFixed(2)}) — classic injury predictor (Hulin 2016).`, tr: `Yük artışı (ACWR ${acwr.toFixed(2)}) — klasik yaralanma belirteci (Hulin 2016).` } })
    } else if (acwr > 1.3) {
      riskScore += 15; factors.push({ label: 'ACWR 1.3–1.5', severity: 'moderate', detail: { en: `Elevated ACWR (${acwr.toFixed(2)}) — caution zone.`, tr: `Yüksek ACWR (${acwr.toFixed(2)}) — dikkat bölgesi.` } })
    }
  }

  // Factor 2: Training monotony (< 2.0 is safe, Banister)
  const last7 = []
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoDate(i)
    last7.push(log.filter(e => e.date === d).reduce((s, e) => s + (e.tss || 0), 0))
  }
  const mean7 = last7.reduce((s, v) => s + v, 0) / 7
  const std7  = Math.sqrt(last7.reduce((s, v) => s + (v - mean7) ** 2, 0) / 7)
  const mono  = std7 > 0 ? Math.round(mean7 / std7 * 10) / 10 : 0
  if (mono > 2.0) {
    riskScore += 20; factors.push({ label: `Monotony ${mono}`, severity: 'moderate', detail: { en: `High monotony index (${mono}) — vary intensity daily.`, tr: `Yüksek monotoni indeksi (${mono}) — günlük yoğunluğu değiştir.` } })
  }

  // Factor 3: Consecutive hard days
  const sortedDesc = [...log].sort((a, b) => b.date > a.date ? 1 : -1)
  let consecHard = 0
  for (const e of sortedDesc.slice(0, 7)) {
    if ((e.rpe || 0) >= 7) consecHard++; else break
  }
  if (consecHard >= 3) {
    riskScore += 20; factors.push({ label: `${consecHard} hard days`, severity: 'moderate', detail: { en: `${consecHard} consecutive high-RPE sessions. Insert an easy day.`, tr: `${consecHard} ardışık yüksek ZY seansı. Kolay bir gün ekle.` } })
  }

  // Factor 4: Recovery deficit
  if (recovery?.length >= 3) {
    const recLast7 = recovery.filter(e => e.date >= w1)
    if (recLast7.length >= 2) {
      const avgRec = recLast7.reduce((s, e) => s + (e.score || 0), 0) / recLast7.length
      if (avgRec < 50) {
        riskScore += 25; factors.push({ label: `Readiness ${Math.round(avgRec)}/100`, severity: 'high', detail: { en: `Avg readiness ${Math.round(avgRec)}/100 this week — body signalling stress.`, tr: `Bu hafta ort. hazırlık ${Math.round(avgRec)}/100 — vücut stres sinyali veriyor.` } })
      } else if (avgRec < 65) {
        riskScore += 10; factors.push({ label: `Readiness ${Math.round(avgRec)}/100`, severity: 'low', detail: { en: `Below-average readiness ${Math.round(avgRec)}/100 — monitor.`, tr: `Ortalamanın altı hazırlık ${Math.round(avgRec)}/100 — izle.` } })
      }
    }
  }

  const level = riskScore >= 50 ? 'high' : riskScore >= 25 ? 'moderate' : 'low'
  const advice = {
    low:      { en: 'Injury risk low. Continue current training.', tr: 'Yaralanma riski düşük. Mevcut antrenmanı sürdür.' },
    moderate: { en: 'Moderate risk. Add 1 easy day this week; monitor recovery daily.', tr: 'Orta risk. Bu hafta 1 kolay gün ekle; toparlanmayı günlük izle.' },
    high:     { en: 'HIGH RISK — reduce intensity 20-30%, prioritize sleep & nutrition.', tr: 'YÜKSEK RİSK — yoğunluğu %20-30 azalt, uyku ve beslenmeye öncelik ver.' },
  }[level]

  return { level, score: Math.min(riskScore, 100), factors, advice }
}

// ─── 5. predictFitness ────────────────────────────────────────────────────────
// Projects CTL 4 and 8 weeks forward based on current trend.
export function predictFitness(log) {
  const ctl = computeCTL(log)
  const atl = computeATL(log)
  const tsb = ctl - atl

  if (!log?.length || ctl === 0) {
    return { current: 0, in4w: 0, in8w: 0, trajectory: 'flat', label: { en: 'No data', tr: 'Veri yok' } }
  }

  // Weekly TSS trend over last 4 weeks
  const w1 = tssInWindow(log, daysAgoDate(7),  daysAgoDate(0))
  const w2 = tssInWindow(log, daysAgoDate(14), daysAgoDate(7))
  const w3 = tssInWindow(log, daysAgoDate(21), daysAgoDate(14))
  const w4 = tssInWindow(log, daysAgoDate(28), daysAgoDate(21))
  const avgWeeklyTSS = (w1 + w2 + w3 + w4) / 4

  // CTL responds to sustained load: steady-state CTL ≈ avg_daily_TSS
  const avgDailyTSS = avgWeeklyTSS / 7
  // Project forward: CTL trend toward avg daily TSS (EMA constant 42)
  const project = (start, target, days) => {
    let c = start
    const k = 2 / (42 + 1)
    for (let i = 0; i < days; i++) c = target * k + c * (1 - k)
    return Math.round(c)
  }

  const in4w = project(ctl, avgDailyTSS, 28)
  const in8w = project(ctl, avgDailyTSS, 56)
  const ctlChange4w = in4w - ctl

  const trajectory = ctlChange4w > 3 ? 'improving' : ctlChange4w < -3 ? 'declining' : 'stable'

  const label = {
    improving: { en: `Fitness improving — projected +${ctlChange4w} CTL in 4 weeks.`, tr: `Kondisyon artıyor — 4 haftada tahmini +${ctlChange4w} KTY.` },
    declining: { en: `Fitness declining — reduce volume less aggressively or add base work.`, tr: `Kondisyon düşüyor — hacmi daha az agresif azalt ya da baz antrenman ekle.` },
    stable:    { en: `Fitness holding steady (CTL ${ctl}). Ready to absorb a small load increase.`, tr: `Kondisyon sabit (KTY ${ctl}). Küçük bir yük artışını absorbe etmeye hazır.` },
  }[trajectory]

  return { current: ctl, tsb, in4w, in8w, trajectory, avgWeeklyTSS: Math.round(avgWeeklyTSS), label }
}

// ─── 6. scoreSession ──────────────────────────────────────────────────────────
// Scores 0-100 a single completed session based on context.
export function scoreSession(entry, log, profile) {
  if (!entry) return { score: 50, grade: 'B', feedback: { en: 'Session logged.', tr: 'Seans kaydedildi.' } }

  let score = 50
  const rpe   = parseFloat(entry.rpe)   || 5
  const dur   = parseFloat(entry.duration) || 0
  const tss   = parseFloat(entry.tss)   || 0
  const type  = (entry.type || '').toLowerCase()

  // Duration bonus
  const recentDurs = (log || []).slice(-10).map(e => e.duration || 0).filter(d => d > 0)
  const avgDur = recentDurs.length ? recentDurs.reduce((s, v) => s + v, 0) / recentDurs.length : 45
  if (dur >= avgDur * 0.9) score += 10
  if (dur >= avgDur * 1.1) score += 5

  // RPE context: easy days should be easy, hard days should feel hard
  const isEasy    = type.includes('easy') || type.includes('recovery') || type.includes('z1') || type.includes('z2')
  const isHard    = type.includes('threshold') || type.includes('interval') || type.includes('race') || type.includes('tempo')
  if (isEasy && rpe <= 5) score += 15
  else if (isEasy && rpe >= 7) score -= 10
  else if (isHard && rpe >= 7) score += 15
  else if (isHard && rpe <= 4) score -= 5

  // TSS quality
  if (tss > 0) {
    const avgTSS = (log || []).slice(-10).filter(e => e.tss > 0).reduce((s, e, _, a) => s + e.tss / a.length, 0)
    if (avgTSS > 0 && tss >= avgTSS * 0.7) score += 10
  }

  // Zone data bonus
  if (entry.zones && entry.zones.some(z => z > 0)) score += 5

  // Recovery context: bad readiness + hard session = lower score
  const todayRec = (profile?.lastReadiness) || null
  if (todayRec !== null && todayRec < 50 && rpe >= 7) score -= 15

  score = Math.min(100, Math.max(0, Math.round(score)))

  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D'
  const feedbackMap = {
    A: {
      en: isEasy ? 'Perfect easy day — aerobic base built.' : 'Quality session — physiological stimulus achieved.',
      tr: isEasy ? 'Mükemmel kolay gün — aerobik baz güçlendi.' : 'Kaliteli seans — fizyolojik uyarım sağlandı.'
    },
    B: {
      en: 'Good session. Consistent training accumulates fitness.',
      tr: 'İyi seans. Tutarlı antrenman kondisyon biriktirir.'
    },
    C: {
      en: isEasy ? 'Easy session felt moderate — try keeping RPE ≤5 on recovery days.' : 'Moderate quality. Review intensity distribution.',
      tr: isEasy ? 'Kolay seans biraz yorucu hissettirdi — toparlanma günlerinde ZY ≤5 dene.' : 'Orta kalite. Yoğunluk dağılımını gözden geçir.'
    },
    D: {
      en: 'Session flagged — check recovery and intensity pairing.',
      tr: 'Seans işaretlendi — toparlanma ve yoğunluk eşleşmesini kontrol et.'
    },
  }

  return { score, grade, feedback: feedbackMap[grade] }
}

// ─── v4.4: generateWeeklyNarrative ────────────────────────────────────────────
// Produces a 3-5 sentence narrative of the past week's training in EN + TR.
export function generateWeeklyNarrative(log, recovery, profile, lang) {
  const w1Start = daysAgoDate(7)
  const week    = (log || []).filter(e => e.date >= w1Start)
  const recWeek = (recovery || []).filter(e => e.date >= w1Start)
  const name    = profile?.name ? profile.name.split(' ')[0] : null

  const n = week.length
  const totalMin = week.reduce((s, e) => s + (e.duration || 0), 0)
  const totalTSS = week.reduce((s, e) => s + (e.tss || 0), 0)
  const avgRPE   = n ? Math.round(week.reduce((s, e) => s + (e.rpe || 0), 0) / n * 10) / 10 : 0
  const avgRec   = recWeek.length ? Math.round(recWeek.reduce((s, e) => s + (e.score || 0), 0) / recWeek.length) : null

  const { trend, change } = analyzeLoadTrend(log)
  const { level: riskLevel } = predictInjuryRisk(log, recovery)
  const { z1z2Pct } = analyzeZoneBalance(log)
  const hrs = Math.floor(totalMin / 60), mins = totalMin % 60
  const volStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} minutes`

  const trendPhrase = {
    building:     { en: 'a building week', tr: 'bir yük artış haftası' },
    recovering:   { en: 'a recovery week', tr: 'bir toparlanma haftası' },
    peaking:      { en: 'a peak-load week', tr: 'bir doruk yük haftası' },
    inconsistent: { en: 'an inconsistent week', tr: 'tutarsız bir hafta' },
  }[trend] || { en: 'a training week', tr: 'bir antrenman haftası' }

  const recPhrase = avgRec !== null
    ? (avgRec >= 70
      ? { en: `Readiness averaged ${avgRec}/100 — body adapting well.`, tr: `Hazırlık ortalaması ${avgRec}/100 — vücut iyi adapte oluyor.` }
      : avgRec >= 50
      ? { en: `Readiness averaged ${avgRec}/100 — adequate recovery.`, tr: `Hazırlık ortalaması ${avgRec}/100 — yeterli toparlanma.` }
      : { en: `Readiness averaged ${avgRec}/100 — prioritise sleep and nutrition.`, tr: `Hazırlık ortalaması ${avgRec}/100 — uyku ve beslenmeye öncelik ver.` })
    : { en: '', tr: '' }

  const riskPhrase = riskLevel === 'high'
    ? { en: 'Injury risk is elevated — consider an easy day.', tr: 'Yaralanma riski yüksek — kolay bir gün düşün.' }
    : riskLevel === 'moderate'
    ? { en: 'Keep monitoring load balance.', tr: 'Yük dengesini izlemeye devam et.' }
    : { en: 'Keep training consistently.', tr: 'Tutarlı antrenmanına devam et.' }

  const greeting = name ? `${name}, ` : ''

  const en = [
    `${greeting}this was ${trendPhrase.en}: ${n} session${n !== 1 ? 's' : ''}, ${volStr} total, ${totalTSS} TSS.`,
    avgRPE > 0 ? `Average perceived effort was ${avgRPE}/10, with ${z1z2Pct}% of volume in easy zones.` : null,
    recPhrase.en || null,
    riskPhrase.en,
  ].filter(Boolean).join(' ')

  const tr = [
    `${greeting}bu ${trendPhrase.tr} oldu: ${n} antrenman, toplam ${volStr}, ${totalTSS} TSS.`,
    avgRPE > 0 ? `Ortalama algılanan yoğunluk ${avgRPE}/10, hacmin %${z1z2Pct}'i kolay zonlarda.` : null,
    recPhrase.tr || null,
    riskPhrase.tr,
  ].filter(Boolean).join(' ')

  return { en, tr, n, totalMin, totalTSS, avgRPE }
}

// ─── v4.4: detectMilestones ────────────────────────────────────────────────────
// Returns array of newly achieved milestones (not in prevMilestones set).
export function detectMilestones(log, profile, prevMilestones) {
  const prev = new Set(prevMilestones || [])
  const newOnes = []

  const check = (id, condition, en, tr, emoji) => {
    if (!prev.has(id) && condition) newOnes.push({ id, en, tr, emoji })
  }

  const n      = log?.length || 0
  const ctl    = computeCTL(log || [])
  const totalH = Math.round((log || []).reduce((s, e) => s + (e.duration || 0), 0) / 60)
  const maxTSS = Math.max(...(log || []).map(e => e.tss || 0), 0)
  const maxRPE = Math.max(...(log || []).map(e => e.rpe || 0), 0)
  const daysSpan = n >= 2 ? Math.round((new Date(log[n - 1].date) - new Date(log[0].date)) / 864e5) : 0
  const last30 = (log || []).filter(e => e.date >= daysAgoDate(30)).length
  const last7  = (log || []).filter(e => e.date >= daysAgoDate(7)).length

  check('first_session',    n >= 1,       'First session logged!',                  'İlk antrenman kaydedildi!',                   '🏃')
  check('ten_sessions',     n >= 10,      'Ten sessions logged!',                   'On antrenman tamamlandı!',                    '⭐')
  check('fifty_sessions',   n >= 50,      '50 sessions milestone!',                 '50 antrenman kilometre taşı!',                '🌟')
  check('hundred_sessions', n >= 100,     '100 sessions! You\'re consistent.',       '100 antrenman! Tutarlılığın ilham veriyor.',  '💯')
  check('five_hundred_h',   totalH >= 500,'500 training hours logged!',             '500 antrenman saati kaydedildi!',             '⏱️')
  check('hundred_h',        totalH >= 100,'100 training hours — solid base.',        '100 antrenman saati — sağlam baz.',           '⌚')
  check('ctl_50',           ctl >= 50,    'CTL reached 50 — proper training load.', 'KTY 50\'ye ulaştı — doğru antrenman yükü.',   '📈')
  check('ctl_80',           ctl >= 80,    'CTL 80 — trained athlete territory.',    'KTY 80 — eğitimli sporcu bölgesi.',           '🔥')
  check('ctl_100',          ctl >= 100,   'CTL 100 — elite fitness level!',         'KTY 100 — elit kondisyon seviyesi!',          '🏆')
  check('tss_200',          maxTSS >= 200,'First 200+ TSS session — epic effort.',  'İlk 200+ TSS seansı — destansı çaba.',        '⚡')
  check('month_consistent', last30 >= 12, '12+ sessions in 30 days — consistent!', '30 günde 12+ antrenman — tutarlısın!',        '📅')
  check('three_year_span',  daysSpan >= 365, 'One year of training data!',          'Bir yıllık antrenman verisi!',                '🎂')
  check('streak_5',         last7 >= 5,   '5 sessions this week — outstanding!',   'Bu hafta 5 antrenman — mükemmel!',            '🔥')

  return newOnes
}
