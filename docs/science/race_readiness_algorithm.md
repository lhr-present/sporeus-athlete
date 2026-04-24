# Race Readiness Algorithm

**Implementation:** `src/lib/race/readinessScore.js`
**Version:** E14 (v11.18.0)

---

## Algorithm Purpose

The readiness score estimates the probability that an athlete is in optimal physiological state for a race. It does **not** predict finish time — that is handled by `paceStrategy.js` via VDOT. It scores preparedness on a 0–100 scale using five independent signals with explicit missing-data handling.

---

## Why These 5 Components

| Component | Weight | Rationale | Source |
|-----------|--------|-----------|--------|
| **Form** (CTL/peak) | 0.30 | Training load relative to recent peak captures fitness development trajectory. A CTL at 95% of recent peak indicates optimal build without unexplained crash. | Coggan (2003) PMC framework |
| **TSB** (Training Stress Balance) | 0.25 | TSB directly measures acute fatigue removed relative to chronic fitness. Mujika (2010) establishes the sweet spot [+5, +20] as optimal for race performance. | Mujika I. (2010) Scand J Med Sci Sports |
| **HRV Trend** (7-day vs 28-day baseline) | 0.20 | HRV 7-day mean elevated above individual 28-day baseline (z ≥ +0.5) reflects parasympathetic recovery and readiness for maximal effort. | Plews et al. (2012) Sports Med |
| **Sleep** (7-day mean) | 0.15 | Fullagar et al. (2015) systematic review: sleep below 7h impairs reaction time, VO2max utilisation, and perceived exertion. Threshold piecewise reflects dose-response evidence. | Fullagar et al. (2015) Sports Med |
| **Subjective Wellbeing** (1–10) | 0.10 | Hooper questionnaire self-report correlates with overtraining markers. Simplest signal — lowest weight — but non-trivially predictive when other data is available. | Hooper & Mackinnon (1995) Sports Med |

---

## Explicit Rejections

| Signal | Reason Not Included |
|--------|---------------------|
| HRV daily spot reading | Too noisy. A single resting HRV measurement without baseline context produces false positives. Only the 7-day vs 28-day comparison is included. |
| Absolute CTL value | Not comparable across athletes. A CTL of 60 is excellent for a beginner and undertrained for an elite. Relative form (CTL/peakCTL) is the correct metric. |
| Race history win rates | Requires cohort data. Out of scope for a single-athlete tool. |
| Weather/course difficulty | External factor outside training state scope. |
| Nutrition/hydration | No reliable quantitative model. |

---

## Weight Rationale

Weights sum to 1.0: 0.30 + 0.25 + 0.20 + 0.15 + 0.10 = 1.00

TSB + form = 0.55, reflecting that PMC-derived metrics are the most validated predictors of race performance from the endurance literature. HRV + sleep + subjective = 0.45, representing the recovery-signal layer.

---

## Re-normalisation Math

When components are unavailable (e.g., no HRV baseline), their weight is redistributed proportionally across available components so the score remains in [0, 100].

**Example: HRV unavailable (weight 0.20)**

Available weight = 1.00 − 0.20 = 0.80

Each available component is divided by 0.80 before computing contribution:
- form:       0.30/0.80 = 0.375 → contribution = value × 0.375
- tsb:        0.25/0.80 = 0.3125
- sleep:      0.15/0.80 = 0.1875
- subjective: 0.10/0.80 = 0.125

Score = sum of contributions, still in [0, 100]. HRV contribution = 0 (not fabricated).

**If missingWeight > 0.50:** score = null, classification = 'insufficient_data'.

---

## Classification Thresholds

| Score | Classification | Interpretation |
|-------|---------------|----------------|
| 85–100 | `peaked` | Optimal taper completion. TSB in sweet spot, fitness near recent peak. |
| 70–84  | `ready`   | Minor optimisation possible but athlete is competition-ready. |
| 50–69  | `needs_work` | Fatigue, low fitness, or inadequate recovery signals. |
| 0–49   | `overreached` | Significant accumulated fatigue or extreme detraining. |
| null   | `insufficient_data` | CTL or TSB missing, or >50% of weight unavailable. |

---

## Limitations

1. **Proxy, not prediction.** The score has not been validated against finish-time outcomes in a controlled cohort. It is a structured synthesis of expert consensus, not an empirically fitted model.
2. **Individual variance.** Optimal TSB varies by athlete. A sprinter and a marathon runner have different sweet spots.
3. **No longitudinal calibration.** The algorithm cannot learn from whether a given athlete performed well at a particular score. Future work: user-specific weight calibration via historical race results.
4. **Single snapshot.** The score reflects the current moment. It does not model how the score will evolve under different training approaches (that is the taper simulator's role).

---

## References

- Coggan A. (2003). Training and racing using a power meter.
- Mujika I. (2010). Intense training: the key to optimal performance before and during the taper. Scand J Med Sci Sports 20(s2):24–31.
- Plews D.J. et al. (2012). Training adaptation and heart rate variability in elite endurance athletes. Sports Med 43(9):773–781.
- Fullagar H.H.K. et al. (2015). Sleep and athletic performance. Sports Med 45:161–186.
- Hooper S.L., Mackinnon L.T. (1995). Monitoring overtraining in athletes. Sports Med 20(5):321–327.
- Busso T. (2003). Variable dose-response relationship between exercise training and performance. Med Sci Sports Exerc 35(7):1188–1195.
