// Date-consistency between the FIT importer and the Garmin importer.
// Bug: fileImport derived the training date from the UTC calendar slice while
// the Garmin mapper used the athlete's LOCAL Y/M/D — so the same early-morning
// (UTC+3) activity landed on two different calendar days. Both must now file
// under the athlete's LOCAL training day.
//
// These tests run in the host timezone (CI = Europe/Istanbul, UTC+3). The
// assertions compare each importer's output to localToday(start), which is the
// single source of truth for "the human's local day", so they hold in any TZ.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { localToday } from '../dateKeys.js'
import { mapGarminActivity } from '../garmin/schemaMapper.js'

// An activity that STARTS at 01:00 local in UTC+3 = 22:00 UTC the day BEFORE.
// In UTC+3 the human is on the 17th; a UTC slice would (wrongly) say the 16th.
const START_LOCAL_0100 = new Date(2026, 5, 17, 1, 0, 0) // local 2026-06-17 01:00

// ── FIT parser mock returns an activity starting at START_LOCAL_0100 ──────────
vi.mock('fit-file-parser', () => ({
  default: class FitParser {
    constructor() {}
    parse(_buffer, cb) {
      const start = START_LOCAL_0100
      const end   = new Date(start.getTime() + 3600 * 1000)
      cb(null, {
        activity: {
          sessions: [{
            total_elapsed_time: 3600,
            total_distance:     10000,
            start_time:         start,
            laps: [{
              records: [
                { heart_rate: 140, timestamp: start, power: 200 },
                { heart_rate: 160, timestamp: end,   power: 230 },
              ],
            }],
          }],
        },
        records: [
          { heart_rate: 140, timestamp: start, power: 200 },
          { heart_rate: 160, timestamp: end,   power: 230 },
        ],
      })
    }
  },
}))

const lsStore = {}
vi.stubGlobal('localStorage', {
  getItem:    k => lsStore[k] ?? null,
  setItem:    (k, v) => { lsStore[k] = String(v) },
  removeItem: k => { delete lsStore[k] },
})

let parseFIT
beforeEach(async () => {
  ({ parseFIT } = await import('../fileImport.js'))
})

describe('FIT vs Garmin date consistency (01:00 local, UTC+3)', () => {
  it('FIT importer files the activity under the LOCAL day', async () => {
    const result = await parseFIT(new ArrayBuffer(8), 190)
    expect(result.date).toBe(localToday(START_LOCAL_0100))
  })

  it('Garmin importer files the same activity under the same LOCAL day', () => {
    // garminDateToLocal reads Unix ms with local Y/M/D — feed the same instant.
    const row = mapGarminActivity({
      startTimeGMT: START_LOCAL_0100.getTime(),
      duration: 3600,
      activityType: { typeKey: 'running' },
      activityId: 1,
    })
    expect(row.date).toBe(localToday(START_LOCAL_0100))
  })

  it('FIT and Garmin agree on the calendar day for the same activity', async () => {
    const fit = await parseFIT(new ArrayBuffer(8), 190)
    const garmin = mapGarminActivity({
      startTimeGMT: START_LOCAL_0100.getTime(),
      duration: 3600,
      activityType: { typeKey: 'running' },
      activityId: 1,
    })
    expect(fit.date).toBe(garmin.date)
  })
})
