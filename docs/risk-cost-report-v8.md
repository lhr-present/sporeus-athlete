# Sporeus v8.0.0 — Risk & Cost Report

> Generated: 2026-04-18  
> Baseline: Supabase Pro tier (€25/month)

---

## 1. Storage — FIT/GPX File Uploads

**Bucket**: `activity-uploads`, 25 MB/file limit  
**Pro tier limit**: 100 GB included

| Assumption | Value |
|---|---|
| Average file size (FIT/GPX) | 1.5 MB |
| Average uploads/user/week | 3 |
| Weeks/year | 52 |
| Annual storage/active user | 3 × 52 × 1.5 MB = **234 MB/user/yr** |

| Users | Projected storage | % of 100 GB |
|---|---|---|
| 100 | 23.4 GB | 23% |
| 300 | 70.2 GB | 70% ✓ watch |
| 430 | 100.6 GB | **>100% FLAG** |

**Threshold**: ~430 active uploading users exhausts included storage.  
**Mitigation**: 
- Add 100 GB storage expansion (~€21/mo) at 300 users.
- Implement 90-day auto-deletion of raw upload files (parsed log entry is already saved; raw file is archival only). This alone cuts per-user storage to ~45 MB/yr → 2,200 users per 100 GB.
- Recommended: add `expires_at` column to `activity_upload_jobs` + pg_cron monthly cleanup.

**Risk level**: MEDIUM (manageable with auto-deletion)

---

## 2. Embedding API Cost (OpenAI text-embedding-3-small)

**Model**: `text-embedding-3-small` — $0.02/1M tokens  
**Average session note length**: ~80 tokens  
**Average sessions/active user/week**: 5

| Metric | Value |
|---|---|
| Tokens/session | 80 |
| Sessions/user/month | 20 |
| Cost/user/month | 20 × 80 = 1,600 tokens × $0.02/1M = **$0.000032/user/mo** |

| Users | Monthly embedding cost |
|---|---|
| 100 | $0.003 |
| 1,000 | $0.032 |
| 10,000 | $0.32 |

**Verdict**: Embedding cost is effectively negligible at any realistic scale. Not a risk.

**RAG query embeddings** (ai-proxy rag:true calls): assume 10 queries/user/month × 50 tokens = 500 tokens. At 1,000 users = 500K tokens/month = $0.01. Still negligible.

**Risk level**: LOW (< $1/mo at 1,000 users)

---

## 3. Realtime Connections — Peak Concurrent

**Supabase Pro limit**: 500 concurrent realtime connections

Channels per active coach session:
- `useRealtimeSquadFeed`: 1 connection per coach (broadcasts squad events)
- `useSquadPresence`: 1 connection per coach
- `useMessageChannel`: 1 per open chat thread
- `useSessionAttendance`: 1 per expanded session
- Athlete side: `useInsightNotifier` (1 per logged-in athlete)

| Scenario | Connections |
|---|---|
| 50 coaches (each with 2 channels) + 200 athletes | 300 (60%) |
| 100 coaches + 400 athletes | **600** → >500 FLAG |
| 150 coaches + 600 athletes | **900** → >500 FLAG |

**Threshold**: ~100 simultaneously active coaches + 400 athletes hits the Pro limit.

**Mitigation**:
- `useSquadPresence` already has an opt-out flag (`show_online_status=false`).
- Add connection pooling: multiplex `useRealtimeSquadFeed` + `useSquadPresence` onto a single Supabase channel with topic filtering.
- Or upgrade to Supabase Team ($599/mo) for 10,000 concurrent connections.
- Alternatively, `DebugRealtimeStats` exposes telemetry — add a dashboard alert when peak > 400.

**Risk level**: MEDIUM-HIGH (flag at 80+ coaches simultaneously active)

---

## 4. Edge Function Invocations

**Supabase Pro limit**: 2,000,000 invocations/month  
**Overage**: $2/100K after limit

Per-minute cron workers:
- `ai-batch-worker`: 1,440 invocations/day
- `push-worker`: 1,440/day
- `maybe-refresh-squad-mv`: 1,440/day
- `strava-backfill-worker` (*/2): 720/day

Total cron baseline: **5,040/day × 30 = 151,200/month**

User-triggered (estimated 500 active users):
- Training log inserts (analyse-session): 500 users × 1/day = 15,000/month
- Semantic search queries: 500 × 3/day = 45,000/month
- Activity uploads (parse-activity): 500 × 3/week = 6,500/month
- Push reminders: 500 × 1/day = 15,000/month
- Strava syncs: 500 × 1/day = 15,000/month

**Total estimated at 500 users**: 247,700/month (**12% of 2M limit**)  
**Total estimated at 2,000 users**: ~600,000/month (30%)

**Verdict**: Well within Pro limits at realistic scales. No concern.

**Risk level**: LOW

---

## 5. AI (Anthropic) Costs

**Model**: Claude Haiku 3.5 (ai-batch-worker weekly digests + analyse-session)  
**Pricing**: ~$0.80/1M input tokens, $4/1M output tokens

Per weekly digest:
- Input: system + 8 RAG sessions + coach context ≈ 2,000 tokens
- Output: digest ≈ 300 tokens
- Cost: (2,000 × $0.80 + 300 × $4) / 1M = $0.0028/digest

Per session insight:
- Input: session + context ≈ 600 tokens
- Output: insight ≈ 150 tokens
- Cost: (600 × $0.80 + 150 × $4) / 1M = $0.0011/insight

| Users | Weekly digests/month | Session insights/month | Monthly AI cost |
|---|---|---|---|
| 50 coaches | 50 | 50×5×4=1,000 | $0.14 + $1.10 = **$1.24** |
| 200 coaches | 200 | 4,000 | $0.56 + $4.40 = **$4.96** |
| 500 coaches | 500 | 10,000 | $1.40 + $11.00 = **$12.40** |

**Verdict**: AI cost is very low at current scale. Flag when coach count exceeds 2,000 (est. $50+/month).

**Risk level**: LOW

---

## 6. Database Size

**Supabase Pro limit**: 8 GB database

| Table | Estimated size at 1,000 users |
|---|---|
| training_log (5,200 rows/user) | ~100 MB |
| session_embeddings (vector 1536d × 5,200/user) | ~3.2 GB (1536 × 4B × 5.2M rows) |
| mv_ctl_atl_daily | ~50 MB |
| Other tables | ~200 MB |
| **Total** | **~3.55 GB** (44% of 8 GB) |

**Threshold**: `session_embeddings` is the dominant table. At ~2,300 users, embedding storage alone exceeds 8 GB.

**Mitigation**:
- Use `pgvector`'s half-precision storage (HALFVEC) to halve the vector footprint — reduces to ~1.6 GB at 1,000 users.
- Prune embeddings older than 2 years for inactive users.
- Upgrade to Supabase Pro 16 GB add-on (~$40/mo) when approaching 70%.

**Risk level**: MEDIUM (plan DB size upgrade at 1,500 users)

---

## Summary

| Area | Risk | Threshold | Action |
|---|---|---|---|
| FIT file storage | MEDIUM | 430 uploading users | Add 90-day raw file auto-deletion |
| Embedding API cost | LOW | N/A | No action needed |
| Realtime connections | MEDIUM-HIGH | 80 simultaneous coaches | Multiplex channels; alert at 400 connections |
| Edge fn invocations | LOW | N/A | No action needed |
| AI (Anthropic) cost | LOW | 2,000 coaches | Monitor; flag at $50/month |
| DB size (vectors) | MEDIUM | 1,500 users | Plan pgvector HALFVEC + DB size upgrade |

**Immediate action items**:
1. Add `expires_at` + cleanup job for `activity_upload_jobs` raw files (storage)
2. Add realtime connection count metric to `DebugRealtimeStats` + alert threshold
3. Evaluate `pgvector` HALFVEC storage option before 500 users
