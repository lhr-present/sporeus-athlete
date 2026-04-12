// ─── aiPrompts.js — Claude API integration via server-side ai-proxy ───────────
// All Claude calls go through supabase/functions/ai-proxy. The Anthropic API key
// never reaches the browser. Tier enforcement is authoritative on the server.
//
// Cache strategy (two-tier):
//   Primary:  Supabase `ai_insights` table (athlete_id, date, data_hash, insight_json, model, created_at)
//   Fallback: localStorage — used when Supabase is offline or unavailable.

import { supabase, isSupabaseReady } from './supabase.js'
import { getTierSync, canUseAI } from './subscription.js'

// Model aliases (resolved to actual IDs in the edge function)
const MODEL_HAIKU  = 'haiku'   // maps to claude-haiku-4-5-20251001 in proxy
const MODEL_SONNET = 'sonnet'  // maps to claude-sonnet-4-5 in proxy

const CACHE_PREFIX  = 'sporeus-ai-'
const CACHE_TTL_MS  = 8 * 3600_000  // 8h for localStorage fallback

// ─── djb2 hash ────────────────────────────────────────────────────────────────
export function getInputHash(data) {
  const str = JSON.stringify(data)
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
    h = h & h  // keep 32-bit
  }
  return (h >>> 0).toString(16)
}

// ─── localStorage fallback cache ───────────────────────────────────────────────
function lsRead(hash) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + hash)
    if (!raw) return null
    const { v, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + hash)
      return null
    }
    return v
  } catch { return null }
}

function lsWrite(hash, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + hash, JSON.stringify({ v: value, ts: Date.now() }))
  } catch {}
}

// ─── Supabase ai_insights cache ────────────────────────────────────────────────
// Table schema:
//   athlete_id  TEXT NOT NULL
//   date        TEXT NOT NULL  (YYYY-MM-DD)
//   data_hash   TEXT NOT NULL
//   insight_json JSONB NOT NULL
//   model       TEXT
//   created_at  TIMESTAMPTZ DEFAULT now()
//   PRIMARY KEY (athlete_id, date, data_hash)

async function sbRead(athleteId, date, dataHash) {
  if (!isSupabaseReady() || !athleteId) return null
  try {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('insight_json')
      .eq('athlete_id', athleteId)
      .eq('date', date)
      .eq('data_hash', dataHash)
      .maybeSingle()
    if (error || !data) return null
    return data.insight_json
  } catch { return null }
}

async function sbWrite(athleteId, date, dataHash, value, model) {
  if (!isSupabaseReady() || !athleteId) return
  try {
    await supabase.from('ai_insights').upsert({
      athlete_id:   athleteId,
      date,
      data_hash:    dataHash,
      insight_json: value,
      model,
    }, { onConflict: 'athlete_id,date,data_hash' })
  } catch {}
}

// ─── Unified read/write (Supabase first, localStorage fallback) ───────────────
async function readCache(hash, athleteId, date) {
  const sbResult = await sbRead(athleteId, date, hash)
  if (sbResult !== null) return sbResult
  return lsRead(hash)
}

async function writeCache(hash, value, athleteId, date, model) {
  lsWrite(hash, value)
  await sbWrite(athleteId, date, hash, value, model)
}

// ─── clearInsightCache — remove all cached insights for an athlete ─────────────
export async function clearInsightCache(athleteId) {
  // Clear Supabase rows
  if (isSupabaseReady() && athleteId) {
    try {
      await supabase.from('ai_insights').delete().eq('athlete_id', athleteId)
    } catch {}
  }
  // Clear matching localStorage keys
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
    keys.forEach(k => localStorage.removeItem(k))
  } catch {}
}

// ─── JSON parser (strips markdown fences) ─────────────────────────────────────
function parseJSON(text) {
  try {
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch { return null }
}

// ─── Schema validator ─────────────────────────────────────────────────────────
function validateSchema(obj, required = []) {
  return obj && typeof obj === 'object' && required.every(k => k in obj)
}

// ── AI call counter (daily, localStorage) ─────────────────────────────────────
function getDailyCallCount() {
  try {
    const raw = localStorage.getItem('sporeus-ai-calls')
    const { date, count } = JSON.parse(raw || '{}')
    const today = new Date().toISOString().slice(0, 10)
    return date === today ? (count || 0) : 0
  } catch { return 0 }
}

function incrementDailyCallCount() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const count = getDailyCallCount() + 1
    localStorage.setItem('sporeus-ai-calls', JSON.stringify({ date: today, count }))
  } catch {}
}

// ─── Core proxy call ──────────────────────────────────────────────────────────
// Routes through supabase/functions/ai-proxy — key stays server-side.
async function callClaude(model, system, user, maxTokens = 512) {
  // Client-side UX gate (non-authoritative — server re-enforces)
  const tier = getTierSync()
  const dailyCalls = getDailyCallCount()
  if (!canUseAI(dailyCalls, tier)) {
    throw new Error(`AI call limit reached for ${tier} plan. Upgrade at sporeus.com.`)
  }

  if (!isSupabaseReady()) throw new Error('Not connected — sign in to use AI features')

  const modelAlias = model.includes('haiku') ? 'haiku' : 'sonnet'

  // supabase.functions.invoke auto-injects the current session JWT
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { model_alias: modelAlias, system, user_msg: user, max_tokens: maxTokens },
  })

  if (error) throw new Error(error.message || 'AI proxy error')
  if (data?.error) throw new Error(data.error)
  if (!data?.content) throw new Error('Empty response from AI')

  incrementDailyCallCount()
  return data.content
}

// ─── 1. generateDailySummary ──────────────────────────────────────────────────
// Nightly batch, cached. Returns { summary: string, ctl, tsb, acwr }.
export async function generateDailySummary(athlete) {
  const date = new Date().toISOString().slice(0, 10)
  const hash = getInputHash({ fn: 'daily', id: athlete.id, date })
  const cached = await readCache(hash, athlete.id, date)
  if (cached) return cached

  const system = `You are a sport science assistant. Generate concise daily athlete summaries.
Output ONLY valid JSON: {"summary": string, "ctl": number, "tsb": number, "acwr": number|null}
Three-sentence summary: (1) load trend, (2) readiness interpretation, (3) tomorrow's recommendation.
Plain language. Under 80 words.`

  const user = `Athlete data: ${JSON.stringify({
    name:    athlete.name,
    sport:   athlete.sport,
    ctl:     athlete.today_ctl,
    tsb:     athlete.today_tsb,
    acwr:    athlete.acwr_ratio,
    wellness: athlete.adherence_pct,
  })}`

  const text   = await callClaude(MODEL_HAIKU, system, user, 256)
  const result = parseJSON(text)
  if (!validateSchema(result, ['summary'])) throw new Error('Invalid daily summary response')

  await writeCache(hash, result, athlete.id, date, MODEL_HAIKU)
  return result
}

// ─── 2. generateWeeklyDigest ──────────────────────────────────────────────────
// Sunday night cron. Returns { text: string }.
export async function generateWeeklyDigest(squad) {
  const date = getWeekKey()
  const hash = getInputHash({ fn: 'digest', week: date, ids: squad.map(a => a.id).sort() })
  // Squad digest is not per-athlete; use first athlete id or 'squad' as key
  const athleteId = squad[0]?.id || 'squad'
  const cached = await readCache(hash, athleteId, date)
  if (cached) return cached

  const system = `You are an endurance coach assistant. Generate a concise weekly squad digest.
Output ONLY valid JSON: {"text": string}
Format: "WEEK SUMMARY: [sentence]\nSTAND-OUT: [athlete name + why]\nALERT: [any concern]\nNEXT WEEK: [recommendation]"
Under 120 words. No markdown.`

  const user = `Squad data (${squad.length} athletes): ${JSON.stringify(
    squad.map(a => ({ name: a.name, ctl: a.today_ctl, tsb: a.today_tsb, acwr: a.acwr_ratio, well: a.adherence_pct }))
  )}`

  const text   = await callClaude(MODEL_HAIKU, system, user, 300)
  const result = parseJSON(text)
  if (!validateSchema(result, ['text'])) throw new Error('Invalid weekly digest response')

  await writeCache(hash, result, athleteId, date, MODEL_HAIKU)
  return result
}

// ─── 3. generateInjuryRisk ───────────────────────────────────────────────────
// Weekly per athlete. Returns { risk_score, risk_level, primary_factor, recommendation }.
export async function generateInjuryRisk(athlete) {
  const date = getWeekKey()
  const hash = getInputHash({ fn: 'risk', id: athlete.id, week: date })
  const cached = await readCache(hash, athlete.id, date)
  if (cached) return cached

  const system = `You are a sports medicine assistant. Calculate injury risk from training load data.
Output ONLY valid JSON: {"risk_score": number (0-100), "risk_level": "low"|"moderate"|"high", "primary_factor": string, "recommendation": string}`

  const user = `Athlete training load:
ACWR: ${athlete.acwr_ratio ?? '—'} (optimal: 0.8–1.3)
Monotony: ${athlete.monotony ?? '—'} (flag if >2.0)
Strain: ${athlete.strain ?? '—'}
Wellness trend (14d): ${athlete.wellness_trend ?? '—'}
TSS change WoW: ${athlete.tss_change_pct ?? '—'}%`

  const text   = await callClaude(MODEL_HAIKU, system, user, 200)
  const result = parseJSON(text)
  if (!validateSchema(result, ['risk_score', 'risk_level', 'primary_factor', 'recommendation'])) {
    throw new Error('Invalid injury risk response')
  }

  await writeCache(hash, result, athlete.id, date, MODEL_HAIKU)
  return result
}

// ─── 4. generateAnomalyFlag ───────────────────────────────────────────────────
// Called on every check-in submit. Returns { anomaly, severity, flag, recommendation }.
export async function generateAnomalyFlag(athlete, submission) {
  const date = submission.date
  const hash = getInputHash({ fn: 'anomaly', id: athlete.id, date })
  const cached = await readCache(hash, athlete.id, date)
  if (cached) return cached

  const system = `You are a sport science assistant. Detect wellness anomalies vs personal baseline.
Output ONLY valid JSON: {"anomaly": boolean, "severity": "none"|"mild"|"significant", "flag": string|null, "recommendation": string}`

  const user = `28-day baseline: mean=${athlete.baseline_mean}/100, sd=${athlete.baseline_sd}
Today's check-in: score=${submission.score}/100 (sleep=${submission.sleep}, energy=${submission.energy}, soreness=${submission.soreness})
ACWR: ${athlete.acwr_ratio ?? '—'}, days since last rest: ${athlete.days_no_rest ?? '—'}`

  const text   = await callClaude(MODEL_HAIKU, system, user, 200)
  const result = parseJSON(text)
  if (!validateSchema(result, ['anomaly', 'severity', 'recommendation'])) {
    throw new Error('Invalid anomaly flag response')
  }

  await writeCache(hash, result, athlete.id, date, MODEL_HAIKU)
  return result
}

// ─── 5. generateTrainingPlan ──────────────────────────────────────────────────
// Coach/solo trigger. Returns a full plan object matching Sporeus plan schema.
export async function generateTrainingPlan(params) {
  const date = new Date().toISOString().slice(0, 10)
  const hash = getInputHash({ fn: 'plan', ...params })
  const athleteId = params.athleteId || params.userId || 'plan'
  const cached = await readCache(hash, athleteId, date)
  if (cached) return cached

  const system = `You are an expert periodization coach. Generate a structured endurance training plan.
Output ONLY valid JSON matching this schema exactly:
{
  "goal": string, "level": string, "hoursPerWeek": number, "generatedAt": "YYYY-MM-DD",
  "weeks": [{
    "phase": "base"|"build"|"peak"|"taper"|"competition"|"transition",
    "sessions": [
      {"type": string, "duration": number, "rpe": number, "tss": number,
       "zone": string, "zoneIdx": number, "color": string, "description": string}
    ]
  }]
}
Sessions array has exactly 7 items (Mon–Sun). Rest days: type="Rest", duration=0, tss=0, rpe=0, zoneIdx=0.`

  const user = `Generate a ${params.weeks}-week plan for a ${params.level} ${params.sport} athlete.
Goal: ${params.goal} | Hours/week: ${params.hoursPerWeek} | FTP: ${params.ftp || '?'}W | VO2max: ${params.vo2max || '?'}
Target race: ${params.raceDate || 'none'}`

  const text   = await callClaude(MODEL_SONNET, system, user, 4096)
  const result = parseJSON(text)
  if (!validateSchema(result, ['goal', 'weeks', 'generatedAt'])) {
    throw new Error('Invalid training plan response')
  }

  await writeCache(hash, result, athleteId, date, MODEL_SONNET)
  return result
}

// ─── 6. coachChatMessage ──────────────────────────────────────────────────────
// Streaming-ready. Returns { reply: string }. Not cached (conversational).
export async function coachChatMessage(squad, question) {
  const system = `You are an expert endurance coach assistant with deep knowledge of periodization, sport physiology, and athlete development. Answer questions about the squad data provided.
Output ONLY valid JSON: {"reply": string}
Be concise and practical. Reference specific data when relevant. Under 150 words unless more is clearly needed.`

  const user = `Squad context (${squad.length} athletes):
${squad.map(a => `${a.name}: CTL=${a.today_ctl}, TSB=${a.today_tsb}, ACWR=${a.acwr_ratio ?? '—'}, Well=${a.adherence_pct}%`).join('\n')}

Coach question: ${question}`

  const text   = await callClaude(MODEL_SONNET, system, user, 512)
  const result = parseJSON(text)
  if (!validateSchema(result, ['reply'])) throw new Error('Invalid chat response')

  return result
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getWeekKey() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}
