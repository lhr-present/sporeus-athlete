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

---

## Strategic Gap: The Prescription Loop (E65–E69)

### The Problem
The app is descriptive, not prescriptive. Athletes log → see metrics → but nothing tells them what to do tomorrow based on today's data. That is the difference between a logger and a daily-use coaching tool.

### Updated Daily-Use Tests (add to the 5 original)

**Test 6: Does the app tell the athlete what to do TODAY?**
- DailyBriefingCard must show: status (Fresh/Fatigued) + today's target session + zone/HR/pace targets derived from profile
- Acceptance: athlete at 6am reads one card and knows: duration, zone, HR range, pace or power range

**Test 7: Does logging today's session visibly change tomorrow's recommendation?**
- After save in QuickAddModal: if RPE ≥ 8 → tomorrow suggestion adjusts to "Easy recovery"
- Acceptance: athlete logs hard session → tomorrow card changes label and rationale

**Test 8: Does the app warn BEFORE silent overtraining?**
- DailyPrescription must flag: ACWR > 1.5, monotony > 2.0, 3+ fatigued days in 7
- Acceptance: no athlete hits ACWR 1.8 without seeing a caution banner first

---

## E65–E69 Prompt Specs (Prescription Loop Sprint)

### E65 — dailyPrescription() engine + DailyBriefingCard
**The highest-leverage single enhancement. This is what makes the app answer "why open at 6am."**

**`src/lib/dailyPrescription.js`** — pure function:
```javascript
export function dailyPrescription(profile, log, plan, planStatus, recovery, metrics)
// metrics = deriveAllMetrics(profile, log) already computed
// Returns:
{
  status: 'fresh' | 'optimal' | 'normal' | 'fatigued' | 'very-fatigued',  // from TSB
  tsb: number, ctl: number, acwr: number | null,
  today: {
    session: {                     // null on rest/no-plan days
      type, durationMin, rpe,
      zoneNum: 1-5 | null,
      hrRange: '145–163 bpm' | null,     // from metrics.hr.zones[zoneNum-1]
      paceRange: '4:25–4:45/km' | null,  // from metrics.running.paces
      powerRange: '228–270W' | null,     // from metrics.power.zones[zoneNum-1]
    } | null,
    brief: { en, tr },             // "TSB +5 · Fresh — Z3 Tempo · 145–163 bpm · Race 23d"
    raceCountdown: number | null,
  },
  tomorrow: { suggestion: {en,tr}, type:'reduce'|'rest'|'normal', rationale:{en,tr} } | null,
  sessionFlag: (entry) => { code, en, tr } | null,  // call after logging; flags RPE mismatch
  warnings: [{ code, level:'caution'|'danger', en, tr }],
}
```
**Status from TSB:** tsb > 10 = fresh, 5-10 = optimal, -5 to 5 = normal, -10 to -5 = fatigued, < -10 = very-fatigued
**Zone annotation:** map plan session type → zone number (use existing ZLABEL/ZIDX from formulas.js or constants.js), then look up metrics zones
**Tomorrow logic:** if today's planned RPE ≥ 8 OR today's ACWR > 1.3 → suggest reduce/rest tomorrow
**Warnings:** ACWR > 1.5 = caution, > 1.8 = danger; monotony > 2.0 = caution; TSB < -15 = caution
**Tests:** 30+ in `src/lib/__tests__/dailyPrescription.test.js`

**`src/components/dashboard/DailyBriefingCard.jsx`** — elite morning card:
- Renders at the TOP of Dashboard (both modes), right after EliteMetricsStrip
- One orange headline: the brief ("TSB +5 · Fresh — Plan: 60min Z3 · 145–163 bpm · 4:25/km")
- Session block: type, duration, zone color, HR/pace/power targets
- Tomorrow suggestion (compact, below session)
- Warnings in amber/red
- Race countdown badge if within 30 days
- Returns null if log is empty

### E66 — TodayView: Readiness gates the prescription
**Currently: readiness check (sleep/energy/soreness) is Card 2. Plan is Card 1. They're disconnected.**
**Fix: When readiness score < 50, Card 1 (plan) shows a yellow banner: "Readiness LOW — consider -20% intensity today"**
**When readiness not yet logged today: show a compact 3-tap check-in ABOVE the plan card, not below it**

The wellness form is already implemented in TodayView (state: wellness, wellnessSaved, readiness score at line 352). The changes are:
1. Move the wellness 3-slider mini-form to render BEFORE the planned session display when `!wellnessSaved && !todayRec`
2. When `wellnessSaved && todayRec.score < 50`: inject a warning banner inside Card 1 above the session details
3. The prescription from E65's `dailyPrescription()` should show the adjusted recommendation

**File:** only `src/components/TodayView.jsx` — no new files

### E67 — Offline indicator + Strava CTA after 3 sessions
**Part A — Offline indicator in QuickAddModal:**
- `navigator.onLine` check on mount + event listener for online/offline
- Show amber badge: "⚡ Offline — session saved locally" when offline (after save, in confirmation)
- Show "✓ Saved & syncing" when online
- The `offlineQueue.js` already has `getSyncStatus()` — use it for the confirmation text
**File:** `src/components/QuickAddModal.jsx` only

**Part B — Strava CTA surfacing:**
- In `GettingStartedCard.jsx`: add a second CTA below the main orange button: "— or auto-import from —  [Connect Strava →]" (only shown if `!localStorage.getItem('sporeus-strava-token')`)
- In App.jsx: after 3rd manual log entry saved, show a one-time toast/nudge: "Log 3 sessions → connect Strava to auto-import future sessions"
**Files:** `src/components/dashboard/GettingStartedCard.jsx`, `src/App.jsx`

### E68 — QuickAddModal post-session flag + tomorrow nudge
**After saving a session, the confirmation panel already shows session analysis. Add:**
1. **Zone mismatch flag:** if today had a planned session (use `getTodayPlannedSession` or pass via prop) and logged RPE doesn't match: "You logged RPE 8 on an easy day — flag: check recovery tomorrow"
2. **Tomorrow nudge strip:** compact "Tomorrow →" suggestion based on today's RPE and TSB (no profile needed, pure heuristic):
   - RPE ≥ 9: "Tomorrow: mandatory easy day or rest"
   - RPE 7-8 + consecutive hard days: "Tomorrow: reduce intensity"
   - RPE ≤ 5: "Tomorrow: on track, maintain plan"
**File:** `src/components/QuickAddModal.jsx` only (add to the `phase === 'saved'` confirmation block)
Note: QuickAddModal receives `log` prop — use it to check yesterday's RPE for "consecutive hard days" check.

### E69 — Weekly review card + consistency depth
**Part A — Weekly review card:**
`generateWeeklyRecap(log)` already exists in `src/lib/trainingLoad.js` and is called in TodayView (but only shown as dismissible recap). Add a proper `WeeklyReviewCard.jsx` for Dashboard that shows:
- This week vs last week: sessions count, TSS, avg RPE, total volume
- Best session badge
- "Plan adherence: 4/5 sessions completed"
- "Next week →" suggestion based on current CTL trajectory
**Files:** `src/components/dashboard/WeeklyReviewCard.jsx` (check if WeeklyReportCard already exists first) + Dashboard integration

**Part B — Consistency depth:**
Inline section inside WeeklyReviewCard OR standalone `ConsistencyDepthCard.jsx`:
"67 sessions logged → CTL trend: reliable (42+ days) · VDOT confidence: ±1.2 · Race prediction: ±4%"
Confidence thresholds: < 14 sessions = "building", 14-42 = "moderate", 42+ = "reliable"

---

## Formula Transparency Rule (apply when adding/modifying metric labels)
Every metric shown to athletes should have a `title` attribute or `ⓘ` tooltip with:
- Formula source (e.g., "CTL: 42-day EWMA — Banister 1991")
- Book reference if applicable (e.g., "See EŞİK Ch. 7")
Never leave a metric label naked without at least a hover title.

---

## Strategic Gap: Engagement & Delight (E70–E74)

### The Problem
The coaching loop is closed (E65–E69). Athletes get prescriptions and daily briefings. The next gap: **athletes don't feel rewarded for using the app daily.** No moments of surprise, no personal bests celebrated, no formula explanations for curious athletes. The app is functional but not magnetic.

### Updated Daily-Use Tests (add to the 8 existing)

**Test 9: Does the app celebrate athlete achievements?**
- When a PR is logged, the confirmation screen must acknowledge it explicitly
- Acceptance: athlete logs a new best 60min TSS and sees the achievement called out by name

**Test 10: Can an athlete understand any metric with one tap?**
- Every key metric (CTL, ATL, TSB, ACWR, VDOT, FTP, W/kg, LTHR) has a ⓘ popover
- Acceptance: tap ⓘ on CTL → see formula, plain-language explanation, EŞİK chapter reference

---

## E70–E74 Prompt Specs (Engagement & Delight Sprint)

### E70 — PR Celebration in QuickAddModal confirmation
**Problem (P2):** The post-save confirmation panel (phase === 'saved') shows a checkmark and sync status. But when an athlete sets a new personal best, nothing highlights it. A PR is the highest-value moment in daily use — it must be celebrated.

**What to add to the `phase === 'saved'` block:**
1. Import `detectPRs` from `src/lib/intelligence.js` (already exists — returns `{ isPR, prFields }`)
2. After save, call `detectPRs(savedEntry, log)` — the saved entry is already in `log` by the time phase becomes 'saved' (or pass `[...log, savedEntry]`)
3. If `isPR === true`, render a celebration banner above the checkmark:
```
🏆  New Personal Best!
Best 60min TSS · 94 TSS  (prev: 81 TSS)
```
4. List each PR field that fired: `prFields` is an array like `['tss', 'duration']`
5. Banner background: `#ff6600` with white text, subtle pulse animation (CSS keyframe `@keyframes pr-pulse`)
6. Bilingual label: EN "New Personal Best!" / TR "Yeni Kişisel Rekor!"
7. PR fields label map: `tss → "Best TSS"/"En İyi TSS"`, `duration → "Longest Session"/"En Uzun Antrenman"`, `distance → "Best Distance"/"En İyi Mesafe"`, `avgPace → "Best Pace"/"En İyi Hız"`

**Files:** `src/components/QuickAddModal.jsx` only
**Tests:** None required — UI-only change. But verify `detectPRs` is imported and called correctly.
**Acceptance:** Log a session with TSS higher than any existing entry → confirmation shows 🏆 PR banner with correct field and previous best value.

---

### E71 — Formula transparency ⓘ popovers on all key metrics
**Problem (P3):** Metrics like CTL, ATL, TSB, ACWR, VDOT, W/kg are shown everywhere but never explained. Curious athletes (especially those reading EŞİK) want to understand the math. Currently: naked numbers.

**Implementation — shared Popover component:**
1. Create `src/components/ui/FormulaPopover.jsx`:
```jsx
export function FormulaPopover({ metricKey, lang }) {
  const [open, setOpen] = useState(false)
  const info = FORMULA_INFO[metricKey]
  if (!info) return null
  return (
    <>
      <button onClick={() => setOpen(v => !v)} style={{ ... ⓘ badge ... }}>ⓘ</button>
      {open && <div style={{ ... popover panel ... }}>
        <div style={{ fontWeight: 700 }}>{info.name[lang]}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{info.formula}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>{info.explanation[lang]}</div>
        {info.citation && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{info.citation}</div>}
        {info.esik && <div style={{ fontSize: 11, color: '#ff6600' }}>EŞİK {info.esik[lang]}</div>}
      </div>}
    </>
  )
}
```

2. Create `src/lib/formulaInfo.js` — the data file:
```javascript
export const FORMULA_INFO = {
  ctl: {
    name: { en: 'Chronic Training Load (CTL)', tr: 'Kronik Antrenman Yükü (CTL)' },
    formula: 'CTL_today = CTL_prev + (TSS − CTL_prev) / 42',
    explanation: {
      en: '42-day exponential weighted average of TSS. Represents your aerobic fitness base.',
      tr: '42 günlük TSS üstel ağırlıklı ortalaması. Aerobik kondisyon tabanını temsil eder.',
    },
    citation: 'Banister 1991; Coggan & Allen 2010 (TrainingPeaks PMC)',
    esik: { en: 'Ch. 7 — Performance Management Chart', tr: 'Bölüm 7 — Performans Yönetim Grafiği' },
  },
  atl: {
    name: { en: 'Acute Training Load (ATL)', tr: 'Akut Antrenman Yükü (ATL)' },
    formula: 'ATL_today = ATL_prev + (TSS − ATL_prev) / 7',
    explanation: {
      en: '7-day EWMA of TSS. Represents recent training fatigue.',
      tr: '7 günlük TSS üstel ağırlıklı ortalaması. Son antrenman yorgunluğunu temsil eder.',
    },
    citation: 'Banister 1991; Coggan & Allen 2010',
    esik: { en: 'Ch. 7 — ATL and fatigue management', tr: 'Bölüm 7 — ATL ve yorgunluk yönetimi' },
  },
  tsb: {
    name: { en: 'Training Stress Balance (TSB / Form)', tr: 'Antrenman Stres Dengesi (TSB / Form)' },
    formula: 'TSB = CTL − ATL',
    explanation: {
      en: 'Fitness minus fatigue. Positive = fresh and race-ready. Negative = accumulated fatigue.',
      tr: 'Kondisyon eksi yorgunluk. Pozitif = dinç, yarışa hazır. Negatif = birikmiş yorgunluk.',
    },
    citation: 'Coggan & Allen 2010; Morton 1991',
    esik: { en: 'Ch. 7 — TSB and race timing', tr: 'Bölüm 7 — TSB ve yarış zamanlaması' },
  },
  acwr: {
    name: { en: 'Acute:Chronic Workload Ratio (ACWR)', tr: 'Akut:Kronik İş Yükü Oranı (ACWR)' },
    formula: 'ACWR = ATL_7d / CTL_28d',
    explanation: {
      en: 'Ratio of recent load to baseline load. 0.8–1.3 = safe zone. >1.5 = injury risk.',
      tr: 'Son yük / baz yük oranı. 0.8–1.3 = güvenli bölge. >1.5 = yaralanma riski.',
    },
    citation: 'Gabbett 2016 (BJSports); Murray et al. 2017',
    esik: { en: 'Ch. 9 — Workload and injury prevention', tr: 'Bölüm 9 — İş yükü ve yaralanma önleme' },
  },
  vdot: {
    name: { en: 'VDOT (Daniels Running Formula)', tr: 'VDOT (Daniels Koşu Formülü)' },
    formula: 'VDOT = VO2 at race pace; from Daniels & Gilbert 1979 regression tables',
    explanation: {
      en: 'Derived from race performance, not lab test. Used to set 5 training pace zones.',
      tr: 'Yarış performansından türetilir, laboratuvar testi gerekmez. 5 antrenman hız bölgesini belirler.',
    },
    citation: 'Daniels J. (2005). Daniels\' Running Formula (2nd ed.). Human Kinetics.',
    esik: { en: 'Ch. 5 — Running paces and VDOT', tr: 'Bölüm 5 — Koşu hızları ve VDOT' },
  },
  ftp: {
    name: { en: 'Functional Threshold Power (FTP)', tr: 'Fonksiyonel Eşik Gücü (FTP)' },
    formula: 'FTP ≈ 95% of 20-min best average power (Coggan); or 1-hour TT power',
    explanation: {
      en: 'Max average power sustainable for ~1 hour. Foundation of all 7 Coggan power zones.',
      tr: '~1 saatte sürdürülebilir maksimum ortalama güç. 7 Coggan güç bölgesinin temeli.',
    },
    citation: 'Coggan A.R. (2003). Training and Racing with a Power Meter. VeloPress.',
    esik: { en: 'Ch. 6 — FTP and power zones', tr: 'Bölüm 6 — FTP ve güç bölgeleri' },
  },
  wkg: {
    name: { en: 'Power-to-Weight Ratio (W/kg)', tr: 'Güç/Ağırlık Oranı (W/kg)' },
    formula: 'W/kg = FTP (watts) / body weight (kg)',
    explanation: {
      en: 'The single most important metric for climbing and overall cycling performance.',
      tr: 'Tırmanma ve genel bisiklet performansı için en önemli tek metrik.',
    },
    citation: 'Coggan A.R. Categorization of cyclists by W/kg (2003)',
    esik: { en: 'Ch. 6 — W/kg athlete categories', tr: 'Bölüm 6 — W/kg sporcu kategorileri' },
  },
  lthr: {
    name: { en: 'Lactate Threshold HR (LTHR)', tr: 'Laktik Eşik Kalp Atış Hızı (LTHR)' },
    formula: 'LTHR ≈ MaxHR × 0.87 (Friel estimate); or avg HR from 30-min TT last 20 min',
    explanation: {
      en: 'HR at the crossover from aerobic to anaerobic metabolism. Z3/Z4 boundary.',
      tr: 'Aerobik/anaerobik metabolizma geçiş noktasındaki KAH. Z3/Z4 sınırı.',
    },
    citation: 'Friel J. (2009). The Triathlete\'s Training Bible. VeloPress.',
    esik: { en: 'Ch. 4 — Lactate threshold and zones', tr: 'Bölüm 4 — Laktik eşik ve bölgeler' },
  },
}
```

3. Apply `FormulaPopover` to these locations (add `metricKey` prop and pass `lang`):
   - `DailyBriefingCard.jsx`: beside CTL, TSB, ACWR labels
   - `EliteMetricsStrip.jsx`: beside W/kg, VDOT, LTHR labels
   - `AllZonesCard.jsx`: beside section headers (FTP, VDOT, MaxHR)
   - `ConsistencyDepthCard.jsx`: beside CTL label
   - `WeeklyReviewCard.jsx`: beside TSS label

**Files:**
- `src/components/ui/FormulaPopover.jsx` (new)
- `src/lib/formulaInfo.js` (new)
- 5 component files (add ⓘ badge inline — one-liners each)

**Tests:** `src/lib/__tests__/formulaInfo.test.js` — 8 tests: every key in FORMULA_INFO has name, formula, explanation (en+tr), citation.
**Acceptance:** Tap ⓘ beside CTL in DailyBriefingCard → popover shows formula, explanation, "EŞİK Bölüm 7" reference.

---

### E72 — Monthly progress narrative card
**Problem (P3):** Athletes have no sense of month-over-month progress. Weekly review (E69) handles 7 days. There's no "where was I 30 days ago vs today" moment. This is what coaches review in monthly check-ins.

**New component:** `src/components/dashboard/MonthlyProgressCard.jsx`

**Only shown:** On the 1st–7th of each month (recency gate: `new Date().getDate() <= 7`) AND only if log has sessions from the previous month.

**Content:**
```
APRIL SUMMARY
Sessions: 18  ·  Total TSS: 2,340  ·  Avg RPE: 6.4
CTL change: +8 (from 42 → 50)
VDOT change: +1.2 (from 54.1 → 55.3)   [only if VDOT derivable from log]
Best week: Apr 14–20 · 680 TSS

→ May target: maintain 550–650 TSS/week to reach race-ready CTL of 55
```

**Logic in `src/lib/athlete/monthlyProgress.js`** (new pure lib):
```javascript
export function computeMonthlyProgress(log, profile, today = new Date().toISOString().slice(0, 10))
// Returns null if prev month has < 4 sessions
// Returns:
{
  monthLabel: 'April 2026' / 'Nisan 2026',
  sessions: number,
  totalTSS: number,
  avgRPE: number,
  ctlDelta: number,          // CTL end of month - CTL start of month
  ctlStart: number,
  ctlEnd: number,
  bestWeek: { label: 'Apr 14–20', tss: number },
  vdotDelta: number | null,  // null if no auto-VDOT possible
  targetNextMonth: { tssLow: number, tssHigh: number, targetCTL: number },
}
```

**Files:** `src/lib/athlete/monthlyProgress.js` (new), `src/components/dashboard/MonthlyProgressCard.jsx` (new)
**Tests:** `src/lib/__tests__/athlete/monthlyProgress.test.js` — 12 tests
**Integration:** Dashboard.jsx — lazy-load, render in both paths after WeeklyReviewCard
**Acceptance:** On 1st–7th of any month with prior-month data, card appears with correct session count and CTL delta.

---

### E73 — Voice notes in QuickAddModal
**Problem (P3):** Athletes want to add "felt tight in left hip, pushed through miles 4–6" type notes after a session. Typing this on mobile while sweaty is painful. Web Speech API exists in all modern browsers.

**Implementation in `src/components/QuickAddModal.jsx`:**
1. Add a microphone button beside the `notes` textarea (renders only if `'webkitSpeechRecognition' in window || 'SpeechRecognition' in window`)
2. State: `const [recording, setRecording] = useState(false)`
3. On mic tap: start `SpeechRecognition` with `lang = lang === 'tr' ? 'tr-TR' : 'en-US'`; set `continuous: false`, `interimResults: false`
4. On `result` event: append transcript to `notes` field (don't replace — athlete may have typed something)
5. On `end` event: `setRecording(false)`
6. On `error` event: `setRecording(false)` silently — do NOT show error to user
7. Mic button style: 24px circle, `#333` background when idle, `#ff6600` background when recording, pulse animation
8. If `SpeechRecognition` not available: button simply doesn't render (no fallback message needed)

**No new files.** Changes entirely in `QuickAddModal.jsx`.
**Tests:** None required — Web Speech API is a browser API; unit testing is not practical.
**Acceptance:** Tap mic, speak "felt tired in the first half", → text appears in notes field. Button turns orange while recording, returns to grey when done. Works in English and Turkish. If browser doesn't support it, no mic button appears.

---

### E74 — Smart session defaults from weekly patterns
**Problem (P2):** Athletes open QuickAddModal and have to choose type/sport/duration from scratch every time. But most athletes are creatures of habit: Monday = easy run 45min, Wednesday = tempo 60min, Saturday = long run 90min. The data to detect this already exists in `patterns.js`.

**Implementation:**
1. In `src/lib/patterns.js`, add a new export:
```javascript
export function getDayPattern(log, today = new Date().toISOString().slice(0, 10))
// Returns the most common session type+duration for this weekday from last 8 weeks
// Returns null if < 3 matching weekday sessions found
// Returns: { type: string, durationMin: number, sport: string, confidence: number (0-1) }
```
Logic:
- Filter log to sessions from last 56 days
- Get `dayOfWeek` = `(new Date(today + 'T12:00:00Z').getDay() + 6) % 7` (Mon=0)
- Filter to sessions on same day of week (using the same noon-UTC pattern for each entry.date)
- If < 3 sessions: return null
- Find mode of `type`, median `durationMin`, mode of `sport`
- Confidence = matching sessions / total log sessions for that weekday (capped at 1)

2. In `QuickAddModal.jsx`:
   - On mount: call `getDayPattern(log)` 
   - If result is non-null AND confidence ≥ 0.5: pre-fill `type`, `durationMin`, `sport` with pattern values
   - Show a "Pattern" badge next to the type selector: small grey pill "📅 Pattern" 
   - When athlete changes any field, hide the badge (they've overridden it)
   - The badge serves as a signal, not a lock — athlete always overrides freely

3. Bilingual: badge label EN "📅 Pattern" / TR "📅 Alışkanlık"

**Files:** `src/lib/patterns.js` (add `getDayPattern` export), `src/components/QuickAddModal.jsx` (use it)
**Tests:** `src/lib/__tests__/patterns.test.js` — add 8 tests for `getDayPattern`: empty log returns null, < 3 sessions returns null, correct mode type, correct median duration, respects 56-day window, Monday pattern doesn't bleed into Tuesday, noon-UTC weekday calculation matches log entries.
**Acceptance:** After 3 Mondays of 45min easy runs, open QuickAddModal on Monday → type pre-filled to "Easy Run", duration to 45, "📅 Pattern" badge visible. Change type → badge disappears.

---
