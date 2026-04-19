# Sporeus Science Citation Audit — v8.2.2

> Every formula in the Sporeus codebase must appear in this document with its primary source.
> No formula without a citation. If you add a metric, add its citation here first.
> Tests in `src/lib/__tests__/science/` verify implementations against worked examples.

---

## Training Load Model

### CTL / ATL (Chronic / Acute Training Load)

| Formula | Implementation | Source |
|---------|---------------|--------|
| `CTL(t) = CTL(t−1) × (1 − K_CTL) + TSS(t) × K_CTL` | `src/lib/trainingLoad.js:calculatePMC()` | Banister E.W. & Calvert T.W. (1980). *Planning for future performance: implications for long term training.* Can J Appl Sport Sci 5:170–176. |
| `K_CTL = 1 − e^(−1/42)` | `src/lib/sport/constants.js:BANISTER.K_CTL` | Banister & Calvert (1980); Busso T. (2003). *Variable dose-response relationship.* Med Sci Sports Exerc 35:1188–1195. |
| `K_ATL = 1 − e^(−1/7)` | `src/lib/sport/constants.js:BANISTER.K_ATL` | Same — τ_ATL=7d represents fatigue time constant. |
| `TSB = CTL(prev) − ATL(prev)` | `src/lib/trainingLoad.js:calculatePMC()` | Coggan A.R. (2003). *Training and Racing with a Power Meter.* VeloPress. TrainingPeaks PMC methodology. |

**EWMA derivation**: τ=42d for CTL means half-life = τ × ln(2) ≈ 29 days (fitness halves every 29 days without training). τ=7d for ATL means fatigue halves every 5 days.

**Boundary values**: 180-day prime window ensures CTL/ATL are not artificially low at the start of the display window.

---

### TSB Zone Classification

| Zone | TSB range | Source |
|------|-----------|--------|
| Transitional | > +25 | Coggan A.R. *Training & Racing with a Power Meter* (2nd ed.) |
| Fresh / Form | +5 to +25 | Same |
| Neutral | −10 to +5 | Same |
| Optimal Training | −30 to −10 | Same |
| Overreaching Risk | < −30 | Same |

**Implementation**: `src/lib/trainingLoad.js:classifyTSB()`, `TSB_ZONES` constant.

---

### Banister Impulse-Response (Fitness Prediction)

| Formula | Implementation | Source |
|---------|---------------|--------|
| `g(t) = Σ TSS[d] × e^(−(t−d)/45)` | `src/lib/trainingLoad.js:fitBanister()` | Banister E.W. (1975). *Systems model of training for athletic performance.* Aust J Sports Med 7:57–61. |
| `h(t) = Σ TSS[d] × e^(−(t−d)/15)` | Same | τ₁=45d, τ₂=15d: Busso et al. (1994). *Modelling of adaptations to physical training.* J Appl Physiol 77:1714–1721. |
| `Performance = p₀ + k₁·g(t) − k₂·h(t)` | Same, OLS fit | Banister (1975); Morton R.H. (1997). *Modelling training and overtraining.* J Sports Sci 15:335–340. |

---

### ACWR — Acute:Chronic Workload Ratio

| Formula | Implementation | Source |
|---------|---------------|--------|
| EWMA-based ACWR; λ_acute=0.25, λ_chronic=0.067 | `src/lib/trainingLoad.js:calculateACWR()` | Hulin B.T. et al. (2016). *The acute:chronic workload ratio predicts injury.* Br J Sports Med 50(4):231–236. |
| Danger threshold: ratio > 1.5 | `src/lib/sport/constants.js:ACWR.CAUTION_MAX` | Gabbett T.J. (2016). *The training-injury prevention paradox.* Br J Sports Med 50(5):273–280. |
| Optimal range: 0.8–1.3 | `src/lib/sport/constants.js:ACWR.OPTIMAL_MIN/MAX` | Same. |

**Note on EWMA vs rolling**: EWMA ACWR (Hulin 2016) is preferred over rolling-window ACWR. Rolling ACWR can be volatile at the edges of 28-day windows.

---

### Training Monotony & Strain

| Formula | Implementation | Source |
|---------|---------------|--------|
| `monotony = mean₇d(TSS) / stdev₇d(TSS)` | `src/lib/trainingLoad.js:computeMonotony()` | Foster C. et al. (1998). *Monitoring training in athletes with reference to overtraining syndrome.* Med Sci Sports Exerc 30(7):1164–1168. |
| `strain = weekTSS × monotony` | Same | Foster (1998). |
| Overreach risk: monotony > 2.0 | Same | Foster (1998). Table 2, illness incidence above monotony threshold. |

**Missing-day handling**: Days with no session are included as 0 TSS. This is critical — Foster's methodology includes rest days in the standard deviation calculation, which is what makes highly monotonous training detectable (all days look the same = low stdev = high monotony ratio).

---

## Power Metrics

### Normalized Power

| Formula | Implementation | Source |
|---------|---------------|--------|
| 30s rolling mean → 4th-power mean → 0.25 root | `src/lib/formulas.js:normalizedPower()` | Coggan A.R. (2003). *Training and Racing with a Power Meter.* Chapter 3. |

**Rationale for 4th power**: The muscle fiber recruitment curve is approximately a 4th-power function of power output, meaning doubling power recruits much more than twice as many fibers. NP captures this non-linearity.

---

### TSS (Training Stress Score)

| Formula | Implementation | Source |
|---------|---------------|--------|
| `TSS = (durationSec × NP × IF) / (FTP × 3600) × 100` | `src/lib/formulas.js:computePowerTSS()` | Coggan A.R. (2003). Same. IF = NP / FTP. |
| sRPE proxy: `TSS ≈ (duration_hr) × (RPE/10 × 1.05)² × 100` | `src/lib/formulas.js:calcTSS()` | Foster C. et al. (2001). *A new approach to monitoring exercise training.* J Strength Cond Res 15(1):109–115. |

**Unit check**: TSS is dimensionless. 1 hour exactly at FTP = 100 TSS (verification: NP=FTP, IF=1.0, durationSec=3600 → 3600×FTP×1/(FTP×3600)×100 = 100 ✓).

---

### IF (Intensity Factor)

| Formula | Implementation | Source |
|---------|---------------|--------|
| `IF = NP / FTP` | `src/lib/formulas.js:computePowerTSS()` | Coggan A.R. (2003). |

---

### Critical Power & W'

| Formula | Implementation | Source |
|---------|---------------|--------|
| 2-parameter CP model: `P(t) = W'/t + CP` (linear: y = CP + W'·(1/t)) | `src/lib/powerAnalysis.js:fitCriticalPower()` | Monod H. & Scherrer J. (1965). *The work capacity of a synergic muscle group.* Ergonomics 8:329–338. Updated: Jones A.M. et al. (2010). *Critical power.* Exerc Sport Sci Rev 38:92–99. |
| W' balance differential model: `τ = 546·e^(−0.01×(CP−P̄)) + 316` | `src/lib/formulas.js:computeWPrime()` | Skiba P.F. et al. (2012). *Modeling the expenditure and reconstitution of work capacity above critical power.* Med Sci Sports Exerc 44(8):1526–1532. |

---

### FTP Estimation

| Formula | Implementation | Source |
|---------|---------------|--------|
| `FTP = 0.95 × P_20min` | `src/lib/formulas.js:ftpFrom20()` | Coggan A.R. (2003). 20-min test protocol correction factor. |
| `FTP = 0.75 × P_ramp_peak` | `src/lib/formulas.js:rampFTP()` | British Cycling ramp test protocol. Reproduced in Allen H. & Coggan A.R. *Training & Racing with a Power Meter* (3rd ed.). |

---

## Running Metrics

### Riegel Race Time Predictor

| Formula | Implementation | Source |
|---------|---------------|--------|
| `T₂ = T₁ × (D₂/D₁)^1.06` | `src/lib/formulas.js:riegel()` | Riegel P.S. (1981). *Athletic records and human endurance.* American Scientist 69(3):285–290. Exponent 1.06 for endurance events up to marathon. |

**Limitations**: Riegel exponent assumes steady pacing; overestimates for very short (<400m) or very long (>100km) events.

---

### VDOT (Daniels)

| Formula | Implementation | Source |
|---------|---------------|--------|
| VO₂ demand curve from race time | `src/lib/vdot.js`, `src/lib/sport/constants.js:DANIELS` | Daniels J. & Gilbert J. (1979). *Oxygen power.* Self-published. Coefficients from Daniels J. *Daniels' Running Formula* (3rd ed., 2014). |

---

## Aerobic Decoupling

| Formula | Implementation | Source |
|---------|---------------|--------|
| `decoupling% = (ratio₁ − ratio₂) / ratio₁ × 100` where ratio = power÷HR (or speed÷HR) | `src/lib/decoupling.js:computeDecoupling()` | Friel J. (2009). *The Cyclist's Training Bible* (4th ed.). VeloPress. §Aerobic decoupling. |
| Thresholds: < 5% coupled; 5–10% mild; > 10% significant | `src/lib/decoupling.js:DECOUPLING_THRESHOLDS` | Same. TrainingPeaks: "Understanding Aerobic Decoupling" (methodology article). |
| Minimum 60-minute steady-state effort for valid measurement | `src/lib/decoupling.js:computeDecoupling()` | Same — short efforts don't exhibit stable drift. |

---

## HRV Metrics

### RMSSD

| Formula | Implementation | Source |
|---------|---------------|--------|
| `RMSSD = √(mean of squared successive RR differences)` | `src/lib/hrv.js:computeRMSSD()` | Task Force of ESC/NASPE (1996). *Standards of measurement of HRV.* Eur Heart J 17:354–381. |
| lnRMSSD = ln(RMSSD) | Same | Eckberg D.L. (1997). Sympathovagal balance. |

### DFA-α1 (Aerobic Threshold Detection)

| Formula | Implementation | Source |
|---------|---------------|--------|
| Short-scale DFA-α1; n=4–16 beats | `src/lib/hrv.js:computeDFAAlpha1()` | Gronwald T. et al. (2019). *Correlation properties of heart rate variability during endurance exercise.* Front Physiol 10:1361. Updated: Gronwald T. et al. (2020). *Effects of exercise intensity on fractal and oscillatory components.* J Clin Med 9(3):598. |
| α1 threshold: ~0.75 correlates with VT1 / LT1 | Same | Gronwald (2020). |

---

## Body Composition

| Formula | Implementation | Source |
|---------|---------------|--------|
| US Navy body fat: neck/waist/hip/height method | `src/lib/formulas.js:navyBF()` | Hodgdon J.A. & Beckett M.B. (1984). *Prediction of body fat for males and females.* NAMRL Technical Report. |
| Mifflin-St Jeor BMR | `src/lib/formulas.js:mifflinBMR()` | Mifflin M.D. et al. (1990). *A new predictive equation for resting metabolic rate.* Am J Clin Nutr 51:241–247. |

---

## Zone Distribution

| Formula | Implementation | Source |
|---------|---------------|--------|
| RPE → Zone proxy (Borg CR10 mapping) | `src/lib/zoneDistrib.js:rpeToZone()` | Borg G. (1990). *Psychophysical scaling.* Scand J Work Environ Health 16:55–58. |
| Polarized distribution: Z1+Z2 ≥ 70%, Z4+Z5 ≥ 15% | `src/lib/zoneDistrib.js:trainingModel()` | Seiler K.S. & Kjerland G.Ø. (2006). *Quantifying training intensity distribution.* Scand J Med Sci Sports 16(1):49–56. Seiler S. (2010). *What is best practice for training intensity distribution?* Int J Sports Physiol Perform 5(3):276–291. |

---

## Rowing

| Formula | Implementation | Source |
|---------|---------------|--------|
| Paul's Law: `T₂ = T₁ × (D₂/D₁)^1.07` | `src/lib/sport/rowing.js` | Paul (1969). *Rowing power.* British Journal of Sports Medicine. Exponent 1.07 for rowing (higher drag than running). |
| 2000m prediction from multiple tests | `src/lib/sport/rowing.js:predict2000mFromMultipleTests()` | Concept2 testing methodology; Riegel adaptation for rowing. |

---

## Lactate Threshold

| Formula | Implementation | Source |
|---------|---------------|--------|
| Dmax method (cubic polynomial) | `src/lib/sport/lactate.js` | Cheng B. et al. (1992). *A new approach for the determination of ventilatory and lactate thresholds.* Int J Sports Med 13(7):518–522. |
| Fixed LT1 = 2.0 mmol/L | `src/lib/sport/constants.js:LACTATE.LT1_FIXED_MMOL` | Standard laboratory convention. |
| Fixed LT2 = 4.0 mmol/L ("OBLA") | `src/lib/sport/constants.js:LACTATE.LT2_FIXED_MMOL` | Sjödin B. & Jacobs I. (1981). *Onset of blood lactate accumulation.* Int J Sports Med 2:23–26. |

---

## Efficiency Factor (E12)

| Formula | Implementation | Source |
|---------|---------------|--------|
| `EF = NP / avg_HR` (cycling) | `src/lib/science/efficiencyFactor.js:computeEF()` | Coggan A.R. (2003). *Training and Racing with a Power Meter.* VeloPress. EF as aerobic adaptation benchmark. |
| `EF = avgPace_m_per_min / avg_HR` (running) | `src/lib/science/efficiencyFactor.js:computeEF()` | Allen H. & Coggan A.R. (2010). *Training and Racing with a Power Meter* (2nd ed.). VeloPress. Running adaptation of EF metric. |
| `efTrend`: first-half vs second-half mean, ≥8 sessions, 30-day window; improving ≥2%, declining ≤−2% | `src/lib/science/efficiencyFactor.js:efTrend()` | Coggan A.R. (2003) ibid. — EF improvement over 4–6 weeks as primary aerobic adaptation signal. |

---

## Durability Score (E12)

| Formula | Implementation | Source |
|---------|---------------|--------|
| `durability% = lastHour5minPeak / baseline5minMMP × 100` | `src/lib/science/durabilityScore.js:computeDurability()` | Maunder E. et al. (2021). *Relevance of training volume, intensity distribution and durability to middle- and long-distance triathlon.* Sports Med 51:1523–1550. DOI:10.1007/s40279-021-01459-0 |
| Thresholds: ≥95% high; 90–95% moderate; 85–90% low; <85% very_low | `src/lib/science/durabilityScore.js:DURABILITY_THRESHOLDS` | Same. Reported ranges from elite-to-recreational triathlete cohorts. |
| Minimum 90-minute session for valid measurement | `src/lib/science/durabilityScore.js:computeDurability()` | Rønnestad B.R. & Vikmoen O. (2019). *Physiological determinants of long-distance cycling performance.* Sports Med. Durability is meaningful only when fatigue has accumulated. |

---

## Sub-threshold Time (E12)

| Formula | Implementation | Source |
|---------|---------------|--------|
| Weekly Z1+Z2 minutes (polarized 3-zone model: sub-threshold = below VT2/LT2) | `src/lib/science/subThresholdTime.js:weekSubThresholdMin()` | Seiler S. (2010). *What is best practice for training intensity distribution in endurance sport?* Int J Sports Physiol Perform 5(3):276–291. |
| ~80% of training time should be sub-threshold (polarized model benchmark) | `src/lib/science/subThresholdTime.js` | Seiler K.S. & Kjerland G.Ø. (2006). *Quantifying training intensity distribution in elite endurance athletes.* Scand J Med Sci Sports 16(1):49–56. |
| 8-week sub-threshold trend for periodization analysis | `src/lib/science/subThresholdTime.js:subThresholdTrend()` | Seiler S. (2010) ibid. — multi-week perspective needed to assess polarization compliance. |

---

## Formulas Without a Primary Citation (Flag for Review)

If any formula is found to lack a citation, add it here for tracking:

| Formula | File | Status |
|---------|------|--------|
| *(none currently flagged)* | — | — |

**Protocol**: Before adding a new metric, add its citation to this table. Without a citation, the metric does not ship. This is the "we use Coggan/Banister/Skiba/Friel" claim made testable.
