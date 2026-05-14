// src/lib/athlete/executionLabels.js
//
// v9.154.0 (Prompt 6, scoped) — Centralized bilingual labels for the
// EXECUTION snapshot block in TodayView. Replaces six inline
// `lang === 'tr' ? ... : ...` ternaries in a 3300-line file. Scope is
// intentionally narrow: only the labels physically rendered inside the
// snapshot row + the header. Larger i18n refactors (whole-component
// label registries) are deferred — they trade a smaller blast radius
// here for marginal payoff.
//
// Pure data + one lookup helper. No side effects, no React imports.

export const EXECUTION_LABELS = {
  // Header strip ("◆ EXECUTION · on target" / "◆ İCRA · hedefte")
  header:   { en: '◆ EXECUTION · ', tr: '◆ İCRA · ' },

  // Metric prefixes
  duration: { en: 'DUR · ',         tr: 'SÜRE · ' },
  rpe:      { en: 'RPE · ',         tr: 'RPE · ' },
  tss:      { en: 'TSS · ',         tr: 'TSS · ' },
  hr:       { en: 'HR · ',          tr: 'HR · ' },
  pace:     { en: 'PACE · ',        tr: 'TEMPO · ' },

  // Plan-comparison suffix (" / plan 60m"). Identical in both
  // languages — kept as a plain string so the lookup signals
  // "no translation needed" rather than duplicating the string.
  vsPlan:   ' / plan ',
}

/**
 * @param {keyof typeof EXECUTION_LABELS} key
 * @param {'en'|'tr'} lang
 * @returns {string}
 */
export function execLabel(key, lang) {
  const entry = EXECUTION_LABELS[key]
  if (entry == null) return ''
  if (typeof entry === 'string') return entry
  return entry[lang] ?? entry.en ?? ''
}
