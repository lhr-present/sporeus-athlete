# Security Breach Response Runbook — Sporeus
**Version:** v8.2.7 | **Last updated:** 2026-04-19

This runbook applies to any security incident involving unauthorized access to, or disclosure of, Sporeus user data.

**Legal obligations:**
- GDPR Art.33: Notify supervisory authority within **72 hours** of becoming aware
- GDPR Art.34: Notify affected users without undue delay if high risk to rights
- KVKK Art.12: Notify KVK Board within **72 hours** of breach detection

---

## 1. Detection Triggers

Incidents may be detected via:
- Axiom alert rules (C5 alert-monitor): unusual query volume, service-role calls outside expected patterns
- `operator_alerts` table flags (system_status anomalies)
- External report from security researcher, user, or third party
- Strava, Anthropic, or other provider notifying Sporeus

**Axiom query to check for anomalous service-role activity:**
```
dataset=supabase | filter level="error" OR level="warning" | filter actor_role="service_role" | summarize count() by table_name, action
```

---

## 2. Immediate Containment (T+0 to T+1h)

- [ ] Identify the vector: which table, API endpoint, or edge function was affected
- [ ] Identify the scope: which user IDs / how many records
- [ ] Rotate compromised credentials immediately:
  - Supabase service role key → regenerate in Supabase dashboard → update all edge function secrets
  - ANTHROPIC_API_KEY if exposed → revoke in Anthropic console
  - VAPID keys if push endpoint compromised
- [ ] Disable affected edge function if still exploitable:
  ```bash
  npx supabase functions delete <function-name> --project-ref pvicqwapvvfempjdgwbm
  ```
- [ ] Revoke all active Supabase sessions if auth is compromised:
  ```sql
  -- Run via Supabase SQL editor
  DELETE FROM auth.sessions;
  ```
- [ ] Freeze Strava token refresh if Strava integration is involved
- [ ] Document: time of discovery, initial scope estimate, immediate actions taken

---

## 3. Assessment (T+1h to T+6h)

- [ ] Query audit_log for the affected time window:
  ```sql
  SELECT user_id, action, table_name, ip_address, created_at
  FROM audit_log
  WHERE created_at BETWEEN '<start>' AND '<end>'
  ORDER BY created_at;
  ```
- [ ] Determine data categories affected:
  - Personal identifiers (name, email)
  - Health data (HRV, injuries — Art.9 / KVKK Art.6)
  - Financial data (billing_events)
  - Authentication credentials
- [ ] Estimate number of affected users
- [ ] Assess whether breach is still ongoing
- [ ] Preserve evidence: export audit_log to secure location before any cleanup

---

## 4. Notification — Supervisory Authority (T+0 to T+72h)

**Turkey (KVKK):**
- Notify KVK Board via e-Devlet or email: kvkkbaskanligi@kvkk.gov.tr
- Subject: `[KVKK Madde 12 Bildirimi] Kişisel Veri İhlali - Sporeus`
- Required content:
  - Nature of the breach
  - Categories and approximate number of data subjects
  - Likely consequences
  - Measures taken or proposed
  - Contact: huseyinakbulut71@gmail.com

**EU (GDPR) — if EU users affected:**
- Notify lead supervisory authority (depends on EU establishment — if none, notify authority in each affected member state)
- Use SA's online notification portal

---

## 5. User Notification Template

If users are at high risk from the breach:

```
Subject: Important security notice regarding your Sporeus account

We are writing to inform you of a security incident that may have affected your account on [DATE].

What happened: [Brief factual description]

What data was involved: [Categories — e.g., "training session data", "email address"]

What we have done: [Containment actions taken]

What you should do:
- Change your Sporeus password immediately
- If you use the same password elsewhere, change it there too
- [If credentials exposed] Monitor for suspicious account activity

We are sorry this happened. We take your data privacy seriously.

For questions: support@sporeus.com
```

---

## 6. Recovery

- [ ] Deploy fix to affected edge function or apply RLS patch
- [ ] Re-run RLS pentest suite (`tests/rls/`) to verify no remaining bypass
- [ ] Force-refresh all affected users' session tokens
- [ ] Re-enable disabled edge functions only after fix verified
- [ ] Write postmortem within 5 business days (template below)

---

## 7. Post-Mortem Template

```markdown
# Security Incident Post-Mortem — [DATE]

## Summary
[1–2 sentence description of what happened and impact]

## Timeline
| Time | Event |
|------|-------|

## Root Cause
[Technical root cause — be specific]

## Impact
- Affected users: N
- Data categories: 
- Duration of exposure: 

## What went well
- 

## What went wrong
- 

## Action items
| Owner | Action | Due date |
|-------|--------|----------|
```

---

## 8. Contacts

| Role | Contact |
|------|---------|
| Operator | huseyinakbulut71@gmail.com |
| Supabase support | support@supabase.io |
| Anthropic security | security@anthropic.com |
| KVK Board (Turkey) | kvkkbaskanligi@kvkk.gov.tr |
| GDPR DPA notification | Via national SA portal |
