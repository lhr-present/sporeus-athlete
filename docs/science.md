# Sporeus Athlete — Science Reference

Every metric in this app maps to a published method and a specific function in `src/lib/`. This document is the source of truth for coaches and athletes who want to audit the math.

## Contents

1. [CTL / ATL / TSB (Banister Impulse–Response)](#1-ctl--atl--tsb-banister-impulseresponse)
2. [ACWR — Acute:Chronic Workload Ratio](#2-acwr--acutechronic-workload-ratio)
3. [Monotony & Strain (Banister)](#3-monotony--strain-banister)
4. [RMSSD — Heart Rate Variability](#4-rmssd--heart-rate-variability)
5. [DFA-α1 — Detrended Fluctuation Analysis](#5-dfa-1--detrended-fluctuation-analysis)
6. [VDOT — Daniels Running Formula](#6-vdot--daniels-running-formula)
7. [Normalized Power / IF / TSS (Coggan)](#7-normalized-power--if--tss-coggan)
8. [Critical Power & W'](#8-critical-power--w)
9. [Mean Maximal Power Curve](#9-mean-maximal-power-curve)
10. [Aerobic Decoupling (Pw:Hr)](#10-aerobic-decoupling-pwhr)
11. [Injury Risk Score](#11-injury-risk-score)
12. [VO2max Normative Tables](#12-vo2max-normative-tables)

---

## 1. CTL / ATL / TSB (Banister Impulse–Response)

**Plain English:** Chronic Training Load (CTL) is your long-term fitness — a weighted average of recent training stress with a 42-day memory. Acute Training Load (ATL) is short-term fatigue with a 7-day memory. Training Stress Balance (TSB, also called "form") is yesterday's CTL minus yesterday's ATL: positive means you are rested, negative means you are accumulated fatigue.

**Formula:**

```
CTL(t) = CTL(t−1) × e^(−1/42) + TSS(t) × (1 − e^(−1/42))
ATL(t) = ATL(t−1) × e^(−1/7)  + TSS(t) × (1 − e^(−1/7))
TSB(t) = CTL(t−1) − ATL(t−1)
```

Decay constants in code:

```
K_CTL   = 1 − e^(−1/42) ≈ 0.02353   (fitness gain rate)
K_ATL   = 1 − e^(−1/7)  ≈ 0.13307   (fatigue gain rate)
DECAY_CTL = 1 − K_CTL ≈ 0.97647
DECAY_ATL = 1 − K_ATL ≈ 0.86693
```

**Parameters:** τ_CTL = 42 days (fitness time constant), τ_ATL = 7 days (fatigue time constant). Values match TrainingPeaks convention.

**Implementation:** `src/lib/trainingLoad.js` → `calculatePMC(log, daysBack, daysFuture)`

The function primes CTL/ATL with an extra 180 days before the display window so values are accurate even when the log is short. TSB uses `prevCTL − prevATL` (yesterday's values), matching the TrainingPeaks TSB definition exactly.

**Citation:**
- Banister EW, Calvert TW, Savage MV, Bach T. "A systems model of training for athletic performance." *Aust J Sports Med.* 1975;7(3):57–61.
- Coggan AR, Allen H. *Training and Racing with a Power Meter.* VeloPress, 2010.

**Edge cases:**
- Requires a 180-day prime window for accurate CTL from short logs (handled automatically).
- TSB can be misleading for athletes returning from injury with artificially low ATL.
- Future projection zeroes TSS; shows expected CTL/ATL taper only.
- TSS per session must be accurate — RPE-estimated TSS has ±20% uncertainty.

**Validation:** `src/lib/trainingLoad.test.js`, `src/lib/sport/banisterProof.test.js`

---

## 2. ACWR — Acute:Chronic Workload Ratio

**Plain English:** ACWR compares how hard you trained this week against how hard you have trained over the past month. A ratio near 1.0 is safe. Above 1.5 is the "danger zone" for injury in team-sport literature; below 0.8 means undertraining.

**Formula:**

```
EWMA_acute(t)   = λ_a × TSS(t) + (1 − λ_a)   × EWMA_acute(t−1)     λ_a  = 0.25
EWMA_chronic(t) = λ_c × TSS(t) + (1 − λ_c) × EWMA_chronic(t−1)   λ_c = 0.067

ACWR = EWMA_acute / EWMA_chronic
```

λ_acute = 0.25 corresponds to a half-life of ≈ 3.5 days; λ_chronic = 0.067 corresponds to ≈ 10 days. EWMA-based ACWR avoids the "day-26 spike" artifact of rolling-average methods.

**Parameters:**
- 28-day rolling window used for initialization.
- TSS per session capped at 300 to guard against data entry errors (`MAX_TSS_PER_SESSION`).
- Zero-load days inserted for any missing date.

**Status bands:**
- `optimal`: 0.8–1.3
- `caution`: 1.3–1.5
- `danger`: > 1.5
- `undertraining`: < 0.8

**Implementation:** `src/lib/trainingLoad.js` → `calculateACWR(log)`

**Citation:**
- Hulin BT, Gabbett TJ, Lawson DW, Caputi P, Sampson JA. "The acute:chronic workload ratio predicts injury: high chronic workload may decrease injury risk in elite rugby league players." *Br J Sports Med.* 2016;50(4):231–236.
- Murray NB, Gabbett TJ, Townshend AD, Blanch P. "Calculating acute:chronic workload ratios using exponentially weighted moving averages." *Br J Sports Med.* 2017;51(23):1714–1715.

**Edge cases:**
- Returns `status: 'insufficient'` when chronic EWMA is 0 (< 4 weeks of data).
- EWMA ACWR can still spike after extended rest; combine with absolute TSS context.

**Validation:** `src/lib/trainingLoad.test.js`, `src/lib/sport/acwrProof.test.js`

---

## 3. Monotony & Strain (Banister)

**Plain English:** Monotony measures how uniform your training load is day-to-day. High monotony (> 2.0) means you train the same way every day — a proven risk factor for overtraining syndrome. Strain combines monotony with total weekly load.

**Formula:**

```
Monotony = mean(TSS_7d) / SD(TSS_7d)
Strain   = Σ TSS_7d × Monotony
```

where `TSS_7d` is the array of daily TSS over the last 7 days, and SD is population standard deviation.

**Implementation:** `src/lib/formulas.js` → `monotonyStrain(log)`

Returns `{ mono, strain, mean }`. Monotony = 0 when SD = 0 (all rest days).

**Citation:**
- Banister EW. "Modeling elite athletic performance." In: Green HJ, McDougal JD, Wenger H (eds). *Physiological Testing of Elite Athletes.* Human Kinetics, 1991: pp. 403–424.
- Foster C. "Monitoring training in athletes with reference to overtraining syndrome." *Med Sci Sports Exerc.* 1998;30(7):1164–1168.

**Edge cases:**
- Meaningful only with ≥ 7 days of data (function uses exactly 7).
- Monotony > 2.0 is the traditional red-flag threshold (Foster 1998).
- A single very high TSS day surrounded by rest can paradoxically lower monotony.

**Validation:** `src/lib/formulas.test.js`

---

## 4. RMSSD — Heart Rate Variability

**Plain English:** RMSSD (Root Mean Square of Successive Differences) measures beat-to-beat variation in the cleaned RR interval series. Higher values mean greater parasympathetic tone and better recovery. Sporeus uses the natural log of RMSSD (lnRMSSD) for trend tracking because it is more normally distributed.

**Formula:**

```
RMSSD = √( (1 / (N−1)) × Σ_{i=1}^{N−1} (RR_i − RR_{i−1})² )

lnRMSSD = ln(RMSSD)
```

**Preprocessing:** `cleanRRIntervals()` runs before RMSSD calculation:
1. Removes physiologically impossible beats (< 300 ms or > 2000 ms).
2. Detects ectopic beats via 9-beat local mean — flags any beat deviating > 20% from local mean.
3. Linearly interpolates over ectopic runs.

**Readiness bands (lnRMSSD vs 7-day baseline):**
- > 102% → elevated (green) — high intensity OK
- 97–102% → normal (yellow) — proceed as planned
- < 97% → suppressed (red) — easy day only

**Implementation:**
- `src/lib/hrv.js` → `calculateRMSSD(nn)`, `calculateLnRMSSD(rmssd)`, `scoreReadiness(todayLnRMSSD, baseline7d)`

**Citation:**
- Task Force of the European Society of Cardiology and the North American Society of Pacing and Electrophysiology. "Heart rate variability: standards of measurement, physiological interpretation and clinical use." *Circulation.* 1996;93(5):1043–1065.
- Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. "Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring." *Sports Med.* 2013;43(9):773–791.

**Edge cases:**
- Requires ≥ 2 clean NN intervals; returns 0 otherwise.
- Morning measurement only — exercise HRV is not comparable.
- lnRMSSD trend requires ≥ 3 prior entries to compute a baseline in Sporeus.

**Validation:** `src/lib/hrv.test.js`

---

## 5. DFA-α1 — Detrended Fluctuation Analysis

**Plain English:** DFA-α1 is a fractal scaling exponent of the RR interval series computed at short scales (4–16 beats). At α1 ≈ 0.75, you are at your aerobic threshold (LT1). Above 0.75 means below LT1; below 0.75 means you have crossed LT1 into harder territory. At rest, healthy athletes show α1 > 1.0.

**Algorithm:**

```
1. Integrate: y[k] = Σ_{i=0}^{k} (RR[i] − mean_RR)
2. For each scale n ∈ {4, 5, ..., 16}:
   a. Divide y into non-overlapping boxes of length n
   b. Fit linear trend (OLS) in each box
   c. F(n) = √( mean squared residual across all boxes )
3. α1 = slope of log(F(n)) vs log(n)  [OLS regression]
```

The denom term in the per-box OLS is `n²(n²−1)/12` — a closed-form constant per scale that avoids recomputing Σx and Σx².

**Thresholds (Gronwald 2019/2020):**
- α1 > 1.0 → below LT1, highly aerobic (resting morning value)
- α1 > 0.75 → below LT1, approaching threshold
- α1 ≈ 0.75 → at LT1
- α1 < 0.75 → above LT1, approaching LT2

**Requirements:** ≥ 300 clean NN intervals (≈ 5 min at 60 bpm). Returns `null` if insufficient.

**Implementation:** `src/lib/hrv.js` → `calculateDFAAlpha1(nn)`

**Citation:**
- Gronwald T, Hoos O, Hottenrott K. "Correlation properties of heart rate variability during endurance exercise: a systematic review." *Ann Noninvasive Electrocardiol.* 2019;24(1):e12630.
- Gronwald T, Rogers B, Hoos O. "Fractal correlation properties of heart rate variability: a new biomarker for intensity distribution in endurance exercise and training prescription?" *Front Physiol.* 2020;11:550572.

**Edge cases:**
- Requires continuous RR recording during exercise (Polar H10, chest strap, FIT file).
- DFA-α1 is valid for steady-state aerobic efforts only — not interval sessions.
- Ectopic beats > 5% of the recording degrade accuracy; displayed as a warning badge.

**Validation:** `src/lib/hrv.test.js`

---

## 6. VDOT — Daniels Running Formula

**Plain English:** VDOT is Jack Daniels' index of aerobic running fitness. It is not VO2max — it is the VO2max that "would explain" your race performance, including running economy. Given a race distance and finish time, Sporeus interpolates the Daniels VDOT table to estimate your VDOT, then derives training paces for each zone.

**Algorithm:**
1. Map input distance to the nearest standard distance (5k, 10k, half, marathon).
2. If not an exact distance match, apply the Riegel model to convert to equivalent time at the standard distance: `T2 = T1 × (D2/D1)^1.06`.
3. Binary search the 30–85 VDOT table; linearly interpolate between adjacent rows.
4. Training paces are interpolated from the same table (easy, marathon, threshold, interval, rep).

**Implementation:** `src/lib/vdot.js` → `estimateVDOT(distanceM, timeS)`, `getTrainingPaces(vdot)`, `predictTime(vdot, targetDistanceM)`

The table is loaded from `src/data/vdotTable.json` (55 rows, VDOT 30–85).

**Citation:**
- Daniels J. *Daniels' Running Formula.* 3rd ed. Human Kinetics, 2013.
- Riegel PS. "Athletic records and human endurance." *Am Sci.* 1981;69(3):285–290.

**Edge cases:**
- VDOT is clamped to [30, 85] — outside this range extrapolation degrades.
- Non-standard distances (e.g., 8k, mile) use Riegel projection from the nearest standard distance.
- Altitude, heat, and course profile are not adjusted for — use a flat sea-level effort.
- VDOT does not apply to trail, ultra, or multi-sport events.

**Validation:** `src/lib/sport/vdotValidation.test.js`

---

## 7. Normalized Power / IF / TSS (Coggan)

**Plain English:** Normalized Power (NP) estimates the metabolic cost of a variable-power ride as if you had ridden at constant power. Intensity Factor (IF) compares NP to your FTP. Training Stress Score (TSS) combines duration, IF, and FTP into a single session load number.

**Formulas:**

```
NP  = ( mean( (30s_rolling_mean_power)^4 ) )^0.25

IF  = NP / FTP

TSS = (duration_sec × NP × IF) / (FTP × 3600) × 100
    = (duration_sec × NP²) / (FTP² × 3600) × 100
```

**Algorithm for NP** (`normalizedPower`):
1. Compute 30-second rolling mean of 1-Hz power stream.
2. Raise each rolling mean to the 4th power.
3. Take the mean of all 4th-power values.
4. Take the 4th root.

Requires ≥ 30 samples; returns 0 otherwise.

**Implementation:**
- `src/lib/formulas.js` → `normalizedPower(powers)`, `computePowerTSS(np, durationSeconds, ftp)`

**Citation:**
- Coggan AR. "Training and racing using a power meter: an introduction." *USA Cycling coaching manual,* 2003.
- Allen H, Coggan AR. *Training and Racing with a Power Meter.* VeloPress, 2010.

**Edge cases:**
- NP > average power by definition (Jensen's inequality on a convex function).
- TSS ≈ 100 for a 1-hour effort at exactly FTP — use as a reference anchor.
- Returns `null` if NP, FTP, or duration is zero/null.
- Applies to cycling and power-based running (running power meters); not to pace-based TSS.

**Validation:** `src/lib/formulas.test.js`

---

## 8. Critical Power & W'

**Plain English:** Critical Power (CP) is the highest power output sustainable indefinitely in theory — the boundary between heavy and severe exercise domains. W' (W-prime) is the finite anaerobic work capacity above CP, measured in joules. Once W' is depleted, the athlete must drop below CP to recover it.

**Model:**

```
P(t) = CP + W' / t          (2-parameter hyperbolic model)
```

Linearised for OLS fit:

```
y = P,   x = 1/t
P = CP + W' × (1/t)         → slope = W', intercept = CP
```

**W' Balance (Skiba differential model):**

```
When P ≥ CP:   W'(t) = W'(t−1) − (P(t) − CP)          [depletion]
When P < CP:   W'(t) = W'max − (W'max − W'(t−1)) × e^(−1/τ_W)   [recovery]

τ_W = 546 × e^(−0.01 × (CP − P̄_below)) + 316
```

where `P̄_below` is the mean power below CP (used as the recovery target power in the Skiba 2012 formulation).

**Fit range:** 2–30 minutes (120–1800 s) from the MMP curve. Requires ≥ 3 data points. Results outside physiological bounds (CP < 50 W or > 600 W; W' < 3 kJ or > 120 kJ) are rejected.

**Implementation:**
- `src/lib/powerAnalysis.js` → `fitCriticalPower(mmps)`
- `src/lib/formulas.js` → `computeWPrime(powers, cp, wPrimeMax)`

**Citation:**
- Monod H, Scherrer J. "The work capacity of a synergic muscular group." *Ergonomics.* 1965;8(3):329–338.
- Skiba PF, Chidnok W, Vanhatalo A, Jones AM. "Modeling the expenditure and reconstitution of work capacity above critical power." *Med Sci Sports Exerc.* 2012;44(8):1526–1532.
- Poole DC, Burnley M, Vanhatalo A, Rossiter HB, Jones AM. "Critical power: an important fatigue threshold in exercise physiology." *Med Sci Sports Exerc.* 2016;48(11):2320–2334.

**Edge cases:**
- CP fit degrades when MMP points are clustered in a narrow duration range.
- W' reconstitution constant τ_W varies between athletes (±30%); Sporeus uses the Skiba 2012 population mean.
- W' exhaustion (`wPrimeExhausted: true`) is flagged on log entries imported via FIT files when W' reaches 0.

**Validation:** `src/lib/sport/cpValidation.test.js`, `src/lib/formulas.test.js`

---

## 9. Mean Maximal Power Curve

**Plain English:** The MMP curve (also called power-duration curve) shows the highest average power you have held for each duration from 1 second to 3 hours, across all imported activities. It is the empirical basis for CP fitting and FTP estimation.

**Algorithm:**

For each key duration `d` in `KEY_DURATIONS`:
1. Initialize a sliding window of length `d` over the 1-Hz power stream.
2. Track the rolling sum; update in O(1) per step.
3. Validity check: skip any window where fewer than 90% of samples are non-zero (coasting).
4. Record `max(sum / d)` across all windows.

Key durations: 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 900, 1200, 1500, 1800, 2700, 3600, 5400, 7200, 10800 seconds.

FTP estimation priority from MMP: 60-min power → 20-min × 0.95 → 8-min × 0.90.

**Implementation:** `src/lib/powerAnalysis.js` → `calculateMMP(stream)`, `estimateFTP(mmps)`

**Citation:**
- Allen H, Coggan AR. *Training and Racing with a Power Meter.* VeloPress, 2010, ch. 4.
- Pinot J, Grappe F. "The record power profile to assess performance in elite cyclists." *Int J Sports Med.* 2011;32(11):839–844.

**Edge cases:**
- MMP from a single activity is not a true personal best — accumulate across sessions.
- Tailwind, downhill, and sprint efforts inflate short-duration MMP; CP fit uses only 2–30 min range.
- Indoor trainer data may differ from outdoor power due to calibration offsets.

**Validation:** `src/lib/powerAnalysis.test.js`

---

## 10. Aerobic Decoupling (Pw:Hr)

**Plain English:** Aerobic decoupling measures how much your cardiovascular efficiency drifts over a long steady-state effort. If your power-to-HR ratio (Pw:Hr) drops by less than 5% from the first to the second half, your aerobic base is adequate for that intensity. Larger drift indicates aerobic insufficiency.

**Formula:**

```
firstHalfRatio  = mean(power_H1) / mean(HR_H1)
secondHalfRatio = mean(power_H2) / mean(HR_H2)

decouplingPct = ((firstHalfRatio − secondHalfRatio) / firstHalfRatio) × 100
```

Positive decoupling = HR rose relative to power in the second half (drift). Negative = HR dropped (cardiac drift suppressed by fatigue — rare).

**Classification:**
- < 5% → `coupled` (aerobic base sufficient)
- 5–10% → `mild` (some aerobic limitation)
- ≥ 10% → `significant` (aerobic insufficiency at this intensity)

**Options:** Configurable warmup exclusion (default 600 s), cooldown exclusion, minimum effort duration (default 3600 s), and optional steady-state CV filter (rolling coefficient of variation < 0.15).

**Implementation:** `src/lib/decoupling.js` → `computeDecoupling({ timestamps, hr, power, speed, options })`, `classifyDecoupling(pct)`

**Citation:**
- Friel J. *The Cyclist's Training Bible.* 4th ed. VeloPress, 2009.
- TrainingPeaks. "Understanding Aerobic Decoupling." trainingpeaks.com methodology article.

**Edge cases:**
- Valid only for steady-state aerobic efforts ≥ 60 min at Z2 or lower.
- Requires HR + power (cycling) or HR + speed (running) streams from FIT import.
- Returns `valid: false` with a reason string when the effort is too short or data is missing.
- Decoupling is computed per entry from FIT data and stored as `entry.decouplingPct`.

**Validation:** `src/lib/decoupling.test.js`

---

## 11. Injury Risk Score

**Plain English:** A 5-factor composite score (0–100) combining workload and recovery signals to predict short-term injury likelihood. Each factor is independently flagged and weighted; they do not interact multiplicatively.

**Factors and weights:**

| Factor | Weight (HRV present) | Weight (no HRV) |
|---|---|---|
| ACWR spike (> 1.5 = 35 pts, > 1.3 = 15 pts) | 25% | 30% |
| Training monotony (> 2.0) | 20% | 25% |
| Consecutive high-RPE days (≥ 3) | 20% | 25% |
| Recovery deficit (readiness < 50 = 25 pts, < 65 = 10 pts) | 15% | 20% |
| HRV instability (CV > 10% or single-day drop > 15%) | 20% | — |

Risk levels: `low` (0–29), `moderate` (30–54), `high` (55–100).

**Implementation:** `src/lib/intelligence.js` → `predictInjuryRisk(log, recovery)`

Returns `{ level, score, factors[], advice }`. Each factor includes a bilingual detail string with the supporting citation.

**Citation:**
- Gabbett TJ. "The training-injury prevention paradox: should athletes be training smarter and harder?" *Br J Sports Med.* 2016;50(5):273–280.
- Hulin BT et al. "The acute:chronic workload ratio predicts injury." *Br J Sports Med.* 2016;50(4):231–236.
- Foster C. "Monitoring training in athletes with reference to overtraining syndrome." *Med Sci Sports Exerc.* 1998;30(7):1164–1168.

**Edge cases:**
- Returns `level: 'unknown'` when log is empty.
- HRV factor is redistributed proportionally to other factors when no HRV data is available.
- Score is advisory only — not validated as a clinical injury prediction tool.

**Validation:** `src/lib/intelligence.test.js`

---

## 12. VO2max Normative Tables

**Plain English:** Given a sport, age group, gender, and VO2max value, this function returns an ACSM fitness category (Poor / Fair / Good / Excellent / Superior) and an estimated percentile (0–100) by comparing against published normative bands.

**Algorithm:**

1. Look up the age group row: 18–29, 30–39, 40–49, 50–59, 60+.
2. Walk the five ACSM bands (Poor → Superior) by their upper bounds for the athlete's sport, gender, and age group.
3. Linearly interpolate within the matched band to estimate percentile.
4. If above Superior: extrapolate with a capped bonus (max 100th percentile).

**Implementation:** `src/lib/sport/normativeTables.js` → `getVO2maxNorm(sport, age, gender, vo2max)`

Sports covered: `running`, `cycling`, `rowing`, `swimming`.

**Citation:**
- American College of Sports Medicine. *ACSM's Guidelines for Exercise Testing and Prescription.* 11th ed. Wolters Kluwer, 2021. Table 4.8 (Cardiorespiratory Fitness Classification).

**Edge cases:**
- Returns `{ percentile: 0, category: 'Unknown' }` if sport/gender/age group is not found in the table.
- VO2max for field tests (Cooper, Åstrand, Yo-Yo) carries ±3–5 mL/kg/min error; percentile interpretation should allow for this range.
- Swimming norms are less well-established than running or cycling; treat swimming percentiles as approximate.

**Validation:** `src/lib/sport/normativeTables.test.js`
