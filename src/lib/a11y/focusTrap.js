// ─── focusTrap.js ────────────────────────────────────────────────────────────
// Reusable focus trap for modal dialogs (WCAG AA — 2.4.3 Focus Order,
// 2.1.2 No Keyboard Trap).
//
// trapFocus(container, opts) attaches keydown handlers that:
//   • cycle Tab / Shift+Tab inside `container`
//   • call `opts.onEscape` on Escape (if provided)
//   • move focus to `opts.initialFocus` (or the first focusable child)
//   • restore focus to the previously-focused element on release
//
// Returns a release function; calling it tears down listeners and restores
// focus. `releaseFocus(release)` is a no-op alias for readability at call sites.
//
// Framework-agnostic. Pure DOM. SSR-safe.
// ────────────────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
  'button',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * True when DOM globals are available (browser / jsdom).
 * @returns {boolean}
 */
function hasDOM() {
  return typeof document !== 'undefined'
}

/**
 * Collect every focusable descendant of `container`, in document order.
 * Disabled buttons and elements with `aria-hidden="true"` are filtered out.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusable(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return []
  const nodes = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
  return nodes.filter((el) => {
    if (el.hasAttribute('disabled')) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    return true
  })
}

/**
 * Activate a focus trap on `container`.
 *
 * @param {HTMLElement} container  Element whose subtree should hold focus.
 * @param {object} [options]
 * @param {HTMLElement} [options.initialFocus]  Element to focus on activation.
 * @param {(e: KeyboardEvent) => void} [options.onEscape]  Escape-key handler.
 * @returns {() => void}  Release function — call to tear down the trap.
 */
export function trapFocus(container, options = {}) {
  if (!hasDOM()) return () => {}
  if (!container) return () => {}

  const { initialFocus, onEscape } = options
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null

  // Initial focus: explicit target → first focusable → container itself.
  const focusables = getFocusable(container)
  const target =
    initialFocus && typeof initialFocus.focus === 'function'
      ? initialFocus
      : focusables[0] || null

  if (target) {
    try {
      target.focus()
    } catch {
      /* Ignore focus failures (e.g. detached node). */
    }
  }

  /**
   * keydown handler — wraps Tab focus inside container and routes Escape.
   * @param {KeyboardEvent} e
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (typeof onEscape === 'function') onEscape(e)
      return
    }
    if (e.key !== 'Tab') return

    const items = getFocusable(container)
    if (items.length === 0) {
      // Nothing focusable inside — block Tab to avoid leaking focus out.
      e.preventDefault()
      return
    }

    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement

    // If focus has escaped the container entirely, pull it back in.
    if (!container.contains(active)) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
      return
    }

    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  document.addEventListener('keydown', handleKeyDown, true)

  let released = false
  return function release() {
    if (released) return
    released = true
    document.removeEventListener('keydown', handleKeyDown, true)
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try {
        previouslyFocused.focus()
      } catch {
        /* Ignore — element may have been removed from the DOM. */
      }
    }
  }
}

/**
 * Convenience alias for clarity at call sites:
 *   const release = trapFocus(modal)
 *   releaseFocus(release)   // equivalent to release()
 *
 * @param {() => void} release  The function returned by trapFocus().
 */
export function releaseFocus(release) {
  if (typeof release === 'function') release()
}
