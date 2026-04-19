#!/usr/bin/env node
// scripts/checkBundleSize.js
// E15 — Post-build bundle size guard. Reads dist/assets/, checks gzip vs budgets.
// Exits 1 if any budget is exceeded.
// Pure logic is exported for unit tests.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { gzipSizeSync } from 'gzip-size'
import { BUNDLE_BUDGETS } from '../src/lib/observability/performanceBudget.js'

// ── Pure logic (exported for tests) ──────────────────────────────────────────

/**
 * @param {{ name: string, rawBytes: number, gzipBytes: number, type: 'main'|'chunk'|'css'|'asset' }[]} files
 * @param {typeof BUNDLE_BUDGETS} budgets
 * @returns {{ rows: object[], pass: boolean, totalGzipKB: number, report: string }}
 */
export function checkBundles(files, budgets) {
  const rows = []
  let totalGzipKB = 0
  let pass = true

  for (const f of files) {
    if (f.type === 'asset') continue   // images/fonts — not in JS/CSS budgets
    const gzipKB = f.gzipBytes / 1024
    totalGzipKB += gzipKB

    let budget = null
    if (f.type === 'main')  budget = budgets.mainBundleGzipMaxKB
    if (f.type === 'chunk') budget = budgets.perChunkGzipMaxKB
    if (f.type === 'css')   budget = budgets.cssGzipMaxKB

    const ok = budget == null || gzipKB <= budget
    if (!ok) pass = false

    rows.push({
      name: f.name,
      type: f.type,
      rawKB: (f.rawBytes / 1024).toFixed(1),
      gzipKB: gzipKB.toFixed(1),
      budget: budget ? `${budget} KB` : '—',
      status: budget == null ? '—' : (ok ? 'PASS' : 'FAIL'),
    })
  }

  if (totalGzipKB > budgets.totalGzipMaxKB) pass = false

  const report = buildReport(rows, totalGzipKB, budgets.totalGzipMaxKB, pass)
  return { rows, pass, totalGzipKB: +totalGzipKB.toFixed(1), report }
}

function buildReport(rows, totalGzipKB, totalBudget, pass) {
  const header = `\n${'Name'.padEnd(50)} ${'Raw'.padStart(8)} ${'Gzip'.padStart(8)} ${'Budget'.padStart(8)} ${'Status'.padStart(6)}`
  const sep = '-'.repeat(header.length)
  const lines = rows.map(r =>
    `${r.name.padEnd(50)} ${(r.rawKB + ' KB').padStart(8)} ${(r.gzipKB + ' KB').padStart(8)} ${r.budget.padStart(8)} ${r.status.padStart(6)}`
  )
  const total = `\n${'TOTAL (JS+CSS gzip)'.padEnd(50)} ${' '.padStart(8)} ${(totalGzipKB.toFixed(1) + ' KB').padStart(8)} ${(totalBudget + ' KB').padStart(8)} ${(totalGzipKB <= totalBudget ? 'PASS' : 'FAIL').padStart(6)}`
  const verdict = pass ? '\n✓ All bundle budgets met.' : '\n✗ Bundle budget exceeded — see FAIL rows above.'
  return [header, sep, ...lines, sep, total, verdict].join('\n')
}

// ── File type classification ───────────────────────────────────────────────────

function classifyFile(name) {
  const ext = extname(name).toLowerCase()
  if (ext === '.css') return 'css'
  if (ext !== '.js' && ext !== '.mjs') return 'asset'
  // Vite main entry: index-[hash].js
  if (/^index-[a-z0-9]+\.js$/.test(name)) return 'main'
  return 'chunk'
}

// ── CLI entry point — only runs when executed directly, not when imported ─────
import { pathToFileURL } from 'node:url'

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = new URL('../dist/assets', import.meta.url).pathname

  try {
    readdirSync(distDir)
  } catch {
    console.error('✗ dist/assets not found — run npm run build first')
    process.exit(1)
  }

  const files = readdirSync(distDir)
    .filter(name => !statSync(join(distDir, name)).isDirectory())
    .map(name => {
      const raw = readFileSync(join(distDir, name))
      return {
        name,
        rawBytes:  raw.length,
        gzipBytes: gzipSizeSync(raw),
        type:      classifyFile(name),
      }
    })

  const { report, pass } = checkBundles(files, BUNDLE_BUDGETS)
  console.log(report)
  process.exit(pass ? 0 : 1)
}
