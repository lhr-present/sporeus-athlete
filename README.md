# Sporeus Athlete Console

**Bloomberg Terminal for endurance athletes.** Training load analytics, periodization, W' balance, race readiness, and coach-athlete collaboration — offline-capable PWA.

**Live:** https://app.sporeus.com/
**Repo:** https://github.com/lhr-present/sporeus-athlete

---

## Features

| Category | Highlights |
|---|---|
| **Training Load** | CTL/ATL/TSB (EMA), ACWR with 4-scenario forecast (CONSERV/MAINTAIN/BUILD/LIMIT) |
| **W' Balance** | Skiba 2012 differential model from FIT power data; exhaustion flagged in log |
| **Data Import** | .fit (Garmin/Wahoo) + .gpx; NP/IF/TSS from power; Strava OAuth sync |
| **Test Protocols** | Ramp, 20-min FTP, Cooper, Beep, YYIR1, Astrand, Wingate, 1RM, Conconi, CP+W' |
| **Periodization** | 4–20 week plan generator, CTL/ATL projection, coach→athlete plan push |
| **Race Readiness** | 10-factor composite score (A+ to F), taper detection, race time predictor |
| **Coach Tools** | Roster, compliance tracking, data quality score, level override, week notes, messaging |
| **Intelligence** | Load trends, recovery correlation, zone balance, injury risk, fitness projection |
| **Pattern Mining** | Training→result correlation, optimal week structure, seasonal patterns |
| **Body + Nutrition** | Navy BF%, BMI, TDEE (Mifflin), race-day fueling calculator |
| **UX** | Dark/light mode, TR/EN bilingual, PWA installable, push notifications |

---

## Tech Stack

- **React 18** + **Vite 6** — zero external UI libs, inline styles only
- **vite-plugin-pwa** (Workbox `injectManifest`) — offline + push notifications
- **Supabase** — implicit auth flow (static hosting), realtime sync, Deno edge functions
- **Recharts** — periodization CTL/ATL/TSB charts
- **IBM Plex Mono** — Bloomberg Terminal aesthetic

---

## Development

```bash
npm install
cp .env.example .env.local    # fill in Supabase + Strava keys
npm run dev                   # → http://localhost:5173/sporeus-athlete/
npm test                      # 2019 unit tests (vitest)
npm run build                 # production build → dist/
bash scripts/healthcheck.sh  # pre-push sanity: tests + build + bundle + security + git
```

### Environment Variables
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRAVA_CLIENT_ID=your-strava-client-id
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

---

## Deployment

Push to `main` — GitHub Actions runs `npm test → npm build → deploy Pages` automatically (~45s).

Secrets required in repo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRAVA_CLIENT_ID`, `VITE_VAPID_PUBLIC_KEY`

---

## Database (Supabase · pvicqwapvvfempjdgwbm)

**v8.1.0:** 40 tables · 3 materialized views · 55 migrations · 25 edge functions · 14 pg_cron jobs · 9 pgmq queues

Key tables: `profiles` · `training_log` · `recovery` · `ai_insights` · `coach_athletes` · `coach_plans` · `session_embeddings` · `processed_webhooks` · `billing_events` · `attribution_events` · `client_events`

Edge functions include: AI pipeline (`analyse-session`, `embed-session`, `ai-proxy`, `ai-batch-worker`) · Payments (`dodo-webhook`) · Realtime (`squad-sync`, `send-push`) · Observability (`ingest-telemetry`, `check-dependencies`, `alert-monitor`, `operator-digest`) · Attribution (`attribution-log`)

---

## Author

**Hüseyin Akbulut** — BSc Sport Sciences, MSc Neuroscience, Marmara University
[sporeus.com](https://sporeus.com) · Based on **EŞİK / THRESHOLD** — Turkish endurance science book (2026)

*Built with Claude Code · Skiba 2012 · Friel phases · Morton 1996*
