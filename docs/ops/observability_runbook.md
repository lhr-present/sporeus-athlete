# Observability Runbook — Sporeus Athlete App

**Version:** v9.0.0-E15  
**Last updated:** 2026-04-19

---

## Tool Coverage

| Tool | What it catches | Where to look |
|------|----------------|---------------|
| **Sentry** | Runtime errors, unhandled exceptions, component boundary crashes | sentry.io dashboard |
| **Plausible** | UX funnel, CWV scores, route change patterns | plausible.io dashboard |
| **Lighthouse CI** | Synthetic perf, accessibility regressions, PWA score | GitHub Actions → lighthouse.yml |
| **Bundle Size CI** | JavaScript/CSS chunk growth, budget breaches | GitHub Actions → bundle-size.yml |

---

## Alert Thresholds → Action

### Error Rate > 2% over 10 min (Sentry)
1. Check Sentry dashboard → filter by `release` tag to identify which deploy introduced it
2. Cross-reference with the last deploy time: `git log --oneline origin/main | head -5`
3. Check if any new DB migration was deployed in the same window (look at `supabase/migrations/` timestamps)
4. If PII appears in any event — **stop and investigate before proceeding**. The scrubber should prevent this.
5. Rollback: revert last commit, push to main → CI deploys in ~3 min

### LCP > 4000ms or CLS > 0.25 (Plausible — CWV)
1. Run Lighthouse locally: `npm run build && npm run check:lighthouse`
2. Compare against baseline in `.lighthouserc.json`
3. Suspect: new lazy chunk that wasn't split, new image without dimensions, layout shift from late-loading font

### Bundle budget exceeded (CI — bundle-size.yml)
1. Run locally: `npm run build && npm run check:bundle`
2. Use `npx rollup-plugin-visualizer` to visualise chunk contents
3. Typical culprits: new dependency added without tree-shaking, large JSON imported directly, image imported as module

---

## Adding a New Custom Metric

1. In `src/lib/observability/webVitals.js`: add `window.plausible('my_metric', { props: { ... } })`
2. In `src/lib/observability/performanceBudget.js`: add threshold constant if it has a budget
3. Add a test in `src/lib/__tests__/observability/webVitals.test.js`
4. In Plausible dashboard: create a Goal with the event name `my_metric`

---

## Querying Sentry by Release Tag

To bisect a regression to a specific deploy:

```
# In Sentry: Issues → Filters → release:5defc9b
# Or: Discover → filter by release
```

Release tags are set from `VITE_APP_VERSION` env var in the deploy. Set it to `$npm_package_version` in GitHub Actions env.

---

## Reading the CWV Plausible Dashboard

1. Go to plausible.io → Sporeus project
2. Custom Events → filter `web_vital`
3. Group by `name` prop to see LCP / INP / CLS / FCP / TTFB separately
4. Group by `rating` prop to see good/needs-improvement/poor distribution
5. `value_ms` is the raw timing in milliseconds (CLS value × 1000 for integer storage)

---

## Privacy Guarantees

The following is what leaves the browser and where it goes:

### Sentry
- **What's sent:** error message (PII-scrubbed), stack trace, breadcrumbs (scrubbed), user_hash (djb2 of user_id — not reversible), tier, lang, release, environment
- **What's never sent:** user_id, email, name, phone, JWT, API keys, UUID, 32+ hex strings
- **Scrubber:** `src/lib/observability/piiScrubber.js` — tested in 30+ unit tests
- **Retention:** 90 days (Sentry default)
- **Legal basis:** Legitimate interest (incident response, GDPR Art.6(1)(f))

### Plausible
- **What's sent:** event name, props (metric name, value, rating, route path scrubbed of IDs)
- **What's never sent:** IP address (Plausible hashes it), any user identifier
- **Retention:** Plausible standard (aggregated only, no raw event log)
- **Legal basis:** Legitimate interest

See `docs/privacy/data_inventory.md` for the formal records of processing.

---

## On-Call Rotation

_Leave blank — fill in when team grows._

---

## Cross-references

- Data inventory: `docs/privacy/data_inventory.md`
- Third-party disclosures: `docs/privacy/third_party_disclosures.md`
- Bundle budgets: `src/lib/observability/performanceBudget.js`
- PII scrubber: `src/lib/observability/piiScrubber.js`
- Sentry wrapper: `src/lib/observability/sentry.js`
