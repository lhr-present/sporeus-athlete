# Sporeus Athlete — Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Contact**: huseyinakbulut71@gmail.com  
**Subject line**: `[SECURITY] Sporeus — <brief description>`

Please include:
- Description of the vulnerability and its potential impact
- Steps to reproduce (minimal proof-of-concept preferred)
- Affected component (edge function, RLS policy, API endpoint, frontend)

## Acknowledgment Timeline

| Stage | Timeline |
|-------|----------|
| Initial acknowledgment | Within 48 hours |
| Triage and severity assessment | Within 7 days |
| Fix deployed (critical/high) | Within 14 days of confirmation |
| Public disclosure | After fix deployed, coordinated with reporter |

## Scope

**In scope:** tenant isolation bypass, JWT forgery/bypass, privilege escalation, data exfiltration, stored XSS, SSRF/injection via edge functions, storage bucket traversal, webhook replay attacks.

**Out of scope:** DoS attacks, social engineering, physical access, vulnerabilities in third-party services (Supabase, Anthropic, Stripe, Dodo), issues already documented in `docs/security/pentest_findings_v811.md`.

## Bounty Policy

No formal bug bounty program. Critical findings (full tenant isolation bypass, account takeover) receive public acknowledgment and coordinated disclosure.

## Responsible Disclosure

1. Do not access or exfiltrate real user data — use accounts you control
2. Do not publicly disclose until we have had a reasonable opportunity to fix it
3. Do not perform destructive testing against any environment

## Security Testing Infrastructure

- **Weekly**: adversarial RLS pentest (`rls-pentest.yml`) — 51 attack scenarios across 7 attacker personas
- **Per migration PR**: standard RLS harness (`rls-harness.yml`) — 220+ tenancy isolation tests
- Findings tracked in [`docs/security/pentest_findings_v811.md`](docs/security/pentest_findings_v811.md)

---

## RLS Policy Reference

All tables have RLS enabled. Policies enforce that users can only access their
own data, with coaches allowed read access to their active athletes.

---

## Policies by Table

### `profiles`
| Policy | Access |
|---|---|
| `profiles: own row` | User reads/writes own profile (`auth.uid() = id`) |
| `profiles: coaches read athletes` | Coach reads profiles of active athletes in their squad |

### `training_log`
| Policy | Access |
|---|---|
| `training_log: own rows` | User reads/writes own log entries |
| `training_log: coaches read athletes` | Coach reads athletes' logs (active squad) |

### `recovery`
| Policy | Access |
|---|---|
| `recovery: own rows` | User reads/writes own recovery entries |
| `recovery: coaches read athletes` | Coach reads athletes' recovery data |

### `injuries`
| Policy | Access |
|---|---|
| `injuries: own rows` | User reads/writes own injury records |
| `injuries: coaches read athletes` | Coach reads athletes' injury data |

### `test_results`
| Policy | Access |
|---|---|
| `test_results: own rows` | User reads/writes own test results |
| `test_results: coaches read athletes` | Coach reads athletes' test results |

### `race_results`
| Policy | Access |
|---|---|
| `race_results: own rows` | User reads/writes own race results |
| `race_results: coaches read athletes` | Coach reads athletes' race results |

### `coach_athletes`
| Policy | Access |
|---|---|
| `coach_athletes: coach or athlete` | Coach manages; athlete can view own record |

### `coach_invites`
| Policy | Access |
|---|---|
| `coach_invites: coach manages own` | Coach creates/reads/updates their own invites |
| `coach_invites: athlete reads active` | Athlete can read unused, non-expired invite by code |

### `coach_notes`
| Policy | Access |
|---|---|
| `coach_notes: coach writes, athlete reads own` | Coach writes notes; athlete reads notes about themselves |
| `coach_notes_coach` (override) | Full coach access |
| `coach_notes_athlete_read` (override) | Athlete read-only |

### `coach_plans`
| Policy | Access |
|---|---|
| `coach_plans: coach manages` | Coach creates/updates plans for their athletes |
| `coach_plans: athlete reads` | Athlete reads plans where they are the target |

### `strava_tokens`
| Policy | Access |
|---|---|
| `strava_tokens: own row` | User reads/writes own Strava tokens only |

### `push_subscriptions`
| Policy | Access |
|---|---|
| `push_subscriptions: own rows` | User reads/writes own push subscription |

### `api_keys`
| Policy | Access |
|---|---|
| `api_keys_owner` | Owner reads/writes own API keys |

### `org_branding`
| Policy | Access |
|---|---|
| `org_branding_owner` | Owner manages own org branding |

### `referral_codes` / `referral_rewards`
| Policy | Access |
|---|---|
| `coach inserts own referral code` | Coach creates their code |
| `coach reads own referral code` | Coach reads their own code |
| `authenticated updates referral code` | Any authenticated user can increment usage |
| `coach reads own rewards` | Coach reads their reward records |

### `messages`
| Policy | Access |
|---|---|
| `msg_coach_select` | Coach reads messages involving their athletes |
| `msg_coach_insert` | Coach sends messages to their athletes |
| `msg_athlete_select` | Athlete reads their own messages |
| `msg_athlete_insert` | Athlete sends messages to their coach |
| `msg_athlete_update` | Athlete marks messages as read |

### `training_plans`
| Policy | Access |
|---|---|
| `Users manage own plan` | User reads/writes their own training plan |

### `athlete_devices`
| Policy | Access |
|---|---|
| `Users manage own devices` | User reads/writes their own device sync records |

### `ai_insights`
| Policy | Access |
|---|---|
| `ai_insights_tier_check` | Enforces tier-based access limits (enforced server-side) |

### `batch_errors`
| Policy | Access |
|---|---|
| `batch_errors_service_only` | DENY all direct client access; service-role only |

---

## npm Dependency Vulnerability Status

Last audit: 2026-04-18 — **4 high** (build-time only, not runtime)

| CVE / Advisory | Package | Affected chain | Status |
|---|---|---|---|
| GHSA-h4j5-c7cj-74xg (playwright SSL cert bypass) | `playwright` | devDep | **Fixed** — `npm audit fix`, updated to patched version |
| GHSA-g644-9gfx-q4q4 (RCE via RegExp.flags) | `serialize-javascript@6.x` | workbox-build → @rollup/plugin-terser | **Open** — see below |
| GHSA-wr3j-pwj9-hqq6 (CPU exhaustion DoS) | `serialize-javascript@6.x` | same chain | **Open** — see below |
| + 2 more transitive | inherited from above | same chain | **Open** — see below |

### serialize-javascript chain — accepted risk

The 4 remaining HIGH advisories all trace to `serialize-javascript@6.x` via:
`vite-plugin-pwa → workbox-build → @rollup/plugin-terser → serialize-javascript`.

**Why not overridden:** Forcing `serialize-javascript@7.x` via npm `overrides` breaks builds on Node 18.x
(`ReferenceError: crypto is not defined` — Node 18 CJS doesn't expose `crypto` as a global; v7.x requires it).

**Actual risk:** The vulnerable code runs only during `npm run build` on developer/CI machines — never in the
browser or on edge functions. Exploit requires a malicious actor to control the data being serialized during
the build process. Risk is accepted until `workbox-build` or `vite-plugin-pwa` ships a fix upstream.

---

## Security Notes

- **Service role key** is only used in Supabase edge functions — never exposed to the browser.
- **Anon key** (`VITE_SUPABASE_ANON_KEY`) is safe to expose; RLS enforces all access.
- **VAPID keys**: public key in `VITE_VAPID_PUBLIC_KEY` is safe; private key is server-only.
- **Strava tokens**: stored encrypted in `strava_tokens` table; never returned to client beyond the access token needed for API calls.
- **coach_invites codes**: single-use (`used_by uuid`), 7-day expiry, validated server-side in `redeem-invite` edge function.
- **No API secrets in source**: `SPOREUS_SALT` and `MASTER_SALT` in `formulas.js` are unlock-code salts — not cryptographic secrets.
