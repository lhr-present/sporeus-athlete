// src/lib/athlete/eliteProgramDrillStrengthSubs.js
//
// v9.167.0 (EP-7) — Substitution map for drills + strength movements.
//
// The canonical drill library (eliteProgramDrills.js) and strength library
// (eliteProgramStrength.js) specify gold-standard prescriptions assuming
// track / hill / pool / road / barbell-gym access. Travel, home gyms,
// hotel rooms, and injury weeks need alternatives that PRESERVE the
// training intent without the equipment.
//
// Existing `eliteProgramSubstitutions.js` already handles session-intent
// substitutions (Easy/Tempo/Threshold/VO2/Long for each sport). This
// module adds the missing layer: drill-by-drill and strength-movement-by-
// strength-movement fallbacks.
//
// Constraint axes (per drill / per movement):
//   noEquipment — pure body-weight / hotel-room fallback.
//   noFacility  — no track / pool / road / quiet loop / wide pool lane.
//   injured     — joint-protective alternative preserving the pattern.
//
// Strength movements are looked up by PATTERN (squat / hinge / single-leg
// / vertical-pull / horizontal-pull / push / plyo), not by exact name —
// the canonical library has ~50 movements but they collapse to ~7
// patterns. New movements get substitutes for free as long as their name
// matches the pattern regex.
//
// Bilingual EN+TR. Pure data + pure helpers.
//
// Citations:
//   Suchomel et al. 2018. The Importance of Muscular Strength: Training
//     Considerations. Sports Med 48(4):765-785. (movement-pattern taxonomy)
//   Schoenfeld 2010. The Mechanisms of Muscle Hypertrophy. JSCR 24(10).
//   Mujika 2010. Intense training: the key to optimal performance.
//   Verstegen 2014. Every Day is Game Day. (travel + bodyweight fallbacks)

import { buildDrillsLibrary } from './eliteProgramDrills.js'
import { buildStrengthProgram } from './eliteProgramStrength.js'

export const DRILL_STRENGTH_SUBS_CITATION = 'Suchomel 2018; Schoenfeld 2010; Mujika 2010; Verstegen 2014'

// ── Drill substitutes — keyed by drill.key ───────────────────────────────────

const DRILL_SUBS = {
  // RUN
  'run-drill-a-skip': {
    noEquipment: { en: 'High-knee march in place 4x30s, focus quick foot strikes.', tr: '4x30s yerinde yüksek-diz yürüyüş, hızlı ayak temasına odak.' },
    noFacility:  { en: 'Treadmill 1% incline: 4x30s of A-skips at walk pace 5-6 kph.', tr: 'Koşubandı %1 eğim: 4x30s A-skip, 5-6 km/sa yürüyüş hızında.' },
    injured:     { en: 'Standing knee-drives (no bounce) 4x20 each leg.', tr: 'Ayakta diz-itim (sıçramasız) 4x20 her bacak.' },
  },
  'run-drill-b-skip': {
    noEquipment: { en: 'Standing leg-sweep 4x10 each side, slow controlled.', tr: 'Ayakta bacak-süpürme 4x10 her taraf, yavaş kontrollü.' },
    noFacility:  { en: 'Treadmill at 4-5 kph: 4x20s of B-skips while holding rail.', tr: 'Koşubandı 4-5 km/sa: tutamağa tutunarak 4x20s B-skip.' },
    injured:     { en: 'Seated hamstring active-stretch 4x10 each leg.', tr: 'Oturarak aktif hamstring esnetme 4x10 her bacak.' },
  },
  'run-drill-strides': {
    noEquipment: { en: 'On any flat surface ≥50m: 4x50m strides at perceived R-effort.', tr: 'Herhangi düz 50m+ yüzeyde: algılanan R-eforda 4x50m adımlar.' },
    noFacility:  { en: 'Treadmill: 6x20s at 1 kph above your I-pace, 60s easy between.', tr: 'Koşubandı: I-temponun 1 km/sa üstünde 6x20s, arada 60s kolay.' },
    injured:     { en: 'Skip — strides require pain-free running.', tr: 'Atla — adımlar ağrısız koşu gerektirir.' },
  },
  'run-drill-hill-bounding': {
    noEquipment: { en: 'Step-ups on a sturdy 30-50 cm box: 4x10 each leg, explosive.', tr: 'Sağlam 30-50 cm kutuda step-up: 4x10 her bacak, patlayıcı.' },
    noFacility:  { en: 'Treadmill at 7-10% incline: 4x30s bounding strides, walk-down between.', tr: 'Koşubandı %7-10 eğim: 4x30s sıçrama adımı, arada yürüyerek dön.' },
    injured:     { en: 'Skip plyometric load; do isometric calf raises 3x10 instead.', tr: 'Plyometrik yükü atla; bunun yerine izometrik buzağı kaldırma 3x10.' },
  },
  'run-drill-cadence': {
    noEquipment: { en: 'Metronome app at 180 bpm: walk 5 min matching cadence.', tr: 'Metronom 180 bpm: kadansa uyarak 5 dk yürü.' },
    noFacility:  { en: 'Treadmill: 4x60s at your E-pace, count steps for 30s × 2.', tr: 'Koşubandı: E-tempoda 4x60s, 30s adım say × 2.' },
    injured:     { en: 'Seated: tap feet to metronome at 180 bpm for 4x60s.', tr: 'Oturarak: 180 bpm metronoma ayak vuruşu 4x60s.' },
  },

  // BIKE
  'bike-drill-single-leg': {
    noEquipment: { en: 'Hip-flexor activation: standing knee-raise 4x60s each leg.', tr: 'Kalça fleksör aktivasyonu: ayakta diz-kaldırma 4x60s her bacak.' },
    noFacility:  { en: 'Spin bike or stationary trainer: same drill.', tr: 'Spin bisiklet veya sabit trainer: aynı dril.' },
    injured:     { en: 'Skip — single-leg drill aggravates knee tracking issues.', tr: 'Atla — tek-bacak drili diz takip sorunlarını arttırır.' },
  },
  'bike-drill-cadence-ladder': {
    noEquipment: { en: 'Skip — cadence ladder requires bike + power/cadence meter.', tr: 'Atla — kadans merdiveni bisiklet + güç/kadans sensörü gerektirir.' },
    noFacility:  { en: 'Indoor trainer: same prescription at Z2 effort by feel.', tr: 'Kapalı trainer: aynı reçete hissel Z2 eforda.' },
    injured:     { en: 'Low-impact: keep cadence at 90 rpm, skip 105+ rpm reps.', tr: 'Düşük-etki: kadansı 90 rpm tut, 105+ rpm tekrarları atla.' },
  },
  'bike-drill-standing-sprints': {
    noEquipment: { en: 'Bodyweight: 6x10s squat jumps with full recovery.', tr: 'Vücut ağırlığı: 6x10s squat sıçrama, tam dinlenme.' },
    noFacility:  { en: 'Indoor trainer at low resistance: same 6x10s standing.', tr: 'Düşük dirençli kapalı trainer: aynı 6x10s ayakta.' },
    injured:     { en: 'Skip — sprints contraindicated with knee/back flare.', tr: 'Atla — diz/sırt alevinde sprint kontrendike.' },
  },
  'bike-drill-cornering': {
    noEquipment: { en: 'Visualization: walk through cornering line on paper or virtual loop.', tr: 'Görselleştirme: kağıt veya sanal parkurda viraj çizgisini yürü.' },
    noFacility:  { en: 'On an indoor trainer: practice body position for left/right turns.', tr: 'Kapalı trainer: sol/sağ dönüş için vücut pozisyonunu prova et.' },
    injured:     { en: 'Skip; cornering practice requires full body control.', tr: 'Atla; viraj pratiği tam vücut kontrolü gerektirir.' },
  },

  // SWIM
  'swim-drill-catch-up': {
    noEquipment: { en: 'Dryland: standing freestyle arm strokes with tubing 4x50 reps.', tr: 'Kara: ayakta serbest kol çekişleri lastikle 4x50 tekrar.' },
    noFacility:  { en: 'In a 12m+ pool: 8x25m catch-up. Shorten reps to match space.', tr: '12m+ havuz: 8x25m yakalama. Tekrarları alana göre kısalt.' },
    injured:     { en: 'Shoulder injury: replace with kickboard 4x50m flutter.', tr: 'Omuz sakatlığı: 4x50m tahtalı tekme ile değiştir.' },
  },
  'swim-drill-fingertip-drag': {
    noEquipment: { en: 'Dryland: standing high-elbow arm sweep 4x20 each arm.', tr: 'Kara: ayakta yüksek-dirsek kol süpürme 4x20 her kol.' },
    noFacility:  { en: 'In any pool: shorten to 8x25m if 50m not available.', tr: 'Herhangi havuz: 50m yoksa 8x25m\'e kısalt.' },
    injured:     { en: 'Skip — drill aggravates rotator cuff impingement.', tr: 'Atla — dril rotator cuff sıkışmasını arttırır.' },
  },
  'swim-drill-side-kick': {
    noEquipment: { en: 'On the floor: side-lying leg lifts 4x20 each side.', tr: 'Yerde: yan yatış bacak kaldırma 4x20 her taraf.' },
    noFacility:  { en: 'Any pool: shorten to 4x25m if a 50m lane is unavailable.', tr: 'Herhangi havuz: 50m kulvar yoksa 4x25m\'e kısalt.' },
    injured:     { en: 'Replace with standing single-leg balance 4x30s each leg.', tr: 'Ayakta tek-bacak denge 4x30s her bacak ile değiştir.' },
  },
  'swim-drill-stroke-count': {
    noEquipment: { en: 'Dryland: count tubing-stroke reps; goal same count per 60s.', tr: 'Kara: lastik-çekiş tekrarlarını say; 60s\'de aynı sayıyı hedefle.' },
    noFacility:  { en: 'Shorter pool: count strokes per 12.5m or 15m equivalent.', tr: 'Daha kısa havuz: 12.5m veya 15m karşılığı çekişleri say.' },
    injured:     { en: 'Pull-only with paddles, leg float; same stroke count goal.', tr: 'Sadece palet ile çekiş, bacak şamandırası; aynı vuruş hedefi.' },
  },
  'swim-drill-sculling': {
    noEquipment: { en: 'Dryland: standing hand-sculling motion with light dumbbells.', tr: 'Kara: ayakta hafif dumbel ile el-kürek hareketi.' },
    noFacility:  { en: 'Any pool: shorten reps to 8x25m sculling.', tr: 'Herhangi havuz: 8x25m kürek-eli ile kısalt.' },
    injured:     { en: 'Replace with seated wrist mobility 4x15 each direction.', tr: 'Oturarak bilek esnekliği 4x15 her yön ile değiştir.' },
  },

  // ROWING
  'row-drill-pause': {
    noEquipment: { en: 'Hip-hinge practice: 4x10 standing dowel rod hinges with pause.', tr: 'Kalça-katlama pratik: 4x10 ayakta sopa ile duraksamalı katlama.' },
    noFacility:  { en: 'On erg only: identical prescription works.', tr: 'Sadece erg: aynı reçete geçerli.' },
    injured:     { en: 'Lower-back tweak: shorten to 4x250m at UT2 with no pause.', tr: 'Bel ağrısı: 4x250m UT2\'ye duraksamasız kısalt.' },
  },
  'row-drill-square-blade': {
    noEquipment: { en: 'Dryland: 4x60s seated row with tubing, slow controlled finish.', tr: 'Kara: 4x60s oturarak lastikle kürek, yavaş kontrollü bitiş.' },
    noFacility:  { en: 'On erg: identical drill (no feathering possible on erg).', tr: 'Erg: aynı dril (ergde tüyleme mümkün değil).' },
    injured:     { en: 'Wrist/forearm pain: skip; aggravates extensor tendons.', tr: 'Bilek/önkol ağrısı: atla; ekstensör tendonları arttırır.' },
  },
  'row-drill-stroke-rate-ladder': {
    noEquipment: { en: 'Cardio swap: 5x2 min run at progressively faster pace.', tr: 'Kardiyo değişimi: 5x2 dk koşu kademeli artan tempoda.' },
    noFacility:  { en: 'Erg only: same ladder.', tr: 'Sadece erg: aynı merdiven.' },
    injured:     { en: 'Cap top end at 28 spm; back off if low-back fatigue rises.', tr: 'Üst sınırı 28 spm\'de tut; bel yorgunluğu artarsa azalt.' },
  },
  'row-drill-power-ten': {
    noEquipment: { en: 'Bodyweight: every 4 min in any cardio session, do 10 explosive squat-jumps.', tr: 'Vücut ağırlığı: herhangi kardiyo seansda her 4 dk 10 patlayıcı squat-sıçrama.' },
    noFacility:  { en: 'Erg: identical drill applies.', tr: 'Erg: aynı dril.' },
    injured:     { en: 'Cap power-strokes at 5 instead of 10; protect lumbar.', tr: 'Güç vuruşlarını 10 yerine 5\'te tut; bel koru.' },
  },

  // TRIATHLON (brick drills — already cross-discipline, mostly facility-dependent)
  'tri-drill-brick-transition': {
    noEquipment: { en: 'Indoor: 30 min trainer → 5 min treadmill at MP. Same intent.', tr: 'Kapalı: 30 dk trainer → 5 dk koşubandı MP. Aynı niyet.' },
    noFacility:  { en: 'Indoor trainer + treadmill: identical drill.', tr: 'Kapalı trainer + koşubandı: aynı dril.' },
    injured:     { en: 'Replace with 30 min trainer + 5 min stationary bike spin-out (no run-off).', tr: '30 dk trainer + 5 dk sabit bisiklet açılış ile değiştir (koşusuz).' },
  },
  'tri-drill-swim-to-bike': {
    noEquipment: { en: 'Dryland T1 rehearsal: practice helmet + shoes + bike-mount routine without water entry.', tr: 'Kara T1 prova: kask + ayakkabı + bisiklet binme rutini, suya girmeden.' },
    noFacility:  { en: 'Shorter pool: 200m swim → run to indoor trainer → mount + 5 min ride.', tr: 'Kısa havuz: 200m yüzme → kapalı trainera koş → bin + 5 dk sür.' },
    injured:     { en: 'Skip — T1 rehearsal needs full ROM.', tr: 'Atla — T1 prova tam ROM gerektirir.' },
  },
}

// ── Strength substitutes — keyed by movement PATTERN ─────────────────────────

const STRENGTH_PATTERN_SUBS = {
  squat: {
    noEquipment: { en: 'Bulgarian split squat 3x10 each leg (rear foot on chair).', tr: 'Bulgar split squat 3x10 her bacak (arka ayak sandalyede).' },
    noGym:       { en: 'Goblet squat with backpack or kettlebell 4x8.', tr: 'Sırt çantası veya kettlebell ile goblet squat 4x8.' },
    injured:     { en: 'Wall-sit isometric 3x45s; or box squat to chair if knee-pain free.', tr: 'Duvar-otur izometrik 3x45s; ağrısızsa kutu squat.' },
  },
  hinge: {
    noEquipment: { en: 'Single-leg Romanian deadlift 3x8 each side (bodyweight or backpack).', tr: 'Tek-bacak Romen ölü kaldırma 3x8 her taraf (vücut ağırlığı veya çanta).' },
    noGym:       { en: 'Kettlebell or backpack RDL 4x8; or kettlebell swing 3x15.', tr: 'Kettlebell veya çanta RDL 4x8; veya kettlebell sallama 3x15.' },
    injured:     { en: 'Glute bridge 3x12 (or banded hip-thrust if no back load tolerated).', tr: 'Glute köprü 3x12 (sırt yükü tolere edilmiyorsa bandlı kalça-itim).' },
  },
  singleLeg: {
    noEquipment: { en: 'Reverse lunges 3x10 each leg; pistol squat progression if advanced.', tr: 'Ters hamleler 3x10 her bacak; ileri seviye için pistol squat ilerletme.' },
    noGym:       { en: 'Step-ups on sturdy box 3x10 each leg with backpack.', tr: 'Çantayla sağlam kutuda step-up 3x10 her bacak.' },
    injured:     { en: 'Banded clamshell + side-lying leg lift 3x15 each.', tr: 'Bandlı clamshell + yan-yatış bacak kaldırma 3x15 her taraf.' },
  },
  verticalPull: {
    noEquipment: { en: 'Doorway towel-row (inverted angle) 3x8-10, body angle as resistance.', tr: 'Kapı kasası havlu-kürek (ters açı) 3x8-10, vücut açısı direnç.' },
    noGym:       { en: 'Resistance-band lat pulldown 3x12 (anchor band overhead).', tr: 'Lastik band lat pulldown 3x12 (band yukarıdan sabit).' },
    injured:     { en: 'Scap retraction Y-T-W 3x10 prone if no overhead loading.', tr: 'Yukarı yükleme yoksa yüzükoyun skap retraction Y-T-W 3x10.' },
  },
  horizontalPull: {
    noEquipment: { en: 'Inverted row under sturdy table 3x10; or doorway band-row 3x12.', tr: 'Sağlam masa altı ters kürek 3x10; veya kapı bandı-kürek 3x12.' },
    noGym:       { en: 'Resistance-band seated row 3x12 (anchor low).', tr: 'Lastik bandla oturarak kürek 3x12 (alttan sabit).' },
    injured:     { en: 'Prone scap retraction with light dumbbell 3x10.', tr: 'Hafif dumbel ile yüzükoyun skap retraction 3x10.' },
  },
  push: {
    noEquipment: { en: 'Push-up progression 3x8-12 (incline → flat → decline as strength builds).', tr: 'Şınav ilerletme 3x8-12 (eğimli → düz → tersine güç arttıkça).' },
    noGym:       { en: 'Backpack overhead press 4x8; or band push-press 3x10.', tr: 'Çantayla üst-baş press 4x8; veya bandlı push-press 3x10.' },
    injured:     { en: 'Wall push-up 3x12; or scap push-up if shoulder flare.', tr: 'Duvar şınav 3x12; omuz alevi varsa skap şınav.' },
  },
  plyo: {
    noEquipment: { en: 'Squat jumps 3x6 + broad jumps 3x5 (any flat surface).', tr: 'Squat sıçrama 3x6 + uzun atlama 3x5 (herhangi düz yüzey).' },
    noGym:       { en: 'Skip box jumps; substitute pogo hops 3x20 + tuck jumps 3x6.', tr: 'Kutu atlamayı atla; pogo sıçrama 3x20 + tuck sıçrama 3x6 ile değiştir.' },
    injured:     { en: 'Cut all plyometric load. Banded glute bridge 3x15 instead.', tr: 'Tüm plyometrik yükü kes. Bandlı glute köprü 3x15 yerine.' },
  },
}

// Pattern detection — case-insensitive regex over movement name.
const PATTERN_RULES = [
  { pattern: 'plyo',           re: /\b(jumps?|hops?|bounds?|bounding|plyo|broad|throws?|pogo|tuck|slams?|med[\s-]?ball)\b/i },
  { pattern: 'hinge',          re: /\b(deadlifts?|rdl|romanian|hinge|swings?|good[\s-]?morning)\b/i },
  { pattern: 'singleLeg',      re: /\b(single[\s-]?leg|split[\s-]?squat|lunges?|step[\s-]?ups?|pistol)\b/i },
  { pattern: 'squat',          re: /\bsquats?\b/i },
  { pattern: 'verticalPull',   re: /\b(pull[\s-]?ups?|chin[\s-]?ups?|lat[\s-]?pull|pulldown)\b/i },
  { pattern: 'horizontalPull', re: /\brows?\b/i },
  { pattern: 'push',           re: /\b(press|push[\s-]?ups?|bench|push[\s-]?press|overhead)\b/i },
]

/**
 * Classify a strength movement by name into a pattern bucket.
 * @param {string} name
 * @returns {'squat'|'hinge'|'singleLeg'|'verticalPull'|'horizontalPull'|'push'|'plyo'|null}
 */
export function classifyStrengthMovement(name) {
  if (!name || typeof name !== 'string') return null
  for (const rule of PATTERN_RULES) {
    if (rule.re.test(name)) return rule.pattern
  }
  return null
}

const VALID_CONSTRAINTS = new Set(['noEquipment', 'noFacility', 'injured', 'noGym'])

/**
 * Look up a substitute for a drill key under a constraint.
 * @param {string} drillKey
 * @param {'noEquipment'|'noFacility'|'injured'} constraint
 * @returns {{ en: string, tr: string } | null}
 */
export function getDrillSubstitute(drillKey, constraint) {
  if (!drillKey || !VALID_CONSTRAINTS.has(constraint)) return null
  const entry = DRILL_SUBS[drillKey]
  if (!entry) return null
  return entry[constraint] || null
}

/**
 * Look up a substitute for a strength movement under a constraint.
 * Classifies by name first; returns null for prehab/core movements that
 * are already low-equipment by design.
 * @param {string} movementName
 * @param {'noEquipment'|'noGym'|'injured'} constraint
 * @returns {{ en: string, tr: string, pattern: string } | null}
 */
export function getStrengthSubstitute(movementName, constraint) {
  if (!movementName || !VALID_CONSTRAINTS.has(constraint)) return null
  const pattern = classifyStrengthMovement(movementName)
  if (!pattern) return null
  const subs = STRENGTH_PATTERN_SUBS[pattern]
  if (!subs) return null
  const sub = subs[constraint]
  if (!sub) return null
  return { ...sub, pattern }
}

/**
 * Resolve substitutes for every drill + main strength movement in a built
 * elite program. Returns a per-phase map.
 *
 * @param {{ sport: string, phases: Array<{phase:string}> }} input
 * @returns {{
 *   drills:   Record<string, Array<{ key:string, name: object, subs: { noEquipment: object|null, noFacility: object|null, injured: object|null } }>>,
 *   strength: Record<string, Array<{ name: object, pattern: string|null, subs: { noEquipment: object|null, noGym: object|null, injured: object|null } }>>,
 * }}
 */
export function buildDrillStrengthSubstitutionMap(input) {
  const sport = input?.sport
  const phases = input?.phases || []
  const drillsLib = buildDrillsLibrary({ sport, phases })
  const strengthLib = buildStrengthProgram({ phases, sport })

  const drills = {}
  for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
    const list = drillsLib[phase] || []
    drills[phase] = list.map(d => ({
      key: d.key,
      name: d.name,
      subs: {
        noEquipment: getDrillSubstitute(d.key, 'noEquipment'),
        noFacility:  getDrillSubstitute(d.key, 'noFacility'),
        injured:     getDrillSubstitute(d.key, 'injured'),
      },
    }))
  }

  const strength = {}
  for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
    const plan = strengthLib[phase]
    if (!plan) { strength[phase] = []; continue }
    // Substitute main movements only (prehab + core already body-weight friendly).
    const movements = plan.movements || []
    strength[phase] = movements.map(m => {
      const enName = m?.name?.en || ''
      return {
        name: m.name,
        pattern: classifyStrengthMovement(enName),
        subs: {
          noEquipment: getStrengthSubstitute(enName, 'noEquipment'),
          noGym:       getStrengthSubstitute(enName, 'noGym'),
          injured:     getStrengthSubstitute(enName, 'injured'),
        },
      }
    })
  }

  return { drills, strength }
}
