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

---

## Elite Athlete Profile → Metrics Propagation Rules (E60–E64)

### Core Principle: One Field In → Everywhere Out
When an elite athlete enters ONE profile field, ALL dependent calculations must update immediately.
The universal rule: **never let a profile field be a dead end**.

| Profile Field | Auto-Derives | Used In |
|---|---|---|
| `ftp` + `weight` | W/kg, 7 Coggan power zones, LTHR≈87%maxHR | CyclingZonesCard, NormativeSection, QuickAddModal zone hint, AllZonesCard |
| `vo2max` | VDOT, 5 Daniels paces (E/M/T/I/R) | VO2maxCard, TodayView paces, RaceReadiness, QuickAddModal zone hint, AllZonesCard |
| `maxhr` | 5 HR zones (Fox), LTHR=maxhr×0.87 | AllZonesCard, QuickAddModal zone hint, subThresholdTime |
| `threshold` (pace) | Auto-VDOT if vo2max missing | RunningPaces, AllZonesCard |
| `age` (if no maxhr) | Predicted maxHR = 208 − 0.7×age (Tanaka 2001) | HR zones, LTHR, all maxhr derivations |
| `ftp` alone (no weight) | 7 power zones in watts only (no W/kg) | AllZonesCard, CyclingZonesCard |

### E60 — profileDerivedMetrics.js: The Universal Engine
**Goal:** Single pure function `deriveAllMetrics(profile, log?, testResults?)` that derives every metric from profile fields. Single source of truth. Pure, fully testable.

**Formulas to implement:**
- MaxHR: `profile.maxhr || Math.round(208 - 0.7 * age)` (Tanaka 2001)
- LTHR: `Math.round(maxHR * 0.87)` (Friel; also ~95% of FTP HR effort)
- W/kg: `Math.round(ftp / weight * 100) / 100`
- Coggan 7 power zones: use existing `getCyclingZones(ftp)` from `src/lib/sport/cycling.js`
- Daniels VDOT: use existing `vdotFromRace` from `src/lib/sport/running.js`; if no race result, VDOT = vo2max
- Daniels paces: use existing `getTrainingPaces(vdot)` from `src/lib/vdot.js`
- HR 5 zones: Z1=50-60%, Z2=60-70%, Z3=70-80%, Z4=80-90%, Z5=90-100% of maxHR
- Auto-VDOT from log: scan log for best 5k/10k/half/marathon effort using `estimateVO2maxFromRun` from `src/lib/sport/vo2max.js`
- Profile completeness: score 0-100 based on filled fields, list which features each unlocks

**Return shape:**
```javascript
{
  power: { ftp, wPerKg, zones[7], lthrEstimate } | null,  // requires ftp
  running: { vdot, source, paces: {easy,marathon,threshold,interval,rep} } | null,  // requires vo2max or threshold
  hr: { maxHR, maxHRSource, lthr, zones[5], rpeToHrZone: {1..10 → zoneIndex} } | null,  // requires maxhr or age
  completeness: { score, filled[], missing[], unlocks: { field: [features] } },
  autoVdot: { vdot, method, fromDate } | null,  // derived from best log session
}
```

**File:** `src/lib/profileDerivedMetrics.js`
**Tests:** `src/lib/__tests__/profileDerivedMetrics.test.js` — 25+ tests

### E61 — Zone-Aware RPE in QuickAddModal
**Goal:** When athlete selects RPE, show matching zone + HR range + pace/power range.
**What to show below RPE buttons (only when profileMetrics has hr or running or power):**
```
RPE 7 → ZONE 4 · 145–163 bpm · 4:05–4:25 /km  [threshold]
```
- Uses `deriveAllMetrics(profile)` (call once on mount or in useMemo)
- RPE → zone via: 1-2=Z1, 3-4=Z2, 5-6=Z3, 7-8=Z4, 9-10=Z5
- HR range from `hr.zones[zoneIdx]`
- Pace range from running zone paces (if runner)
- Power range from power zones (if cyclist with ftp)
- Show nothing if profile has no relevant fields
**File:** `src/components/QuickAddModal.jsx`

### E62 — Elite Metrics Strip in Dashboard
**Goal:** Compact strip in Dashboard (both modes) showing W/kg, VDOT, MaxHR, LTHR — elite athlete's daily reference numbers.
```
W/kg 4.29  ·  VDOT 62.3  ·  MaxHR 181  ·  LTHR 157 bpm
```
- Only shows metrics where data is available (no "—" or empty slots)
- Clicking a metric navigates to Profile tab (via setTab prop)
- If fewer than 2 metrics available, don't render (athlete hasn't completed enough profile)
**New component:** `src/components/dashboard/EliteMetricsStrip.jsx`
**Integration:** Dashboard.jsx — render in both beginner and advanced paths, after TodayStripCard

### E63 — AllZonesCard: Complete Zone Reference
**Goal:** One card showing ALL training zones for athlete's sport(s).
**Content (depends on profile):**
- Section A: Power Zones (7 Coggan) — shows if ftp set
- Section B: Running Paces (5 Daniels: E/M/T/I/R) — shows if vo2max or threshold set
- Section C: HR Zones (5-zone) — shows if maxhr or age set
- Source footer: "Based on: FTP 300W · VDOT 62 · MaxHR 181"
- "Complete in Profile →" link for missing fields
**New lib:** extend or use `deriveAllMetrics` output directly (no new lib needed)
**New component:** `src/components/dashboard/AllZonesCard.jsx`
**Integration:** Dashboard.jsx — lazy-loaded, render after EliteMetricsStrip

### E64 — Auto-VDOT from Best Log Session
**Goal:** If `profile.vo2max` is empty but athlete has run sessions with distance, auto-estimate VDOT.
The estimated value feeds `deriveAllMetrics` as the running engine source.
**Where:** Inside `deriveAllMetrics` — scan log for qualifying run sessions (distance + duration set).
Use `estimateVO2maxFromRun(distanceM, durationSec)` from `src/lib/sport/vo2max.js`.
Take the highest estimate from the last 90 days.
Store result as `autoVdot.vdot` — NEVER overwrite profile.vo2max.
**Usage:** AllZonesCard + VO2maxCard show "(auto from best 10k)" label when using autoVdot.
Show nudge in Profile: "Auto-VDOT 52 detected (from best 10k, 2026-03-15). Set it to unlock all running paces →"
