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
