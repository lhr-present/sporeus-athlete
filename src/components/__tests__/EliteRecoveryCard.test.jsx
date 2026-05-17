// @vitest-environment jsdom
// ─── EliteRecoveryCard.test.jsx — render tests for the standalone surface ───
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import EliteRecoveryCard from '../dashboard/EliteRecoveryCard.jsx'

afterEach(() => {
  cleanup()
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <EliteRecoveryCard {...props} />
    </LangCtx.Provider>
  )
}

describe('EliteRecoveryCard — gating', () => {
  it('renders nothing when profile is empty (no primarySport)', () => {
    const { container } = renderCard({ profile: {} })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-elite-recovery-card]')).toBeNull()
  })

  it('renders nothing when profile is null/undefined', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

describe('EliteRecoveryCard — typical endurance profile', () => {
  const profile = {
    primarySport: 'Running',
    weeklyHours: 8,
    weeklyTssGoal: 350,
  }

  it('renders the card region with the data-elite-recovery-card anchor', () => {
    renderCard({ profile })
    const region = screen.getByRole('region', { name: /Elite recovery program/i })
    expect(region).toBeInTheDocument()
    expect(region.hasAttribute('data-elite-recovery-card')).toBe(true)
    expect(document.querySelector('[data-elite-recovery-card]')).not.toBeNull()
  })

  it('renders all four phases (Base / Build / Peak / Taper)', () => {
    renderCard({ profile })
    expect(document.querySelector('[data-phase="Base"]')).not.toBeNull()
    expect(document.querySelector('[data-phase="Build"]')).not.toBeNull()
    expect(document.querySelector('[data-phase="Peak"]')).not.toBeNull()
    expect(document.querySelector('[data-phase="Taper"]')).not.toBeNull()
  })

  it('sleep target (hours/night) appears in the DOM for every phase', () => {
    renderCard({ profile })
    const sleepNodes = document.querySelectorAll('[data-sleep-target]')
    expect(sleepNodes.length).toBe(4)
    for (const node of sleepNodes) {
      // e.g. "SLEEP: 8–9 h/night" or with the TSS-scaled bump
      expect(node.textContent).toMatch(/h\/night/)
      expect(node.textContent).toMatch(/\d/)
    }
  })

  it('renders deload-week cadence for every phase', () => {
    renderCard({ profile })
    const deloadNodes = document.querySelectorAll('[data-deload]')
    expect(deloadNodes.length).toBe(4)
    // Taper has deloadEvery=0 → renders the "race week" phrasing
    const taperDeload = document.querySelector('[data-phase="Taper"] [data-deload]')
    expect(taperDeload.textContent).toMatch(/race week|deload/i)
    // Peak/Build/Base render "every N weeks"
    const peakDeload = document.querySelector('[data-phase="Peak"] [data-deload]')
    expect(peakDeload.textContent).toMatch(/every \d+ weeks/i)
  })

  it('shows at most three modalities per phase', () => {
    renderCard({ profile })
    const phaseDivs = document.querySelectorAll('[data-phase]')
    for (const div of phaseDivs) {
      const modalities = div.querySelectorAll('[data-modality]')
      expect(modalities.length).toBeGreaterThan(0)
      expect(modalities.length).toBeLessThanOrEqual(3)
    }
  })

  it('citation is rendered at the bottom', () => {
    renderCard({ profile })
    const citation = document.querySelector('[data-recovery-citation]')
    expect(citation).not.toBeNull()
    expect(citation.textContent).toMatch(/Halson 2019/)
    expect(citation.textContent).toMatch(/Kellmann 2018/)
  })
})

describe('EliteRecoveryCard — bilingual', () => {
  const profile = { primarySport: 'Running', weeklyHours: 8 }

  it('renders Turkish title + phase labels when lang=tr', () => {
    renderCard({ profile }, 'tr')
    const region = screen.getByRole('region', { name: /Elit toparlanma programı/i })
    expect(region).toBeInTheDocument()
    // Turkish phase label TEMEL for Base
    expect(region.textContent).toMatch(/TEMEL/)
    expect(region.textContent).toMatch(/YAPILANMA/)
    expect(region.textContent).toMatch(/TEPE/)
    expect(region.textContent).toMatch(/DİNÇLENME/)
    // Turkish sleep unit "sa/gece"
    expect(region.textContent).toMatch(/sa\/gece/)
  })

  it('renders Turkish modality copy when lang=tr (foam roller appears in TR text)', () => {
    renderCard({ profile }, 'tr')
    const region = screen.getByRole('region', { name: /Elit toparlanma programı/i })
    // BASE modalities list includes Turkish "foam roller"
    expect(region.textContent).toMatch(/foam roller/i)
    // Confirm Turkish-specific phrasing is present (not English fallback)
    expect(region.textContent).toMatch(/günlük|mobilite|dinlenme/i)
  })
})
