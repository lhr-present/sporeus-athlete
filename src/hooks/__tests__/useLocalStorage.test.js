// @vitest-environment jsdom
// ─── useLocalStorage.test.js — read/write + cross-tab `storage` sync ───────────
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from '../useLocalStorage.js'

vi.mock('../../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))

// Helper: dispatch a real StorageEvent the way another tab would.
function fireStorage({ key, newValue, storageArea = localStorage }) {
  const e = new Event('storage')
  Object.assign(e, { key, newValue, storageArea })
  act(() => { window.dispatchEvent(e) })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useLocalStorage — basic r/w', () => {
  it('returns the default when key is empty', () => {
    const { result } = renderHook(() => useLocalStorage('sporeus-x', { a: 1 }))
    expect(result.current[0]).toEqual({ a: 1 })
  })

  it('hydrates from existing localStorage value', () => {
    localStorage.setItem('sporeus-x', JSON.stringify([1, 2, 3]))
    const { result } = renderHook(() => useLocalStorage('sporeus-x', []))
    expect(result.current[0]).toEqual([1, 2, 3])
  })

  it('set() writes state and localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('sporeus-x', []))
    act(() => { result.current[1]([9]) })
    expect(result.current[0]).toEqual([9])
    expect(JSON.parse(localStorage.getItem('sporeus-x'))).toEqual([9])
  })
})

describe('useLocalStorage — cross-tab storage sync', () => {
  it('adopts a value written by another tab', () => {
    const { result } = renderHook(() => useLocalStorage('sporeus-log', []))
    fireStorage({ key: 'sporeus-log', newValue: JSON.stringify([{ id: 'a' }]) })
    expect(result.current[0]).toEqual([{ id: 'a' }])
  })

  it('ignores events for a different key', () => {
    const { result } = renderHook(() => useLocalStorage('sporeus-log', ['mine']))
    fireStorage({ key: 'sporeus-other', newValue: JSON.stringify(['theirs']) })
    expect(result.current[0]).toEqual(['mine'])
  })

  it('ignores events from a different storageArea (sessionStorage)', () => {
    const { result } = renderHook(() => useLocalStorage('sporeus-log', ['mine']))
    fireStorage({ key: 'sporeus-log', newValue: JSON.stringify(['theirs']), storageArea: sessionStorage })
    expect(result.current[0]).toEqual(['mine'])
  })

  it('ignores a key removal (newValue == null)', () => {
    const { result } = renderHook(() => useLocalStorage('sporeus-log', ['mine']))
    fireStorage({ key: 'sporeus-log', newValue: null })
    expect(result.current[0]).toEqual(['mine'])
  })

  it('ignores malformed JSON without throwing or clobbering state', () => {
    const { result } = renderHook(() => useLocalStorage('sporeus-log', ['mine']))
    fireStorage({ key: 'sporeus-log', newValue: '{not valid json' })
    expect(result.current[0]).toEqual(['mine'])
  })

  it('removes the listener on unmount (no late update)', () => {
    const { result, unmount } = renderHook(() => useLocalStorage('sporeus-log', ['mine']))
    unmount()
    fireStorage({ key: 'sporeus-log', newValue: JSON.stringify(['theirs']) })
    // result.current is frozen at last render — value never adopted post-unmount
    expect(result.current[0]).toEqual(['mine'])
  })
})
