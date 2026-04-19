# Garmin Connect Integration — v9 Discovery Spike
**E10 — 2026-04-19**
Status: PROTOTYPE — awaiting GO/NO-GO decision

---

## Hypothesis

Garmin users are a high-quality segment (wearable data, TSS, HRV) who are underserved by Strava-only sync. A native Garmin integration would reduce friction for ≈30–40% of Sporeus users who own Garmin devices (est. from community poll). Garmin provides TSS natively and Body Battery / HRV daily summaries that Strava never exposes, which strengthens Sporeus's science-identity differentiation.

---

## What Was Built (Spike Artifacts)

| Artifact | Path | Purpose |
|---|---|---|
| Schema mapper | `src/lib/garmin/schemaMapper.js` | Maps Garmin API → training_log shape (pure, testable) |
| Mapper tests | `src/lib/__tests__/garmin/schemaMapper.test.js` | 30 focused tests |
| OAuth edge fn | `supabase/functions/garmin-oauth/index.ts` | connect / disconnect / status |
| Sync edge fn | `supabase/functions/garmin-sync/index.ts` | pull last 30d activities |
| In-app survey | `src/components/GarminSurvey.jsx` | gauge user demand (≥5 sessions) |

All spike artifacts are gated by `GARMIN_CLIENT_ID` env var (returns 501 if not set). Safe to deploy to staging without affecting production.

---

## Success Criteria (for GO decision)

| Metric | Target | How to measure |
|---|---|---|
| Survey: "Yes, absolutely connect" | ≥ 35% of respondents | `sporeus-garmin-survey` localStorage; aggregate in client_events |
| Survey: Garmin is primary device | ≥ 25% of respondents | Same |
| Schema mapper: round-trip fidelity | 0 data loss on 100-activity batch | Unit tests |
| OAuth flow: connect time | ≤ 30 seconds end-to-end | Manual timing in staging |
| Duplicate guard: re-sync idempotency | 0 duplicates on 3× sync | Integration test |

---

## Schema Mismatch Documentation

These differences must be solved before production:

### Activity Type
- **Garmin**: `activityType.typeKey` (snake_case strings, e.g. `road_biking`)
- **Strava**: `sport_type` (PascalCase, e.g. `Ride`)
- **Sporeus**: own type string (e.g. `Cycling`)
- **Resolution**: `mapActivityType()` in schemaMapper.js — ✓ handled

### Timestamps
- **Garmin**: `startTimeLocal` = local wall-clock time (`YYYY-MM-DD HH:MM:SS`) with no timezone info
- **Strava**: `start_date` = UTC ISO 8601
- **Risk**: cross-midnight activities may record wrong date if user travels
- **Resolution (partial)**: `garminDateToLocal()` slices the local string — no DST handling yet
- **Production requirement**: Garmin provides `startTimeGMT` + user's home timezone in profile; combine both

### RPE / Effort
- **Garmin**: `aerobicTrainingEffect` (ATE) 0–5 scale — measures aerobic stimulus, not perceived effort
- **Sporeus**: RPE 1–10 (perceived exertion, Borg CR10)
- **Resolution (prototype)**: `ateToRpe(ate) = Math.round(ate * 2) + 1` — approximate, documented
- **Production requirement**: show ATE and RPE as distinct fields; do not conflate

### Power
- **Garmin**: `normalizedPower` (NP) or `avgPower`
- **Strava**: `weighted_average_watts`
- **Both**: numerically equivalent for NP; field naming differs
- **Resolution**: `g.normPower || g.normalizedPower` — ✓ handled

### Exclusive Garmin fields (no Strava equivalent)
| Garmin field | Value | Sporeus impact |
|---|---|---|
| `bodyBattery` | 0–100 daily readiness | Stored in `_unmapped`; potential readiness card |
| `stressScore` | 0–100 daily stress | Stored in `_unmapped`; CTL/ATL context signal |
| `hrvWeeklyAverage` | ms RMSSD (weekly) | Stored in `_unmapped`; HRV trend card candidate |
| `anaerobicTrainingEffect` | 0–5 | Stored in `_unmapped`; complements aerobic TE |
| `trainingStressScore` | Direct TSS (cycling/run) | Mapped to `tss` — removes need for TRIMP estimate |

### TSS availability
- **Garmin**: native TSS for cycling activities; some run activities use `trainingStressScore`
- **Strava**: no native TSS (Sporeus estimates via TRIMP)
- **Garmin advantage**: direct TSS → more accurate CTL/ATL computation for cyclists

---

## API Access Requirements

Garmin Health API v2 requires:
1. **Developer program enrollment**: https://developer.garmin.com/health-api/getting-started/
2. **App review & approval**: Garmin reviews each integration; typical 2–4 weeks
3. **User data consent**: users must connect via Garmin Connect website, not just in-app
4. **Rate limits**: 100 requests/min, 10k/day (generous for our scale)
5. **Webhook push model**: Garmin can push new activities via webhook (different from Strava pull)

**Compare to Strava**: Strava OAuth is self-service (no approval needed). Garmin requires explicit developer partnership. This is the primary timeline risk.

---

## GO / NO-GO / PIVOT Framework

### GO criteria (proceed to production)
- Survey: ≥ 35% "Yes, absolutely" on connect question
- Survey: ≥ 25% "Garmin is my primary device"
- Garmin developer approval received
- Body Battery / HRV storage schema agreed (new training_log columns or separate table)
- TSS fidelity test: Garmin TSS vs Sporeus TRIMP estimate within 15% on 20-activity sample

### NO-GO criteria (do not build)
- Survey response < 20% intent to connect
- Garmin developer program rejects or stalls > 8 weeks
- Fewer than 20% of surveyed users own a Garmin as primary device
- Scope creep: HRV/Body Battery requires redesigning intelligence.js (not contained)

### PIVOT criteria (build differently)
- Survey shows demand but no primary-device ownership → FIT file import only (no OAuth)
- Developer approval delayed → ship FIT file upload path first (already supported via parse-activity)
- Users want Body Battery most → explore Garmin Connect Mobile SDK (no backend OAuth)

---

## Recommended Next Steps (if GO)

1. Apply migration `20260460_garmin_tokens.sql` (garmin_tokens table, garmin_connected on profiles)
2. Set `GARMIN_CLIENT_ID` + `GARMIN_CLIENT_SECRET` in Supabase secrets (after developer approval)
3. Add `garmin_activity_id TEXT` column to `training_log` (migration needed)
4. Wire `GarminSurvey` into App.jsx (pass `sessionCount` + `garminConnected`)
5. Build `src/pages/profile/GarminConnect.jsx` (connect/disconnect UI, mirrors StravaConnect)
6. Production sync: switch from 30-day pull to Garmin webhook push model
7. HRV card: leverage `hrvWeeklyAverage` from `_unmapped` in intelligence.js
8. Body Battery card: daily readiness overlay on CTL timeline

---

## Data Privacy Notes

- Garmin activities contain health data (HR, power, HRV) → GDPR Art.9 sensitive
- `export-user-data` edge function must include `garmin_tokens` in export (already present)
- `purge-deleted-accounts` must delete `garmin_tokens` before auth.deleteUser (already in cascade order)
- Garmin's DPA status: ⚠️ PENDING — check before production launch

---

## Spike Limitations (not production bugs)

1. No production migrations applied (garmin_tokens table does not exist in DB)
2. Webhook push model not implemented (30-day pull only)
3. DST / timezone handling incomplete (local timestamp only)
4. ATE → RPE mapping is approximate (documented; labelled [Garmin] in notes field)
5. Developer program approval not initiated
