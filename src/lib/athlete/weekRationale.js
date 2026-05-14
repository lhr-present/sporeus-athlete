// src/lib/athlete/weekRationale.js
//
// v9.131.0 — Show-your-work for the prescribed weekly structure.
//
// v9.121.0 (planRationale.js) explained today's session. This module
// extends the "why" surface to the whole current week: which phase
// of the macro cycle the week sits in, how its TSS ramp compares to
// last week, what the session-type distribution looks like vs the
// Seiler 80/20 target, and where the week sits in the overall plan.
//
// Inputs: the plan as `generatePlan` emits it (each week has phase,
// sessions, tss, totalHours), the active weekIdx (from
// getTodayPlannedSession), and the log for the ramp comparison.
//
// Pure function — no I/O.

/**
 * @description Phase-context blurb. Same vocabulary as v9.121's
 *   planRationale.phaseExplanation but framed at the week level
 *   (intent of the phase, not the session).
 */
function phaseBlurb(phase) {
  const p = String(phase || '').toLowerCase()
  if (p.includes('base')) return {
    en: 'Base — aerobic capacity is the build target. Volume dominates, intensity sparse.',
    tr: 'Temel — aerobik kapasite hedef. Hacim baskın, yoğunluk seyrek.',
    citation: 'Seiler 2010 (polarized base)',
  }
  if (p.includes('build')) return {
    en: 'Build — race-specific intensity layered on the base. The week mixes quality with maintained easy volume.',
    tr: 'Yapım — yarış-özgül yoğunluk temele ekleniyor. Hafta kaliteli seansları korunan kolay hacimle harmanlıyor.',
    citation: 'Bompa & Buzzichelli 2018',
  }
  if (p.includes('peak')) return {
    en: 'Peak — the sharpest training in the cycle. Workouts mirror race effort and duration.',
    tr: 'Zirve — döngünün en keskin antrenmanı. Seanslar yarış eforu ve süresini taklit eder.',
    citation: 'Bompa & Buzzichelli 2018',
  }
  if (p.includes('taper') || p.includes('race week')) return {
    en: 'Taper — volume −41% (median across the meta-analysis), intensity preserved. Fitness consolidates as fatigue clears.',
    tr: 'Taper — hacim −%41 (meta-analiz ortancası), yoğunluk korunuyor. Yorgunluk azalırken form pekişiyor.',
    citation: 'Bosquet 2007 (taper meta-analysis)',
  }
  if (p.includes('recovery')) return {
    en: 'Recovery — load eased so the adaptation that high-load weeks triggered can catch up.',
    tr: 'İyileşme — yüksek yük haftalarının tetiklediği adaptasyon yetişsin diye yük azaltıldı.',
    citation: 'Mujika 2003',
  }
  return null
}

function sessionBuckets(sessions) {
  const buckets = { easy: 0, threshold: 0, hard: 0, rest: 0 }
  for (const s of sessions || []) {
    const dur = Number(s?.duration) || 0
    const rpe = Number(s?.rpe) || 0
    if (dur <= 0) { buckets.rest += 1; continue }
    if (rpe <= 5)      buckets.easy      += 1
    else if (rpe <= 7) buckets.threshold += 1
    else               buckets.hard      += 1
  }
  return buckets
}

/**
 * @description Derive a structured "why this week" explanation.
 *
 * @param {Object} args
 * @param {Object} args.plan      - generatePlan output ({ weeks: [...] })
 * @param {number} args.weekIdx   - 0-indexed active week
 * @returns {{
 *   factors: Array<{ key: string, label: { en, tr }, detail: { en, tr }, citation?: string }>,
 *   hasContent: boolean,
 * }}
 */
export function explainPlannedWeek({ plan, weekIdx } = {}) {
  const factors = []
  if (!plan?.weeks?.length || weekIdx == null || weekIdx < 0 || weekIdx >= plan.weeks.length) {
    return { factors, hasContent: false }
  }
  const week = plan.weeks[weekIdx]
  const prevWeek = weekIdx > 0 ? plan.weeks[weekIdx - 1] : null
  const nextWeek = weekIdx < plan.weeks.length - 1 ? plan.weeks[weekIdx + 1] : null

  // ── Phase factor ──
  const phase = phaseBlurb(week.phase)
  if (phase) {
    factors.push({
      key: 'phase',
      label:  { en: `Phase: ${String(week.phase || '').toUpperCase()}`,
                tr: `Faz: ${String(week.phase || '').toUpperCase()}` },
      detail: { en: phase.en, tr: phase.tr },
      citation: phase.citation,
    })
  }

  // ── Volume ramp factor (vs previous week) ──
  if (prevWeek && Number.isFinite(Number(week.tss)) && Number.isFinite(Number(prevWeek.tss)) && prevWeek.tss > 0) {
    const deltaPct = Math.round(((week.tss - prevWeek.tss) / prevWeek.tss) * 100)
    if (Math.abs(deltaPct) >= 3) {
      const direction = deltaPct > 0 ? 'up' : 'down'
      const detail = direction === 'up'
        ? {
            en: `+${deltaPct}% TSS vs last week. The Coggan safe-ramp band is 5–10% per week — anything beyond +14% sustained risks injury.`,
            tr: `Geçen haftaya göre +%${deltaPct} TSS. Coggan güvenli artış bandı haftada %5–10 — +%14'ün üstü sakatlık riski.`,
          }
        : {
            en: `${deltaPct}% TSS vs last week — planned step-down. Recovery-type weeks consolidate the prior block's adaptation.`,
            tr: `Geçen haftaya göre %${deltaPct} TSS — planlı azalış. İyileşme haftaları önceki bloğun adaptasyonunu pekiştirir.`,
          }
      factors.push({
        key: 'volume-ramp',
        label:  { en: `Volume: ${deltaPct > 0 ? '+' : ''}${deltaPct}%`, tr: `Hacim: ${deltaPct > 0 ? '+' : ''}%${deltaPct}` },
        detail,
        citation: direction === 'up' ? 'Coggan (5–10% weekly ramp band)' : 'Mujika 2003',
      })
    }
  }

  // ── Distribution factor ──
  const buckets = sessionBuckets(week.sessions)
  const totalQuality = buckets.easy + buckets.threshold + buckets.hard
  if (totalQuality >= 3) {
    const easyShare = buckets.easy / totalQuality
    const threshShare = buckets.threshold / totalQuality
    let detail = null
    if (easyShare >= 0.7 && threshShare <= 0.2) {
      detail = {
        en: `${buckets.easy} easy / ${buckets.threshold} threshold / ${buckets.hard} hard — polarized split, Seiler 80/20 model.`,
        tr: `${buckets.easy} kolay / ${buckets.threshold} eşik / ${buckets.hard} sert — polarize ayrım, Seiler 80/20 modeli.`,
      }
    } else if (threshShare > 0.4) {
      detail = {
        en: `${buckets.easy} easy / ${buckets.threshold} threshold / ${buckets.hard} hard — threshold-heavy; quality concentrated in tempo work rather than polarized intervals.`,
        tr: `${buckets.easy} kolay / ${buckets.threshold} eşik / ${buckets.hard} sert — eşik ağırlıklı; kalite tempo çalışmasında, polarize aralıklarda değil.`,
      }
    } else {
      detail = {
        en: `${buckets.easy} easy / ${buckets.threshold} threshold / ${buckets.hard} hard — pyramidal split.`,
        tr: `${buckets.easy} kolay / ${buckets.threshold} eşik / ${buckets.hard} sert — piramidal ayrım.`,
      }
    }
    factors.push({
      key: 'distribution',
      label:  { en: 'Distribution', tr: 'Dağılım' },
      detail,
      citation: 'Seiler 2010',
    })
  }

  // ── Position factor ──
  const total = plan.weeks.length
  const pct = Math.round(((weekIdx + 1) / total) * 100)
  factors.push({
    key: 'position',
    label:  { en: `Week ${weekIdx + 1} of ${total}`, tr: `Hafta ${weekIdx + 1} / ${total}` },
    detail: {
      en: `${pct}% through the macro cycle. The plan's structure is paced so peak fitness lands at the race-week target, not earlier.`,
      tr: `Makro döngünün %${pct}'i tamamlandı. Plan, zirve formu yarış-haftası hedefine denk gelecek şekilde ayarlandı, daha erkene değil.`,
    },
  })

  // ── Transition factor (when next week's phase differs) ──
  if (nextWeek && nextWeek.phase && week.phase && String(nextWeek.phase) !== String(week.phase)) {
    factors.push({
      key: 'transition',
      label:  { en: `Next week → ${String(nextWeek.phase).toUpperCase()}`,
                tr: `Gelecek hafta → ${String(nextWeek.phase).toUpperCase()}` },
      detail: {
        en: `Phase transition to ${nextWeek.phase}. Anticipate the shift in session-type distribution and load.`,
        tr: `${nextWeek.phase} fazına geçiş. Seans tipi dağılımı ve yükteki değişimi öngör.`,
      },
    })
  }

  return { factors, hasContent: factors.length > 0 }
}
