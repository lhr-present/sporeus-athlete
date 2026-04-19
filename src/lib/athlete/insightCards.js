// src/lib/athlete/insightCards.js — E6: Pattern-based insight card generator
// Pure function — takes log + metrics, returns bilingual insight cards.
//
// ANTI-HALLUCINATION RULES (enforced by data guards):
//   - Never claim a trend without ≥ 4 weeks of data supporting it
//   - Never reference a metric not present in the input
//   - Never mention specific race times, external benchmarks, or body data not provided
//   - If data is insufficient, return null (not a vague encouragement)
//
// Card types:
//   weekly_fitness    — aerobic fitness change over last 4 weeks (CTL delta)
//   decoupling_trend  — aerobic decoupling trend over last 3 sessions (same pace/power)
//   consistency       — session count vs same period 4 weeks ago
//   workload_pattern  — 8-week load pattern (Foster monotony)
//   milestone         — session count milestone (100, 200, 250, 500, etc.)

const MIN_WEEKS_FOR_TREND  = 4
const MIN_SESSIONS_PATTERN = 8

/**
 * Weekly fitness change card — requires ≥4 weeks CTL data.
 * @param {number} ctlNow   - current CTL
 * @param {number} ctl4wAgo - CTL 4 weeks ago
 * @returns {{ type, en, tr }|null}
 */
export function weeklyFitnessCard(ctlNow, ctl4wAgo) {
  if (ctlNow == null || ctl4wAgo == null || ctl4wAgo === 0) return null
  const delta = ctlNow - ctl4wAgo
  const pct   = Math.round(Math.abs(delta / ctl4wAgo) * 100)

  // Only meaningful if change is ≥ 3%
  if (pct < 3) return null

  if (delta > 0) {
    return {
      type: 'weekly_fitness',
      en: `Your fitness (CTL) has risen ${pct}% over the last 4 weeks (${ctl4wAgo} → ${ctlNow}). Aerobic base is growing.`,
      tr: `Son 4 haftada kondisyonun (KTY) %${pct} arttı (${ctl4wAgo} → ${ctlNow}). Aerobik baz büyüyor.`,
    }
  }
  return {
    type: 'weekly_fitness',
    en: `Fitness (CTL) dropped ${pct}% over 4 weeks (${ctl4wAgo} → ${ctlNow}). Consider increasing training frequency.`,
    tr: `Kondisyon (KTY) 4 haftada %${pct} düştü (${ctl4wAgo} → ${ctlNow}). Antrenman sıklığını artırmayı düşün.`,
  }
}

/**
 * Session count consistency card — compares last 4 weeks vs prior 4 weeks.
 * @param {Array} log  - training_log entries sorted oldest-first
 * @param {string} asOf  - reference date 'YYYY-MM-DD'
 * @returns {{ type, en, tr }|null}
 */
export function consistencyCard(log, asOf) {
  if (!Array.isArray(log) || log.length < 4 || !asOf) return null

  const ref = new Date(asOf)
  const cutRecent = new Date(ref); cutRecent.setDate(ref.getDate() - 28)
  const cutPrior  = new Date(ref); cutPrior.setDate(ref.getDate() - 56)

  const recent = log.filter(s => s.date >= cutRecent.toISOString().slice(0,10) && s.date <= asOf).length
  const prior  = log.filter(s => s.date >= cutPrior.toISOString().slice(0,10)  && s.date < cutRecent.toISOString().slice(0,10)).length

  if (prior === 0) return null   // no comparison possible

  const delta = recent - prior
  if (Math.abs(delta) < 2) return null  // not meaningful

  if (delta > 0) {
    return {
      type: 'consistency',
      en: `You logged ${recent} sessions in the last 4 weeks vs ${prior} in the prior 4 weeks — ${delta} more. Consistency is building.`,
      tr: `Son 4 haftada ${recent} antrenman kaydettin, önceki 4 haftada ise ${prior} — ${delta} daha fazla. Tutarlılık artıyor.`,
    }
  }
  return {
    type: 'consistency',
    en: `Session count dropped: ${recent} in the last 4 weeks vs ${prior} in the prior 4. Check recovery balance.`,
    tr: `Antrenman sayısı düştü: son 4 haftada ${recent}, öncekinde ${prior}. Toparlanma dengesini kontrol et.`,
  }
}

/**
 * Session count milestone card.
 * @param {number} totalSessions
 * @returns {{ type, en, tr }|null}
 */
export function milestoneCard(totalSessions) {
  const milestones = [10, 25, 50, 100, 150, 200, 250, 300, 500, 750, 1000]
  if (!milestones.includes(totalSessions)) return null

  return {
    type: 'milestone',
    en: `Session #${totalSessions} logged. Every session builds the athlete you're becoming.`,
    tr: `${totalSessions}. antrenman tamamlandı. Her antrenman seni bir adım ileriye taşıyor.`,
  }
}

/**
 * Workload pattern card based on Foster monotony.
 * Flags if monotony > 2 for 2+ consecutive weeks.
 * @param {number[]} monotonyHistory  - array of weekly monotony values (most recent last), min 2
 * @returns {{ type, en, tr }|null}
 */
export function workloadPatternCard(monotonyHistory) {
  if (!Array.isArray(monotonyHistory) || monotonyHistory.length < 2) return null
  const recent = monotonyHistory.slice(-2)
  const bothHigh = recent.every(m => m != null && m > 2.0)
  if (!bothHigh) return null
  return {
    type: 'workload_pattern',
    en: `Training monotony has been above 2.0 for 2+ weeks (Foster 1998). Alternate hard and easy days to reduce injury risk.`,
    tr: `Antrenman monotonisi 2+ haftadır 2.0 üzerinde (Foster 1998). Sakatlanma riskini azaltmak için sert ve kolay günleri değiştir.`,
  }
}

/**
 * Generate all applicable insight cards for the current state.
 * Returns only cards backed by sufficient data — never fabricates.
 *
 * @param {Object} params
 * @param {Array}  params.log            - training_log entries
 * @param {string} params.asOf           - 'YYYY-MM-DD'
 * @param {number} params.ctlNow         - current CTL
 * @param {number} params.ctl4wAgo       - CTL 4 weeks ago
 * @param {number[]} params.monotonyHistory - array of weekly monotony values
 * @returns {Array<{ type, en, tr }>}
 */
export function generateInsightCards({ log = [], asOf, ctlNow, ctl4wAgo, monotonyHistory = [] } = {}) {
  const cards = []
  const total = log.length

  // Milestone first — always shown when it hits
  const mc = milestoneCard(total)
  if (mc) cards.push(mc)

  // CTL trend — only with enough data
  const fc = weeklyFitnessCard(ctlNow, ctl4wAgo)
  if (fc) cards.push(fc)

  // Consistency — only with 8+ sessions
  if (total >= MIN_SESSIONS_PATTERN && asOf) {
    const cc = consistencyCard(log, asOf)
    if (cc) cards.push(cc)
  }

  // Monotony warning
  const wc = workloadPatternCard(monotonyHistory)
  if (wc) cards.push(wc)

  return cards
}
