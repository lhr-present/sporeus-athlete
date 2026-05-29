// realtimeStatus.test.js — registry behind ConnectionBanner's aggregate
// connection-health display. Module holds global state, so each test
// re-imports fresh via resetModules for isolation.
import { describe, it, expect, beforeEach, vi } from 'vitest'

async function fresh() {
  vi.resetModules()
  return import('./realtimeStatus.js')
}

describe('realtimeStatus', () => {
  beforeEach(() => vi.resetModules())

  it('reportStatus stores a status that getStatuses reflects', async () => {
    const m = await fresh()
    m.reportStatus('squad-feed-c1', 'live')
    expect(m.getStatuses()).toEqual({ 'squad-feed-c1': 'live' })
  })

  it('reportStatus overwrites the prior status for the same channel', async () => {
    const m = await fresh()
    m.reportStatus('ch', 'connecting')
    m.reportStatus('ch', 'live')
    expect(m.getStatuses().ch).toBe('live')
  })

  it('tracks multiple channels independently', async () => {
    const m = await fresh()
    m.reportStatus('a', 'live')
    m.reportStatus('b', 'reconnecting')
    expect(m.getStatuses()).toEqual({ a: 'live', b: 'reconnecting' })
  })

  it('notifies all subscribed listeners with a snapshot on report', async () => {
    const m = await fresh()
    const l1 = vi.fn(); const l2 = vi.fn()
    m.subscribeToStatuses(l1)
    m.subscribeToStatuses(l2)
    m.reportStatus('ch', 'live')
    expect(l1).toHaveBeenCalledWith({ ch: 'live' })
    expect(l2).toHaveBeenCalledWith({ ch: 'live' })
  })

  it('snapshot passed to listeners is a COPY (mutation does not leak into registry)', async () => {
    const m = await fresh()
    let captured
    m.subscribeToStatuses(s => { captured = s })
    m.reportStatus('ch', 'live')
    captured.ch = 'TAMPERED'
    captured.injected = 'x'
    expect(m.getStatuses()).toEqual({ ch: 'live' })
  })

  it('getStatuses returns a copy (mutation does not leak)', async () => {
    const m = await fresh()
    m.reportStatus('ch', 'live')
    const snap = m.getStatuses()
    snap.ch = 'TAMPERED'
    expect(m.getStatuses().ch).toBe('live')
  })

  it('removeStatus deletes the entry and notifies listeners', async () => {
    const m = await fresh()
    const listener = vi.fn()
    m.reportStatus('ch', 'live')
    m.subscribeToStatuses(listener)
    m.removeStatus('ch')
    expect(m.getStatuses()).toEqual({})
    expect(listener).toHaveBeenCalledWith({})
  })

  it('removeStatus on an unknown channel is a no-op that still notifies', async () => {
    const m = await fresh()
    const listener = vi.fn()
    m.subscribeToStatuses(listener)
    m.removeStatus('never-existed')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(m.getStatuses()).toEqual({})
  })

  it('unsubscribe stops further notifications', async () => {
    const m = await fresh()
    const listener = vi.fn()
    const unsub = m.subscribeToStatuses(listener)
    m.reportStatus('ch', 'live')
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
    m.reportStatus('ch', 'reconnecting')
    expect(listener).toHaveBeenCalledTimes(1)  // not called again
  })

  it('unsubscribing one listener leaves others active', async () => {
    const m = await fresh()
    const keep = vi.fn(); const drop = vi.fn()
    m.subscribeToStatuses(keep)
    const unsubDrop = m.subscribeToStatuses(drop)
    unsubDrop()
    m.reportStatus('ch', 'live')
    expect(keep).toHaveBeenCalledTimes(1)
    expect(drop).not.toHaveBeenCalled()
  })

  it('getStatuses is empty before any report', async () => {
    const m = await fresh()
    expect(m.getStatuses()).toEqual({})
  })
})
