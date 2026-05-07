// ─── eliteProgramExport.js — CSV export for the v8.88.0 Elite Program Builder ─
//
// Pure CSV serializer for an `eliteProgram` shape (see buildEliteProgram in
// src/lib/athlete/eliteProgram.js). Walks phases × sampleWeeks and emits one
// row per (phase × week × day). Bilingual notes emitted as separate columns.
//
// `eliteProgramToCSV` is a pure function — fully testable in any environment.
// `downloadEliteProgramCSV` is browser-only (Blob + URL.createObjectURL).
// ─────────────────────────────────────────────────────────────────────────────

export const ELITE_PROGRAM_CSV_HEADER =
  'Phase,Week,Day,Intent,DurationMin,Z1,Z2,Z3,Z4,Z5,PaceTarget,NotesEN,NotesTR'

function csvEscape(v) {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function intentEN(intent) {
  if (!intent) return ''
  if (typeof intent === 'string') return intent
  return intent.en || ''
}

function zoneVal(zones, key) {
  if (!zones || typeof zones !== 'object') return 0
  const v = Number(zones[key])
  return Number.isFinite(v) ? v : 0
}

export function eliteProgramToCSV(program) {
  if (!program || typeof program !== 'object') return ''
  const phases = Array.isArray(program.phases) ? program.phases : []
  const sampleWeeks = program.sampleWeeks && typeof program.sampleWeeks === 'object'
    ? program.sampleWeeks
    : {}

  const rows = [ELITE_PROGRAM_CSV_HEADER]

  for (const ph of phases) {
    const phaseName = ph?.phase
    if (!phaseName) continue
    const weekNumbers = Array.isArray(ph.weeks) ? ph.weeks : []
    const template = Array.isArray(sampleWeeks[phaseName]) ? sampleWeeks[phaseName] : []
    if (weekNumbers.length === 0 || template.length === 0) continue

    for (const wkNum of weekNumbers) {
      for (const day of template) {
        const dur = day?.durationMin != null ? day.durationMin : (day?.duration ?? 0)
        const pace = day?.paceTarget != null ? day.paceTarget : (day?.pace ?? '')
        const notes = day?.notes || {}
        rows.push([
          csvEscape(phaseName),
          csvEscape(wkNum),
          csvEscape(day?.day ?? ''),
          csvEscape(intentEN(day?.intent)),
          csvEscape(dur),
          csvEscape(zoneVal(day?.zones, 'Z1')),
          csvEscape(zoneVal(day?.zones, 'Z2')),
          csvEscape(zoneVal(day?.zones, 'Z3')),
          csvEscape(zoneVal(day?.zones, 'Z4')),
          csvEscape(zoneVal(day?.zones, 'Z5')),
          csvEscape(pace || ''),
          csvEscape(notes.en || ''),
          csvEscape(notes.tr || ''),
        ].join(','))
      }
    }
  }

  return rows.join('\n')
}

export function downloadEliteProgramCSV(program, filename = 'elite-program.csv') {
  if (!program) return false
  const csv = eliteProgramToCSV(program)
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
