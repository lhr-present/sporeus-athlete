// ─── patterns.js — Personalized pattern recognition (no React) ───────────────
// v4.5: correlateTrainingToResults, findRecoveryPatterns, mineInjuryPatterns,
//        findOptimalWeekStructure, findSeasonalPatterns

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function _dateStr(d) { return new Date(d).toISOString().slice(0, 10) }
function _daysBack(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function weekOf(dateString) {
  const d = new Date(dateString)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}
function _tssRange(log, from, to) {
  return log.filter(e => e.date >= from && e.date < to).reduce((s, e) => s + (e.tss || 0), 0)
}
function _zonePct(sessions, zoneIndex) {
  const totals = [0, 0, 0, 0, 0], _totalDur = sessions.reduce((s, e) => s + (e.duration || 0), 0)
  sessions.forEach(e => {
    const dur = e.duration || 0
    if (e.zones && e.zones.some(z => z > 0)) e.zones.forEach((z, i) => { if (i < 5) totals[i] += z })
    else { const r = e.rpe || 5; const zi = r <= 3 ? 0 : r <= 5 ? 1 : r <= 7 ? 2 : r === 8 ? 3 : 4; totals[zi] += dur }
  })
  const tot = totals.reduce((s, v) => s + v, 0) || 1
  return totals.map(v => Math.round(v / tot * 100))[zoneIndex]
}

// ── A) Training → Test Correlation ────────────────────────────────────────────
// Maps each test result to the 4-week training block that preceded it,
// then finds which training variable correlates most with better results.
export function correlateTrainingToResults(log, testResults) {
  if (!testResults?.length || testResults.length < 3) {
    return { patterns: [], dataPoints: testResults?.length || 0, reliable: false }
  }

  // Normalise values to numeric for comparison
  const testsByType = {}
  testResults.forEach(tr => {
    const key = tr.testId
    const val = parseFloat(tr.value)
    if (!isNaN(val)) {
      if (!testsByType[key]) testsByType[key] = []
      testsByType[key].push({ date: tr.date, value: val, unit: tr.unit || '' })
    }
  })

  const patterns = []

  for (const [testId, results] of Object.entries(testsByType)) {
    if (results.length < 3) continue
    const sorted = [...results].sort((a, b) => a.date > b.date ? 1 : -1)

    // For each result, compute 4-week preconditions
    const dataPoints = sorted.map(r => {
      const w4end  = r.date
      const w4start = (() => { const d = new Date(r.date); d.setDate(d.getDate() - 28); return d.toISOString().slice(0, 10) })()
      const prior = log.filter(e => e.date >= w4start && e.date < w4end)
      if (!prior.length) return null
      const sessions = prior.length
      const weeklyTSS = prior.reduce((s, e) => s + (e.tss || 0), 0) / 4
      const weeklySessions = sessions / 4
      const z2Hrs  = prior.reduce((s, e) => {
        const dur = e.duration || 0
        const isZ2 = e.zones ? (e.zones[1] || 0) / (e.duration || 1) > 0.4 : (e.rpe || 5) <= 5 && (e.rpe || 5) >= 4
        return s + (isZ2 ? dur : 0)
      }, 0) / 60 / 4
      const avgRPE = prior.reduce((s, e) => s + (e.rpe || 0), 0) / prior.length
      return { value: r.value, weeklyTSS, weeklySessions, z2Hrs, avgRPE, sessions }
    }).filter(Boolean)

    if (dataPoints.length < 3) continue

    // Sort by test performance — higher is better for VO2max/FTP, split top vs bottom half
    const higherIsBetter = ['cooper','ramp','ftp20','yyir1','astrand'].includes(testId)
    const sortedByPerf = [...dataPoints].sort((a, b) => higherIsBetter ? b.value - a.value : a.value - b.value)
    const topHalf   = sortedByPerf.slice(0, Math.ceil(sortedByPerf.length / 2))
    const botHalf   = sortedByPerf.slice(Math.ceil(sortedByPerf.length / 2))

    const _avg = _arr => _arr => _arr.reduce((s, v) => s + v, 0) / _arr.length
    const mean = (arr, key) => arr.reduce((s, x) => s + x[key], 0) / arr.length

    const vars = ['weeklyTSS', 'weeklySessions', 'z2Hrs', 'avgRPE']
    const diffs = vars.map(v => ({
      key: v,
      topMean: mean(topHalf, v),
      botMean: mean(botHalf, v),
      diff: Math.abs(mean(topHalf, v) - mean(botHalf, v)),
      topIsBetter: mean(topHalf, v) > mean(botHalf, v),
    }))
    const biggestDiff = diffs.reduce((a, b) => a.diff > b.diff ? a : b)

    const testLabel = { cooper:'VO₂max', ramp:'FTP', ftp20:'FTP', yyir1:'VO₂max', astrand:'VO₂max', beep:'VO₂max', wingate:'Peak Power', oneRM:'1RM' }[testId] || testId
    const confidence = dataPoints.length >= 6 ? 'high' : dataPoints.length >= 4 ? 'moderate' : 'low'

    if (biggestDiff.key === 'z2Hrs' && biggestDiff.diff > 0.5) {
      const bestRange = `${Math.round(biggestDiff.topMean * 10) / 10}–${Math.round((biggestDiff.topMean + 1.5) * 10) / 10} h/wk`
      patterns.push({
        factor: 'weekly_z2_hours', direction: biggestDiff.topIsBetter ? 'more_is_better' : 'less_is_better',
        bestRange, confidence, testLabel,
        en: `Your ${testLabel} improves most when you do ${bestRange} of Z2 work in the preceding 4 weeks.`,
        tr: `${testLabel}'niz önceki 4 haftada ${bestRange} Z2 çalışması yaptığınızda en çok gelişiyor.`,
      })
    } else if (biggestDiff.key === 'weeklySessions' && biggestDiff.diff > 0.5) {
      const best = Math.round(biggestDiff.topMean * 10) / 10
      patterns.push({
        factor: 'sessions_per_week', direction: biggestDiff.topIsBetter ? 'more_is_better' : 'less_is_better',
        bestRange: `${best} sessions/wk`, confidence, testLabel,
        en: `You test best when averaging ${best} sessions/week beforehand — not too many, not too few.`,
        tr: `Öncesinde haftada ortalama ${best} seans yaptığınızda en iyi test sonucunu alıyorsunuz.`,
      })
    } else if (biggestDiff.key === 'weeklyTSS' && biggestDiff.diff > 15) {
      const best = Math.round(biggestDiff.topMean)
      patterns.push({
        factor: 'weekly_tss', direction: biggestDiff.topIsBetter ? 'more_is_better' : 'less_is_better',
        bestRange: `~${best} TSS/wk`, confidence, testLabel,
        en: `Your ${testLabel} peaks following ~${best} TSS/week of consistent training.`,
        tr: `${testLabel}'niz haftada ~${best} TSS tutarlı antrenman sonrasında zirveye ulaşıyor.`,
      })
    } else {
      const best = Math.round(biggestDiff.topMean * 10) / 10
      patterns.push({
        factor: biggestDiff.key, direction: biggestDiff.topIsBetter ? 'more_is_better' : 'less_is_better',
        bestRange: `avg ${best}`, confidence, testLabel,
        en: `Your ${testLabel} correlates with ${biggestDiff.key.replace(/_/g, ' ')} of ~${best} in the 4 weeks before testing.`,
        tr: `${testLabel}'niz test öncesi 4 haftadaki ${biggestDiff.key.replace(/_/g, ' ')} (~${best}) ile ilişkili.`,
      })
    }
  }

  return { patterns, dataPoints: testResults.length, reliable: patterns.length > 0 }
}

// ── B) Recovery → Performance Patterns ────────────────────────────────────────
// Finds optimal pre-session readiness, sleep, and best/worst training days.
export function findRecoveryPatterns(log, recovery) {
  if (!log?.length || !recovery?.length || recovery.length < 7) {
    return {
      optimalReadiness: null, optimalSleep: null, redFlags: [], bestDay: null, worstDay: null,
      needsMore: { en: `Log recovery for ${Math.max(0, 7 - (recovery?.length || 0))} more days to find your patterns.`, tr: `Desenlerinizi bulmak için ${Math.max(0, 7 - (recovery?.length || 0))} gün daha toparlanma kaydet.` }
    }
  }

  const recMap = {}
  recovery.forEach(e => { recMap[e.date] = e })

  // Pair each session with the recovery from the PREVIOUS day
  const pairs = []
  log.forEach(s => {
    const prevDay = new Date(s.date); prevDay.setDate(prevDay.getDate() - 1)
    const prev = recMap[prevDay.toISOString().slice(0, 10)]
    if (prev) pairs.push({ session: s, rec: prev })
  })

  if (pairs.length < 6) {
    return {
      optimalReadiness: null, optimalSleep: null, redFlags: [], bestDay: null, worstDay: null,
      needsMore: { en: `${6 - pairs.length} more session+recovery pairs needed.`, tr: `${6 - pairs.length} seans+toparlanma çifti daha gerekiyor.` }
    }
  }

  // Score each session: RPE-appropriate (lower RPE after low readiness = good session quality signal)
  const scored = pairs.map(p => {
    const readiness = p.rec.score || 50
    const rpe = p.session.rpe || 5
    const type = (p.session.type || '').toLowerCase()
    const isEasy = type.includes('easy') || type.includes('recovery')
    // Quality: easy sessions with RPE ≤5 or hard sessions with RPE 7-9
    const quality = isEasy ? (rpe <= 5 ? 80 + readiness * 0.2 : Math.max(0, 80 - (rpe - 5) * 15)) : (rpe >= 7 && rpe <= 9 ? 70 + readiness * 0.3 : 50)
    return { ...p, quality }
  })

  // Sort by quality and split
  const sortedQ = [...scored].sort((a, b) => b.quality - a.quality)
  const top25 = sortedQ.slice(0, Math.ceil(sortedQ.length * 0.25))
  const bot25 = sortedQ.slice(Math.floor(sortedQ.length * 0.75))

  const avgField = (arr, field) => arr.reduce((s, x) => s + (x.rec[field] || 0), 0) / arr.length

  const topReadiness = Math.round(avgField(top25, 'score'))
  const botReadiness = Math.round(avgField(bot25, 'score'))
  const topSleep     = Math.round(avgField(top25.filter(p => p.rec.sleepHrs), 'sleepHrs') * 10) / 10
  const botSleep     = Math.round(avgField(bot25.filter(p => p.rec.sleepHrs), 'sleepHrs') * 10) / 10

  const optimalReadiness = topReadiness > botReadiness + 8 ? {
    min: Math.max(0, topReadiness - 10), max: Math.min(100, topReadiness + 10),
    en: `Your best sessions happen at readiness ${Math.max(0, topReadiness - 10)}–${Math.min(100, topReadiness + 10)}/100.`,
    tr: `En iyi seanslarınız ${Math.max(0, topReadiness - 10)}–${Math.min(100, topReadiness + 10)}/100 hazırlık skorunda gerçekleşiyor.`,
  } : null

  const optimalSleep = (topSleep > 0 && botSleep > 0 && topSleep > botSleep + 0.3) ? {
    min: Math.max(5, topSleep - 0.5), max: topSleep + 0.5,
    en: `Quality sessions follow ${(topSleep - 0.5).toFixed(1)}–${(topSleep + 0.5).toFixed(1)}h of sleep the night before.`,
    tr: `Önceki gece ${(topSleep - 0.5).toFixed(1)}–${(topSleep + 0.5).toFixed(1)} saat uyku sonrasında kaliteli seanslar geliyor.`,
  } : null

  // Red flags: wellness fields that strongly predict poor sessions
  const redFlags = []
  for (const field of ['soreness', 'stress', 'mood']) {
    const highField = scored.filter(p => (p.rec[field] || 0) >= 4)
    const lowField  = scored.filter(p => (p.rec[field] || 0) <= 2)
    if (highField.length >= 3 && lowField.length >= 3) {
      const avgQHigh = highField.reduce((s, p) => s + p.quality, 0) / highField.length
      const avgQLow  = lowField.reduce((s, p) => s + p.quality, 0)  / lowField.length
      const drop = Math.round((avgQLow - avgQHigh) / avgQLow * 100)
      if (drop > 20) {
        redFlags.push({
          field, threshold: 4,
          en: `When ${field} is 4+/5, your next session quality drops ~${drop}%.`,
          tr: `${field === 'soreness' ? 'Kas ağrısı' : field === 'stress' ? 'Stres' : 'Ruh hali'} 4+/5 olduğunda seans kaliteniz ~%${drop} düşüyor.`,
        })
      }
    }
  }

  // Best/worst day of week
  const dayQuality = Array.from({length: 7}, (_, i) => {
    const daySessions = scored.filter(p => new Date(p.session.date).getDay() === i)
    return { day: DAYS[i], count: daySessions.length, avgQ: daySessions.length ? daySessions.reduce((s, p) => s + p.quality, 0) / daySessions.length : 0 }
  }).filter(d => d.count >= 2)

  const bestDay  = dayQuality.length ? dayQuality.reduce((a, b) => a.avgQ > b.avgQ ? a : b) : null
  const worstDay = dayQuality.length ? dayQuality.reduce((a, b) => a.avgQ < b.avgQ ? a : b) : null

  return {
    optimalReadiness, optimalSleep, redFlags,
    bestDay:  bestDay  ? { day: bestDay.day,  en: `Your highest quality sessions are on ${bestDay.day}s.`,  tr: `En kaliteli seanslarınız ${bestDay.day} günleri gerçekleşiyor.` } : null,
    worstDay: worstDay ? { day: worstDay.day, en: `${worstDay.day}s tend to be your weakest sessions — consider starting the week with an easy day.`, tr: `${worstDay.day} günleri en zayıf seanslarınız — haftaya kolay bir gün başlamayı düşünün.` } : null,
    sampleSize: pairs.length,
  }
}

// ── C) Injury Pattern Mining ─────────────────────────────────────────────────
export function mineInjuryPatterns(log, injuries, recovery) {
  if (!injuries?.length || injuries.length < 2) {
    return { patterns: [], vulnerableZones: [], protectiveFactors: [] }
  }

  const zoneGroups = {}
  injuries.forEach(inj => {
    const z = (inj.zone || 'unknown').toLowerCase()
    if (!zoneGroups[z]) zoneGroups[z] = []
    zoneGroups[z].push(inj)
  })

  const vulnerableZones = Object.entries(zoneGroups)
    .filter(([, arr]) => arr.length >= 2)
    .map(([zone]) => zone)

  const patterns = []

  for (const [zone, zoneInjuries] of Object.entries(zoneGroups)) {
    if (zoneInjuries.length < 2) continue

    const preconditions = zoneInjuries.map(inj => {
      const injDate = inj.date
      const w2start = (() => { const d = new Date(injDate); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10) })()
      const w1start = (() => { const d = new Date(injDate); d.setDate(d.getDate() - 7);  return d.toISOString().slice(0, 10) })()

      const prev14 = log.filter(e => e.date >= w2start && e.date < injDate)
      const prev7  = log.filter(e => e.date >= w1start && e.date < injDate)
      const prevW14 = log.filter(e => e.date >= (() => { const d = new Date(w2start); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10) })() && e.date < w2start)

      const tss7   = prev7.reduce((s, e) => s + (e.tss || 0), 0)
      const tss14  = prev14.reduce((s, e) => s + (e.tss || 0), 0) / 2
      const prevTSS = prevW14.reduce((s, e) => s + (e.tss || 0), 0) / 2
      const volumeSpike = prevTSS > 0 ? Math.round((tss14 - prevTSS) / prevTSS * 100) : 0
      const longRun = Math.max(...prev14.map(e => e.duration || 0), 0)
      const consecDays = (() => {
        const sortedDesc = [...prev7].sort((a, b) => b.date > a.date ? 1 : -1)
        let c = 0; for (const e of sortedDesc) { if ((e.rpe || 0) >= 7) c++; else break }
        return c
      })()

      const recAvg = recovery?.length ? (() => {
        const r7 = recovery.filter(e => e.date >= w1start && e.date < injDate)
        return r7.length ? Math.round(r7.reduce((s, e) => s + (e.score || 0), 0) / r7.length) : null
      })() : null

      return { volumeSpike, longRun, consecDays, recAvg, tss7 }
    })

    // Find common triggers: >60% of injuries had this condition
    const n = preconditions.length
    const triggers = []
    const spikeCount = preconditions.filter(p => p.volumeSpike > 20).length
    if (spikeCount / n >= 0.5) triggers.push('volume_spike')
    const longRunCount = preconditions.filter(p => p.longRun > 90).length
    if (longRunCount / n >= 0.5) triggers.push('long_run_duration')
    const consecCount = preconditions.filter(p => p.consecDays >= 3).length
    if (consecCount / n >= 0.5) triggers.push('consecutive_hard_days')
    const recCount = preconditions.filter(p => p.recAvg !== null && p.recAvg < 55).length
    if (recCount / n >= 0.5) triggers.push('low_readiness')

    if (triggers.length === 0) continue

    const confidence = n >= 4 ? 'high' : n >= 3 ? 'moderate' : 'low'
    const avgSpike = Math.round(preconditions.filter(p => p.volumeSpike > 0).reduce((s, p) => s + p.volumeSpike, 0) / preconditions.length)
    const avgLong  = Math.round(preconditions.filter(p => p.longRun > 0).reduce((s, p) => s + p.longRun, 0) / preconditions.length)

    const triggerDesc = triggers.map(t => ({
      volume_spike: `volume spike >20%`,
      long_run_duration: `long run >90 min`,
      consecutive_hard_days: `3+ consecutive hard days`,
      low_readiness: `low readiness (<55)`,
    }[t])).join(' + ')

    patterns.push({
      zone,
      triggers,
      occurrences: n,
      total: n,
      confidence,
      en: `${zone.replace(/_/g,' ')} issues appear after ${triggerDesc} (${n}/${n} occurrences). Average pre-injury spike: +${avgSpike}%, longest session: ${avgLong}min.`,
      tr: `${zone.replace(/_/g,' ')} sorunları ${avgSpike > 0 ? `%${avgSpike}` : ''} yük artışı ve ${avgLong} dakikalık uzun seans sonrasında ortaya çıkıyor (${n} vaka).`,
    })
  }

  // Protective factors: weeks with strength sessions and zero injuries
  const strengthWeeks = new Set()
  log.forEach(e => { if (/strength|gym/i.test(e.type || '')) strengthWeeks.add(weekOf(e.date)) })
  const injuryWeeks   = new Set(injuries.map(i => weekOf(i.date)))
  const strengthOnlyWeeks = [...strengthWeeks].filter(w => !injuryWeeks.has(w)).length
  const protectiveFactors = strengthOnlyWeeks >= 3 ? [{
    en: `Weeks with strength training had ${Math.round(strengthOnlyWeeks / strengthWeeks.size * 100)}% fewer injury entries.`,
    tr: `Güç antrenmanı olan haftalar %${Math.round(strengthOnlyWeeks / strengthWeeks.size * 100)} daha az yaralanma kaydı gösteriyor.`,
  }] : []

  return { patterns, vulnerableZones, protectiveFactors }
}

// ── D) Optimal Week Structure ─────────────────────────────────────────────────
export function findOptimalWeekStructure(log, recovery) {
  if (!log?.length || log.length < 20) {
    return { bestPattern: null, sampleSize: 0, reliable: false, needMore: Math.max(0, 20 - log.length) }
  }

  // Group into Mon-Sun weeks
  const weeks = {}
  log.forEach(s => {
    const d = new Date(s.date)
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = mon.toISOString().slice(0, 10)
    if (!weeks[key]) weeks[key] = []
    weeks[key].push(s)
  })

  const weekKeys = Object.keys(weeks).filter(k => weeks[k].length >= 3)
  if (weekKeys.length < 4) {
    return { bestPattern: null, sampleSize: weekKeys.length, reliable: false, needMore: Math.max(0, 4 - weekKeys.length) }
  }

  // Score each week: avg readiness + total TSS reasonable + no very high ACWR
  const recMap = {}
  recovery?.forEach(e => { recMap[e.date] = e.score || 0 })

  const scoredWeeks = weekKeys.map(key => {
    const sessions = weeks[key]
    const totalTSS = sessions.reduce((s, e) => s + (e.tss || 0), 0)
    const n = sessions.length
    const hrs = sessions.reduce((s, e) => s + (e.duration || 0), 0) / 60
    const avgRPE = sessions.reduce((s, e) => s + (e.rpe || 5), 0) / n
    const recScores = sessions.map(s => {
      const d = new Date(s.date); d.setDate(d.getDate() + 1)
      return recMap[d.toISOString().slice(0, 10)] || 0
    }).filter(v => v > 0)
    const avgNextRec = recScores.length ? recScores.reduce((s, v) => s + v, 0) / recScores.length : 60

    // Score: penalise for too-high or too-low load, reward good recovery response
    const loadScore  = totalTSS > 50 && totalTSS < 600 ? 100 - Math.abs(totalTSS - 300) / 3 : 20
    const recScore   = avgNextRec
    const balScore   = avgRPE >= 4.5 && avgRPE <= 6.5 ? 80 : 40
    const composite  = loadScore * 0.4 + recScore * 0.4 + balScore * 0.2

    return { key, sessions, totalTSS, hrs, n, composite }
  })

  scoredWeeks.sort((a, b) => b.composite - a.composite)
  const top25 = scoredWeeks.slice(0, Math.ceil(scoredWeeks.length * 0.25))

  // Aggregate best pattern: average day-of-week sessions across top weeks
  const dayAgg = Array.from({length: 7}, (_, i) => ({
    dayIdx: i,
    day: DAYS[i],
    sessions: top25.flatMap(w => w.sessions.filter(s => new Date(s.date).getDay() === i)),
  }))

  const bestPattern = dayAgg
    .filter(d => d.sessions.length > 0)
    .map(d => ({
      day: d.day,
      type: (() => {
        const types = d.sessions.map(s => s.type || 'Easy')
        const freq = {}; types.forEach(t => { freq[t] = (freq[t] || 0) + 1 })
        return Object.entries(freq).reduce((a, b) => b[1] > a[1] ? b : a)[0]
      })(),
      avgDuration: Math.round(d.sessions.reduce((s, e) => s + (e.duration || 0), 0) / d.sessions.length),
    }))

  const restDays = DAYS.filter((_, i) => !dayAgg[i].sessions.length || dayAgg[i].sessions.length < 1)
  const avgHrs   = Math.round(top25.reduce((s, w) => s + w.hrs, 0) / top25.length * 10) / 10
  const avgSess  = Math.round(top25.reduce((s, w) => s + w.n, 0) / top25.length * 10) / 10

  const hardDays = dayAgg.filter(d => d.sessions.some(s => (s.rpe || 0) >= 7)).map(d => d.day)
  const hardStr  = hardDays.slice(0, 2).join(' + ')

  return {
    bestPattern,
    bestWeeklyHours: { min: Math.round(avgHrs * 0.85 * 10) / 10, max: Math.round(avgHrs * 1.15 * 10) / 10 },
    bestSessionCount: avgSess,
    bestRestDays: restDays.slice(0, 2),
    en: `Your optimal week: ${avgSess} sessions, ${avgHrs}h total, hard days on ${hardStr || 'midweek'}, rest on ${restDays[0] || 'weekend'}.`,
    tr: `Optimal haftanız: ${avgSess} seans, ${avgHrs} saat toplam, ${hardStr || 'hafta ortasında'} zorlu günler, ${restDays[0] || 'hafta sonu'} dinlenme.`,
    sampleSize: top25.length,
    reliable: top25.length >= 3,
  }
}

// ── F) Day-of-week Pattern Defaults ──────────────────────────────────────────
/**
 * Returns the most common session type + median duration for today's weekday
 * from the last 56 days of the log. Uses noon-UTC weekday to avoid TZ shifts.
 *
 * @param {Object[]} log   - training log entries
 * @param {string}   today - 'YYYY-MM-DD' (default real today)
 * @returns {{ type: string, durationMin: number, sport: string, confidence: number } | null}
 *          null if fewer than 3 matching sessions in the 56-day window
 */
export function getDayPattern(log, today = new Date().toISOString().slice(0, 10)) {
  if (!log?.length) return null

  const cutoff = new Date(today + 'T12:00:00Z')
  cutoff.setUTCDate(cutoff.getUTCDate() - 56)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // today's ISO day-of-week (Mon=0 … Sun=6) using noon-UTC
  const todayDow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7

  const recent = log.filter(e => e.date && e.date >= cutoffStr && e.date <= today)

  const matching = recent.filter(e => {
    const dow = (new Date(e.date + 'T12:00:00Z').getUTCDay() + 6) % 7
    return dow === todayDow
  })

  if (matching.length < 3) return null

  // Mode of session type
  const typeFreq = {}
  matching.forEach(e => {
    const t = (e.type || '').trim()
    if (t) typeFreq[t] = (typeFreq[t] || 0) + 1
  })
  const modeType = Object.entries(typeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  if (!modeType) return null

  // Median duration
  const durs = matching.map(e => e.duration || 0).filter(v => v > 0).sort((a, b) => a - b)
  const mid = Math.floor(durs.length / 2)
  const medianDur = durs.length === 0 ? 0
    : durs.length % 2 === 1 ? durs[mid]
    : Math.round((durs[mid - 1] + durs[mid]) / 2)

  // Mode of sport
  const sportFreq = {}
  matching.forEach(e => {
    const s = (e.sport || '').trim()
    if (s) sportFreq[s] = (sportFreq[s] || 0) + 1
  })
  const modeSport = Object.entries(sportFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || ''

  const confidence = Math.min(matching.length / recent.filter(e => {
    // total entries on this weekday in window (to normalize confidence)
    const dow = (new Date(e.date + 'T12:00:00Z').getUTCDay() + 6) % 7
    return dow === todayDow
  }).length, 1)

  return { type: modeType, durationMin: medianDur, sport: modeSport, confidence }
}

// ── E) Seasonal / Cyclical Patterns ──────────────────────────────────────────
export function findSeasonalPatterns(log, recovery) {
  if (!log?.length) return { strongMonths: [], weakMonths: [], en: '', tr: '' }

  const firstDate = log.reduce((a, b) => a < b.date ? a : b.date, log[0].date)
  const monthsSpan = Math.floor((Date.now() - new Date(firstDate).getTime()) / (30 * 864e5))
  if (monthsSpan < 3) return { strongMonths: [], weakMonths: [], en: 'Need 3+ months of data.', tr: '3+ aylık veri gerekiyor.' }

  const byMonth = Array.from({length: 12}, (_, m) => ({
    m, name: MONTHS[m], sessions: [], totalTSS: 0, count: 0, avgRec: null,
  }))

  log.forEach(e => {
    const m = new Date(e.date).getMonth()
    byMonth[m].sessions.push(e)
    byMonth[m].totalTSS += e.tss || 0
    byMonth[m].count++
  })

  recovery?.forEach(e => {
    const m = new Date(e.date).getMonth()
    if (!byMonth[m].recScores) byMonth[m].recScores = []
    byMonth[m].recScores.push(e.score || 0)
  })

  byMonth.forEach(bm => {
    if (bm.recScores?.length) bm.avgRec = Math.round(bm.recScores.reduce((s, v) => s + v, 0) / bm.recScores.length)
  })

  const activeMo = byMonth.filter(m => m.count >= 3)
  if (activeMo.length < 3) return { strongMonths: [], weakMonths: [], en: 'Training across more months needed.', tr: 'Daha fazla ay boyunca antrenman verisi gerekiyor.' }

  const sortedByTSS = [...activeMo].sort((a, b) => b.totalTSS / Math.max(1, b.count) - a.totalTSS / Math.max(1, a.count))
  const topN  = Math.ceil(sortedByTSS.length / 3)
  const strongMonths = sortedByTSS.slice(0, topN).map(m => m.name)
  const weakMonths   = sortedByTSS.slice(-topN).map(m => m.name)

  const dip = weakMonths[0]
  const dipMo = byMonth.find(m => m.name === dip)
  const dipPct = dipMo && sortedByTSS[0].totalTSS ? Math.round((1 - dipMo.totalTSS / sortedByTSS[0].totalTSS) * 100) : 0

  return {
    strongMonths, weakMonths,
    en: `Training peaks in ${strongMonths.join(' + ')}. ${dip} shows a ${dipPct}% volume dip — plan easier blocks or target races outside this period.`,
    tr: `Antrenman ${strongMonths.join(' + ')} aylarında zirveye ulaşıyor. ${dip} ayında %${dipPct} hacim düşüşü var — bu dönem için daha kolay bloklar ya da farklı zamanlarda yarışlar planlayın.`,
  }
}
