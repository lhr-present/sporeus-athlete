// ─── nextAction.js — G3 rules-based next-action engine ────────────────────────
// Pure function — no side effects, no localStorage, no UI.
// Input:  log (array), recovery (array), profile (object)
// Output: action object | null
//
// 12 priority-ordered rules. Each rule has:
//   id:        string — unique identifier (used for 24h dismissal key)
//   priority:  1–11 (1 = highest)
//   action:    { en, tr } — headline
//   rationale: { en, tr } — explanation with metric values
//   citation:  string — scientific source
//   color:     'red' | 'amber' | 'green' | 'blue' | 'muted'

import { computeHRVTrend } from './hrv.js'
import { predictInjuryRisk } from './intelligence.js'
import { computeMonotony } from './trainingLoad.js'

const LAMBDA_ACUTE   = 0.25          // 4-day EWMA
const LAMBDA_CHRONIC = 0.067         // 28-day EWMA

function computeCTL(log) {
  const tssMap = buildTSSMap(log)
  const now = new Date(); now.setUTCHours(0, 0, 0, 0)
  let ctl = 0
  for (let i = 41; i >= 0; i--) {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() - i)
    const tss = tssMap[d.toISOString().slice(0, 10)] || 0
    ctl = LAMBDA_CHRONIC * tss + (1 - LAMBDA_CHRONIC) * ctl
  }
  return Math.round(ctl * 10) / 10
}

function computeATL(log) {
  const tssMap = buildTSSMap(log)
  const now = new Date(); now.setUTCHours(0, 0, 0, 0)
  let atl = 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() - i)
    const tss = tssMap[d.toISOString().slice(0, 10)] || 0
    atl = LAMBDA_ACUTE * tss + (1 - LAMBDA_ACUTE) * atl
  }
  return Math.round(atl * 10) / 10
}

function computeACWR(log) {
  const tssMap = buildTSSMap(log)
  const now = new Date(); now.setUTCHours(0, 0, 0, 0)
  let a = 0, c = 0
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() - i)
    const tss = Math.min(tssMap[d.toISOString().slice(0, 10)] || 0, 300)
    a = LAMBDA_ACUTE  * tss + (1 - LAMBDA_ACUTE)  * a
    c = LAMBDA_CHRONIC * tss + (1 - LAMBDA_CHRONIC) * c
  }
  return c > 0 ? Math.round((a / c) * 100) / 100 : null
}

function buildTSSMap(log) {
  const map = {}
  for (const e of (log || [])) {
    if (!e.date) continue
    const d = e.date.slice(0, 10)
    map[d] = (map[d] || 0) + (Number(e.tss) || 0)
  }
  return map
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr); target.setUTCHours(0, 0, 0, 0)
  const now    = new Date();        now.setUTCHours(0, 0, 0, 0)
  const diff   = Math.round((target - now) / (1000 * 60 * 60 * 24))
  return diff
}

// ─── Rule definitions ─────────────────────────────────────────────────────────

function evalRules(log, recovery, profile) {
  const safeLog = Array.isArray(log) ? log : []
  const safeRec = Array.isArray(recovery) ? recovery : []

  // ── Metrics ──────────────────────────────────────────────────────────────────

  const ctl  = computeCTL(safeLog)
  const atl  = computeATL(safeLog)
  const tsb  = Math.round((ctl - atl) * 10) / 10
  const acwr = computeACWR(safeLog)

  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) })()
  const recentRec = safeRec.find(e => e.date === today) ?? safeRec.find(e => e.date === yesterday)
  const wellness  = recentRec?.score != null
    ? Math.max(1, Math.min(5, Math.round(recentRec.score / 20)))
    : null

  const raceDate  = profile?.nextRaceDate ?? null
  const daysToRace = daysUntil(raceDate)

  // ── Rule 0: no_sessions ───────────────────────────────────────────────────────
  if (safeLog.length === 0) {
    return {
      id:        'no_sessions',
      priority:  0,
      action:    { en: 'Log your first session', tr: 'İlk antrenmanını kaydet' },
      rationale: { en: 'No sessions logged yet. Start your training history — consistency compounds over weeks.', tr: 'Henüz antrenman kaydedilmedi. Tutarlılık haftalarca birikerek güçlenir.' },
      citation:  'Impellizzeri 2004 (session-RPE)',
      color:     'blue',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 1: acwr_spike (ACWR > 1.5) — highest injury risk ───────────────────
  if (acwr !== null && acwr > 1.5) {
    return {
      id:        'acwr_spike',
      priority:  1,
      action:    { en: 'Mandatory rest — load spike detected', tr: 'Zorunlu dinlenme — aşırı yük artışı' },
      rationale: { en: `ACWR ${acwr.toFixed(2)} exceeds the 1.5 injury-risk threshold. Acute load far outpaces chronic base. Rest or active recovery only.`, tr: `ACWR ${acwr.toFixed(2)} yaralanma riski eşiğini (1.5) aşıyor. Dinlen veya hafif hareket.` },
      citation:  'Gabbett 2016 (Br J Sports Med)',
      color:     'red',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 2: wellness_poor ─────────────────────────────────────────────────────
  if (wellness !== null && wellness <= 2) {
    return {
      id:        'wellness_poor',
      priority:  2,
      action:    { en: 'Rest day — wellbeing below threshold', tr: 'Dinlenme günü — iyilik hali düşük' },
      rationale: { en: `Wellness score ${wellness}/5 — autonomic recovery takes priority. Training on depleted wellbeing raises injury risk.`, tr: `İyilik skoru ${wellness}/5 — otonom iyileşme öncelikli.` },
      citation:  'Meeusen 2013 (Eur J Sport Sci, overreaching)',
      color:     'red',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 3: acwr_high (ACWR 1.3–1.5) — caution zone ─────────────────────────
  // Direct objective measurement — evaluated before composite model-based injury risk
  if (acwr !== null && acwr > 1.3) {
    return {
      id:        'acwr_high',
      priority:  3,
      action:    { en: 'Active recovery or rest', tr: 'Aktif toparlanma veya dinlenme' },
      rationale: { en: `ACWR ${acwr.toFixed(2)} — caution zone (1.3–1.5). Acute load elevated above chronic base. Easy session or off day.`, tr: `ACWR ${acwr.toFixed(2)} — dikkat bölgesi. Hafif antrenman veya dinlenme.` },
      citation:  'Gabbett 2016 (Br J Sports Med)',
      color:     'amber',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 4: injury_risk_high — 5-factor model (H2) ───────────────────────────
  const inj = predictInjuryRisk(safeLog, safeRec, profile)
  if (inj.level === 'HIGH') {
    const topFactors = inj.factors.slice(0, 2).map(f => f.label).join(', ')
    return {
      id:        'injury_risk_high',
      priority:  4,
      action:    { en: 'Injury risk HIGH — reduce intensity 20-30%', tr: 'Yaralanma riski YÜKSEK — yoğunluğu %20-30 azalt' },
      rationale: {
        en: `Risk score ${inj.score}/100 (${topFactors}). ${inj.advice.en}`,
        tr: `Risk skoru ${inj.score}/100 (${topFactors}). ${inj.advice.tr}`,
      },
      citation:  'Hulin 2016 (Br J Sports Med)',
      color:     'red',
      metrics:   { ctl, atl, tsb, acwr, wellness, injuryScore: inj.score },
    }
  }

  // ── Rule 4.5: injury_window — predictive 2-week risk window ─────────────────
  // v9.57.0: pre-fix rules only fired AT injury threshold (HIGH). This rule
  // fires BEFORE the spike when monotony is rising AND readiness is dropping
  // AND consecutive training days ≥ 4 — buying the athlete a deload window.
  // Foster 1998 monotony rising is the canonical pre-overreaching signal;
  // Hulin 2016 ACWR-style early warning extended to monotony Δ.
  const monoNow = computeMonotony(safeLog)
  const monoPrev = computeMonotony(safeLog, (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 7); return d })())
  const monoRising = (monoNow.monotony && monoPrev.monotony)
    ? (monoNow.monotony / monoPrev.monotony) - 1
    : null
  const consecutiveDays = (() => {
    const datesWithSession = new Set((safeLog || []).filter(e => (e.tss || 0) > 0).map(e => (e.date || '').slice(0, 10)))
    const today = new Date(); today.setUTCHours(0, 0, 0, 0)
    let n = 0
    for (let i = 0; i < 14; i++) {
      const d = new Date(today); d.setUTCDate(d.getUTCDate() - i)
      if (datesWithSession.has(d.toISOString().slice(0, 10))) n++
      else break
    }
    return n
  })()
  if (monoRising !== null && monoRising > 0.15
    && wellness !== null && wellness < 3
    && consecutiveDays >= 4
    && (!inj || inj.level !== 'HIGH')) {
    return {
      id:        'injury_window',
      priority:  4,
      action:    { en: 'Plan deload — injury window approaching', tr: 'Deload planla — yaralanma penceresi yaklaşıyor' },
      rationale: {
        en: `Monotony rising ${(monoRising * 100).toFixed(0)}% (now ${monoNow.monotony}, was ${monoPrev.monotony}), wellness ${wellness}/5, ${consecutiveDays}d consecutive. Next 14d high-risk — schedule a deload week or extra rest day before threshold.`,
        tr: `Monotoni yükseliyor %${(monoRising * 100).toFixed(0)} (şimdi ${monoNow.monotony}, önce ${monoPrev.monotony}), iyilik ${wellness}/5, ${consecutiveDays}g üst üste. Sonraki 14 gün yüksek risk — eşik öncesi deload haftası veya ek dinlenme günü planla.`,
      },
      citation:  'Foster 1998 (Med Sci Sports Exerc) + Hulin 2016 (Br J Sports Med)',
      color:     'amber',
      metrics:   { ctl, atl, tsb, acwr, wellness, monotony: monoNow.monotony, monoRising: Math.round(monoRising * 100) / 100, consecutiveDays },
    }
  }

  // ── Rule 5: hrv_drift — HRV CV ≥ 10% + latest below mean (Plews 2013) ───────
  const hrv = computeHRVTrend(safeRec)
  if (hrv.trend === 'unstable' && (hrv.dropPct ?? 0) > 5) {
    return {
      id:        'hrv_drift',
      priority:  4,
      action:    { en: 'Easy session — HRV suppressed', tr: 'Kolay antrenman — HRV baskılı' },
      rationale: {
        en: `HRV CV ${(hrv.cv * 100).toFixed(1)}% ≥ 10% with latest ${hrv.latestHRV}ms below ${hrv.baseline}ms baseline — autonomic strain. Easy session or rest.`,
        tr: `HRV CV %${(hrv.cv * 100).toFixed(1)} ≥ %10, son değer ${hrv.latestHRV}ms baz ${hrv.baseline}ms altında. Otonom yük — kolay seans veya dinlenme.`,
      },
      citation:  'Plews 2013 (Int J Sports Physiol Perform)',
      color:     'amber',
      metrics:   { ctl, atl, tsb, acwr, wellness, hrv: hrv.latestHRV, hrvCV: hrv.cv },
    }
  }

  // ── Rule 5: sleep_debt — avg sleep < 7h over last 7 days (H1) ───────────────
  const w7Start = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10) })()
  const sleepReadings = safeRec.filter(e => e.date >= w7Start && parseFloat(e.sleepHrs) > 0)
  if (sleepReadings.length >= 3) {
    const avgSleep = sleepReadings.reduce((s, e) => s + parseFloat(e.sleepHrs), 0) / sleepReadings.length
    if (avgSleep < 7) {
      return {
        id:        'sleep_debt',
        priority:  5,
        action:    { en: `Sleep debt — avg ${avgSleep.toFixed(1)}h this week`, tr: `Uyku açığı — bu hafta ort. ${avgSleep.toFixed(1)} saat` },
        rationale: {
          en: `7-day average sleep ${avgSleep.toFixed(1)}h < 7h target. Sleep restriction reduces reaction time, glycogen resynthesis, and HRV within 3 nights (Mah 2011).`,
          tr: `7 günlük ort. uyku ${avgSleep.toFixed(1)} saat < 7 saat hedef. Uyku kısıtlaması reaksiyon süresini, glikojen sentezini ve HRV'yi düşürür (Mah 2011).`,
        },
        citation:  'Mah 2011 (SLEEP — sleep extension in athletes)',
        color:     'amber',
        metrics:   { ctl, atl, tsb, acwr, wellness, avgSleep: Math.round(avgSleep * 10) / 10 },
      }
    }
  }

  // ── Rule 6: tsb_deep (TSB < −20) — mandatory rest ────────────────────────────
  if (tsb < -20) {
    return {
      id:        'tsb_deep',
      priority:  6,
      action:    { en: 'Rest day — deep fatigue', tr: 'Dinlenme günü — derin yorgunluk' },
      rationale: { en: `TSB ${tsb} — well below optimal range (−10 to +5). CTL ${ctl}, ATL ${atl}. Accumulated fatigue suppresses adaptation.`, tr: `TSB ${tsb} — optimal aralığın altında. Yorgunluk adaptasyonu baskılıyor.` },
      citation:  'Banister 1991 (PMC model)',
      color:     'red',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 7: race_taper — 4 graduated phases per Mujika & Padilla 2003 ───────
  // v9.57.0: split single ≤14d rule into 4 sub-rules so the coaching
  // escalates as race day approaches. Pre-fix: athlete saw the same
  // "reduce 40-60%" message at d-14 and d-2. Now each phase prescribes
  // the appropriate volume cut + intensity rule.
  if (daysToRace !== null && daysToRace >= 0 && daysToRace <= 14) {
    if (daysToRace <= 1) {
      return {
        id:        'race_taper_d1',
        priority:  7,
        action:    { en: `Race day-${daysToRace} — full rest`, tr: `Yarış-${daysToRace} — tam dinlenme` },
        rationale: {
          en: `${daysToRace}d to race. Walking + 10-min easy shake-out only. Hydrate, fuel-load, sleep. Adding work now subtracts performance.`,
          tr: `Yarışa ${daysToRace} gün. Sadece yürüyüş + 10 dk hafif açılım. Su iç, karbonhidrat yükle, uyu. Bu noktada eklenen iş performanstan eksiltir.`,
        },
        citation:  'Mujika & Padilla 2003 (Int J Sports Physiol)',
        color:     'blue',
        metrics:   { ctl, atl, tsb, acwr, wellness, daysToRace },
      }
    }
    if (daysToRace <= 4) {
      return {
        id:        'race_taper_d2_4',
        priority:  7,
        action:    { en: `Race ${daysToRace}d out — race-sim only`, tr: `Yarış ${daysToRace} gün — sadece yarış-simülasyonu` },
        rationale: {
          en: `${daysToRace}d to race. Vol -75 to -85% baseline. One short race-pace tune-up (4-6×400m or 3×3min). NO new training; preserve glycogen + neural readiness.`,
          tr: `Yarışa ${daysToRace} gün. Hacmi %75-85 azalt. Bir kısa yarış-tempo açılım (4-6×400m veya 3×3dk). YENİ antrenman yok; glikojen ve sinir hazırlığını koru.`,
        },
        citation:  'Mujika & Padilla 2003 (Int J Sports Physiol)',
        color:     'blue',
        metrics:   { ctl, atl, tsb, acwr, wellness, daysToRace },
      }
    }
    if (daysToRace <= 9) {
      return {
        id:        'race_taper_d5_9',
        priority:  7,
        action:    { en: `Taper week — ${daysToRace}d to race`, tr: `Taper haftası — ${daysToRace} gün kaldı` },
        rationale: {
          en: `${daysToRace}d to race. Vol -50 to -60%, INTENSITY MAINTAINED. Race-pace work in 5-15 min doses, 1 quality session this week. Avoid new sessions; sharpen — don't build.`,
          tr: `Yarışa ${daysToRace} gün. Hacmi %50-60 azalt, YOĞUNLUĞU KORU. 5-15 dk dozlarda yarış-tempo işi, bu hafta 1 kaliteli seans. Yeni seans yok; keskinleştir — geliştirme.`,
        },
        citation:  'Mujika & Padilla 2003 (Int J Sports Physiol)',
        color:     'blue',
        metrics:   { ctl, atl, tsb, acwr, wellness, daysToRace },
      }
    }
    // 10-14 days
    return {
      id:        'race_taper_d10_14',
      priority:  7,
      action:    { en: `Pre-taper — ${daysToRace}d to race`, tr: `Taper-öncesi — ${daysToRace} gün kaldı` },
      rationale: {
        en: `${daysToRace}d to race. Vol -30 to -40%, intensity preserved. Last block of bigger workouts ENDS this week — final long run / threshold key. Target race-day TSB +5 to +20.`,
        tr: `Yarışa ${daysToRace} gün. Hacmi %30-40 azalt, yoğunluğu koru. Son büyük antrenman bloğu BU hafta biter — son uzun koşu / eşik anahtarı. Yarış günü TSB hedef +5 / +20.`,
      },
      citation:  'Mujika & Padilla 2003 (Int J Sports Physiol)',
      color:     'blue',
      metrics:   { ctl, atl, tsb, acwr, wellness, daysToRace },
    }
  }

  // ── Rule 8: tsb_high (TSB > 15) — quality window ─────────────────────────────
  if (tsb > 15) {
    return {
      id:        'tsb_high',
      priority:  8,
      action:    { en: 'Quality session window (Z4–Z5)', tr: 'Kaliteli antrenman fırsatı (Z4–Z5)' },
      rationale: { en: `TSB +${tsb} — optimal freshness. CTL ${ctl}, ATL ${atl}. Use this window for threshold or VO2max work.`, tr: `TSB +${tsb} — optimal tazelik. Eşik veya VO2max çalışması yap.` },
      citation:  'Coggan 2003 (PMC adaptation)',
      color:     'green',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 9: tsb_low (TSB −10 to −20) ─────────────────────────────────────────
  if (tsb < -10) {
    return {
      id:        'tsb_low',
      priority:  9,
      action:    { en: 'Easy aerobic session (Z1–Z2)', tr: 'Kolay aerobik antrenman (Z1–Z2)' },
      rationale: { en: `TSB ${tsb} — moderate fatigue. CTL ${ctl}, ATL ${atl}. Low-intensity session promotes recovery while maintaining base.`, tr: `TSB ${tsb} — orta yorgunluk. Düşük yoğunluklu antrenman toparlanmayı destekler.` },
      citation:  'Banister 1991 (PMC model)',
      color:     'amber',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 10: acwr_low (ACWR < 0.8) — below base ─────────────────────────────
  if (acwr !== null && acwr < 0.8) {
    return {
      id:        'acwr_low',
      priority:  10,
      action:    { en: 'Build training density', tr: 'Antrenman yoğunluğunu artır' },
      rationale: { en: `ACWR ${acwr.toFixed(2)} — below optimal base (0.8–1.3). CTL ${ctl} drifting. Add volume to rebuild chronic base.`, tr: `ACWR ${acwr.toFixed(2)} — optimal tabanın altında. Kronik taban için hacmi artır.` },
      citation:  'Gabbett 2016 (Br J Sports Med)',
      color:     'blue',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 10.5: plan_stale — surface when prescribed plan is out of date ─────
  // v9.59.0 — Fires when sporeus-plan is >14d old AND athlete's CTL has drifted
  // ≥10pts above the plan's baseline (fitness exceeded what plan assumed).
  // Banister 1991: plan baseline drift means weekly TSS targets undershoot the
  // current adaptive capacity. Suggests regeneration, not rest.
  try {
    const planRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('sporeus-plan') : null
    if (planRaw) {
      const plan = JSON.parse(planRaw)
      const generatedAt = plan?.generatedAt
      const baselineCTL = parseFloat(plan?.baselineCTL)
      if (generatedAt && Number.isFinite(baselineCTL) && baselineCTL > 0) {
        const ageDays = Math.floor((Date.now() - new Date(generatedAt).getTime()) / 86400000)
        const drift = ctl - baselineCTL
        if (ageDays > 14 && drift >= 10) {
          return {
            id:        'plan_stale',
            priority:  10,
            action:    { en: 'Regenerate plan — fitness has outgrown baseline', tr: 'Planı yenile — kondisyon temelini aştı' },
            rationale: {
              en: `Plan is ${ageDays} days old; CTL is +${Math.round(drift)} above plan baseline (${Math.round(baselineCTL)}→${ctl}). Weekly TSS targets undershoot current capacity — regenerate to recalibrate.`,
              tr: `Plan ${ageDays} gün eski; KTY plan temeline göre +${Math.round(drift)} (${Math.round(baselineCTL)}→${ctl}). Haftalık TSS hedefleri mevcut kapasitenin altında — yeniden oluştur.`,
            },
            citation:  'Banister 1991 (PMC baseline drift)',
            color:     'blue',
            metrics:   { ctl, atl, tsb, acwr, wellness, planAgeDays: ageDays, ctlDrift: Math.round(drift) },
          }
        }
      }
    }
  } catch (_) { /* localStorage unavailable / corrupt JSON — silent fall-through */ }

  // ── Rule 11: default ─────────────────────────────────────────────────────────
  return {
    id:        'default',
    priority:  11,
    action:    { en: 'Moderate aerobic session (Z2–Z3)', tr: 'Orta yoğunluklu aerobik antrenman (Z2–Z3)' },
    rationale: { en: `TSB ${tsb}, ACWR ${acwr?.toFixed(2) ?? '—'} — within normal training range. Steady-state session builds aerobic base.`, tr: `TSB ${tsb}, ACWR ${acwr?.toFixed(2) ?? '—'} — normal antrenman aralığı.` },
    citation:  'Seiler 2010 (polarized training distribution)',
    color:     'muted',
    metrics:   { ctl, atl, tsb, acwr, wellness },
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the highest-priority next action.
 * Returns the action object only — caller handles dismissal display logic.
 */
export function computeNextAction(log, recovery, profile) {
  try {
    return evalRules(log, recovery, profile)
  } catch (_) {
    return null
  }
}

/**
 * Check if a rule's 24h dismissal is still active.
 * Key: sporeus-nac-dismissed-{ruleId}, value: ISO timestamp.
 */
export function isDismissed(ruleId) {
  try {
    const raw = localStorage.getItem(`sporeus-nac-dismissed-${ruleId}`)
    if (!raw) return false
    const ts = Number(raw)
    return Date.now() - ts < 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

/**
 * Dismiss a rule for 24h.
 */
export function dismissRule(ruleId) {
  try {
    localStorage.setItem(`sporeus-nac-dismissed-${ruleId}`, String(Date.now()))
  } catch (_) {}
}

export { computeCTL, computeATL, computeACWR }   // exported for testing
