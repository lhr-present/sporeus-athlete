// src/lib/onboarding/day0Insight.js — E9: Day-0 insight generator
// Pure function — generates science-anchored insights for new athletes.
// Returns a specific, meaningful observation even with just 1 session.
//
// ANTI-SYCOPHANCY RULES:
//   - Never say "great job", "amazing", "you're doing great"
//   - Always include a real number from the session
//   - Always include a science reference (who, what, why)
//   - At 1 session: describe what this metric WILL show as data accumulates
//   - At 3+ sessions: show the actual emerging trend
//   - At 7+ sessions: first CTL value + ACWR hint

const ZONE_SCIENCE = {
  z1: 'Zone 1 (< VT1) — active recovery. Flushes lactate, promotes mitochondrial density.',
  z2: 'Zone 2 (< VT1) — Maffetone aerobic threshold. Foundation of endurance. Each session contributes to CTL.',
  z3: 'Zone 3 (VT1–VT2) — "grey zone". Induces fatigue with moderate aerobic stimulus. Use sparingly.',
  z4: 'Zone 4 (VT2) — lactate threshold. The pace you can sustain for ~60 min. High stimulus:fatigue ratio.',
  z5: 'Zone 5 (> VT2) — neuromuscular + VO2max. High adaptation signal. Requires 48h recovery.',
}

/**
 * Determine the dominant zone from a session object.
 * @param {Object} session
 * @returns {'z1'|'z2'|'z3'|'z4'|'z5'}
 */
export function dominantZone(session) {
  const rpe = Number(session.rpe) || 0
  if (rpe <= 2) return 'z1'
  if (rpe <= 4) return 'z2'
  if (rpe <= 6) return 'z3'
  if (rpe <= 8) return 'z4'
  return 'z5'
}

/**
 * Day-0 insight: single session observation.
 * @param {Object} session  - { type, duration, rpe, tss }
 * @param {string} lang     - 'en' | 'tr'
 * @returns {{ headline: string, body: string, science: string }}
 */
export function day0Insight(session, lang = 'en') {
  if (!session || !session.duration) return null
  const dur   = Number(session.duration) || 0
  const tss   = Number(session.tss) || 0
  const type  = session.type || 'session'
  const zone  = dominantZone(session)
  const zNote = ZONE_SCIENCE[zone]

  if (lang === 'tr') {
    return {
      headline: `İlk antrenman kaydedildi — ${dur} dk ${type}`,
      body: `TSS: ${tss || '—'}. ${
        zone === 'z2'
          ? 'Aerobik bölge (Z2) antrenmanı CTL\'nin temeli. Tutarlılık arttıkça bağımsız CTL grafiğin oluşmaya başlar.'
          : zone === 'z4' || zone === 'z5'
          ? `Yüksek yoğunluklu antrenman (${zone.toUpperCase()}). TSB değerin, sonraki 2–3 gün negatif olacak — bu beklenen toparlanma sinyali.`
          : `${dur} dakikalık ${type} antrenmanın. ${tss > 0 ? 'TSS ' + tss + ' ile başladın.' : 'RPE tabanlı TSS hesaplanıyor.'}`
      }`,
      science: zNote,
    }
  }

  return {
    headline: `First session logged — ${dur} min ${type}`,
    body: `TSS: ${tss || '—'}. ${
      zone === 'z2'
        ? 'Zone 2 training is the foundation of aerobic endurance (Seiler 2010). With consistency, your CTL will track the accumulated signal from sessions like this one.'
        : zone === 'z4' || zone === 'z5'
        ? `High-intensity session (${zone.toUpperCase()}). Expect your TSB to dip negative for 2–3 days — that's the normal fatigue signal of a productive effort.`
        : `${dur}-minute ${type} session. ${tss > 0 ? 'Starting TSS: ' + tss + '.' : 'RPE-based TSS will be estimated.'} CTL will start accumulating with each session.`
    }`,
    science: zNote,
  }
}

/**
 * Multi-session insight (3–7 sessions): shows emerging trend.
 * @param {Object[]} sessions  - sorted oldest-first, minimum 3
 * @param {string}   lang
 * @returns {{ headline: string, body: string, science: string }|null}
 */
export function earlyTrendInsight(sessions, lang = 'en') {
  if (!Array.isArray(sessions) || sessions.length < 3) return null

  const recent3     = sessions.slice(-3)
  const totalTSS    = recent3.reduce((s, x) => s + (Number(x.tss) || 0), 0)
  const avgDuration = Math.round(recent3.reduce((s, x) => s + (Number(x.duration) || 0), 0) / 3)
  const zones       = recent3.map(dominantZone)
  const z2Count     = zones.filter(z => z === 'z2').length
  const hardCount   = zones.filter(z => z === 'z4' || z === 'z5').length
  const totalSessions = sessions.length

  if (lang === 'tr') {
    return {
      headline: `${totalSessions} antrenman — ilk örüntü ortaya çıkıyor`,
      body: `Son 3 antrenman: ortalama ${avgDuration} dk, toplam TSS ${totalTSS}. ${
        z2Count >= 2
          ? 'Ağırlıklı olarak aerobik bölge (Z2) — iyi bir temel kuruluyor.'
          : hardCount >= 2
          ? 'Yüksek yoğunluk ağırlıklı. Orta-uzun vadede Z2 oranını artırmayı düşün.'
          : 'Karma yoğunluk dağılımı — devam ederek kendi ritmini keşfedeceksin.'
      }`,
      science: 'Seiler (2010): elit dayanıklılık sporcuları antrenmanlarının %80\'ini düşük yoğunlukta yapıyor.',
    }
  }

  return {
    headline: `${totalSessions} sessions in — first pattern visible`,
    body: `Last 3 sessions: avg ${avgDuration} min, total TSS ${totalTSS}. ${
      z2Count >= 2
        ? 'Mostly aerobic zone (Z2) — solid base-building pattern emerging.'
        : hardCount >= 2
        ? 'High-intensity skewed. Over time, increasing Z2 proportion will improve your aerobic ceiling.'
        : 'Mixed intensity distribution — keep logging to find your natural rhythm.'
    }`,
    science: 'Seiler (2010): elite endurance athletes spend ~80% of training at low intensity.',
  }
}

/**
 * First CTL insight (7+ sessions): first real fitness number.
 * @param {number} ctl   - current CTL value
 * @param {string} lang
 * @returns {{ headline: string, body: string, science: string }|null}
 */
export function firstCTLInsight(ctl, lang = 'en') {
  if (!ctl || ctl <= 0) return null
  const rounded = Math.round(ctl * 10) / 10

  if (lang === 'tr') {
    return {
      headline: `İlk CTL değerin: ${rounded}`,
      body: `Bu, kronik antrenman yükünü (KTY) temsil eder — son 6 haftalık antrenmanın ağırlıklı ortalaması. Sürdürülebilir gelişim için her hafta %3–5 artış hedefle.`,
      science: 'Banister EWMA modeli (1991): CTL = KTY, τ=42 gün. Sıfırdan başlayan antrenman yükünün %63\'ü ≈ 42 günde oluşur.',
    }
  }

  return {
    headline: `Your first CTL reading: ${rounded}`,
    body: `This is your Chronic Training Load — the exponentially weighted average of your recent training. A sustainable target is 3–5% growth per week. At ${rounded}, you're laying the foundation.`,
    science: 'Banister EWMA (1991): CTL uses τ=42d. Starting from zero, 63% of steady-state CTL is reached in ~42 days.',
  }
}

/**
 * Choose the most relevant Day-N insight based on session count.
 * @param {Object[]} sessions  - all sessions sorted oldest-first
 * @param {number}   ctl       - current CTL (may be 0 if < 7 sessions)
 * @param {string}   lang
 * @returns {{ headline, body, science }|null}
 */
export function selectInsight(sessions, ctl, lang = 'en') {
  if (!Array.isArray(sessions) || sessions.length === 0) return null

  // 7+ sessions: show first CTL
  if (sessions.length >= 7 && ctl > 0) {
    return firstCTLInsight(ctl, lang)
  }

  // 3–6 sessions: show emerging trend
  if (sessions.length >= 3) {
    return earlyTrendInsight(sessions, lang)
  }

  // 1–2 sessions: show Day-0 per-session insight
  return day0Insight(sessions[sessions.length - 1], lang)
}
