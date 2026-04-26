# Sporeus Athlete App — Daily-Use Quality Rules
## Mission
Every enhancement must pass: **"Would an athlete actually use this every day?"**
If the answer is no, it is not a priority.

---

## The 5 Daily-Use Tests (run before every feature decision)

1. **Can a new athlete log their first session in under 60 seconds?**
   - QuickAddModal must be the primary entry point
   - All required fields must have sensible defaults (sport, duration, RPE)
   - GettingStartedCard must guide empty-state athletes

2. **Can an athlete see today's status at a glance?**
   - TodayStripCard at top of Dashboard: streak, trained today, weekly sessions
   - TodayView: planned session, readiness, recommendations
   - No tab-switching required for daily check-in

3. **Can an athlete track weekly progress toward a goal?**
   - WeeklyTssGoalCard visible in BOTH beginner and advanced mode
   - Goal set in Profile, resets every Monday, progress bar always visible

4. **Is athlete data safe from accidental loss?**
   - Single-row delete requires confirmation (same as bulk delete)
   - No destructive action without explicit confirmation dialog
   - Export data is prominently accessible (Profile → Data Management)

5. **Does the app make sense to a new athlete?**
   - CTL/ATL/TSB/TSS must have inline explanation (tooltip or label)
   - Profile fields must state what feature they unlock
   - Empty dashboard states guide action — never show raw zeroes

---

## Bug Severity Protocol

| Level | Definition | Action |
|---|---|---|
| P0 | Crash / data corruption | Fix immediately, block commit |
| P1 | Feature silently broken (e.g., raceDate field missing) | Fix in same session |
| P2 | Bad UX causing data loss risk or broken workflow | Fix in same sprint |
| P3 | Minor friction, cosmetic | Batch with related fixes |

---

## Enhancement Prompts — Daily-Use Sprint (E56–E59)

### E56 — QuickAddModal: Date picker for past sessions
**Problem (P1):** Athletes can only log today. If they forget to log after a run, they must use full TrainingLog with more friction.
**Fix:** Add a date input (type="date") defaulting to today. Allow selection of any date up to today (no future dates). The entry uses the selected date instead of `today()`.
**Files:** `src/components/QuickAddModal.jsx`
**Acceptance:** Athlete can log "yesterday" in under 30 seconds from the + button.

### E57 — TrainingLog: Single-row delete confirmation
**Problem (P2):** Bulk delete has a ConfirmModal; single row delete fires immediately. Inconsistent — data loss risk.
**Fix:** Wrap single-row delete button in a ConfirmModal or inline confirm step (click once to arm → confirm → delete). Match the existing ConfirmModal pattern.
**Files:** `src/components/TrainingLog.jsx`
**Acceptance:** Clicking ✕ on a single row does NOT immediately delete. Shows "Delete this session? [Cancel] [Delete]" before removing.

### E58 — Profile: Add raceDate field
**Problem (P2):** `raceDate` is used by TodayView for race countdown but there is no UI to set it. The field can only be set via RaceReadiness tab's save button. Athletes who don't visit that tab never get a countdown.
**Fix:** Add `raceDate` as a date input to Profile.jsx FIELDS array. Label: `RACE DATE` / `YARIŞ TARİHİ`. Type: date. Store via existing setProfile pattern.
**Files:** `src/components/Profile.jsx`, `src/lib/validate.js`
**Acceptance:** Athlete sets race date in Profile, sees countdown in TodayView.

### E59 — Dashboard: WeeklyTssGoalCard in beginner mode + CTL tooltip
**Problem (P2/P3):** WeeklyTssGoalCard only renders in the advanced dashboard branch (line 467). Beginner athletes who haven't clicked "SHOW ADVANCED" never see their weekly goal progress — defeating the feature's purpose.
**Fix A:** Add `<WeeklyTssGoalCard>` to the beginner dashboard path (after the metrics row, before the recent sessions table).
**Fix B:** On the Dashboard's CTL/ATL/TSB metric row, add a tiny inline label or `title` attribute to the metric name so hovering shows what it means. e.g., CTL: "Chronic Training Load — 42-day avg fitness". Keep it one line each.
**Files:** `src/components/Dashboard.jsx`
**Acceptance:** Athlete in beginner mode sees weekly TSS goal card. Hovering CTL/ATL/TSB shows a brief description.

---

## Invariants (never break these)
- `flowType: 'implicit'` in supabase.js — required for GitHub Pages (no PKCE)
- `onAuthStateChange` only — never `getSession()` (Web Locks contention)
- All styles inline via `S.{}` from styles.js — zero CSS files
- Bilingual: every user-visible string needs EN + TR
- localStorage keys prefixed `sporeus-` or `sporeus_`
- Pre-commit: CHANGELOG.md must be staged for feat/fix/hotfix commits
- Run `npm test` before every commit — all tests must pass
- Run `npm run build` before every push — clean build required

---

## Future Enhancement Candidates (daily-use backlog)

### High Value
- **Session notes voice input** — dictate notes post-workout (Web Speech API)
- **Quick log from Today tab** — log session without leaving TodayView
- **Weekly email/push summary** — Sunday push notification with week recap
- **Pace/HR zones shown during log entry** — "at RPE 7 you should be at 160-170 bpm"

### Medium Value  
- **TrainingLog: filter by session type** — free-text client-side filter, no auth needed
- **Session comparison** — "this run vs last week's same run"
- **PR celebration animation** — when a new PR is detected on save, show celebration
- **Profile completeness bar** — "Your profile is 60% complete → unlock 4 more features"

### Lower Value
- Offline queue for QuickAddModal saves
- CSV export from TrainingLog (not just JSON)
- Session duration in H:MM format instead of raw minutes
