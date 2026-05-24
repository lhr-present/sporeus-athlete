# Autopilot Directives — Card-Building Agent

**Created:** 2026-05-25 (post v9.326.0)
**Purpose:** Guide the worktree autopilot agent's card-creation cadence so dashboard growth stays mission-aligned.

---

## Why this exists

Velocity audit (2026-05-25):
- **305 dashboard-card commits since 2026-05-01** vs **67 TodayView commits** (4.5× ratio)
- Dashboard now has **236 cards**, of which only **10** are in the Today/Prescription bucket
- The other 226 are retrospective analytics (Patterns 39, Load 37, Recovery 36, Intensity 30, VDOT 27, etc.)
- App mission ([[project_sporeus_mission]]): *"what should I do today?"* — minimum viable data → daily answer

The autopilot is shipping good science (each card cites a paper, each is tested) but at a cadence that **outruns the mission**. Dashboard density now creates cognitive load that fights the daily-answer promise.

## What's still wanted

- Pure-fn + card pattern is sound.
- Per-card science citation is sound.
- The "Companion cards in this codebase" docblock comments (e.g. in `ctlSlope.js`) are exactly right — keep them, expand them.
- Tests at parity with code: keep.

## What to redirect

### 1. Prefer **TodayView surface** over **Dashboard cards**
If a new pure-fn helps answer "what should the athlete do today / how hard / how to feel" → wire it into `src/components/TodayView.jsx`, not a new Dashboard card.

Examples of TodayView-worthy signals:
- Today's planned session adjustment (TSB-aware downgrade/upgrade)
- Today's HR/pace/RPE targets given current freshness
- Today's "go / wait / swap" recommendation with one-line reason
- Today's fueling/hydration target for the planned session

Examples of NOT TodayView-worthy (these are Dashboard analytics):
- 28-day trend X
- N-week pattern Y
- Lifetime aggregate Z

### 2. Before creating a new Dashboard card, check existing bucket density

Counts as of 2026-05-25 (see `docs/dashboard_card_inventory.md`):
- **Patterns 39, Load 37, Recovery 36, Intensity 30, VDOT 27** are saturated. Strong evidence already covered.
- **Today 10, Coach 9, Profile 9, Race 7, Nutrition 6** have room. New cards in these buckets are more likely to add value.

Rule of thumb: **if a similarly-named function already exists, write a "Companion cards" comment explaining the distinct math instead of skipping — but pause and ask whether the new card belongs at all.**

### 3. Three cards / week MAX on Dashboard
Current cadence: ~5/day = 35/week. Drop to ≤3/week net additions on Dashboard. Use the remaining capacity for:
- TodayView improvements
- Coach/Squad surface
- Test coverage on existing untested files (see CLAUDE.md "Untested files")
- Migration backlog (recent: general_fitness_track, exercise_gaps, session_confirmation)

### 4. Per-commit checklist (before opening worktree merge)

- [ ] Does this card answer "what do I do today?" — if yes, prefer TodayView placement
- [ ] Does this card's signal already have ≥2 cards in its bucket — if yes, justify in commit body
- [ ] Is there a docblock "Companion cards" line distinguishing this from nearest neighbors
- [ ] Does the card cite a paper with year (existing pattern)
- [ ] Tests are at parity (lib pure-fn + jsx component)

### 5. Audit dependency

When an audit (human or agent) flags overlap groups, **read each cited file's docblock + math** before merging or deleting. False-positive rate observed 2026-05-25: 100% (3 of 3 sampled "duplicates" were distinct signals). See [[feedback_verify_audits_against_code]] in user memory.

## Things NEVER to do (existing CLAUDE.md invariants reinforced)

- Don't touch `flowType: 'implicit'`
- Don't touch `sporeus_log` localStorage key
- Don't delete cards autonomously — only the user approves card removal
- Don't add cards that duplicate without docblock justification

## Review cadence

This doc should be re-read by the autopilot agent at the start of each session.
Re-balance assessment by the user every 30 commits or 14 days, whichever is sooner.
