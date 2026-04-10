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

export const TYPE_COLORS = {
  'Easy Run':'#4ade80','Tempo':'#facc15','Interval':'#ef4444','Long Run':'#22d3ee',
  'Recovery':'#a78bfa','Strength':'#f97316','Swim':'#94a3b8','Bike':'#60a5fa',
  'Cross-Train':'#94a3b8','Race':'#ff6600','Test':'#d946ef','Other':'#d4d4d4',
}
export function typeColor(t) { return TYPE_COLORS[t] || '#d4d4d4' }
