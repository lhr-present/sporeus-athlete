# 2026-05-26/27 — Onboarding outreach drafts

**Updated 2026-05-27**: Yesterday's draft set assumed 100% of users hit the "Skip all →" trap. Re-querying the correct column (`profile_data->>'sport'` in JSONB, not the top-level `profiles.sport`) shows **4 of 6 organic users completed sport pick on the old wizard**. The two users I previously drafted apology emails for (naghmeh, tongelozgur1) had sport set — drafts removed.

## Real funnel (2026-05-27)

| User | Signup | Sport | Action |
|---|---|---|---|
| naghmeh.olapoor | 04-13 | Running ✓ | OK, no outreach needed |
| tongelozgur1 | 05-10 | Other ✓ | OK, no outreach needed |
| **turkyilmaztc** | **05-10** | **null** | needs outreach |
| **turkyilmaz** | **05-11** | **null** | needs outreach |
| sofia.swirska | 05-25 | Running ✓ | brand new — consider welcome email |

The two `turkyilmaz` accounts may be the same person with two emails. If so, send only one.

## Drafts (sample-only, personalize before sending)

- `turkyilmaztc-tr.txt` — Turkish. Lighter framing now: "noticed you didn't finish setup, here's how the wizard's been improved"
- `turkyilmaz-tr.txt` — Turkish, generic salutation
- `sofia-welcome-en.txt` — Optional welcome email for the brand-new organic signup. She picked Running on the old wizard, which still works — but a personal welcome from the founder is a high-leverage retention nudge

## How to send

1. Either re-auth Claude's Gmail connector with `gmail.compose` scope OR copy-paste manually into Gmail
2. Personalize tone, add screenshots if helpful
3. Send individually (no bcc)

## Notes on previous claims

The "4/4 users hit the skip trap" diagnosis in v9.328-v9.331 changelog entries was based on the wrong column read. The v9.328-v9.333 onboarding fixes are still valuable — `Skip all →` IS still placed in the X-position, the wizard IS still 9 screens by default, and the SetupBanner WILL help the 2 unfilled users when they next visit. But the urgency was overstated. Forward velocity remains good (4 of 5 organic signups completed); the fixes improve a working funnel rather than rescue a broken one.
