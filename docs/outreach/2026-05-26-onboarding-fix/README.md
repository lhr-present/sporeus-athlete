# 2026-05-26 — Onboarding fix outreach drafts

Drafts for the 4 prod users who hit the pre-v9.328 "Skip all →" wizard trap and ended up with `profiles.sport=null`. Outreach explains the fix and invites them to re-engage.

## Background

The four affected accounts:

| Email | Display name | Signed up |
|---|---|---|
| naghmeh.olapoor@gmail.com | naghmeh olapoor | 2026-04-13 |
| tongelozgur1@gmail.com | tongelozgur1 | 2026-05-10 |
| turkyilmaztc@gmail.com | turkyilmaztc | 2026-05-10 |
| turkyilmaz@gmail.com | turkyilmaz | 2026-05-11 |

All four have `profiles.sport=null` and zero training_log entries. The wizard's "Skip all →" button at upper-right was the dismiss path; pre-v9.328 a single click permanently flipped `onboarded=true`. The v9.328 + v9.329 + v9.330 + v9.331 + v9.332 + v9.333 chain (this week) fixes the funnel forward, and v9.329's SetupBanner gives these legacy users a recovery path inside the app.

## Why personal outreach in addition to the banner

The banner only triggers when the user opens the app. Three of these users last signed in weeks ago and may not return on their own. A personal email is the lowest-friction nudge — and at this user count (4 affected), it's also feasible to send manually.

## Drafts

- `naghmeh-en.txt` — English; cross-cultural-safe default
- `tongel-tr.txt` — Turkish, addressed to "Özgür"
- `turkyilmaztc-tr.txt` — Turkish, generic salutation
- `turkyilmaz-tr.txt` — Turkish, generic salutation

(turkyilmaztc and turkyilmaz may be the same person with two addresses. If so, send only one.)

## How to send

1. Either:
   - Re-authenticate the Claude Gmail connector with `gmail.compose` scope (the configured connector only has read permissions, so I couldn't create the drafts via MCP)
   - Or copy each `.txt` into a new Gmail compose window manually

2. Personalize before sending — these are templates, not finished messages. Things you might want to adjust:
   - Tone (more formal/casual)
   - Add a screenshot of the new banner
   - Localize the link
   - Add unsubscribe / why-you're-getting-this footer if appropriate

3. Do not bcc the user list — send individually so replies are personal.
