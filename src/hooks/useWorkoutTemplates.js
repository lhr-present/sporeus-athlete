// ─── useWorkoutTemplates.js — Save and reuse session templates ───────────────
// Templates are stored in localStorage. Each template is a partial session
// object (type, duration, rpe, notes, zones) without a date or id.
// The hook returns the list plus add/remove/apply helpers.

import { useLocalStorage } from './useLocalStorage.js'

const LS_KEY = 'sporeus-templates'

export function useWorkoutTemplates() {
  const [templates, setTemplates] = useLocalStorage(LS_KEY, [])

  function saveTemplate(entry, name) {
    const tpl = {
      id:       Date.now(),
      name:     (name || entry.type || 'Template').slice(0, 50),
      type:     entry.type     || 'Easy Run',
      duration: entry.duration || 45,
      rpe:      entry.rpe      || 5,
      notes:    entry.notes    || '',
      zones:    entry.zones    || null,
      tss:      entry.tss      || null,
    }
    setTemplates(prev => [tpl, ...prev].slice(0, 30))
    return tpl
  }

  function deleteTemplate(id) {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  // Returns a partial entry object suitable for pre-filling a form
  function applyTemplate(id) {
    return templates.find(t => t.id === id) || null
  }

  return { templates, saveTemplate, deleteTemplate, applyTemplate }
}
