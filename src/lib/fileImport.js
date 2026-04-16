// ─── fileImport.js — FIT and GPX workout file parsing ────────────────────────
import FitParser from 'fit-file-parser'
import { logger } from './logger.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function _toKmh(ms) { return ms * 3.6 }
function hav(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function hrZones(hr, maxHR) {
  if (!hr || !maxHR) return null
  const pct = hr / maxHR
  if (pct < 0.6) return 1
  if (pct < 0.7) return 2
  if (pct < 0.8) return 3
  if (pct < 0.9) return 4
  return 5
}

function estimateTSS(durationMin, avgHR, maxHR, lthr) {
  if (!avgHR || !maxHR) return Math.round(durationMin * 0.5)  // ~50 TSS/hr baseline
  const _lthr = lthr || maxHR * 0.87
  const hrr = (avgHR - 50) / (maxHR - 50)
  const lhrr = (_lthr - 50) / (maxHR - 50)
  // TRIMP-based: duration × HR ratio × exp factor, scaled to TSS-like value
  const trimp = (durationMin / 60) * hrr * 0.64 * Math.exp(1.92 * hrr)
  const ltTrimp = (1) * lhrr * 0.64 * Math.exp(1.92 * lhrr)  // 1-hour at LT
  return Math.min(400, Math.round((trimp / ltTrimp) * 100))
}

// ── FIT parser ────────────────────────────────────────────────────────────────

export function parseFIT(arrayBuffer, profileMaxHR) {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ force: true, speedUnit: 'm/s', lengthUnit: 'm', elapsedRecordField: true })

    parser.parse(arrayBuffer, (err, data) => {
      if (err) { reject(new Error('Could not parse FIT file: ' + err)); return }

      try {
        const session = data?.activity?.sessions?.[0] || data?.sessions?.[0]
        const records = data?.activity?.sessions?.[0]?.laps?.flatMap(l => l.records || [])
          || data?.records || []

        // Extract heart rate samples
        const hrSamples = records.filter(r => r.heart_rate > 0).map(r => r.heart_rate)
        const avgHR = hrSamples.length ? Math.round(hrSamples.reduce((s,v) => s+v, 0) / hrSamples.length) : null
        const maxHR_rec = hrSamples.length ? Math.max(...hrSamples) : null

        const maxHR = profileMaxHR || maxHR_rec || 180
        const durationMin = session?.total_elapsed_time
          ? Math.round(session.total_elapsed_time / 60)
          : records.length > 1 ? Math.round((new Date(records.at(-1).timestamp) - new Date(records[0].timestamp)) / 60000) : 0

        const distanceM = session?.total_distance || 0
        const tssEstimate = estimateTSS(durationMin, avgHR, maxHR, null)

        // Zone distribution
        const zoneCounts = [0,0,0,0,0]
        hrSamples.forEach(hr => { const z = hrZones(hr, maxHR); if (z) zoneCounts[z-1]++ })
        const totalZone = zoneCounts.reduce((s,v)=>s+v,0) || 1
        const zones = zoneCounts.map(c => Math.round(c/totalZone*100))

        // Date from first record or session start
        const startTime = session?.start_time || records[0]?.timestamp
        const date = startTime ? new Date(startTime).toISOString().slice(0,10)
          : new Date().toISOString().slice(0,10)

        // Second-by-second power series (for W' balance + decoupling analysis)
        const powerSeries = records
          .map(r => (typeof r.power === 'number' ? r.power : (typeof r.power_watts === 'number' ? r.power_watts : 0)))
          .filter((_, i, a) => a.length > 0)
        const hasPower = powerSeries.some(p => p > 0)

        // Second-by-second HR series (for aerobic decoupling)
        const hrSeries = records.map(r => r.heart_rate || 0)
        const hasHR = hrSeries.some(h => h > 0)

        // Second-by-second speed series (for running decoupling when no power)
        const speedSeries = records.map(r => (typeof r.speed === 'number' ? r.speed : 0))
        const hasSpeed = speedSeries.some(s => s > 0)

        // Persist to localStorage so Protocols tab can load it without re-upload
        if (hasPower) {
          try { localStorage.setItem('sporeus-last-fit-power', JSON.stringify(powerSeries.slice(0, 10800))) } catch (e) { logger.warn('localStorage:', e.message) }
        }

        resolve({
          date, durationMin, avgHR, maxHR: maxHR_rec,
          distanceM: Math.round(distanceM), tssEstimate, zones,
          powerSeries: hasPower ? powerSeries : [],
          hrSeries:    hasHR    ? hrSeries    : [],
          speedSeries: hasSpeed ? speedSeries : [],
        })
      } catch (e) {
        reject(new Error('FIT parse error: ' + e.message))
      }
    })
  })
}

// ── GPX parser ────────────────────────────────────────────────────────────────

export function parseGPX(xmlString, profileMaxHR) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid GPX file')

  const trkpts = Array.from(doc.querySelectorAll('trkpt'))
  if (!trkpts.length) throw new Error('No track points found in GPX')

  let distanceM = 0
  let elevGain = 0
  const times = []
  const hrSamples = []

  trkpts.forEach((pt, i) => {
    const lat = parseFloat(pt.getAttribute('lat'))
    const lon = parseFloat(pt.getAttribute('lon'))
    const ele = parseFloat(pt.querySelector('ele')?.textContent || '0')
    const timeStr = pt.querySelector('time')?.textContent
    const hrEl = pt.querySelector('hr, heartrate, [localname="hr"]') || pt.querySelector('ns3\\:hr, gpxtpx\\:hr')
    if (hrEl) hrSamples.push(parseInt(hrEl.textContent))
    if (timeStr) times.push(new Date(timeStr))
    if (i > 0) {
      const prev = trkpts[i-1]
      distanceM += hav(parseFloat(prev.getAttribute('lat')), parseFloat(prev.getAttribute('lon')), lat, lon)
      const prevEle = parseFloat(prev.querySelector('ele')?.textContent || '0')
      if (ele > prevEle) elevGain += (ele - prevEle)
    }
  })

  const durationMin = times.length >= 2
    ? Math.round((times.at(-1) - times[0]) / 60000)
    : 0

  const avgPaceSecKm = distanceM > 0 && durationMin > 0
    ? Math.round((durationMin * 60) / (distanceM / 1000))
    : null

  const avgHR = hrSamples.length ? Math.round(hrSamples.reduce((s,v)=>s+v,0)/hrSamples.length) : null
  const maxHR = hrSamples.length ? Math.max(...hrSamples) : null
  const tssEstimate = estimateTSS(durationMin, avgHR, profileMaxHR || maxHR || 180, null)

  const date = times[0] ? times[0].toISOString().slice(0,10) : new Date().toISOString().slice(0,10)

  // Build lightweight trackpoints array for route visualization
  const trackpoints = trkpts.map(pt => ({
    lat: parseFloat(pt.getAttribute('lat')),
    lon: parseFloat(pt.getAttribute('lon')),
    ele: parseFloat(pt.querySelector('ele')?.textContent || '0'),
    time: pt.querySelector('time')?.textContent || null,
  })).filter(p => !isNaN(p.lat) && !isNaN(p.lon))

  return { date, durationMin, distanceM: Math.round(distanceM), elevationGainM: Math.round(elevGain), avgPaceSecKm, avgHR, maxHR, tssEstimate, trackpoints }
}

// ── File type detection ───────────────────────────────────────────────────────

export function detectFileType(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'fit') return 'fit'
  if (ext === 'gpx') return 'gpx'
  if (ext === 'csv') return 'csv'
  return 'unsupported'
}

// ── CSV bulk import ───────────────────────────────────────────────────────────
// Type normalization map (lowercase key → canonical value)
const TYPE_MAP = {
  run: 'Run', running: 'Run', 'easy run': 'Run', 'trail run': 'Run',
  ride: 'Ride', bike: 'Ride', cycling: 'Ride', 'easy ride': 'Ride',
  swim: 'Swim', swimming: 'Swim', 'pool swim': 'Swim', 'open water': 'Swim',
  row: 'Row', rowing: 'Row', erg: 'Row',
  walk: 'Walk', hike: 'Hike', yoga: 'Yoga', gym: 'Gym', strength: 'Strength',
  brick: 'Brick', triathlon: 'Triathlon',
}

function normalizeType(raw) {
  if (!raw) return 'Training'
  const key = raw.toLowerCase().trim()
  return TYPE_MAP[key] || 'Training'
}

/**
 * Parse a bulk CSV string into log entries.
 * Columns (case-insensitive, order-independent):
 *   date (YYYY-MM-DD), type, duration_min, tss, rpe, notes, distance_m
 * Invalid rows (missing/invalid date) are skipped with console.warn.
 * @param {string} text — raw CSV text (may have BOM \uFEFF)
 * @returns {Array<{date,type,tss,rpe,durationMin,distanceM,notes}>}
 */
export function parseBulkCSV(text) {
  if (!text) return []
  // Strip BOM (Excel exports add \uFEFF)
  const cleaned = text.replace(/^\uFEFF/, '').trim()
  const lines   = cleaned.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Parse header — map column name → index
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''))
  const col = name => headers.indexOf(name)

  const dateIdx     = col('date')
  const typeIdx     = col('type')
  const durIdx      = col('duration_min')
  const tssIdx      = col('tss')
  const rpeIdx      = col('rpe')
  const notesIdx    = col('notes')
  const distIdx     = col('distance_m')

  const results = []
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV split — handles quoted fields with commas
    const cells = splitCSVLine(lines[i])
    const get   = idx => (idx >= 0 && idx < cells.length ? cells[idx].trim() : '')

    const date = get(dateIdx)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.warn(`[parseBulkCSV] Row ${i + 1}: invalid or missing date "${date}" — skipped`)
      continue
    }

    const durationMin = parseFloat(get(durIdx)) || 0
    const tss         = parseFloat(get(tssIdx))  || null
    const rpe         = parseFloat(get(rpeIdx))  || null
    const distanceM   = parseFloat(get(distIdx)) || 0
    const notes       = get(notesIdx)
    const type        = normalizeType(get(typeIdx))

    results.push({
      date,
      type,
      durationMin:  Math.round(durationMin),
      duration:     Math.round(durationMin),  // TrainingLog uses 'duration'
      tss:          tss != null ? Math.round(tss * 10) / 10 : null,
      rpe:          rpe != null ? Math.min(10, Math.max(1, Math.round(rpe))) : null,
      distanceM:    Math.round(distanceM),
      notes,
      source:       'csv_import',
      id:           `csv-${date}-${type}-${i}`,
    })
  }
  return results
}

/** Split one CSV line, respecting quoted fields. */
function splitCSVLine(line) {
  const cells = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ }
    else if (c === ',' && !inQ) { cells.push(cur); cur = '' }
    else { cur += c }
  }
  cells.push(cur)
  return cells
}

/**
 * Deduplicate incoming entries against existing log.
 * Skips incoming entries where existing already has same date AND type.
 * Entries on same date but different type are kept (two sessions per day).
 * @param {Array} existing — current log entries
 * @param {Array} incoming — new entries from CSV
 * @returns {Array} — filtered incoming entries
 */
export function deduplicateByDate(existing, incoming) {
  const occupied = new Set((existing || []).map(e => `${e.date}|${e.type}`))
  return (incoming || []).filter(e => !occupied.has(`${e.date}|${e.type}`))
}

/**
 * Generate and trigger download of a sample CSV template.
 */
export function downloadCSVTemplate() {
  const header = 'date,type,duration_min,tss,rpe,notes,distance_m'
  const rows = [
    '2026-04-01,Run,60,65,6,Easy aerobic run,10000',
    '2026-04-03,Ride,90,85,7,Tempo intervals,40000',
    '2026-04-05,Swim,45,50,5,CSS intervals,3000',
  ]
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'sporeus_training_template.csv'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
