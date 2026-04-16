#!/usr/bin/env bash
# scripts/healthcheck.sh — Sporeus Athlete App pre-push sanity check
# Run from repo root: bash scripts/healthcheck.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }
section() { echo; echo "── $1 ──────────────────────────────────────"; }

# ── Tests ────────────────────────────────────────────────────────────────────
section "UNIT TESTS"
if npm test --silent 2>&1 | grep -q "passed"; then
  TCOUNT=$(npm test --silent 2>&1 | grep "Tests" | grep -o '[0-9]* passed' | head -1)
  ok "Tests green ($TCOUNT)"
else
  fail "Tests FAILED — run: npm test"
fi

# ── Build ────────────────────────────────────────────────────────────────────
section "BUILD"
if npm run build --silent 2>&1 | grep -q "✓ built"; then
  ok "Build succeeded"
else
  fail "Build FAILED — run: npm run build"
fi

# ── Bundle size ───────────────────────────────────────────────────────────────
section "BUNDLE SIZE"
MAIN_JS="$(ls dist/assets/index-*.js 2>/dev/null | head -1)"
if [ -n "$MAIN_JS" ]; then
  SIZE_KB=$(du -k "$MAIN_JS" | cut -f1)
  if [ "$SIZE_KB" -lt 1600 ]; then
    ok "Main bundle ${SIZE_KB} KB (< 1600 KB limit)"
  else
    fail "Main bundle ${SIZE_KB} KB — exceeds 1600 KB warning threshold"
  fi
else
  fail "No main bundle found — run npm run build first"
fi

# ── Security scan ─────────────────────────────────────────────────────────────
section "SECURITY SCAN"
CRED_HITS=$(grep -rn "SECRET\|TOKEN\|sk-\|pk_live\|PRIVATE_KEY" src/ --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "SPOREUS_SALT\|MASTER_SALT\|STRAVA_CLIENT_ID\|VAPID_PUBLIC\|//\|API_KEY\|client_secret\|'strava-oauth'\|send-push" | wc -l)
if [ "$CRED_HITS" -eq 0 ]; then
  ok "No credentials in src/"
else
  fail "Possible credentials in src/ — $CRED_HITS hits (review before push)"
  grep -rn "SECRET\|TOKEN\|sk-\|pk_live\|PRIVATE_KEY" src/ --include="*.js" --include="*.jsx" | grep -v "SPOREUS_SALT\|MASTER_SALT\|STRAVA_CLIENT_ID\|VAPID_PUBLIC\|//\|API_KEY\|client_secret\|'strava-oauth'\|send-push" | head -5
fi

# ── Git status ────────────────────────────────────────────────────────────────
section "GIT STATUS"
UNCOMMITTED=$(git status --porcelain | wc -l)
if [ "$UNCOMMITTED" -eq 0 ]; then
  ok "Working tree clean"
else
  fail "$UNCOMMITTED uncommitted change(s) — commit before deploy"
fi
COMMITS_AHEAD=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l)
if [ "$COMMITS_AHEAD" -gt 0 ]; then
  ok "$COMMITS_AHEAD commit(s) ready to push"
else
  ok "Up to date with origin/main"
fi

# ── Live site ─────────────────────────────────────────────────────────────────
section "LIVE SITE"
if command -v curl &>/dev/null; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://app.sporeus.com/" 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ]; then
    ok "Live site HTTP $HTTP"
  else
    fail "Live site returned HTTP $HTTP (may be deploying)"
  fi
else
  ok "curl not available — skipping live site check"
fi

# ── File count ────────────────────────────────────────────────────────────────
section "FILE COUNT"
SRC_COUNT=$(find src/ -name "*.jsx" -o -name "*.js" | grep -v ".test." | wc -l)
ok "$SRC_COUNT source files in src/"

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════"
echo "  PASS: $PASS   FAIL: $FAIL"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && echo "  ✓ ALL CHECKS PASSED — safe to push" || echo "  ✗ ISSUES FOUND — fix before push"
echo
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
