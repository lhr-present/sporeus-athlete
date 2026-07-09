# Operator Launch Checklist — the five gates to the first stranger

_2026-07-09 · prepared against live config (Management API readback). Code-side publish work is
complete as of v9.496; these five items are dashboard/account actions only the founder can take.
Work top to bottom — items 1 and 2 have lead times, start them first._

---

## ✅ 3. Auth redirect allowlist — DONE (applied 2026-07-09 via Management API)

`site_url = https://app.sporeus.com` (was already correct) and the allowlist now reads:

```
http://localhost:5173/, https://app.sporeus.com, https://app.sporeus.com/, https://app.sporeus.com/**
```

Password-reset links, signup confirmations, and magic links all redirect to
`window.location.origin` — every variant is covered. **Nothing to do.**

---

## ✅ 5. Deletion purge cron — VERIFIED PRESENT + armed

- `purge-deleted-accounts` cron: **jobid 10, daily 04:00 UTC, active** (live query).
- The edge function honors a grace period before hard-deleting, and `RESEND_API_KEY` is optional
  (no email notify until item 2 gives us Resend — purging still works without it).
- **One founder action remains, later:** after the FIRST real account deletion (yours or a
  tester's), confirm the row disappears after the grace period:
  ```bash
  # run any time after grace expiry; expect zero rows for the deleted user
  npx supabase db query --linked "select count(*) from training_log where user_id = '<deleted-uid>'"
  ```

---

## 🔴 1. Strava app athlete cap — START TODAY (longest lead time: Strava review takes days–weeks)

Right now the Strava app is in single-athlete mode: **only you can connect**. Every stranger's
Strava funnel is dead until Strava approves the app.

1. Go to https://www.strava.com/settings/api → your app (`Sporeus`).
2. Confirm the app details are review-ready (they matter for approval):
   - **Website**: `https://app.sporeus.com` · **Callback domain**: `app.sporeus.com`
   - App icon uploaded (`public/strava-app-icon.png` is in the repo if needed).
3. Follow the "request capacity increase" link in the API settings (Strava routes this through
   their Developer Program form).
4. Answers to have ready (copy-paste candidates):
   - *What does your app do?* — "Sporeus Athlete Console is a free training-analysis PWA for
     endurance athletes (rowing, running, cycling, swimming). Athletes connect Strava to import
     their activity history; the app computes training load (TSS/CTL), zones, readiness and
     science-based training plans. Read-only: `activity:read_all`; we never write to Strava."
   - *Data use / privacy* — link `https://app.sporeus.com` → Profile → Privacy Policy (discloses
     Strava as a source, retention, deletion path — all live since v9.493-496).
   - Requested athlete count: start with 99 (the standard first tier — approvals are faster).
5. **Verify after approval**: connect a second Strava account (a friend's) end-to-end.

---

## 🔴 2. Custom SMTP — DO THIS WEEK (signups are throttled to ~2 emails/HOUR without it)

Live config readback: `smtp_host: None`, `rate_limit_email_sent: 2`. Supabase's built-in mailer
is a demo tool; two strangers signing up in the same hour = the second gets no confirmation email.

**Recommended: Resend** (free tier 3k emails/mo, you can verify the sporeus.com domain, and the
same API key lights up the operator-digest emails + deletion notifications that are already coded
and dormant).

1. https://resend.com → create account → **Domains** → add `sporeus.com` → add the 3 DNS records
   (SPF/DKIM/return-path) in cPanel → wait for "Verified".
2. **API Keys** → create key (`sporeus-auth-smtp`) → copy `re_...`.
3. Tell me the key is ready (paste it into the session), and I run — or run yourself:
   ```bash
   PAT=$(cat ~/.config/supabase/access-token)
   curl -s -X PATCH "https://api.supabase.com/v1/projects/pvicqwapvvfempjdgwbm/config/auth" \
     -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
     -d '{
       "smtp_host": "smtp.resend.com",
       "smtp_port": "465",
       "smtp_user": "resend",
       "smtp_pass": "re_XXXXXXXXXXXX",
       "smtp_admin_email": "noreply@sporeus.com",
       "smtp_sender_name": "Sporeus",
       "rate_limit_email_sent": 100
     }'
   # and give the digest + deletion-notify the same key:
   SUPABASE_ACCESS_TOKEN=$PAT npx supabase secrets set RESEND_API_KEY=re_XXXXXXXXXXXX --project-ref pvicqwapvvfempjdgwbm
   ```
4. **Verify**: sign up a throwaway email → confirmation arrives within a minute, sender
   `Sporeus <noreply@sporeus.com>`; then trigger a password reset → same.

---

## 🔴 4. DODO / STRIPE webhook secrets — BEFORE ANNOUNCING PAID TIERS (billing is silently dead)

Live secret list has neither `DODO_WEBHOOK_SECRET` nor `STRIPE_WEBHOOK_SECRET` — paid checkouts
complete at the processor but the webhook can't be verified, so **entitlements are never granted**.

1. **Dodo**: dashboard → Developer → Webhooks → endpoint
   `https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/dodo-webhook` (create if missing,
   events: payment/subscription lifecycle) → reveal **Signing Secret**.
2. **Stripe**: dashboard → Developers → Webhooks → endpoint
   `https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/stripe-webhook`
   (events: `checkout.session.completed`, `customer.subscription.updated/deleted`) → reveal
   **Signing secret** (`whsec_...`).
3. Paste both to me, or run:
   ```bash
   SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) npx supabase secrets set \
     DODO_WEBHOOK_SECRET=whsec_or_dodo_secret \
     STRIPE_WEBHOOK_SECRET=whsec_XXXX \
     --project-ref pvicqwapvvfempjdgwbm
   ```
   (Edge functions read secrets at invocation — no redeploy needed.)
4. **Verify**: Stripe dashboard → the webhook → "Send test event" → expect 200 in the log;
   then one real €-smallest checkout end-to-end → tier appears on the account.

_Note: if paid tiers aren't part of the first-stranger launch, this item can wait — nothing else
depends on it. Free signup + Strava + programs work without billing._

---

## Order of operations for launch day

1. Items 1+2 done and verified → **the app can take strangers** (free tier fully works).
2. Announce softly (the IG channel is ready); watch `operator_alerts` + the new cron-failure
   alerting (v9.486) — they now cover queue depth, DLQ, cron failures, RLS spikes, storage.
3. Item 4 whenever payments matter; item 5's confirmation after the first deletion.
