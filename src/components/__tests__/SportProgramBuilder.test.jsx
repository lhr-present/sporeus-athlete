// @vitest-environment jsdom
// ─── SportProgramBuilder.test.jsx — i18n smoke tests ─────────────────────────
// Verifies that all key UI strings render from LABELS (not hardcoded English)
// and that TR translations display correctly when lang='tr'.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'
import SportProgramBuilder from '../SportProgramBuilder.jsx'

// DataContext mock — empty log/profile is fine for render-only checks
vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({
    log: [], setLog: vi.fn(),
    recovery: [], setRecovery: vi.fn(),
    injuries: [], setInjuries: vi.fn(),
    testResults: [], setTestResults: vi.fn(),
    raceResults: [], setRaceResults: vi.fn(),
    profile: {}, setProfile: vi.fn(),
  }),
}))

function renderWithLang(lang = 'en') {
  const labels = LABELS[lang] ?? LABELS.en
  const t = key => labels[key] ?? key
  return render(
    <LangCtx.Provider value={{ t, lang, setLang: vi.fn() }}>
      <SportProgramBuilder />
    </LangCtx.Provider>
  )
}

describe('SportProgramBuilder — i18n', () => {
  describe('EN labels render correctly', () => {
    beforeEach(() => renderWithLang('en'))

    it('renders title from LABELS', () => {
      expect(screen.getByText(LABELS.en.spb_title)).toBeInTheDocument()
    })

    it('renders subtitle from LABELS', () => {
      expect(screen.getByText(LABELS.en.spb_sub)).toBeInTheDocument()
    })

    it('renders step 1 title from LABELS', () => {
      expect(screen.getByText(LABELS.en.spb_step1Title)).toBeInTheDocument()
    })

    it('renders SELECT SPORT from LABELS', () => {
      expect(screen.getByText(LABELS.en.spb_selectSport)).toBeInTheDocument()
    })

    it('renders PRIMARY GOAL from LABELS', () => {
      expect(screen.getByText(LABELS.en.spb_primaryGoal)).toBeInTheDocument()
    })

    it('renders sport labels from LABELS (not hardcoded)', () => {
      expect(screen.getByText(new RegExp(LABELS.en.spb_sport_rowing))).toBeInTheDocument()
      expect(screen.getByText(new RegExp(LABELS.en.spb_sport_running))).toBeInTheDocument()
    })

    it('renders goal labels from LABELS (not hardcoded)', () => {
      expect(screen.getByText(LABELS.en.spb_goal_base)).toBeInTheDocument()
      expect(screen.getByText(LABELS.en.spb_goal_race)).toBeInTheDocument()
    })

    it('renders NEXT button from LABELS', () => {
      expect(screen.getByText(LABELS.en.spb_btnNext)).toBeInTheDocument()
    })

    it('renders RACE DATE label from LABELS', () => {
      expect(screen.getByText(LABELS.en.spb_raceDate)).toBeInTheDocument()
    })
  })

  describe('TR labels render correctly', () => {
    beforeEach(() => renderWithLang('tr'))

    it('renders TR title', () => {
      expect(screen.getByText(LABELS.tr.spb_title)).toBeInTheDocument()
    })

    it('renders TR step 1 title', () => {
      expect(screen.getByText(LABELS.tr.spb_step1Title)).toBeInTheDocument()
    })

    it('renders TR sport labels', () => {
      expect(screen.getByText(new RegExp(LABELS.tr.spb_sport_rowing))).toBeInTheDocument()
      expect(screen.getByText(new RegExp(LABELS.tr.spb_sport_running))).toBeInTheDocument()
    })

    it('renders TR goal labels', () => {
      expect(screen.getByText(LABELS.tr.spb_goal_base)).toBeInTheDocument()
    })

    it('renders TR NEXT button', () => {
      expect(screen.getByText(LABELS.tr.spb_btnNext)).toBeInTheDocument()
    })

    it('no hardcoded EN strings visible in TR mode', () => {
      // Title must be TR, not EN
      expect(screen.queryByText(LABELS.en.spb_title)).not.toBeInTheDocument()
      // Step title must be TR
      expect(screen.queryByText(LABELS.en.spb_step1Title)).not.toBeInTheDocument()
      // NEXT button must be TR
      expect(screen.queryByText(LABELS.en.spb_btnNext)).not.toBeInTheDocument()
    })
  })

  describe('LABELS completeness', () => {
    const SPB_KEYS = [
      'spb_title', 'spb_sub', 'spb_step1Title', 'spb_selectSport', 'spb_primaryGoal',
      'spb_raceDate', 'spb_daysToRace', 'spb_preFilledProfile',
      'spb_step2Title', 'spb_fromTestLog', 'spb_fromLog', 'spb_fromTrainingData', 'spb_fromLastWeeks',
      'spb_step3Title', 'spb_planDuration', 'spb_currentTSSLabel', 'spb_peakTSSLabel',
      'spb_currentCTL', 'spb_currentATL', 'spb_sessionsPerWeek', 'spb_recoveryAuto',
      'spb_step4Title', 'spb_monteCarloSub', 'spb_simulating', 'spb_runOptimizer',
      'spb_btnNext', 'spb_btnBack', 'spb_generatePlan',
      'spb_step5Title', 'spb_daysToRaceLabel', 'spb_planScore', 'spb_avgScore',
      'spb_peakForm', 'spb_peakTSBLabel', 'spb_scoreDistTitle', 'spb_weeklyPlanTitle',
      'spb_exportCSV', 'spb_saved', 'spb_saveToLog', 'spb_adaptPlan', 'spb_resetPlan',
      'spb_colWk', 'spb_colPlanned', 'spb_colActual', 'spb_colVariance',
      'spb_colSessions', 'spb_colDetail', 'spb_consecutiveWeeks',
      'spb_fitnessTrace', 'spb_ctlLegend', 'spb_atlLegend', 'spb_peakFormLegend',
      'spb_comparePlans', 'spb_simulateMissed', 'spb_missedSelectWeek',
      'spb_missWeekBtn', 'spb_missedImpact', 'spb_peakFormShifts', 'spb_daysLater', 'spb_daysEarlier',
      'spb_buildNewPlan', 'spb_modalPrint', 'spb_modalSessions', 'spb_modalTrace', 'spb_modalDay',
      'spb_sport_rowing', 'spb_sport_running', 'spb_sport_cycling', 'spb_sport_swimming', 'spb_sport_triathlon',
      'spb_goal_base', 'spb_goal_race', 'spb_goal_peak', 'spb_goal_maintain',
    ]

    it('all SPB keys present in EN LABELS', () => {
      for (const key of SPB_KEYS) {
        expect(LABELS.en[key], `missing EN key: ${key}`).toBeDefined()
      }
    })

    it('all SPB keys present in TR LABELS', () => {
      for (const key of SPB_KEYS) {
        expect(LABELS.tr[key], `missing TR key: ${key}`).toBeDefined()
      }
    })

    it('TR labels differ from EN for UI-visible strings', () => {
      const checkDifferent = keys => {
        for (const k of keys) {
          expect(LABELS.tr[k], `TR label for ${k} must differ from EN`).not.toBe(LABELS.en[k])
        }
      }
      checkDifferent([
        'spb_title', 'spb_step1Title', 'spb_selectSport', 'spb_primaryGoal',
        'spb_btnNext', 'spb_btnBack', 'spb_step2Title', 'spb_step3Title',
        'spb_sport_rowing', 'spb_goal_base',
      ])
    })
  })
})
