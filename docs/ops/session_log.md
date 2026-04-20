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
