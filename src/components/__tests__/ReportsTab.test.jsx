// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('../../lib/supabase.js', () => ({
  supabase: {},
  isSupabaseReady: vi.fn(() => true),
}))

const mockListReports    = vi.fn()
const mockGenerateReport = vi.fn()
const mockGetSignedUrl   = vi.fn()
const mockDeleteReport   = vi.fn()

vi.mock('../../lib/reports.js', () => ({
  listReports:    (...a) => mockListReports(...a),
  generateReport: (...a) => mockGenerateReport(...a),
  getSignedUrl:   (...a) => mockGetSignedUrl(...a),
  deleteReport:   (...a) => mockDeleteReport(...a),
}))

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
    mockListReports.mockResolvedValue(existingReports)
    mockGenerateReport.mockResolvedValue({
      signedUrl: 'https://example.supabase.co/reports/signed/new.pdf',
      reportId: 'rep-new',
      storagePath: 'uid123/weekly/2026-04-21.pdf',
      expiresAt: '2099-05-21T10:00:00Z',
    })
    mockGetSignedUrl.mockResolvedValue('https://example.supabase.co/reports/signed/rep1.pdf')
    mockDeleteReport.mockResolvedValue(undefined)
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
    await waitFor(() => expect(mockListReports).toHaveBeenCalledWith('uid123', null, 30))
    // History date row appears (only in the history section, not the generate section)
    expect(await screen.findByText('2026-04-14')).toBeInTheDocument()
    // Multiple instances of "Weekly Training Report" expected (generate card + history row)
    const matches = screen.getAllByText(/Weekly Training Report/i)
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('shows "No reports" message when history is empty', async () => {
    mockListReports.mockResolvedValueOnce([])
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
    // listReports called again to refresh
    expect(mockListReports).toHaveBeenCalledTimes(2)
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

  it('triggers download via anchor element click', async () => {
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)

    await waitFor(() => screen.getAllByTitle(/Download/i))
    const downloadBtn = screen.getAllByTitle(/Download/i)[0]
    fireEvent.click(downloadBtn)

    await waitFor(() => expect(mockGetSignedUrl).toHaveBeenCalledWith('uid123/weekly/2026-04-14.pdf', 3600))
  })

  it('deletes a report after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)

    await waitFor(() => screen.getAllByTitle(/Delete/i))
    const deleteBtn = screen.getAllByTitle(/Delete/i)[0]
    fireEvent.click(deleteBtn)

    await waitFor(() => expect(mockDeleteReport).toHaveBeenCalledWith('rep1', 'uid123/weekly/2026-04-14.pdf'))
    // Row removed from list
    expect(screen.queryByText('2026-04-14')).not.toBeInTheDocument()
  })

  it('does not delete when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    renderWithLang(<ReportsTab authUser={mockAuthUser} authProfile={mockAuthProfile} lang="en" />)

    await waitFor(() => screen.getAllByTitle(/Delete/i))
    const deleteBtn = screen.getAllByTitle(/Delete/i)[0]
    fireEvent.click(deleteBtn)

    await waitFor(() => expect(mockDeleteReport).not.toHaveBeenCalled())
  })
})
