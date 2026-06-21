// ─── Constants (no React imports) ────────────────────────────────────────────

export const ZONE_COLORS = ['#4a90d9','#5bc25b','#f5c542','#f08c00','#e03030']
export const ZONE_NAMES  = ['Z1 Recovery','Z2 Aerobic','Z3 Tempo','Z4 Threshold','Z5 VO\u2082max']

export const SESSION_TYPES_BY_DISCIPLINE = {
  'Running':    ['Easy Run','Tempo Run','Interval Run','Long Run','Trail Run','Run Race','Run Test'],
  'Cycling':    ['Easy Ride','Tempo Ride','Power Intervals','Long Ride','Bike Race','FTP Test'],
  'Swimming':   ['Easy Swim','Threshold Swim','Interval Swim','Open Water Swim','CSS Test'],
  'Multi-Sport':['Brick (Bike+Run)','Brick (Swim+Bike)','Triathlon Race','Hyrox','OCR Race'],
  'General':    ['Strength','Mobility','Yoga','Recovery','Race','Test'],
}
export const SESSION_TYPES = Object.values(SESSION_TYPES_BY_DISCIPLINE).flat()

export const SPORT_BRANCHES = [
  { id:'running',   label:'Running',        icon:'↑' },
  { id:'cycling',   label:'Cycling',        icon:'○' },
  { id:'swimming',  label:'Swimming',       icon:'~' },
  { id:'triathlon', label:'Triathlon',      icon:'⚡' },
  { id:'trail',     label:'Trail Running',  icon:'△' },
  { id:'hyrox',     label:'Hyrox',          icon:'⊞' },
  { id:'ocr',       label:'OCR / Obstacle', icon:'◇' },
  { id:'rowing',    label:'Rowing',         icon:'≈' },
  { id:'nordic',    label:'Nordic Skiing',  icon:'☆' },
  { id:'hybrid',    label:'Hybrid / Multi', icon:'⊕' },
  { id:'other',     label:'Other',          icon:'◈' },
]

export const TRIATHLON_TYPES = [
  { id:'sprint',  label:'Sprint  (750m · 20km · 5km)' },
  { id:'olympic', label:'Olympic (1.5km · 40km · 10km)' },
  { id:'half',    label:'70.3  Half Ironman' },
  { id:'full',    label:'Full  Ironman' },
]

export const ATHLETE_LEVELS = [
  { id:'beginner',     label:'Beginner',     sub:'< 1 yr · first steps' },
  { id:'recreational', label:'Recreational', sub:'1–3 yr · fun races' },
  { id:'competitive',  label:'Competitive',  sub:'3–7 yr · age group medals' },
  { id:'advanced',     label:'Advanced',     sub:'7+ yr · top 10% finisher' },
  { id:'elite',        label:'Elite',        sub:'National/international level' },
]

// Adaptive UI visibility by athlete level
export const LEVEL_CONFIG = {
  beginner:     { showCTL:false, showTSB:false, showACWR:false, showMonotony:false, showZoneDonut:false, showTaper:false, dashSimple:true  },
  recreational: { showCTL:false, showTSB:true,  showACWR:false, showMonotony:false, showZoneDonut:true,  showTaper:false, dashSimple:false },
  competitive:  { showCTL:true,  showTSB:true,  showACWR:true,  showMonotony:false, showZoneDonut:true,  showTaper:true,  dashSimple:false },
  advanced:     { showCTL:true,  showTSB:true,  showACWR:true,  showMonotony:true,  showZoneDonut:true,  showTaper:true,  dashSimple:false },
  elite:        { showCTL:true,  showTSB:true,  showACWR:true,  showMonotony:true,  showZoneDonut:true,  showTaper:true,  dashSimple:false },
}

/**
 * v9.67.0 — Normalize athleteLevel input to a LEVEL_CONFIG key.
 *
 * Pre-fix the Onboarding step-5 picker stored capitalized PLAN_LEVELS values
 * ('Beginner' / 'Intermediate' / 'Advanced'), but LEVEL_CONFIG keys are
 * lowercase ATHLETE_LEVELS values ('beginner' / 'recreational' / 'competitive'
 * / 'advanced' / 'elite'). Dashboard.jsx:152 did `LEVEL_CONFIG[level] ||
 * LEVEL_CONFIG.competitive`, so a new "Beginner" athlete fell through to
 * competitive and saw the FULL feature set — defeating the simplified
 * dashSimple branch (Dashboard.jsx:352) that was designed exactly for them.
 *
 * Maps:
 *   'Beginner'     → 'beginner'      (simplified — protects newcomers)
 *   'Intermediate' → 'competitive'   (full features — matches old fallback)
 *   'Advanced'     → 'advanced'      (full + monotony — matches old fallback)
 *   already-lowercase ATHLETE_LEVELS keys pass through unchanged.
 *
 * Returns '' for null/undefined so the caller's default-fallback chain still
 * works.
 */
/**
 * v9.78.0 — Normalize any sport input to the canonical Capitalized form.
 * Three vocabularies exist in the codebase:
 *   - Capitalized: 'Running' / 'Cycling' / 'Triathlon' / 'Swimming' / 'Rowing'
 *     (what Onboarding + most device sync mappers write — also what
 *     SESSION_TYPES_BY_DISCIPLINE is keyed on)
 *   - full lowercase: 'running' / 'cycling' / 'swimming' (used in some lib
 *     files like efficiencyFactor.js, runningCV.js)
 *   - 3-letter internal: 'run' / 'bike' / 'swim' / 'triathlon' / 'rowing'
 *     (used by eliteProgram.js and the log-entry `sport` field — log entries
 *     stay 3-letter, this normalizer is for the PROFILE tier only)
 *
 * sanitizeProfile uses this so every read site that compares
 * profile.sport sees the same Capitalized form regardless of write source.
 *
 * Returns '' for unknown / falsy input so the caller's fallback chain works.
 */
export function normalizeSport(input) {
  if (!input || typeof input !== 'string') return ''
  const lower = input.trim().toLowerCase()
  const MAP = {
    run: 'Running',       running: 'Running',
    bike: 'Cycling',      cycling: 'Cycling',   cycle: 'Cycling',
    swim: 'Swimming',     swimming: 'Swimming',
    tri: 'Triathlon',     triathlon: 'Triathlon',
    row: 'Rowing',        rowing: 'Rowing',
    other: 'Other',
  }
  return MAP[lower] || ''
}

export function normalizeAthleteLevel(input) {
  if (!input || typeof input !== 'string') return ''
  const lower = input.trim().toLowerCase()
  if (lower in LEVEL_CONFIG) return lower
  if (lower === 'intermediate') return 'competitive'
  return ''
}

// Default zone mode and sport behaviour by primary sport
export const SPORT_CONFIG = {
  running:    { defaultZoneMode:'pace',  showFTP:false, showCSS:false, sessionGroup:'Running',      unitPrimary:'min/km' },
  cycling:    { defaultZoneMode:'power', showFTP:true,  showCSS:false, sessionGroup:'Cycling',      unitPrimary:'watts'  },
  swimming:   { defaultZoneMode:'hr',    showFTP:false, showCSS:true,  sessionGroup:'Swimming',     unitPrimary:'/100m'  },
  triathlon:  { defaultZoneMode:'pace',  showFTP:true,  showCSS:true,  sessionGroup:'Multi-Sport',  unitPrimary:'mixed'  },
  trail:      { defaultZoneMode:'hr',    showFTP:false, showCSS:false, sessionGroup:'Running',      unitPrimary:'effort' },
  hyrox:      { defaultZoneMode:'hr',    showFTP:false, showCSS:false, sessionGroup:'General',      unitPrimary:'effort' },
  ocr:        { defaultZoneMode:'hr',    showFTP:false, showCSS:false, sessionGroup:'General',      unitPrimary:'effort' },
  rowing:     { defaultZoneMode:'hr',    showFTP:false, showCSS:false, sessionGroup:'General',      unitPrimary:'/500m'  },
  nordic:     { defaultZoneMode:'hr',    showFTP:false, showCSS:false, sessionGroup:'General',      unitPrimary:'effort' },
  hybrid:     { defaultZoneMode:'hr',    showFTP:true,  showCSS:false, sessionGroup:'General',      unitPrimary:'mixed'  },
  other:      { defaultZoneMode:'hr',    showFTP:false, showCSS:false, sessionGroup:'General',      unitPrimary:'effort' },
}
export const LOAD_COLOR = { Low:'#5bc25b', Med:'#f5c542', High:'#e03030' }
export const RACE_DISTANCES = [
  { label:'1500 m', m:1500 }, { label:'1 mile', m:1609 }, { label:'3 km', m:3000 },
  { label:'5 km', m:5000 }, { label:'10 km', m:10000 }, { label:'Half Marathon', m:21097 },
  { label:'Marathon', m:42195 }, { label:'Custom', m:0 },
]
export const WELLNESS_FIELDS = [
  { key:'sleep',    emoji:['😴','😪','😐','😊','😁'], lk:'sleepQL' },
  { key:'soreness', emoji:['😩','😕','😐','🙂','💪'], lk:'sorenessL' },
  { key:'energy',   emoji:['🪫','😓','😐','⚡','🔥'], lk:'energyL' },
  { key:'mood',     emoji:['😞','😕','😐','🙂','😁'], lk:'moodL' },
  { key:'stress',   emoji:['😤','😟','😐','😌','🧘'], lk:'stressL' },
]

export const GLOSSARY_TERMS = [
  { term:'VO\u2082max',
    en:'Maximum oxygen uptake \u2014 the ceiling of aerobic power. Expressed in mL/kg/min. Elite marathoners: 70\u201385.',
    tr:'Maksimum oksijen t\u00fcketimi \u2014 aerobik g\u00fcc\u00fcn tavan\u0131. mL/kg/dk olarak ifade edilir.' },
  { term:'Lactate Threshold (LT1)',
    en:'Exercise intensity where lactate first rises above baseline (~2 mmol/L). Upper boundary of Zone 2.',
    tr:'Laktat\u0131n dinlenme d\u00fczeyinin \u00fczerine \u00e7\u0131kmaya ba\u015flad\u0131\u011f\u0131 yo\u011funluk (~2 mmol/L). Z2 s\u0131n\u0131r\u0131.' },
  { term:'Lactate Threshold (LT2)',
    en:'Maximal lactate steady state (~4 mmol/L). Also called MLSS or threshold pace. Cornerstone of training zones.',
    tr:'Maksimal laktat karars\u0131z durum (~4 mmol/L). E\u015fik tempo. Antrenman zonlar\u0131n\u0131n temel referans\u0131.' },
  { term:'TSS',
    en:'Training Stress Score = (duration \u00d7 IF\u00b2) \u00d7 100. Easy day ~50, hard day ~100+. Weekly 400\u2013600 = well-trained.',
    tr:'Antrenman Y\u00fck Skoru. Kolay g\u00fcn ~50, zor g\u00fcn ~100+. Haftal\u0131k 400\u2013600 = iyi antrenman.' },
  { term:'ATL / CTL / TSB',
    en:'ATL = 7-day EMA of TSS (Fatigue). CTL = 42-day EMA (Fitness). TSB = CTL \u2212 ATL = Form.',
    tr:'ATL = 7 g\u00fcnl\u00fck EMA (Yorgunluk). CTL = 42 g\u00fcnl\u00fck EMA (Kondisyon). TSB = CTL \u2212 ATL = Form.' },
  { term:'FTP',
    en:'Functional Threshold Power \u2014 highest average power sustainable ~60 min. Roughly 95% of 20-min test.',
    tr:'~60 dakika s\u00fcrd\u00fcr\u00fclebilecek maksimal ortalama g\u00fc\u00e7. 20 dakika testinin yakla\u015f\u0131k %95\u2019i.' },
  { term:'EPOC',
    en:'Excess Post-Exercise Oxygen Consumption. Elevated metabolism after hard training. Duration: minutes to 24h.',
    tr:'Egzersiz sonras\u0131 fazla oksijen t\u00fcketimi. S\u00fcresi dakikalardan 24 saate kadar uzayabilir.' },
  { term:'Periodization',
    en:'Systematic organization of training into phases (base, build, peak, taper) to peak at a target event.',
    tr:'Antrenman\u0131n hedef yar\u0131\u015fa g\u00f6re d\u00f6nemlere (baz, geli\u015fme, zirve, azaltma) b\u00f6l\u00fcnmesi.' },
  { term:'Polarized Training',
    en:'80% at low intensity (Z1\u2013Z2), 20% at high intensity (Z4\u2013Z5). Superior adaptations vs. threshold-heavy models.',
    tr:'Hacmin %80\u2019i d\u00fc\u015f\u00fck (Z1\u2013Z2), %20\u2019si y\u00fcksek yo\u011funlukta. E\u015fik a\u011f\u0131rl\u0131kl\u0131 modellere g\u00f6re \u00fcst\u00fcn adaptasyon.' },
  { term:'Central Governor Theory',
    en:'Tim Noakes model: the brain limits exercise before physiological damage based on sensory feedback. Fatigue is protective.',
    tr:'Tim Noakes modeli: beyin fizyolojik hasar\u0131 \u00f6nlemek i\u00e7in egzersizi s\u0131n\u0131rland\u0131r\u0131r. Yorgunluk koruyucu bir duygudur.' },
  { term:'Cardiac Drift',
    en:'Progressive HR rise during prolonged constant-pace exercise due to dehydration. Common after 60+ min.',
    tr:'Dehidrasyon nedeniyle uzun s\u00fcreli sabit tempoda kalp at\u0131\u015f\u0131n\u0131n kademeli artmas\u0131. 60+ dakika sonra yayg\u0131nd\u0131r.' },
  { term:'Running Economy',
    en:'Oxygen cost of running at a given speed. Better economy = less O\u2082 per km. Improved by strength work and altitude.',
    tr:'Belirli bir h\u0131zda ko\u015furun oksijen maliyeti. G\u00fc\u00e7 antrenman\u0131 ve irtifa ile geli\u015ftirilebilir.' },
]

export const MACRO_PHASES = [
  { week:1,  phase:'Base 1',   focus:'Aerobic Foundation', zDist:[60,30,10,0,0],  load:'Low'  },
  { week:2,  phase:'Base 1',   focus:'Aerobic Foundation', zDist:[60,30,10,0,0],  load:'Low'  },
  { week:3,  phase:'Base 2',   focus:'Aerobic Build',      zDist:[55,30,10,5,0],  load:'Med'  },
  { week:4,  phase:'Recovery', focus:'Deload (\u221230%)',  zDist:[70,25,5,0,0],   load:'Low'  },
  { week:5,  phase:'Build 1',  focus:'Threshold Dev.',     zDist:[55,25,10,8,2],  load:'Med'  },
  { week:6,  phase:'Build 1',  focus:'Threshold Dev.',     zDist:[50,25,10,10,5], load:'High' },
  { week:7,  phase:'Build 2',  focus:'VO\u2082max Stimulus',zDist:[50,20,10,10,10],load:'High' },
  { week:8,  phase:'Recovery', focus:'Deload (\u221230%)',  zDist:[65,25,5,5,0],   load:'Low'  },
  { week:9,  phase:'Peak 1',   focus:'Race-Specific',      zDist:[50,20,10,12,8], load:'High' },
  { week:10, phase:'Peak 1',   focus:'Race-Specific',      zDist:[48,20,10,12,10],load:'High' },
  { week:11, phase:'Peak 2',   focus:'Sharpen',            zDist:[52,22,8,10,8],  load:'Med'  },
  { week:12, phase:'Taper',    focus:'Volume \u221240%',    zDist:[60,25,8,5,2],   load:'Low'  },
  { week:13, phase:'Race',     focus:'Race Week',          zDist:[75,20,3,2,0],   load:'Low'  },
]

export const PLAN_GOALS = ['5K','10K','Half Marathon','Marathon','General Fitness','Cycling Event']

// v9.96.0 — Sport-filtered goal subsets. Before this, a cyclist user (sport
// = 'Cycling') saw all running distances in the onboarding goal picker;
// most were irrelevant. The list of canonical goals stays in PLAN_GOALS
// for back-compat and tests; the filter is render-side only.
//
// v9.96.0 originally let Triathlon / Other fall through to the full running
// list. That mis-seeded the first plan: a triathlete picking "Marathon" got
// pure running-marathon periodization (Onboarding step 1 offers Triathlon +
// Other, but they had no goal subset of their own). v9.41x — give them
// sport-appropriate goal subsets so the starter plan is constrained sensibly.
//
// Triathlon distances + "Other" goals are intentionally NOT in PLAN_GOALS:
// PLAN_GOALS drives the sport-agnostic PlanGenerator dropdown, which would then
// show tri distances to runners. They flow through the goal→plan lookups safely
// anyway: generatePlan reads GOAL_EMPHASIS[goal] (no entry → base pattern, no
// shift) and starterPlan reads ONBOARDING_GOAL_TO_E13[goal] || 'pr' (unknown →
// 'pr'). 'General Fitness' is the canonical label and maps to 'fitness'.
// Real triathlon periodization is out of scope here — this only constrains the
// goal picker; it does not build tri-specific plan structure.
//
// Hybrid / unknown / null sports still fall through to the full list.
const GOALS_BY_SPORT = {
  Running:   ['5K', '10K', 'Half Marathon', 'Marathon', 'General Fitness'],
  Cycling:   ['Cycling Event', 'General Fitness'],
  Swimming:  ['General Fitness'],
  Rowing:    ['General Fitness'],
  Triathlon: ['Sprint Triathlon', 'Olympic Triathlon', '70.3 / Half Ironman', 'Ironman', 'General Fitness'],
  Other:     ['General Fitness'],
}

/**
 * Return the subset of PLAN_GOALS relevant to a given primary sport.
 * Unknown / mixed-sport / null sports get the full list.
 *
 * @param {string|null|undefined} sport - canonical sport string ('Running' | 'Cycling' | ...)
 * @returns {string[]} subset of PLAN_GOALS in their canonical order
 */
export function goalsForSport(sport) {
  return GOALS_BY_SPORT[sport] || PLAN_GOALS
}
export const PLAN_LEVELS = ['Beginner','Intermediate','Advanced']
export const ACTIVITY_MULTS = [
  { label:'Sedentary (desk job)', mult:1.2 },
  { label:'Light (1–3 days/wk)',  mult:1.375 },
  { label:'Moderate (3–5 days/wk)',mult:1.55 },
  { label:'Active (6–7 days/wk)', mult:1.725 },
  { label:'Very Active (2×/day)', mult:1.9 },
]
export const ZLABEL = { easy:'Z1-Z2',tempo:'Z3-Z4',interval:'Z4-Z5',long:'Z1-Z2',recovery:'Z1',strength:'Z2-Z3',cross:'Z1-Z2',rest:'—',race:'Z4-Z5' }
export const ZIDX   = { easy:1,tempo:3,interval:4,long:1,recovery:0,strength:2,cross:1,rest:-1,race:4 }
export const ZCOL   = t => [ZONE_COLORS[1],ZONE_COLORS[3],ZONE_COLORS[4],ZONE_COLORS[1],ZONE_COLORS[0],ZONE_COLORS[2],ZONE_COLORS[1],'#d4d4d4',ZONE_COLORS[4]][['easy','tempo','interval','long','recovery','strength','cross','rest','race'].indexOf(t)] || ZONE_COLORS[1]
export const SESSION_DESCRIPTIONS = {
  easy:     'Conversational pace. Z1–Z2 throughout. Nasal breathing. Aerobic base.',
  tempo:    'Comfortably hard. 20–40 min at lactate threshold. Short sentences only.',
  interval: 'VO₂max stimulus. Hard repeats (3–5 min) with equal recovery. Quality > quantity.',
  long:     'Cornerstone session. Easy pace. Mitochondrial density development.',
  recovery: 'Very easy. Active blood flow only. Walk if needed. Z1 strictly.',
  strength: 'Hip stability, lunges, single-leg work, core. Injury prevention.',
  cross:    'Low-impact aerobic. Swim, cycle, or elliptical. Easy effort.',
  rest:     'Complete rest or gentle mobility. 7–9h sleep. Adaptation happens here.',
  race:     'RACE DAY. Warm up 15 min. Execute your pacing strategy. Enjoy it.',
}
export const DAY_PATTERNS = {
  beginner: {
    Base:      ['easy','rest','easy','cross','easy','long','rest'],
    Build:     ['easy','easy','cross','recovery','easy','long','rest'],
    Peak:      ['easy','tempo','easy','recovery','easy','long','rest'],
    Taper:     ['easy','tempo','rest','easy','rest','easy','rest'],
    Recovery:  ['recovery','rest','easy','rest','easy','easy','rest'],
    'Race Week':['easy','rest','easy','rest','rest','race','rest'],
  },
  intermediate: {
    Base:      ['easy','strength','easy','recovery','easy','long','rest'],
    Build:     ['easy','tempo','easy','recovery','cross','long','rest'],
    Peak:      ['easy','interval','easy','tempo','recovery','long','rest'],
    Taper:     ['easy','tempo','rest','easy','recovery','easy','rest'],
    Recovery:  ['recovery','cross','easy','rest','easy','easy','rest'],
    'Race Week':['easy','easy','rest','easy','rest','race','rest'],
  },
  advanced: {
    Base:      ['easy','strength','easy','tempo','easy','long','recovery'],
    Build:     ['easy','tempo','strength','interval','recovery','long','easy'],
    Peak:      ['easy','interval','tempo','easy','recovery','long','easy'],
    Taper:     ['easy','interval','easy','tempo','recovery','easy','rest'],
    Recovery:  ['recovery','cross','easy','strength','easy','easy','rest'],
    'Race Week':['easy','easy','tempo','easy','rest','race','rest'],
  },
}
export const DUR_FRAC = { easy:.14,tempo:.16,interval:.13,long:.28,recovery:.09,strength:.11,cross:.13,rest:0,race:.20 }
export const SES_RPE  = { easy:4,tempo:7,interval:8,long:5,recovery:3,strength:5,cross:4,rest:0,race:9 }
export const ZONE_BY_TYPE = {
  easy:[5,70,25,0,0],tempo:[0,15,35,40,10],interval:[0,5,10,30,55],long:[10,75,15,0,0],
  recovery:[100,0,0,0,0],strength:[0,30,50,20,0],cross:[10,65,25,0,0],rest:[0,0,0,0,0],race:[0,5,15,40,40],
}
export const DAYS7 = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ── Goal/distance emphasis for the legacy plan generator ─────────────────────
// Makes generatePlan() honor the race target: a 5K plan ≠ a marathon plan.
// Applied ONLY to Build & Peak weeks as per-session-type substitutions on top of
// the level's base DAY_PATTERN, so level-appropriate volume/structure is kept.
// Same philosophy as the adaptive DISTANCE_INTENT_TEMPLATES (5K = VO2-dominant;
// marathon = endurance/tempo, minimal VO2). A goal with no entry (e.g. General
// Fitness) or an unknown goal → no shift (base level pattern unchanged).
export const GOAL_EMPHASIS = {
  '5K':            { tempo: 'interval' }, // speed: threshold days → VO2 intervals
  '10K':           {},                    // balanced: keep the level's mix
  'Half Marathon': { interval: 'tempo' }, // threshold focus: VO2 → tempo
  'Marathon':      { interval: 'tempo' }, // endurance: drop VO2 for tempo (long stays)
  'Cycling Event': { interval: 'tempo' }, // sweet-spot / threshold
}

// ─── Search index ──────────────────────────────────────────────────────────────
export const SEARCH_INDEX = [
  { id:'zone-hr',      name:'HR Zone Calculator',   desc:'Heart rate zones from max HR',        tab:'zones'          },
  { id:'zone-power',   name:'Power Zone Calculator', desc:'FTP-based cycling power zones',        tab:'zones'          },
  { id:'zone-pace',    name:'Pace Zone Calculator',  desc:'Running zones from threshold pace',    tab:'zones'          },
  { id:'zone-race',    name:'Race Pacing',           desc:'Km-by-km split plan for any distance', tab:'zones'          },
  { id:'zone-heat',    name:'Heat Calculator',       desc:'Pace penalty and heat index',           tab:'zones'          },
  { id:'zone-altitude',name:'Altitude Calculator',   desc:'VO2max reduction at altitude',         tab:'zones'          },
  { id:'log-session',  name:'Log Session',           desc:'Record a training session',            tab:'log'            },
  { id:'log-export',   name:'Export Training Log',   desc:'Download sessions as CSV',             tab:'log'            },
  { id:'log-calendar', name:'Calendar View',         desc:'View sessions on a monthly calendar',  tab:'log'            },
  { id:'tests-cooper', name:'Cooper Test',           desc:'12-min run VO2max estimate',            tab:'tests'          },
  { id:'tests-ftp',    name:'FTP Test',              desc:'20-min power test for threshold',       tab:'tests'          },
  { id:'tests-lactate',name:'Lactate Test',          desc:'Blood lactate threshold detection',     tab:'tests'          },
  { id:'tests-ramp',   name:'Ramp Test',             desc:'VO2max ramp protocol',                  tab:'tests'          },
  { id:'dash-readiness',name:'Readiness Score',      desc:'7-day TSS-based training readiness',   tab:'dashboard'      },
  { id:'dash-ctl',     name:'CTL / ATL / TSB',       desc:'Fitness, fatigue and form tracking',   tab:'dashboard'      },
  { id:'dash-acwr',    name:'ACWR Injury Monitor',   desc:'Acute:Chronic Workload Ratio',         tab:'dashboard'      },
  { id:'dash-records', name:'Personal Records',      desc:'Best TSS, longest session, top RPE',   tab:'dashboard'      },
  { id:'dash-predict', name:'Race Predictions',      desc:'Riegel formula race time estimates',   tab:'dashboard'      },
  { id:'recovery',     name:'Wellness Check-In',     desc:'Daily sleep, soreness, energy, mood',  tab:'recovery'       },
  { id:'injury',       name:'Injury Tracker',        desc:'Body map pain logging',                tab:'recovery'       },
  { id:'mental',       name:'Mental Tools',          desc:'Breathing and mindset exercises',       tab:'recovery'       },
  { id:'plan',         name:'Plan Generator',        desc:'Build a structured training block',    tab:'plan'           },
  { id:'periodization',name:'Periodization',         desc:'12-week macro cycle planning',         tab:'periodization'  },
  { id:'glossary',     name:'Glossary',              desc:'Sport science terms explained',        tab:'glossary'       },
  { id:'profile-sport',name:'Sport & Level',         desc:'Set primary sport and athlete level',  tab:'profile'        },
  { id:'profile-body', name:'Body Composition',      desc:'Navy BF% and BMR calculator',         tab:'profile'        },
  { id:'profile-export',name:'Export All Data',      desc:'Download all data as JSON backup',     tab:'profile'        },
  { id:'profile-coach',name:'Connect to Coach',      desc:'Send your data to Hüseyin Işık',      tab:'profile'        },
  { id:'achievements', name:'Achievements',          desc:'Training milestones and badges',       tab:'dashboard'      },
  { id:'dark-mode',    name:'Dark Mode',             desc:'Toggle dark / light theme',            tab:null, action:'dark' },
  { id:'language',     name:'Language / Dil',        desc:'Switch English ↔ Turkish (TR/EN)',    tab:null, action:'lang' },
]

// ─── Dashboard card layout ─────────────────────────────────────────────────────
// v9.442 — each entry carries `tr` (Turkish label) + `group` (category key for the
// grouped/collapsible Customize panel). `id` and `label` (English) are unchanged —
// ids are referenced by render gates in Dashboard.jsx; never rename an id.
// Group keys: core, load, recovery, nutrition, sessions, sport, analysis, elite, goals, other
export const DASH_CARD_GROUPS = [
  { key:'core',      en:'Core',                  tr:'Temel'                  },
  { key:'load',      en:'Load & Fitness',        tr:'Yük ve Kondisyon'       },
  { key:'recovery',  en:'Readiness & Recovery',  tr:'Hazırlık ve Toparlanma' },
  { key:'sessions',  en:'Sessions & Plan',       tr:'Antrenman ve Plan'      },
  { key:'nutrition', en:'Nutrition & Fueling',   tr:'Beslenme ve Yakıt'      },
  { key:'sport',     en:'Sport-Specific',        tr:'Spora Özel'             },
  { key:'goals',     en:'Goals & Races',         tr:'Hedefler ve Yarışlar'   },
  { key:'elite',     en:'Elite & Programs',      tr:'Elit ve Programlar'     },
  { key:'analysis',  en:'Analysis & Trends',     tr:'Analiz ve Trendler'     },
  { key:'other',     en:'Other',                 tr:'Diğer'                  },
]

export const DASH_CARD_DEFS = [
  { id:'readiness',    label:'Readiness & Load',       tr:'Hazırlık ve Yük',          group:'recovery' },
  { id:'stats',        label:'7-Day Stats',            tr:'7 Günlük İstatistikler',   group:'core'     },
  { id:'chart',        label:'TSS/CTL Chart',          tr:'TSS/CTL Grafiği',          group:'core'     },
  { id:'sessions',     label:'Recent Sessions',        tr:'Son Antrenmanlar',         group:'core'     },
  { id:'weekly',       label:'Weekly Volume',          tr:'Haftalık Hacim',           group:'core'     },
  { id:'zones',        label:'Zone Distribution',      tr:'Bölge Dağılımı',           group:'core'     },
  { id:'records',      label:'Personal Records',       tr:'Kişisel Rekorlar',         group:'goals'    },
  { id:'timeline',     label:'Fitness Timeline',       tr:'Kondisyon Zaman Çizelgesi',group:'load'     },
  { id:'body',         label:'Body Composition',       tr:'Vücut Kompozisyonu',       group:'nutrition'},
  { id:'predictions',  label:'Race Predictions',       tr:'Yarış Tahminleri',         group:'goals'    },
  { id:'achievements', label:'Achievements',           tr:'Başarımlar',               group:'goals'    },
  { id:'goal',         label:'Goal Countdown',         tr:'Hedef Geri Sayımı',        group:'goals'    },
  { id:'acwr',         label:'ACWR',                   tr:'ACWR',                     group:'load'     },
  { id:'vo2max',       label:'VO2max Estimate',        tr:'VO2max Tahmini',           group:'analysis' },
  { id:'peakweek',     label:'Peak Form Predictor',    tr:'Zirve Form Tahmini',       group:'goals'    },
  { id:'trainingage',  label:'Training Age',           tr:'Antrenman Yaşı',           group:'analysis' },
  { id:'goaltracker',  label:'Goal Tracker',           tr:'Hedef Takibi',             group:'goals'    },
  { id:'loadheatmap',  label:'Load Heatmap',           tr:'Yük Isı Haritası',         group:'load'     },
  { id:'seasonbests',  label:'Season Bests',           tr:'Sezon Rekorları',          group:'goals'    },
  { id:'aiInsights',   label:'AI Coach Insights',      tr:'AI Antrenör İçgörüleri',   group:'analysis' },
  // ── Advanced-view "auto" cards (v9.x) — previously ungated, now toggleable.
  { id:'missionHeadline',            label:'Mission Headline',             tr:'Misyon Başlığı',              group:'core'      },
  { id:'eliteProgram',               label:'Elite Program',                tr:'Elit Program',                group:'elite'     },
  { id:'fieldTestHistory',           label:'Field Test History',           tr:'Saha Testi Geçmişi',          group:'analysis'  },
  { id:'todayProgrammedSession',     label:'Today’s Programmed Session',   tr:'Bugünün Programlı Antrenmanı',group:'sessions'  },
  { id:'todayStrip',                 label:'Today Strip',                  tr:'Bugün Şeridi',                group:'core'      },
  { id:'eliteMetrics',               label:'Elite Metrics Strip',          tr:'Elit Metrik Şeridi',          group:'elite'     },
  { id:'dailyBriefing',              label:'Daily Briefing',               tr:'Günlük Brifing',              group:'core'      },
  { id:'nutritionTiming',            label:'Nutrition Timing',             tr:'Beslenme Zamanlaması',        group:'nutrition' },
  { id:'todayReadiness',             label:'Today Readiness',              tr:'Bugünkü Hazırlık',            group:'recovery'  },
  { id:'raceGoalAnalyzer',           label:'Race Goal Analyzer',           tr:'Yarış Hedefi Analizi',        group:'goals'     },
  { id:'programSelector',            label:'Program Selector',             tr:'Program Seçici',              group:'elite'     },
  { id:'coachGate',                  label:'Coach Gate',                   tr:'Antrenör Kapısı',             group:'other'     },
  { id:'trainingBridge',             label:'Training Bridge',              tr:'Antrenman Köprüsü',           group:'sessions'  },
  { id:'raceGoalDash',               label:'Race Goal Dash',               tr:'Yarış Hedefi Paneli',         group:'goals'     },
  { id:'vdotProgress',               label:'VDOT Progress',                tr:'VDOT İlerlemesi',             group:'analysis'  },
  { id:'milestones',                 label:'Milestones',                   tr:'Kilometre Taşları',           group:'goals'     },
  { id:'backupReminder',             label:'Backup Reminder',              tr:'Yedekleme Hatırlatıcısı',     group:'other'     },
  { id:'weeklyRetro',                label:'Weekly Retro',                 tr:'Haftalık Değerlendirme',      group:'analysis'  },
  { id:'phaseAnalytics',             label:'Phase Analytics',              tr:'Faz Analitiği',               group:'analysis'  },
  { id:'raceReadiness',              label:'Race Readiness',               tr:'Yarış Hazırlığı',             group:'goals'     },
  { id:'raceWeekProtocol',           label:'Race Week Protocol',           tr:'Yarış Haftası Protokolü',     group:'goals'     },
  { id:'eliteRaceWeek',              label:'Elite Race Week',              tr:'Elit Yarış Haftası',          group:'elite'     },
  { id:'raceDayFuelingTimeline',     label:'Race Day Fueling Timeline',    tr:'Yarış Günü Yakıt Zaman Çizelgesi', group:'nutrition' },
  { id:'raceMentalRehearsal',        label:'Race Mental Rehearsal',        tr:'Yarış Zihinsel Provası',      group:'goals'     },
  { id:'raceEquipmentChecklist',     label:'Race Equipment Checklist',     tr:'Yarış Ekipman Kontrol Listesi',group:'goals'    },
  { id:'preRaceSleepBanking',        label:'Pre-Race Sleep Banking',       tr:'Yarış Öncesi Uyku Biriktirme',group:'recovery'  },
  { id:'altitudeStimulus',           label:'Altitude Stimulus',            tr:'Yükseklik Uyaranı',           group:'analysis'  },
  { id:'postHardSessionResponse',    label:'Post-Hard Session Response',   tr:'Zorlu Antrenman Sonrası Tepki',group:'recovery' },
  { id:'seasonalLoadDistribution',   label:'Seasonal Load Distribution',   tr:'Sezonluk Yük Dağılımı',       group:'load'      },
  { id:'crossSportRecoveryGap',      label:'Cross-Sport Recovery Gap',     tr:'Sporlar Arası Toparlanma Boşluğu', group:'recovery' },
  { id:'morningLogConsistency',      label:'Morning Log Consistency',      tr:'Sabah Kaydı Tutarlılığı',     group:'recovery'  },
  { id:'weeklyGoalVariance',         label:'Weekly Goal Variance',         tr:'Haftalık Hedef Sapması',      group:'analysis'  },
  { id:'checkInQuality',             label:'Check-In Quality',             tr:'Giriş Kalitesi',              group:'recovery'  },
  { id:'averageWeekShape',           label:'Average Week Shape',           tr:'Ortalama Hafta Şekli',        group:'analysis'  },
  { id:'moodEnergyBalance',          label:'Mood / Energy Balance',        tr:'Ruh Hali / Enerji Dengesi',   group:'recovery'  },
  { id:'rpeStability',               label:'RPE Stability',                tr:'RPE Stabilitesi',             group:'analysis'  },
  { id:'stressPattern',              label:'Stress Pattern',               tr:'Stres Deseni',                group:'recovery'  },
  { id:'perseverance',               label:'Perseverance',                 tr:'Azim',                        group:'analysis'  },
  { id:'longestSessionTrend',        label:'Longest Session Trend',        tr:'En Uzun Antrenman Trendi',    group:'analysis'  },
  { id:'weeklyVolumeIntensityRatio', label:'Volume / Intensity Ratio',     tr:'Hacim / Şiddet Oranı',        group:'analysis'  },
  { id:'sessionDensity',             label:'Session Density',              tr:'Antrenman Yoğunluğu',         group:'analysis'  },
  { id:'sleepConsistency',           label:'Sleep Consistency',            tr:'Uyku Tutarlılığı',            group:'recovery'  },
  { id:'lifetimeTotals',             label:'Lifetime Totals',              tr:'Tüm Zamanlar Toplamı',        group:'analysis'  },
  { id:'yearOverYear',               label:'Year Over Year',               tr:'Yıldan Yıla',                 group:'analysis'  },
  { id:'trainingAgeStage',           label:'Training Age Stage',           tr:'Antrenman Yaşı Evresi',       group:'analysis'  },
  { id:'weeklyVolumeRecord',         label:'Weekly Volume Record',         tr:'Haftalık Hacim Rekoru',       group:'goals'     },
  { id:'raceTimeEstimator',          label:'Race Time Estimator',          tr:'Yarış Süresi Tahmini',        group:'goals'     },
  { id:'paceByRpe',                  label:'Pace by RPE',                  tr:'RPE’ye Göre Tempo',      group:'analysis'  },
  { id:'volumeAcceleration',         label:'Volume Acceleration',          tr:'Hacim İvmesi',                group:'load'      },
  { id:'annualTssTarget',            label:'Annual TSS Target',            tr:'Yıllık TSS Hedefi',           group:'goals'     },
  { id:'hrForRpe',                   label:'HR for RPE',                   tr:'RPE için Kalp Atışı',         group:'analysis'  },
  { id:'bedtimeConsistency',         label:'Bedtime Consistency',          tr:'Yatış Saati Tutarlılığı',     group:'recovery'  },
  { id:'restingHrFitnessTrend',      label:'Resting HR Fitness Trend',     tr:'Dinlenik Nabız Kondisyon Trendi', group:'recovery' },
  { id:'energySorenessDivergence',   label:'Energy / Soreness Divergence', tr:'Enerji / Ağrı Sapması',       group:'recovery'  },
  { id:'logStreakBreaker',           label:'Log Streak Breaker',           tr:'Kayıt Serisi Kırıcı',         group:'analysis'  },
  { id:'dataCoverage',               label:'Data Coverage',                tr:'Veri Kapsamı',                group:'analysis'  },
  { id:'dayOfWeekAvailability',      label:'Day-of-Week Availability',     tr:'Haftanın Günü Uygunluğu',     group:'analysis'  },
  { id:'perfectWeek',                label:'Perfect Week',                 tr:'Mükemmel Hafta',              group:'goals'     },
  { id:'weeklyTssVariance',          label:'Weekly TSS Variance',          tr:'Haftalık TSS Sapması',        group:'load'      },
  { id:'longRunFrequency',           label:'Long Run Frequency',           tr:'Uzun Koşu Sıklığı',           group:'sessions'  },
  { id:'recoveryQualityStreak',      label:'Recovery Quality Streak',      tr:'Toparlanma Kalitesi Serisi',  group:'recovery'  },
  { id:'ctlSlope',                   label:'CTL Slope',                    tr:'CTL Eğimi',                   group:'load'      },
  { id:'weeklyKmPerSport',           label:'Weekly Km per Sport',          tr:'Spora Göre Haftalık Km',      group:'sport'     },
  { id:'paceRange',                  label:'Pace Range',                   tr:'Tempo Aralığı',               group:'analysis'  },
  { id:'timeOnFeet',                 label:'Time on Feet',                 tr:'Ayakta Geçen Süre',           group:'analysis'  },
  { id:'restDayDistribution',        label:'Rest Day Distribution',        tr:'Dinlenme Günü Dağılımı',      group:'recovery'  },
  { id:'newSessionTypeIntro',        label:'New Session Type Intro',       tr:'Yeni Antrenman Türü Girişi',  group:'sessions'  },
  { id:'mesocycleProgression',       label:'Mesocycle Progression',        tr:'Mezosiklus İlerlemesi',       group:'sessions'  },
  { id:'volumeIntensityScissors',    label:'Volume / Intensity Scissors',  tr:'Hacim / Şiddet Makası',       group:'analysis'  },
  { id:'longRunConsistency',         label:'Long Run Consistency',         tr:'Uzun Koşu Tutarlılığı',       group:'sessions'  },
  { id:'calendarHoles',              label:'Calendar Holes',               tr:'Takvim Boşlukları',           group:'analysis'  },
  { id:'backToBackLongDay',          label:'Back-to-Back Long Day',        tr:'Arka Arkaya Uzun Gün',        group:'sessions'  },
  { id:'seasonAnchor',               label:'Season Anchor',                tr:'Sezon Çapası',                group:'goals'     },
  { id:'cumulativeFatigueWindows',   label:'Cumulative Fatigue Windows',   tr:'Kümülatif Yorgunluk Pencereleri', group:'recovery' },
  { id:'weeklyEnduranceTime',        label:'Weekly Endurance Time',        tr:'Haftalık Dayanıklılık Süresi',group:'analysis'  },
  { id:'twoADays',                   label:'Two-a-Days',                   tr:'Günde Çift Antrenman',        group:'sessions'  },
  { id:'sessionLengthDistribution',  label:'Session Length Distribution',  tr:'Antrenman Süresi Dağılımı',   group:'analysis'  },
  { id:'hardEasyAdherence',          label:'Hard / Easy Adherence',        tr:'Zor / Kolay Uyumu',           group:'analysis'  },
  { id:'peakWeekFrequency',          label:'Peak Week Frequency',          tr:'Zirve Hafta Sıklığı',         group:'analysis'  },
  { id:'zoneThreeBlackHole',         label:'Zone 3 Black Hole',            tr:'Bölge 3 Kara Deliği',         group:'analysis'  },
  { id:'hardSessionTypePattern',     label:'Hard Session Type Pattern',    tr:'Zorlu Antrenman Türü Deseni', group:'sessions'  },
  { id:'restDayEnergyTrend',         label:'Rest Day Energy Trend',        tr:'Dinlenme Günü Enerji Trendi', group:'recovery'  },
  { id:'highRpeBlock',               label:'High RPE Block',               tr:'Yüksek RPE Bloğu',            group:'analysis'  },
  { id:'postLongRunNextDay',         label:'Post Long-Run Next Day',       tr:'Uzun Koşu Ertesi Gün',        group:'recovery'  },
  { id:'midweekHardDayFrequency',    label:'Midweek Hard Day Frequency',   tr:'Hafta Ortası Zorlu Gün Sıklığı', group:'analysis' },
  { id:'resetWeekEffect',            label:'Reset Week Effect',            tr:'Sıfırlama Haftası Etkisi',    group:'analysis'  },
  { id:'seasonRestartCount',         label:'Season Restart Count',         tr:'Sezon Yeniden Başlama Sayısı',group:'analysis'  },
  { id:'dailyVolumeRange',           label:'Daily Volume Range',           tr:'Günlük Hacim Aralığı',        group:'analysis'  },
  { id:'weeklyVolumeStreak',         label:'Weekly Volume Streak',         tr:'Haftalık Hacim Serisi',       group:'analysis'  },
  { id:'microcycleVariety',          label:'Microcycle Variety',           tr:'Mikrosiklus Çeşitliliği',     group:'sessions'  },
  { id:'trainRestTrainPattern',      label:'Train-Rest-Train Pattern',     tr:'Antrenman-Dinlenme-Antrenman Deseni', group:'sessions' },
  { id:'overlookedSessionType',      label:'Overlooked Session Type',      tr:'İhmal Edilen Antrenman Türü', group:'sessions'  },
  { id:'highRpeLowTss',              label:'High RPE / Low TSS',           tr:'Yüksek RPE / Düşük TSS',      group:'analysis'  },
  { id:'trainingHourBudget',         label:'Training Hour Budget',         tr:'Antrenman Saati Bütçesi',     group:'analysis'  },
  { id:'weekendLongSessionShare',    label:'Weekend Long Session Share',   tr:'Hafta Sonu Uzun Antrenman Payı', group:'analysis' },
  { id:'volumePerSessionTrend',      label:'Volume per Session Trend',     tr:'Antrenman Başına Hacim Trendi',group:'analysis'  },
  { id:'alternatingWeekPattern',     label:'Alternating Week Pattern',     tr:'Dönüşümlü Hafta Deseni',      group:'analysis'  },
  { id:'hardWeekUnrested',           label:'Hard Week Unrested',           tr:'Dinlenmesiz Zorlu Hafta',     group:'recovery'  },
  { id:'maxTssDayPersonalRecord',    label:'Max TSS Day PR',               tr:'En Yüksek TSS Günü Rekoru',   group:'goals'     },
  { id:'sessionGapVariance',         label:'Session Gap Variance',         tr:'Antrenman Arası Boşluk Sapması', group:'analysis' },
  { id:'trainAfterRest',             label:'Train After Rest',             tr:'Dinlenme Sonrası Antrenman',  group:'recovery'  },
  { id:'afterBigWeekRpe',            label:'After Big Week RPE',           tr:'Büyük Hafta Sonrası RPE',     group:'recovery'  },
  { id:'veryEasyShare',              label:'Very Easy Share',              tr:'Çok Kolay Antrenman Payı',    group:'analysis'  },
  { id:'consecutiveDeloadCount',     label:'Consecutive Deload Count',     tr:'Ardışık Deload Sayısı',       group:'recovery'  },
  { id:'postHardSessionSoreness',    label:'Post-Hard Session Soreness',   tr:'Zorlu Antrenman Sonrası Ağrı',group:'recovery'  },
  { id:'hardDaySpacing',             label:'Hard Day Spacing',             tr:'Zorlu Gün Aralığı',           group:'sessions'  },
  { id:'proactiveInjuryAlert',       label:'Proactive Injury Alert',       tr:'Proaktif Sakatlık Uyarısı',   group:'recovery'  },
  { id:'loadSpikeAlert',             label:'Load Spike Alert',             tr:'Yük Sıçraması Uyarısı',       group:'load'      },
  { id:'weeklyTssGoal',              label:'Weekly TSS Goal',              tr:'Haftalık TSS Hedefi',         group:'goals'     },
  { id:'weeklyReview',               label:'Weekly Review',                tr:'Haftalık İnceleme',           group:'analysis'  },
  { id:'consistencyDepth',           label:'Consistency Depth',            tr:'Tutarlılık Derinliği',        group:'analysis'  },
  { id:'monthlyProgress',            label:'Monthly Progress',             tr:'Aylık İlerleme',              group:'analysis'  },
  { id:'weekSessionType',            label:'Week Session Type',            tr:'Haftalık Antrenman Türü',     group:'sessions'  },
  { id:'intensityBalance',           label:'Intensity Balance',            tr:'Şiddet Dengesi',              group:'analysis'  },
  { id:'allZones',                   label:'All Zones',                    tr:'Tüm Bölgeler',                group:'analysis'  },
  { id:'hrvTrend',                   label:'HRV Trend',                    tr:'HRV Trendi',                  group:'recovery'  },
  { id:'insightsPanel',              label:'Insights Panel',               tr:'İçgörü Paneli',               group:'analysis'  },
  { id:'efTrend',                    label:'EF Trend',                     tr:'EF Trendi',                   group:'analysis'  },
  { id:'yourPatterns',               label:'Your Patterns',                tr:'Desenleriniz',                group:'analysis'  },
  { id:'weekStory',                  label:'Week Story',                   tr:'Hafta Hikâyesi',              group:'analysis'  },
  { id:'fuelGuidance',               label:'Fuel Guidance',                tr:'Yakıt Rehberi',               group:'nutrition' },
  { id:'didYouKnow',                 label:'Did You Know',                 tr:'Biliyor muydunuz',            group:'other'     },
  { id:'sessionNotes',               label:'Session Notes',                tr:'Antrenman Notları',           group:'sessions'  },
  { id:'cadenceTrend',               label:'Cadence Trend',                tr:'Kadans Trendi',               group:'sport'     },
  { id:'subThresholdTrend',          label:'Sub-Threshold Trend',          tr:'Eşik Altı Trendi',            group:'analysis'  },
  { id:'zoneDistributor',            label:'Zone Distributor',             tr:'Bölge Dağıtıcı',              group:'analysis'  },
  { id:'triDashboard',               label:'Triathlon Dashboard',          tr:'Triatlon Paneli',             group:'sport'     },
  { id:'banisterModel',              label:'Banister Model',               tr:'Banister Modeli',             group:'load'      },
  { id:'durability',                 label:'Durability',                   tr:'Dayanıklılık',                group:'analysis'  },
  { id:'normative',                  label:'Normative Comparison',         tr:'Normatif Karşılaştırma',      group:'analysis'  },
  { id:'weeklyReport',               label:'Weekly Report',                tr:'Haftalık Rapor',              group:'analysis'  },
  { id:'coachingSummaryScore',       label:'Coaching Summary Score',       tr:'Antrenörlük Özet Puanı',      group:'analysis'  },
  { id:'coachingInsightsDigest',     label:'Coaching Insights Digest',     tr:'Antrenörlük İçgörü Özeti',    group:'analysis'  },
  { id:'staleZones',                 label:'Stale Zones',                  tr:'Güncelliğini Yitirmiş Bölgeler', group:'sport'  },
  { id:'workoutDensity',             label:'Workout Density',              tr:'Antrenman Yoğunluğu',         group:'analysis'  },
  { id:'sessionVariety',             label:'Session Variety',              tr:'Antrenman Çeşitliliği',       group:'sessions'  },
  { id:'fitnessGainRate',            label:'Fitness Gain Rate',            tr:'Kondisyon Kazanım Hızı',      group:'load'      },
  { id:'easyDayCompliance',          label:'Easy Day Compliance',          tr:'Kolay Gün Uyumu',             group:'analysis'  },
  { id:'trainingDistribution',       label:'Training Distribution',        tr:'Antrenman Dağılımı',          group:'analysis'  },
  { id:'detrainingDetector',         label:'Detraining Detector',          tr:'Form Kaybı Tespiti',          group:'recovery'  },
  { id:'monotonyStrain',             label:'Monotony / Strain',            tr:'Monotonluk / Zorlanma',       group:'load'      },
  { id:'vo2Gap',                     label:'VO2 Gap',                      tr:'VO2 Açığı',                   group:'analysis'  },
  { id:'streak',                     label:'Streak',                       tr:'Seri',                        group:'goals'     },
  { id:'sessionRpeDrift',            label:'Session RPE Drift',            tr:'Antrenman RPE Kayması',       group:'analysis'  },
  { id:'recoveryDebt',               label:'Recovery Debt',                tr:'Toparlanma Borcu',            group:'recovery'  },
  { id:'timeInZone',                 label:'Time in Zone',                 tr:'Bölgede Geçen Süre',          group:'analysis'  },
  { id:'supercompensationWindow',    label:'Supercompensation Window',     tr:'Süperkompansasyon Penceresi', group:'recovery'  },
  { id:'trainingPolarization',       label:'Training Polarization',        tr:'Antrenman Polarizasyonu',     group:'analysis'  },
  { id:'fitnessConsistency',         label:'Fitness Consistency',          tr:'Kondisyon Tutarlılığı',       group:'load'      },
  { id:'recoveryAdherence',          label:'Recovery Adherence',           tr:'Toparlanma Uyumu',            group:'recovery'  },
  { id:'trainingDiversity',          label:'Training Diversity',           tr:'Antrenman Çeşitliliği',       group:'analysis'  },
  { id:'deloadCadence',              label:'Deload Cadence',               tr:'Deload Ritmi',                group:'recovery'  },
  { id:'seasonStats',                label:'Season Stats',                 tr:'Sezon İstatistikleri',        group:'analysis'  },
  { id:'cpDecay',                    label:'CP Decay',                     tr:'CP Azalması',                 group:'sport'     },
  { id:'rowingMetrics',              label:'Rowing Metrics',               tr:'Kürek Metrikleri',            group:'sport'     },
  { id:'rowingSplitConsistency',     label:'Rowing Split Consistency',     tr:'Kürek Split Tutarlılığı',     group:'sport'     },
  { id:'challenge',                  label:'Challenge',                    tr:'Meydan Okuma',                group:'goals'     },
  { id:'nmFreshness',                label:'Neuromuscular Freshness',      tr:'Nöromüsküler Tazelik',        group:'recovery'  },
  { id:'polarizationCompliance',     label:'Polarization Compliance',      tr:'Polarizasyon Uyumu',          group:'analysis'  },
  { id:'aerobicEfficiency',          label:'Aerobic Efficiency',           tr:'Aerobik Verimlilik',          group:'analysis'  },
  { id:'restqTrend',                 label:'RESTQ Trend',                  tr:'RESTQ Trendi',                group:'recovery'  },
  { id:'injuryForecast',             label:'Injury Forecast',              tr:'Sakatlık Öngörüsü',           group:'recovery'  },
  { id:'strainHistory',              label:'Strain History',               tr:'Zorlanma Geçmişi',            group:'load'      },
  { id:'consistencyTrend',           label:'Consistency Trend',            tr:'Tutarlılık Trendi',           group:'analysis'  },
  { id:'insightFeed',                label:'Insight Feed',                 tr:'İçgörü Akışı',                group:'analysis'  },
  { id:'recoveryProtocol',           label:'Recovery Protocol',            tr:'Toparlanma Protokolü',        group:'recovery'  },
  { id:'recoveryHub',                label:'Recovery Hub',                 tr:'Toparlanma Merkezi',          group:'recovery'  },
  { id:'ostrcMonitor',               label:'OSTRC Monitor',                tr:'OSTRC İzleyici',              group:'recovery'  },
  { id:'hrvSummary',                 label:'HRV Summary',                  tr:'HRV Özeti',                   group:'recovery'  },
  { id:'vo2maxProgression',          label:'VO2max Progression',           tr:'VO2max İlerlemesi',           group:'analysis'  },
  { id:'vo2maxPlateau',              label:'VO2max Plateau',               tr:'VO2max Platosu',              group:'analysis'  },
  { id:'ruleAlerts',                 label:'Rule Alerts',                  tr:'Kural Uyarıları',             group:'recovery'  },
  { id:'cyclePlanner',               label:'Cycle Planner',                tr:'Siklus Planlayıcı',           group:'sessions'  },
  { id:'planAdherence',              label:'Plan Adherence',               tr:'Plan Uyumu',                  group:'sessions'  },
  { id:'planScore',                  label:'Plan Score',                   tr:'Plan Puanı',                  group:'sessions'  },
  { id:'athleteStatusSummary',       label:'Athlete Status Summary',       tr:'Sporcu Durumu Özeti',         group:'core'      },
  { id:'sleepRestingHr',             label:'Sleep / Resting HR',           tr:'Uyku / Dinlenik Nabız',       group:'recovery'  },
  { id:'sleepCtlCorrelation',        label:'Sleep / CTL Correlation',      tr:'Uyku / CTL Korelasyonu',      group:'recovery'  },
  { id:'sleepDebt',                  label:'Sleep Debt',                   tr:'Uyku Borcu',                  group:'recovery'  },
  { id:'recoveryStreak',             label:'Recovery Streak',              tr:'Toparlanma Serisi',           group:'recovery'  },
  { id:'restingHrDrift',             label:'Resting HR Drift',             tr:'Dinlenik Nabız Kayması',      group:'recovery'  },
  { id:'sessionClassifierBreakdown', label:'Session Classifier Breakdown', tr:'Antrenman Sınıflandırma Dökümü', group:'analysis' },
  { id:'workoutDeviation',           label:'Workout Deviation',            tr:'Antrenman Sapması',           group:'sessions'  },
  { id:'monotonyTrend',              label:'Monotony Trend',               tr:'Monotonluk Trendi',           group:'load'      },
  { id:'aerobicDecouplingTrend',     label:'Aerobic Decoupling Trend',     tr:'Aerobik Decoupling Trendi',   group:'analysis'  },
  { id:'efDecoupling',               label:'EF Decoupling',                tr:'EF Decoupling',               group:'analysis'  },
  { id:'overreachWatch',             label:'Overreach Watch',              tr:'Aşırı Yüklenme İzleme',       group:'recovery'  },
  { id:'ctlRampRate',                label:'CTL Ramp Rate',                tr:'CTL Artış Hızı',              group:'load'      },
  { id:'weeklyVolumeRamp',           label:'Weekly Volume Ramp',           tr:'Haftalık Hacim Artışı',       group:'load'      },
  { id:'weekendVolumeShare',         label:'Weekend Volume Share',         tr:'Hafta Sonu Hacim Payı',       group:'analysis'  },
  { id:'timeOfDayConsistency',       label:'Time-of-Day Consistency',      tr:'Günün Saati Tutarlılığı',     group:'analysis'  },
  { id:'longSessionShare',           label:'Long Session Share',           tr:'Uzun Antrenman Payı',         group:'analysis'  },
  { id:'runningCadenceTrend',        label:'Running Cadence Trend',        tr:'Koşu Kadansı Trendi',         group:'sport'     },
  { id:'tsbFreshnessBand',           label:'TSB Freshness Band',           tr:'TSB Tazelik Bandı',           group:'load'      },
  { id:'prTimeline',                 label:'PR Timeline',                  tr:'Rekor Zaman Çizelgesi',       group:'goals'     },
  { id:'loadProjector',              label:'Load Projector',               tr:'Yük Projeksiyonu',            group:'load'      },
  { id:'injuryPattern',              label:'Injury Pattern',               tr:'Sakatlık Deseni',             group:'recovery'  },
  { id:'vdotBenchmark',              label:'VDOT Benchmark',               tr:'VDOT Kıyaslaması',            group:'analysis'  },
  { id:'hrvAlert',                   label:'HRV Alert',                    tr:'HRV Uyarısı',                 group:'recovery'  },
  { id:'hrvAutonomicBalance',        label:'HRV Autonomic Balance',        tr:'HRV Otonom Dengesi',          group:'recovery'  },
  { id:'taperAdvisor',               label:'Taper Advisor',                tr:'Taper Danışmanı',             group:'goals'     },
  { id:'taperCompliance',            label:'Taper Compliance',             tr:'Taper Uyumu',                 group:'goals'     },
  { id:'priorityAction',             label:'Priority Action',              tr:'Öncelikli Eylem',             group:'core'      },
  { id:'cyclingZones',               label:'Cycling Zones',                tr:'Bisiklet Bölgeleri',          group:'sport'     },
  { id:'cyclingNpTrend',             label:'Cycling NP Trend',             tr:'Bisiklet NP Trendi',          group:'sport'     },
  { id:'swimmingZones',              label:'Swimming Zones',               tr:'Yüzme Bölgeleri',             group:'sport'     },
  { id:'swimSwolfTrend',             label:'Swim SWOLF Trend',             tr:'Yüzme SWOLF Trendi',          group:'sport'     },
  { id:'runningCv',                  label:'Running CV',                   tr:'Koşu CV',                     group:'sport'     },
  { id:'runningRaceReadiness',       label:'Running Race Readiness',       tr:'Koşu Yarış Hazırlığı',        group:'sport'     },
  { id:'fitnessBatteryProgress',     label:'Fitness Battery Progress',     tr:'Kondisyon Bataryası İlerlemesi', group:'load'   },
  { id:'triathlonLoad',              label:'Triathlon Load',               tr:'Triatlon Yükü',               group:'sport'     },
  { id:'triathlonWeekBalance',       label:'Triathlon Week Balance',       tr:'Triatlon Hafta Dengesi',      group:'sport'     },
  { id:'shareCard',                  label:'Share Card',                   tr:'Paylaşım Kartı',              group:'other'     },
  { id:'quickLinks',                 label:'Quick Links',                  tr:'Hızlı Bağlantılar',           group:'other'     },
]

export const TYPE_COLORS = {
  'Easy Run':'#4ade80','Tempo':'#facc15','Interval':'#ef4444','Long Run':'#22d3ee',
  'Recovery':'#a78bfa','Strength':'#f97316','Swim':'#94a3b8','Bike':'#60a5fa',
  'Cross-Train':'#94a3b8','Race':'#ff6600','Test':'#d946ef','Other':'#d4d4d4',
}
export function typeColor(t) { return TYPE_COLORS[t] || '#d4d4d4' }

export const CONSENT_VERSION = '1.1'

