// @vitest-environment jsdom
// F5 — DeviceSync remove must surface a delete failure via the syncMsg banner
// rather than silently re-listing (which made the device look removed).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

const mocks = vi.hoisted(() => ({
  getDevices:  vi.fn(),
  addDevice:   vi.fn(),
  removeDevice: vi.fn(),
  triggerSync: vi.fn(),
}))

vi.mock('../../lib/deviceSync.js', () => ({
  getDevices:   mocks.getDevices,
  addDevice:    mocks.addDevice,
  removeDevice: mocks.removeDevice,
  triggerSync:  mocks.triggerSync,
}))

import DeviceSync from '../DeviceSync.jsx'

const DEVICE = { id: 'd-1', label: 'My Garmin', provider: 'garmin', base_url: 'https://ow.x.io', last_sync_at: null }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getDevices.mockResolvedValue({ devices: [DEVICE] })
})

describe('DeviceSync — doRemove (F5)', () => {
  async function openConfirmAndConfirm() {
    renderWithLang(<DeviceSync userId="u-1" />)
    // device list loads
    const removeBtn = await screen.findByText(/^Remove$/i)
    await act(async () => { fireEvent.click(removeBtn) })
    // ConfirmModal confirm button shares the "Remove" label
    const confirmBtns = await screen.findAllByText(/^Remove$/i)
    // last one is inside the modal
    await act(async () => { fireEvent.click(confirmBtns[confirmBtns.length - 1]) })
  }

  it('shows the error banner and does NOT re-list when remove fails', async () => {
    mocks.removeDevice.mockResolvedValue({ error: { message: 'permission denied' } })
    await openConfirmAndConfirm()

    await waitFor(() => {
      expect(screen.getByText(/Couldn't remove device/i)).toBeInTheDocument()
    })
    // getDevices was only called once (initial load) — no silent re-list after failure
    expect(mocks.getDevices).toHaveBeenCalledTimes(1)
  })

  it('re-lists devices (loadDevices) on successful remove', async () => {
    mocks.removeDevice.mockResolvedValue({ error: null })
    await openConfirmAndConfirm()

    await waitFor(() => {
      // initial load + post-success reload
      expect(mocks.getDevices).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText(/Couldn't remove device/i)).not.toBeInTheDocument()
  })
})
