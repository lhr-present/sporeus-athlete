// ─── testUtils.jsx — shared render helpers for component smoke tests ──────────
import { render } from '@testing-library/react'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

// Minimal t() that falls back to the real EN labels
const t = key => LABELS.en?.[key] ?? key
export const langCtxValue = { t, lang: 'en', setLang: () => {} }

// Default mock for useData() — import and use in vi.mock() calls in test files
export const mockDataValue = {
  log: [], setLog: vi.fn(),
  recovery: [], setRecovery: vi.fn(),
  injuries: [], setInjuries: vi.fn(),
  testResults: [], setTestResults: vi.fn(),
  raceResults: [], setRaceResults: vi.fn(),
  profile: {}, setProfile: vi.fn(),
}

// Wrapper that provides LangCtx only (use when component doesn't need DataContext)
export function renderWithLang(ui, options = {}) {
  function Wrapper({ children }) {
    return <LangCtx.Provider value={langCtxValue}>{children}</LangCtx.Provider>
  }
  return render(ui, { wrapper: Wrapper, ...options })
}

// Full wrapper — use when component needs both LangCtx and DataContext
// (DataContext itself must be mocked via vi.mock before calling this)
export const renderWithProviders = renderWithLang
