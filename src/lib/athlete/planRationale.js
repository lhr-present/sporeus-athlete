// src/lib/athlete/planRationale.js
//
// v9.121.0 — Show-your-work for the prescribed daily session.
//
// Sporeus's mission is "target → physiology → science-based plan →
// daily answer." The system tells the athlete WHAT to train today
// — a session type, duration, RPE, zone — but rarely explains WHY.
// Athletes who don't see the reasoning have two failure modes:
//   1. Distrust: "this Easy Z2 makes no sense, I feel great today"
//   2. Over-trust: blind compliance with no skill-building intuition
//
// This module derives a structured rationale from data the system
// already has: phase context, yesterday's load, current TSB, recent
// sleep. Each factor is a small {label, detail, citation?} card the
// UI can render. Pure function — testable, no I/O.
//
// Not a coach replacement. Surfaces the existing inputs, doesn't
// invent new prescriptions.

import { calcLoad } from '../formulas.js'

const HARD_RPE = 7

/**
 * @description Get yesterday's most-significant training entry for
 *   the rationale. Returns the highest-RPE entry on the prior date
 *   when multiple sessions exist (a double day's hard session is the
 *   relevant factor, not the easy one).
 */
function yesterdayEntry(log, today) {
  if (!Array.isArray(log) || !today) return null
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  const ydate = d.toISOString().slice(0, 10)
  const candidates = log.filter(e => e?.date === ydate && Number(e?.tss) > 0)
  if (candidates.length === 0) return null
  return candidates.reduce((best, e) =>
    (Number(e?.rpe) || 0) > (Number(best?.rpe) || 0) ? e : best,
    candidates[0],
  )
}

/**
 * @description Bilingual phase-context blurb. Used when the session
 *   carries weekPhase metadata (set by the elite-program path or by
 *   v9.84+'s generatePlan phase tagging).
 */
function phaseExplanation(weekPhase) {
  const phase = String(weekPhase || '').toUpperCase()
  if (phase.includes('BASE')) return {
    en: 'Base phase — building aerobic capacity. Most sessions are easy by design.',
    tr: 'Temel faz — aerobik kapasiteyi inşa ediyor. Çoğu seans bilinçli olarak kolay.',
    citation: 'Seiler 2010 (polarized training)',
  }
  if (phase.includes('BUILD')) return {
    en: 'Build phase — adding race-specific intensity onto the aerobic base.',
    tr: 'Yapım fazı — aerobik temele yarış-özgül yoğunluk ekleniyor.',
    citation: 'Bompa & Buzzichelli 2018 (periodization)',
  }
  if (phase.includes('PEAK')) return {
    en: 'Peak phase — sharpest training of the cycle; specific workouts at race effort.',
    tr: 'Zirve fazı — döngünün en keskin antrenmanı; yarış efoluyla özgül seanslar.',
    citation: 'Bompa & Buzzichelli 2018',
  }
  if (phase.includes('TAPER')) return {
    en: 'Taper phase — volume −41% (median), intensity preserved. Fitness consolidates.',
    tr: 'Taper fazı — hacim −%41 (ortanca), yoğunluk korunuyor. Form pekişiyor.',
    citation: 'Bosquet 2007 (taper meta-analysis)',
  }
  if (phase.includes('REST') || phase.includes('RECOVERY')) return {
    en: 'Recovery phase — load eased so adaptation can catch up.',
    tr: 'İyileşme fazı — adaptasyon yetişsin diye yük azaltıldı.',
    citation: 'Mujika 2003',
  }
  return null
}

/**
 * @description Derive the rationale for a prescribed session. Returns
 *   a structured factor list and an empty list signal for callers
 *   that want to render conditionally.
 *
 * @param {Object} args
 * @param {Object} args.session    - the prescribed session (type, duration, rpe, weekPhase, ...)
 * @param {Array}  args.log        - training log
 * @param {Array}  args.recovery   - recovery entries
 * @param {Object} args.profile    - athlete profile (unused now; reserved for future)
 * @param {string} args.today      - 'YYYY-MM-DD'
 * @returns {{
 *   factors: Array<{ key: string, label: { en, tr }, detail: { en, tr }, citation?: string }>,
 *   hasContent: boolean,
 * }}
 */
export function explainPlannedSession({ session, log, recovery, profile: _profile, today } = {}) {
  const factors = []
  if (!session || !today) return { factors, hasContent: false }

  // ── Phase factor ──
  const phaseInfo = phaseExplanation(session.weekPhase)
  if (phaseInfo) {
    factors.push({
      key: 'phase',
      label:  { en: `Phase: ${String(session.weekPhase || '').toUpperCase()}`,
                tr: `Faz: ${String(session.weekPhase || '').toUpperCase()}` },
      detail: { en: phaseInfo.en, tr: phaseInfo.tr },
      citation: phaseInfo.citation,
    })
  }

  // ── Yesterday's load factor ──
  const yEntry = yesterdayEntry(log, today)
  if (yEntry) {
    // v9.484: null rpe renders as "RPE 0" — treat no-signal as not-hard, and
    // the render site skips the RPE fragment when yRPE is 0 (falsy).
    const yRPE = yEntry.rpe == null ? 0 : (Number(yEntry.rpe) || 0)
    const yHard = yRPE >= HARD_RPE
    const todayRPE = Number(session.rpe) || 0
    const todayHard = todayRPE >= HARD_RPE
    if (yHard && !todayHard) {
      factors.push({
        key: 'yesterday',
        label:  { en: `Yesterday: hard (RPE ${yRPE})`, tr: `Dün: zor (RPE ${yRPE})` },
        detail: { en: "Today's easy session sequences recovery before the next stimulus.",
                  tr: 'Bugünkü kolay seans bir sonraki uyaran öncesi iyileşmeyi sıralıyor.' },
        citation: 'Plews 2013 (HRV-guided periodization)',
      })
    } else if (!yHard && todayHard) {
      factors.push({
        key: 'yesterday',
        label:  { en: `Yesterday: easy (RPE ${yRPE})`, tr: `Dün: kolay (RPE ${yRPE})` },
        detail: { en: 'Easy-then-hard pattern preserves capacity for the key session today.',
                  tr: 'Kolay-sonra-zor sıralaması bugünkü anahtar seans için kapasiteyi korur.' },
      })
    } else if (yHard && todayHard) {
      factors.push({
        key: 'yesterday',
        label:  { en: `Yesterday: hard (RPE ${yRPE})`, tr: `Dün: zor (RPE ${yRPE})` },
        detail: { en: 'Back-to-back hard days — monitor RPE; downgrade if you feel under-recovered.',
                  tr: 'Üst üste zor günler — RPE\'ni izle, iyileşmemiş hissedersen indirge.' },
        citation: 'Foster 2017 (session-RPE)',
      })
    }
  }

  // ── TSB factor ──
  // Anchor the load window to the passed `today` (not wall-clock) — otherwise TSB
  // drifts toward 0 as real time advances past the log dates (stale/missing rationale).
  const load = calcLoad(Array.isArray(log) ? log : [], today)
  const tsb = load?.tsb ?? 0
  if (Math.abs(tsb) >= 5) {
    if (tsb >= 10) {
      factors.push({
        key: 'tsb',
        label:  { en: `TSB +${tsb}`, tr: `TSB +${tsb}` },
        detail: { en: 'Fresh — full session as prescribed; intensity is safe.',
                  tr: 'Dinç — tam seans planlandığı gibi; yoğunluk güvenli.' },
        citation: 'Banister 1991 (PMC)',
      })
    } else if (tsb >= 5) {
      factors.push({
        key: 'tsb',
        label:  { en: `TSB +${tsb}`, tr: `TSB +${tsb}` },
        detail: { en: 'Mildly fresh — full session is fine; consider a strong effort if a key day.',
                  tr: 'Hafifçe dinç — tam seans uygun; anahtar günse güçlü efor düşün.' },
      })
    } else if (tsb <= -15) {
      factors.push({
        key: 'tsb',
        label:  { en: `TSB ${tsb}`, tr: `TSB ${tsb}` },
        detail: { en: 'Deeply fatigued — keep within prescribed RPE; do not push beyond.',
                  tr: 'Derin yorgun — planlanan RPE içinde kal; ötesine itme.' },
        citation: 'Halson 2014 (overtraining)',
      })
    } else if (tsb <= -5) {
      factors.push({
        key: 'tsb',
        label:  { en: `TSB ${tsb}`, tr: `TSB ${tsb}` },
        detail: { en: 'Productively fatigued — session load is calibrated for this state.',
                  tr: 'Verimli yorgun — seans yükü bu duruma göre ayarlandı.' },
      })
    }
  }

  // ── Sleep factor ──
  // v9.122.0 fix: `recovery[i].sleep` is a 1-5 rating (see
  // WELLNESS_FIELDS in lib/constants.js), not hours. v9.121.0 used
  // hour-scale thresholds which fired the short-sleep warning on
  // every rating in production. Switched to rating tiers consistent
  // with wellnessTrend.js's concerningLow=2.5 boundary.
  const todayRec = (Array.isArray(recovery) ? recovery : []).find(r => r?.date === today)
  const sleep = Number(todayRec?.sleep)
  if (Number.isFinite(sleep) && sleep > 0) {
    if (sleep <= 2) {
      factors.push({
        key: 'sleep',
        label:  { en: 'Sleep: poor', tr: 'Uyku: kötü' },
        detail: { en: 'Sleep self-rated 1–2/5 — consider reducing intensity 10–20% today.',
                  tr: 'Uyku 1–2/5 — bugün yoğunluğu %10–20 azaltmayı düşün.' },
        citation: 'Mah 2011 (sleep extension in athletes)',
      })
    } else if (sleep >= 4) {
      factors.push({
        key: 'sleep',
        label:  { en: 'Sleep: good', tr: 'Uyku: iyi' },
        detail: { en: 'Sleep self-rated 4–5/5 — recovery substrate is in good shape for today\'s session.',
                  tr: 'Uyku 4–5/5 — bugünkü seans için iyileşme zemini iyi durumda.' },
      })
    }
  }

  return { factors, hasContent: factors.length > 0 }
}
