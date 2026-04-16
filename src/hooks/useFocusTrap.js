// ─── hooks/useFocusTrap.js — Trap focus inside a modal while it's active ──────
import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'details > summary',
].join(', ')

/**
 * Trap keyboard focus inside a container while the trap is active.
 * Restores focus to the previously focused element on deactivation.
 *
 * @param {React.RefObject<HTMLElement>} containerRef — ref to the modal panel
 * @param {{ active?: boolean, onEscape?: () => void }} options
 */
export function useFocusTrap(containerRef, { active = true, onEscape } = {}) {
  const returnFocusRef = useRef(null)

  useEffect(() => {
    if (!active || !containerRef.current) return

    // Save the element that had focus before the modal opened
    returnFocusRef.current = document.activeElement

    const container = containerRef.current
    const getFocusable = () => Array.from(container.querySelectorAll(FOCUSABLE))

    // Focus the first focusable element
    const focusable = getFocusable()
    if (focusable.length > 0) {
      // Slight delay so the modal is rendered before focusing
      const raf = requestAnimationFrame(() => focusable[0]?.focus())

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onEscape?.()
          return
        }
        if (e.key !== 'Tab') return

        const elements = getFocusable()
        if (elements.length === 0) { e.preventDefault(); return }

        const first = elements[0]
        const last  = elements[elements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }

      container.addEventListener('keydown', handleKeyDown)
      return () => {
        cancelAnimationFrame(raf)
        container.removeEventListener('keydown', handleKeyDown)
        returnFocusRef.current?.focus()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
