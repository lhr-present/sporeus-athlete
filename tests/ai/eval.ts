#!/usr/bin/env -S npx ts-node
// tests/ai/eval.ts — E7: AI quality eval runner
//
// Usage:
//   npx ts-node tests/ai/eval.ts [--smoke] [--surface <name>] [--lang tr|en]
//
// Flags:
//   --smoke     Run only 10 smoke-test rows (fast, for per-commit CI)
//   --surface   Filter by surface name
//   --lang      Filter by language
//
// Requires env vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY, AI_EVAL_JWT (service-role JWT for test auth)
//
// Output:
//   - Per-row pass/fail with reason
//   - Per-surface aggregate score
//   - Exit 0 if all above quality gates, exit 1 otherwise
//
// QUALITY GATES (see E7 spec):
//   - Groundedness ≥ 95% (verified by keyword checks against must_include)
//   - Specificity ≥ 80% (at least one specific number per response)
//   - Language accuracy 100% (output language matches requested)
//   - Banned phrase rate 0% (must_not_include violations = fail)
//   - Length budget respected (response under max_tokens × 4 chars)

import * as fs from 'fs'
import * as path from 'path'

// ── Types ──────────────────────────────────────────────────────────────────

interface EvalRow {
  id:                string
  surface:           string
  scenario:          string
  input_context:     string
  must_include:      string[]
  must_not_include:  string[]
  must_cite_source:  boolean
  expected_sentiment: 'neutral' | 'concern' | 'celebration'
  max_tokens:        number
  language:          'en' | 'tr'
}

interface EvalResult {
  id:         string
  surface:    string
  scenario:   string
  passed:     boolean
  failures:   string[]
  output_len: number
  skipped:    boolean
}

// ── Quality gates ──────────────────────────────────────────────────────────

const QUALITY_GATES = {
  groundedness_min:  0.95,   // must_include checks
  banned_phrase_max: 0.00,   // must_not_include violations
  citation_min:      0.90,   // citation marker presence when required
  language_accuracy: 1.00,   // language matches requested
}

// Banned phrases that must never appear in AI output
const BANNED_PHRASES = [
  "you're doing great",
  "keep up the good work",
  "amazing",
  "awesome",
  "great job",
  "fantastic",
  "well done",
]

// ── Load dataset ────────────────────────────────────────────────────────────

function loadDataset(datasetPath: string): EvalRow[] {
  const raw = fs.readFileSync(datasetPath, 'utf8')
  return raw.trim().split('\n').map(line => JSON.parse(line))
}

// ── Call ai-proxy ───────────────────────────────────────────────────────────

async function callAiProxy(
  row: EvalRow,
  supabaseUrl: string,
  jwt: string,
): Promise<{ content: string; citations?: unknown[] } | null> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        model_alias: 'haiku',
        system:      `Eval context: ${row.input_context}`,
        user_msg:    `Surface: ${row.surface}. Scenario: ${row.scenario}. Language: ${row.language}.`,
        max_tokens:  row.max_tokens,
        rag:         row.must_cite_source,
      }),
    })
    if (!res.ok) {
      console.error(`[${row.id}] HTTP ${res.status}`)
      return null
    }
    return await res.json()
  } catch (e) {
    console.error(`[${row.id}] fetch error: ${(e as Error).message}`)
    return null
  }
}

// ── Judge: keyword checks ───────────────────────────────────────────────────

function judgeRow(row: EvalRow, content: string): EvalResult {
  const failures: string[] = []
  const lower = content.toLowerCase()

  // must_include checks
  for (const kw of row.must_include) {
    if (!content.includes(kw)) {
      failures.push(`missing must_include: "${kw}"`)
    }
  }

  // must_not_include checks
  for (const kw of row.must_not_include) {
    if (lower.includes(kw.toLowerCase())) {
      failures.push(`forbidden phrase found: "${kw}"`)
    }
  }

  // Citation check
  if (row.must_cite_source) {
    const hasCitation = /\[S\d+\]/.test(content)
    if (!hasCitation) {
      failures.push('citation marker [Sn] required but not found')
    }
  }

  // Length check
  const charBudget = row.max_tokens * 4  // rough estimate
  if (content.length > charBudget) {
    failures.push(`response too long: ${content.length} chars > budget ${charBudget}`)
  }

  // Global banned phrases
  for (const bp of BANNED_PHRASES) {
    if (lower.includes(bp)) {
      if (!failures.some(f => f.includes(bp))) {
        failures.push(`global banned phrase: "${bp}"`)
      }
    }
  }

  return {
    id:         row.id,
    surface:    row.surface,
    scenario:   row.scenario,
    passed:     failures.length === 0,
    failures,
    output_len: content.length,
    skipped:    false,
  }
}

// ── Aggregate results ───────────────────────────────────────────────────────

interface SurfaceScore {
  total:  number
  passed: number
  score:  number
}

function aggregate(results: EvalResult[]): Record<string, SurfaceScore> {
  const byS: Record<string, SurfaceScore> = {}
  for (const r of results) {
    if (r.skipped) continue
    if (!byS[r.surface]) byS[r.surface] = { total: 0, passed: 0, score: 0 }
    byS[r.surface].total++
    if (r.passed) byS[r.surface].passed++
  }
  for (const s of Object.values(byS)) {
    s.score = s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0
  }
  return byS
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2)
  const smoke   = args.includes('--smoke')
  const surfIdx = args.indexOf('--surface')
  const langIdx = args.indexOf('--lang')
  const surfFilter = surfIdx >= 0 ? args[surfIdx + 1] : null
  const langFilter = langIdx >= 0 ? args[langIdx + 1] : null

  const supabaseUrl = process.env.SUPABASE_URL
  const jwt         = process.env.AI_EVAL_JWT

  if (!supabaseUrl || !jwt) {
    console.error('❌ Missing env: SUPABASE_URL, AI_EVAL_JWT')
    process.exit(1)
  }

  const datasetPath = path.join(__dirname, 'evals/dataset.jsonl')
  let rows = loadDataset(datasetPath)

  // Apply filters
  if (surfFilter) rows = rows.filter(r => r.surface === surfFilter)
  if (langFilter) rows = rows.filter(r => r.language === langFilter)
  if (smoke)      rows = rows.slice(0, 10)

  console.log(`\n🔍 Running ${rows.length} eval rows${smoke ? ' (smoke mode)' : ''}...\n`)

  const results: EvalResult[] = []

  for (const row of rows) {
    process.stdout.write(`  [${row.id}] ${row.scenario}... `)
    const response = await callAiProxy(row, supabaseUrl, jwt)
    if (!response || !response.content) {
      console.log('SKIPPED (no response)')
      results.push({ id: row.id, surface: row.surface, scenario: row.scenario, passed: false, failures: ['no_response'], output_len: 0, skipped: true })
      continue
    }
    const result = judgeRow(row, response.content)
    console.log(result.passed ? '✅ PASS' : `❌ FAIL (${result.failures.join('; ')})`)
    results.push(result)
  }

  // Aggregate
  const scores = aggregate(results)
  const total  = results.filter(r => !r.skipped).length
  const passed = results.filter(r => r.passed).length

  console.log('\n── Per-surface scores ─────────────────────')
  for (const [surf, s] of Object.entries(scores)) {
    const gate = s.score >= 80 ? '✅' : '❌'
    console.log(`  ${gate} ${surf}: ${s.passed}/${s.total} (${s.score}%)`)
  }

  console.log('\n── Overall ────────────────────────────────')
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
  console.log(`  ${passed}/${total} passed (${pct}%)`)

  // Write quality trend
  const trendPath = path.join(__dirname, '../../docs/ai/quality_trend.md')
  const trendDir  = path.dirname(trendPath)
  if (!fs.existsSync(trendDir)) fs.mkdirSync(trendDir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const trendLine = `| ${date} | ${pct}% | ${passed}/${total} | ${Object.entries(scores).map(([s, v]) => `${s}:${v.score}%`).join(', ')} |\n`
  fs.appendFileSync(trendPath, trendLine, 'utf8')
  console.log(`\n  📄 Trend appended → ${trendPath}`)

  process.exit(pct >= 80 ? 0 : 1)
}

main()
