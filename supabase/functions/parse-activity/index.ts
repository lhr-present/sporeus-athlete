// ─── parse-activity — Server-side FIT/GPX activity parser ─────────────────────
// POST { jobId: string, fileType: 'fit'|'gpx' }
// Downloads raw file from Storage, parses, inserts training_log row, updates job.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { withTelemetry } from '../_shared/telemetry.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { XMLParser } from 'https://esm.sh/fast-xml-parser@4'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!
const MAX_FILE_BYTES       = 26_214_400  // 25 MB hard limit (matches bucket + client check)

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jwtPayload(authHeader: string | null) {
  try {
    const token   = (authHeader || '').replace('Bearer ', '')
    const segment = token.split('.')[1]
    const padded  = segment.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(padded))
  } catch { return null }
}

function hrZone(hr: number, maxHR: number): number {
  const pct = hr / maxHR
  if (pct < 0.60) return 0
  if (pct < 0.70) return 1
  if (pct < 0.80) return 2
  if (pct < 0.90) return 3
  return 4
}

function normalizedPower(powers: number[]): number {
  if (!powers || powers.length < 30) return 0
  const W = 30
  const rolling: number[] = []
  for (let i = W - 1; i < powers.length; i++) {
    let sum = 0
    for (let j = i - W + 1; j <= i; j++) sum += powers[j]
    rolling.push(sum / W)
  }
  const mean4 = rolling.reduce((s, v) => s + Math.pow(v, 4), 0) / rolling.length
  return Math.round(Math.pow(mean4, 0.25))
}

function computeTSS(np: number, durationSec: number, ftp: number): number {
  if (!np || !ftp || !durationSec) return 0
  const IF = np / ftp
  return Math.round((durationSec * np * IF) / (ftp * 3600) * 100)
}

function estimateTSSFromHR(durationMin: number, avgHR: number, maxHR: number): number {
  if (!avgHR || !maxHR) return Math.round(durationMin * 0.5)
  const lthr = maxHR * 0.87
  const hrr  = (avgHR - 50) / (maxHR - 50)
  const lhrr = (lthr - 50)  / (maxHR - 50)
  const trimp    = (durationMin / 60) * hrr  * 0.64 * Math.exp(1.92 * hrr)
  const ltTrimp  = (1)               * lhrr * 0.64 * Math.exp(1.92 * lhrr)
  return Math.min(400, Math.round((trimp / (ltTrimp || 0.001)) * 100))
}

function decouplingPct(hrSeries: number[], effortSeries: number[]): number | null {
  if (!hrSeries.length || !effortSeries.length) return null
  const warmup    = Math.floor(hrSeries.length * 0.1)
  const usableHR  = hrSeries.slice(warmup)
  const usableEff = effortSeries.slice(warmup)
  if (usableHR.length < 120) return null
  const mid = Math.floor(usableHR.length / 2)
  const ratio = (hr: number[], eff: number[]) => {
    const avgEff = eff.reduce((s, v) => s + v, 0) / eff.length || 0.001
    const avgHR  = hr.reduce((s, v) => s + v, 0)  / hr.length  || 0.001
    return avgEff / avgHR
  }
  const r1 = ratio(usableHR.slice(0, mid), usableEff.slice(0, mid))
  const r2 = ratio(usableHR.slice(mid), usableEff.slice(mid))
  if (!r1) return null
  return Math.round(((r1 - r2) / r1) * 1000) / 10
}

// ── FIT parser (via esm.sh) ───────────────────────────────────────────────────

async function parseFIT(bytes: Uint8Array, ftp: number, maxHR: number) {
  const { default: FitParser } = await import('https://esm.sh/fit-file-parser@2.3.3')
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const parser = new FitParser({ force: true, speedUnit: 'm/s', lengthUnit: 'm', elapsedRecordField: true })
    parser.parse(bytes.buffer, (err: Error | null, data: Record<string, unknown>) => {
      if (err) { reject(new Error('FIT parse failed: ' + err.message)); return }
      try {
        const session = (data?.activity as Record<string, unknown>)?.sessions?.[0] || (data as Record<string, unknown>)?.sessions?.[0]
        const laps    = (session as Record<string, unknown>)?.laps as Record<string, unknown>[] | undefined
        const records = laps?.flatMap((l: Record<string, unknown>) => (l.records as Record<string, unknown>[]) || [])
          || (data as Record<string, unknown>)?.records as Record<string, unknown>[] || []

        const durationSec = (session as Record<string, unknown>)?.total_elapsed_time as number
          ?? (records.length > 1 ? (new Date(records.at(-1)!.timestamp as string).getTime() - new Date(records[0].timestamp as string).getTime()) / 1000 : 0)
        const durationMin = Math.round(durationSec / 60)
        const distanceM   = Math.round(((session as Record<string, unknown>)?.total_distance as number) || 0)

        // Power & HR streams
        const powerSeries: number[] = records.map((r: Record<string, unknown>) =>
          typeof r.power === 'number' ? r.power : (typeof r.power_watts === 'number' ? r.power_watts : 0))
        const hrSeries: number[] = records.map((r: Record<string, unknown>) =>
          typeof r.heart_rate === 'number' ? r.heart_rate : 0)
        const speedSeries: number[] = records.map((r: Record<string, unknown>) =>
          typeof r.speed === 'number' ? r.speed : 0)

        const hasPower = powerSeries.some(p => p > 0)
        const hasHR    = hrSeries.some(h => h > 0)

        const avgHR  = hasHR ? Math.round(hrSeries.filter(h => h > 0).reduce((s, v) => s + v, 0) / hrSeries.filter(h => h > 0).length) : null
        const peakHR = hasHR ? Math.max(...hrSeries) : null
        const usedMaxHR = maxHR || peakHR || 185

        // Zone distribution (HR-based)
        const zoneCounts = [0, 0, 0, 0, 0]
        hrSeries.filter(h => h > 0).forEach(hr => zoneCounts[hrZone(hr, usedMaxHR)]++)
        const total = zoneCounts.reduce((s, v) => s + v, 0) || 1
        const zones = zoneCounts.map(c => Math.round(c / total * 100))

        // TSS
        let tss: number
        let np: number | null = null
        if (hasPower && ftp) {
          np  = normalizedPower(powerSeries)
          tss = computeTSS(np, durationSec, ftp)
        } else {
          tss = estimateTSSFromHR(durationMin, avgHR!, usedMaxHR)
        }

        // Decoupling
        const dcpct = hasPower && ftp
          ? decouplingPct(hrSeries, powerSeries)
          : decouplingPct(hrSeries, speedSeries)

        const startTime = (session as Record<string, unknown>)?.start_time as string || records[0]?.timestamp as string
        const date = startTime ? new Date(startTime as string).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

        // Elevation
        const elevSeries = records.map((r: Record<string, unknown>) => typeof r.altitude === 'number' ? r.altitude : 0)
        let elevGain = 0
        for (let i = 1; i < elevSeries.length; i++) {
          if (elevSeries[i] > elevSeries[i - 1]) elevGain += elevSeries[i] - elevSeries[i - 1]
        }

        resolve({ date, durationMin, durationSec, distanceM, avgHR, peakHR, tss, np, zones, decoupling_pct: dcpct, elevationGainM: Math.round(elevGain) })
      } catch (e) { reject(new Error('FIT extraction failed: ' + (e as Error).message)) }
    })
  })
}

// ── GPX parser ────────────────────────────────────────────────────────────────

function parseGPX(xmlText: string, ftp: number, maxHR: number) {
  const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '_', parseAttributeValue: true })
  const doc  = xmlParser.parse(xmlText)
  const trk  = doc?.gpx?.trk
  const segs = Array.isArray(trk?.trkseg) ? trk.trkseg : (trk?.trkseg ? [trk.trkseg] : [])
  const points = segs.flatMap((seg: Record<string, unknown>) => {
    const pts = seg.trkpt
    return Array.isArray(pts) ? pts : (pts ? [pts] : [])
  })

  if (!points.length) throw new Error('No track points in GPX')

  const times: Date[]     = []
  const hrSamples: number[] = []
  let distanceM = 0
  let elevGain  = 0

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000, dL = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dl / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  points.forEach((pt: Record<string, unknown>, i: number) => {
    const lat = pt._lat as number, lon = pt._lon as number
    const ele = typeof pt.ele === 'number' ? pt.ele : 0
    const timeStr = pt.time as string
    const ext = pt.extensions as Record<string, unknown>
    const hr = ext?.['gpxtpx:TrackPointExtension']?.['gpxtpx:hr']
            ?? ext?.['ns3:TrackPointExtension']?.['ns3:hr']
            ?? ext?.hr
    if (hr) hrSamples.push(Number(hr))
    if (timeStr) times.push(new Date(timeStr))
    if (i > 0) {
      const prev = points[i - 1] as Record<string, unknown>
      distanceM += haversine(prev._lat as number, prev._lon as number, lat, lon)
      const prevEle = typeof prev.ele === 'number' ? prev.ele : 0
      if (ele > prevEle) elevGain += ele - prevEle
    }
  })

  const durationSec = times.length >= 2 ? (times.at(-1)!.getTime() - times[0].getTime()) / 1000 : 0
  const durationMin = Math.round(durationSec / 60)
  const avgHR  = hrSamples.length ? Math.round(hrSamples.reduce((s, v) => s + v, 0) / hrSamples.length) : null
  const peakHR = hrSamples.length ? Math.max(...hrSamples) : null
  const usedMaxHR = maxHR || peakHR || 185
  const tss   = estimateTSSFromHR(durationMin, avgHR!, usedMaxHR)

  const zoneCounts = [0, 0, 0, 0, 0]
  hrSamples.forEach(hr => zoneCounts[hrZone(hr, usedMaxHR)]++)
  const total = zoneCounts.reduce((s, v) => s + v, 0) || 1
  const zones = zoneCounts.map(c => Math.round(c / total * 100))
  const date  = times[0] ? times[0].toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

  return { date, durationMin, durationSec, distanceM: Math.round(distanceM), avgHR, peakHR, tss, np: null, zones, decoupling_pct: null, elevationGainM: Math.round(elevGain) }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(withTelemetry('parse-activity', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('authorization')
    const payload    = jwtPayload(authHeader)
    if (!payload?.sub) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const userId = payload.sub as string

    const body = await req.json() as { jobId: string; fileType?: string }
    const { jobId } = body
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: corsHeaders })
    }

    // Service client for privileged ops
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    // Anon client to verify caller owns the job
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { authorization: authHeader! } },
    })

    // Fetch job (user's own row only)
    const { data: job, error: jobErr } = await anon
      .from('activity_upload_jobs')
      .select('id, user_id, file_path, file_type, status')
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle()

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'job not found' }), { status: 404, headers: corsHeaders })
    }
    if (job.status === 'done' || job.status === 'parsing') {
      return new Response(JSON.stringify({ error: 'already processed' }), { status: 409, headers: corsHeaders })
    }

    // Mark as parsing
    await svc.from('activity_upload_jobs').update({ status: 'parsing' }).eq('id', jobId)

    // Fetch profile for FTP / maxHR
    const { data: profile } = await svc
      .from('profiles')
      .select('ftp, profile_data')
      .eq('id', userId)
      .maybeSingle()
    const ftp    = (profile?.ftp as number) || ((profile?.profile_data as Record<string, unknown>)?.ftp as number) || 0
    const maxHR  = ((profile?.profile_data as Record<string, unknown>)?.maxhr as number) || 0

    // Download file from Storage
    const { data: blob, error: dlErr } = await svc
      .storage
      .from('activity-uploads')
      .download(job.file_path as string)

    if (dlErr || !blob) {
      await svc.from('activity_upload_jobs').update({ status: 'error', error: 'storage download failed' }).eq('id', jobId)
      return new Response(JSON.stringify({ error: 'download failed' }), { status: 500, headers: corsHeaders })
    }

    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.byteLength > MAX_FILE_BYTES) {
      await svc.from('activity_upload_jobs').update({ status: 'error', error: 'file too large' }).eq('id', jobId)
      return new Response(JSON.stringify({ error: 'file too large' }), { status: 413, headers: corsHeaders })
    }

    const fileType = (job.file_type as string) || body.fileType || 'fit'

    // Parse
    let parsed: Record<string, unknown>
    try {
      if (fileType === 'gpx') {
        parsed = parseGPX(new TextDecoder().decode(bytes), ftp, maxHR)
      } else {
        parsed = await parseFIT(bytes, ftp, maxHR)
      }
    } catch (e) {
      const msg = (e as Error).message
      await svc.from('activity_upload_jobs').update({ status: 'error', error: msg }).eq('id', jobId)
      return new Response(JSON.stringify({ error: msg }), { status: 422, headers: corsHeaders })
    }

    // Determine session type from sport/file context (default Run)
    const sessionType = fileType === 'gpx' ? 'Run' : 'Ride'

    // Insert training_log row
    const { data: logRow, error: logErr } = await svc
      .from('training_log')
      .insert({
        user_id:          userId,
        date:             parsed.date,
        type:             sessionType,
        duration_min:     parsed.durationMin,
        tss:              parsed.tss,
        rpe:              null,
        zones:            parsed.zones,
        source:           'file_upload',
        source_file_path: job.file_path,
        decoupling_pct:   parsed.decoupling_pct,
      })
      .select('id')
      .maybeSingle()

    if (logErr || !logRow) {
      await svc.from('activity_upload_jobs').update({ status: 'error', error: logErr?.message || 'log insert failed' }).eq('id', jobId)
      return new Response(JSON.stringify({ error: 'log insert failed' }), { status: 500, headers: corsHeaders })
    }

    // Increment free-tier upload counter
    await svc.rpc('increment_upload_count', { p_user_id: userId }).throwOnError()
      .catch(() => { /* non-fatal if RPC doesn't exist yet */ })

    // Mark job done
    await svc.from('activity_upload_jobs').update({
      status:            'done',
      parsed_session_id: logRow.id,
      parsed_at:         new Date().toISOString(),
    }).eq('id', jobId)

    return new Response(JSON.stringify({ ok: true, logEntryId: logRow.id, parsed }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}))
