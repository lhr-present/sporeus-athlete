// ─── dashboard/CoachingInsightsDigest.jsx — Unified coaching priorities card ─
// Combines staleZones + workoutDensity + sessionVariety + fitnessGainRate +
// easyDayCompliance + detraining + monotonyStrain + vo2Gap + streak +
// sessionRPEDrift + recoveryDebt + timeInZone + supercompensationWindow +
// trainingPolarization + fitnessConsistency + recoveryAdherence +
// trainingDiversity + deloadCadence into ONE compact "this week's coaching
// priorities" view so users get a single-glance summary before scrolling
// through the individual detector cards.
// Citations: Seiler 2010; Foster 2001; Gabbett 2016; Banister 1991;
//            Stöggl & Sperlich 2014; Mujika & Padilla 2000;
//            Bompa & Haff 2009; Issurin 2010; Tonnessen 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectStaleZones } from '../../lib/athlete/staleZones.js'
import { detectWorkoutDensity } from '../../lib/athlete/workoutDensity.js'
import { detectSessionVariety } from '../../lib/athlete/sessionVariety.js'
import { detectFitnessGainRate } from '../../lib/athlete/fitnessGainRate.js'
import { detectEasyDayCompliance } from '../../lib/athlete/easyDayCompliance.js'
import { detectDetraining } from '../../lib/athlete/detrainingDetector.js'
import { detectMonotonyStrain } from '../../lib/athlete/trainingMonotonyStrain.js'
import { detectVO2Gap } from '../../lib/athlete/vo2GapDetector.js'
import { detectStreak } from '../../lib/athlete/streakDetector.js'
import { detectSessionRPEDrift } from '../../lib/athlete/sessionRPEDrift.js'
import { detectRecoveryDebt } from '../../lib/athlete/recoveryDebt.js'
import { detectTimeInZone } from '../../lib/athlete/timeInZone.js'
import { detectSupercompensation } from '../../lib/athlete/supercompensationWindow.js'
import { detectTrainingPolarization } from '../../lib/athlete/trainingPolarization.js'
import { detectFitnessConsistency } from '../../lib/athlete/fitnessConsistency.js'
import { detectRecoveryAdherence } from '../../lib/athlete/recoveryAdherence.js'
import { detectTrainingDiversity } from '../../lib/athlete/trainingDiversity.js'
import { detectDeloadCadence } from '../../lib/athlete/deloadCadence.js'

const SEVERITY_BULLET = {
  high:     '🔴',
  moderate: '🟡',
  low:      '🟢',
  positive: '🟢',
}

const SEVERITY_LABEL = {
  high:     { en: 'high',     tr: 'yüksek' },
  moderate: { en: 'moderate', tr: 'orta' },
  low:      { en: 'low',      tr: 'düşük' },
  positive: { en: 'positive', tr: 'olumlu' },
}

const SOURCE_LABEL = {
  DENSITY:  { en: 'DENSITY',   tr: 'YOĞUNLUK' },
  VARIETY:  { en: 'VARIETY',   tr: 'ÇEŞİTLİLİK' },
  ZONES:    { en: 'ZONES',     tr: 'BÖLGELER' },
  STALE:    { en: 'STALE',     tr: 'İHMAL' },
  FITNESS:  { en: 'FITNESS',   tr: 'FORM' },
  EASY:     { en: 'EASY DAYS', tr: 'KOLAY GÜNLER' },
  GAP:      { en: 'GAP',       tr: 'ARA' },
  MONOTONY: { en: 'MONOTONY',  tr: 'MONOTONLUK' },
  VO2:      { en: 'VO2',       tr: 'VO2' },
  STREAK:   { en: 'STREAK',    tr: 'SERİ' },
  RPE:      { en: 'RPE',       tr: 'RPE' },
  DEBT:     { en: 'DEBT',      tr: 'BORÇ' },
  WINDOW:   { en: 'WINDOW',    tr: 'PENCERE' },
  POL:      { en: 'POL',       tr: 'POL' },
  STABILITY:{ en: 'STABILITY', tr: 'STABİLİTE' },
  REST:     { en: 'REST',      tr: 'DİNLENME' },
  MIX:      { en: 'MIX',       tr: 'KARIŞIM' },
  DELOAD:   { en: 'DELOAD',    tr: 'DELOAD' },
}

const CITATION =
  'Seiler 2010; Foster 2001; Gabbett 2016; Banister 1991; Stöggl & Sperlich 2014; Mujika & Padilla 2000; Bompa & Haff 2009; Issurin 2010; Tonnessen 2014'
const MAX_ROWS = 3

// ─── Detraining helpers ──────────────────────────────────────────────────────
const SEVERITY_RANK = { severe: 4, major: 3, moderate: 2, minor: 1 }

/**
 * Pick the most severe detraining signal worth surfacing. Prefers the active
 * trailing gap if present; otherwise scans closed gaps for one of moderate or
 * worse severity. Returns null when nothing should surface.
 */
function pickDetrainingSignal(detraining) {
  if (!detraining || !detraining.reliable) return null
  if (detraining.inActiveGap && detraining.activeSeverity) {
    return {
      severity: detraining.activeSeverity,
      durationDays: detraining.currentGap,
      message: detraining.recommendation,
      active: true,
    }
  }
  // Fall back to most severe closed gap of moderate or above.
  const gaps = Array.isArray(detraining.gaps) ? detraining.gaps : []
  let best = null
  for (const g of gaps) {
    if (!g || !g.severity) continue
    if (SEVERITY_RANK[g.severity] < SEVERITY_RANK.moderate) continue
    if (!best || SEVERITY_RANK[g.severity] > SEVERITY_RANK[best.severity]) best = g
  }
  if (!best) return null
  return {
    severity: best.severity,
    durationDays: best.durationDays,
    message: best.description,
    active: false,
  }
}

// ─── Priority synthesis ──────────────────────────────────────────────────────
/**
 * Build a prioritized list of insights from the eighteen detectors.
 *   1. detraining severe/major                     (gap-based detraining)
 *   2. recoveryDebt band==='overreached'           (TSB-deficit cumulative)
 *   3. vo2Gap severe/never                         (top-end fitness fading)
 *   4. monotonyStrain band==='high'                (overtraining via uniformity)
 *   5. fitnessConsistency band==='chaotic'         (CTL chaos — no structured build)
 *   6. recoveryDebt band==='fatigued'              (TSB-deficit moderate)
 *   7. deloadCadence band==='overdue'              (3:1 cadence broken — fatigue risk)
 *   8. density.risk === 'high'                     (overtraining)
 *   9. fitnessGainRate.band === 'spiking'          (load spike)
 *  10. easyDayCompliance.band === 'poor'           (no recovery happening)
 *  11. sessionRPEDrift band==='high'               (execution discipline urgent)
 *  12. recoveryAdherence band==='poor'             (rest days not honored)
 *  13. trainingPolarization pattern==='threshold'  (Z3-dominant no-man's-land)
 *  14. trainingDiversity band==='monotypic'        (single-sport injury risk)
 *  15. timeInZone band==='poor'                    (broad zone imbalance)
 *  16. first stale/dropped zone                    (zone neglect)
 *  17. variety === 'low'                           (monotony)
 *  18. fitnessGainRate.band === 'detraining'       (form loss)
 *  19. density.risk === 'moderate'                 (early overload)
 *  20. detraining moderate                         (lower-severity gap)
 *  21. vo2Gap critical                             (Z5 overdue)
 *  22. easyDayCompliance.band === 'moderate'       (drift, informational)
 *  23. timeInZone moderate Z2-under                (specific actionable)
 *  24. sessionRPEDrift moderate w/ worstType       (specific actionable drift)
 *  25. variety === 'moderate'                      (informational)
 *  26. streak risk                                 (consecutive-day risk)
 *  27. streak celebrating ≥7d                      (positive headline)
 *  28. supercompensationWindow band==='peak'       (positive — best window)
 *  29. supercompensationWindow band==='opportunity'(positive — rising)
 *  30. supercompensationWindow band==='building'   (informational — approaching)
 * Capped at MAX_ROWS. Detectors with reliable === false are silently excluded.
 */
function buildInsights(
  stale, density, variety, fitness, easy,
  detraining, monotony, vo2, streak, rpeDrift, recoveryDebt,
  timeInZone, supercomp, polarization, fitnessConsistency, recoveryAdherence,
  trainingDiversity, deloadCadence,
) {
  const rows = []
  const detSignal = pickDetrainingSignal(detraining)

  // 1. Detraining severe / major (highest priority — substantial fitness loss)
  if (detSignal && (detSignal.severity === 'severe' || detSignal.severity === 'major')) {
    rows.push({
      key: `detraining-${detSignal.severity}-${detSignal.durationDays}`,
      severity: 'high',
      source: 'GAP',
      message: detSignal.message,
    })
  }

  // 2. Recovery debt overreached (cumulative TSB deficit — taper or rest now)
  if (recoveryDebt.reliable && recoveryDebt.band === 'overreached') {
    rows.push({
      key: 'debt-overreached',
      severity: 'high',
      source: 'DEBT',
      message: recoveryDebt.message,
    })
  }

  // 3. VO2 gap severe / never (top-end fitness fading)
  if (vo2.reliable && (vo2.band === 'severe' || vo2.band === 'never')) {
    rows.push({
      key: `vo2-${vo2.band}`,
      severity: 'high',
      source: 'VO2',
      message: vo2.message,
    })
  }

  // 4. Monotony / strain high (overtraining risk via uniformity)
  if (monotony.reliable && monotony.band === 'high') {
    rows.push({
      key: 'monotony-high',
      severity: 'high',
      source: 'MONOTONY',
      message: monotony.message,
    })
  }

  // 5. fitnessConsistency chaotic (CTL chaos — no structured build possible)
  // High-severity warning: when the trailing 90d weekly-CTL CV is chaotic
  // (≥0.20), the athlete cannot accumulate adaptation. Surface above
  // recoveryDebt-fatigued because chaos guarantees no progressive overload,
  // whereas fatigued is recoverable with one rest cycle. Other bands stay
  // silent: oscillating overlaps with monotonyStrain/fitnessGainRate signals,
  // and stable / rock-solid are positives already implied by the all-green
  // path.
  if (fitnessConsistency.reliable && fitnessConsistency.band === 'chaotic') {
    rows.push({
      key: 'fitness-consistency-chaotic',
      severity: 'high',
      source: 'STABILITY',
      message: fitnessConsistency.message,
    })
  }

  // 6. Recovery debt fatigued (TSB-deficit moderate — manage recovery)
  if (recoveryDebt.reliable && recoveryDebt.band === 'fatigued') {
    rows.push({
      key: 'debt-fatigued',
      severity: 'moderate',
      source: 'DEBT',
      message: recoveryDebt.message,
    })
  }

  // 7. deloadCadence overdue (3:1 cadence broken — fatigue-management signal)
  // High-severity warning: when ≥5 weeks have passed without a deload, fatigue
  // accumulates beyond the recoverable range. Surfaces alongside recoveryDebt
  // signals because both are fatigue-management warnings, but distinct from
  // both: recoveryDebt is right-now TSB integral, deloadCadence audits the
  // weekly volume rhythm. Other bands stay silent — too-frequent overlaps with
  // fitnessGainRate-detraining; on-schedule is positive; no-pattern would be
  // noise for non-periodized casual athletes.
  if (deloadCadence.reliable && deloadCadence.band === 'overdue') {
    rows.push({
      key: 'deload-overdue',
      severity: 'high',
      source: 'DELOAD',
      message: deloadCadence.message,
    })
  }

  // 8. High-risk density (overtraining warning)
  if (density.reliable && density.risk === 'high') {
    rows.push({
      key: 'density-high',
      severity: 'high',
      source: 'DENSITY',
      message: density.message,
    })
  }

  // 9. Spiking fitness (load spike → injury risk)
  if (fitness.reliable && fitness.band === 'spiking') {
    rows.push({
      key: 'fitness-spiking',
      severity: 'high',
      source: 'FITNESS',
      message: fitness.message,
    })
  }

  // 10. Poor easy-day compliance (training quality — no recovery happening)
  if (easy.reliable && easy.band === 'poor') {
    rows.push({
      key: 'easy-poor',
      severity: 'moderate',
      source: 'EASY',
      message: easy.message,
    })
  }

  // 11. sessionRPEDrift high (execution discipline issue — broad RPE drift)
  if (rpeDrift.reliable && rpeDrift.band === 'high') {
    rows.push({
      key: 'rpe-high',
      severity: 'high',
      source: 'RPE',
      message: rpeDrift.message,
    })
  }

  // 12. recoveryAdherence poor (planned rest days not honored — discipline)
  // Moderate-severity warning: when <50% of labeled rest days were truly rested.
  // Surface AFTER sessionRPEDrift-high (rule 11) because broad RPE drift across
  // every session is a more general execution issue, while rest-day creep is a
  // narrower, fixable habit. moderate / good bands stay silent — moderate would
  // overlap with easyDayCompliance signals, good is already implied.
  if (recoveryAdherence.reliable && recoveryAdherence.band === 'poor') {
    rows.push({
      key: 'recovery-adherence-poor',
      severity: 'moderate',
      source: 'REST',
      message: recoveryAdherence.message,
    })
  }

  // 13. trainingPolarization threshold (Z3-dominant — no-man's-land)
  // Z3 > 25% indicates a structural intensity-distribution issue (high stress,
  // low specificity). Same severity tier as timeInZone-poor — both are broad
  // zone-balance warnings. Other patterns (polarized/pyramidal/mixed) stay
  // silent: polarized is optimal, pyramidal is healthy, mixed conflicts with
  // more-specific signals.
  if (polarization.reliable && polarization.pattern === 'threshold') {
    rows.push({
      key: 'polarization-threshold',
      severity: 'moderate',
      source: 'POL',
      message: {
        en: `${polarization.message.en}. ${polarization.recommendation.en}`,
        tr: `${polarization.message.tr}. ${polarization.recommendation.tr}`,
      },
    })
  }

  // 14. trainingDiversity monotypic (single-sport injury-resilience signal)
  // Moderate-severity warning: when only one sport is logged across the
  // trailing 28 days. Single-sport athletes face higher repetitive-strain
  // injury risk; one weekly cross-training session is the standard fix.
  // Same severity tier as polarization-threshold and recoveryAdherence-poor —
  // all are broad structural-pattern warnings. Other bands stay silent:
  // limited may be by design, balanced is positive, fragmented is rare and
  // would conflict with sessionVariety signals.
  if (trainingDiversity.reliable && trainingDiversity.band === 'monotypic') {
    rows.push({
      key: 'training-diversity-monotypic',
      severity: 'moderate',
      source: 'MIX',
      message: {
        en: `${trainingDiversity.message.en}. ${trainingDiversity.recommendation.en}`,
        tr: `${trainingDiversity.message.tr}. ${trainingDiversity.recommendation.tr}`,
      },
    })
  }

  // 15. timeInZone poor (broad zone imbalance — multiple zones off-target)
  // Placed at moderate-severity tier (after the high-severity unconditional
  // rules) so it doesn't crowd out higher-priority signals.
  if (timeInZone.reliable && timeInZone.band === 'poor') {
    rows.push({
      key: 'time-in-zone-poor',
      severity: 'moderate',
      source: 'ZONES',
      message: timeInZone.message,
    })
  }

  // 16. Top stale/dropped zone: stale beats dropped, lower zone index beats higher
  if (stale.reliable) {
    const staleZone = stale.zones.find(z => z.status === 'stale')
    const droppedZone = stale.zones.find(z => z.status === 'dropped')
    const zoneRow = staleZone || droppedZone
    if (zoneRow) {
      rows.push({
        key: `zones-${zoneRow.zone}-${zoneRow.status}`,
        severity: zoneRow.status === 'stale' ? 'moderate' : 'low',
        source: 'STALE',
        message: zoneRow.message,
      })
    }
  }

  // 17. Low variety
  if (variety.reliable && variety.variety === 'low') {
    rows.push({
      key: 'variety-low',
      severity: 'moderate',
      source: 'VARIETY',
      message: variety.message,
    })
  }

  // 18. Detraining fitness (form loss via CTL slope)
  if (rows.length < MAX_ROWS && fitness.reliable && fitness.band === 'detraining') {
    rows.push({
      key: 'fitness-detraining',
      severity: 'moderate',
      source: 'FITNESS',
      message: fitness.message,
    })
  }

  // 19. Moderate-risk density
  if (rows.length < MAX_ROWS && density.reliable && density.risk === 'moderate') {
    rows.push({
      key: 'density-moderate',
      severity: 'moderate',
      source: 'DENSITY',
      message: density.message,
    })
  }

  // 20. Detraining moderate (lower-severity gap)
  if (rows.length < MAX_ROWS && detSignal && detSignal.severity === 'moderate') {
    rows.push({
      key: `detraining-${detSignal.severity}-${detSignal.durationDays}`,
      severity: 'moderate',
      source: 'GAP',
      message: detSignal.message,
    })
  }

  // 21. VO2 gap critical (Z5 overdue)
  if (rows.length < MAX_ROWS && vo2.reliable && vo2.band === 'critical') {
    rows.push({
      key: 'vo2-critical',
      severity: 'moderate',
      source: 'VO2',
      message: vo2.message,
    })
  }

  // 22. Moderate easy-day compliance (informational)
  if (rows.length < MAX_ROWS && easy.reliable && easy.band === 'moderate') {
    rows.push({
      key: 'easy-moderate',
      severity: 'low',
      source: 'EASY',
      message: easy.message,
    })
  }

  // 23. timeInZone moderate Z2-under (specific actionable — Z2 is most-coached)
  if (
    rows.length < MAX_ROWS &&
    timeInZone.reliable &&
    timeInZone.band === 'moderate' &&
    timeInZone.worstZone !== null &&
    timeInZone.worstZone.zone === 'Z2' &&
    timeInZone.worstZone.status === 'under'
  ) {
    rows.push({
      key: 'time-in-zone-moderate-z2-under',
      severity: 'moderate',
      source: 'ZONES',
      message: timeInZone.message,
    })
  }

  // 24. sessionRPEDrift moderate (only when worstType is identified — actionable)
  if (
    rows.length < MAX_ROWS &&
    rpeDrift.reliable &&
    rpeDrift.band === 'moderate' &&
    rpeDrift.worstType !== null
  ) {
    rows.push({
      key: 'rpe-moderate',
      severity: 'moderate',
      source: 'RPE',
      message: rpeDrift.message,
    })
  }

  // 25. Moderate variety (lowest priority — informational)
  if (rows.length < MAX_ROWS && variety.reliable && variety.variety === 'moderate') {
    rows.push({
      key: 'variety-moderate',
      severity: 'low',
      source: 'VARIETY',
      message: variety.message,
    })
  }

  // 26. Streak risk (urgent — schedule a rest day)
  if (rows.length < MAX_ROWS && streak.reliable && streak.riskBand === 'risk') {
    rows.push({
      key: 'streak-risk',
      severity: 'moderate',
      source: 'STREAK',
      message: streak.message,
    })
  }

  // 27. Streak celebrating ≥7d (positive headline)
  if (
    rows.length < MAX_ROWS &&
    streak.reliable &&
    streak.riskBand === 'celebrating' &&
    streak.currentStreak >= 7
  ) {
    rows.push({
      key: 'streak-celebrating',
      severity: 'positive',
      source: 'STREAK',
      message: streak.message,
    })
  }

  // 28. Supercompensation peak (positive headline — best window)
  if (rows.length < MAX_ROWS && supercomp.reliable && supercomp.band === 'peak') {
    rows.push({
      key: 'supercomp-peak',
      severity: 'positive',
      source: 'WINDOW',
      message: supercomp.message,
    })
  }

  // 29. Supercompensation opportunity (positive — rising)
  if (rows.length < MAX_ROWS && supercomp.reliable && supercomp.band === 'opportunity') {
    rows.push({
      key: 'supercomp-opportunity',
      severity: 'positive',
      source: 'WINDOW',
      message: supercomp.message,
    })
  }

  // 30. Supercompensation building (informational — approaching)
  if (rows.length < MAX_ROWS && supercomp.reliable && supercomp.band === 'building') {
    rows.push({
      key: 'supercomp-building',
      severity: 'positive',
      source: 'WINDOW',
      message: supercomp.message,
    })
  }

  return rows.slice(0, MAX_ROWS)
}

// ─── Component ───────────────────────────────────────────────────────────────
function CoachingInsightsDigest({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(
    () => ({
      stale:               detectStaleZones(log),
      density:             detectWorkoutDensity(log),
      variety:             detectSessionVariety(log),
      fitness:             detectFitnessGainRate(log),
      easy:                detectEasyDayCompliance(log),
      detraining:          detectDetraining(log),
      monotony:            detectMonotonyStrain(log),
      vo2:                 detectVO2Gap(log),
      streak:              detectStreak(log),
      rpeDrift:            detectSessionRPEDrift(log),
      recoveryDebt:        detectRecoveryDebt(log),
      timeInZone:          detectTimeInZone(log),
      supercomp:           detectSupercompensation(log),
      polarization:        detectTrainingPolarization(log),
      fitnessConsistency:  detectFitnessConsistency(log),
      recoveryAdherence:   detectRecoveryAdherence(log),
      trainingDiversity:   detectTrainingDiversity(log),
      deloadCadence:       detectDeloadCadence(log),
    }),
    [log]
  )

  const {
    stale, density, variety, fitness, easy,
    detraining, monotony, vo2, streak, rpeDrift, recoveryDebt,
    timeInZone, supercomp, polarization, fitnessConsistency, recoveryAdherence,
    trainingDiversity, deloadCadence,
  } = result

  // Card title (rendered for every state)
  const title = isTR ? 'ANTRENÖR İÇGÖRÜLERİ' : 'COACHING INSIGHTS'

  // ─── Empty state: every detector unreliable ────────────────────────────────
  if (
    !stale.reliable &&
    !density.reliable &&
    !variety.reliable &&
    !fitness.reliable &&
    !easy.reliable &&
    !detraining.reliable &&
    !monotony.reliable &&
    !vo2.reliable &&
    !streak.reliable &&
    !rpeDrift.reliable &&
    !recoveryDebt.reliable &&
    !timeInZone.reliable &&
    !supercomp.reliable &&
    !polarization.reliable &&
    !fitnessConsistency.reliable &&
    !recoveryAdherence.reliable &&
    !trainingDiversity.reliable &&
    !deloadCadence.reliable
  ) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={
          isTR ? 'Antrenör içgörüleri — yetersiz veri' : 'Coaching insights — not enough data'
        }
        style={{ ...S.card, animationDelay: '180ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Antrenman içgörüleri için 14+ gün antrenman kaydet'
            : 'Log 14+ days of training to unlock coaching insights'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {CITATION}
        </div>
      </div>
    )
  }

  // ─── All-green state ───────────────────────────────────────────────────────
  // Requires every detector that has data to be in its healthy band. We do NOT
  // require streak.celebrating to suppress the green state because a 7+ day
  // streak should still surface as a positive headline (handled in mixed
  // branch). However, if a celebrating-7d streak is the only signal, falling
  // through to the mixed branch is preferable to showing the generic checkmark.
  const streakCelebratingHeadline =
    streak.reliable && streak.riskBand === 'celebrating' && streak.currentStreak >= 7

  const supercompPositiveHeadline =
    supercomp.reliable &&
    (supercomp.band === 'peak' ||
      supercomp.band === 'opportunity' ||
      supercomp.band === 'building')

  const timeInZoneZ2UnderHeadline =
    timeInZone.reliable &&
    timeInZone.band === 'moderate' &&
    timeInZone.worstZone !== null &&
    timeInZone.worstZone.zone === 'Z2' &&
    timeInZone.worstZone.status === 'under'

  const allGreen =
    density.risk === 'low' &&
    variety.variety === 'good' &&
    stale.summary.stale === 0 &&
    stale.summary.dropped === 0 &&
    fitness.band !== 'spiking' &&
    fitness.band !== 'detraining' &&
    easy.band === 'good' &&
    !(detraining.reliable && detraining.inActiveGap) &&
    !(monotony.reliable && monotony.band === 'high') &&
    !(vo2.reliable && (vo2.band === 'severe' || vo2.band === 'never' || vo2.band === 'critical')) &&
    !(streak.reliable && streak.riskBand === 'risk') &&
    !streakCelebratingHeadline &&
    !(rpeDrift.reliable && rpeDrift.band === 'high') &&
    !(rpeDrift.reliable && rpeDrift.band === 'moderate' && rpeDrift.worstType !== null) &&
    !(recoveryDebt.reliable && (recoveryDebt.band === 'overreached' || recoveryDebt.band === 'fatigued')) &&
    !(timeInZone.reliable && timeInZone.band === 'poor') &&
    !timeInZoneZ2UnderHeadline &&
    !supercompPositiveHeadline &&
    !(polarization.reliable && polarization.pattern === 'threshold') &&
    !(fitnessConsistency.reliable && fitnessConsistency.band === 'chaotic') &&
    !(recoveryAdherence.reliable && recoveryAdherence.band === 'poor') &&
    !(trainingDiversity.reliable && trainingDiversity.band === 'monotypic') &&
    !(deloadCadence.reliable && deloadCadence.band === 'overdue')

  if (allGreen) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={
          isTR ? 'Antrenör içgörüleri — tüm ölçütler sağlıklı' : 'Coaching insights — all healthy'
        }
        style={{ ...S.card, animationDelay: '180ms', borderLeft: '3px solid #5bc25b' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0',
          }}
        >
          <div style={{ ...S.mono, fontSize: '20px', color: '#5bc25b', fontWeight: 700, lineHeight: 1 }}>
            ✓
          </div>
          <div style={{ ...S.mono, fontSize: '12px', color: 'var(--text)', lineHeight: 1.6 }}>
            {isTR ? 'Tüm antrenman ölçütleri sağlıklı' : 'All training metrics healthy'}
          </div>
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '6px' }}>
          {CITATION}
        </div>
      </div>
    )
  }

  // ─── Mixed state — prioritized list of up to 3 insights ────────────────────
  const insights = buildInsights(
    stale, density, variety, fitness, easy,
    detraining, monotony, vo2, streak, rpeDrift, recoveryDebt,
    timeInZone, supercomp, polarization, fitnessConsistency, recoveryAdherence,
    trainingDiversity, deloadCadence,
  )

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={
        isTR ? 'Antrenör içgörüleri — bu haftanın öncelikleri' : 'Coaching insights — this week\'s priorities'
      }
      style={{ ...S.card, animationDelay: '180ms' }}
    >
      <div style={S.cardTitle}>{title}</div>

      <ul
        role="list"
        style={{
          listStyle: 'none', margin: 0, padding: 0,
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}
      >
        {insights.map(row => {
          const bullet = SEVERITY_BULLET[row.severity]
          const sevLbl = SEVERITY_LABEL[row.severity][isTR ? 'tr' : 'en']
          const srcLbl = SOURCE_LABEL[row.source][isTR ? 'tr' : 'en']
          const msg = row.message[isTR ? 'tr' : 'en']
          const rowAria = isTR
            ? `${sevLbl} öncelik, kaynak ${srcLbl}: ${msg}`
            : `${sevLbl} priority, source ${srcLbl}: ${msg}`
          return (
            <li
              key={row.key}
              role="listitem"
              aria-label={rowAria}
              style={{
                ...S.mono,
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                fontSize: '11px', lineHeight: 1.5, color: 'var(--text)',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '11px', lineHeight: 1.5 }}>
                {bullet}
              </span>
              <span style={{
                ...S.mono, fontSize: '9px', fontWeight: 700,
                color: 'var(--muted)', letterSpacing: '0.06em',
                minWidth: '52px', paddingTop: '2px',
              }}>
                {srcLbl}
              </span>
              <span style={{ flex: 1 }}>
                {msg}{' '}
                <span style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)' }}>
                  {isTR ? 'detaylar →' : 'see details →'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '10px' }}>
        {CITATION}
      </div>
    </div>
  )
}

export default memo(CoachingInsightsDigest)
