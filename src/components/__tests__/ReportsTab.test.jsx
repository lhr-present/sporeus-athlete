// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Module mocks ──────────────────────────────────────────────────────────────
// vi.mock is hoisted — factories must not reference outer variables.
// We use vi.hoisted() to declare the mocks that need to be shared.

const { mockCreateSignedUrl, mockStorageFrom, _mockSelect, _mockOrder, queryChain, supabaseMock } =
  vi.hoisted(() => {
    const mockCreateSignedUrl = vi.fn()
    const mockStorageFrom     = vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl }))
    const mockSelect          = vi.fn()
    const mockOrder           = vi.fn()

    // Chainable query object — its thenable is overridden per-test
    const queryChain = {
      select: (...a) => { mockSelect(...a); return queryChain },
      order:  (...a) => { mockOrder(...a);  return queryChain },
    }

    const supabaseMock = {
      from: vi.fn(() => queryChain),
      storage: { from: mockStorageFrom },
    }

    return { mockCreateSignedUrl, mockStorageFrom, mockSelect, mockOrder, queryChain, supabaseMock }
  })

vi.mock('../../lib/supabase.js', () => ({
  supabase: supabaseMock,
  isSupabaseReady: vi.fn(() => true),
}))

const mockGenerateReport = vi.fn()
const mockDeleteReport   = vi.fn()

vi.mock('../../lib/reports.js', () => ({
  generateReport: (...a) => mockGenerateReport(...a),
  deleteReport:   (...a) => mockDeleteReport(...a),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryPromise(data, error = null) {
  const resolved = { data, error }
  queryChain.then  = (res, rej) => Promise.resolve(resolved).then(res, rej)
  queryChain.catch = (fn) => Promise.resolve(resolved).catch(fn)
}

const mockAuthUser    = { id: 'uid123', email: 'athlete@test.com' }
const mockAuthProfile = { role: 'athlete', subscription_tier: 'coach' }

const existingReports = [
  {
    id: 'rep1',
    kind: 'weekly',
    storage_path: 'uid123/weekly/2026-04-14.pdf',
    params: {},
    created_at: '2026-04-14T10:00:00Z',
    expires_at: '2099-05-14T10:00:00Z',   // far future — not expired
  },
]

import ReportsTab from '../ReportsTab.jsx'

// ─────────────────────────────────────────────────────────────────────────────

describe('ReportsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore the storage mock after clearAllMocks resets it
    mockStorageFrom.mockImplementation(() => ({ createSignedUrl: mockCreateSignedUrl }))
    makeQueryPromise(existingReports)
    mockGenerateReport.mockResolvedValue({
      signedUrl: 'https://example.supabase.co/reports/signed/new.pdf',
      reportId: 'rep-new',
      storagePath: 'uid123/weekly/2026-04-21.pdf',
      expiresAt: '2099-05-21T10:00:00Z',
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.supabase.co/reports/signed/rep1.pdf' },
      error: null,
    })
    mockDeleteReport.mockResolvedValue(undefined)
    supabaseMock.from.mockImplementation(() => queryChain)
  })

  it('renders the header and generate section', async () => {
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)
    expect(screen.getByText(/PDF REPORTS/i)).toBeInTheDocument()
    expect(screen.getByText(/Weekly Training Report/i)).toBeInTheDocument()
    expect(screen.getByText(/Race Readiness Report/i)).toBeInTheDocument()
    expect(screen.getByText(/Monthly Squad Report/i)).toBeInTheDocument()
  })

  it('shows sign-in prompt when no authUser', () => {
    renderWithLang(<ReportsTab authUser={null} authProfile={null} lang="en" />)
    expect(screen.getByText(/Sign in to access reports/i)).toBeInTheDocument()
  })

  it('loads and shows report history on mount', async () => {
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)
    await waitFor(() => expect(supabaseMock.from).toHaveBeenCalledWith('generated_reports'))
    // History date row appears (only in the history section, not the generate section)
    expect(await screen.findByText('2026-04-14')).toBeInTheDocument()
    // Multiple instances of "Weekly Training Report" expected (generate card + history group header)
    const matches = screen.getAllByText(/Weekly Training Report/i)
    expect(matches).toHaveLength(2)
  })

  it('shows "No reports" message when history is empty', async () => {
    makeQueryPromise([])
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)
    await waitFor(() => expect(screen.getByText(/No reports generated yet/i)).toBeInTheDocument())
  })

  it('generates a report when Generate button clicked', async () => {
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)

    // Find the first Generate button (weekly)
    const generateBtns = await screen.findAllByRole('button', { name: /Generate$/i })
    fireEvent.click(generateBtns[0])

    await waitFor(() => expect(mockGenerateReport).toHaveBeenCalledWith('weekly', expect.any(Object)))
    // After generation, success message shown
    expect(await screen.findByText(/generated/i)).toBeInTheDocument()
    // supabase.from called again to refresh (initial load + after generate)
    expect(supabaseMock.from).toHaveBeenCalledTimes(2)
  })

  it('shows error message when generateReport fails', async () => {
    mockGenerateReport.mockRejectedValueOnce(new Error('Edge function timeout'))
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)

    const generateBtns = await screen.findAllByRole('button', { name: /Generate$/i })
    fireEvent.click(generateBtns[0])

    await waitFor(() => expect(screen.getByText(/Edge function timeout/i)).toBeInTheDocument())
  })

  it('shows monthly_squad as locked for non-coach athlete', () => {
    renderWithLang(<ReportsTab
      authUser={mockAuthUser}
      authProfile={{ role: 'athlete', subscription_tier: 'club' }}
      lang="en"
    />)
    // The Monthly Squad Report button should be locked
    const buttons = screen.getAllByRole('button')
    const squadBtn = buttons.find(b => b.textContent.includes('Locked'))
    expect(squadBtn).toBeTruthy()
    expect(squadBtn).toBeDisabled()
  })

  it('triggers Download PDF via supabase.storage.createSignedUrl and opens new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {})
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)

    await waitFor(() => screen.getAllByTitle(/Download PDF/i))
    const downloadBtn = screen.getAllByTitle(/Download PDF/i)[0]
    fireEvent.click(downloadBtn)

    await waitFor(() => {
      expect(mockStorageFrom).toHaveBeenCalledWith('reports')
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('uid123/weekly/2026-04-14.pdf', 3600)
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.supabase.co/reports/signed/rep1.pdf',
        '_blank',
        'noopener,noreferrer',
      )
    })
    openSpy.mockRestore()
  })

  it('shows inline error when createSignedUrl fails', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'Storage error' } })
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)

    await waitFor(() => screen.getAllByTitle(/Download PDF/i))
    const downloadBtn = screen.getAllByTitle(/Download PDF/i)[0]
    fireEvent.click(downloadBtn)

    await waitFor(() => expect(screen.getByText(/Storage error/i)).toBeInTheDocument())
  })

  it('groups report history rows under kind headers', async () => {
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)
    // Kind group header + generate card both show "Weekly Training Report"
    expect(await screen.findByText('2026-04-14')).toBeInTheDocument()
    const matches = screen.getAllByText(/Weekly Training Report/i)
    expect(matches).toHaveLength(2)
  })

  it('deletes a report after confirmation', async () => {
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)

    await waitFor(() => screen.getAllByTitle(/Delete/i))
    const deleteBtn = screen.getAllByTitle(/Delete/i)[0]
    fireEvent.click(deleteBtn)

    // ConfirmModal should appear
    await waitFor(() => screen.getByRole('dialog'))
    // Click the confirm button inside the modal
    const confirmBtn = screen.getByRole('button', { name: /^Delete$/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => expect(mockDeleteReport).toHaveBeenCalledWith('rep1', 'uid123/weekly/2026-04-14.pdf'))
    // Row removed from list
    expect(screen.queryByText('2026-04-14')).not.toBeInTheDocument()
  })

  it('does not delete when confirmation is cancelled', async () => {
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)

    await waitFor(() => screen.getAllByTitle(/Delete/i))
    const deleteBtn = screen.getAllByTitle(/Delete/i)[0]
    fireEvent.click(deleteBtn)

    // ConfirmModal should appear — cancel it
    await waitFor(() => screen.getByRole('dialog'))
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelBtn)

    await waitFor(() => expect(mockDeleteReport).not.toHaveBeenCalled())
  })
})
