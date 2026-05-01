// @vitest-environment jsdom
// ─── announcer.test.js — Unit tests for src/lib/a11y/announcer.js ───────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { announce, init, destroy } from '../../a11y/announcer.js'

const POLITE_ID = 'sporeus-a11y-live-polite'
const ASSERTIVE_ID = 'sporeus-a11y-live-assertive'

/**
 * Yield to the microtask queue so the announcer's queueMicrotask callback
 * fires before assertions run.
 */
const flushMicrotasks = () => Promise.resolve()

beforeEach(() => {
  // Make sure each test starts from a clean slate.
  destroy()
  document.body.innerHTML = ''
})

afterEach(() => {
  destroy()
})

describe('announcer.init / destroy', () => {
  it('init() creates two live regions in document.body', () => {
    init()
    const polite = document.getElementById(POLITE_ID)
    const assertive = document.getElementById(ASSERTIVE_ID)
    expect(polite).toBeTruthy()
    expect(assertive).toBeTruthy()
    expect(polite.parentNode).toBe(document.body)
    expect(assertive.parentNode).toBe(document.body)
  })

  it('destroy() removes the regions', () => {
    init()
    expect(document.getElementById(POLITE_ID)).toBeTruthy()
    destroy()
    expect(document.getElementById(POLITE_ID)).toBeNull()
    expect(document.getElementById(ASSERTIVE_ID)).toBeNull()
  })

  it('multiple init() calls do not create duplicate regions', () => {
    init()
    init()
    init()
    expect(document.querySelectorAll(`#${POLITE_ID}`)).toHaveLength(1)
    expect(document.querySelectorAll(`#${ASSERTIVE_ID}`)).toHaveLength(1)
  })

  it('regions have correct aria-live and aria-atomic attributes', () => {
    init()
    const polite = document.getElementById(POLITE_ID)
    const assertive = document.getElementById(ASSERTIVE_ID)
    expect(polite.getAttribute('aria-live')).toBe('polite')
    expect(polite.getAttribute('aria-atomic')).toBe('true')
    expect(assertive.getAttribute('aria-live')).toBe('assertive')
    expect(assertive.getAttribute('aria-atomic')).toBe('true')
  })

  it('regions are visually hidden via inline style', () => {
    init()
    const polite = document.getElementById(POLITE_ID)
    const style = polite.getAttribute('style') || ''
    expect(style).toMatch(/position:\s*absolute/)
    expect(style).toMatch(/width:\s*1px/)
    expect(style).toMatch(/height:\s*1px/)
    expect(style).toMatch(/overflow:\s*hidden/)
    expect(style).toMatch(/clip:\s*rect\(/)
  })
})

describe('announcer.announce', () => {
  it('announce(msg, "polite") sets textContent of the polite region', async () => {
    init()
    announce('Session saved', 'polite')
    await flushMicrotasks()
    expect(document.getElementById(POLITE_ID).textContent).toBe('Session saved')
    expect(document.getElementById(ASSERTIVE_ID).textContent).toBe('')
  })

  it('announce(msg, "assertive") sets textContent of the assertive region', async () => {
    init()
    announce('Connection lost', 'assertive')
    await flushMicrotasks()
    expect(document.getElementById(ASSERTIVE_ID).textContent).toBe('Connection lost')
    expect(document.getElementById(POLITE_ID).textContent).toBe('')
  })

  it('announce defaults to "polite" when level omitted', async () => {
    init()
    announce('Default level message')
    await flushMicrotasks()
    expect(document.getElementById(POLITE_ID).textContent).toBe('Default level message')
    expect(document.getElementById(ASSERTIVE_ID).textContent).toBe('')
  })

  it('repeat announcements briefly clear textContent before re-applying (toggle technique)', async () => {
    init()
    announce('Same message', 'polite')
    await flushMicrotasks()
    expect(document.getElementById(POLITE_ID).textContent).toBe('Same message')

    // Second call: textContent should be cleared synchronously, then re-applied.
    announce('Same message', 'polite')
    expect(document.getElementById(POLITE_ID).textContent).toBe('')
    await flushMicrotasks()
    expect(document.getElementById(POLITE_ID).textContent).toBe('Same message')
  })

  it('announce before init() lazily auto-initialises (no-op-safe)', async () => {
    expect(document.getElementById(POLITE_ID)).toBeNull()
    expect(() => announce('Lazy init', 'polite')).not.toThrow()
    await flushMicrotasks()
    const polite = document.getElementById(POLITE_ID)
    expect(polite).toBeTruthy()
    expect(polite.textContent).toBe('Lazy init')
  })

  it('ignores empty / non-string messages without throwing', async () => {
    init()
    expect(() => announce('', 'polite')).not.toThrow()
    expect(() => announce(null, 'polite')).not.toThrow()
    expect(() => announce(undefined, 'polite')).not.toThrow()
    expect(() => announce(42, 'polite')).not.toThrow()
    await flushMicrotasks()
    expect(document.getElementById(POLITE_ID).textContent).toBe('')
  })

  it('different levels write to their own region independently', async () => {
    init()
    announce('Polite message', 'polite')
    announce('Assertive message', 'assertive')
    await flushMicrotasks()
    expect(document.getElementById(POLITE_ID).textContent).toBe('Polite message')
    expect(document.getElementById(ASSERTIVE_ID).textContent).toBe('Assertive message')
  })
})
