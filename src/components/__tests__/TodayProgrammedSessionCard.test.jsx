// @vitest-environment jsdom
// ─── TodayProgrammedSessionCard.test.jsx — daily-answer card ────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TodayProgrammedSessionCard from '../dashboard/TodayProgrammedSessionCard.jsx'

const PROGRAM_KEY = 'sporeus-eliteProgram'

const RUN_INPUT = {
  sport: 'run',
  currentPR: { distanceM: 10000, timeSec: 3000 },
  targetPR:  { distanceM: 10000, timeSec: 2700 },
  raceDate: '2026-09-04',
  options: { today: '2026-05-04' }, // Monday
}

const BIKE_INPUT = {
  sport: 'bike',
  currentPR: { distanceM: 0, timeSec: 230 },
  targetPR:  { distanceM: 0, timeSec: 260 },
  raceDate: '2026-09-04',
  options: { today: '2026-05-04' },
}

function persistProgram(input) {
  localStorage.setItem(PROGRAM_KEY, JSON.stringify({ input, form: null }))
}

function renderCard(lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TodayProgrammedSessionCard />
    </LangCtx.Provider>
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.setSystemTime(new Date('2026-05-04T12:00:00Z')) // Monday → Mon = rest
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.setSystemTime(new Date())
})

describe('TodayProgrammedSessionCard', () => {
  it('renders no-program notice when localStorage is empty', () => {
    renderCard()
    expect(screen.getByRole('region', { name: /Today's planned session/i })).toBeInTheDocument()
    expect(screen.getByText(/Generate a plan to see today/i)).toBeInTheDocument()
  })

  it('renders bilingual no-program notice', () => {
    renderCard('en')
    expect(screen.getByText(/Generate a plan to see today/i)).toBeInTheDocument()
    expect(screen.getByText(/Bugünün seansını görmek/)).toBeInTheDocument()
  })

  it('Turkish locale uses TR aria-label', () => {
    renderCard('tr')
    expect(screen.getByRole('region', { name: /Bugünün planlı seansı/ })).toBeInTheDocument()
  })

  it('renders rest-day card when today is a rest day', () => {
    persistProgram(RUN_INPUT)
    renderCard()
    expect(screen.getByText('REST')).toBeInTheDocument()
    expect(screen.getByText(/Today: Rest day/)).toBeInTheDocument()
  })

  it('rest-day card shows phase + week label', () => {
    persistProgram(RUN_INPUT)
    renderCard()
    // Mon 2026-05-04 = week 1 of program (Base phase if available)
    expect(screen.getByText(/week 1\/\d+/)).toBeInTheDocument()
  })

  it('renders training-day card with duration big number', () => {
    persistProgram(RUN_INPUT)
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z')) // Tue → easy run 45 min
    renderCard()
    // Big duration label
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText(/MIN/)).toBeInTheDocument()
  })

  it('shows intent badge color-coded for easy day', () => {
    persistProgram(RUN_INPUT)
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    renderCard()
    const badge = screen.getByTestId('intent-badge')
    expect(badge).toHaveTextContent('EASY')
    // Green-ish background applied via inline style
    expect(badge.style.background).toMatch(/#28a745|rgb\(40, 167, 69\)/i)
  })

  it('renders pace target prominently when present', () => {
    persistProgram(RUN_INPUT)
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    renderCard()
    expect(screen.getByText(/PACE:/)).toBeInTheDocument()
    expect(screen.getByText(/\/km/)).toBeInTheDocument()
  })

  it('renders zone bar (img with aria-label)', () => {
    persistProgram(RUN_INPUT)
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    renderCard()
    expect(screen.getByRole('img', { name: /zone distribution/i })).toBeInTheDocument()
  })

  it('renders week-N/Total label on training day', () => {
    persistProgram(RUN_INPUT)
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    renderCard()
    expect(screen.getByText(/week 1\/\d+/)).toBeInTheDocument()
  })

  it('renders bilingual notes when training day', () => {
    persistProgram(RUN_INPUT)
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    renderCard('en')
    // Notes line is bilingual: "Base phase easy run · Base fazı kolay koşu"
    expect(screen.getByText(/Base phase easy run/i)).toBeInTheDocument()
    expect(screen.getByText(/Base fazı kolay koşu/i)).toBeInTheDocument()
  })

  it('shows before-program-start notice when today < programStart', () => {
    persistProgram({ ...RUN_INPUT, options: { today: '2026-05-04' } })
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z')) // before
    renderCard()
    expect(screen.getByText(/Program has not started yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Program henüz başlamadı/)).toBeInTheDocument()
  })

  it('shows after-program-end notice when today is past final week', () => {
    persistProgram(RUN_INPUT)
    vi.setSystemTime(new Date('2027-01-01T12:00:00Z'))
    renderCard()
    expect(screen.getByText(/Program window has ended/i)).toBeInTheDocument()
    expect(screen.getByText(/Program süresi sona erdi/)).toBeInTheDocument()
  })

  // ── v8.93.0 race-result autopsy after-window branch ──────────────────────
  describe('after-window autopsy', () => {
    function renderCardWithLog(log, lang = 'en') {
      const value = { t: k => k, lang, setLang: () => {} }
      return render(
        <LangCtx.Provider value={value}>
          <TodayProgrammedSessionCard log={log} />
        </LangCtx.Provider>
      )
    }

    const RACE_LOG_ENTRY = {
      date: '2026-09-04',
      type: 'Race Run',
      sport: 'run',
      distanceM: 10000,
      timeSec: 2700,  // exactly target → on-target
    }

    it('renders verdict pill + actual time when log has matching entry', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([RACE_LOG_ENTRY])
      expect(screen.getByTestId('autopsy-verdict-pill')).toBeInTheDocument()
      expect(screen.getByText('45:00')).toBeInTheDocument()
    })

    it('renders ON TARGET label for matched target', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([RACE_LOG_ENTRY])
      expect(screen.getByTestId('autopsy-verdict-pill')).toHaveTextContent('ON TARGET')
    })

    it('renders BEAT TARGET when athlete beat the target', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([{ ...RACE_LOG_ENTRY, timeSec: 2565 }])  // 5% faster
      expect(screen.getByTestId('autopsy-verdict-pill')).toHaveTextContent('BEAT TARGET')
    })

    it('verdict pill is color-coded by verdict', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([{ ...RACE_LOG_ENTRY, timeSec: 2565 }])  // beat-target
      const pill = screen.getByTestId('autopsy-verdict-pill')
      expect(pill.style.background).toMatch(/#28a745|rgb\(40, 167, 69\)/i)
    })

    it('verdict pill has aria-label for accessibility', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([RACE_LOG_ENTRY])
      const pill = screen.getByTestId('autopsy-verdict-pill')
      expect(pill).toHaveAttribute('aria-label')
    })

    it('renders bilingual recommendation (EN + TR)', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([RACE_LOG_ENTRY])
      expect(screen.getByText(/Build on a successful block/i)).toBeInTheDocument()
      expect(screen.getByText(/Başarılı bloğun üzerine/)).toBeInTheDocument()
    })

    it('renders log-it nudge when no matching log entry exists', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([])  // no race entry
      expect(screen.getByTestId('log-it-nudge')).toBeInTheDocument()
      expect(screen.getByText(/Program window has ended/i)).toBeInTheDocument()
    })

    it('GENERATE NEXT CYCLE button writes form payload to localStorage', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([RACE_LOG_ENTRY])
      const btn = screen.getByTestId('next-cycle-btn')
      btn.click()
      const stored = JSON.parse(localStorage.getItem(PROGRAM_KEY))
      expect(stored.input).toBeNull()
      expect(stored.form).toBeTruthy()
      expect(stored.form.sport).toBe('run')
      expect(stored.form.currentDist).toBe(10000)
      expect(stored.form.targetDist).toBe(10000)
      expect(stored.form.targetTime).toMatch(/^\d+:\d{2}$/)
      expect(stored.form.raceDate).toBe('')
    })

    it('GENERATE NEXT CYCLE clears the program-start anchor', () => {
      persistProgram(RUN_INPUT)
      localStorage.setItem('sporeus-eliteProgramStart', JSON.stringify('2026-05-04'))
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([RACE_LOG_ENTRY])
      screen.getByTestId('next-cycle-btn').click()
      expect(localStorage.getItem('sporeus-eliteProgramStart')).toBe('null')
    })

    it('Turkish locale shows TR verdict label', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([RACE_LOG_ENTRY], 'tr')
      expect(screen.getByTestId('autopsy-verdict-pill')).toHaveTextContent('HEDEFE TUTTU')
    })

    it('renders citation for autopsy', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([RACE_LOG_ENTRY])
      expect(screen.getByText(/Daniels 2014 VDOT/)).toBeInTheDocument()
    })

    it('shows VDOT level achieved for run sport', () => {
      persistProgram(RUN_INPUT)
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      renderCardWithLog([RACE_LOG_ENTRY])
      expect(screen.getByText(/VDOT \d/)).toBeInTheDocument()
    })
  })

  it('Turkish render of training day uses TR labels', () => {
    persistProgram(RUN_INPUT)
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    renderCard('tr')
    expect(screen.getByTestId('intent-badge')).toHaveTextContent('KOLAY')
    expect(screen.getByText(/DK/)).toBeInTheDocument()
  })

  it('renders citation footer', () => {
    persistProgram(RUN_INPUT)
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    renderCard()
    expect(screen.getByText(/Daniels 2014/)).toBeInTheDocument()
  })

  it('renders correctly for bike sport', () => {
    persistProgram(BIKE_INPUT)
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z')) // Tue endurance ride
    renderCard()
    expect(screen.getByRole('region')).toBeInTheDocument()
    expect(screen.getByText(/MIN/)).toBeInTheDocument()
  })
})
