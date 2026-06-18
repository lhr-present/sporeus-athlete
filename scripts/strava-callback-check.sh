#!/usr/bin/env bash
# strava-callback-check.sh — verify Strava OAuth callback registration without a browser.
#
# Probes Strava's /oauth/authorize with our exact client_id + redirect_uri. Strava validates
# redirect_uri against the app's registered Authorization Callback Domain BEFORE any login, so:
#   PASS = HTTP 302 redirect to login/authorize  → callback domain accepted
#   FAIL = HTTP 400 {"field":"redirect_uri","code":"invalid"} → domain unregistered/mismatched
#
# See docs/ops/strava_go_live.md for the dashboard gates this verifies.
set -euo pipefail

CLIENT_ID="${STRAVA_CLIENT_ID:-223686}"
REDIRECT_URI="${STRAVA_REDIRECT_URI:-https://app.sporeus.com/}"

enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$REDIRECT_URI")
URL="https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${enc}&approval_prompt=auto&scope=read,activity:read_all&state=strava"

echo "Probing Strava OAuth for app ${CLIENT_ID} → ${REDIRECT_URI}"
code=$(curl -s -o /dev/null -w '%{http_code}' -A "Mozilla/5.0" "$URL")
body=$(curl -sL -A "Mozilla/5.0" "$URL")

if echo "$body" | grep -qi 'redirect_uri","code":"invalid"\|"field":"client_id"'; then
  echo "❌ FAIL (HTTP $code) — Strava rejected the request:"
  echo "$body" | grep -oE '\{.*\}' | head -1
  echo "→ Fix the Authorization Callback Domain on app ${CLIENT_ID} to bare host (see docs/ops/strava_go_live.md)."
  exit 1
elif [ "$code" = "302" ] || echo "$body" | grep -qiE 'log ?in|sign ?in|password|authorize'; then
  echo "✅ PASS (HTTP $code) — callback accepted; OAuth round-trip is live."
  exit 0
else
  echo "⚠️  UNKNOWN (HTTP $code) — inspect manually:"
  echo "$body" | head -5
  exit 2
fi
