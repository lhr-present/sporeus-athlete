# Feature Gating Matrix — Sporeus

**Source of truth:** `src/lib/subscription.js` `FEATURE_TIERS` map  
**Last updated:** 2026-04-18  

---

## Tier Definitions

| Tier  | Athletes | AI calls/mo | Teams | Notes                      |
|-------|----------|-------------|-------|----------------------------|
| Free  | 1        | 0           | 0     | Default; post-expiry state |
| Coach | 15       | 50          | 1     | 14-day free trial available |
| Club  | 999      | 500         | 10    | Requires paid Coach first  |

---

## Feature Gate Table

| Feature Key           | Free | Coach | Club | Required Min | Gate Location                  | Blocked UX                              |
|-----------------------|------|-------|------|--------------|--------------------------------|-----------------------------------------|
| `multi_team`          | ✗    | ✓     | ✓    | coach        | CoachDashboard tab              | Upgrade prompt / UpgradeModal           |
| `export_pdf`          | ✗    | ✓     | ✓    | coach        | ReportsTab export button        | Disabled button + upgrade prompt        |
| `api_access`          | ✗    | ✗     | ✓    | club         | Profile → API Keys section      | Hidden section + Club upgrade message   |
| `white_label`         | ✗    | ✗     | ✓    | club         | OrgBranding settings            | Hidden + Club message                   |
| `realtime_dashboard`  | ✗    | ✓     | ✓    | coach        | CoachSquadView live feed        | Gated tab / upgrade prompt              |
| `semantic_search`     | ✗    | ✓     | ✓    | coach        | SearchPalette semantic toggle   | Toggle hidden (`canSemantic = false`)   |
| `squad_pattern_search`| ✗    | ✓     | ✓    | coach        | CoachOverview pattern button    | Disabled + upgrade prompt               |
| `debug_realtime_stats`| ✗    | ✓     | ✓    | coach        | DebugRealtimeStats component    | Component not rendered for free tier    |

---

## Upload Limit (Not a FEATURE_TIERS gate)

| Tier  | Monthly FIT/GPX uploads | Enforced at          |
|-------|------------------------|----------------------|
| Free  | 5                      | Client + DB trigger  |
| Coach | Unlimited              | —                    |
| Club  | Unlimited              | —                    |

`FREE_UPLOAD_LIMIT = 5` in `subscription.js`. DB trigger on `activity_upload_jobs` increments `profiles.file_upload_count_month` and rejects if over limit for free tier.

---

## Subscription Status States

| Status       | Access Level                    | Cron Action                          |
|--------------|----------------------------------|--------------------------------------|
| `active`     | Full tier access                | None                                 |
| `trialing`   | Full Coach access for 14 days   | Downgrade to free after trial_ends_at |
| `past_due`   | Full access (3-day grace)       | Downgrade after grace_period_ends_at  |
| `cancelled`  | Full access until end_date      | Downgrade after subscription_end_date |
| `expired`    | Free tier only                  | None (already downgraded)             |

`reconcile-subscriptions` cron runs daily at 00:30 UTC (migration 053).

---

## Gate Implementation Notes

- **Server-side authority:** `get_my_tier()` RPC (SECURITY DEFINER) — not bypassable by client.
- **Client-side sync:** `getTier()` in `subscription.js` calls RPC, falls back to localStorage cache.
- **Blocking condition:** `isFeatureGated(feature, tier)` → `tierRank(tier) < tierRank(required)`.
- **UpgradeModal:** Opened by `openUpgrade(featureKey)` in App.jsx. Lazy-loaded.
- **PastDueBanner:** Rendered for `past_due | cancelled | trialing` statuses. Session-dismissable.
- **Telemetry:** `trackEvent('upgrade', 'gate_shown', featureKey)` on UpgradeModal open.

---

## Adding a New Gate

1. Add `feature_key: 'coach' | 'club'` to `FEATURE_TIERS` in `subscription.js`
2. Call `isFeatureGated('feature_key', tier)` at the component render point
3. Show `getUpgradePrompt('feature_key')` or open `onUpgrade('feature_key')`
4. Add a message to `getUpgradePrompt()` messages map
5. Add a row to this table
