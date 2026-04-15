// ─── useToasts — unified toast queue (replaces 5 scattered toast states) ─────
import { useState, useCallback } from 'react'

/**
 * @typedef {Object} Toast
 * @property {string} id
 * @property {string} message
 * @property {'info'|'success'|'warning'|'error'|'update'} type
 * @property {number} duration - ms before auto-dismiss (0 = manual only)
 * @property {{ label: string, onClick: Function }|null} action
 * @property {Function|null} onDismiss - called when toast is dismissed
 */

const TYPE_BG = {
  info:    '#0064ff',
  success: '#1e7e34',
  warning: '#ff6600',
  error:   '#e03030',
  update:  '#0064ff',
}

/**
 * @returns {{ toasts: Toast[], addToast: Function, dismissToast: Function }}
 */
export function useToasts() {
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((id) => {
    setToasts(prev => {
      const t = prev.find(x => x.id === id)
      if (t?.onDismiss) t.onDismiss()
      return prev.filter(x => x.id !== id)
    })
  }, [])

  const addToast = useCallback((toast) => {
    const t = { duration: 4000, action: null, ...toast }
    setToasts(prev => {
      // Replace if same id already showing
      const without = prev.filter(x => x.id !== t.id)
      return [...without, t]
    })
    if (t.duration > 0) {
      setTimeout(() => dismissToast(t.id), t.duration)
    }
  }, [dismissToast])

  return { toasts, addToast, dismissToast }
}

export { TYPE_BG }
