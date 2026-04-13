import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── fit-file-parser mock ──────────────────────────────────────────────────────
vi.mock('fit-file-parser', () => ({
  default: class FitParser {
    constructor() {}
    parse(buffer, cb) {
      if (buffer === 'FIT_ERROR') {
        cb(new Error('Bad FIT magic bytes'), null)
        return
      }
      if (buffer === 'FIT_EMPTY') {
        cb(null, { records: [], activity: { sessions: [] } })
        return
      }
      // Valid FIT — 2 records with HR, 1h session
      cb(null, {
        activity: {
          sessions: [{
            total_elapsed_time: 3600,
            total_distance:     10000,
            start_time:         new Date('2026-01-15T08:00:00.000Z'),
            laps: [{
              records: [
                { heart_rate: 140, timestamp: new Date('2026-01-15T08:00:00.000Z'), power: 200 },
                { heart_rate: 160, timestamp: new Date('2026-01-15T09:00:00.000Z'), power: 230 },
              ],
            }],
          }],
        },
      })
    }
  },
}))

// ── localStorage stub (parseFIT writes power series) ─────────────────────────
const lsStore = {}
vi.stubGlobal('localStorage', {
  getItem:    k => lsStore[k] ?? null,
  setItem:    (k, v) => { lsStore[k] = String(v) },
  removeItem: k => { delete lsStore[k] },
})

// ── minimal DOMParser mock ────────────────────────────────────────────────────
function makeTrkpt(lat, lon, eleVal, timeVal, hrVal) {
  const childNodes = {}
  if (eleVal  !== undefined) childNodes.ele  = { textContent: String(eleVal)  }
  if (timeVal !== undefined) childNodes.time = { textContent: timeVal          }
  if (hrVal   !== undefined) childNodes.hr   = { textContent: String(hrVal)   }

  return {
    getAttribute: attr => (attr === 'lat' ? String(lat) : attr === 'lon' ? String(lon) : null),
    querySelector: sel => {
      // Handle compound selectors — just check if any segment matches a child key
      const candidates = sel.split(',').map(s => s.trim().replace(/\[.*?\]/g, '').replace(/\\/g, '').replace(/:/g, ''))
      for (const c of candidates) {
        if (childNodes[c]) return childNodes[c]
      }
      return null
    },
  }
}

class MockDOMParser {
  parseFromString(xml) {
    if (xml === 'INVALID_XML') {
      return {
        querySelector:    sel => (sel === 'parsererror' ? { textContent: 'error' } : null),
        querySelectorAll: ()  => [],
      }
    }
    if (xml === 'NO_TRKPTS') {
      return {
        querySelector:    () => null,
        querySelectorAll: () => [],
      }
    }
    if (xml === 'GPX_NO_ELEVATION') {
      const pts = [
        makeTrkpt(48.0, 11.0, undefined, '2026-01-15T07:00:00Z', 140),
        makeTrkpt(48.01, 11.01, undefined, '2026-01-15T07:30:00Z', 155),
      ]
      return { querySelector: () => null, querySelectorAll: () => pts }
    }
    // Default valid GPX — 3 pts with HR + ele
    const pts = [
      makeTrkpt(48.0,  11.0,  500, '2026-01-15T07:00:00Z', 140),
      makeTrkpt(48.01, 11.01, 510, '2026-01-15T07:30:00Z', 155),
      makeTrkpt(48.02, 11.02, 505, '2026-01-15T08:00:00Z', 160),
    ]
    return { querySelector: () => null, querySelectorAll: () => pts }
  }
}

vi.stubGlobal('DOMParser', MockDOMParser)

import { parseFIT, parseGPX, detectFileType } from '../fileImport.js'

// ── detectFileType ────────────────────────────────────────────────────────────
describe('detectFileType', () => {
  it('returns "fit" for a .fit filename', () => {
    expect(detectFileType({ name: 'morning_run.fit' })).toBe('fit')
  })

  it('returns "gpx" for a .gpx filename', () => {
    expect(detectFileType({ name: 'route.gpx' })).toBe('gpx')
  })

  it('returns "unsupported" for .csv, .tcx, empty name', () => {
    expect(detectFileType({ name: 'data.csv' })).toBe('unsupported')
    expect(detectFileType({ name: 'activity.tcx' })).toBe('unsupported')
    expect(detectFileType({ name: 'noext' })).toBe('unsupported')
  })
})

// ── parseFIT ──────────────────────────────────────────────────────────────────
describe('parseFIT', () => {
  it('resolves with workout data for a valid FIT buffer', async () => {
    const result = await parseFIT('FIT_VALID', 180)
    expect(result.durationMin).toBe(60)
    expect(result.distanceM).toBe(10000)
    expect(result.avgHR).toBeGreaterThan(0)
    expect(Array.isArray(result.zones)).toBe(true)
    expect(typeof result.date).toBe('string')
  })

  it('resolves with powerSeries when FIT has power data', async () => {
    const result = await parseFIT('FIT_VALID', 180)
    expect(Array.isArray(result.powerSeries)).toBe(true)
    expect(result.powerSeries.some(p => p > 0)).toBe(true)
  })

  it('rejects when FitParser reports a parse error', async () => {
    await expect(parseFIT('FIT_ERROR', 180)).rejects.toThrow(/parse/i)
  })

  it('resolves with 0 durationMin when sessions are empty', async () => {
    const result = await parseFIT('FIT_EMPTY', 180)
    expect(result.durationMin).toBe(0)
    expect(result.powerSeries).toEqual([])
  })
})

// ── parseGPX ──────────────────────────────────────────────────────────────────
describe('parseGPX', () => {
  it('parses valid GPX and returns workout fields', () => {
    const result = parseGPX('GPX_VALID', 180)
    expect(result.durationMin).toBe(60)
    expect(result.distanceM).toBeGreaterThan(0)
    expect(result.avgHR).toBeGreaterThan(0)
    expect(typeof result.date).toBe('string')
    expect(typeof result.tssEstimate).toBe('number')
  })

  it('returns elevationGainM=0 when track points have no elevation data', () => {
    const result = parseGPX('GPX_NO_ELEVATION', 180)
    expect(result.elevationGainM).toBe(0)
  })

  it('throws "Invalid GPX file" for malformed XML', () => {
    expect(() => parseGPX('INVALID_XML', 180)).toThrow('Invalid GPX file')
  })

  it('throws "No track points found" when GPX has no trkpt elements', () => {
    expect(() => parseGPX('NO_TRKPTS', 180)).toThrow('No track points found in GPX')
  })
})
