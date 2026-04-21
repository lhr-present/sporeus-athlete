# Deploy Checklist

Checklists for deployment operations. Run the relevant section before completing each operation.

---

## Standard deploy (code changes to main)

Handled by CI automatically on push to `main`. No manual steps unless:
- Migration needs manual apply (rare — most are in `supabase/migrations/`)
- Secrets updated in GitHub or Supabase dashboard
- Verify deploy succeeded at https://app.sporeus.com after CI green

---

## Domain / CNAME migration

When changing the production URL (custom domain, CNAME, GitHub Pages base path):

**Before cutting over:**
- [ ] New domain DNS record created and propagating
- [ ] SSL cert issued or ordered for new domain
- [ ] `vite.config.js` `base:` updated to match new path (usually `/` for custom domain)
- [ ] `public/CNAME` updated with new domain
- [ ] `index.html` canonical + OG URL tags updated
- [ ] `manifest.webmanifest` `start_url` updated
- [ ] `404.html` SPA redirect updated if `seg` count changes
- [ ] CSP `connect-src` in `index.html` still covers Supabase + Sentry

**Supabase config (critical — see 2026-04-21 incident):**
- [ ] `site_url` updated to new domain (`PATCH /v1/projects/{ref}/config/auth`)
- [ ] `uri_allow_list` — remove old domain URL, add new domain if needed
- [ ] Verify only `http://localhost:5173/` and new `site_url` remain in allowlist
- [ ] If old GitHub Pages URL was in allowlist: remove immediately, document in `docs/ops/security/incidents/`

**GCP OAuth client:**
- [ ] Authorized JavaScript origins: add new domain, remove old
- [ ] Authorized redirect URIs: `https://{supabase-ref}.supabase.co/auth/v1/callback` (unchanged if project didn't change)
- [ ] Remove any test/preview URLs added during development

**Environment variables:**
- [ ] GitHub Actions secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (unchanged if project didn't change)
- [ ] Any `VITE_*` hardcoding old domain? `grep -r "lhr-present.github.io\|old-domain.com" src/`

**After cutover:**
- [ ] Old URL redirects to new URL (GitHub Pages CNAME handles this automatically)
- [ ] `auth_flow_audit.md` updated with new allowlist state
- [ ] Sentry release configured for new domain if DSN changes

---

## Supabase project migration

When moving to a new Supabase project (`ref` changes):

All of the above, plus:
- [ ] All GitHub secrets updated: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] All Supabase secrets re-set in new project (see `project_sporeus_master_reference.md` secrets list)
- [ ] `supabase/config.toml` `project_id` updated
- [ ] RLS smoke seed UUIDs still work (verify `sql_smoke_seed.sql` runs clean)
- [ ] `rls-harness.yml` env var `SUPABASE_PROJECT_ID` updated
- [ ] `sql_smoke_runner.py` `PROJECT` default updated

---

## Adding a new auth provider

When enabling Apple, Microsoft, magic link, or other OAuth providers:

- [ ] Provider enabled in Supabase Dashboard → Auth → Providers
- [ ] Redirect URL for that provider added to `uri_allow_list` if different from `site_url`
- [ ] GCP (or provider-specific) credentials configured
- [ ] `AuthGate.jsx` updated with new sign-in option
- [ ] `useAuth.js` handles any provider-specific edge cases
- [ ] `AuthGate.test.jsx` covers the new provider's `signInWithOAuth` call params

---

## Root cause reference

The Supabase allowlist section was added after the 2026-04-21 incident: `lhr-present.github.io/sporeus-athlete/` remained in the allowlist for 5 days after the CNAME migration to `app.sporeus.com`. See `docs/ops/security/incidents/2026-04-21-stale-redirect-url.md`.
