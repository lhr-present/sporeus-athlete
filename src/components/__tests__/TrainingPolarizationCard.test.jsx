// @vitest-environment jsdom
// ─── TrainingPolarizationCard.test.jsx — render tests for v8.82.0 card ───────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TrainingPolarizationCard from '../dashboard/TrainingPolarizationCard.jsx'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TrainingPolarizationCard {...props} />
    </LangCtx.Provider>
  )
}

const TODAY = '2026-05-07'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeLog(count, today, zonesArr) {
  const log = []
  for (let i = count - 1; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      zones: zonesArr.slice(),
      type: 'run',
    })
  }
  return log
}

const POLARIZED_FIXTURE = makeLog(28, TODAY, [40, 40, 5, 10, 5])
const PYRAMIDAL_FIXTURE = makeLog(28, TODAY, [60, 25, 10, 4, 1])
const THRESHOLD_FIXTURE = makeLog(28, TODAY, [10, 30, 30, 20, 10])
const MIXED_FIXTURE = makeLog(28, TODAY, [5, 35, 20, 35, 5])
const NULL_INDEX_FIXTURE = makeLog(28, TODAY, [50, 30, 10, 0, 0])

describe('TrainingPolarizationCard — insufficient data', () => {
  it('renders insufficient-data notice when log empty', () => {
    renderCard({ log: [] })
    expect(
      screen.getByText(/Log 200\+ minutes over 7\+ days to detect pattern/i)
    ).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(
      screen.getByText(/Desen tespiti için 200\+ dk ve 7\+ gün veri gerekli/i)
    ).toBeInTheDocument()
  })
})

describe('TrainingPolarizationCard — pattern classification', () => {
  it('polarized fixture renders POLARIZED badge with positive index', () => {
    renderCard({ log: POLARIZED_FIXTURE })
    expect(screen.getByText('POLARIZED')).toBeInTheDocument()
    // Polarization index for [40,40,5,10,5]: log10(80/15) ≈ 0.7
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/0\.\d/)
  })

  it('pyramidal fixture renders PYRAMIDAL badge', () => {
    renderCard({ log: PYRAMIDAL_FIXTURE })
    expect(screen.getByText('PYRAMIDAL')).toBeInTheDocument()
  })

  it('threshold fixture (Z3>25%) renders THRESHOLD badge', () => {
    renderCard({ log: THRESHOLD_FIXTURE })
    expect(screen.getByText('THRESHOLD')).toBeInTheDocument()
  })

  it('mixed fixture renders MIXED badge', () => {
    renderCard({ log: MIXED_FIXTURE })
    expect(screen.getByText('MIXED')).toBeInTheDocument()
  })
})

describe('TrainingPolarizationCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    renderCard({ log: POLARIZED_FIXTURE })
    expect(screen.getByText('TRAINING POLARIZATION')).toBeInTheDocument()
  })

  it('renders Turkish title and pattern label when lang=tr', () => {
    renderCard({ log: POLARIZED_FIXTURE }, 'tr')
    expect(screen.getByText('POLARİZASYON DESENİ')).toBeInTheDocument()
    expect(screen.getByText('POLARİZE')).toBeInTheDocument()
  })
})

describe('TrainingPolarizationCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label (en)', () => {
    renderCard({ log: POLARIZED_FIXTURE })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Training polarization/i)
  })

  it('renders role=img stacked bar with zone-share aria-label', () => {
    renderCard({ log: POLARIZED_FIXTURE })
    const bar = screen.getByRole('img')
    expect(bar).toBeInTheDocument()
    expect(bar.getAttribute('aria-label')).toMatch(/Z1.*Z2.*Z3.*Z4.*Z5/)
  })

  it('renders the citation footer', () => {
    renderCard({ log: POLARIZED_FIXTURE })
    expect(screen.getByText(/Esteve-Lanao/)).toBeInTheDocument()
  })
})

describe('TrainingPolarizationCard — content rendering', () => {
  it('pol index renders as "—" when Z4+Z5=0 (null index)', () => {
    renderCard({ log: NULL_INDEX_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('—')
  })

  it('Z1+Z2 / Z3 / Z4+Z5 sub-line renders', () => {
    renderCard({ log: POLARIZED_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/Z1\+Z2:\s*\d/)
    expect(region.textContent).toMatch(/Z3:\s*\d/)
    expect(region.textContent).toMatch(/Z4\+Z5:\s*\d/)
  })

  it('windowDays defaults to 28 in sub-line', () => {
    renderCard({ log: POLARIZED_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/over 28d/)
    expect(region.textContent).toMatch(/28G'de/)
  })

  it('threshold accent bar uses red color', () => {
    renderCard({ log: THRESHOLD_FIXTURE })
    const region = screen.getByRole('region')
    const style = region.getAttribute('style') || ''
    expect(style).toMatch(/#dc3545|rgb\(220,\s*53,\s*69\)/)
  })
})
