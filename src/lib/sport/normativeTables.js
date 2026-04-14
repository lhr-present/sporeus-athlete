// ─── sport/normativeTables.js — Static normative reference data ───────────────
// Sources: Coggan (2010), ACSM Guidelines 11th ed., Concept2 rankings, Daniels VDOT

// ── FTP Norms (watts/kg) by sport, gender, category ─────────────────────────
// Source: Coggan 2010 + Ironman AG field data
export const FTP_NORMS = [
  // Cycling — male
  { sport: 'cycling', gender: 'male', category: 'Untrained',   p25: 1.4, p50: 1.9, p75: 2.4 },
  { sport: 'cycling', gender: 'male', category: 'Recreational', p25: 2.0, p50: 2.6, p75: 3.1 },
  { sport: 'cycling', gender: 'male', category: 'Trained',      p25: 2.8, p50: 3.2, p75: 3.8 },
  { sport: 'cycling', gender: 'male', category: 'Well-trained', p25: 3.5, p50: 4.0, p75: 4.5 },
  { sport: 'cycling', gender: 'male', category: 'Expert',       p25: 4.2, p50: 4.7, p75: 5.2 },
  { sport: 'cycling', gender: 'male', category: 'Elite',        p25: 5.0, p50: 5.6, p75: 6.2 },
  // Cycling — female
  { sport: 'cycling', gender: 'female', category: 'Untrained',   p25: 1.1, p50: 1.5, p75: 2.0 },
  { sport: 'cycling', gender: 'female', category: 'Recreational', p25: 1.7, p50: 2.1, p75: 2.6 },
  { sport: 'cycling', gender: 'female', category: 'Trained',      p25: 2.2, p50: 2.7, p75: 3.2 },
  { sport: 'cycling', gender: 'female', category: 'Well-trained', p25: 2.8, p50: 3.3, p75: 3.8 },
  { sport: 'cycling', gender: 'female', category: 'Expert',       p25: 3.4, p50: 3.9, p75: 4.4 },
  { sport: 'cycling', gender: 'female', category: 'Elite',        p25: 4.0, p50: 4.6, p75: 5.1 },
  // Triathlon — male (slightly lower due to bike-run brick demands)
  { sport: 'triathlon', gender: 'male', category: 'Untrained',   p25: 1.3, p50: 1.8, p75: 2.2 },
  { sport: 'triathlon', gender: 'male', category: 'Recreational', p25: 1.9, p50: 2.4, p75: 2.9 },
  { sport: 'triathlon', gender: 'male', category: 'Trained',      p25: 2.5, p50: 3.0, p75: 3.5 },
  { sport: 'triathlon', gender: 'male', category: 'Well-trained', p25: 3.1, p50: 3.6, p75: 4.1 },
  { sport: 'triathlon', gender: 'male', category: 'Expert',       p25: 3.7, p50: 4.2, p75: 4.7 },
  { sport: 'triathlon', gender: 'male', category: 'Elite',        p25: 4.3, p50: 4.9, p75: 5.5 },
  // Triathlon — female
  { sport: 'triathlon', gender: 'female', category: 'Untrained',   p25: 1.0, p50: 1.4, p75: 1.8 },
  { sport: 'triathlon', gender: 'female', category: 'Recreational', p25: 1.5, p50: 1.9, p75: 2.4 },
  { sport: 'triathlon', gender: 'female', category: 'Trained',      p25: 2.0, p50: 2.5, p75: 3.0 },
  { sport: 'triathlon', gender: 'female', category: 'Well-trained', p25: 2.5, p50: 3.0, p75: 3.5 },
  { sport: 'triathlon', gender: 'female', category: 'Expert',       p25: 3.0, p50: 3.5, p75: 4.0 },
  { sport: 'triathlon', gender: 'female', category: 'Elite',        p25: 3.6, p50: 4.1, p75: 4.6 },
]

const CATEGORY_ORDER = ['Untrained', 'Recreational', 'Trained', 'Well-trained', 'Expert', 'Elite']
// Percentile anchors for each category's p50 — guaranteed monotonic
const CATEGORY_PCT_ANCHORS = [8, 22, 42, 62, 78, 92]

/**
 * @description Returns FTP norm percentile and athlete category for a given W/kg value
 *   by linear interpolation between p50 anchor points across six performance categories.
 * @param {string} sport - 'cycling' | 'triathlon'
 * @param {string} gender - 'male' | 'female'
 * @param {number} ftpPerKg - FTP in watts per kg
 * @returns {{percentile:number, category:string}} Percentile 0–100 and category label
 * @source Coggan (2010) — Training and Racing with a Power Meter normative data
 * @example
 * getFTPNorm('cycling', 'male', 3.2) // => {percentile: ~42, category: 'Trained'}
 */
export function getFTPNorm(sport, gender, ftpPerKg) {
  const rows = FTP_NORMS.filter(r => r.sport === sport && r.gender === gender)
  if (!rows.length || ftpPerKg == null) return { percentile: 0, category: 'Unknown' }

  // Build monotonic anchor list: (value=p50, percentile) for each category
  const anchors = rows.map((r, i) => ({ val: r.p50, pct: CATEGORY_PCT_ANCHORS[i], category: r.category }))

  // Determine category by finding which band the value falls in (use p25 threshold)
  let catIdx = 0
  for (let i = 0; i < rows.length; i++) {
    if (ftpPerKg >= rows[i].p25) catIdx = i
  }
  const category = rows[catIdx].category

  // Clamp and interpolate between anchors
  if (ftpPerKg <= anchors[0].val) {
    const pct = (ftpPerKg / anchors[0].val) * anchors[0].pct
    return { percentile: Math.round(Math.max(0, pct)), category: rows[0].category }
  }
  if (ftpPerKg >= anchors[anchors.length - 1].val) {
    const last = anchors[anchors.length - 1]
    const prev = anchors[anchors.length - 2]
    const extra = (ftpPerKg - last.val) / (last.val - prev.val) * (last.pct - prev.pct) * 0.3
    return { percentile: Math.round(Math.min(100, last.pct + extra)), category }
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    if (ftpPerKg >= anchors[i].val && ftpPerKg < anchors[i + 1].val) {
      const frac = (ftpPerKg - anchors[i].val) / (anchors[i + 1].val - anchors[i].val)
      const pct  = anchors[i].pct + frac * (anchors[i + 1].pct - anchors[i].pct)
      return { percentile: Math.round(Math.max(0, Math.min(100, pct))), category }
    }
  }
  return { percentile: 50, category }
}

// ── VO2max Norms ─────────────────────────────────────────────────────────────
// Source: ACSM Guidelines for Exercise Testing and Prescription, 11th edition
export const VO2MAX_NORMS = [
  // Running — male
  { sport: 'running', gender: 'male', ageGroup: '18-29', poor: 38, fair: 43, good: 48, excellent: 53, superior: 60 },
  { sport: 'running', gender: 'male', ageGroup: '30-39', poor: 35, fair: 40, good: 45, excellent: 50, superior: 57 },
  { sport: 'running', gender: 'male', ageGroup: '40-49', poor: 32, fair: 37, good: 42, excellent: 47, superior: 54 },
  { sport: 'running', gender: 'male', ageGroup: '50-59', poor: 28, fair: 33, good: 38, excellent: 43, superior: 50 },
  { sport: 'running', gender: 'male', ageGroup: '60+',   poor: 24, fair: 29, good: 34, excellent: 39, superior: 45 },
  // Running — female
  { sport: 'running', gender: 'female', ageGroup: '18-29', poor: 32, fair: 37, good: 42, excellent: 47, superior: 53 },
  { sport: 'running', gender: 'female', ageGroup: '30-39', poor: 29, fair: 34, good: 39, excellent: 44, superior: 50 },
  { sport: 'running', gender: 'female', ageGroup: '40-49', poor: 26, fair: 31, good: 36, excellent: 41, superior: 47 },
  { sport: 'running', gender: 'female', ageGroup: '50-59', poor: 23, fair: 28, good: 33, excellent: 38, superior: 43 },
  { sport: 'running', gender: 'female', ageGroup: '60+',   poor: 20, fair: 25, good: 30, excellent: 35, superior: 40 },
  // Cycling — male (slightly lower than running due to mass)
  { sport: 'cycling', gender: 'male', ageGroup: '18-29', poor: 35, fair: 40, good: 46, excellent: 52, superior: 58 },
  { sport: 'cycling', gender: 'male', ageGroup: '30-39', poor: 32, fair: 37, good: 43, excellent: 49, superior: 55 },
  { sport: 'cycling', gender: 'male', ageGroup: '40-49', poor: 29, fair: 34, good: 40, excellent: 46, superior: 52 },
  { sport: 'cycling', gender: 'male', ageGroup: '50-59', poor: 26, fair: 31, good: 37, excellent: 43, superior: 49 },
  { sport: 'cycling', gender: 'male', ageGroup: '60+',   poor: 22, fair: 27, good: 33, excellent: 39, superior: 44 },
  // Cycling — female
  { sport: 'cycling', gender: 'female', ageGroup: '18-29', poor: 28, fair: 33, good: 39, excellent: 44, superior: 50 },
  { sport: 'cycling', gender: 'female', ageGroup: '30-39', poor: 25, fair: 30, good: 36, excellent: 41, superior: 47 },
  { sport: 'cycling', gender: 'female', ageGroup: '40-49', poor: 22, fair: 27, good: 33, excellent: 38, superior: 44 },
  { sport: 'cycling', gender: 'female', ageGroup: '50-59', poor: 19, fair: 24, good: 30, excellent: 35, superior: 40 },
  { sport: 'cycling', gender: 'female', ageGroup: '60+',   poor: 16, fair: 21, good: 26, excellent: 31, superior: 37 },
  // Rowing — male (similar to cycling)
  { sport: 'rowing', gender: 'male', ageGroup: '18-29', poor: 36, fair: 42, good: 48, excellent: 54, superior: 62 },
  { sport: 'rowing', gender: 'male', ageGroup: '30-39', poor: 33, fair: 39, good: 45, excellent: 51, superior: 58 },
  { sport: 'rowing', gender: 'male', ageGroup: '40-49', poor: 30, fair: 36, good: 42, excellent: 48, superior: 54 },
  { sport: 'rowing', gender: 'male', ageGroup: '50-59', poor: 27, fair: 33, good: 39, excellent: 44, superior: 50 },
  { sport: 'rowing', gender: 'male', ageGroup: '60+',   poor: 23, fair: 28, good: 34, excellent: 40, superior: 46 },
  // Rowing — female
  { sport: 'rowing', gender: 'female', ageGroup: '18-29', poor: 30, fair: 36, good: 42, excellent: 47, superior: 54 },
  { sport: 'rowing', gender: 'female', ageGroup: '30-39', poor: 27, fair: 33, good: 39, excellent: 44, superior: 50 },
  { sport: 'rowing', gender: 'female', ageGroup: '40-49', poor: 24, fair: 30, good: 36, excellent: 41, superior: 47 },
  { sport: 'rowing', gender: 'female', ageGroup: '50-59', poor: 21, fair: 27, good: 32, excellent: 37, superior: 43 },
  { sport: 'rowing', gender: 'female', ageGroup: '60+',   poor: 18, fair: 23, good: 28, excellent: 33, superior: 38 },
  // Swimming — male (slightly lower whole-body O2 delivery)
  { sport: 'swimming', gender: 'male', ageGroup: '18-29', poor: 30, fair: 36, good: 42, excellent: 48, superior: 55 },
  { sport: 'swimming', gender: 'male', ageGroup: '30-39', poor: 27, fair: 33, good: 39, excellent: 45, superior: 52 },
  { sport: 'swimming', gender: 'male', ageGroup: '40-49', poor: 24, fair: 30, good: 36, excellent: 42, superior: 48 },
  { sport: 'swimming', gender: 'male', ageGroup: '50-59', poor: 21, fair: 27, good: 33, excellent: 38, superior: 44 },
  { sport: 'swimming', gender: 'male', ageGroup: '60+',   poor: 18, fair: 23, good: 29, excellent: 34, superior: 40 },
  // Swimming — female
  { sport: 'swimming', gender: 'female', ageGroup: '18-29', poor: 25, fair: 30, good: 36, excellent: 41, superior: 47 },
  { sport: 'swimming', gender: 'female', ageGroup: '30-39', poor: 22, fair: 27, good: 33, excellent: 38, superior: 44 },
  { sport: 'swimming', gender: 'female', ageGroup: '40-49', poor: 19, fair: 24, good: 30, excellent: 35, superior: 40 },
  { sport: 'swimming', gender: 'female', ageGroup: '50-59', poor: 16, fair: 21, good: 26, excellent: 31, superior: 37 },
  { sport: 'swimming', gender: 'female', ageGroup: '60+',   poor: 14, fair: 18, good: 23, excellent: 28, superior: 33 },
]

/**
 * @description Returns VO2max percentile and category label for a given sport, age, and gender
 *   by comparing against ACSM fitness classification bands.
 * @param {string} sport - 'running' | 'cycling' | 'rowing' | 'swimming'
 * @param {number} age - Athlete age in years
 * @param {string} gender - 'male' | 'female'
 * @param {number} vo2max - VO2max in mL/kg/min
 * @returns {{percentile:number, category:string}} Percentile 0–100 and classification label
 * @source ACSM Guidelines for Exercise Testing and Prescription, 11th edition
 * @example
 * getVO2maxNorm('running', 30, 'male', 52) // => {percentile: ~75, category: 'Excellent'}
 */
export function getVO2maxNorm(sport, age, gender, vo2max) {
  const ageGroup = age < 30 ? '18-29' : age < 40 ? '30-39' : age < 50 ? '40-49' : age < 60 ? '50-59' : '60+'
  const row = VO2MAX_NORMS.find(r => r.sport === sport && r.gender === gender && r.ageGroup === ageGroup)
  if (!row || vo2max == null) return { percentile: 0, category: 'Unknown' }

  const bands = [
    { max: row.poor,      label: 'Poor',      pct: 10 },
    { max: row.fair,      label: 'Fair',       pct: 25 },
    { max: row.good,      label: 'Good',       pct: 50 },
    { max: row.excellent, label: 'Excellent',  pct: 75 },
    { max: row.superior,  label: 'Superior',   pct: 90 },
  ]

  let prev = 0
  for (const band of bands) {
    if (vo2max <= band.max) {
      const prevPct = bands[bands.indexOf(band) - 1]?.pct ?? 0
      const frac = (vo2max - prev) / (band.max - prev)
      const pct  = prevPct + frac * (band.pct - prevPct)
      return { percentile: Math.round(Math.max(0, Math.min(100, pct))), category: band.label }
    }
    prev = band.max
  }
  // Above superior
  const excess = vo2max - row.superior
  const pct = 90 + Math.min(10, excess / (row.superior - row.excellent) * 5)
  return { percentile: Math.round(Math.min(100, pct)), category: 'Superior' }
}

// ── CTL Norms ────────────────────────────────────────────────────────────────
// Typical and peak CTL ranges by sport + competitive level
export const CTL_NORMS = [
  { sport: 'cycling',   level: 'recreational', typical_ctl_range: [20, 45],  peak_ctl_range: [40,  65]  },
  { sport: 'cycling',   level: 'amateur',      typical_ctl_range: [50, 80],  peak_ctl_range: [75,  100] },
  { sport: 'cycling',   level: 'masters',      typical_ctl_range: [55, 85],  peak_ctl_range: [80,  105] },
  { sport: 'cycling',   level: 'elite',        typical_ctl_range: [100, 140], peak_ctl_range: [130, 160] },
  { sport: 'running',   level: 'recreational', typical_ctl_range: [20, 40],  peak_ctl_range: [35,  60]  },
  { sport: 'running',   level: 'amateur',      typical_ctl_range: [40, 65],  peak_ctl_range: [60,  85]  },
  { sport: 'running',   level: 'masters',      typical_ctl_range: [45, 70],  peak_ctl_range: [65,  90]  },
  { sport: 'running',   level: 'elite',        typical_ctl_range: [80, 120], peak_ctl_range: [110, 145] },
  { sport: 'triathlon', level: 'recreational', typical_ctl_range: [25, 50],  peak_ctl_range: [45,  70]  },
  { sport: 'triathlon', level: 'amateur',      typical_ctl_range: [55, 90],  peak_ctl_range: [80,  115] },
  { sport: 'triathlon', level: 'masters',      typical_ctl_range: [55, 85],  peak_ctl_range: [80,  110] },
  { sport: 'triathlon', level: 'elite',        typical_ctl_range: [100, 140], peak_ctl_range: [130, 165] },
  { sport: 'rowing',    level: 'recreational', typical_ctl_range: [25, 50],  peak_ctl_range: [45,  70]  },
  { sport: 'rowing',    level: 'amateur',      typical_ctl_range: [50, 75],  peak_ctl_range: [70,  95]  },
  { sport: 'rowing',    level: 'masters',      typical_ctl_range: [45, 70],  peak_ctl_range: [65,  100] },
  { sport: 'rowing',    level: 'elite',        typical_ctl_range: [90, 130], peak_ctl_range: [120, 155] },
  { sport: 'swimming',  level: 'recreational', typical_ctl_range: [15, 35],  peak_ctl_range: [30,  55]  },
  { sport: 'swimming',  level: 'amateur',      typical_ctl_range: [35, 60],  peak_ctl_range: [55,  80]  },
  { sport: 'swimming',  level: 'masters',      typical_ctl_range: [35, 65],  peak_ctl_range: [60,  85]  },
  { sport: 'swimming',  level: 'elite',        typical_ctl_range: [70, 110], peak_ctl_range: [100, 140] },
]

/**
 * @description Returns CTL status (Very Low / Building / Typical / High / Very High)
 *   relative to typical and peak ranges for a given sport and competitive level.
 * @param {string} sport - 'cycling' | 'running' | 'triathlon' | 'rowing' | 'swimming'
 * @param {string} level - 'recreational' | 'amateur' | 'masters' | 'elite'
 * @param {number} currentCTL - Athlete's current CTL value
 * @returns {{status:string, typical:[number,number], peak:[number,number], percentileOfTypical:number}}
 * @source Banister & Calvert (1980) — Modeling elite athletic performance; Coggan (2010) normative CTL ranges
 * @example
 * getCTLNorm('cycling', 'amateur', 65) // => {status:'Typical', typical:[50,80], peak:[75,100], percentileOfTypical:50}
 */
export function getCTLNorm(sport, level, currentCTL) {
  const norm = CTL_NORMS.find(r => r.sport === sport && r.level === level)
  if (!norm || currentCTL == null) return { status: 'Unknown', typical: [0, 0], peak: [0, 0], percentileOfTypical: 0 }

  const [tLo, tHi] = norm.typical_ctl_range
  const [pLo, pHi] = norm.peak_ctl_range

  let status
  if (currentCTL < tLo * 0.5)     status = 'Very Low'
  else if (currentCTL < tLo)      status = 'Building'
  else if (currentCTL <= tHi)     status = 'Typical'
  else if (currentCTL <= pHi)     status = 'High'
  else                             status = 'Very High'

  // Percentile within typical range (0=at lower bound, 100=at upper bound)
  const pctOfTypical = Math.round(Math.max(0, Math.min(100, (currentCTL - tLo) / (tHi - tLo) * 100)))

  return { status, typical: norm.typical_ctl_range, peak: norm.peak_ctl_range, percentileOfTypical: pctOfTypical }
}

// ── 2000m Rowing Erg Norms ────────────────────────────────────────────────────
// Source: Concept2 World Rankings (public data)
export const ROW_2000M_NORMS = [
  // Heavyweight male
  { ageGroup: '18-29', weightCategory: 'heavyweight', gender: 'male',   times: { elite: '5:40', national: '6:00', club: '6:30', recreational: '7:15' }},
  { ageGroup: '30-39', weightCategory: 'heavyweight', gender: 'male',   times: { elite: '5:50', national: '6:15', club: '6:45', recreational: '7:30' }},
  { ageGroup: '40-49', weightCategory: 'heavyweight', gender: 'male',   times: { elite: '6:05', national: '6:30', club: '7:00', recreational: '7:45' }},
  { ageGroup: '50-59', weightCategory: 'heavyweight', gender: 'male',   times: { elite: '6:20', national: '6:50', club: '7:20', recreational: '8:10' }},
  { ageGroup: '60+',   weightCategory: 'heavyweight', gender: 'male',   times: { elite: '6:50', national: '7:20', club: '8:00', recreational: '8:50' }},
  // Lightweight male
  { ageGroup: '18-29', weightCategory: 'lightweight', gender: 'male',   times: { elite: '5:55', national: '6:15', club: '6:45', recreational: '7:30' }},
  { ageGroup: '30-39', weightCategory: 'lightweight', gender: 'male',   times: { elite: '6:05', national: '6:30', club: '7:00', recreational: '7:45' }},
  { ageGroup: '40-49', weightCategory: 'lightweight', gender: 'male',   times: { elite: '6:20', national: '6:45', club: '7:15', recreational: '8:05' }},
  { ageGroup: '50-59', weightCategory: 'lightweight', gender: 'male',   times: { elite: '6:40', national: '7:10', club: '7:40', recreational: '8:30' }},
  { ageGroup: '60+',   weightCategory: 'lightweight', gender: 'male',   times: { elite: '7:10', national: '7:45', club: '8:20', recreational: '9:10' }},
  // Heavyweight female
  { ageGroup: '18-29', weightCategory: 'heavyweight', gender: 'female', times: { elite: '6:30', national: '7:00', club: '7:30', recreational: '8:20' }},
  { ageGroup: '30-39', weightCategory: 'heavyweight', gender: 'female', times: { elite: '6:45', national: '7:15', club: '7:50', recreational: '8:40' }},
  { ageGroup: '40-49', weightCategory: 'heavyweight', gender: 'female', times: { elite: '7:00', national: '7:30', club: '8:05', recreational: '9:00' }},
  { ageGroup: '50-59', weightCategory: 'heavyweight', gender: 'female', times: { elite: '7:20', national: '7:55', club: '8:30', recreational: '9:20' }},
  { ageGroup: '60+',   weightCategory: 'heavyweight', gender: 'female', times: { elite: '7:50', national: '8:30', club: '9:10', recreational: '10:00'}},
  // Lightweight female
  { ageGroup: '18-29', weightCategory: 'lightweight', gender: 'female', times: { elite: '6:45', national: '7:15', club: '7:50', recreational: '8:40' }},
  { ageGroup: '30-39', weightCategory: 'lightweight', gender: 'female', times: { elite: '7:00', national: '7:30', club: '8:05', recreational: '9:00' }},
  { ageGroup: '40-49', weightCategory: 'lightweight', gender: 'female', times: { elite: '7:15', national: '7:50', club: '8:25', recreational: '9:20' }},
  { ageGroup: '50-59', weightCategory: 'lightweight', gender: 'female', times: { elite: '7:40', national: '8:15', club: '8:55', recreational: '9:50' }},
  { ageGroup: '60+',   weightCategory: 'lightweight', gender: 'female', times: { elite: '8:10', national: '8:50', club: '9:30', recreational: '10:20'}},
]

// ── Running VDOT Percentiles by age/gender ────────────────────────────────────
// Source: Daniels Running Formula + age-graded world records
export const RUNNING_VDOT_NORMS = [
  { ageGroup: '18-29', gender: 'male',   vdot: { p25: 39, p50: 47, p75: 56, p90: 65 } },
  { ageGroup: '30-39', gender: 'male',   vdot: { p25: 37, p50: 45, p75: 53, p90: 62 } },
  { ageGroup: '40-49', gender: 'male',   vdot: { p25: 34, p50: 41, p75: 50, p90: 58 } },
  { ageGroup: '50-59', gender: 'male',   vdot: { p25: 30, p50: 37, p75: 45, p90: 53 } },
  { ageGroup: '60+',   gender: 'male',   vdot: { p25: 26, p50: 33, p75: 40, p90: 47 } },
  { ageGroup: '18-29', gender: 'female', vdot: { p25: 33, p50: 40, p75: 49, p90: 58 } },
  { ageGroup: '30-39', gender: 'female', vdot: { p25: 31, p50: 38, p75: 47, p90: 55 } },
  { ageGroup: '40-49', gender: 'female', vdot: { p25: 28, p50: 35, p75: 43, p90: 51 } },
  { ageGroup: '50-59', gender: 'female', vdot: { p25: 25, p50: 31, p75: 39, p90: 46 } },
  { ageGroup: '60+',   gender: 'female', vdot: { p25: 21, p50: 27, p75: 34, p90: 41 } },
]
