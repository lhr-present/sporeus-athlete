# Security Incident: Stale OAuth Redirect URL in Supabase Allowlist

**Date opened:** 2026-04-21  
**Date closed:** 2026-04-21  
**Severity:** LOW (no evidence of exploitation; theoretical risk only)  
**Status:** CLOSED

---

## Summary

After migrating the app from `lhr-present.github.io/sporeus-athlete/` to `app.sporeus.com` on 2026-04-16, the old GitHub Pages URL was not removed from Supabase's `uri_allow_list`. It remained in the allowlist for 5 days (2026-04-16 to 2026-04-21). It was discovered during the F1 auth audit and removed immediately.

A stale URL in the OAuth redirect allowlist is a security risk because it enables a targeted attack: an attacker who controls that URL can harvest auth tokens from users who follow a crafted OAuth link. This attack is only possible if the attacker controls the stale domain. In this case, they never did.

---

## Timeline

| Date | Event |
|------|-------|
| pre-2026-04-16 | App deployed at `lhr-present.github.io/sporeus-athlete/`. URL added to Supabase allowlist (correct at the time). |
| 2026-04-16 | CNAME migrated: app moved to `app.sporeus.com` (commit `cb4be95`). Vite `base` changed from `/sporeus-athlete/` to `/`. Stale URL not removed from allowlist. |
| 2026-04-16 to 2026-04-21 | Stale URL present in allowlist for 5 days. GitHub Pages at `lhr-present.github.io/sporeus-athlete/` remained active with CNAME redirect to `app.sporeus.com`. |
| 2026-04-21 | Stale URL discovered in F1 auth audit. Removed via Supabase Management API. |

**Exposure window:** 5 days (2026-04-16 → 2026-04-21)

---

## GitHub Pages status during exposure window

Verified via GitHub API (`GET /repos/lhr-present/sporeus-athlete/pages`):

- **Status:** Active throughout. Pages never disabled or deleted.
- **CNAME:** `app.sporeus.com` (set since 2026-04-16)
- **Build type:** `workflow` (GitHub Actions CI deploys to Pages)
- **HTTPS cert:** Approved for `app.sporeus.com`, expires 2026-07-15
- **Conclusion:** `https://lhr-present.github.io/sporeus-athlete/` redirected to `https://app.sporeus.com/` at all times during the exposure window. The URL was never available for takeover.

---

## Log evidence

**Source:** Supabase Analytics Logs API (30-day retention), `auth_logs` table.

```
SELECT timestamp, event_message FROM auth_logs
WHERE event_message LIKE '%lhr-present%'
AND timestamp > NOW() - INTERVAL '30 days'
```

**Result: 0 rows.** No auth events referencing `lhr-present.github.io` in the last 30 days.

**Caveat:** `auth.audit_log_entries` on the Free tier has 0 rows (no retention). The Analytics API covers 30 days. If the stale URL was actively exploited, it would show up here — it doesn't.

---

## Attack feasibility assessment

For this stale URL to be exploited, an attacker would need to:

1. **Control `lhr-present.github.io/sporeus-athlete/`** — This requires either taking over the GitHub Pages site or the `lhr-present` GitHub account. The Pages site was active throughout. GitHub Pages subdomain takeover requires the original repo to be deleted or Pages to be disabled — neither happened.

2. **Get a victim to follow a crafted link:** `https://pvicqwapvvfempjdgwbm.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://lhr-present.github.io/sporeus-athlete/`

3. **Receive the token at step (1).** With implicit flow, the token arrives as a URL hash. Browser behavior on cross-origin redirects varies — the hash may or may not follow the GitHub Pages redirect to `app.sporeus.com`. Even if it did, it would land at the legitimate app.

All three conditions must hold simultaneously. Condition 1 was never met.

---

## Root cause

CNAME migration checklist (2026-04-16, commit `cb4be95`) did not include: "remove old GitHub Pages URL from Supabase OAuth redirect allowlist."

---

## Remediation

1. ✅ Stale URL removed from Supabase `uri_allow_list` via Management API (2026-04-21)
2. ✅ Correct dev URL `http://localhost:5173/` added to replace stale dev entry
3. ✅ `docs/ops/auth_flow_audit.md` documents current allowlist state

---

## Process improvement

Add to the CNAME/domain migration checklist (create `docs/ops/domain_migration_checklist.md` if not exists):

- [ ] Update Supabase `site_url`
- [ ] Update Supabase `uri_allow_list` (remove old URLs, add new ones)
- [ ] Update GCP OAuth authorized origins and redirect URIs
- [ ] Update any `VITE_*` env vars referencing the old URL
- [ ] Update CSP headers in `index.html`
- [ ] Verify Sentry ingest URL is still in CSP `connect-src`

---

## Conclusion

**No evidence of exploitation.** The attack was theoretically possible but practically infeasible during the 5-day window because the GitHub Pages site remained active and under legitimate control throughout. The stale URL could not have received any auth tokens unless an attacker had first compromised the GitHub account.

Closed as: **No exploitation detected. Low theoretical risk. Remediated immediately on discovery.**
