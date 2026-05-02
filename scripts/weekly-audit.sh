#!/usr/bin/env bash
# scripts/weekly-audit.sh
# ──────────────────────────────────────────────────────────────────────────────
# Sporeus weekly self-audit — NO LLM, NO NETWORK, INFORMATIONAL ONLY.
#
# Pure bash + grep + node. Produces a markdown report under audit-reports/
# that a human reviews to decide whether to spend LLM tokens on fixes.
#
# Sections:
#   1. Header (branch / commit / tests / bundle)
#   2. Coverage gaps (pure-function libs without tests)
#   3. A11y gaps (buttons / svg / modals)
#   4. Bundle drift (vs E15 perf budget)
#   5. Stale files (90+ days untouched)
#   6. TODO / FIXME / HACK / XXX count
#
# Exit:
#   0 — script ran successfully (regardless of findings)
#   1 — script itself failed (missing dirs, bad env)
# ──────────────────────────────────────────────────────────────────────────────

set -u  # treat unset vars as errors; do NOT use -e (we want to continue on grep no-match)

# ── Locate repo root ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || { echo "FATAL: cannot cd to $REPO_ROOT" >&2; exit 1; }

# ── Sanity checks ─────────────────────────────────────────────────────────────
if [ ! -d "src" ]; then
  echo "FATAL: src/ directory missing in $REPO_ROOT" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "FATAL: node not on PATH" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "FATAL: npm not on PATH" >&2
  exit 1
fi

# ── Output paths ──────────────────────────────────────────────────────────────
TODAY="$(date -u +%Y-%m-%d)"
NOW_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
REPORT_DIR="$REPO_ROOT/audit-reports"
REPORT_FILE="$REPORT_DIR/audit-$TODAY.md"
mkdir -p "$REPORT_DIR" || { echo "FATAL: cannot create $REPORT_DIR" >&2; exit 1; }

# Use a temp file then atomically move into place so partial reports never linger
TMP_REPORT="$(mktemp -t sporeus-audit-XXXXXX.md)"
trap 'rm -f "$TMP_REPORT"' EXIT

# ── Helpers ───────────────────────────────────────────────────────────────────
emit() { printf '%s\n' "$*" >> "$TMP_REPORT"; }

# Returns 0 if the line/file should be ignored (test fixtures, generated, etc.)
is_excluded_path() {
  case "$1" in
    *.test.js|*.test.jsx|*__tests__*|*/test/*|*/dist/*|*/node_modules/*|*/.git/*) return 0 ;;
  esac
  return 1
}

# ── Section 1: Header ─────────────────────────────────────────────────────────
emit "# Sporeus weekly audit — $TODAY"
emit ""
emit "_Generated $NOW_UTC by \`scripts/weekly-audit.sh\` (no LLM, no network)._"
emit ""
emit "## 1. Header"
emit ""

GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
GIT_COMMIT="$(git log -1 --pretty=format:'%h %s' 2>/dev/null || echo 'unknown')"
GIT_AUTHOR="$(git log -1 --pretty=format:'%an <%ae> (%ar)' 2>/dev/null || echo 'unknown')"
emit "- **Branch**: \`$GIT_BRANCH\`"
emit "- **Latest commit**: $GIT_COMMIT"
emit "- **Author**: $GIT_AUTHOR"

# Test count — try the lightweight path first; fall back to a count of describe/it occurrences
# We deliberately do NOT run the full suite here (that would blow past the 60s budget).
TEST_FILE_COUNT="$(find src -type f \( -name '*.test.js' -o -name '*.test.jsx' \) 2>/dev/null | wc -l | tr -d ' ')"
TEST_BLOCK_COUNT="$(grep -rE "^\s*(it|test)\(" src --include='*.test.js' --include='*.test.jsx' 2>/dev/null | wc -l | tr -d ' ')"
emit "- **Test files**: $TEST_FILE_COUNT"
emit "- **Test blocks (\`it(\` + \`test(\`)**: $TEST_BLOCK_COUNT"

# Bundle summary — only meaningful if dist/ exists
if [ -d "dist/assets" ]; then
  MAIN_BUNDLE="$(ls dist/assets/index-*.js 2>/dev/null | head -1)"
  if [ -n "$MAIN_BUNDLE" ]; then
    MAIN_RAW_KB="$(du -k "$MAIN_BUNDLE" | awk '{print $1}')"
    JS_COUNT="$(ls dist/assets/*.js 2>/dev/null | wc -l | tr -d ' ')"
    TOTAL_RAW_KB="$(du -ck dist/assets/*.js 2>/dev/null | tail -1 | awk '{print $1}')"
    emit "- **Main bundle (raw)**: $(basename "$MAIN_BUNDLE") — ${MAIN_RAW_KB} KB"
    emit "- **JS chunks**: $JS_COUNT files, ${TOTAL_RAW_KB} KB total raw"
  else
    emit "- **Bundle**: dist/assets present but no \`index-*.js\` found"
  fi
else
  emit "- **Bundle**: \`dist/\` not built — run \`npm run build\` for bundle drift section"
fi
emit ""

# ── Section 2: Coverage gaps ──────────────────────────────────────────────────
emit "## 2. Coverage gaps"
emit ""
emit "Pure-function lib files in \`src/lib/\` with no matching test reference."
emit "Known infra / side-effect files are excluded."
emit ""

COVERAGE_TMP="$(mktemp)"
COVERAGE_COUNT=0
while IFS= read -r f; do
  base="$(basename "$f" .js)"
  # skip empty (find may yield none)
  [ -z "$f" ] && continue
  # Known infra / side-effect / DB files — same list as task spec
  case "$f" in
    */activityUpload.js|*/cloudSync.js|*/telemetry.js|*/pushNotifications.js|*/gdprExport.js|*/deviceSync.js|*/offlineQueue.js|*/digestEmail.js|*/db/*|*/whiteLabel.js|*/reportGenerator.js)
      continue ;;
  esac
  # Look for any test file mentioning this basename
  if ! grep -rlE "\\b${base}\\b" src --include='*.test.js' --include='*.test.jsx' >/dev/null 2>&1; then
    LINES="$(wc -l < "$f" | tr -d ' ')"
    printf -- "  - \`%s\` (%s lines)\n" "$f" "$LINES" >> "$COVERAGE_TMP"
    COVERAGE_COUNT=$((COVERAGE_COUNT + 1))
  fi
done < <(find src/lib -type f -name '*.js' ! -name '*.test.js' ! -path '*__tests__*' 2>/dev/null)

if [ "$COVERAGE_COUNT" -eq 0 ]; then
  emit "_No coverage gaps detected._"
else
  emit "Found **$COVERAGE_COUNT** lib files with no matching test reference:"
  emit ""
  cat "$COVERAGE_TMP" >> "$TMP_REPORT"
fi
rm -f "$COVERAGE_TMP"
emit ""

# ── Section 3: A11y gaps ──────────────────────────────────────────────────────
emit "## 3. A11y gaps"
emit ""
emit "Heuristic grep — false positives possible. Manual review required before fixing."
emit ""

# 3a. Buttons without aria-label / aria-labelledby / visible text
# Grep for opening <button tags split into two patterns: no aria-label AND no aria-labelledby.
# We surface lines and let the human eyeball whether the button has text content.
BTN_TMP="$(mktemp)"
grep -rnE '<button[^>]*>' src --include='*.jsx' 2>/dev/null \
  | grep -v -E 'aria-label=|aria-labelledby=' \
  | grep -v -E '__tests__|\.test\.' \
  > "$BTN_TMP" || true
BTN_COUNT="$(wc -l < "$BTN_TMP" | tr -d ' ')"

emit "### 3a. \`<button>\` without \`aria-label\` / \`aria-labelledby\`"
emit ""
if [ "$BTN_COUNT" -eq 0 ]; then
  emit "_None._"
else
  emit "Count: **$BTN_COUNT** (showing first 10):"
  emit ""
  emit '```'
  head -10 "$BTN_TMP" >> "$TMP_REPORT"
  emit '```'
fi
rm -f "$BTN_TMP"
emit ""

# 3b. <svg> without role="img" or aria-label
SVG_TMP="$(mktemp)"
grep -rnE '<svg[^>]*>' src --include='*.jsx' 2>/dev/null \
  | grep -v -E 'role="img"|aria-label=|aria-hidden="true"' \
  | grep -v -E '__tests__|\.test\.' \
  > "$SVG_TMP" || true
SVG_COUNT="$(wc -l < "$SVG_TMP" | tr -d ' ')"

emit "### 3b. \`<svg>\` without \`role=\"img\"\`, \`aria-label\`, or \`aria-hidden\`"
emit ""
if [ "$SVG_COUNT" -eq 0 ]; then
  emit "_None._"
else
  emit "Count: **$SVG_COUNT** (showing first 10):"
  emit ""
  emit '```'
  head -10 "$SVG_TMP" >> "$TMP_REPORT"
  emit '```'
fi
rm -f "$SVG_TMP"
emit ""

# 3c. Modals without useFocusTrap import
MODAL_TMP="$(mktemp)"
{
  # Files literally named *Modal.jsx
  find src -type f -name '*Modal.jsx' 2>/dev/null
  # Files containing role="dialog"
  grep -rlE 'role="dialog"' src --include='*.jsx' 2>/dev/null
} | sort -u > "$MODAL_TMP"

MODAL_MISS_TMP="$(mktemp)"
while IFS= read -r mf; do
  [ -z "$mf" ] && continue
  if is_excluded_path "$mf"; then continue; fi
  if ! grep -qE 'useFocusTrap' "$mf" 2>/dev/null; then
    printf -- "  - \`%s\`\n" "$mf" >> "$MODAL_MISS_TMP"
  fi
done < "$MODAL_TMP"
MODAL_MISS_COUNT="$(wc -l < "$MODAL_MISS_TMP" | tr -d ' ')"

emit "### 3c. Modals without \`useFocusTrap\` import"
emit ""
if [ "$MODAL_MISS_COUNT" -eq 0 ]; then
  emit "_None._"
else
  emit "Count: **$MODAL_MISS_COUNT**:"
  emit ""
  cat "$MODAL_MISS_TMP" >> "$TMP_REPORT"
fi
rm -f "$MODAL_TMP" "$MODAL_MISS_TMP"
emit ""

# ── Section 4: Bundle drift ───────────────────────────────────────────────────
emit "## 4. Bundle drift (vs E15 perf budget)"
emit ""
emit "Budgets: main \`<= 250 KB\` gzip, any chunk \`<= 500 KB\` gzip, CSS \`<= 80 KB\` gzip."
emit ""

if [ -d "dist/assets" ]; then
  # Use node to compute gzipped sizes against the same budgets used by checkBundleSize.js.
  # We do NOT call checkBundleSize.js directly because it exits 1 on overage and that would
  # break our atomic "audit always exits 0" contract. Instead we replicate its logic here.
  BUNDLE_OUT="$(node --input-type=module -e '
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, extname } from "node:path"
import { gzipSizeSync } from "gzip-size"
import { BUNDLE_BUDGETS } from "./src/lib/observability/performanceBudget.js"

const dir = "dist/assets"
let files
try { files = readdirSync(dir) } catch { console.log("ERROR: dist/assets missing"); process.exit(0) }

const rows = []
let totalGzipKB = 0
for (const name of files) {
  const p = join(dir, name)
  if (statSync(p).isDirectory()) continue
  const ext = extname(name).toLowerCase()
  if (ext !== ".js" && ext !== ".mjs" && ext !== ".css") continue
  const raw = readFileSync(p)
  const gzipKB = gzipSizeSync(raw) / 1024
  totalGzipKB += gzipKB
  let type = "chunk"
  if (ext === ".css") type = "css"
  else if (/^index-[a-z0-9]+\.(js|mjs)$/i.test(name)) type = "main"
  let budget = null
  if (type === "main") budget = BUNDLE_BUDGETS.mainBundleGzipMaxKB
  if (type === "chunk") budget = BUNDLE_BUDGETS.perChunkGzipMaxKB
  if (type === "css") budget = BUNDLE_BUDGETS.cssGzipMaxKB
  rows.push({ name, type, gzipKB: gzipKB.toFixed(1), budget, over: budget != null && gzipKB > budget })
}

const overages = rows.filter(r => r.over)
console.log(JSON.stringify({
  totalGzipKB: +totalGzipKB.toFixed(1),
  totalBudget: BUNDLE_BUDGETS.totalGzipMaxKB,
  totalOver: totalGzipKB > BUNDLE_BUDGETS.totalGzipMaxKB,
  fileCount: rows.length,
  overages,
  top5: rows.sort((a, b) => +b.gzipKB - +a.gzipKB).slice(0, 5)
}))
' 2>&1)" || BUNDLE_OUT="ERROR: $BUNDLE_OUT"

  if echo "$BUNDLE_OUT" | grep -q '^ERROR:'; then
    emit "_Bundle analysis failed:_ \`$BUNDLE_OUT\`"
  else
    TOTAL_KB="$(echo "$BUNDLE_OUT" | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); console.log(j.totalGzipKB)})')"
    TOTAL_BUDGET="$(echo "$BUNDLE_OUT" | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); console.log(j.totalBudget)})')"
    TOTAL_OVER="$(echo "$BUNDLE_OUT" | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); console.log(j.totalOver)})')"
    FILE_COUNT="$(echo "$BUNDLE_OUT" | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); console.log(j.fileCount)})')"
    OVERAGE_COUNT="$(echo "$BUNDLE_OUT" | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); console.log(j.overages.length)})')"

    emit "- Files analysed: **$FILE_COUNT**"
    emit "- Total gzip: **${TOTAL_KB} KB** / ${TOTAL_BUDGET} KB budget ($([ "$TOTAL_OVER" = "true" ] && echo "OVER" || echo "ok"))"
    emit ""
    if [ "$OVERAGE_COUNT" = "0" ]; then
      emit "_No per-file budget overages._"
    else
      emit "**$OVERAGE_COUNT file(s) over budget:**"
      emit ""
      emit '```'
      echo "$BUNDLE_OUT" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  for (const r of j.overages) console.log(`${r.type.padEnd(6)} ${r.name.padEnd(45)} ${r.gzipKB} KB > ${r.budget} KB`);
})' >> "$TMP_REPORT"
      emit '```'
    fi
    emit ""
    emit "Top 5 chunks by gzip size:"
    emit ""
    emit '```'
    echo "$BUNDLE_OUT" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  for (const r of j.top5) console.log(`${r.type.padEnd(6)} ${r.name.padEnd(45)} ${r.gzipKB} KB`);
})' >> "$TMP_REPORT"
    emit '```'
  fi
else
  emit "_\`dist/assets\` not present — run \`npm run build\` to enable this section._"
fi
emit ""

# ── Section 5: Stale files ────────────────────────────────────────────────────
emit "## 5. Stale files (no commit in 90+ days)"
emit ""
emit "Files in \`src/components/\` and \`src/lib/\` that have not been touched by any"
emit "commit in the last 90 days. Candidates for dead-code elimination."
emit ""

# Build a set of files touched in the last 90 days
RECENT_TMP="$(mktemp)"
git log --since='90 days ago' --pretty=format: --name-only 2>/dev/null \
  | sort -u | grep -E '^src/(components|lib)/' > "$RECENT_TMP" || true

STALE_TMP="$(mktemp)"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if is_excluded_path "$f"; then continue; fi
  if ! grep -Fxq "$f" "$RECENT_TMP"; then
    printf -- "  - \`%s\`\n" "$f" >> "$STALE_TMP"
  fi
done < <(find src/components src/lib -type f \( -name '*.js' -o -name '*.jsx' \) ! -name '*.test.js' ! -name '*.test.jsx' ! -path '*__tests__*' 2>/dev/null)

STALE_COUNT="$(wc -l < "$STALE_TMP" | tr -d ' ')"

if [ "$STALE_COUNT" -eq 0 ]; then
  emit "_No stale files — every component/lib has been touched in the last 90 days._"
else
  emit "Found **$STALE_COUNT** stale file(s) (showing first 30):"
  emit ""
  head -30 "$STALE_TMP" >> "$TMP_REPORT"
  if [ "$STALE_COUNT" -gt 30 ]; then
    emit ""
    emit "_(... $((STALE_COUNT - 30)) more not shown.)_"
  fi
fi
rm -f "$RECENT_TMP" "$STALE_TMP"
emit ""

# ── Section 6: TODO / FIXME / HACK / XXX ──────────────────────────────────────
emit "## 6. TODO / FIXME / HACK / XXX"
emit ""

TODO_TMP="$(mktemp)"
grep -rnE '\b(TODO|FIXME|HACK|XXX)\b' src --include='*.js' --include='*.jsx' 2>/dev/null \
  | grep -v -E '\.test\.|__tests__' \
  > "$TODO_TMP" || true
TODO_COUNT="$(wc -l < "$TODO_TMP" | tr -d ' ')"

emit "Total occurrences (excluding tests): **$TODO_COUNT**"
emit ""
if [ "$TODO_COUNT" -gt 0 ]; then
  emit "First 5:"
  emit ""
  emit '```'
  head -5 "$TODO_TMP" >> "$TMP_REPORT"
  emit '```'
fi
rm -f "$TODO_TMP"
emit ""

# ── Footer ────────────────────────────────────────────────────────────────────
emit "---"
emit ""
emit "_End of report. This file is informational. No code was modified, no commits were"
emit "made, no network calls were issued. Review and decide whether to spend LLM tokens_"
emit "_on fixing any findings above._"

# ── Atomic move into place ────────────────────────────────────────────────────
mv "$TMP_REPORT" "$REPORT_FILE"
trap - EXIT

# ── Final stdout — caller (CI / cron) reads this ──────────────────────────────
echo "$REPORT_FILE"
exit 0
