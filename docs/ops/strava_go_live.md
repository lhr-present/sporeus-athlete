# Strava connection — go-live gates (operator)

**Status (2026-06-18):** App/build/server config is correct and live (v9.435). The remaining
blockers are all on the Strava developer dashboard (https://www.strava.com/settings/api), not
in our code. Live probe of Strava's `/oauth/authorize` returns
`HTTP 400 {"field":"redirect_uri","code":"invalid"}` — Strava recognizes app **223686** but has
no matching callback domain registered for it.

Our config (all verified correct, nothing to change here):
- Client ID `223686` — baked into the build, set in edge fn, consistent across all notes.
- Redirect URI `https://app.sporeus.com/` — baked at build (GH secret `VITE_STRAVA_REDIRECT_URI`).
- Edge secrets `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` — set on project `pvicqwapvvfempjdgwbm`.

## The 4 gates (do in order)

1. **Strava subscription (NEW prerequisite, ~2024–2025 policy).**
   The account that owns app 223686 must have an active **Strava subscription**. There is no
   separate API fee — the subscription *is* the access. Existing Standard-Tier developers lose
   API access on **2026-06-30** without it.

2. **Authorization Callback Domain = bare host `app.sporeus.com`.**
   On app 223686, set the field to exactly:
   ```
   app.sporeus.com
   ```
   NOT `https://app.sporeus.com`, NOT `app.sporeus.com/`, NOT `www…`. Click **Update Application**.

3. **Self-upgrade athlete cap to 10.**
   New apps are in "Single Player Mode" = only the owner (1 athlete) can connect. Self-upgrade to
   **10 athletes** instantly from the API Settings Dashboard — no review. Required so anyone other
   than the owner can connect during testing.

4. **(Public launch only) Submit app for Strava review.**
   To serve more than 10 users, app 223686 must pass Strava review (Standard Tier scales to 9,999
   after approval; approval is not guaranteed).

## Verify
After gates 1–3, run:
```bash
bash scripts/strava-callback-check.sh
```
- **PASS** = `HTTP 302` redirect to Strava login/authorize (callback accepted).
- **FAIL** = `HTTP 400 … redirect_uri invalid` (domain still unregistered/mismatched on 223686).

Sources: developers.strava.com/docs/getting-started, Strava Community Hub API FAQ.
