// ─── activityUpload.test.js ──────────────────────────────────────────────────
// Verifies uploadActivityFile() / listActivityUploads() in lib/activityUpload.js.
// Mocks only the boundaries: Supabase (storage + table) and the logger.
//
// Contract under test:
//   • path = `${userId}/${ts}-${sanitizedName}`, bucket = 'activity-uploads'
//   • audit row inserted into 'activity_upload_jobs' with file_type whitelisting
//   • NON-FATAL: storage error returns { error } without throwing; DB error still
//     returns the storage path.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase.js', () => ({
  supabase: { storage: { from: vi.fn() }, from: vi.fn() },
  isSupabaseReady: vi.fn(() => true),
}))
vi.mock('../logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { supabase, isSupabaseReady } from '../supabase.js'
import { uploadActivityFile, listActivityUploads } from '../activityUpload.js'

// ── Boundary mock helpers ──────────────────────────────────────────────────────
function mockStorageUpload(result) {
  const uploadFn = vi.fn().mockResolvedValue(result)
  supabase.storage.from.mockReturnValue({ upload: uploadFn })
  return uploadFn
}
function mockInsert(result) {
  const insertFn = vi.fn().mockResolvedValue(result)
  supabase.from.mockReturnValue({ insert: insertFn })
  return insertFn
}

const file = (name, size = 1024) => ({ name, size })

beforeEach(() => {
  vi.clearAllMocks()
  isSupabaseReady.mockReturnValue(true)
})

describe('uploadActivityFile — guards', () => {
  it('returns not-ready when Supabase is unavailable', async () => {
    isSupabaseReady.mockReturnValue(false)
    const res = await uploadActivityFile('u1', file('ride.fit'))
    expect(res).toEqual({ path: null, error: 'not-ready' })
    expect(supabase.storage.from).not.toHaveBeenCalled()
  })
  it('returns not-ready when userId is missing', async () => {
    const res = await uploadActivityFile(null, file('ride.fit'))
    expect(res).toEqual({ path: null, error: 'not-ready' })
  })
  it('returns not-ready when file is missing', async () => {
    const res = await uploadActivityFile('u1', null)
    expect(res).toEqual({ path: null, error: 'not-ready' })
  })
})

describe('uploadActivityFile — happy path', () => {
  it('uploads to the activity-uploads bucket with a user-scoped path', async () => {
    const upload = mockStorageUpload({ error: null })
    mockInsert({ error: null })

    const res = await uploadActivityFile('user-9', file('Morning Ride.fit'), { tss: 80 })

    expect(supabase.storage.from).toHaveBeenCalledWith('activity-uploads')
    // path = `${userId}/${ts}-${sanitizedName}`
    expect(res.path).toMatch(/^user-9\/\d+-Morning_Ride\.fit$/)
    expect(res.error).toBeNull()
    // upload called with (path, file, { cacheControl, upsert:false })
    const [pathArg, fileArg, opts] = upload.mock.calls[0]
    expect(pathArg).toBe(res.path)
    expect(fileArg.name).toBe('Morning Ride.fit')
    expect(opts).toMatchObject({ cacheControl: '3600', upsert: false })
  })

  it('sanitizes unsafe characters in the filename', async () => {
    mockStorageUpload({ error: null })
    mockInsert({ error: null })
    const res = await uploadActivityFile('u1', file('a b/c*?.gpx'))
    // spaces, slash and special chars → underscores
    expect(res.path).toMatch(/^u1\/\d+-a_b_c__\.gpx$/)
  })

  it('inserts an audit row into activity_upload_jobs with the parsed meta', async () => {
    mockStorageUpload({ error: null })
    const insert = mockInsert({ error: null })

    const meta = { date: '2026-05-30', tss: 95, durationMin: 60 }
    const res = await uploadActivityFile('user-9', file('long.gpx', 2048), meta, 'log-42')

    expect(supabase.from).toHaveBeenCalledWith('activity_upload_jobs')
    const row = insert.mock.calls[0][0]
    expect(row).toMatchObject({
      user_id:      'user-9',
      file_path:    res.path,
      file_name:    'long.gpx',
      file_type:    'gpx',
      file_size:    2048,
      status:       'parsed',
      log_entry_id: 'log-42',
      parse_meta:   meta,
    })
  })

  it('whitelists file_type to fit/gpx/csv, defaulting unknown extensions to fit', async () => {
    mockStorageUpload({ error: null })
    const insert = mockInsert({ error: null })

    await uploadActivityFile('u1', file('weird.tcx'))   // unknown ext
    expect(insert.mock.calls[0][0].file_type).toBe('fit')

    insert.mockClear()
    await uploadActivityFile('u1', file('data.CSV'))     // uppercase ext → lowercased
    expect(insert.mock.calls[0][0].file_type).toBe('csv')
  })

  it('defaults meta to {} and logEntryId to null when omitted', async () => {
    mockStorageUpload({ error: null })
    const insert = mockInsert({ error: null })
    await uploadActivityFile('u1', file('ride.fit'))
    const row = insert.mock.calls[0][0]
    expect(row.parse_meta).toEqual({})
    expect(row.log_entry_id).toBeNull()
  })
})

describe('uploadActivityFile — non-fatal error contract', () => {
  it('storage error → returns { path:null, error } without throwing, and skips the DB insert', async () => {
    mockStorageUpload({ error: { message: 'bucket full' } })
    const insert = mockInsert({ error: null })

    const res = await uploadActivityFile('u1', file('ride.fit'))
    expect(res).toEqual({ path: null, error: 'bucket full' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('DB insert error → still returns the storage path (upload already succeeded)', async () => {
    mockStorageUpload({ error: null })
    mockInsert({ error: { message: 'rls denied' } })

    const res = await uploadActivityFile('u1', file('ride.fit'))
    expect(res.path).toMatch(/^u1\/\d+-ride\.fit$/)
    expect(res.error).toBe('rls denied')
  })
})

describe('listActivityUploads', () => {
  it('returns not-ready when Supabase is unavailable', async () => {
    isSupabaseReady.mockReturnValue(false)
    const res = await listActivityUploads()
    expect(res).toEqual({ data: [], error: 'not-ready' })
  })

  it('queries activity_upload_jobs ordered by created_at desc with a limit', async () => {
    const rows = [{ id: '1', file_name: 'a.fit' }]
    const chain = {
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue({ data: rows, error: null }),
    }
    supabase.from.mockReturnValue(chain)

    const res = await listActivityUploads(5)
    expect(supabase.from).toHaveBeenCalledWith('activity_upload_jobs')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(5)
    expect(res).toEqual({ data: rows, error: null })
  })

  it('normalizes null data to [] and surfaces the error message', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
    }
    supabase.from.mockReturnValue(chain)
    const res = await listActivityUploads()
    expect(res).toEqual({ data: [], error: 'boom' })
  })
})
