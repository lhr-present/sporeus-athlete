import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shouldShowUpsell, markUpsellShown, getUpsellMessage } from './upsell.js'

const store = {}
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v },
    removeItem: (k) => { delete store[k] },
  })
})

describe('shouldShowUpsell', () => {
  it('returns true when no key is stored', () => {
    expect(shouldShowUpsell('ai_insights')).toBe(true)
  })

  it('returns false when today\'s date is already stored', () => {
    const today = new Date().toISOString().slice(0, 10)
    store['sporeus-upsell-shown-ai_insights'] = today
    expect(shouldShowUpsell('ai_insights')).toBe(false)
  })
})

describe('markUpsellShown', () => {
  it('returns false from shouldShowUpsell after markUpsellShown is called', () => {
    expect(shouldShowUpsell('squad_dashboard')).toBe(true)
    markUpsellShown('squad_dashboard')
    expect(shouldShowUpsell('squad_dashboard')).toBe(false)
  })
})

describe('getUpsellMessage', () => {
  it('returns coach plan for ai_insights', () => {
    const msg = getUpsellMessage('ai_insights', 'en')
    expect(msg.plan).toBe('coach')
    expect(typeof msg.title).toBe('string')
    expect(typeof msg.description).toBe('string')
  })

  it('returns club plan for unlimited_athletes', () => {
    const msg = getUpsellMessage('unlimited_athletes', 'en')
    expect(msg.plan).toBe('club')
  })
})
