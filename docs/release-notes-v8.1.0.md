# Sporeus Athlete Console — v8.1.0 Release Notes
**Release date:** 2026-04-19  
**Type:** Consolidation — 9 hardening sprints (C1–C9) rolled into v8.1.0  
**Tests:** 2019 passing (was 1735 at v8.0.0 baseline · +284 net)  
**Migrations:** 55 total (was 48 at v8.0.0 · +7 in this cycle)  
**Bundle:** 84 kB gzip main chunk (was 150 kB · −43.9%)

---

## Summary

v8.1.0 is the first production-hardening release of Sporeus Athlete Console. No new user-facing features were added in this cycle — instead, nine focused sprints (C1–C9) addressed every critical and high finding from the pre-release audit, plus a complete monetization hardening pass. The app enters v8.1.0 genuinely production-grade: observable, secure, performant, bilingual, accessible, and revenue-protected.

---

## C1 — Contract Audit & Seam Repair (v8.0.1)

**Tests:** +122

- **Fixed:** `embed-session` race condition — analyse-session now fires embed after upsert with `insight_only:true` flag; insight embeddings now correctly written
- **Fixed:** `embed-session` silently reading wrong field names (`.summary`/`.flags` string vs `.text`/`.flags` array)
- **Fixed:** `generate-report` reading wrong MV column names (`ctl` → `ctl_42d`, etc.) — all CTL/ATL/TSB report values were 0
- **Fixed:** `search_everything` coach arm — coaches couldn't find athlete notes via semantic search
- **New:** `docs/internal_contracts.md` — 8 TypeScript interface contracts (C1–C8)
- **New:** `docs/architecture/seam_map.md` — Mermaid flowchart of all P1–P8 seams + high-risk table
- **New:** `src/__tests__/contracts/` — 9 JS contract test files (122 tests)
- **New:** `supabase/tests/contracts/` — 3 SQL contract tests
- **New:** `scripts/smoke_contracts.ts` — Deno smoke runner vs live Supabase
- **New:** `.github/workflows/contract-smoke.yml` — blocking CI gate

---

## C2 — RLS Hardening (v8.0.2)

**Tests:** unchanged (RLS tests are Deno/SQL, not vitest)

- **Fixed (HIGH):** `ai_insights` INSERT allowed any authenticated user to inject fake AI advice for arbitrary athlete_ids — restricted to `service_role` only
- **Fixed (MEDIUM):** `ai_insights` permissive own-rows policy let free users bypass tier gate via OR semantics — policy dropped
- **Fixed (MEDIUM):** `enqueue_push_fanout` callable by any authenticated user — REVOKE'd; DoS vector closed
- **Fixed (LOW):** `mv_refresh_pending` RLS enabled but no policy — now service_role-only
- **Fixed (MEDIUM):** `attribution_events` INSERT allowed funnel poisoning — added `WITH CHECK (user_id IS NULL OR user_id = uid())`
- **New:** `supabase/tests/rls/harness.ts` — 220+ tests, 4 personas (AthleteA/B/CoachA/Anon)
- **New:** `docs/security/rls_inventory.md` — 38-table RLS audit, tenancy classification
- **New:** `.github/workflows/rls-harness.yml` — blocking CI gate on migration PRs

---

## C3 — Edge Function Telemetry (v8.0.3 / v8.2.0)

**Tests:** unchanged (telemetry is integration, not unit)

- **New:** `supabase/functions/_shared/telemetry.ts` — `withTelemetry(fnName, handler)` wrapper; `telemetryHeartbeat(fnName)` 60s keepalive
- **All 21+ edge functions** instrumented with `withTelemetry()`; 3 cron workers add `telemetryHeartbeat()`
- **New:** `docs/observability.md` — Axiom setup, event schema, 5 APL queries
- **New:** E2E critical-paths suite — 5 Playwright specs (signup, Strava, upload, upgrade, PDF)
- **New:** `.github/workflows/e2e-critical-paths.yml` — 5-worker parallel CI gate

---

## C4 — Performance & Hook Tests (v8.0.4 / v8.0.5 / v8.6.0)

**Tests:** +32 hook tests; perf harness is separate runtime

- **Bundle:** Main chunk 150 kB → 84 kB gzip (−43.9%) via 9 lazy `React.lazy()` imports
- **New:** `tests/perf/` — full perf harness (18k seeded sessions, 7 scenarios, 9 SLOs)
- **New:** `.github/workflows/perf-regression.yml` — nightly perf gate
- **New:** `tests/perf/baselines/v8.0.4.json` — locked SLO baselines
- **New:** Hook tests: `useMessageChannel` (14), `useInsightNotifier` (9), `useSessionAttendance` (9)
- **New:** `src/test/supabase-mock.js` — `buildChannelMock()` reference factory

---

## C5 — Observability Stack (v8.0.5)

**Tests:** +20

- **New:** `system_status` + `operator_alerts` + `client_events` tables
- **New:** `check-dependencies` edge fn — probes 5 external services every 5 min
- **New:** `ingest-telemetry` edge fn — POST endpoint for client-side event batches
- **New:** `alert-monitor` edge fn — 5 alert conditions, Telegram notifications, 15-min dedup window
- **New:** `operator-digest` edge fn — weekly HTML email (MAU/DAU/tiers/queues/errors)
- **New:** `StatusBanner.jsx` — polls `get_system_status()` every 5 min; shows for degraded/down services
- **New:** `admin/ObservabilityDashboard.jsx` — 5 live panels with auto-refresh
- **Updated:** `src/lib/telemetry.js` — server-side flush (30s interval + `visibilitychange`), `trackFunnel()`, `trackPerf()`
- **New:** `docs/ops/slos.md` — 8 SLOs (S-1→S-8) with error budgets and breach runbooks
- **New:** `docs/ops/runbook.md` — 7 on-call procedures, first-week checklist
- **New:** `ops/axiom_dashboards/` — 5 Axiom dashboard JSON import files

---

## C6 — UX States & i18n (v8.0.6 / v8.4.0)

**Tests:** +10 (ConfirmModal) + 18 (SportProgramBuilder i18n)

- **New:** `src/components/ui/ConfirmModal.jsx` — non-blocking confirm dialog; replaces `window.confirm()` everywhere
- **Fixed:** `TrainingLog` empty log → `EmptyState` component with coaching CTA
- **Fixed:** `ReportsTab` delete → ConfirmModal (dangerous variant, ARIA-correct)
- **Fixed:** `SemanticSearch` idle state — explanation + 4 example queries + corpus note
- **Fixed:** `LiveSquadFeed` differentiated empty messages ("no athletes" vs "waiting for activity")
- **Fixed:** `SportProgramBuilder` — 68 label keys extracted; all hardcoded EN strings replaced with `t()`
- **New:** `docs/ux/state_audit.md` — P1–P8 empty/loading/error/offline state matrix

---

## C7 — Mobile, a11y & i18n Completeness (v8.0.7 / v8.7.0)

**Tests:** +8 i18n parity tests

- **Fixed:** `todayConsec` TR key gap — TodayView showed raw key string "todayConsec" in Turkish
- **New:** 25 LangCtx keys — SemanticSearch (20) + LiveSquadFeed (5) — fully bilingual
- **Fixed:** All hardcoded EN strings in `SemanticSearch.jsx` + `LiveSquadFeed.jsx` → `t()`
- **New:** Chart ARIA: `TSSChart`/`WeeklyVolChart` `role="img"` + dynamic label; `ZoneBar` `role="progressbar"` + `aria-valuenow/min/max`; `MiniDonut` `role="img"`
- **New:** Touch targets: `S.btn`/`S.btnSec` → `minHeight:44px` + `touchAction:manipulation` (WCAG 2.5.5)
- **New:** Safe-area insets: `--safe-top/bottom/left/right: env(safe-area-inset-*)` for iOS notch/Dynamic Island
- **New:** `:focus-visible` global outline `#ff6600 2px` (4.68:1 contrast — WCAG AA)
- **New:** `document.documentElement.lang` synced on every language change
- **Fixed:** `DebugRealtimeStats.jsx` dead import wired into App.jsx (was defined, never imported)
- **New:** `tests/e2e/a11y.spec.ts` — axe-core audit + keyboard nav + focus ring tests
- **New:** `tests/e2e/mobile.spec.ts` — iPhone 12 + Pixel 5 layout, tap targets, offline, TR locale
- **New:** `docs/a11y/sr_audit.md` — contrast audit, ARIA annotations, WCAG AA status

---

## C8 — Monetization Hardening (v8.0.8)

**Tests:** +52

- **New:** `processed_webhooks` table — `UNIQUE(webhook_source, event_id)` idempotency dedup for Dodo + Stripe replays
- **New:** `billing_events` table — immutable monetization audit trail (separate from GDPR audit_log)
- **New:** `profiles` columns: `subscription_status` (active/trialing/past_due/cancelled/expired), `trial_ends_at`, `subscription_end_date`, `grace_period_ends_at`
- **New:** `reconcile-subscriptions` pg_cron (00:30 UTC) — handles trial expiry, grace period, cancellation, catch-all
- **New:** `apply_tier_change()` SQL function — atomic tier + billing_events in one transaction; SECURITY DEFINER; REVOKE from authenticated
- **Rewritten:** `dodo-webhook/index.ts` — idempotency check before every event; `apply_tier_change()` replaces direct UPDATE; `past_due` + 3-day grace period; cancellation emails; 500 on DB error (correct retry semantics)
- **New:** `UpgradeModal.jsx` — pricing comparison (TRY/EUR), 14-day trial CTA, feature table, one-click checkout
- **New:** `PastDueBanner.jsx` — sticky `role="alert"` banner for past_due/cancelled/trialing
- **Fixed:** `SearchPalette.jsx` hardcoded tier check → `isFeatureGated('semantic_search', tier)`
- **Updated:** `ReferralCard.jsx` — WhatsApp + Telegram share buttons, reward progress bar, telemetry
- **New:** `subscription.js` helpers: `getCheckoutUrl()`, `isOnTrial()`, `isPastDue()`, `isCancelled()`, `isExpired()`, `daysUntilExpiry()`
- **New:** `docs/monetization/gating_matrix.md` — complete feature × tier × UX table
- **New:** `docs/monetization/payment_flow.md` — full payment + cron flow diagrams

---

## C9 — Attribution & Funnel (v8.1.0-C9)

**Tests:** +22

- **New:** `attribution_events` table — UTM params, referrer, landing path, anon_id, first_touch
- **New:** `src/lib/attribution.js` — `parseUtmFromLocation()`, `getOrCreateAnonId()`, `recordFirstTouch()`, `emitEvent()`, signup gate
- **New:** `attribution-log` edge fn — rate-limit 20/min per anon_id; stamps `profiles.first_touch` once
- **New:** Conversion events: `landing`, `signup_completed`, `first_session_logged`, `first_week_completed`
- **New:** `attribution_summary` view (service_role only) — aggregated UTM performance
- **Tests:** 22 attribution unit tests

---

## Baseline Numbers at v8.1.0

| Metric | v8.0.0 | v8.1.0 | Delta |
|--------|--------|--------|-------|
| Tests (vitest) | 1735 | 2019 | +284 |
| Migrations | 48 | 55 | +7 |
| Edge functions | 20 | 25 | +5 |
| pg_cron jobs | 10 | 14 | +4 |
| DB tables (base) | 38 | 40 | +2 |
| pgmq queues | 9 | 9 | 0 |
| Main bundle (gzip) | 150 kB | 84 kB | −44% |
| RLS test coverage | 0 | 220+ | new |
| Contract tests | 0 | 148+ | new |
| E2E specs | 0 | 7 | new |
| i18n key parity | ⚠ gaps | ✓ enforced | CI gate |

---

## Known Limitations at v8.1.0

- **Protocols/ZoneCalc placeholders** — ~30 `placeholder=""` attributes in Protocols.jsx + ZoneCalc.jsx still hardcoded EN. Non-critical (form hints, not primary labels). Deferred to v9.
- **VoiceOver/NVDA manual testing** — automated axe + keyboard tests cover structural a11y. Manual screen reader walkthroughs deferred (VoiceOver iOS 17, NVDA Windows 11).
- **Perf baselines estimated** — perf harness SLO values are estimates; replace with measured numbers after first CI run against Supabase branch.
- **4 HIGH npm vulns remain** — `serialize-javascript` chain via `workbox-build`. Build-time only, not shipped to users. Accepted risk until `vite-plugin-pwa` releases a fix.
- **React 19 / Vite 8** — major version upgrades deliberately deferred. Current stack is stable; migrations warrant a dedicated spike.
- **`insight_embeddings` fully written** — fixed in C1, but the backfill script (`scripts/backfill_embeddings.ts`) must be run once against existing `ai_insights` rows for pre-C1 data.

---

## Upgrade Notes (v8.0.x → v8.1.0)

1. Run all migrations in order: 20260430 through 20260454
2. Set new Supabase secrets: `DODO_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET` (required — cold-start throws if missing)
3. Set new VITE env vars: `VITE_DODO_CHECKOUT_COACH`, `VITE_DODO_CHECKOUT_CLUB`, `VITE_STRIPE_CHECKOUT_COACH`
4. Re-deploy all edge functions (dodo-webhook rewritten; attribution-log, check-dependencies, ingest-telemetry, alert-monitor, operator-digest are new)
5. Schedule `reconcile-subscriptions` cron is auto-registered by migration 20260453
6. No breaking changes to existing localStorage keys or auth flow
