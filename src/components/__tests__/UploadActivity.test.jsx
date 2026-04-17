// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Hoist mocks so vi.mock factories can reference them ───────────────────────

const mocks = vi.hoisted(() => ({
  upload:     vi.fn(),
  insert:     vi.fn(),
  invoke:     vi.fn(),
  channel:    vi.fn(),
  subscribe:  vi.fn(),
  removeCh:   vi.fn(),
  profileSel: vi.fn(),
  canUpload:  vi.fn(() => true),
}))

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: vi.fn(() => true),
  supabase: {
    storage: { from: () => ({ upload: mocks.upload }) },
    from: (table) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: mocks.profileSel }) }) }
      }
      return { insert: () => ({ select: () => ({ maybeSingle: mocks.insert }) }) }
    },
    functions: { invoke: mocks.invoke },
    channel:   (name) => {
      const ch = { on: vi.fn().mockReturnThis(), subscribe: mocks.subscribe.mockReturnThis() }
      mocks.channel(name)
      return ch
    },
    removeChannel: mocks.removeCh,
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('../../lib/subscription.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    getTierSync:      vi.fn(() => 'coach'),
    canUploadFile:    mocks.canUpload,
    getUpgradePrompt: real.getUpgradePrompt,
    FREE_UPLOAD_LIMIT: 5,
  }
})

import UploadActivity from '../UploadActivity.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BYTES = 26_214_400
const authUser  = { id: 'user-abc' }

function makeFile(name = 'workout.fit', sizeBytes = 1024 * 100) {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type: 'application/octet-stream' })
  return new File([blob], name, { type: 'application/octet-stream' })
}

function setupHappyPath() {
  mocks.profileSel.mockResolvedValue({ data: { subscription_tier: 'coach', file_upload_count_month: 0 }, error: null })
  mocks.canUpload.mockReturnValue(true)
  mocks.upload.mockResolvedValue({ data: { path: 'user-abc/ts-workout.fit' }, error: null })
  mocks.insert.mockResolvedValue({ data: { id: 'job-1' }, error: null })
  mocks.invoke.mockResolvedValue({ data: { ok: true, logEntryId: 'log-1' }, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.canUpload.mockReturnValue(true)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UploadActivity', () => {
  it('renders dropzone and header', () => {
    mocks.profileSel.mockResolvedValue({ data: { subscription_tier: 'coach', file_upload_count_month: 0 }, error: null })
    renderWithLang(<UploadActivity authUser={authUser} onSuccess={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('↑ UPLOAD ACTIVITY')).toBeInTheDocument()
    expect(screen.getByText(/drop .fit or .gpx file/i)).toBeInTheDocument()
  })

  it('calls onClose when × button is clicked', () => {
    mocks.profileSel.mockResolvedValue({ data: null, error: null })
    const onClose = vi.fn()
    renderWithLang(<UploadActivity authUser={authUser} onSuccess={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close upload panel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows upgrade prompt when free-tier limit exceeded', async () => {
    mocks.canUpload.mockReturnValue(false)
    mocks.profileSel.mockResolvedValue({
      data: { subscription_tier: 'free', file_upload_count_month: 5 }, error: null,
    })
    renderWithLang(<UploadActivity authUser={authUser} onSuccess={vi.fn()} />)
    await waitFor(() => expect(screen.getByText(/upload limit reached/i)).toBeInTheDocument())
    expect(screen.getAllByText(/free plan/i).length).toBeGreaterThan(0)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('happy path: accepted file triggers upload → insert → invoke', async () => {
    setupHappyPath()
    const onSuccess = vi.fn()
    renderWithLang(<UploadActivity authUser={authUser} onSuccess={onSuccess} />)
    const file  = makeFile('activity.fit', 500 * 1024)
    const input = document.querySelector('input[type="file"]')
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    fireEvent.change(input)
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce())
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledOnce())
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      'parse-activity',
      expect.objectContaining({ body: expect.objectContaining({ jobId: 'job-1', fileType: 'fit' }) }),
    ))
  })

  it('rejects > 25 MB file without calling storage', async () => {
    mocks.profileSel.mockResolvedValue({ data: { subscription_tier: 'coach', file_upload_count_month: 0 }, error: null })
    renderWithLang(<UploadActivity authUser={authUser} onSuccess={vi.fn()} />)
    const bigFile = makeFile('big.fit', MAX_BYTES + 1)
    const input   = document.querySelector('input[type="file"]')
    Object.defineProperty(input, 'files', { configurable: true, value: [bigFile] })
    fireEvent.change(input)
    // Dropzone rejects oversized files before processFile is called
    await waitFor(() => {
      const errEl = screen.queryByText(/too large/i) || screen.queryByText(/25 MB/i)
      expect(errEl).not.toBeNull()
    }, { timeout: 3000 })
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
