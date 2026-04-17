# Supabase Pro Operations Checklist
## Sporeus Athlete App — v7.50.0

---

## Section 1: PITR (Point-in-Time Recovery)

### Enable PITR

1. Go to **Dashboard → Settings → Backups**
2. Click **Enable PITR**
3. Set window to **7 days**
4. Save. Supabase begins retaining WAL segments immediately.

### Restore Runbook

```bash
# 1. Get project ref
supabase projects list

# 2. Create restore job (Supabase dashboard or Management API)
curl -X POST https://api.supabase.com/v1/projects/{ref}/database/backups/restore \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recovery_time_target": "2026-04-17T03:00:00Z"}'

# 3. Monitor restore status
curl https://api.supabase.com/v1/projects/{ref}/database/backups \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

# 4. Validate: connect to restored DB and verify latest migration
psql $RESTORED_DB_URL -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;"

# 5. Re-run migrations if needed
supabase db push --db-url $RESTORED_DB_URL
```

### Monthly Test Protocol

- Restore to a **scratch project** (not production)
- Run the full test suite: `npm test` + all SQL smoke tests against the restored DB URL
- Verify pg_cron jobs re-register correctly after migration push
- Document restore duration in the ops log

---

## Section 2: Log Drains → Axiom

### Setup

1. Create a free account at [axiom.co](https://axiom.co)
2. Create a dataset named **sporeus-prod**
3. Generate an API token: **Settings → API Tokens → New Token** (ingest scope)
4. In Supabase Dashboard → **Settings → Log Drains → Add Drain**:
   - **Type:** HTTP
   - **URL:** `https://api.axiom.co/v1/datasets/sporeus-prod/ingest`
   - **Headers:** `Authorization: Bearer $AXIOM_API_TOKEN`

### Dashboard Queries (Axiom APL)

```apl
// Edge function latency p95
['sporeus-prod']
| where event_message contains "edge-function"
| summarize p95(duration_ms) by bin(_time, 5m)

// RLS denials
['sporeus-prod']
| where event_message contains "permission denied"
| summarize count() by bin(_time, 1m)

// Slow queries > 500ms
['sporeus-prod']
| where event_message contains "duration"
| parse event_message "duration: * ms" as dur
| where toint(dur) > 500
```

### Alert Rules

| Condition | Threshold | Action |
|---|---|---|
| p95 edge function latency | > 2s for 5min | PagerDuty / email |
| RLS denials | > 10/min | Immediate alert |

Configure alerts in Axiom: **Monitors → New Monitor → APL query → Threshold → Notification**.

---

## Section 3: Database Branching

### Requirements

- Supabase Pro plan active
- GitHub repository connected
- Two GitHub secrets configured (see below)

### Required GitHub Secrets

| Secret | Value | Where to Get |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Personal access token | [app.supabase.com/account/tokens](https://app.supabase.com/account/tokens) |
| `SUPABASE_PROJECT_REF` | `pvicqwapvvfempjdgwbm` | Dashboard → Settings → General |

Add secrets: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

### Workflow

The file `.github/workflows/db-branch-preview.yml` implements the full branch preview flow:

- **Trigger:** Any PR touching `supabase/migrations/**`
- **On open/sync:** Creates preview branch `preview-pr-{number}`, pushes migrations, runs SQL smoke tests + `npm test`, comments pass/fail on PR
- **On close:** Deletes the preview branch automatically

### Bad Migration Test

A PR containing `DROP TABLE profiles` should fail with a non-zero exit code during `supabase db push`, blocking the PR and posting a failure comment. To verify:

```bash
# In a test branch:
echo "DROP TABLE profiles;" >> supabase/migrations/20260430_bad_test.sql
git push origin test/bad-migration
# Open a PR → workflow should fail at "Push migrations to branch"
```

---

## Section 4: Read Replica for Public API

### Provision

1. Dashboard → **Settings → Database → Read Replicas**
2. Click **Add Replica**
3. Choose region: **eu-central-1** (closest to Turkish user base)
4. Wait ~5 minutes for replica to sync

### Configure Edge Functions

```bash
# Set the replica URL as a Supabase secret
supabase secrets set SUPABASE_REPLICA_URL=postgres://...
```

Update `supabase/functions/public-api/index.ts`: replace direct DB connection with replica URL for all `SELECT` operations. Write operations (INSERT/UPDATE/DELETE) must continue to use the primary DB URL.

```typescript
// Example: read from replica, writes to primary
const readClient  = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
const writeClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!)
// For read-heavy endpoints, route to SUPABASE_REPLICA_URL via direct pg connection
```

### Revenue Trigger

Activate the read replica only when **Club tier MRR > €500/month**. Before that threshold, the replica cost ($10+/month) is not justified.

### Load Test

```bash
k6 run --vus 100 --duration 30s scripts/load_test_api.js
```

Verify p95 latency drops by ≥30% after enabling the replica for read-heavy endpoints.

---

All items require Supabase Pro ($25/month). Enable in order: PITR → Log Drains → Branching → Replica.
