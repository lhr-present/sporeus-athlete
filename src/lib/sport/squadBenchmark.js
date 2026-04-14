// ── squadBenchmark.js — Coach squad ranking utilities ────────────────────────

/**
 * @description Sorts a squad of athletes by a selected metric. ACWR sorts with highest (most at risk)
 *   first; all other metrics sort descending (best first).
 * @param {Array<{id, name, ctl:number, acwr:number, compliance_pct:number, wellness_avg:number}>} athletes - Squad athlete objects
 * @param {'ctl'|'acwr'|'compliance_pct'|'wellness_avg'} [metric='ctl'] - Metric to sort by
 * @returns {Array} Sorted copy of the athletes array
 * @source Banister & Calvert (1980) — Modeling elite athletic performance; Hulin et al. (2016) — The acute:chronic workload ratio predicts injury
 * @example
 * rankSquad([{name:'A',ctl:80},{name:'B',ctl:95}], 'ctl') // => [{name:'B',...},{name:'A',...}]
 */
export function rankSquad(athletes, metric = 'ctl') {
  if (!Array.isArray(athletes)) return []
  const sorted = [...athletes].sort((a, b) => {
    const av = a[metric] ?? 0
    const bv = b[metric] ?? 0
    // For ACWR, higher = more risk, so sort descending (most at risk first)
    return metric === 'acwr' ? bv - av : bv - av
  })
  return sorted
}

/**
 * @description Serialises the squad athlete list to a CSV string with standard headers.
 * @param {Array<{name, ctl, acwr, compliance_pct, wellness_avg}>} athletes - Squad athlete objects
 * @returns {string} CSV string including header row and one row per athlete
 * @example
 * exportSquadCSV([{name:'Alice',ctl:80,acwr:1.1,compliance_pct:85,wellness_avg:3.8}])
 * // => 'name,ctl,acwr,compliance_pct,wellness_avg\n"Alice",80,1.1,85,3.8'
 */
export function exportSquadCSV(athletes) {
  if (!Array.isArray(athletes) || athletes.length === 0) return 'name,ctl,acwr,compliance_pct,wellness_avg\n'
  const rows = athletes.map(a =>
    [
      JSON.stringify(a.name ?? ''),
      a.ctl ?? '',
      a.acwr ?? '',
      a.compliance_pct ?? '',
      a.wellness_avg ?? '',
    ].join(',')
  )
  return ['name,ctl,acwr,compliance_pct,wellness_avg', ...rows].join('\n')
}

/**
 * @description Calculates the percentage of weeks where actual TSS was within 10% of planned TSS.
 * @param {number[]} plannedWeeks - Array of planned weekly TSS values
 * @param {number[]} actualWeeks - Array of actual weekly TSS values (same length or shorter)
 * @returns {number} Compliance percentage 0–100
 * @source Hulin et al. (2016) — The acute:chronic workload ratio predicts injury
 * @example
 * calcCompliancePct([200, 220, 200], [198, 230, 180]) // => 67 (2 of 3 within 10%)
 */
export function calcCompliancePct(plannedWeeks, actualWeeks) {
  if (!Array.isArray(plannedWeeks) || plannedWeeks.length === 0) return 0
  const n = Math.min(plannedWeeks.length, (actualWeeks || []).length)
  if (n === 0) return 0
  let compliant = 0
  for (let i = 0; i < n; i++) {
    const p = plannedWeeks[i] ?? 0
    const a = actualWeeks[i] ?? 0
    if (p === 0) { compliant++; continue }
    if (Math.abs(a - p) / p <= 0.10) compliant++
  }
  return Math.round(compliant / n * 100)
}

/**
 * @description Caps a selection array to a maximum number of items.
 * @param {string[]} selectedIds - Array of selected athlete IDs
 * @param {number} [maxCount=5] - Maximum allowed selection size
 * @returns {string[]} Sliced array with at most maxCount items
 * @example
 * limitSelection(['a','b','c','d','e','f'], 3) // => ['a','b','c']
 */
export function limitSelection(selectedIds, maxCount = 5) {
  if (!Array.isArray(selectedIds)) return []
  return selectedIds.slice(0, maxCount)
}
