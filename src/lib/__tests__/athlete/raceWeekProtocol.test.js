// raceWeekProtocol — Mujika & Padilla 2003 taper generator
import { describe, it, expect } from 'vitest'
import {
  generateRaceWeekProtocol,
  RACE_WEEK_PROTOCOL_CITATION,
} from '../../athlete/raceWeekProtocol.js'

const TODAY = '2026-05-04'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Invalid / missing inputs ───────────────────────────────────────────────
describe('generateRaceWeekProtocol — invalid / missing inputs', () => {
  it('missing raceDate → reliable=false, empty days, safe defaults', () => {
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, undefined, { today: TODAY })
    expect(r.reliable).toBe(false)
    expect(r.days).toEqual([])
    expect(r.daysToRace).toBe(0)
    expect(r.totalTaperTSS).toBe(0)
    expect(r.loadReductionPct).toBe(0)
    expect(r.message.en).toMatch(/Set a race date/i)
    expect(r.message.tr).toMatch(/yarış tarihi/i)
  })

  it('null raceDate → reliable=false, empty days', () => {
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, null, { today: TODAY })
    expect(r.reliable).toBe(false)
    expect(r.days).toEqual([])
  })

  it('non-date string raceDate → reliable=false, empty days', () => {
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, 'not-a-date', { today: TODAY })
    expect(r.reliable).toBe(false)
    expect(r.days).toEqual([])
  })

  it('malformed date "2026-13-40" → reliable=false', () => {
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, '2026-13-40', { today: TODAY })
    expect(r.reliable).toBe(false)
    expect(r.days).toEqual([])
  })

  it('null profile → defaults still computed, reliable=false', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol(null, raceDate, { today: TODAY })
    expect(r.reliable).toBe(false)
    expect(r.days.length).toBe(8)
  })
})

// ─── daysToRace / inRaceWeek arithmetic ─────────────────────────────────────
describe('generateRaceWeekProtocol — daysToRace and inRaceWeek', () => {
  it('raceDate 7 days from today → daysToRace=7, inRaceWeek=true', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.daysToRace).toBe(7)
    expect(r.inRaceWeek).toBe(true)
    expect(r.days.length).toBe(8)
  })

  it('raceDate today → daysToRace=0, inRaceWeek=true', () => {
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, TODAY, { today: TODAY })
    expect(r.daysToRace).toBe(0)
    expect(r.inRaceWeek).toBe(true)
  })

  it('raceDate 1 day in past → daysToRace=-1, inRaceWeek=false', () => {
    const raceDate = addDays(TODAY, -1)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.daysToRace).toBe(-1)
    expect(r.inRaceWeek).toBe(false)
  })

  it('raceDate 30 days future → daysToRace=30, inRaceWeek=false', () => {
    const raceDate = addDays(TODAY, 30)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.daysToRace).toBe(30)
    expect(r.inRaceWeek).toBe(false)
  })

  it('raceDate 8 days future → inRaceWeek=false (just outside)', () => {
    const raceDate = addDays(TODAY, 8)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.daysToRace).toBe(8)
    expect(r.inRaceWeek).toBe(false)
  })
})

// ─── tssTarget / volume scaling with CTL ────────────────────────────────────
describe('generateRaceWeekProtocol — tssTarget vs CTL', () => {
  it('profile.recentCTL=80 → D-7 tssTarget ≈ 48 (60% × 80)', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const d7 = r.days.find(d => d.daysToRace === 7)
    expect(d7.tssTarget).toBe(48)
  })

  it('profile.recentCTL=80 → D-3 tssTarget ≈ 24 (30% × 80)', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const d3 = r.days.find(d => d.daysToRace === 3)
    expect(d3.tssTarget).toBe(24)
  })

  it('missing recentCTL → reliable=false, defaults to ~50 CTL', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({}, raceDate, { today: TODAY })
    expect(r.reliable).toBe(false)
    const d7 = r.days.find(d => d.daysToRace === 7)
    expect(d7.tssTarget).toBe(30) // 60% × 50
  })

  it('profile.recentCTL=0 → reliable=false, defaults applied', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 0 }, raceDate, { today: TODAY })
    expect(r.reliable).toBe(true === false) // === expect false
    const d3 = r.days.find(d => d.daysToRace === 3)
    expect(d3.tssTarget).toBe(15) // 30% × 50
  })
})

// ─── Day structure / ordering ───────────────────────────────────────────────
describe('generateRaceWeekProtocol — day structure', () => {
  it('returns exactly 8 days', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.days.length).toBe(8)
  })

  it('days are ordered earliest first (D-7 first, D-0 last)', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.days[0].daysToRace).toBe(7)
    expect(r.days[7].daysToRace).toBe(0)
    for (let i = 1; i < r.days.length; i++) {
      expect(r.days[i - 1].date < r.days[i].date).toBe(true)
    }
  })

  it('D-0 has intensity "race" and durationMin 0', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const d0 = r.days.find(d => d.daysToRace === 0)
    expect(d0.intensity).toBe('race')
    expect(d0.durationMin).toBe(0)
  })

  it('D-4 has intensity "rest"', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const d4 = r.days.find(d => d.daysToRace === 4)
    expect(d4.intensity).toBe('rest')
  })

  it('D-1 has intensity "rest"', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const d1 = r.days.find(d => d.daysToRace === 1)
    expect(d1.intensity).toBe('rest')
  })

  it('D-3 has intensity "race-pace"', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const d3 = r.days.find(d => d.daysToRace === 3)
    expect(d3.intensity).toBe('race-pace')
  })

  it('D-7 date matches raceDate - 7', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const d7 = r.days.find(d => d.daysToRace === 7)
    expect(d7.date).toBe(addDays(raceDate, -7))
  })

  it('D-0 date matches raceDate', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const d0 = r.days.find(d => d.daysToRace === 0)
    expect(d0.date).toBe(raceDate)
  })
})

// ─── Bilingual coverage ─────────────────────────────────────────────────────
describe('generateRaceWeekProtocol — bilingual content', () => {
  it('every day has non-empty en + tr label and session', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    for (const day of r.days) {
      expect(typeof day.label.en).toBe('string')
      expect(typeof day.label.tr).toBe('string')
      expect(day.label.en.length).toBeGreaterThan(0)
      expect(day.label.tr.length).toBeGreaterThan(0)
      expect(day.session.en.length).toBeGreaterThan(0)
      expect(day.session.tr.length).toBeGreaterThan(0)
      expect(typeof day.notes.en).toBe('string')
      expect(typeof day.notes.tr).toBe('string')
    }
  })

  it('top-line message and recommendation are bilingual non-empty', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })
})

// ─── Aggregates: totalTaperTSS, loadReductionPct ────────────────────────────
describe('generateRaceWeekProtocol — aggregates', () => {
  it('totalTaperTSS equals sum of day tssTargets', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const sum = r.days.reduce((s, d) => s + d.tssTarget, 0)
    expect(r.totalTaperTSS).toBe(sum)
  })

  it('loadReductionPct in expected 30-70 range with CTL=80', () => {
    const raceDate = addDays(TODAY, 7)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.loadReductionPct).toBeGreaterThanOrEqual(30)
    expect(r.loadReductionPct).toBeLessThanOrEqual(70)
  })
})

// ─── Messages by daysToRace ─────────────────────────────────────────────────
describe('generateRaceWeekProtocol — messages by phase', () => {
  it('daysToRace > 7 → message indicates taper not started', () => {
    const raceDate = addDays(TODAY, 14)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.message.en).toMatch(/not yet started/i)
    expect(r.message.tr).toMatch(/henüz başlamadı/i)
  })

  it('inRaceWeek (daysToRace=4) → message references taper day', () => {
    const raceDate = addDays(TODAY, 4)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.message.en).toMatch(/Day -4/)
    expect(r.message.tr).toMatch(/-4/)
  })

  it('daysToRace=0 → message is race day', () => {
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, TODAY, { today: TODAY })
    expect(r.message.en).toMatch(/Race day/i)
    expect(r.message.tr).toMatch(/Yarış günü/i)
  })

  it('daysToRace<0 → message indicates race complete', () => {
    const raceDate = addDays(TODAY, -2)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.message.en).toMatch(/complete/i)
    expect(r.message.tr).toMatch(/tamamlandı/i)
  })

  it('past-race recommendation references recovery week', () => {
    const raceDate = addDays(TODAY, -2)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.recommendation.en).toMatch(/Recovery/i)
    expect(r.recommendation.tr).toMatch(/toparlanma/i)
  })

  it('inRaceWeek recommendation references holding the taper', () => {
    const raceDate = addDays(TODAY, 3)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.recommendation.en).toMatch(/taper/i)
    expect(r.recommendation.tr).toMatch(/taper/i)
  })

  it('before-taper recommendation references base build', () => {
    const raceDate = addDays(TODAY, 30)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.recommendation.en).toMatch(/base/i)
    expect(r.recommendation.tr).toMatch(/temel/i)
  })
})

// ─── Citation / contract ────────────────────────────────────────────────────
describe('generateRaceWeekProtocol — citation and shape', () => {
  it('citation is exported and matches', () => {
    expect(RACE_WEEK_PROTOCOL_CITATION).toBe('Mujika & Padilla 2003; Bosquet 2007')
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, TODAY, { today: TODAY })
    expect(r.citation).toBe(RACE_WEEK_PROTOCOL_CITATION)
  })

  it('options.today override is deterministic', () => {
    const raceDate = addDays(TODAY, 5)
    const r1 = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    const r2 = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r1.daysToRace).toBe(5)
    expect(r2.daysToRace).toBe(5)
    expect(r1.days.length).toBe(r2.days.length)
  })
})

// ─── Race date < 7 days from today: still 8 days, some past ────────────────
describe('generateRaceWeekProtocol — race within 7 days', () => {
  it('raceDate 3 days from today still produces full 8-day plan', () => {
    const raceDate = addDays(TODAY, 3)
    const r = generateRaceWeekProtocol({ recentCTL: 80 }, raceDate, { today: TODAY })
    expect(r.days.length).toBe(8)
    expect(r.daysToRace).toBe(3)
    expect(r.inRaceWeek).toBe(true)
    // Some of the early taper days must be in the past relative to TODAY
    const pastDays = r.days.filter(d => d.date < TODAY)
    expect(pastDays.length).toBeGreaterThan(0)
  })
})
