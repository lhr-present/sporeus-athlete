// @vitest-environment jsdom
// ─── TodayReadinessCard.test.jsx — persistent dashboard readiness ───────────
// Verifies the home-dashboard readiness card:
//   • Empty state (no recovery today) renders CTA
//   • Score renders when today's recovery entry exists
//   • Reliability badge surfaces the lib value
//   • Top driver text appears
//   • Session recommendation pill shows RECOVERY/EASY/PLANNED/PUSH
//   • TR labels render under lang='tr'
//   • Score=null path shows "Insufficient data"
//   • Card has the expected aria attributes

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'

// Mocks must be hoisted with vi.mock — keep simple bilingual stubs the card consumes.

import TodayReadinessCard from '../dashboard/TodayReadinessCard.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().slice(0, 10)

function dateAt(daysAgo) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

/** Build 28 days of recovery history with HRV + sleep, plus today's entry. */
function buildRecovery({ todayHrv = 65, todaySleep = 7.5, todaySoreness = 3, todayEnergy = 3 } = {}) {
  const out = []
  for (let i = 28; i >= 1; i--) {
    out.push({
      date:     dateAt(i),
      hrv:      65,
      sleepHrs: 7.5,
      soreness: 3,
      energy:   3,
      sleep:    3,
    })
  }
  out.push({
    date:     todayISO(),
    hrv:      todayHrv,
    sleepHrs: todaySleep,
    soreness: todaySoreness,
    energy:   todayEnergy,
    sleep:    3,
  })
  return out
}

function renderCard({ lang = 'en', recovery = [], onOpenCheckIn } = {}) {
  const ctx = { lang, setLang: vi.fn(), t: k => k }
  return render(
    <LangCtx.Provider value={ctx}>
      <TodayReadinessCard recovery={recovery} log={[]} profile={{}} onOpenCheckIn={onOpenCheckIn} />
    </LangCtx.Provider>
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TodayReadinessCard — persistent dashboard readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.resetModules()
    vi.doUnmock('../../lib/recovery/readinessScore.js')
  })

  it('renders empty state with CTA when recovery=[]', () => {
    renderCard({ recovery: [] })
    expect(screen.getByTestId('readiness-empty-cta')).toBeInTheDocument()
    expect(screen.getByTestId('readiness-empty-cta')).toHaveTextContent(/morning check-in/i)
    expect(screen.getByTestId('open-checkin-btn')).toBeInTheDocument()
  })

  it('renders score when today has a recovery entry', () => {
    const recovery = buildRecovery({ todayHrv: 65, todaySleep: 7.5 })
    renderCard({ recovery })
    const score = screen.getByTestId('readiness-score')
    expect(score).toBeInTheDocument()
    // 0–100 number followed by "/100"
    expect(score.textContent).toMatch(/^\d{1,3}\/100$/)
  })

  it('shows reliability badge with one of the three lib values', () => {
    const recovery = buildRecovery({ todayHrv: 65 })
    renderCard({ recovery })
    const badge = screen.getByTestId('reliability-badge')
    expect(badge).toBeInTheDocument()
    expect(['data complete', 'partial data', 'limited data']).toContain(badge.textContent.trim())
  })

  it('renders the top driver text from the readiness lib', () => {
    // Drop today's sleep way below baseline so sleep WILL be a top driver
    const recovery = buildRecovery({ todayHrv: 65, todaySleep: 4 })
    renderCard({ recovery })
    // sleep driver is highly likely with 4h vs 7.5h baseline
    const driverEl = screen.queryByTestId('driver-sleep')
      || screen.queryByTestId('driver-hrv')
      || screen.queryByTestId('driver-soreness')
      || screen.queryByTestId('driver-mood')
    expect(driverEl).not.toBeNull()
    expect(driverEl.textContent.length).toBeGreaterThan(0)
  })

  it('renders the session recommendation pill (RECOVERY / EASY / PLANNED / PUSH)', () => {
    const recovery = buildRecovery({ todayHrv: 65 })
    renderCard({ recovery })
    const kind = screen.getByTestId('rec-kind')
    expect(kind).toBeInTheDocument()
    expect(['RECOVERY', 'EASY', 'PLANNED', 'PUSH']).toContain(kind.textContent.trim())
  })

  it('renders Turkish labels when lang=tr', () => {
    const recovery = buildRecovery({ todayHrv: 65 })
    renderCard({ lang: 'tr', recovery })
    // TR header
    expect(screen.getByText(/HAZIR OLMA/)).toBeInTheDocument()
    // TR reliability badge
    const badge = screen.getByTestId('reliability-badge')
    expect(['veri tam', 'kısmi veri', 'yetersiz veri']).toContain(badge.textContent.trim())
    // TR session label
    const kind = screen.getByTestId('rec-kind')
    expect(['TOPARLANMA', 'KOLAY', 'PLANLI', 'YÜKLEN']).toContain(kind.textContent.trim())
  })

  it('shows "Insufficient data" when readiness score is null', async () => {
    // Mock the lib to force a null score this run
    vi.resetModules()
    vi.doMock('../../lib/recovery/readinessScore.js', () => ({
      computeReadinessScore: () => ({
        score: null, drivers: [], reliability: 'low',
        components: { hrv: null, sleep: null, soreness: null, mood: null },
        citation: 'mock',
      }),
    }))
    const Mocked = (await import('../dashboard/TodayReadinessCard.jsx')).default
    const ctx = { lang: 'en', setLang: vi.fn(), t: k => k }
    const recovery = [{
      date: todayISO(), hrv: null, sleepHrs: 7, soreness: 3, energy: 3, sleep: 3,
    }]
    render(
      <LangCtx.Provider value={ctx}>
        <Mocked recovery={recovery} log={[]} profile={{}} />
      </LangCtx.Provider>
    )
    expect(screen.getByTestId('readiness-empty')).toBeInTheDocument()
    expect(screen.getByTestId('readiness-empty')).toHaveTextContent(/Insufficient data/i)
    // CTA still rendered so the user can adjust their check-in
    expect(screen.getByTestId('open-checkin-btn')).toBeInTheDocument()
  })

  it('renders the recommendation reason sentence and citation under the pill', () => {
    const recovery = buildRecovery({ todayHrv: 65 })
    renderCard({ recovery })
    const reason = screen.getByTestId('rec-reason')
    expect(reason).toBeInTheDocument()
    // reason is a full sentence from the lib (not just the bucket label)
    expect(reason.textContent.length).toBeGreaterThan(15)
    // citation rendered in the muted-italic style used elsewhere
    const cite = screen.getByTestId('rec-citation')
    expect(cite).toBeInTheDocument()
    expect(cite.textContent).toMatch(/Plews 2013/)
  })

  it('renders the recommendation reason in Turkish under lang=tr', () => {
    const recovery = buildRecovery({ todayHrv: 65 })
    renderCard({ lang: 'tr', recovery })
    const reason = screen.getByTestId('rec-reason')
    expect(reason).toBeInTheDocument()
    // TR reason strings all contain "Hazır olma"
    expect(reason.textContent).toMatch(/Hazır olma/)
  })

  it('exposes role=region with aria-label on the card', () => {
    const recovery = buildRecovery({ todayHrv: 65 })
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /today.*readiness/i })
    expect(region).toBeInTheDocument()
  })

  it('CTA button calls onOpenCheckIn when provided in empty state', () => {
    const onOpenCheckIn = vi.fn()
    renderCard({ recovery: [], onOpenCheckIn })
    fireEvent.click(screen.getByTestId('open-checkin-btn'))
    expect(onOpenCheckIn).toHaveBeenCalledTimes(1)
  })
})
