// @vitest-environment jsdom
// ─── focusTrap.test.js — Unit tests for src/lib/a11y/focusTrap.js ───────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { trapFocus, releaseFocus } from '../../a11y/focusTrap.js'

/**
 * Build a modal-like container with N buttons and append it to document.body.
 * @param {number} count
 * @returns {{ container: HTMLElement, buttons: HTMLButtonElement[] }}
 */
function buildModal(count = 3) {
  const container = document.createElement('div')
  container.setAttribute('role', 'dialog')
  const buttons = []
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button')
    b.textContent = `btn${i}`
    b.id = `btn${i}`
    container.appendChild(b)
    buttons.push(b)
  }
  document.body.appendChild(container)
  return { container, buttons }
}

/**
 * Dispatch a KeyboardEvent on document with the given key/shift modifier.
 * Mirrors the way browsers fire keydown when focus is on an inner element.
 * @param {string} key
 * @param {boolean} [shiftKey=false]
 */
function fireKey(key, shiftKey = false) {
  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  })
  document.dispatchEvent(event)
  return event
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('focusTrap.trapFocus', () => {
  it('returns a release function', () => {
    const { container } = buildModal()
    const release = trapFocus(container)
    expect(typeof release).toBe('function')
    release()
  })

  it('focuses the first focusable element on activation', () => {
    const { container, buttons } = buildModal(3)
    const release = trapFocus(container)
    expect(document.activeElement).toBe(buttons[0])
    release()
  })

  it('focuses the explicit initialFocus element when provided', () => {
    const { container, buttons } = buildModal(3)
    const release = trapFocus(container, { initialFocus: buttons[2] })
    expect(document.activeElement).toBe(buttons[2])
    release()
  })

  it('Tab from last focusable wraps to first', () => {
    const { container, buttons } = buildModal(3)
    const release = trapFocus(container)
    buttons[2].focus()
    expect(document.activeElement).toBe(buttons[2])
    const e = fireKey('Tab', false)
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons[0])
    release()
  })

  it('Shift+Tab from first wraps to last', () => {
    const { container, buttons } = buildModal(3)
    const release = trapFocus(container)
    buttons[0].focus()
    const e = fireKey('Tab', true)
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons[2])
    release()
  })

  it('Escape calls onEscape callback', () => {
    const { container } = buildModal(2)
    const onEscape = vi.fn()
    const release = trapFocus(container, { onEscape })
    fireKey('Escape')
    expect(onEscape).toHaveBeenCalledTimes(1)
    release()
  })

  it('Escape with no onEscape provided does not crash', () => {
    const { container } = buildModal(2)
    const release = trapFocus(container)
    expect(() => fireKey('Escape')).not.toThrow()
    release()
  })

  it('release() restores focus to the previously-focused element', () => {
    const previous = document.createElement('button')
    previous.id = 'opener'
    document.body.appendChild(previous)
    previous.focus()
    expect(document.activeElement).toBe(previous)

    const { container } = buildModal(2)
    const release = trapFocus(container)
    expect(document.activeElement).not.toBe(previous)
    release()
    expect(document.activeElement).toBe(previous)
  })

  it('container with no focusable elements: graceful no-op (Tab is prevented)', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const release = trapFocus(container)
    // No throw on activation, no focus change.
    const e = fireKey('Tab')
    expect(e.defaultPrevented).toBe(true)
    release()
  })

  it('Tab outside the container is pulled back inside', () => {
    const outside = document.createElement('button')
    outside.id = 'outside'
    document.body.appendChild(outside)
    const { container, buttons } = buildModal(3)
    const release = trapFocus(container)
    // Simulate focus escaping (e.g. browser extension grabbed focus).
    outside.focus()
    expect(document.activeElement).toBe(outside)
    const e = fireKey('Tab', false)
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons[0])
    release()
  })

  it('multiple traps: most-recently-activated trap wins (last release first)', () => {
    const a = buildModal(2)
    a.container.id = 'modalA'
    const release1 = trapFocus(a.container)
    expect(document.activeElement).toBe(a.buttons[0])

    const b = buildModal(2)
    b.container.id = 'modalB'
    const release2 = trapFocus(b.container)
    expect(document.activeElement).toBe(b.buttons[0])

    // Tab cycles within the most-recent (B) trap.
    b.buttons[1].focus()
    fireKey('Tab', false)
    expect(document.activeElement).toBe(b.buttons[0])

    release2()
    release1()
  })

  it('disabled focusable children are skipped', () => {
    const container = document.createElement('div')
    const b1 = document.createElement('button')
    b1.id = 'b1'
    const b2 = document.createElement('button')
    b2.id = 'b2'
    b2.disabled = true
    const b3 = document.createElement('button')
    b3.id = 'b3'
    container.append(b1, b2, b3)
    document.body.appendChild(container)

    const release = trapFocus(container)
    expect(document.activeElement).toBe(b1)
    b3.focus()
    fireKey('Tab', false)
    expect(document.activeElement).toBe(b1)
    release()
  })

  it('release() is idempotent', () => {
    const { container } = buildModal(2)
    const release = trapFocus(container)
    expect(() => {
      release()
      release()
      release()
    }).not.toThrow()
  })

  it('releaseFocus(release) invokes the release function', () => {
    const previous = document.createElement('button')
    document.body.appendChild(previous)
    previous.focus()
    const { container } = buildModal(2)
    const release = trapFocus(container)
    expect(document.activeElement).not.toBe(previous)
    releaseFocus(release)
    expect(document.activeElement).toBe(previous)
    // Tolerant of bad input.
    expect(() => releaseFocus(undefined)).not.toThrow()
  })
})
