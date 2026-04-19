// src/lib/__tests__/book/chapterBonuses.test.js — E16
import { describe, it, expect } from 'vitest'
import {
  CHAPTERS,
  getChapter,
  getAllChapterIds,
  getChaptersByType,
  validateAllChapters,
} from '../../book/chapterBonuses.js'

// ── Structure integrity ────────────────────────────────────────────────────

describe('validateAllChapters', () => {
  it('all 22 chapters pass integrity check', () => {
    const { valid, errors } = validateAllChapters()
    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('exactly 22 chapters defined', () => {
    expect(Object.keys(CHAPTERS)).toHaveLength(22)
  })

  it('chapter IDs are ch1 through ch22 exactly', () => {
    const ids = getAllChapterIds()
    for (let i = 1; i <= 22; i++) {
      expect(ids).toContain(`ch${i}`)
    }
  })
})

// ── Per-chapter content requirements ─────────────────────────────────────

describe('every chapter', () => {
  const chapters = Object.values(CHAPTERS)

  it('has a non-empty EN title', () => {
    for (const ch of chapters) {
      expect(ch.title.en.length).toBeGreaterThan(5)
    }
  })

  it('has a non-empty TR title', () => {
    for (const ch of chapters) {
      expect(ch.title.tr.length).toBeGreaterThan(5)
    }
  })

  it('has a bonus with a citation', () => {
    for (const ch of chapters) {
      expect(typeof ch.bonus.citation).toBe('string')
      expect(ch.bonus.citation.length).toBeGreaterThan(10)
    }
  })

  it('has bonus type from allowed set', () => {
    const allowed = ['calculator', 'protocol', 'template', 'table', 'simulator']
    for (const ch of chapters) {
      expect(allowed).toContain(ch.bonus.type)
    }
  })

  it('has EN bonus title', () => {
    for (const ch of chapters) {
      expect(ch.bonus.title.en.length).toBeGreaterThan(3)
    }
  })

  it('has EN bonus description', () => {
    for (const ch of chapters) {
      expect(ch.bonus.description.en.length).toBeGreaterThan(10)
    }
  })
})

// ── getChapter ─────────────────────────────────────────────────────────────

describe('getChapter', () => {
  it('returns ch5 correctly', () => {
    const ch = getChapter('ch5')
    expect(ch.id).toBe('ch5')
    expect(ch.title.en).toContain('Heart Rate')
  })

  it('returns ch22 (last chapter) correctly', () => {
    const ch = getChapter('ch22')
    expect(ch.id).toBe('ch22')
  })

  it('returns null for unknown chapter ID', () => {
    expect(getChapter('ch99')).toBeNull()
    expect(getChapter('')).toBeNull()
    expect(getChapter(null)).toBeNull()
  })

  it('returns null for ch0 (out of range)', () => {
    expect(getChapter('ch0')).toBeNull()
  })
})

// ── getChaptersByType ──────────────────────────────────────────────────────

describe('getChaptersByType', () => {
  it('returns at least 4 calculator chapters', () => {
    const calcs = getChaptersByType('calculator')
    expect(calcs.length).toBeGreaterThanOrEqual(4)
  })

  it('returns at least 3 protocol chapters', () => {
    const protocols = getChaptersByType('protocol')
    expect(protocols.length).toBeGreaterThanOrEqual(3)
  })

  it('returns at least 3 template chapters', () => {
    const templates = getChaptersByType('template')
    expect(templates.length).toBeGreaterThanOrEqual(3)
  })

  it('returns at least 1 table chapter', () => {
    expect(getChaptersByType('table').length).toBeGreaterThanOrEqual(1)
  })

  it('returns at least 2 simulator chapters', () => {
    expect(getChaptersByType('simulator').length).toBeGreaterThanOrEqual(2)
  })
})

// ── Calculator compute functions ──────────────────────────────────────────

describe('ch5 HR zone calculator', () => {
  const { compute } = CHAPTERS.ch5.bonus

  it('computes 5 zones from HRmax only', () => {
    const result = compute({ hrmax: 180 })
    expect(result.z1.lo).toBeLessThan(result.z1.hi)
    expect(result.z5.hi).toBeCloseTo(180, -1)
  })

  it('z1.lo < z2.lo < z3.lo < z4.lo < z5.lo (ascending)', () => {
    const r = compute({ hrmax: 190 })
    expect(r.z1.lo).toBeLessThan(r.z2.lo)
    expect(r.z2.lo).toBeLessThan(r.z3.lo)
    expect(r.z3.lo).toBeLessThan(r.z4.lo)
    expect(r.z4.lo).toBeLessThan(r.z5.lo)
  })
})

describe('ch6 FTP zone calculator (Coggan)', () => {
  const { compute } = CHAPTERS.ch6.bonus

  it('z1 top < z2 bottom', () => {
    const r = compute({ ftp: 250 })
    expect(r.z1.hi).toBeLessThan(r.z2.lo)
  })

  it('z4 straddles FTP (0.91–1.05)', () => {
    const ftp = 200
    const r = compute({ ftp })
    expect(r.z4.lo).toBeLessThan(ftp)
    expect(r.z4.hi).toBeGreaterThan(ftp)
  })

  it('z7 has no hi (null)', () => {
    expect(CHAPTERS.ch6.bonus.compute({ ftp: 250 }).z7.hi).toBeNull()
  })
})

describe('ch7 TSS estimator', () => {
  const { compute } = CHAPTERS.ch7.bonus

  it('returns positive TSS for valid inputs', () => {
    const { tss } = compute({ duration_min: 60, avg_hr: 145, max_hr: 185 })
    expect(tss).toBeGreaterThan(0)
  })

  it('higher HR fraction → higher TSS (same duration)', () => {
    const low  = compute({ duration_min: 60, avg_hr: 120, max_hr: 185 })
    const high = compute({ duration_min: 60, avg_hr: 165, max_hr: 185 })
    expect(high.tss).toBeGreaterThan(low.tss)
  })
})

describe('ch3 VO2max estimator (Uth)', () => {
  const { compute } = CHAPTERS.ch3.bonus

  it('HRmax=200, HRrest=50 → VO2max=60', () => {
    // 15 × (200/50) = 15 × 4 = 60
    const { vo2max } = compute({ hrmax: 200, hrrest: 50 })
    expect(vo2max).toBe(60)
  })

  it('higher HR ratio → higher VO2max', () => {
    const low  = compute({ hrmax: 180, hrrest: 70 })
    const high = compute({ hrmax: 200, hrrest: 50 })
    expect(high.vo2max).toBeGreaterThan(low.vo2max)
  })
})

// ── Chapter-specific requirements ─────────────────────────────────────────

describe('specific chapter requirements', () => {
  it('ch8 (Polarized) template has exactly 5 sessions', () => {
    expect(CHAPTERS.ch8.bonus.sessions).toHaveLength(5)
  })

  it('ch14 (Taper) template notes contain [EŞİK Ch.14]', () => {
    for (const s of CHAPTERS.ch14.bonus.sessions) {
      expect(s.notes).toContain('[EŞİK Ch.14]')
    }
  })

  it('ch13/ch18/ch21 (simulators) have requiresAuth=true', () => {
    expect(CHAPTERS.ch13.bonus.requiresAuth).toBe(true)
    expect(CHAPTERS.ch18.bonus.requiresAuth).toBe(true)
    expect(CHAPTERS.ch21.bonus.requiresAuth).toBe(true)
  })

  it('ch2 (table) has 5 rows covering 0s to 8+ min', () => {
    expect(CHAPTERS.ch2.bonus.rows).toHaveLength(5)
    expect(CHAPTERS.ch2.bonus.rows[0].duration).toBe('0–10s')
    expect(CHAPTERS.ch2.bonus.rows[4].duration).toBe('8+ min')
  })

  it('ch10 MAF calculator adjusts down for injury', () => {
    const { compute } = CHAPTERS.ch10.bonus
    const base    = compute({ age: 35 })
    const injured = compute({ age: 35, injury: true })
    expect(injured.maf_hr).toBe(base.maf_hr - 5)
  })

  it('ch10 MAF calculator adjusts up for 2+ year training', () => {
    const { compute } = CHAPTERS.ch10.bonus
    const base     = compute({ age: 35 })
    const veteran  = compute({ age: 35, training_3plus: true })
    expect(veteran.maf_hr).toBe(base.maf_hr + 5)
  })

  it('ch15 HRV calculator detects >10% drop correctly', () => {
    const { compute } = CHAPTERS.ch15.bonus
    const low_hrv   = compute({ hrv_today: 40, hrv_7d: 50 }) // 20% drop
    const ok_hrv    = compute({ hrv_today: 48, hrv_7d: 50 }) // 4% drop
    expect(low_hrv.status.en).toContain('Recovery')
    expect(ok_hrv.status.en).toContain('Training as planned')
  })
})
