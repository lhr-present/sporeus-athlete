// @vitest-environment jsdom
// ─── CoachInbox.test.jsx — athlete read-only coach inbox (v9.382) ─────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'

const mockGetMessages  = vi.fn()
const mockMarkReadMany = vi.fn(() => Promise.resolve({ data: null, error: null }))
const mockMarkReadById = vi.fn(() => Promise.resolve({}))
const mockSubscribe    = vi.fn(() => ({ unsubscribe: vi.fn() }))
const mockGetMyCoach   = vi.fn()
const mockDecrypt      = vi.fn((body) => Promise.resolve(`plain:${body}`))

vi.mock('../../lib/supabase.js', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 'ath-1' } } }) } },
}))
vi.mock('../../lib/db/messages.js', () => ({
  getMessages:         (...a) => mockGetMessages(...a),
  markReadMany:        (...a) => mockMarkReadMany(...a),
  markReadById:        (...a) => mockMarkReadById(...a),
  subscribeToMessages: (...a) => mockSubscribe(...a),
}))
vi.mock('../../lib/crypto.js', () => ({ decryptMessage: (...a) => mockDecrypt(...a) }))
vi.mock('../../lib/inviteUtils.js', () => ({ getMyCoach: (...a) => mockGetMyCoach(...a) }))

import CoachInbox from '../profile/CoachInbox.jsx'

function renderInbox(lang = 'en') {
  return render(
    <LangCtx.Provider value={{ t: k => k, lang, setLang: () => {} }}>
      <CoachInbox />
    </LangCtx.Provider>,
  )
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => cleanup())

describe('CoachInbox', () => {
  it('decrypts + renders coach messages, marks unread read, opens a live subscription', async () => {
    mockGetMyCoach.mockResolvedValue('coach-1')
    mockGetMessages.mockResolvedValue({
      data: [
        { id: 'm1', sender_role: 'coach', body: 'enc1', sent_at: '2026-06-01T10:00:00Z', read_at: null },
        { id: 'm2', sender_role: 'coach', body: 'enc2', sent_at: '2026-06-02T10:00:00Z', read_at: '2026-06-02T11:00:00Z' },
      ],
      error: null,
    })

    renderInbox()

    await waitFor(() => expect(screen.getByText('plain:enc1')).toBeInTheDocument())
    expect(screen.getByText('plain:enc2')).toBeInTheDocument()
    // decryption keyed on the coach_id (must match the coach UI's key)
    expect(mockDecrypt).toHaveBeenCalledWith('enc1', 'coach-1')
    // only the unread coach message (m1) is marked read
    expect(mockMarkReadMany).toHaveBeenCalledWith(['m1'])
    // live subscription for the coach↔athlete pair
    expect(mockSubscribe).toHaveBeenCalledWith('coach-1', 'ath-1', expect.any(Function))
  })

  it('renders nothing (and does not query) when the athlete has no coach', async () => {
    mockGetMyCoach.mockResolvedValue(null)
    const { container } = renderInbox()
    await waitFor(() => expect(mockGetMyCoach).toHaveBeenCalled())
    expect(container.querySelector('.sp-card')).toBeNull()
    expect(mockGetMessages).not.toHaveBeenCalled()
  })

  it('renders nothing when the coach has sent no messages', async () => {
    mockGetMyCoach.mockResolvedValue('coach-1')
    mockGetMessages.mockResolvedValue({ data: [], error: null })
    const { container } = renderInbox()
    await waitFor(() => expect(mockGetMessages).toHaveBeenCalled())
    expect(container.querySelector('.sp-card')).toBeNull()
    expect(mockMarkReadMany).not.toHaveBeenCalled()
  })
})
