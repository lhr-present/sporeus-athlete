# Data Inventory — Sporeus Athlete App
**Version:** v8.2.7  
**Last updated:** 2026-04-19  
**Legal basis codes:** C = Consent · K = Contract · LI = Legitimate Interest · EC = Explicit Consent (GDPR Art.9)

This document covers every table that stores user-identifiable data. It satisfies:
- GDPR Article 30 (Records of Processing Activities)
- KVKK Article 5 (Legal basis for processing personal data)
- KVKK Article 6 (Special-category data — health data)

---

## profiles

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| id | FK to auth.users | Account lifetime | Personal (pseudonym) | K |
| email | Authentication, transactional email | Account lifetime | Personal | K |
| name | Display only | Account lifetime | Personal | K |
| language | UI language preference | Account lifetime | Personal | K |
| subscription_status | Feature gating | Account lifetime | Personal | K |
| subscription_tier | Feature gating | Account lifetime | Personal | K |
| trial_ends_at | Trial management | Account lifetime | Personal | K |
| subscription_end_date | Billing lifecycle | Account lifetime | Personal | K |
| grace_period_ends_at | Billing lifecycle | Account lifetime | Personal | K |
| first_touch | UTM attribution (never overwritten) | Account lifetime | Personal | LI |
| morning_briefing_enabled | Coach feature preference | Account lifetime | Personal | K |

---

## training_log

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| id | Row identity | Account lifetime | — | K |
| user_id | FK to athlete | Account lifetime | Personal | K |
| date | Session date | Account lifetime | Personal | K |
| type | Sport type | Account lifetime | Personal | K |
| duration | Session length | Account lifetime | Personal | K |
| tss | Training Stress Score | Account lifetime | Personal | K |
| rpe | Perceived exertion | Account lifetime | Personal (self-reported) | EC |
| bpm_avg / bpm_max | Heart rate | Account lifetime | **Health — Art.9** | EC |
| power_norm / power_peaks | Cycling power | Account lifetime | **Health — Art.9** | EC |
| distance_km | Distance | Account lifetime | Personal | K |
| notes | Free text (may contain health info) | Account lifetime | **Health — Art.9** | EC |
| hrv / hrv_rmssd | HRV — heart rate variability | Account lifetime | **Health — Art.9** | EC |
| mental_state | Self-reported mental state 1–5 | Account lifetime | **Health — Art.9** | EC |
| session_tag | Auto-classified tag | Account lifetime | Personal | K |
| session_tag_reason | Classification reason | Account lifetime | Personal | K |
| embedding | Vector (session embedding for RAG) | Account lifetime | Derived | K |

---

## injuries

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| user_id | FK to athlete | Account lifetime | — | K |
| type / location | Injury description | Account lifetime | **Health — Art.9** | EC |
| severity | Injury severity | Account lifetime | **Health — Art.9** | EC |
| notes | Free text | Account lifetime | **Health — Art.9** | EC |
| resolved_at | Recovery tracking | Account lifetime | **Health — Art.9** | EC |

---

## ai_insights

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| athlete_id | FK to athlete | Account lifetime | Personal | C (ai_processing) |
| content | AI-generated text | Account lifetime | Personal (derived) | C (ai_processing) |
| surface | Which AI surface | Account lifetime | Personal | C |
| prompt_version | Audit trail | Account lifetime | — | LI |

---

## consents / consent_purposes

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| user_id | FK to athlete | Account lifetime + 1 year | Personal | K (legal obligation) |
| consent_type / purpose | What was consented to | Account lifetime + 1 year | Personal | K |
| granted_at / changed_at | Timestamp of consent | Account lifetime + 1 year | Personal | K |
| withdrawn_at / granted | Withdrawal timestamp | Account lifetime + 1 year | Personal | K |

> Consent records are retained for 1 year post-deletion for regulatory compliance.

---

## audit_log

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| user_id | Traceability | 1 year | Personal | LI |
| action | What happened | 1 year | Personal | LI |
| table_name / resource | What was affected | 1 year | — | LI |
| details | Additional context | 1 year | May contain personal refs | LI |
| ip_address | Security audit | 90 days | Personal | LI |

> Audit log rows for deleted accounts are retained with user_id for 1 year for legal obligation, then purged by the client-events-ttl cron job (adapted).

---

## strava_tokens

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| user_id | FK | Account lifetime | Personal | C (strava_sync) |
| access_token (encrypted) | API auth | Until revoked | Personal — credential | C |
| refresh_token (encrypted) | Token refresh | Until revoked | Personal — credential | C |
| strava_athlete_id | Strava account link | Until revoked | Personal | C |

---

## billing_events

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| user_id | FK | Immutable — legal requirement | Personal | K |
| amount_usd | Payment amount | Immutable | Financial | K |
| event_type | Subscription lifecycle | Immutable | — | K |
| processor | Dodo / Stripe | Immutable | — | K |

> **Immutable:** billing_events rows are NEVER updated or deleted. This is a legal requirement for financial audit trails.

---

## attribution_events

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| anon_id | Pre-auth tracking | 90 days | Pseudonymous | LI |
| user_id | Post-auth stitching | 90 days | Personal | LI |
| utm_* | Campaign attribution | 90 days | Personal (indirect) | LI |
| event_type | Conversion funnel | 90 days | — | LI |

---

## client_events

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| user_id | Attribution | **30-day TTL** | Personal | LI |
| event_name | Feature usage | 30 days | — | LI |
| properties | Event metadata | 30 days | May contain personal refs | LI |

---

## personal_records

| Column | Purpose | Retention | Sensitivity | Legal basis |
|--------|---------|-----------|-------------|-------------|
| user_id | FK | Account lifetime | Personal | K |
| category | PR type | Account lifetime | Personal | K |
| value / prev_value | Record values | Account lifetime | Personal | K |

---

## Health Data Note (GDPR Art.9 / KVKK Art.6)

The following fields qualify as **special-category health data**:

- `training_log`: `bpm_avg`, `bpm_max`, `hrv`, `hrv_rmssd`, `mental_state`, notes (when health content)
- `injuries`: all fields
- `training_log.rpe`: borderline — physiological self-assessment

**Legal basis required:** Explicit consent (GDPR Art.9(2)(a) / KVKK Art.6(2)).  
**Implementation:** `consent_purposes.health_data = true` must be set before storing these fields.  
**DPO review required before:** adding new health-relevant fields, changing retention periods, new third-party processors.

---

## Third-Party Data Flows

See `docs/privacy/third_party_disclosures.md` for Strava, Dodo, Stripe, Anthropic, Axiom DPA status.
