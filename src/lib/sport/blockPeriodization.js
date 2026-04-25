/**
 * Block Periodization — Issurin (2008) model.
 * Three mesocycles: Accumulation → Transmutation → Realization
 * Ref: Issurin V.B. (2008). Block periodization versus traditional training theory:
 *      a review. J Sports Med Phys Fitness, 48(1), 65-75.
 */

export const BLOCK_PHASES = [
  {
    id: 'accumulation',
    name: { en: 'Accumulation', tr: 'Birikim' },
    focus: { en: 'Aerobic base & volume', tr: 'Aerobik taban ve hacim' },
    tssMultiplier: 0.75,    // lower intensity, higher volume
    zoneEmphasis: 'Z1/Z2',  // polarized base
    durationWeeks: { min: 3, max: 6 },
    citation: 'Issurin (2008)',
  },
  {
    id: 'transmutation',
    name: { en: 'Transmutation', tr: 'Dönüşüm' },
    focus: { en: 'Threshold & VO2max', tr: 'Eşik & VO2max' },
    tssMultiplier: 1.0,
    zoneEmphasis: 'Z3/Z4',
    durationWeeks: { min: 3, max: 5 },
    citation: 'Issurin (2008)',
  },
  {
    id: 'realization',
    name: { en: 'Realization', tr: 'Gerçekleşme' },
    focus: { en: 'Race-specific sharpening & taper', tr: 'Yarışa özel keskinleşme ve taper' },
    tssMultiplier: 0.6,     // taper phase
    zoneEmphasis: 'Z5/Race',
    durationWeeks: { min: 2, max: 3 },
    citation: 'Issurin (2008)',
  },
]

/**
 * Generate a block periodization plan.
 * @param {object} opts
 * @param {number} opts.weeklyHours - base weekly training hours
 * @param {number} opts.totalWeeks - total plan duration (6-14 weeks)
 * @param {number} opts.baseTSS - athlete's current weekly TSS baseline
 * @returns {Array<{week, phase, phaseId, tssTarget, focus, zoneEmphasis, hoursTarget}>}
 */
export function generateBlockPlan({ weeklyHours, totalWeeks, baseTSS }) {
  const tw = Math.max(6, Math.min(14, totalWeeks || 12))
  const bTSS = baseTSS || 300
  const bHours = weeklyHours || 8

  // Proportional split: ~40% Accumulation, ~35% Transmutation, ~25% Realization
  const accWeeks = Math.max(3, Math.round(tw * 0.40))
  const realWeeks = Math.max(2, Math.round(tw * 0.25))
  const transWeeks = Math.max(3, tw - accWeeks - realWeeks)

  const phaseLengths = [accWeeks, transWeeks, realWeeks]

  const result = []
  let weekNum = 1

  BLOCK_PHASES.forEach((phase, pi) => {
    const len = phaseLengths[pi]
    for (let w = 0; w < len; w++) {
      const tssTarget = Math.round(bTSS * phase.tssMultiplier)
      const hoursTarget = Math.round((bHours * phase.tssMultiplier) * 10) / 10
      result.push({
        week: weekNum,
        phase: phase.name.en,
        phaseId: phase.id,
        tssTarget,
        focus: phase.focus.en,
        zoneEmphasis: phase.zoneEmphasis,
        hoursTarget,
        citation: phase.citation,
      })
      weekNum++
    }
  })

  return result
}
