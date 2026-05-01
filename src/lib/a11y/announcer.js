// ─── announcer.js ────────────────────────────────────────────────────────────
// Live-region announcer for screen readers (WCAG AA — Status Messages 4.1.3).
//
// Maintains a single pair of visually-hidden ARIA live regions in document.body
// and exposes announce()/init()/destroy() helpers. The "toggle technique"
// (clear textContent → set after a microtask) forces assistive tech to
// re-announce repeated identical messages.
//
// Framework-agnostic. Pure DOM. SSR-safe (no-ops without `document`).
// ────────────────────────────────────────────────────────────────────────────

const POLITE_ID = 'sporeus-a11y-live-polite'
const ASSERTIVE_ID = 'sporeus-a11y-live-assertive'

const HIDDEN_STYLE =
  'clip: rect(0 0 0 0); position: absolute; width: 1px; height: 1px; overflow: hidden; ' +
  'clip-path: inset(50%); white-space: nowrap; border: 0; padding: 0; margin: -1px;'

let politeRegion = null
let assertiveRegion = null

/**
 * True when DOM globals are available (browser / jsdom).
 * @returns {boolean}
 */
function hasDOM() {
  return typeof document !== 'undefined' && !!document.body
}

/**
 * Build a single live-region element with the proper ARIA attributes.
 * @param {string} id  Element id.
 * @param {'polite'|'assertive'} level  aria-live politeness.
 * @returns {HTMLElement}
 */
function buildRegion(id, level) {
  const el = document.createElement('div')
  el.id = id
  el.setAttribute('aria-live', level)
  el.setAttribute('aria-atomic', 'true')
  el.setAttribute('role', level === 'assertive' ? 'alert' : 'status')
  el.setAttribute('style', HIDDEN_STYLE)
  return el
}

/**
 * Initialise the live regions. Idempotent — calling more than once is safe and
 * will not create duplicate nodes. No-ops in non-browser environments.
 */
export function init() {
  if (!hasDOM()) return

  // Re-use any existing region (handles HMR / multiple calls).
  politeRegion = document.getElementById(POLITE_ID)
  assertiveRegion = document.getElementById(ASSERTIVE_ID)

  if (!politeRegion) {
    politeRegion = buildRegion(POLITE_ID, 'polite')
    document.body.appendChild(politeRegion)
  }
  if (!assertiveRegion) {
    assertiveRegion = buildRegion(ASSERTIVE_ID, 'assertive')
    document.body.appendChild(assertiveRegion)
  }
}

/**
 * Tear down the live regions. Used by SPA route changes / tests.
 */
export function destroy() {
  if (!hasDOM()) return
  const p = document.getElementById(POLITE_ID)
  const a = document.getElementById(ASSERTIVE_ID)
  if (p && p.parentNode) p.parentNode.removeChild(p)
  if (a && a.parentNode) a.parentNode.removeChild(a)
  politeRegion = null
  assertiveRegion = null
}

/**
 * Announce a message to assistive technology.
 *
 * Uses the toggle technique: textContent is cleared first, then re-applied via
 * `queueMicrotask`, so identical consecutive messages are still re-announced.
 *
 * Auto-initialises if the regions don't exist yet, so callers don't have to
 * remember to call init() manually.
 *
 * @param {string} message  Plain text message.
 * @param {'polite'|'assertive'} [level='polite']
 */
export function announce(message, level = 'polite') {
  if (!hasDOM()) return
  if (typeof message !== 'string' || message.length === 0) return

  // Lazy-init: makes the API forgiving — never throws if init() was skipped.
  if (!politeRegion || !assertiveRegion) init()

  const region = level === 'assertive' ? assertiveRegion : politeRegion
  if (!region) return

  region.textContent = ''
  // Microtask defer ensures SR sees a state change even when the new text
  // matches the previous text.
  queueMicrotask(() => {
    if (region) region.textContent = message
  })
}
