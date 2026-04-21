// ─── nextAction.js — G3 rules-based next-action engine ────────────────────────
// Pure function — no side effects, no localStorage, no UI.
// Input:  log (array), recovery (array), profile (object)
// Output: action object | null
//
// 10 priority-ordered rules. Each rule has:
//   id:        string — unique identifier (used for 24h dismissal key)
//   priority:  1–10 (1 = highest)
//   action:    { en, tr } — headline
//   rationale: { en, tr } — explanation with metric values
//   citation:  string — scientific source
//   color:     'red' | 'amber' | 'green' | 'blue' | 'muted'

import { computeHRVTrend } from './hrv.js'

const LAMBDA_ACUTE   = 0.25          // 4-day EWMA
const LAMBDA_CHRONIC = 0.067         // 28-day EWMA

function computeCTL(log) {
  const tssMap = buildTSSMap(log)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  let ctl = 0
  for (let i = 41; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    const tss = tssMap[d.toISOString().slice(0, 10)] || 0
    ctl = LAMBDA_CHRONIC * tss + (1 - LAMBDA_CHRONIC) * ctl
  }
  return Math.round(ctl * 10) / 10
}

function computeATL(log) {
  const tssMap = buildTSSMap(log)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  let atl = 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    const tss = tssMap[d.toISOString().slice(0, 10)] || 0
    atl = LAMBDA_ACUTE * tss + (1 - LAMBDA_ACUTE) * atl
  }
  return Math.round(atl * 10) / 10
}

function computeACWR(log) {
  const tssMap = buildTSSMap(log)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  let a = 0, c = 0
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
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
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  const now    = new Date();        now.setHours(0, 0, 0, 0)
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
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
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

  // ── Rule 3: hrv_drift — HRV CV ≥ 10% + latest below mean (Plews 2013) ───────
  const hrv = computeHRVTrend(safeRec)
  if (hrv.trend === 'unstable' && (hrv.dropPct ?? 0) > 5) {
    return {
      id:        'hrv_drift',
      priority:  3,
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

  // ── Rule 4: acwr_high (ACWR 1.3–1.5) — caution zone ─────────────────────────
  if (acwr !== null && acwr > 1.3) {
    return {
      id:        'acwr_high',
      priority:  4,
      action:    { en: 'Active recovery or rest', tr: 'Aktif toparlanma veya dinlenme' },
      rationale: { en: `ACWR ${acwr.toFixed(2)} — caution zone (1.3–1.5). Acute load elevated above chronic base. Easy session or off day.`, tr: `ACWR ${acwr.toFixed(2)} — dikkat bölgesi. Hafif antrenman veya dinlenme.` },
      citation:  'Gabbett 2016 (Br J Sports Med)',
      color:     'amber',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 4: tsb_deep (TSB < −20) — mandatory rest ────────────────────────────
  if (tsb < -20) {
    return {
      id:        'tsb_deep',
      priority:  4,
      action:    { en: 'Rest day — deep fatigue', tr: 'Dinlenme günü — derin yorgunluk' },
      rationale: { en: `TSB ${tsb} — well below optimal range (−10 to +5). CTL ${ctl}, ATL ${atl}. Accumulated fatigue suppresses adaptation.`, tr: `TSB ${tsb} — optimal aralığın altında. Yorgunluk adaptasyonu baskılıyor.` },
      citation:  'Banister 1991 (PMC model)',
      color:     'red',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 5: race_taper (race in ≤14 days) ────────────────────────────────────
  if (daysToRace !== null && daysToRace >= 0 && daysToRace <= 14) {
    return {
      id:        'race_taper',
      priority:  5,
      action:    { en: `Race taper — ${daysToRace}d to race`, tr: `Yarış taperi — ${daysToRace} gün kaldı` },
      rationale: { en: `Race in ${daysToRace} days. Reduce volume 40–60%, maintain intensity. Optimal TSB on race day: +5 to +20.`, tr: `${daysToRace} gün sonra yarış. Hacmi %40–60 azalt, yoğunluğu koru.` },
      citation:  'Mujika & Padilla 2003 (Int J Sports Physiol)',
      color:     'blue',
      metrics:   { ctl, atl, tsb, acwr, wellness, daysToRace },
    }
  }

  // ── Rule 6: tsb_high (TSB > 15) — quality window ─────────────────────────────
  if (tsb > 15) {
    return {
      id:        'tsb_high',
      priority:  6,
      action:    { en: 'Quality session window (Z4–Z5)', tr: 'Kaliteli antrenman fırsatı (Z4–Z5)' },
      rationale: { en: `TSB +${tsb} — optimal freshness. CTL ${ctl}, ATL ${atl}. Use this window for threshold or VO2max work.`, tr: `TSB +${tsb} — optimal tazelik. Eşik veya VO2max çalışması yap.` },
      citation:  'Coggan 2003 (PMC adaptation)',
      color:     'green',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 7: tsb_low (TSB −10 to −20) ─────────────────────────────────────────
  if (tsb < -10) {
    return {
      id:        'tsb_low',
      priority:  7,
      action:    { en: 'Easy aerobic session (Z1–Z2)', tr: 'Kolay aerobik antrenman (Z1–Z2)' },
      rationale: { en: `TSB ${tsb} — moderate fatigue. CTL ${ctl}, ATL ${atl}. Low-intensity session promotes recovery while maintaining base.`, tr: `TSB ${tsb} — orta yorgunluk. Düşük yoğunluklu antrenman toparlanmayı destekler.` },
      citation:  'Banister 1991 (PMC model)',
      color:     'amber',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 8: acwr_low (ACWR < 0.8) — below base ───────────────────────────────
  if (acwr !== null && acwr < 0.8) {
    return {
      id:        'acwr_low',
      priority:  8,
      action:    { en: 'Build training density', tr: 'Antrenman yoğunluğunu artır' },
      rationale: { en: `ACWR ${acwr.toFixed(2)} — below optimal base (0.8–1.3). CTL ${ctl} drifting. Add volume to rebuild chronic base.`, tr: `ACWR ${acwr.toFixed(2)} — optimal tabanın altında. Kronik taban için hacmi artır.` },
      citation:  'Gabbett 2016 (Br J Sports Med)',
      color:     'blue',
      metrics:   { ctl, atl, tsb, acwr, wellness },
    }
  }

  // ── Rule 9: default ───────────────────────────────────────────────────────────
  return {
    id:        'default',
    priority:  9,
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
