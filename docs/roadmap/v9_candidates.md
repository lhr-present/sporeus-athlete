# Sporeus v9 — Candidate Feature Set
**Status:** Speculative. No commitments. Option set only.  
**Date:** 2026-04-19  
**Context:** v8.1.0 is the "done with v8" marker. v9 is the next major cycle.

---

## Framing

v8 was about building the full backend and hardening it to production grade.
v9 candidates are about distribution, platform width, and competitive differentiation.

Each candidate below has a **WHY** (strategic value), **COST** (rough effort), and **DEPENDENCY** (what must be true first).

None of these are committed. The right v9 scope depends on what user data and conversion funnel metrics show after v8.1.0 is live for 4–8 weeks.

---

## Tier 1 — High Confidence (address clear gaps)

### 1. Native Mobile App (React Native / Capacitor)
**Why:** Primary market is Turkish endurance athletes on iOS/Android. PWA works but App Store presence matters for trust + push notification reliability. Capacitor is already in package.json (`@capacitor/core` + `@capacitor/cli` `^8.3.0`).  
**Cost:** Medium. Scripts already exist (`npm run mobile:ios`, `npm run mobile:android`). Primary work is native push + App Store review.  
**Dependency:** Capacitor wiring already scaffolded. Missing: native push setup, App Store developer accounts (Turkey: App Store Connect).  
**Risk:** App Store review for health apps requires privacy justification. KVKK compliance statement needed in app metadata.

---

### 2. More Wearable Integrations
**Why:** Strava is connected. The high-value gaps are:
- **Garmin Connect API** — most serious athletes use Garmin hardware; webhook push or polling for new activities
- **Apple HealthKit** — iOS-native; steps, HRV, sleep from Apple Watch (Capacitor Health plugin)
- **Polar Flow** — popular in Turkey for running athletes  
**Cost:** Medium per integration. Strava OAuth pattern is reusable. Garmin has a well-documented API.  
**Dependency:** Mobile app (HealthKit requires native) or web-only for Garmin/Polar.  
**Priority order:** Garmin Connect → Polar → Apple HealthKit (requires mobile first)

---

### 3. Advanced Periodization UI (Block Periodization)
**Why:** Current plan generator is linear periodization. Block periodization (Issurin model: accumulation → transmutation → realization) is what advanced coaches actually use. This is the highest-value coach feature gap.  
**Cost:** Medium. Core Issurin logic is pure math (no deps). UI is incremental.  
**Dependency:** Existing `PlanGenerator.jsx` + `formulas.js` refactored to accept block model.

---

## Tier 2 — Medium Confidence (differentiation plays)

### 4. Coach-to-Coach Marketplace (Plans & Templates)
**Why:** Coaches who build good training plans could sell them. Network effect: more coaches → more plans → more athletes → more coaches. Similar to TrainingPeaks marketplace.  
**Cost:** High. Requires payment split (Dodo/Stripe Connect), plan versioning, preview UI, ratings.  
**Dependency:** Club tier users → marketplace sellers. Requires verified coach identity flow.  
**Risk:** Content moderation. Plans that cause injury are a liability. Requires ToS + KVKK addendum.

---

### 5. Group Challenges & Leaderboards (Squad Gamification)
**Why:** Social accountability is a proven retention mechanism. A "club 500km November challenge" with a live leaderboard is low-cost to implement and drives daily active use.  
**Cost:** Low-Medium. Needs `challenges` + `challenge_entries` tables; leaderboard view; UI.  
**Dependency:** None. Can ship independently.  
**Risk:** Leaderboards can demotivate less-fit athletes. Needs "personal best" framing option.

---

### 6. Video Session Embedding (Zoom/Meet Links)
**Why:** Coaches already schedule Zoom calls. A "session link" on `coach_sessions` rows that athletes can join directly from the app closes the communication loop.  
**Cost:** Low. One `meeting_url TEXT` column on `coach_sessions` + render in `SessionManager.jsx`.  
**Dependency:** None.

---

## Tier 3 — Lower Confidence (explore after signal)

### 7. Nutrition Tracking Integration
**Why:** Fueling is part of training load. Athletes ask for caloric tracking.  
**Cost:** High if building from scratch. Medium if integrating MyFitnessPal API or Cronometer.  
**Dependency:** API partnership or data import format. KVKK dietary data classification.  
**Signal needed:** Do users actually ask for this? Check support logs after v8.1.0.

---

### 8. Lactate Tracker Integration with Test Battery
**Why:** Sporeus already has lactate threshold tests (Protocols). A Bluetooth lactate analyzer (e.g., Lactate Pro 2) could push readings directly to the app.  
**Cost:** High. Requires Web Bluetooth API + device protocol reverse engineering.  
**Dependency:** Mobile app (Web Bluetooth is unreliable on iOS Safari).  
**Niche:** Very small market. Most athletes don't own lactate analyzers.

---

### 9. Oura / Whoop Integration
**Why:** HRV + sleep from wearables → better recovery scores.  
**Cost:** Medium. Oura API is documented. Whoop has a partner program (application required).  
**Dependency:** Oura/Whoop developer accounts. Whoop: B2B partnership pathway required.

---

## Anti-Candidates (explicitly not v9)

These were considered and rejected for v9:

| Idea | Why Not |
|---|---|
| AI personal coach chat (GPT-style) | Liability, hallucination risk for health advice. Not yet. |
| Social feed (Strava-style) | Wrong product. Privacy-first is a differentiator. Keep it. |
| Team billing / org accounts | Premature. Needs 50+ paying clubs to justify complexity. |
| React 19 / Vite 8 upgrade | Separate spike, not a product cycle. Do before v9.0.0 tag. |

---

## Pre-v9 Spike Requirements

Before any v9 candidate is scoped, the following must be true:

1. **v8.1.0 in production** — at least 4 weeks of conversion funnel data
2. **Attribution analysis** — which channels drive sign-ups + conversions
3. **Support log review** — what do users actually ask for
4. **Cohort retention curve** — D1/D7/D30 retention for free vs coach vs club
5. **Revenue baseline** — MRR, churn rate, upgrade velocity

Build for the user you have, not the user you imagine.
