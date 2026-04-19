# Third-Party Data Disclosures — Sporeus
**Version:** v8.2.7 | **Last updated:** 2026-04-19

---

## 1. Strava

**What Sporeus stores:**
- Strava athlete ID (numeric), display name, profile picture URL
- OAuth tokens (access + refresh) — AES-256 encrypted at rest in `strava_tokens`
- Activity metadata imported on sync: date, type, distance, duration, HR data, power data

**What Sporeus fetches on-demand but does not store:**
- Full activity streams (fetched per sync, stored in training_log, raw stream discarded)

**What Strava receives from Sporeus:**
- OAuth callback code (single use, 5-min expiry)
- No personal health data sent to Strava

**DPA status:** Strava processes data under their own Privacy Policy. Sporeus–Strava is a user-authorised OAuth integration. No separate DPA required.

**User control:** Users can revoke Strava access at any time via Profile → Connections. Revocation deletes the access/refresh tokens from `strava_tokens` immediately.

---

## 2. Anthropic (Claude API)

**What Sporeus sends to Anthropic:**
- Training session metadata for analysis (date, type, duration, TSS, RPE, HR, power — no names)
- Weekly summaries containing aggregated training metrics
- RAG context: top-10 similar sessions (text summary, no raw files)
- Coach queries with session context

**What Sporeus does NOT send:**
- Full name, email address, or any directly identifying information
- Raw FIT or GPX file content
- Injury details or mental state scores as standalone fields (may appear in session notes if user typed them)

**Data minimisation:** Every prompt is constructed by the ai-proxy edge function, which injects only the metrics relevant to the query. Session notes are truncated to 200 characters.

**Anthropic DPA:** Anthropic processes API data under their Privacy Policy and API Terms. For GDPR compliance, Anthropic is classified as a **data processor** for Sporeus's purposes. A Data Processing Agreement (DPA) with Anthropic is available at anthropic.com/legal. Sporeus should execute this DPA. **Status: PENDING — operator action required.**

**User control:** Revoking `consent_purposes.ai_processing` stops all future AI calls for that user. Existing ai_insights are retained until account deletion.

---

## 3. Dodo Payments

**What flows through Dodo:**
- Name, email, billing address (collected by Dodo checkout, not stored in Sporeus)
- Payment method (Dodo tokenises — Sporeus stores no card data)
- Webhook events: `subscription.created`, `.updated`, `.cancelled`, `.past_due`

**What Sporeus stores from Dodo webhooks:**
- `billing_events`: event_type, amount, currency, processor='dodo', user_id, timestamp
- `profiles.subscription_status`, `subscription_tier`, relevant dates

**Dodo DPA:** Dodo is a licensed payment processor (PCI-DSS compliant). Dodo acts as an independent data controller for payment processing. Sporeus does not need a DPA with Dodo for payments.

---

## 4. Stripe

**What flows through Stripe:**
- Same as Dodo (Stripe checkout collects payment data directly)
- Sporeus receives webhook events only

**What Sporeus stores from Stripe:**
- Same `billing_events` pattern as Dodo (processor='stripe')

**Stripe DPA:** Available and pre-accepted via Stripe's standard Terms. **Status: Accepted via Stripe account settings.**

---

## 5. Axiom (Telemetry)

**What Sporeus sends to Axiom:**
- Edge function logs: function name, duration, status, error messages
- Client telemetry: event_name, properties (no PII in event names by design)
- No user IDs are sent to Axiom — all telemetry is pseudonymised with session tokens

**Axiom DPA:** Axiom is a data processor. DPA available at axiom.co/legal. **Status: PENDING — operator action required.**

**Retention in Axiom:** 30-day log retention configured in Axiom dashboard.

---

## 6. Resend (Email)

**What Sporeus sends to Resend:**
- User email address (for transactional emails: export ready, deletion confirmation, dunning)
- No health data or session data

**Resend DPA:** Available at resend.com/legal. **Status: PENDING — operator action required.**

---

## 7. OpenAI (Embedding API)

**What Sporeus sends to OpenAI:**
- Session text representations (type, duration, TSS, RPE, notes — same format as Anthropic prompts)
- Used for `text-embedding-3-small` to generate session vectors for RAG

**OpenAI DPA:** Available at platform.openai.com/docs/privacy. **Status: PENDING — operator action required.**

---

## Summary Table

| Provider | Role | Data type | DPA required | Status |
|----------|------|-----------|--------------|--------|
| Strava | User-authorised integration | OAuth + activity meta | No | N/A |
| Anthropic | Data processor (AI) | Session metrics (pseudonymised) | Yes | ⚠️ Pending |
| Dodo | Independent controller (payments) | Billing events | No | N/A |
| Stripe | Independent controller (payments) | Billing events | No | Accepted |
| Axiom | Data processor (telemetry) | Logs (pseudonymised) | Yes | ⚠️ Pending |
| Resend | Data processor (email) | Email addresses | Yes | ⚠️ Pending |
| OpenAI | Data processor (embeddings) | Session metrics (pseudonymised) | Yes | ⚠️ Pending |
