# Security Operations Checklist

## Supabase Dashboard Controls (manual — not in migrations)

### Leaked Password Protection
- **Location:** Supabase Dashboard → Authentication → Providers → Email → Enable "Prevent use of leaked passwords"
- **Status:** Disabled (not toggleable via SQL; requires dashboard or Management API)
- **Action:** Enable before public launch. Supabase checks against HaveIBeenPwned on sign-up/password change.
- **API toggle:** `PATCH /v1/projects/{ref}/config/auth` with `{"security": {"refresh_token_rotation_enabled": true}}`

### MFA Enforcement for Admin Users
- Admin users (profiles.role = 'admin') cannot be MFA-enforced via RLS alone.
- Recommended: require MFA at application level before exposing admin routes.
- Supabase Pro: Auth > Multi-Factor Authentication > Require MFA for all users (or specific users).

### API Key Rotation Cadence
| Key | Rotation | Location |
|-----|----------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | 90 days or on incident | Supabase Dashboard → API → Service Role Key |
| `DODO_WEBHOOK_SECRET` | On compromise | Dodo dashboard → regenerate, update Supabase secret |
| `STRIPE_WEBHOOK_SECRET` | On compromise | Stripe dashboard → Webhooks → regenerate |
| `RESEND_API_KEY` | 90 days | Resend dashboard → API Keys |
| `VITE_SUPABASE_ANON_KEY` | On compromise (public key — low risk) | Supabase Dashboard |

To rotate a Supabase secret (edge function env):
```bash
supabase secrets set KEY_NAME=new_value --project-ref pvicqwapvvfempjdgwbm
```

---

## Accepted Risks (documented, not fixable)

### Extensions in Public Schema
- `pg_net` and `pgtap` are installed in the `public` schema (Supabase-managed placement).
- Advisors flag this; cannot be moved without Supabase support ticket.
- Risk: low — extensions are not SECURITY DEFINER, no attack surface unless attacker has DB write access.

### Materialized Views in API Schema
- `mv_ctl_atl_daily`, `mv_weekly_load_summary`, `mv_squad_readiness` are exposed via PostgREST.
- RLS does not apply to MVs. Access is controlled by the underlying functions (`get_load_timeline`, `get_squad_readiness`, `get_weekly_summary`) which use `auth.uid()` in their WHERE clauses.
- Direct MV access via REST requires a row-level filter added manually if needed.

### ai_insights Permissive Policy Overlap
- `ai_insights: service write` (uses `current_setting`) and `ai_insights_tier_check` both apply to INSERT.
- Not merged because service-write is intentionally a separate bypass for edge functions.
- Accepted: INSERT permission union is intentional — tier check ensures only coach/club-tier can trigger the insert path.

---

## Completed Hardening (v11.1.0)

- [x] 17 SECURITY DEFINER functions: `SET search_path = ''` via ALTER FUNCTION
- [x] 10 SECURITY DEFINER functions: body rewritten to use `public.*`, `SET search_path = ''`
- [x] 59 RLS policies: bare `auth.uid()` → `(SELECT auth.uid())` initplan form
- [x] coach_notes: 3 permissive policies → 1
- [x] coach_sessions SELECT: 2 permissive SELECT policies → 1 merged
- [x] messages INSERT: 2 → 1; messages SELECT: 2 → 1
- [x] 26 unused indexes dropped
- [x] 3 missing FK indexes added
