# Debt Session Log

## Item 1 — /b/ch7 chapter landing smoke (2026-04-20)

**Gate:** E16 prerequisite — ChapterLanding must render without auth, CTA must redirect with correct UTM params.

**Root bug fixed (v9.2.3):** `if (BOOK_MODE)` was positioned at line 522 in App.jsx, after `if (!user) return <AuthGate>` at line 486. Unauthenticated visitors (QR code scans) always hit the login wall instead of ChapterLanding. Fixed by moving BOOK_MODE early-return to line 479 — immediately after `const userId = ...`, before the auth gate block.

**Smoke results (localhost:5174):**

| # | Check | Result |
|---|-------|--------|
| 1 | Page renders (not white screen / 404) | ✅ "Chapter 7 — Training Stress & Recovery" |
| 2 | Ch7-specific content | ✅ TSS Estimator (Banister 1991), TRIMP calculator |
| 3 | Signup CTA present | ✅ "Create Free Sporeus Account →" |
| 4 | CTA → `/?utm_source=esik_book&utm_medium=qr&utm_content=ch7` | ✅ exact match |
| 5 | LocalStorage `spa_first_touch` contains /b/ch7 | ✅ present |

Console: CORS errors on `/attribution-log` endpoint — dev-only, not gate-blocking.

**Status: ✅ ITEM 1 COMPLETE**

## Item 2 — VITE_SENTRY_DSN (2026-04-21)

**Gate:** E15 prerequisite — Sentry must receive errors in production.

- `npm install @sentry/react` — installed
- `gh secret set VITE_SENTRY_DSN` — set (2026-04-20T22:06:50Z)
- `index.html` CSP `connect-src` — added `https://o4511166567022592.ingest.de.sentry.io`
- `.env.test` — added `VITE_SENTRY_DSN=` to preserve no-op test assertion
- Verified: Playwright smoke sent 4 envelopes to ingest endpoint; no "DSN not set" warning

**Status: ✅ ITEM 2 COMPLETE**

## Item 4 — comment-notification webhook (2026-04-21)

**Gate:** E11 prerequisite — Supabase webhook must fire on `session_comments INSERT` → `comment-notification` edge function.

**Actions taken:**
1. Applied migration `20260460_realtime_comments.sql` — created `session_comments` + `session_views` tables, RLS policies, Realtime publication
2. Created webhook trigger via SQL on `public.session_comments AFTER INSERT`

**Verified trigger in DB:**
```
trigger_name:        comment-notification
event_manipulation:  INSERT
target:              https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/comment-notification
method:              POST
timeout_ms:          10000
```

**Status: ✅ ITEM 4 COMPLETE**

## Item 5 — Two-browser E11 RLS smoke (2026-04-21)

**Gate:** E11 RLS must isolate session_comments and session_views per participant.

**Method:** pgTAP + direct SQL checks via Supabase Management API against live DB.

**Bug found and fixed during test:**
- `sv: read own or linked` policy third branch checked `ca.coach_id = tl.user_id` (session owner is a coach) — never matches since sessions are athlete-owned.
- Fixed in migration `20260461_fix_sv_rls.sql`: added fourth branch — "viewer is my coach" (`ca.coach_id = session_views.user_id AND ca.athlete_id = tl.user_id AND tl.user_id = auth.uid()`).

**7-scenario results:**

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | Athlete reads own session comments | 1 | ✅ 1 |
| 2 | Coach reads linked athlete session | 1 | ✅ 1 |
| 3 | Unlinked user reads (isolation) | 0 | ✅ 0 |
| 4 | Unlinked user INSERT blocked | 42501 | ✅ 42501 |
| 5 | Spoofed author_id blocked | 42501 | ✅ 42501 |
| 6 | Athlete sees coach presence (session_views) | 1 | ✅ 1 |
| 7 | Unlinked user sees no presence | 0 | ✅ 0 |

**Scope clarification:** What was tested above is RLS isolation (7 SQL-level assertions equivalent to scenario E of the debt checklist). Behavioral scenarios A–D and F–G — comment CRUD flow, edit/soft-delete, offline queue, reconnect, concurrent editing, stress — were **not** tested. CoachPresenceBadge rendering against the fixed policy was not browser-verified.

**CoachPresenceBadge data-layer analysis (without real auth):**
- SQL: `SELECT session_views WHERE user_id=coachId AND session_id=X` now returns 1 row for the athlete ✅ (verified above)
- Realtime: `postgres_changes` on `session_views` passes through RLS; REPLICA IDENTITY FULL set; component filter `row.user_id === coachId` guards correctly ✅
- Browser: full two-browser rendering test (real auth, real coach views real session, athlete sees badge) **deferred** — requires real credentials, cannot be automated without them

**Deferred:** Full behavioral smoke (scenarios A, B, C, D, F, G) deferred to a separate manual session. E14 proceeds on RLS-isolation-only evidence.

**Status: ✅ ITEM 5 RLS SMOKE COMPLETE — E14 UNBLOCKED (behavioral scenarios deferred)**
