// ── squadBenchmark.js — Coach squad ranking utilities ────────────────────────

// rankSquad(athletes, metric)
// athletes = [{ id, name, ctl, acwr, compliance_pct, wellness_avg }]
// metric: 'ctl' | 'acwr' | 'compliance_pct' | 'wellness_avg'
// Returns sorted athletes array (descending for ctl/compliance/wellness, ascending for acwr risk)
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

// exportSquadCSV(athletes)
// Returns a CSV string with headers: name, ctl, acwr, compliance_pct, wellness_avg
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

// calcCompliancePct(plannedWeeks, actualWeeks)
// plannedWeeks/actualWeeks = array of numbers (TSS per week)
// Returns pct of weeks where actual was within 10% of planned
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

// limitSelection(selectedIds, maxCount = 5)
// Returns the array capped at maxCount items
export function limitSelection(selectedIds, maxCount = 5) {
  if (!Array.isArray(selectedIds)) return []
  return selectedIds.slice(0, maxCount)
}
