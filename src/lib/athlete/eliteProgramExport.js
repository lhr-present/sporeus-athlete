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

// ─── v9.168.0 (EP-8) — Full multi-section CSV + JSON export ─────────────────
//
// The CSV above emits only the daily grid (one row per phase × week × day).
// The program object holds far more: weekly TSS targets, strength plan per
// phase, drill library, key sessions, physiology gap insight, feasibility,
// cohort, distance category. For coaches importing the plan into a
// spreadsheet, or for athletes archiving / sharing the full plan, those
// extra surfaces are valuable.
//
// `eliteProgramToFullCSV` emits a multi-section CSV: blank-line-separated
// sections, each prefixed by `# SECTION` so spreadsheets render them as
// distinct blocks. The existing daily-grid section is preserved (same
// header + content) so a coach who imports the full CSV gets the same
// daily-grid columns the legacy CSV gave.
//
// `eliteProgramToJSON` emits a stable, versioned JSON envelope. Round-
// trippable — feed it to a future importer and reconstruct the program
// without re-running `buildEliteProgram`.

import { computePhysiologyGapInsight } from './physiologyGapInsight.js'

const EXPORT_VERSION = 'v9.168.0'

function bilingualEN(v) {
  if (!v) return ''
  if (typeof v === 'string') return v
  return v.en || ''
}
function bilingualTR(v) {
  if (!v) return ''
  if (typeof v === 'string') return ''
  return v.tr || ''
}

function metaSection(p) {
  const cur = p.currentLevel || {}
  const tgt = p.targetLevel  || {}
  const feas = p.feasibility || {}
  const raceDate = feas.effectiveRaceDate || p.raceDate || ''
  return [
    '# META',
    'Field,Value',
    `Sport,${csvEscape(p.sport || '')}`,
    `RaceDate,${csvEscape(raceDate)}`,
    `DistanceCategory,${csvEscape(p.distanceCategory || '')}`,
    `Cohort,${csvEscape(p.cohort || '')}`,
    `WeeksAvailable,${csvEscape(feas.weeksAvailable ?? '')}`,
    `WeeksNeeded,${csvEscape(feas.weeksNeeded ?? '')}`,
    `WeeklyTssGoalApplied,${csvEscape(p.weeklyTssGoalApplied ?? '')}`,
    `FeasibilityWarning,${csvEscape(p.feasibilityWarning || '')}`,
    `CurrentLevel,${csvEscape(JSON.stringify(cur))}`,
    `TargetLevel,${csvEscape(JSON.stringify(tgt))}`,
    `ExportVersion,${EXPORT_VERSION}`,
    `ExportedAt,${new Date().toISOString()}`,
  ].join('\n')
}

function weeklyTssSection(p) {
  const wt = Array.isArray(p.weeklyTSS) ? p.weeklyTSS : []
  const rows = ['# WEEKLY_TSS', 'Week,Phase,TSS']
  for (const w of wt) {
    rows.push([csvEscape(w?.week ?? ''), csvEscape(w?.phase ?? ''), csvEscape(w?.tss ?? '')].join(','))
  }
  return rows.join('\n')
}

function dailyGridSection(p) {
  const grid = eliteProgramToCSV(p)
  return `# DAILY_GRID\n${grid}`
}

function strengthSection(p) {
  const sp = p.strengthProgram && typeof p.strengthProgram === 'object' ? p.strengthProgram : {}
  const rows = ['# STRENGTH', 'Phase,Section,Name,Sets,Reps,Intensity,NotesEN,NotesTR']
  for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
    const plan = sp[phase]
    if (!plan) continue
    const groups = [
      ['prehab', plan.prehab || []],
      ['movements', plan.movements || []],
      ['core', plan.core || []],
    ]
    for (const [section, list] of groups) {
      for (const m of list) {
        rows.push([
          csvEscape(phase),
          csvEscape(section),
          csvEscape(bilingualEN(m?.name)),
          csvEscape(m?.sets ?? ''),
          csvEscape(m?.reps ?? ''),
          csvEscape(bilingualEN(m?.intensity)),
          csvEscape(bilingualEN(m?.notes)),
          csvEscape(bilingualTR(m?.notes)),
        ].join(','))
      }
    }
  }
  return rows.join('\n')
}

function drillsSection(p) {
  const lib = p.drillsLibrary && typeof p.drillsLibrary === 'object' ? p.drillsLibrary : {}
  const rows = ['# DRILLS', 'Phase,Key,NameEN,NameTR,StructureEN,FrequencyPerWeek,Citation']
  for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
    const list = Array.isArray(lib[phase]) ? lib[phase] : []
    for (const d of list) {
      rows.push([
        csvEscape(phase),
        csvEscape(d?.key || ''),
        csvEscape(bilingualEN(d?.name)),
        csvEscape(bilingualTR(d?.name)),
        csvEscape(bilingualEN(d?.structure)),
        csvEscape(d?.frequencyPerWeek ?? ''),
        csvEscape(d?.citation || ''),
      ].join(','))
    }
  }
  return rows.join('\n')
}

function physiologyGapSection(p) {
  const ins = computePhysiologyGapInsight(p)
  const rows = ['# PHYSIOLOGY_GAP', 'Metric,Current,Target,Gap,GapDirection,RatePerBlock,BlocksToBridge,WeeksToBridge,Verdict,NoteEN,NoteTR']
  if (!ins) {
    rows.push('')
    return rows.join('\n')
  }
  rows.push([
    csvEscape(ins.metric),
    csvEscape(ins.current),
    csvEscape(ins.target),
    csvEscape(ins.gap),
    csvEscape(ins.gapDirection),
    csvEscape(ins.ratePerBlock),
    csvEscape(ins.blocksToBridge ?? ''),
    csvEscape(ins.weeksToBridge ?? ''),
    csvEscape(ins.physVerdict),
    csvEscape(ins.note?.en || ''),
    csvEscape(ins.note?.tr || ''),
  ].join(','))
  return rows.join('\n')
}

/**
 * Multi-section full-program CSV.
 * @param {object} program - buildEliteProgram output
 * @returns {string}
 */
export function eliteProgramToFullCSV(program) {
  if (!program || typeof program !== 'object') return ''
  return [
    metaSection(program),
    weeklyTssSection(program),
    dailyGridSection(program),
    strengthSection(program),
    drillsSection(program),
    physiologyGapSection(program),
  ].join('\n\n')
}

/**
 * Stable, versioned JSON envelope. Round-trippable.
 * @param {object} program - buildEliteProgram output
 * @returns {string} JSON
 */
export function eliteProgramToJSON(program) {
  if (!program || typeof program !== 'object') return ''
  const envelope = {
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    program,
    physiologyGap: computePhysiologyGapInsight(program),
  }
  return JSON.stringify(envelope, null, 2)
}

function downloadBlob(text, mime, filename) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
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

export function downloadEliteProgramFullCSV(program, filename = 'elite-program-full.csv') {
  if (!program) return false
  return downloadBlob(eliteProgramToFullCSV(program), 'text/csv', filename)
}

export function downloadEliteProgramJSON(program, filename = 'elite-program.json') {
  if (!program) return false
  return downloadBlob(eliteProgramToJSON(program), 'application/json', filename)
}
