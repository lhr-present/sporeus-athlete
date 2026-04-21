# New User Flow — G1 Implementation

## Overview

G1 hardens the new-user entry point: smarter QuickAdd defaults, post-save confirmation,
Valibot validation, and automatic navigation to Today tab after first session.

## User Journey

1. New user completes OnboardingWizard (3 questions: purpose, sport, logging method)
2. `sporeus-onboarded=true` is set; App renders main UI
3. User clicks `+` button → QuickAddModal opens
4. Modal defaults: **session type from sport** (Running → Easy Run, Cycling → Easy Ride, etc.),
   **duration = 45 min**, **RPE = 6**
5. User adjusts and submits
6. Post-save phase shows for 2.2s: checkmark, "Session logged", Training Load summary
7. If `isFirst=true` (log was empty before this entry): 🏆 celebration message shown
8. Modal closes; app auto-navigates to Today tab after 2.4s
9. Today tab shows next orientation step via `getOrientationStep()`

## Props — QuickAddModal

| Prop | Type | Purpose |
|------|------|---------|
| `onAdd` | `(entry) => void` | Receives validated entry |
| `onClose` | `() => void` | Close the modal |
| `profile` | `{ sport: string } \| null` | Drives default session type |
| `isFirst` | `boolean` | Shows first-session celebration in saved phase |

## Entry Shape (onAdd payload)

```js
{
  date:        '2026-04-21',  // today()
  type:        'Easy Run',
  duration:    45,            // minutes (integer)
  durationSec: 2700,          // duration * 60
  rpe:         6,
  tss:         47,            // calcTSS(duration, rpe) — Foster 2001 sRPE
  notes:       undefined,     // trimmed string or undefined
}
```

## Validation (Valibot SessionSchema)

- `type`: non-empty string
- `duration`: 1–720 minutes
- `rpe`: 1–10
- `notes`: optional, max 500 chars

Errors shown inline beneath field. Submit button disabled when `dur === 0`.

## First-Session Navigation (useAppState)

`handleAddSession` detects `log.length === 0` before mutation. If so, `wasFirst=true`
and `setTimeout(() => handleTabClick('today'), 2400)` fires after modal's 2.2s close.

## Sport Default Map

| Sport | Default type |
|-------|-------------|
| Running | Easy Run |
| Cycling | Easy Ride |
| Swimming | Easy Swim |
| Triathlon | Easy Run |
| Rowing | Easy Run |
| Other / unknown | Easy Run |

## Test Coverage

`src/components/__tests__/QuickAddModal.test.jsx` — 18 tests across 5 describe blocks:
- Defaults (sport-based type, duration 45, null/unknown profile)
- TSS label ("Training Load" + "(TSS)" + Foster 2001 citation)
- RPE effort labels (RPE 4 → aerobic base building; RPE 8 → threshold effort)
- Validation (disabled at dur=0, onAdd not called when empty)
- Submission (entry shape, saved phase, isFirst celebration, isFirst=false guard)
- Close behaviour (× button)
