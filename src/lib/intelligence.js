// ─── intelligence.js — Pure sport-science reasoning (no React) ────────────────
// v4.3: analyzeLoadTrend, analyzeRecoveryCorrelation, analyzeZoneBalance,
//        predictInjuryRisk, predictFitness, scoreSession
// v4.4: generateWeeklyNarrative, detectMilestones
// v4.6: computeRaceReadiness, predictRacePerformance
// v4.7: VDOT Daniels table integration, HRV injury factor

import { estimateVDOT, getTrainingPaces, predictTime } from './vdot.js'

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
// 5-factor injury risk: ACWR(25%) + Monotony(20%) + ConsecHard(20%) +
// RecoveryDeficit(15%) + HRV(20% when available, redistributed when not).
export function predictInjuryRisk(log, recovery) {
  const factors = []
  let riskScore = 0

  if (!log?.length) {
    return { level: 'unknown', score: 0, factors: [], advice: { en: 'Log sessions to assess injury risk.', tr: 'Yaralanma riskini değerlendirmek için antrenman kaydet.' } }
  }

  const now = daysAgoDate(0)
  const w1 = daysAgoDate(7), w4 = daysAgoDate(28)

  // Factor 1: ACWR (weight 25 when HRV present, 30 without)
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

  // Factor 2: Training monotony (Banister — safe < 2.0)
  const last7tss = []
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoDate(i)
    last7tss.push(log.filter(e => e.date === d).reduce((s, e) => s + (e.tss || 0), 0))
  }
  const mean7 = last7tss.reduce((s, v) => s + v, 0) / 7
  const std7  = Math.sqrt(last7tss.reduce((s, v) => s + (v - mean7) ** 2, 0) / 7)
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

  // Factor 5: HRV (rMSSD) — 7-day CV >10% OR single-day drop >15% from 7d mean
  if (recovery?.length >= 3) {
    const recHRV = recovery
      .filter(e => e.date >= w1 && parseFloat(e.hrv) > 0)
      .map(e => parseFloat(e.hrv))
    if (recHRV.length >= 3) {
      const hrvMean = recHRV.reduce((s,v)=>s+v,0) / recHRV.length
      const hrvStd  = Math.sqrt(recHRV.reduce((s,v)=>s+(v-hrvMean)**2,0)/recHRV.length)
      const cv      = hrvMean > 0 ? hrvStd / hrvMean : 0
      const latest  = recHRV[recHRV.length - 1]
      const drop    = hrvMean > 0 ? (hrvMean - latest) / hrvMean : 0
      if (cv > 0.10) {
        riskScore += 20; factors.push({ label: `HRV CV ${(cv*100).toFixed(0)}%`, severity: 'high', detail: { en: `HRV coefficient of variation ${(cv*100).toFixed(0)}% — autonomic instability.`, tr: `HRV değişkenlik katsayısı ${(cv*100).toFixed(0)}% — otonom dengesizlik.` } })
      } else if (drop > 0.15) {
        riskScore += 15; factors.push({ label: `HRV drop ${(drop*100).toFixed(0)}%`, severity: 'moderate', detail: { en: `Today's HRV ${(drop*100).toFixed(0)}% below 7-day mean — consider easy day.`, tr: `Bugünkü HRV 7 günlük ortalamanın %${(drop*100).toFixed(0)} altında — kolay gün düşün.` } })
      }
    }
  }

  const level = riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MODERATE' : 'LOW'
  const advice = {
    LOW:      { en: 'Injury risk low. Continue current training.', tr: 'Yaralanma riski düşük. Mevcut antrenmanı sürdür.' },
    MODERATE: { en: 'Moderate risk. Add 1 easy day this week; monitor recovery daily.', tr: 'Orta risk. Bu hafta 1 kolay gün ekle; toparlanmayı günlük izle.' },
    HIGH:     { en: 'HIGH RISK — reduce intensity 20-30%, prioritize sleep & nutrition.', tr: 'YÜKSEK RİSK — yoğunluğu %20-30 azalt, uyku ve beslenmeye öncelik ver.' },
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

  const riskPhrase = riskLevel === 'HIGH'
    ? { en: 'Injury risk is elevated — consider an easy day.', tr: 'Yaralanma riski yüksek — kolay bir gün düşün.' }
    : riskLevel === 'MODERATE'
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

// ─── v4.6: computeRaceReadiness ───────────────────────────────────────────────
// 10-factor weighted composite (0–100, A+ through F).
export function computeRaceReadiness(log, recovery, injuries, profile, plan, planStatus) {
  const ctl = computeCTL(log)
  const atl = computeATL(log)
  const tsb = ctl - atl

  const goal = (profile?.goal || '').toLowerCase()
  const raceDate = profile?.raceDate || null
  const daysToRace = raceDate ? Math.ceil((new Date(raceDate) - new Date()) / 864e5) : null

  // ── Factor helpers ──────────────────────────────────────────────────────────
  // 1. FITNESS
  const targetCTL = goal.includes('5k') ? 40 : goal.includes('10k') ? 50 : goal.includes('half') ? 60 : goal.includes('marathon') ? 70 : goal.includes('ironman') || goal.includes('triathlon') ? 90 : 55
  const fitnessScore = Math.min(100, Math.round(ctl / targetCTL * 100))

  // 2. FRESHNESS (TSB)
  const freshnessScore = tsb >= 5 && tsb <= 20 ? 100 : tsb >= 0 && tsb < 5 ? 80 : tsb >= -5 && tsb < 0 ? 60 : tsb < -5 ? 30 : tsb > 20 ? 50 : 50

  // 3. TAPER QUALITY
  let taperScore = 50
  if (daysToRace !== null && daysToRace <= 21 && log.length >= 4) {
    const peakWeek = daysAgoDate(28)
    const peakTSS = tssInWindow(log, peakWeek, daysAgoDate(21))
    const lastWeekTSS = tssInWindow(log, daysAgoDate(7), daysAgoDate(0))
    const reduction = peakTSS > 0 ? (1 - lastWeekTSS / peakTSS) * 100 : 0
    taperScore = reduction >= 40 && reduction <= 65 ? 100 : reduction >= 25 && reduction < 40 ? 75 : reduction > 65 ? 60 : daysToRace <= 14 ? 20 : 50
  }

  // 4. TRAINING CONSISTENCY (8-week avg sessions/week)
  const w8log = log.filter(e => e.date >= daysAgoDate(56))
  const avgWeeklySess = w8log.length / 8
  const consistencyScore = avgWeeklySess >= 5 ? 100 : avgWeeklySess >= 4 ? 80 : avgWeeklySess >= 3 ? 60 : 30

  // 5. RECOVERY STATE
  const rec7 = recovery?.filter(e => e.date >= daysAgoDate(7)) || []
  const avgRec = rec7.length ? rec7.reduce((s, e) => s + (e.score || 0), 0) / rec7.length : null
  const recoveryScore = avgRec === null ? 50 : avgRec >= 75 ? 100 : avgRec >= 60 ? 80 : avgRec >= 50 ? 60 : 30

  // 6. SLEEP QUALITY (average sleepHrs last 7 days)
  const sleepEntries = rec7.filter(e => parseFloat(e.sleepHrs) > 0)
  const avgSleep = sleepEntries.length ? sleepEntries.reduce((s, e) => s + parseFloat(e.sleepHrs), 0) / sleepEntries.length : null
  const sleepScore = avgSleep === null ? 50 : avgSleep >= 7.5 ? 100 : avgSleep >= 7 ? 80 : avgSleep >= 6.5 ? 60 : 30

  // 7. INJURY STATUS
  const recentInj = injuries?.filter(i => i.date >= daysAgoDate(14)) || []
  const maxPain   = recentInj.reduce((m, i) => Math.max(m, i.level || 0), 0)
  const injuryScore = maxPain === 0 ? 100 : maxPain <= 2 ? 70 : maxPain <= 4 ? 40 : 10

  // 8. PLAN COMPLIANCE
  let complianceScore = 50
  if (plan && planStatus) {
    let total = 0, done = 0
    plan.weeks?.forEach((w, wi) => {
      w.sessions?.forEach((s, di) => {
        if (s.type !== 'Rest' && s.duration > 0) {
          total++
          const st = planStatus[`${wi}-${di}`]
          if (st === 'done' || st === 'modified') done++
        }
      })
    })
    if (total > 0) {
      const pct = done / total * 100
      complianceScore = pct >= 85 ? 100 : pct >= 70 ? 80 : pct >= 50 ? 60 : 30
    }
  }

  // 9. ZONE DISTRIBUTION
  const { z1z2Pct } = analyzeZoneBalance(log)
  const zoneScore = z1z2Pct >= 70 ? 100 : z1z2Pct >= 55 ? 70 : 40

  // 10. LONG RUN / KEY WORKOUT READINESS
  const longRuns = log.filter(e => e.date >= daysAgoDate(28) && (e.duration || 0) > 60)
  const longestMin = longRuns.length ? Math.max(...longRuns.map(e => e.duration || 0)) : 0
  let longRunScore = 50
  if (goal.includes('marathon')) {
    longRunScore = longestMin >= 200 ? 100 : longestMin >= 180 ? 80 : longestMin >= 150 ? 60 : 40
  } else if (goal.includes('half')) {
    longRunScore = longestMin >= 110 ? 100 : longestMin >= 90 ? 80 : longestMin >= 70 ? 60 : 40
  } else if (goal.includes('10k')) {
    longRunScore = longestMin >= 70 ? 100 : longestMin >= 50 ? 80 : 60
  } else if (goal.includes('5k')) {
    longRunScore = 60 + Math.min(40, longestMin / 2)
  }

  // ── Weighted composite ──────────────────────────────────────────────────────
  const factors = [
    { name: 'FITNESS',      score: fitnessScore,     weight: 0.20, en: `CTL ${ctl} vs target ${targetCTL} for ${goal || 'your goal'}.`,     tr: `KTY ${ctl}, hedef ${targetCTL}.` },
    { name: 'FRESHNESS',    score: freshnessScore,   weight: 0.15, en: `TSB ${tsb >= 0 ? '+' : ''}${tsb} — ${tsb >= 5 && tsb <= 20 ? 'optimal taper range.' : tsb < -5 ? 'fatigued.' : tsb > 20 ? 'too much rest.' : 'slightly low.'}`, tr: `TSB ${tsb >= 0 ? '+' : ''}${tsb}.` },
    { name: 'TAPER',        score: taperScore,       weight: 0.10, en: daysToRace ? `${daysToRace} days to race — ${taperScore >= 90 ? 'taper on track.' : taperScore < 40 ? 'taper not initiated.' : 'partial taper.'}` : 'No race date set.', tr: daysToRace ? `Yarışa ${daysToRace} gün.` : 'Yarış tarihi yok.' },
    { name: 'CONSISTENCY',  score: consistencyScore, weight: 0.10, en: `${avgWeeklySess.toFixed(1)} sessions/week avg (8 weeks).`,          tr: `Haftalık ort. ${avgWeeklySess.toFixed(1)} seans (8 hafta).` },
    { name: 'RECOVERY',     score: recoveryScore,    weight: 0.10, en: avgRec ? `7-day avg readiness: ${Math.round(avgRec)}/100.` : 'No recovery data.', tr: avgRec ? `7 günlük ort. hazırlık: ${Math.round(avgRec)}/100.` : 'Toparlanma verisi yok.' },
    { name: 'SLEEP',        score: sleepScore,       weight: 0.08, en: avgSleep ? `7-day avg sleep: ${avgSleep.toFixed(1)}h.` : 'No sleep data logged.', tr: avgSleep ? `7 günlük ort. uyku: ${avgSleep.toFixed(1)} saat.` : 'Uyku verisi yok.' },
    { name: 'INJURY',       score: injuryScore,      weight: 0.08, en: maxPain === 0 ? 'No injuries in 14 days.' : `Recent injury (pain ${maxPain}/5).`, tr: maxPain === 0 ? 'Son 14 günde yaralanma yok.' : `Son yaralanma (ağrı ${maxPain}/5).` },
    { name: 'COMPLIANCE',   score: complianceScore,  weight: 0.07, en: plan ? `Plan compliance score.` : 'No training plan set.', tr: plan ? 'Plan uyumu skoru.' : 'Antrenman planı yok.' },
    { name: 'ZONE BALANCE', score: zoneScore,        weight: 0.07, en: `${z1z2Pct}% easy volume (target ≥70%).`,                           tr: `%${z1z2Pct} kolay hacim (hedef ≥%70).` },
    { name: 'LONG SESSION', score: longRunScore,     weight: 0.05, en: longestMin > 0 ? `Longest session in 4 weeks: ${longestMin}min.` : 'No long sessions in 4 weeks.', tr: longestMin > 0 ? `4 haftada en uzun seans: ${longestMin} dak.` : '4 haftada uzun seans yok.' },
  ]

  const composite = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0))
  const grade = composite >= 95 ? 'A+' : composite >= 85 ? 'A' : composite >= 70 ? 'B' : composite >= 55 ? 'C' : composite >= 40 ? 'D' : 'F'

  const verdicts = {
    'A+': { en: "You're in the best shape of this training block. Trust the work — go race.", tr: "Bu antrenman bloğunun en iyi formundasınız. Yapılan işe güvenin — yarışın." },
    'A':  { en: "Race-ready. Minor areas to optimize but you're well-prepared.", tr: "Yarışa hazır. Küçük optimizasyon alanları var ama iyi hazırlanmışsınız." },
    'B':  { en: `Solid preparation. Focus on improving ${factors.sort((a, b) => a.score - b.score)[0].name.toLowerCase()}.`, tr: `Sağlam hazırlık. ${factors.sort((a, b) => a.score - b.score)[0].name.toLowerCase()} geliştirmeye odaklan.` },
    'C':  { en: `Partially prepared. Consider adjusting race target. Gaps: ${factors.sort((a, b) => a.score - b.score).slice(0,2).map(f=>f.name.toLowerCase()).join(', ')}.`, tr: `Kısmen hazır. Yarış hedefini ayarlamayı düşün.` },
    'D':  { en: "Not recommended to race at full intensity. Consider a B-goal or training race.", tr: "Tam yoğunlukta yarış önerilmiyor. B-hedefi veya antrenman yarışı düşünün." },
    'F':  { en: "Significant preparation gaps. Recommend postponing peak effort.", tr: "Önemli hazırlık eksiklikleri. Zirve efor ertelemesi öneriliyor." },
  }

  const confidence = log.length >= 28 && recovery?.length >= 14 ? 'high' : log.length >= 14 ? 'moderate' : 'low'

  return { score: composite, grade, factors, verdict: verdicts[grade], confidence, daysToRace }
}

// ─── v5.14: getTodayPlannedSession ────────────────────────────────────────────
// Returns today's planned session from a saved plan, or null if rest/no plan.
export function getTodayPlannedSession(plan, today) {
  if (!plan || !Array.isArray(plan.weeks) || !plan.generatedAt) return null
  const todayDate = today || new Date().toISOString().slice(0, 10)
  const start = new Date(plan.generatedAt)
  const cur   = new Date(todayDate)
  const daysDiff = Math.floor((cur - start) / 86400000)
  if (daysDiff < 0) return null
  const weekIdx    = Math.floor(daysDiff / 7)
  if (weekIdx >= plan.weeks.length) return null
  const planDayIdx = (new Date(todayDate).getDay() + 6) % 7  // Mon=0…Sun=6
  const week = plan.weeks[weekIdx]
  if (!week || !Array.isArray(week.sessions)) return null
  const session = week.sessions[planDayIdx]
  if (!session || session.type === 'Rest' || (session.duration || 0) <= 0) return null
  return { ...session, weekIdx, dayIdx: planDayIdx, weekPhase: week.phase || '' }
}

// ─── v5.14: getSingleSuggestion ───────────────────────────────────────────────
// Returns the single most actionable suggestion for today.
// Returns { text: { en, tr }, level: 'info' | 'warning' | 'ok' }
export function getSingleSuggestion(log, recovery, profile) {
  const safeLog = Array.isArray(log) ? log : []
  const safeRec = Array.isArray(recovery) ? recovery : []

  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = daysAgoDate(1)

  const lastSession = safeLog.length ? [...safeLog].sort((a, b) => b.date.localeCompare(a.date))[0] : null
  const daysSinceSession = lastSession ? Math.floor((new Date(today) - new Date(lastSession.date)) / 86400000) : null

  const todayRec = safeRec.find(e => e.date === today)
  const yestRec  = safeRec.find(e => e.date === yesterday)
  const recentRecScore = todayRec?.score ?? yestRec?.score ?? null

  const ctl = computeCTL(safeLog)
  const atl = computeATL(safeLog)
  const tsb = ctl - atl

  const w7Start  = daysAgoDate(7)
  const w14Start = daysAgoDate(14)
  const thisWeekTSS = safeLog.filter(e => e.date >= w7Start).reduce((s, e) => s + (e.tss || 0), 0)
  const prevWeekTSS = safeLog.filter(e => e.date >= w14Start && e.date < w7Start).reduce((s, e) => s + (e.tss || 0), 0)
  const spikeP = prevWeekTSS > 10 ? Math.round((thisWeekTSS - prevWeekTSS) / prevWeekTSS * 100) : 0

  if (tsb < -20) {
    return { level: 'warning', text: { en: `Form is ${tsb} — large fatigue debt. Consider a rest or easy day today.`, tr: `Form ${tsb} — yüksek yorgunluk birikimi. Bugün kolay veya dinlenme günü düşün.` } }
  }
  if (spikeP >= 20) {
    return { level: 'warning', text: { en: `Load jumped ${spikeP}% this week vs last. Ease off to avoid overtraining.`, tr: `Bu hafta yük %${spikeP} arttı. Aşırı antrenmanı önlemek için yavaşla.` } }
  }
  if (daysSinceSession !== null && daysSinceSession >= 4 && safeLog.length >= 3) {
    return { level: 'info', text: { en: `${daysSinceSession} days since last session. A light 30–40 min easy effort will restart momentum.`, tr: `Son antrenmandan ${daysSinceSession} gün geçti. 30-40 dk hafif çalışma ivmeyi yeniden başlatır.` } }
  }
  if (recentRecScore !== null && recentRecScore < 45) {
    return { level: 'warning', text: { en: 'Low readiness score. Prioritise sleep, easy movement, or full rest.', tr: 'Düşük hazırlık skoru. Uyku, hafif hareket veya tam dinlenmeye öncelik ver.' } }
  }
  if (tsb >= 5 && tsb <= 20) {
    return { level: 'ok', text: { en: `TSB +${tsb} — form is positive. Good day for a key session or race effort.`, tr: `TSB +${tsb} — form pozitif. Anahtar seans veya yarış eforu için iyi gün.` } }
  }
  if (recentRecScore !== null && recentRecScore >= 75) {
    return { level: 'ok', text: { en: 'Readiness is high — body recovered. Push today if the plan calls for it.', tr: 'Hazırlık yüksek — vücut toparlanmış. Plan gerektiriyorsa bugün zorla.' } }
  }
  const n7 = safeLog.filter(e => e.date >= w7Start).length
  if (n7 >= 4) {
    return { level: 'ok', text: { en: `${n7} sessions this week — on track. Stick to your planned effort.`, tr: `Bu hafta ${n7} antrenman — yolunda. Planlanan eforu sürdür.` } }
  }
  return { level: 'info', text: { en: 'Log today\'s session to keep your training data current.', tr: 'Antrenman verilerini güncel tutmak için bugünkü seansı kaydet.' } }
}

// ─── v4.6: predictRacePerformance ─────────────────────────────────────────────
// Multi-method prediction. Returns times for multiple distances + training paces.
export function predictRacePerformance(log, testResults, profile) {
  const ctl = computeCTL(log)
  const ftp  = parseFloat(profile?.ftp  || 0)
  const vo2  = parseFloat(profile?.vo2max || 0)
  const ltPace = profile?.ltPace ? (() => {
    const p = profile.ltPace.split(':').map(Number)
    return p.length === 2 ? p[0] * 60 + p[1] : 0
  })() : 0

  // Method A: VO2max → VDOT via Daniels table
  const vdotFromVO2 = vo2 > 0 ? (() => {
    const vdot = vo2 * 0.995  // VDOT ≈ VO2max (Daniels 1998)
    return { vdot }
  })() : null

  // Method B: Recent test result
  const recentTests = (testResults || []).filter(tr => {
    const age = (Date.now() - new Date(tr.date).getTime()) / (7 * 864e5)
    return age <= 8
  }).sort((a, b) => b.date > a.date ? 1 : -1)

  const recentFTP   = recentTests.find(t => ['ramp','ftp20'].includes(t.testId))
  const recentVO2   = recentTests.find(t => ['cooper','yyir1','astrand'].includes(t.testId))
  const recentRace  = recentTests.find(t => t.testId === 'race')

  // Method C: Riegel from best known result with CTL-adjusted exponent
  const riegelPredict = (t1, d1, d2) => {
    const exp = 1.06 + 0.001 * Math.max(0, 70 - ctl)
    return t1 * Math.pow(d2 / d1, exp)
  }

  const targets = [
    { label: '5K',       dist: 5000 },
    { label: '10K',      dist: 10000 },
    { label: 'Half',     dist: 21097 },
    { label: 'Marathon', dist: 42195 },
  ]

  let baseTimeSec = 0, baseDist = 0, method = 'training_pace'

  if (recentRace) {
    const parts = String(recentRace.value).split(':').map(Number)
    baseTimeSec = parts.length === 3 ? parts[0]*3600+parts[1]*60+parts[2] : parts.length === 2 ? parts[0]*60+parts[1] : 0
    baseDist = parseFloat(recentRace.unit) || 10000
    method = 'riegel_ctladjusted'
  } else if (ltPace > 0) {
    baseTimeSec = ltPace    // per km
    baseDist = 1000
    method = 'ltpace_riegel'
  } else if (vo2 > 0) {
    // Rough VO2max→10K time via Daniels' tables (simplified linear interpolation)
    // VO2 30→90 maps to roughly 10K 72:00→27:00
    baseTimeSec = Math.max(1600, Math.round(7200 - (vo2 - 30) * 75))
    baseDist = 10000
    method = 'vo2max_daniels'
  } else if (recentVO2) {
    const v = parseFloat(recentVO2.value)
    baseTimeSec = Math.max(1600, Math.round(7200 - (v - 30) * 75))
    baseDist = 10000
    method = 'vo2max_daniels'
  }

  if (!baseTimeSec || !baseDist) {
    // Fallback: estimate from training log paces
    const runs = log.filter(e => (e.type || '').toLowerCase().includes('run') || (e.type || '').toLowerCase().includes('tempo'))
    if (runs.length >= 3) {
      const avgPace = runs.slice(-5).reduce((s, e) => {
        const spd = e.duration ? e.duration / 60 : 0
        return s + (spd > 0 ? 60 / spd : 0)
      }, 0) / Math.min(5, runs.length) * 1.08  // +8% from easy→race pace
      if (avgPace > 0) {
        baseTimeSec = Math.round(avgPace * 600)  // 10K equiv
        baseDist = 10000
        method = 'training_pace'
      }
    }
  }

  if (!baseTimeSec) {
    return { predictions: [], reliable: false, method: 'insufficient_data', trainingPaces: null }
  }

  const fmt = s => { s=Math.round(s); const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return h>0?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}` }

  const predictions = targets.map(({ label, dist }) => {
    const predicted = Math.round(riegelPredict(baseTimeSec, baseDist, dist))
    const best  = Math.round(predicted * 0.97)
    const worst = Math.round(predicted * 1.08)
    return { label, predicted: fmt(predicted), best: fmt(best), worst: fmt(worst), dist }
  })

  // Derive VDOT from best prediction (5K equivalent) for training paces
  const predicted5k = Math.round(riegelPredict(baseTimeSec, baseDist, 5000))
  const derivedVdot = estimateVDOT(5000, predicted5k)
  const rawPaces    = derivedVdot ? getTrainingPaces(derivedVdot) : null
  const trainingPaces = rawPaces ? {
    easy:      fmt(rawPaces.easy * 1),       // already sec/km — format as per-km pace
    marathon:  fmt(rawPaces.marathon * 1),
    threshold: fmt(rawPaces.threshold * 1),
    interval:  fmt(rawPaces.interval * 1),
    rep:       fmt(rawPaces.rep * 1),
    vdot:      Math.round(derivedVdot * 10) / 10,
  } : null

  const methodLabel = {
    riegel_ctladjusted: `CTL-adjusted Riegel from recent result`,
    ltpace_riegel:      `Riegel projection from LT pace`,
    vo2max_daniels:     `Daniels VDOT from VO₂max ${vo2 || parseFloat(recentVO2?.value||0).toFixed(0)}`,
    training_pace:      `Estimated from recent training paces`,
  }[method]

  return {
    predictions,
    reliable: baseTimeSec > 0 && (method !== 'training_pace' || log.length >= 10),
    method: methodLabel,
    ctl,
    trainingPaces,
    vdot: derivedVdot,
  }
}

// ─── Data Quality Indicator (v5.1) ────────────────────────────────────────────
// 6-factor weighted score 0-100 → grade A-F
// assessDataQuality(log, recovery, testResults, profile)
export function assessDataQuality(log, recovery, testResults, profile) {
  const d28 = daysAgoDate(28)
  const log28 = log.filter(e => e.date >= d28)
  const rec28 = (recovery || []).filter(e => e.date >= d28)

  // Factor 1 — Logging consistency (25%)
  const uniqueDays = new Set(log28.map(e => e.date)).size
  const consistencyScore = Math.min(100, Math.round(uniqueDays / 28 * 100 * (7 / 5)))  // 5 sessions/wk = 100

  // Factor 2 — RPE quality (15%): variance > 1.5 across session types = good
  const rpeValues = log28.map(e => e.rpe).filter(Boolean)
  let rpeScore = 50
  if (rpeValues.length >= 3) {
    const allSame = rpeValues.every(v => v === rpeValues[0])
    const allFive = rpeValues.every(v => v === 5)
    if (allFive) rpeScore = 20
    else if (allSame) rpeScore = 40
    else {
      const mean = rpeValues.reduce((s,v)=>s+v,0)/rpeValues.length
      const variance = rpeValues.reduce((s,v)=>s+(v-mean)**2,0)/rpeValues.length
      rpeScore = Math.min(100, Math.round(variance * 25))
    }
  }

  // Factor 3 — Zone data (20%): sessions with zones or FIT import
  const withZones = log28.filter(e => e.zones || e.source === 'fit' || e.source === 'gpx').length
  const zoneScore = log28.length ? Math.round(withZones / log28.length * 100) : 30

  // Factor 4 — Recovery logging (20%): days with recovery entry
  const recoveryScore = Math.min(100, Math.round(rec28.length / 28 * 100 * 1.5))  // 18/28 = 100

  // Factor 5 — Test recency (10%)
  const lastTest = testResults?.length ? testResults[testResults.length-1]?.date : null
  const weeksSinceTest = lastTest ? Math.floor((Date.now() - new Date(lastTest)) / (7*864e5)) : 99
  const testScore = weeksSinceTest <= 8 ? 100 : weeksSinceTest <= 16 ? 60 : weeksSinceTest <= 24 ? 30 : 10

  // Factor 6 — Profile completeness (10%)
  const fields = ['name','primarySport','age','weight','ftp','athleteLevel','goal']
  const filled = fields.filter(f => profile?.[f]).length
  const profileScore = Math.round(filled / fields.length * 100)

  const score = Math.round(
    consistencyScore * 0.25 +
    rpeScore         * 0.15 +
    zoneScore        * 0.20 +
    recoveryScore    * 0.20 +
    testScore        * 0.10 +
    profileScore     * 0.10
  )

  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F'
  const gradeColor = score >= 80 ? '#5bc25b' : score >= 65 ? '#0064ff' : score >= 50 ? '#f5c542' : '#e03030'

  const tips = []
  if (consistencyScore < 60)  tips.push({ en:'Log sessions more consistently — aim for 5 per week.', tr:'Antrenmanları daha düzenli kaydet — haftada 5 hedefle.' })
  if (rpeScore < 50)          tips.push({ en:'Vary your RPE honestly (3=easy, 9=hard). Constant 5 weakens all analysis.', tr:'RPE\'yi dürüstçe çeşitlendir (3=kolay, 9=zor). Sabit 5 tüm analizleri zayıflatır.' })
  if (zoneScore < 40)         tips.push({ en:'Import .fit files or add zone breakdown — powers accurate polarization analysis.', tr:'.fit dosyası yükle veya zon dağılımı ekle — polarizasyon analizini iyileştirir.' })
  if (recoveryScore < 40)     tips.push({ en:'Check in on the Recovery tab daily — 15 seconds, improves all predictions.', tr:'Recovery sekmesini her gün doldur — 15 saniye, tüm tahminleri iyileştirir.' })
  if (testScore < 60)         tips.push({ en:'Retest your fitness (Cooper, Ramp, or FTP) — data is over 8 weeks old.', tr:'Kondisyon testini yenile (Cooper, Ramp veya FTP) — veriler 8 haftadan eski.' })
  if (profileScore < 70)      tips.push({ en:'Complete your profile (FTP, age, weight, goal) for better recommendations.', tr:'Profili tamamla (FTP, yaş, kilo, hedef) daha iyi öneriler için.' })

  return {
    score,
    grade,
    gradeColor,
    factors: [
      { name:'LOGGING',   score: consistencyScore },
      { name:'RPE',       score: rpeScore },
      { name:'ZONES',     score: zoneScore },
      { name:'RECOVERY',  score: recoveryScore },
      { name:'TESTS',     score: testScore },
      { name:'PROFILE',   score: profileScore },
    ],
    tips,
  }
}
