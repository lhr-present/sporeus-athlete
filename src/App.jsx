import { useState, useEffect, useCallback, useContext, createContext } from 'react'

// ─── Animation CSS (injected) ──────────────────────────────────────────────────
const ANIM_CSS = `
  @keyframes fadeIn  { from{opacity:0}to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
  .sp-fade { animation:fadeIn 200ms ease-out both }
  .sp-card { animation:slideUp 300ms ease-out both }
`

// ─── Hooks ─────────────────────────────────────────────────────────────────────
function useLocalStorage(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def }
  })
  const set = useCallback(v => {
    setVal(v); try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
  }, [key])
  return [val, set]
}

function useCountUp(target, duration = 600) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      setV(Math.round(target * p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

// ─── Language context ──────────────────────────────────────────────────────────
const LangCtx = createContext({ t: k => k, lang: 'en', setLang: () => {} })

const LABELS = {
  en: {
    appTitle: 'SPOREUS ATHLETE CONSOLE',
    appSub: 'BLOOMBERG TERMINAL FOR ENDURANCE ATHLETES',
    t_dashboard: 'DASHBOARD', t_zones: 'ZONE CALC', t_tests: 'PROTOCOLS',
    t_log: 'TRAINING LOG', t_macro: 'MACRO PLAN', t_glossary: 'GLOSSARY',
    t_recovery: 'RECOVERY', t_profile: 'PROFILE',
    readiness: 'READINESS STATUS', fresh: 'FRESH', trained: 'TRAINED', fatigued: 'FATIGUED',
    sessions: 'SESSIONS', volume: 'VOLUME', avgRpe: 'AVG RPE', tss7: '7-DAY TSS',
    recentSessions: 'RECENT SESSIONS', noSessions: 'No sessions logged yet. Use the Training Log tab.',
    quickLinks: 'QUICK LINKS',
    tssChartTitle: 'TRAINING LOAD \u2014 30 DAYS',
    ctlLabel: 'CTL (Fitness)', atlLabel: 'ATL (Fatigue)', tsbLabel: 'FORM (TSB)',
    noDataChart: 'Log sessions to see your training load trend.',
    zoneCalcTitle: 'ZONE CALCULATOR', hrMode: 'HEART RATE', pwrMode: 'POWER (W)', paceMode: 'RUN PACE',
    maxHRIn: 'MAX HEART RATE (bpm)', ageIn: 'AGE (Tanaka formula)', ftpIn: 'FTP (watts)',
    threshPaceIn: 'THRESHOLD PACE (MM:SS /km)',
    calcZonesBtn: 'CALCULATE ZONES', estMaxHR: 'Est. Max HR:',
    racePredTitle: 'RACE PREDICTOR (RIEGEL FORMULA)',
    raceDistLabel: 'RECENT RACE DISTANCE', raceTimeLabel: 'FINISH TIME (mm:ss or hh:mm:ss)',
    predictBtn: 'PREDICT TIMES', predsTitle: 'PREDICTIONS',
    distCol: 'DISTANCE', timeCol: 'TIME', paceCol: 'PACE /km',
    selectProto: 'SELECT PROTOCOL', calcBtn: 'CALCULATE', viewBtn: 'VIEW PROTOCOL',
    logTitle: 'LOG SESSION', dateL: 'DATE', typeL: 'SESSION TYPE',
    durL: 'DURATION (min)', rpeL: 'RPE (1\u201310)', notesL: 'NOTES (optional)',
    addBtn: '+ ADD SESSION', previewTSSBtn: 'PREVIEW TSS',
    sessionHistTitle: 'SESSION HISTORY', noSessionsYet: 'No sessions logged yet.',
    exportCSVBtn: 'EXPORT CSV',
    macroCycleTitle: '13-WEEK MACROCYCLE PLANNER', raceDateL: 'TARGET RACE DATE',
    weekHoursL: 'CURRENT WEEKLY HOURS', startDateLbl: 'Start date:',
    zoneLegendTitle: 'ZONE DISTRIBUTION LEGEND', weekBreakTitle: 'WEEKLY BREAKDOWN',
    glossTitle: 'SPORTS SCIENCE GLOSSARY', searchPlaceholder: 'Search terms\u2026',
    loadingTerms: 'Loading from sporeus.com\u2026',
    apiTermsLabel: 'Live from sporeus.com', localTermsLabel: 'Local terms',
    readMoreLink: 'Read more on sporeus.com \u2192',
    wellnessTitle: 'DAILY WELLNESS CHECK', sleepQL: 'SLEEP QUALITY',
    sorenessL: 'MUSCLE SORENESS', energyL: 'ENERGY LEVEL', moodL: 'MOOD', stressL: 'STRESS',
    readScoreTitle: 'READINESS SCORE',
    goLabel: 'GO', monitorLabel: 'MONITOR', restLabel: 'REST',
    saveEntryBtn: 'SAVE', hist7Title: '7-DAY HISTORY',
    alreadyLoggedMsg: 'Today\u2019s entry saved. Update below.',
    profileTitle: 'ATHLETE PROFILE', saveProfileBtn: 'SAVE PROFILE', savedMsg: '\u2713 SAVED',
    shareBtn: 'SHARE PROFILE', copiedMsg: '\u2713 COPIED',
    aboutTitle: 'ABOUT SPOREUS ATHLETE CONSOLE', installTitle: 'INSTALL AS APP',
    nameL: 'NAME', ageL: 'AGE', weightL: 'WEIGHT (kg)', sportL: 'PRIMARY SPORT',
    ftpL: 'FTP (watts)', vo2L: 'VO\u2082max (mL/kg/min)', threshPaceL: 'THRESHOLD PACE (/km)',
    goalL: 'SEASON GOAL',
  },
  tr: {
    appTitle: 'SPOREUS SPORCU KONSOLU',
    appSub: 'DAYANIKLILIK SPORCULARI \u0130\u00c7\u0130N BLOOMBERG TERM\u0130NAL',
    t_dashboard: 'PANO', t_zones: 'ZON HESAP', t_tests: 'PROTOKOLLER',
    t_log: 'ANTRENMAN LOG', t_macro: 'MAKRO PLAN', t_glossary: 'S\u00d6ZL\u00dcK',
    t_recovery: 'TOPARLANMA', t_profile: 'PROF\u0130L',
    readiness: 'HAZIRLIK DURUMU', fresh: 'D\u0130NLENM\u0130\u015e', trained: 'ANTRENMANLI', fatigued: 'YORGUN',
    sessions: 'ANTRENMAN', volume: 'HAC\u0130M', avgRpe: 'ORT. ZY', tss7: '7 G\u00dcNL\u00dcK TSS',
    recentSessions: 'SON ANTRENMANLAR',
    noSessions: 'Hen\u00fcz antrenman kaydedilmedi. Antrenman Log sekmesini kullan\u0131n.',
    quickLinks: 'HIZLI BA\u011eLANTILAR',
    tssChartTitle: 'ANTRENMAN Y\u00dcK\u00dc \u2014 30 G\u00dcN',
    ctlLabel: 'KTY (Kondisyon)', atlLabel: 'ATY (Yorgunluk)', tsbLabel: 'FORM (TSB)',
    noDataChart: 'Antrenman y\u00fck\u00fc trendini g\u00f6rmek i\u00e7in seans kaydedin.',
    zoneCalcTitle: 'ZON HESAPLAYICI', hrMode: 'KALP ATI\u015eI', pwrMode: 'G\u00dc\u00c7 (W)', paceMode: 'KO\u015eU TEMPOSU',
    maxHRIn: 'MAKS. KALP ATI\u015eI (at\u0131m/dak)', ageIn: 'YA\u015e (Tanaka form\u00fcl\u00fc)', ftpIn: 'FTP (watt)',
    threshPaceIn: 'E\u015e\u0130K TEMPOSU (DD:SS /km)',
    calcZonesBtn: 'ZONLARI HESAPLA', estMaxHR: 'Tahmini Maks HR:',
    racePredTitle: 'YARI\u015e TAHM\u0130NC\u0130S\u0130 (RIEGEL FORM\u00dcL\u00dc)',
    raceDistLabel: 'SON YARI\u015e MESAFES\u0130', raceTimeLabel: 'B\u0130T\u0130\u015e S\u00dcRES\u0130 (dd:ss veya ss:dd:ss)',
    predictBtn: 'TAHM\u0130N ET', predsTitle: 'TAHM\u0130NLER',
    distCol: 'MESAFE', timeCol: 'S\u00dcRE', paceCol: 'TEMPO /km',
    selectProto: 'PROTOKOL SE\u00c7', calcBtn: 'HESAPLA', viewBtn: 'PROTOKOL\u00dc G\u00d6R',
    logTitle: 'ANTRENMAN KAYDET', dateL: 'TAR\u0130H', typeL: 'ANTRENMAN T\u00dcR\u00dc',
    durL: 'S\u00dcRE (dak)', rpeL: 'ZY (1\u201310)', notesL: 'NOT (opsiyonel)',
    addBtn: '+ EKLE', previewTSSBtn: 'TSS \u00d6N\u0130ZLEME',
    sessionHistTitle: 'ANTRENMAN GE\u00c7M\u0130\u015e\u0130', noSessionsYet: 'Hen\u00fcz antrenman kayd\u0131 yok.',
    exportCSVBtn: 'CSV \u0130ND\u0130R',
    macroCycleTitle: '13 HAFTALIK MAKRO PLAN', raceDateL: 'HEDEF YARI\u015e TAR\u0130H\u0130',
    weekHoursL: 'HAFTALIK MEVCUT SAAT', startDateLbl: 'Ba\u015flang\u0131\u00e7 tarihi:',
    zoneLegendTitle: 'ZON DA\u011eILIMI A\u00c7IKLAMASI', weekBreakTitle: 'HAFTALIK D\u00d6K\u00dcM',
    glossTitle: 'SPOR B\u0130L\u0130M\u0130 S\u00d6ZL\u00dc\u011e\u00dc', searchPlaceholder: 'Terim ara\u2026',
    loadingTerms: 'sporeus.com\u2019dan y\u00fckleniyor\u2026',
    apiTermsLabel: 'sporeus.com\u2019dan canl\u0131', localTermsLabel: 'Yerel terimler',
    readMoreLink: 'sporeus.com\u2019da devam\u0131n\u0131 oku \u2192',
    wellnessTitle: 'G\u00dcNL\u00dcK SA\u011eLIK KONTROL\u00dc', sleepQL: 'UYKU KAL\u0130TES\u0130',
    sorenessL: 'KAS A\u011eRISI', energyL: 'ENERJ\u0130 SEV\u0130YES\u0130', moodL: 'RUH HAL\u0130', stressL: 'STRES',
    readScoreTitle: 'HAZIRLIK SKORU',
    goLabel: 'G\u0130T', monitorLabel: '\u0130ZLE', restLabel: 'D\u0130NLEN',
    saveEntryBtn: 'KAYDET', hist7Title: '7 G\u00dcNL\u00dcK GE\u00c7M\u0130\u015e',
    alreadyLoggedMsg: 'Bug\u00fcnk\u00fc giri\u015f kaydedildi. G\u00fcncellemek i\u00e7in a\u015fa\u011f\u0131y\u0131 kullan\u0131n.',
    profileTitle: 'SPORCU PROF\u0130L\u0130', saveProfileBtn: 'PROF\u0130L\u0130 KAYDET', savedMsg: '\u2713 KAYDED\u0130LD\u0130',
    shareBtn: 'PROF\u0130L\u0130 PAYLA\u015e', copiedMsg: '\u2713 KOPYALANDI',
    aboutTitle: 'UYGULAMA HAKKINDA', installTitle: 'UYGULAMA OLARAK Y\u00dcKLE',
    nameL: 'AD SOYAD', ageL: 'YA\u015e', weightL: 'K\u0130LO (kg)', sportL: 'ANA SPOR',
    ftpL: 'FTP (watt)', vo2L: 'VO\u2082maks (mL/kg/dak)', threshPaceL: 'E\u015e\u0130K TEMPOSU (/km)',
    goalL: 'SEZON HEDEF\u0130',
  }
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',     icon: '\u25c8', lk: 't_dashboard' },
  { id: 'zones',         icon: '\u25c9', lk: 't_zones' },
  { id: 'tests',         icon: '\u25b2', lk: 't_tests' },
  { id: 'log',           icon: '\u2261', lk: 't_log' },
  { id: 'periodization', icon: '\u229e', lk: 't_macro' },
  { id: 'glossary',      icon: '\u25c7', lk: 't_glossary' },
  { id: 'recovery',      icon: '\u2661', lk: 't_recovery' },
  { id: 'profile',       icon: '\u25cb', lk: 't_profile' },
]

// ─── Constants ─────────────────────────────────────────────────────────────────
const ZONE_COLORS = ['#4a90d9','#5bc25b','#f5c542','#f08c00','#e03030']
const ZONE_NAMES  = ['Z1 Recovery','Z2 Aerobic','Z3 Tempo','Z4 Threshold','Z5 VO\u2082max']
const SESSION_TYPES = ['Easy Run','Tempo','Interval','Long Run','Recovery','Strength','Swim','Bike','Race','Test']
const LOAD_COLOR = { Low:'#5bc25b', Med:'#f5c542', High:'#e03030' }
const RACE_DISTANCES = [
  { label:'1500 m', m:1500 }, { label:'1 mile', m:1609 }, { label:'3 km', m:3000 },
  { label:'5 km', m:5000 }, { label:'10 km', m:10000 }, { label:'Half Marathon', m:21097 },
  { label:'Marathon', m:42195 }, { label:'Custom', m:0 },
]
const WELLNESS_FIELDS = [
  { key:'sleep',    emoji:['😴','😪','😐','😊','😁'], lk:'sleepQL' },
  { key:'soreness', emoji:['😩','😕','😐','🙂','💪'], lk:'sorenessL' },
  { key:'energy',   emoji:['🪫','😓','😐','⚡','🔥'], lk:'energyL' },
  { key:'mood',     emoji:['😞','😕','😐','🙂','😁'], lk:'moodL' },
  { key:'stress',   emoji:['😤','😟','😐','😌','🧘'], lk:'stressL' },
]

const GLOSSARY_TERMS = [
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

const MACRO_PHASES = [
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

// ─── Math helpers ──────────────────────────────────────────────────────────────
const hrZones    = maxHR => [[.50,.60],[.60,.70],[.70,.80],[.80,.90],[.90,1.00]].map(([lo,hi],i) => ({ name:ZONE_NAMES[i], low:Math.round(maxHR*lo), high:Math.round(maxHR*hi), color:ZONE_COLORS[i] }))
const powerZones = ftp   => [[.55,.74],[.75,.89],[.90,1.04],[1.05,1.20],[1.21,1.50]].map(([lo,hi],i) => ({ name:ZONE_NAMES[i], low:Math.round(ftp*lo), high:Math.round(ftp*hi), color:ZONE_COLORS[i] }))
const paceZones  = t0    => [1.30,1.15,1.06,1.00,0.92].map((f,i) => { const p=t0*f,m=Math.floor(p),s=Math.round((p-m)*60); return { name:ZONE_NAMES[i], pace:`${m}:${String(s).padStart(2,'0')} /km`, color:ZONE_COLORS[i] } })
const calcTSS    = (dur, rpe) => Math.round((dur/60)*Math.pow((rpe/10)*1.05,2)*100)
const cooperVO2  = d  => ((d-504.9)/44.73).toFixed(1)
const rampFTP    = w  => Math.round(w*0.75)
const ftpFrom20  = w  => Math.round(w*0.95)
const epley1RM   = (w,r) => (w*(1+r/30)).toFixed(1)
const astrandVO2 = (watts, bw, gender) => ((watts*(gender==='female'?5.88:6.12)/bw)+3.5).toFixed(1)
const yyir1VO2   = (lv, sh) => (35.4 + ((lv-1)+(sh/8))*(62.8-35.4)/22).toFixed(1)
const wingateStats = (peak, mean, low, bw) => ({ relPeak:(peak/bw).toFixed(1), relMean:(mean/bw).toFixed(1), fatigue:(((peak-low)/peak)*100).toFixed(1) })
const riegel     = (t1, d1, d2) => t1 * Math.pow(d2/d1, 1.06)

function parseTimeSec(str) {
  const p = str.split(':').map(Number)
  if (p.length===3) return p[0]*3600+p[1]*60+p[2]
  if (p.length===2) return p[0]*60+p[1]
  return NaN
}
function fmtSec(s) {
  s = Math.round(s)
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60
  if (h>0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}
function fmtPace(totalSec, distM) {
  const pps = totalSec/(distM/1000)
  const m=Math.floor(pps/60), s=Math.round(pps%60)
  return `${m}:${String(s).padStart(2,'0')}`
}

// ─── Training load (EMA) ───────────────────────────────────────────────────────
function calcLoad(log) {
  if (!log.length) return { atl:0, ctl:0, tsb:0, daily:[] }
  const byDate = {}
  log.forEach(e => { byDate[e.date] = (byDate[e.date]||0)+(e.tss||0) })
  const dates=[], start=new Date(Object.keys(byDate).sort()[0]), today=new Date()
  today.setHours(0,0,0,0)
  for (let d=new Date(start); d<=today; d.setDate(d.getDate()+1)) {
    const ds=d.toISOString().slice(0,10)
    dates.push({ date:ds, tss:byDate[ds]||0 })
  }
  let atl=0, ctl=0
  const kA=2/(7+1), kC=2/(42+1)
  const all = dates.map(({date,tss}) => {
    atl=tss*kA+atl*(1-kA); ctl=tss*kC+ctl*(1-kC)
    return { date, tss, atl:Math.round(atl), ctl:Math.round(ctl) }
  })
  const last=all[all.length-1]||{atl:0,ctl:0}
  return { atl:Math.round(last.atl), ctl:Math.round(last.ctl), tsb:Math.round(last.ctl-last.atl), daily:all.slice(-30) }
}

// ─── API cache ─────────────────────────────────────────────────────────────────
const API_KEY='sporeus-api-cache', API_TTL=864e5
function getApiCache() { try { const c=JSON.parse(localStorage.getItem(API_KEY)); if(c&&Date.now()-c.ts<API_TTL) return c.data } catch {} return null }
function setApiCache(d) { try { localStorage.setItem(API_KEY,JSON.stringify({ts:Date.now(),data:d})) } catch {} }

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app: { fontFamily:"'IBM Plex Sans',system-ui,sans-serif", backgroundColor:'#fff', color:'#1a1a1a', minHeight:'100vh', maxWidth:'900px', margin:'0 auto', paddingTop:'3px' },
  topBar: { height:'3px', background:'#ff6600', position:'fixed', top:0, left:0, right:0, zIndex:9999 },
  header: { background:'#0a0a0a', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #ff6600' },
  headerTitle: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', fontWeight:600, letterSpacing:'0.12em', color:'#ff6600' },
  headerSub: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', letterSpacing:'0.06em' },
  navWrap: { background:'#0a0a0a', overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none', borderBottom:'2px solid #222' },
  nav: { display:'flex', minWidth:'max-content' },
  navBtn: a => ({ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', fontWeight:600, letterSpacing:'0.08em', padding:'10px 13px', border:'none', cursor:'pointer', background:a?'#ff6600':'transparent', color:a?'#fff':'#888', borderBottom:a?'2px solid #ff6600':'2px solid transparent', transition:'all 0.15s', whiteSpace:'nowrap' }),
  content: { padding:'20px' },
  card: { background:'#f8f8f8', border:'1px solid #e0e0e0', borderRadius:'6px', padding:'16px', marginBottom:'16px' },
  cardTitle: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#888', marginBottom:'12px', borderBottom:'1px solid #e0e0e0', paddingBottom:'8px' },
  row: { display:'flex', gap:'12px', flexWrap:'wrap' },
  label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'#666', marginBottom:'4px', display:'block' },
  input: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', padding:'8px 12px', border:'1px solid #ccc', borderRadius:'4px', width:'100%', boxSizing:'border-box', background:'#fff', color:'#1a1a1a' },
  select: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', padding:'8px 12px', border:'1px solid #ccc', borderRadius:'4px', width:'100%', boxSizing:'border-box', background:'#fff', color:'#1a1a1a', cursor:'pointer' },
  btn: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', padding:'10px 18px', background:'#ff6600', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer' },
  btnSec: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'12px', fontWeight:600, padding:'8px 14px', background:'transparent', color:'#ff6600', border:'1px solid #ff6600', borderRadius:'4px', cursor:'pointer' },
  stat: { flex:'1 1 110px', background:'#0a0a0a', borderRadius:'6px', padding:'14px', textAlign:'center' },
  statVal: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'22px', fontWeight:600, color:'#ff6600', display:'block' },
  statLbl: { fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#888', letterSpacing:'0.1em', textTransform:'uppercase' },
  tag: c => ({ display:'inline-block', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'3px', background:c+'22', color:c, border:`1px solid ${c}44` }),
  mono: { fontFamily:"'IBM Plex Mono',monospace" },
  footer: { textAlign:'center', padding:'20px', borderTop:'1px solid #e0e0e0', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#aaa', letterSpacing:'0.06em' },
}

// ─── ZoneBar ───────────────────────────────────────────────────────────────────
function ZoneBar({ pct, color }) {
  const [w, setW] = useState(0)
  useEffect(() => { const id=setTimeout(()=>setW(pct),60); return ()=>clearTimeout(id) }, [pct])
  return (
    <div style={{ background:'#e8e8e8', height:'8px', borderRadius:'2px', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${w}%`, background:color, borderRadius:'2px', transition:'width 400ms ease-out' }} />
    </div>
  )
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, w=120, h=30 }) {
  if (!data.length) return <span style={{ ...S.mono, fontSize:'10px', color:'#ccc' }}>\u2014</span>
  const max=Math.max(...data,1), step=w/Math.max(data.length-1,1)
  const pts=data.map((v,i)=>`${i*step},${h-(v/max)*(h-4)-2}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:w, height:h }}>
      <polyline points={pts} fill="none" stroke="#ff6600" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ─── TSS Chart (30-day SVG) ────────────────────────────────────────────────────
function TSSChart({ daily, t }) {
  if (!daily.length) return (
    <div style={{ textAlign:'center', padding:'30px 0', ...S.mono, fontSize:'12px', color:'#bbb' }}>{t('noDataChart')}</div>
  )
  const W=560, H=110, P={t:10,r:10,b:22,l:34}
  const iW=W-P.l-P.r, iH=H-P.t-P.b
  const maxV=Math.max(...daily.flatMap(d=>[d.tss,d.atl,d.ctl]),1)
  const yMax=Math.ceil(maxV/50)*50
  const xS=i=>P.l+(i/(daily.length-1))*iW
  const yS=v=>P.t+iH-(v/yMax)*iH

  const lineD=pts=>pts.map((v,i)=>`${i===0?'M':'L'}${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ')
  const areaD=daily.map((d,i)=>`${i===0?'M':'L'}${xS(i).toFixed(1)},${yS(d.tss).toFixed(1)}`).join(' ')+
    ` L${xS(daily.length-1).toFixed(1)},${(P.t+iH).toFixed(1)} L${P.l},${(P.t+iH).toFixed(1)} Z`

  const yTicks=[0,.5,1].map(f=>Math.round(yMax*f))
  const xLabels=daily.filter((_,i)=>i===0||i===6||i===13||i===20||i===daily.length-1)
    .map(d=>({ label:d.date.slice(5), i:daily.indexOf(d) }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto' }}>
      {yTicks.map(v=>(
        <g key={v}>
          <line x1={P.l} x2={W-P.r} y1={yS(v)} y2={yS(v)} stroke="#ebebeb" strokeWidth="1"/>
          <text x={P.l-3} y={yS(v)+3} textAnchor="end" fill="#bbb" fontSize="8" fontFamily="IBM Plex Mono,monospace">{v}</text>
        </g>
      ))}
      <path d={areaD} fill="#ff660018" />
      <path d={lineD(daily.map(d=>d.tss))} fill="none" stroke="#ff6600" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d={lineD(daily.map(d=>d.ctl))} fill="none" stroke="#0064ff" strokeWidth="1.5" strokeDasharray="4,2"/>
      <path d={lineD(daily.map(d=>d.atl))} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2"/>
      {xLabels.map(({label,i})=>(
        <text key={i} x={xS(i)} y={H-4} textAnchor="middle" fill="#bbb" fontSize="8" fontFamily="IBM Plex Mono,monospace">{label}</text>
      ))}
      <rect x={P.l+2} y={P.t} width="7" height="7" fill="#ff6600" rx="1"/>
      <text x={P.l+12} y={P.t+6} fill="#999" fontSize="8" fontFamily="IBM Plex Mono,monospace">TSS</text>
      <line x1={P.l+42} x2={P.l+50} y1={P.t+3} y2={P.t+3} stroke="#0064ff" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x={P.l+53} y={P.t+6} fill="#999" fontSize="8" fontFamily="IBM Plex Mono,monospace">CTL</text>
      <line x1={P.l+80} x2={P.l+88} y1={P.t+3} y2={P.t+3} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2"/>
      <text x={P.l+91} y={P.t+6} fill="#999" fontSize="8" fontFamily="IBM Plex Mono,monospace">ATL</text>
    </svg>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ log, profile }) {
  const { t } = useContext(LangCtx)
  const last7 = log.slice(-7)
  const totalTSS = last7.reduce((s,e)=>s+(e.tss||0),0)
  const totalMin = last7.reduce((s,e)=>s+(e.duration||0),0)
  const avgRPE   = last7.length ? (last7.reduce((s,e)=>s+(e.rpe||0),0)/last7.length).toFixed(1) : '\u2014'
  const { atl, ctl, tsb, daily } = calcLoad(log)
  const readiness = totalTSS>600?{label:t('fatigued'),color:'#e03030'}:totalTSS>400?{label:t('trained'),color:'#f5c542'}:{label:t('fresh'),color:'#5bc25b'}
  const tsbColor = tsb>5?'#5bc25b':tsb<-10?'#e03030':'#f5c542'
  const countSess = useCountUp(last7.length)
  const countTSS  = useCountUp(totalTSS)
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()

  return (
    <div className="sp-fade">
      <div style={{ marginBottom:'16px' }}>
        <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginBottom:'4px' }}>{today}</div>
        <div style={{ ...S.mono, fontSize:'18px', fontWeight:600 }}>
          {profile.name ? `ATHLETE: ${profile.name.toUpperCase()}` : t('appTitle')}
        </div>
      </div>

      <div className="sp-card" style={{ ...S.card, borderLeft:`4px solid ${readiness.color}`, animationDelay:'0ms' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={S.cardTitle}>{t('readiness')}</div>
            <span style={S.tag(readiness.color)}>{readiness.label}</span>
            <div style={{ display:'flex', gap:'16px', marginTop:'10px' }}>
              {[{lbl:t('ctlLabel'),v:ctl,c:'#0064ff'},{lbl:t('atlLabel'),v:atl,c:'#ef4444'},{lbl:t('tsbLabel'),v:(tsb>=0?'+':'')+tsb,c:tsbColor}].map(({lbl,v,c})=>(
                <div key={lbl}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.08em' }}>{lbl}</div>
                  <div style={{ ...S.mono, fontSize:'16px', fontWeight:600, color:c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...S.mono, fontSize:'40px', fontWeight:600, color:readiness.color }}>{countTSS}</div>
        </div>
      </div>

      <div className="sp-card" style={{ ...S.row, marginBottom:'16px', animationDelay:'50ms' }}>
        {[
          { val:countSess,                              lbl:t('sessions') },
          { val:`${Math.floor(totalMin/60)}h ${totalMin%60}m`, lbl:t('volume') },
          { val:avgRPE,                                 lbl:t('avgRpe') },
          { val:totalTSS,                               lbl:t('tss7') },
        ].map(({val,lbl})=>(
          <div key={lbl} style={S.stat}>
            <span style={S.statVal}>{val}</span>
            <span style={S.statLbl}>{lbl}</span>
          </div>
        ))}
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
        <div style={S.cardTitle}>{t('tssChartTitle')}</div>
        <TSSChart daily={daily} t={t} />
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'150ms' }}>
        <div style={S.cardTitle}>{t('recentSessions')}</div>
        {last7.length===0 ? (
          <div style={{ ...S.mono, fontSize:'12px', color:'#aaa', textAlign:'center', padding:'20px 0' }}>{t('noSessions')}</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #e0e0e0', color:'#888', fontSize:'10px', letterSpacing:'0.06em' }}>
                {[t('dateL'),'TYPE','MIN','RPE','TSS'].map(h=>(
                  <th key={h} style={{ textAlign:h==='TSS'||h==='MIN'||h==='RPE'?'right':'left', padding:'4px 6px 8px 0', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...last7].reverse().map((s,i)=>(
                <tr key={i} style={{ borderBottom:'1px solid #f0f0f0' }}>
                  <td style={{ padding:'6px 6px 6px 0', color:'#666' }}>{s.date}</td>
                  <td style={{ padding:'6px 6px 6px 0' }}>{s.type}</td>
                  <td style={{ textAlign:'right', padding:'6px 6px 6px 0' }}>{s.duration}</td>
                  <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:s.rpe>=8?'#e03030':s.rpe>=6?'#f5c542':'#5bc25b' }}>{s.rpe}</td>
                  <td style={{ textAlign:'right', padding:'6px 0', color:'#ff6600', fontWeight:600 }}>{s.tss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'200ms' }}>
        <div style={S.cardTitle}>{t('quickLinks')}</div>
        <div style={S.row}>
          {[
            ['sporeus.com','https://sporeus.com'],
            ['EŞİK Kitabı','https://sporeus.com/esik/'],
            ['Hesaplayıcılar','https://sporeus.com/hesaplayicilar/'],
            ['THRESHOLD Book','https://sporeus.com/en/threshold/'],
          ].map(([label,href])=>(
            <a key={label} href={href} target="_blank" rel="noreferrer"
              style={{ ...S.mono, fontSize:'12px', color:'#0064ff', textDecoration:'none', padding:'4px 0' }}>
              \u2192 {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Zone Calculator + Race Predictor ─────────────────────────────────────────
function ZoneCalc() {
  const { t } = useContext(LangCtx)
  const [mode, setMode] = useState('hr')
  const [maxHR, setMaxHR] = useState('')
  const [ftp, setFtp] = useState('')
  const [threshPace, setThreshPace] = useState('')
  const [age, setAge] = useState('')
  const [zones, setZones] = useState([])
  const [rDist, setRDist] = useState('5000')
  const [rDistCustom, setRDistCustom] = useState('')
  const [rTime, setRTime] = useState('')
  const [preds, setPreds] = useState(null)

  const estHR = age ? Math.round(208-0.7*parseInt(age)) : null

  const calcZones = () => {
    if (mode==='hr') {
      const hr=parseInt(maxHR)||estHR; if(hr) setZones(hrZones(hr))
    } else if (mode==='power') {
      const f=parseInt(ftp); if(f) setZones(powerZones(f))
    } else {
      const [m,s]=threshPace.split(':').map(Number)
      if (!isNaN(m)) setZones(paceZones(m+(s||0)/60))
    }
  }

  const predict = () => {
    const d1=rDist==='custom'?parseInt(rDistCustom):parseInt(rDist)
    const t1=parseTimeSec(rTime)
    if (!d1||isNaN(t1)) return
    const targets=[{label:'5 km',m:5000},{label:'10 km',m:10000},{label:'Half Marathon',m:21097},{label:'Marathon',m:42195}]
    setPreds(targets.map(({label,m})=>({ label, time:fmtSec(riegel(t1,d1,m)), pace:fmtPace(riegel(t1,d1,m),m) })))
  }

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('zoneCalcTitle')}</div>
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
          {[['hr',t('hrMode')],['power',t('pwrMode')],['pace',t('paceMode')]].map(([id,lbl])=>(
            <button key={id} onClick={()=>{setMode(id);setZones([])}} style={{ ...S.navBtn(mode===id), borderRadius:'4px' }}>{lbl}</button>
          ))}
        </div>
        {mode==='hr' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 160px' }}>
              <label style={S.label}>{t('maxHRIn')}</label>
              <input style={S.input} type="number" placeholder="185" value={maxHR} onChange={e=>setMaxHR(e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 140px' }}>
              <label style={S.label}>{t('ageIn')}</label>
              <input style={S.input} type="number" placeholder="32" value={age} onChange={e=>setAge(e.target.value)}/>
              {estHR&&!maxHR&&<div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'4px' }}>{t('estMaxHR')} {estHR}</div>}
            </div>
          </div>
        )}
        {mode==='power' && (
          <div style={{ flex:'1 1 200px' }}>
            <label style={S.label}>{t('ftpIn')}</label>
            <input style={S.input} type="number" placeholder="280" value={ftp} onChange={e=>setFtp(e.target.value)}/>
          </div>
        )}
        {mode==='pace' && (
          <div style={{ flex:'1 1 200px' }}>
            <label style={S.label}>{t('threshPaceIn')}</label>
            <input style={S.input} type="text" placeholder="4:45" value={threshPace} onChange={e=>setThreshPace(e.target.value)}/>
          </div>
        )}
        <button style={{ ...S.btn, marginTop:'14px' }} onClick={calcZones}>{t('calcZonesBtn')}</button>
      </div>

      {zones.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
          <div style={S.cardTitle}>{mode==='hr'?t('hrMode'):mode==='power'?t('pwrMode'):t('paceMode')} ZONES</div>
          {zones.map((z,i)=>(
            <div key={i} style={{ marginBottom:'14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                <span style={{ ...S.mono, fontSize:'12px', fontWeight:600, color:z.color }}>{z.name}</span>
                <span style={{ ...S.mono, fontSize:'13px', fontWeight:600 }}>{z.pace||`${z.low}\u2013${z.high} ${mode==='hr'?'bpm':'W'}`}</span>
              </div>
              <ZoneBar pct={(i+1)*20} color={z.color}/>
            </div>
          ))}
          <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'8px' }}>Coggan (power) \u00b7 Tanaka/Karvonen (HR) \u00b7 McMillan (pace)</div>
        </div>
      )}

      <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
        <div style={S.cardTitle}>{t('racePredTitle')}</div>
        <div style={S.row}>
          <div style={{ flex:'1 1 180px' }}>
            <label style={S.label}>{t('raceDistLabel')}</label>
            <select style={S.select} value={rDist} onChange={e=>setRDist(e.target.value)}>
              {RACE_DISTANCES.map(d=>(
                <option key={d.label} value={d.m===0?'custom':String(d.m)}>{d.label}</option>
              ))}
            </select>
          </div>
          {rDist==='custom' && (
            <div style={{ flex:'1 1 130px' }}>
              <label style={S.label}>CUSTOM (meters)</label>
              <input style={S.input} type="number" placeholder="8000" value={rDistCustom} onChange={e=>setRDistCustom(e.target.value)}/>
            </div>
          )}
          <div style={{ flex:'1 1 180px' }}>
            <label style={S.label}>{t('raceTimeLabel')}</label>
            <input style={S.input} type="text" placeholder="22:30" value={rTime} onChange={e=>setRTime(e.target.value)}/>
          </div>
        </div>
        <button style={{ ...S.btn, marginTop:'14px' }} onClick={predict}>{t('predictBtn')}</button>
      </div>

      {preds && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'150ms' }}>
          <div style={S.cardTitle}>{t('predsTitle')}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'13px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid #e0e0e0', color:'#888', fontSize:'10px', letterSpacing:'0.08em' }}>
                <th style={{ textAlign:'left', padding:'4px 0 8px', fontWeight:600 }}>{t('distCol')}</th>
                <th style={{ textAlign:'right', padding:'4px 0 8px', fontWeight:600 }}>{t('timeCol')}</th>
                <th style={{ textAlign:'right', padding:'4px 0 8px', fontWeight:600 }}>{t('paceCol')}</th>
              </tr>
            </thead>
            <tbody>
              {preds.map(p=>(
                <tr key={p.label} style={{ borderBottom:'1px solid #f0f0f0' }}>
                  <td style={{ padding:'8px 0', fontWeight:600 }}>{p.label}</td>
                  <td style={{ textAlign:'right', padding:'8px 0', color:'#ff6600', fontWeight:600 }}>{p.time}</td>
                  <td style={{ textAlign:'right', padding:'8px 0', color:'#666' }}>{p.pace}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'8px' }}>Riegel (1977): T2 = T1 \u00d7 (D2/D1)^1.06</div>
        </div>
      )}
    </div>
  )
}

// ─── Test Protocols (10 tests) ─────────────────────────────────────────────────
const TESTS = [
  { id:'cooper',  label:'COOPER 12-MIN',   sport:'Run',       needsCalc:true },
  { id:'ramp',    label:'RAMP TEST',       sport:'Bike',      needsCalc:true },
  { id:'ftp20',   label:'20-MIN FTP',      sport:'Bike',      needsCalc:true },
  { id:'beep',    label:'BEEP TEST',       sport:'Run',       needsCalc:true },
  { id:'yyir1',   label:'YYIR1',           sport:'Run',       needsCalc:true },
  { id:'wingate', label:'WINGATE 30s',     sport:'Bike/Lab',  needsCalc:true },
  { id:'oneRM',   label:'1RM EPLEY',       sport:'Strength',  needsCalc:true },
  { id:'astrand', label:'ÅSTRAND BIKE',    sport:'Bike/Lab',  needsCalc:true },
  { id:'conconi', label:'CONCONI',         sport:'Run/Bike',  needsCalc:false },
  { id:'lactate', label:'BLOOD LACTATE',   sport:'Lab',       needsCalc:false },
]

function TestProtocols() {
  const { t } = useContext(LangCtx)
  const [active, setActive] = useState('cooper')
  const [inputs, setInputs] = useState({})
  const [result, setResult] = useState(null)
  const set = (k,v) => setInputs(prev=>({...prev,[k]:v}))
  const v = k => inputs[k]||''

  const run = () => {
    setResult(null)
    const i = inputs
    if (active==='cooper') {
      const d=parseInt(i.dist||0); if(!d) return
      const vo2=cooperVO2(d)
      setResult(['Cooper Test Result',`Distance: ${d}m`,`Estimated VO\u2082max: ${vo2} mL/kg/min`,`${parseFloat(vo2)>=52?'Excellent':parseFloat(vo2)>=46?'Good':parseFloat(vo2)>=40?'Average':'Below Average'}`,`Run at maximum effort on flat surface.`])
    } else if (active==='ramp') {
      const w=parseInt(i.watts||0); if(!w) return
      const ftp=rampFTP(w)
      setResult(['Ramp Test Result',`Final step: ${w}W`,`Estimated FTP: ${ftp}W (75% of peak)`,`Recommended Z4: ${Math.round(ftp*.91)}\u2013${Math.round(ftp*1.05)}W`])
    } else if (active==='ftp20') {
      const w=parseInt(i.avg20||0); if(!w) return
      const ftp=ftpFrom20(w)
      setResult(['20-Min FTP Result',`20-min average: ${w}W`,`FTP = ${w} \u00d7 0.95 = ${ftp}W`,`Recommended to do after 5-min all-out opener.`])
    } else if (active==='beep') {
      const lv=parseFloat(i.beepLevel||0); if(!lv) return
      const vo2=(lv*3.46+12.2).toFixed(1)
      setResult(['Beep Test Result',`Level: ${i.beepLevel}`,`Estimated VO\u2082max: ${vo2} mL/kg/min`,`${parseFloat(vo2)>=55?'Excellent':parseFloat(vo2)>=48?'Good':parseFloat(vo2)>=40?'Average':'Below Average'}`])
    } else if (active==='yyir1') {
      const lv=parseInt(i.yyLevel||0), sh=parseInt(i.yyShuttle||0); if(!lv) return
      const vo2=yyir1VO2(lv,sh)
      setResult(['YYIR1 Result',`Level ${lv}, Shuttle ${sh}`,`Estimated VO\u2082max: ${vo2} mL/kg/min`,`YYIR1 range: Level 1 (~35 mL/kg/min) to Level 23 (~63 mL/kg/min)`])
    } else if (active==='wingate') {
      const peak=parseInt(i.peak||0), mean=parseInt(i.mean||0), low=parseInt(i.lowPow||0), bw=parseFloat(i.bw||0)
      if(!peak||!bw) return
      const r=wingateStats(peak,mean||peak,low||Math.round(peak*.6),bw)
      setResult(['Wingate Result',`Peak power: ${peak}W \u2192 ${r.relPeak} W/kg`,`Mean power: ${mean||'\u2014'}W \u2192 ${r.relMean} W/kg`,`Fatigue index: ${r.fatigue}%  (lower = better anaerobic endurance)`,`Elite sprinters: <30% fatigue index`])
    } else if (active==='oneRM') {
      const w=parseFloat(i.liftWeight||0), reps=parseInt(i.reps||0); if(!w||!reps) return
      const rm=epley1RM(w,reps)
      setResult(['1RM Estimate (Epley)',`${w}kg \u00d7 ${reps} reps`,`1RM = ${w} \u00d7 (1 + ${reps}/30) = ${rm} kg`,`Training percentages: 85%=${Math.round(rm*0.85)}kg, 70%=${Math.round(rm*0.70)}kg, 60%=${Math.round(rm*0.60)}kg`])
    } else if (active==='astrand') {
      const watts=parseInt(i.astWatts||0), hr=parseInt(i.steadyHR||0), bw=parseFloat(i.astBW||70), gender=i.gender||'male'
      if(!watts||!hr) return
      const vo2=astrandVO2(watts,bw,gender)
      setResult(['\u00c5strand Bike Result',`Steady-state HR: ${hr} bpm, Workload: ${watts}W`,`VO\u2082max \u2248 ${vo2} mL/kg/min (${gender})`,`Formula: (workload \u00d7 ${gender==='female'?'5.88':'6.12'} / BW) + 3.5`,`For greater accuracy use Åstrand nomogram HR correction.`])
    } else if (active==='conconi') {
      setResult(['Conconi Protocol','1. Run on 400m track. Start at 8 km/h.','2. Increase 0.5 km/h every 200m.','3. Record HR at each stage.','4. Plot HR vs speed \u2014 deflection point = anaerobic threshold.','5. Threshold HR \u2248 HR at deflection; threshold speed = deflection speed.'])
    } else if (active==='lactate') {
      setResult(['Blood Lactate Protocol','Equipment: lactate analyzer, finger-prick lancets.','Stages: 5 min each, +0.5 km/h. Sample from earlobe or fingertip.','LT1 (aerobic): ~2 mmol/L \u2014 first rise above baseline \u2192 top of Z2.','LT2 (MLSS): ~4 mmol/L \u2014 last sustainable steady state \u2192 Z4.','Ref: E\u015e\u0130K / THRESHOLD, Chapter 4 \u2014 Laktat Fizyolojisi.'])
    }
  }

  const activeTest = TESTS.find(x=>x.id===active)

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('selectProto')}</div>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'16px' }}>
          {TESTS.map(test=>(
            <button key={test.id} onClick={()=>{setActive(test.id);setResult(null)}}
              style={{ ...S.navBtn(active===test.id), borderRadius:'4px', display:'flex', flexDirection:'column', gap:'1px', fontSize:'10px' }}>
              {test.label}
              <span style={{ fontSize:'9px', opacity:0.7 }}>{test.sport}</span>
            </button>
          ))}
        </div>

        {active==='cooper' && <>
          <label style={S.label}>DISTANCE COVERED IN 12 MIN (meters)</label>
          <input style={{ ...S.input, maxWidth:'200px' }} type="number" placeholder="3200" value={v('dist')} onChange={e=>set('dist',e.target.value)}/>
        </>}
        {active==='ramp' && <>
          <label style={S.label}>FINAL COMPLETED STEP (watts, 25W increments/min)</label>
          <input style={{ ...S.input, maxWidth:'200px' }} type="number" placeholder="350" value={v('watts')} onChange={e=>set('watts',e.target.value)}/>
        </>}
        {active==='ftp20' && <>
          <label style={S.label}>20-MIN AVERAGE POWER (watts)</label>
          <input style={{ ...S.input, maxWidth:'200px' }} type="number" placeholder="300" value={v('avg20')} onChange={e=>set('avg20',e.target.value)}/>
        </>}
        {active==='beep' && <>
          <label style={S.label}>LEVEL REACHED (e.g. 11.5)</label>
          <input style={{ ...S.input, maxWidth:'200px' }} type="text" placeholder="11.5" value={v('beepLevel')} onChange={e=>set('beepLevel',e.target.value)}/>
        </>}
        {active==='yyir1' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>LEVEL (1\u201323)</label>
              <input style={S.input} type="number" placeholder="16" value={v('yyLevel')} onChange={e=>set('yyLevel',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>SHUTTLE IN LEVEL (1\u20138)</label>
              <input style={S.input} type="number" placeholder="4" value={v('yyShuttle')} onChange={e=>set('yyShuttle',e.target.value)}/>
            </div>
          </div>
        )}
        {active==='wingate' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>PEAK POWER (W)</label>
              <input style={S.input} type="number" placeholder="900" value={v('peak')} onChange={e=>set('peak',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>MEAN POWER (W)</label>
              <input style={S.input} type="number" placeholder="650" value={v('mean')} onChange={e=>set('mean',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>LOWEST POWER (W)</label>
              <input style={S.input} type="number" placeholder="500" value={v('lowPow')} onChange={e=>set('lowPow',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>BODY WEIGHT (kg)</label>
              <input style={S.input} type="number" placeholder="75" value={v('bw')} onChange={e=>set('bw',e.target.value)}/>
            </div>
          </div>
        )}
        {active==='oneRM' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 140px' }}>
              <label style={S.label}>WEIGHT LIFTED (kg)</label>
              <input style={S.input} type="number" placeholder="100" value={v('liftWeight')} onChange={e=>set('liftWeight',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>REPS COMPLETED</label>
              <input style={S.input} type="number" placeholder="6" value={v('reps')} onChange={e=>set('reps',e.target.value)}/>
            </div>
          </div>
        )}
        {active==='astrand' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 130px' }}>
              <label style={S.label}>STEADY-STATE HR (bpm)</label>
              <input style={S.input} type="number" placeholder="155" value={v('steadyHR')} onChange={e=>set('steadyHR',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 130px' }}>
              <label style={S.label}>WORKLOAD (watts)</label>
              <input style={S.input} type="number" placeholder="150" value={v('astWatts')} onChange={e=>set('astWatts',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 110px' }}>
              <label style={S.label}>BODY WEIGHT (kg)</label>
              <input style={S.input} type="number" placeholder="70" value={v('astBW')} onChange={e=>set('astBW',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 110px' }}>
              <label style={S.label}>GENDER</label>
              <select style={S.select} value={v('gender')||'male'} onChange={e=>set('gender',e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
        )}
        {(active==='conconi'||active==='lactate') && (
          <div style={{ ...S.mono, fontSize:'11px', color:'#555', marginBottom:'8px' }}>Click below to view the full protocol.</div>
        )}

        <button style={{ ...S.btn, marginTop:'14px' }} onClick={run}>
          {activeTest?.needsCalc ? t('calcBtn') : t('viewBtn')}
        </button>
      </div>

      {result && (
        <div className="sp-card" style={{ ...S.card, borderLeft:'4px solid #ff6600', animationDelay:'50ms' }}>
          <div style={S.cardTitle}>{result[0]}</div>
          {result.slice(1).map((line,i)=>(
            <div key={i} style={{ ...S.mono, fontSize:'13px', lineHeight:1.9, color:i===0?'#1a1a1a':'#555', borderBottom:i<result.length-2?'1px solid #f0f0f0':'none', padding:'4px 0' }}>{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Training Log ──────────────────────────────────────────────────────────────
function TrainingLog({ log, setLog }) {
  const { t } = useContext(LangCtx)
  const today = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({ date:today, type:'Easy Run', duration:'', rpe:'5', notes:'' })
  const [tssPreview, setTssPreview] = useState(null)

  const add = () => {
    if (!form.duration) return
    const tss = calcTSS(parseInt(form.duration), parseInt(form.rpe))
    setLog([...log, { ...form, duration:parseInt(form.duration), rpe:parseInt(form.rpe), tss }])
    setForm({ date:today, type:'Easy Run', duration:'', rpe:'5', notes:'' })
    setTssPreview(null)
  }

  const exportCSV = () => {
    const header = 'Date,Type,Duration (min),RPE,TSS,Notes'
    const rows = log.map(e=>`${e.date},${e.type},${e.duration},${e.rpe},${e.tss},"${(e.notes||'').replace(/"/g,'""')}"`)
    const csv = [header,...rows].join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='sporeus_training_log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('logTitle')}</div>
        <div style={S.row}>
          <div style={{ flex:'1 1 130px' }}>
            <label style={S.label}>{t('dateL')}</label>
            <input style={S.input} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          </div>
          <div style={{ flex:'1 1 150px' }}>
            <label style={S.label}>{t('typeL')}</label>
            <select style={S.select} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
              {SESSION_TYPES.map(x=><option key={x}>{x}</option>)}
            </select>
          </div>
          <div style={{ flex:'1 1 110px' }}>
            <label style={S.label}>{t('durL')}</label>
            <input style={S.input} type="number" placeholder="60" value={form.duration}
              onChange={e=>{setForm({...form,duration:e.target.value});setTssPreview(null)}}/>
          </div>
          <div style={{ flex:'1 1 120px' }}>
            <label style={S.label}>{t('rpeL')}</label>
            <select style={S.select} value={form.rpe}
              onChange={e=>{setForm({...form,rpe:e.target.value});setTssPreview(null)}}>
              {[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop:'10px' }}>
          <label style={S.label}>{t('notesL')}</label>
          <input style={S.input} type="text" placeholder="Felt strong at threshold pace\u2026" value={form.notes}
            onChange={e=>setForm({...form,notes:e.target.value})}/>
        </div>
        <div style={{ display:'flex', gap:'10px', marginTop:'14px', alignItems:'center', flexWrap:'wrap' }}>
          <button style={S.btn} onClick={add}>{t('addBtn')}</button>
          <button style={S.btnSec} onClick={()=>form.duration&&setTssPreview(calcTSS(parseInt(form.duration),parseInt(form.rpe)))}>{t('previewTSSBtn')}</button>
          {tssPreview!==null && <span style={{ ...S.mono, fontSize:'13px', color:'#ff6600', fontWeight:600 }}>TSS: {tssPreview}</span>}
        </div>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', ...S.cardTitle }}>
          <span>{t('sessionHistTitle')} ({log.length})</span>
          {log.length>0 && <button style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px' }} onClick={exportCSV}>{t('exportCSVBtn')}</button>}
        </div>
        {log.length===0 ? (
          <div style={{ ...S.mono, fontSize:'12px', color:'#aaa', textAlign:'center', padding:'20px' }}>{t('noSessionsYet')}</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid #e0e0e0', color:'#888', fontSize:'10px', letterSpacing:'0.06em' }}>
                  {['DATE','TYPE','MIN','RPE','TSS','NOTES',''].map(h=>(
                    <th key={h} style={{ textAlign:['TSS','MIN','RPE',''].includes(h)?'right':'left', padding:'4px 6px 8px 0', fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...log].reverse().map((s,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid #f0f0f0' }}>
                    <td style={{ padding:'6px 6px 6px 0', color:'#666' }}>{s.date}</td>
                    <td style={{ padding:'6px 6px 6px 0' }}>{s.type}</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 6px 0' }}>{s.duration}</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:s.rpe>=8?'#e03030':s.rpe>=6?'#f5c542':'#5bc25b' }}>{s.rpe}</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:'#ff6600', fontWeight:600 }}>{s.tss}</td>
                    <td style={{ padding:'6px 6px 6px 0', color:'#888', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.notes}</td>
                    <td style={{ textAlign:'right' }}>
                      <button onClick={()=>setLog(log.filter((_,idx)=>idx!==log.length-1-i))}
                        style={{ background:'none', border:'none', color:'#ccc', cursor:'pointer', ...S.mono, fontSize:'12px' }}>\u2715</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Periodization ─────────────────────────────────────────────────────────────
function Periodization() {
  const { t } = useContext(LangCtx)
  const [raceDate, setRaceDate] = useState('')
  const [hrs, setHrs] = useState('10')
  const hours = parseFloat(hrs)||10

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('macroCycleTitle')}</div>
        <div style={S.row}>
          <div style={{ flex:'1 1 160px' }}>
            <label style={S.label}>{t('raceDateL')}</label>
            <input style={S.input} type="date" value={raceDate} onChange={e=>setRaceDate(e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 140px' }}>
            <label style={S.label}>{t('weekHoursL')}</label>
            <input style={S.input} type="number" step="0.5" placeholder="10" value={hrs} onChange={e=>setHrs(e.target.value)}/>
          </div>
        </div>
        {raceDate && (
          <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'10px' }}>
            {t('startDateLbl')} {new Date(new Date(raceDate)-13*7*864e5).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
          </div>
        )}
      </div>
      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={S.cardTitle}>{t('zoneLegendTitle')}</div>
        <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
          {ZONE_NAMES.map((n,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', ...S.mono, fontSize:'11px' }}>
              <div style={{ width:'12px', height:'12px', background:ZONE_COLORS[i], borderRadius:'2px' }}/>
              {n}
            </div>
          ))}
        </div>
      </div>
      <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
        <div style={S.cardTitle}>{t('weekBreakTitle')}</div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'11px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid #e0e0e0', color:'#888', fontSize:'10px', letterSpacing:'0.06em' }}>
                {['WK','PHASE','FOCUS','HRS','ZONE DIST','LOAD'].map((h,i)=>(
                  <th key={h} style={{ textAlign:i>=3?'center':'left', padding:'4px 10px 8px 0', fontWeight:600, minWidth:i===4?'120px':undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MACRO_PHASES.map(row=>{
                const wh=row.load==='Low'?hours*.7:row.load==='Med'?hours:hours*1.25
                return (
                  <tr key={row.week} style={{ borderBottom:'1px solid #f0f0f0', background:row.phase==='Recovery'?'#fffbf0':row.phase==='Race'?'#fff8f8':'transparent' }}>
                    <td style={{ padding:'7px 10px 7px 0', fontWeight:600, color:'#ff6600' }}>{row.week}</td>
                    <td style={{ padding:'7px 10px 7px 0' }}>{row.phase}</td>
                    <td style={{ padding:'7px 10px 7px 0', color:'#555' }}>{row.focus}</td>
                    <td style={{ textAlign:'center', padding:'7px 10px 7px 0', fontWeight:600 }}>{wh.toFixed(1)}</td>
                    <td style={{ padding:'7px 0', minWidth:'120px' }}>
                      <div style={{ display:'flex', height:'10px', gap:'1px', borderRadius:'2px', overflow:'hidden' }}>
                        {row.zDist.map((pct,zi)=>pct>0&&<div key={zi} style={{ width:`${pct}%`, background:ZONE_COLORS[zi] }} title={`${ZONE_NAMES[zi]}: ${pct}%`}/>)}
                      </div>
                    </td>
                    <td style={{ textAlign:'center', padding:'7px 0' }}><span style={S.tag(LOAD_COLOR[row.load])}>{row.load}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'10px' }}>Polarized model \u2014 Seiler & T\u00f8nnessen (2009). ~80% Z1\u2013Z2, ~20% Z4\u2013Z5.</div>
      </div>
    </div>
  )
}

// ─── Glossary (with API) ───────────────────────────────────────────────────────
function Glossary() {
  const { t, lang } = useContext(LangCtx)
  const [q, setQ] = useState('')
  const [apiTerms, setApiTerms] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cached = getApiCache()
    if (cached) { setApiTerms(cached); return }
    setLoading(true)
    fetch('https://sporeus.com/wp-json/wp/v2/posts?per_page=30&_fields=id,title,excerpt,link&categories=737')
      .then(r=>r.json())
      .then(data=>{
        const terms=data.map(p=>({
          id:p.id,
          term:p.title.rendered.replace(/&amp;/g,'&').replace(/&#8220;/g,'\u201c').replace(/&#8221;/g,'\u201d'),
          excerpt:(p.excerpt.rendered||'').replace(/<[^>]+>/g,'').trim().slice(0,200),
          link:p.link
        }))
        setApiCache(terms); setApiTerms(terms)
      })
      .catch(()=>{})
      .finally(()=>setLoading(false))
  }, [])

  const allTerms = [...apiTerms, ...GLOSSARY_TERMS]
  const filtered = allTerms.filter(t2=>
    t2.term.toLowerCase().includes(q.toLowerCase()) ||
    (t2.en||t2.excerpt||'').toLowerCase().includes(q.toLowerCase()) ||
    (t2.tr||'').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('glossTitle')}</div>
        <input style={S.input} type="text" placeholder={t('searchPlaceholder')} value={q} onChange={e=>setQ(e.target.value)}/>
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'8px' }}>
          {loading ? t('loadingTerms') : `${filtered.length} / ${allTerms.length} terms`}
          {apiTerms.length>0 && !loading && <span style={{ color:'#5bc25b', marginLeft:'8px' }}>\u2022 {t('apiTermsLabel')}</span>}
        </div>
      </div>

      {filtered.map((term,i)=>{
        const isApi = !!term.id
        const body = isApi ? term.excerpt : (lang==='tr'&&term.tr ? term.tr : term.en)
        return (
          <div key={term.id||term.term} className="sp-card"
            style={{ ...S.card, marginBottom:'10px', animationDelay:`${Math.min(i*30,300)}ms` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
              <div style={{ ...S.mono, fontSize:'14px', fontWeight:600, color:'#0064ff', marginBottom:'8px' }}>{term.term}</div>
              {isApi && <span style={S.tag('#5bc25b')}>API</span>}
            </div>
            <div style={{ fontSize:'14px', lineHeight:1.7, color:'#333' }}>{body}</div>
            {isApi && term.link && (
              <a href={term.link} target="_blank" rel="noreferrer"
                style={{ ...S.mono, fontSize:'11px', color:'#0064ff', textDecoration:'none', display:'block', marginTop:'8px' }}>
                {t('readMoreLink')}
              </a>
            )}
          </div>
        )
      })}

      {filtered.length===0&&!loading&&(
        <div style={{ textAlign:'center', ...S.mono, fontSize:'12px', color:'#aaa', padding:'40px 0' }}>No terms match.</div>
      )}
    </div>
  )
}

// ─── Recovery ──────────────────────────────────────────────────────────────────
function Recovery() {
  const { t } = useContext(LangCtx)
  const [entries, setEntries] = useLocalStorage('sporeus-recovery', [])
  const today = new Date().toISOString().slice(0,10)
  const todayEntry = entries.find(e=>e.date===today)
  const defVals = { sleep:3, soreness:3, energy:3, mood:3, stress:3 }
  const [form, setForm] = useState(todayEntry ? { ...todayEntry } : { ...defVals })

  useEffect(() => {
    const e = entries.find(x=>x.date===today)
    setForm(e ? {...e} : {...defVals})
  }, [today])

  const score = Math.round(Object.values({sleep:form.sleep,soreness:form.soreness,energy:form.energy,mood:form.mood,stress:form.stress}).reduce((s,v)=>s+v,0)/5*20)
  const readiness = score>=75?{label:t('goLabel'),color:'#5bc25b'}:score>=50?{label:t('monitorLabel'),color:'#f5c542'}:{label:t('restLabel'),color:'#e03030'}

  const save = () => {
    const entry = { date:today, ...form, score }
    const updated = entries.filter(e=>e.date!==today)
    setEntries([...updated, entry].slice(-90))
  }

  const last7scores = entries.slice(-7).map(e=>e.score)

  return (
    <div className="sp-fade">
      {todayEntry && (
        <div className="sp-card" style={{ ...S.card, borderLeft:`4px solid ${readiness.color}`, animationDelay:'0ms', ...S.mono, fontSize:'12px', color:'#888' }}>
          {t('alreadyLoggedMsg')}
        </div>
      )}

      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('wellnessTitle')} \u2014 {today}</div>
        {WELLNESS_FIELDS.map(field=>(
          <div key={field.key} style={{ marginBottom:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <label style={{ ...S.label, marginBottom:0 }}>{t(field.lk)}</label>
              <span style={{ ...S.mono, fontSize:'11px', color:'#888' }}>{form[field.key]}/5</span>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              {field.emoji.map((em,i)=>(
                <button key={i} onClick={()=>setForm({...form,[field.key]:i+1})}
                  style={{ fontSize:'20px', padding:'6px 10px', borderRadius:'6px', border:`2px solid ${form[field.key]===i+1?'#ff6600':'#e0e0e0'}`, background:form[field.key]===i+1?'#fff3eb':'#fff', cursor:'pointer', transition:'all 0.15s', lineHeight:1 }}>
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button style={S.btn} onClick={save}>{t('saveEntryBtn')}</button>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={S.cardTitle}>{t('readScoreTitle')}</div>
        <div style={{ display:'flex', alignItems:'center', gap:'24px' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ ...S.mono, fontSize:'48px', fontWeight:600, color:readiness.color, lineHeight:1 }}>{score}</div>
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'4px' }}>/100</div>
          </div>
          <div>
            <span style={{ ...S.tag(readiness.color), fontSize:'14px', padding:'6px 16px' }}>{readiness.label}</span>
            <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'8px' }}>
              \u226575: {t('goLabel')} \u00b7 50\u201374: {t('monitorLabel')} \u00b7 &lt;50: {t('restLabel')}
            </div>
          </div>
          <div style={{ marginLeft:'auto' }}>
            <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'4px' }}>7-DAY</div>
            <Sparkline data={last7scores}/>
          </div>
        </div>
      </div>

      {entries.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
          <div style={S.cardTitle}>{t('hist7Title')}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid #e0e0e0', color:'#888', fontSize:'10px' }}>
                {['DATE','SLEEP','SORENESS','ENERGY','MOOD','STRESS','SCORE'].map(h=>(
                  <th key={h} style={{ textAlign:h==='SCORE'?'right':'left', padding:'4px 6px 8px 0', fontWeight:600, fontSize:'9px', letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...entries].slice(-7).reverse().map((e,i)=>{
                const sc=e.score||0
                const sc_c=sc>=75?'#5bc25b':sc>=50?'#f5c542':'#e03030'
                return (
                  <tr key={i} style={{ borderBottom:'1px solid #f0f0f0' }}>
                    <td style={{ padding:'6px 6px 6px 0', color:'#666' }}>{e.date}</td>
                    {['sleep','soreness','energy','mood','stress'].map(k=>(
                      <td key={k} style={{ padding:'6px 6px 6px 0' }}>{WELLNESS_FIELDS.find(f=>f.key===k)?.emoji[(e[k]||3)-1]}</td>
                    ))}
                    <td style={{ textAlign:'right', padding:'6px 0', color:sc_c, fontWeight:600 }}>{sc}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Profile ───────────────────────────────────────────────────────────────────
function Profile({ profile, setProfile }) {
  const { t } = useContext(LangCtx)
  const [local, setLocal] = useState(profile)
  const [status, setStatus] = useState(null)

  useEffect(()=>{ setLocal(profile) },[profile])

  const save = () => { setProfile(local); setStatus('saved'); setTimeout(()=>setStatus(null),2000) }

  const share = async () => {
    const text=`${local.name||'Athlete'} | ${local.sport||''} | VO\u2082max: ${local.vo2max||'?'} | FTP: ${local.ftp||'?'}W | Goal: ${local.goal||''} — via Sporeus Athlete Console`
    try {
      if (navigator.share) {
        await navigator.share({ title:'Sporeus Athlete Profile', text, url:'https://sporeus.com' })
      } else {
        await navigator.clipboard.writeText(text)
        setStatus('copied'); setTimeout(()=>setStatus(null),2000)
      }
    } catch {}
  }

  const FIELDS = [
    {k:'name',lk:'nameL',ph:'Athlete name'},{k:'age',lk:'ageL',ph:'32',type:'number'},
    {k:'weight',lk:'weightL',ph:'70',type:'number'},{k:'sport',lk:'sportL',ph:'Running / Triathlon'},
    {k:'maxhr',lk:'maxHRIn',ph:'185',type:'number'},{k:'ftp',lk:'ftpL',ph:'280',type:'number'},
    {k:'vo2max',lk:'vo2L',ph:'55',type:'number'},{k:'threshold',lk:'threshPaceL',ph:'4:30'},
    {k:'goal',lk:'goalL',ph:'Sub-3h marathon Istanbul 2026'},
  ]

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('profileTitle')}</div>
        <div style={S.row}>
          {FIELDS.map(f=>(
            <div key={f.k} style={{ flex:'1 1 200px' }}>
              <label style={S.label}>{t(f.lk)}</label>
              <input style={S.input} type={f.type||'text'} placeholder={f.ph}
                value={local[f.k]||''} onChange={e=>setLocal({...local,[f.k]:e.target.value})}/>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
          <button style={S.btn} onClick={save}>{status==='saved'?t('savedMsg'):t('saveProfileBtn')}</button>
          <button style={S.btnSec} onClick={share}>{status==='copied'?t('copiedMsg'):t('shareBtn')}</button>
        </div>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={S.cardTitle}>{t('aboutTitle')}</div>
        <div style={{ fontSize:'14px', lineHeight:1.8, color:'#444' }}>
          <p style={{ marginTop:0 }}>A Bloomberg Terminal-inspired training tool for endurance athletes. Built on the science behind <strong>E\u015e\u0130K / THRESHOLD</strong> \u2014 Turkey\u2019s first comprehensive endurance science book.</p>
          <p style={{ marginBottom:0 }}>
            <a href="https://sporeus.com/huseyin-akbulut/" target="_blank" rel="noreferrer"
              style={{ color:'#0064ff', textDecoration:'none', fontWeight:600 }}>H\u00fcseyin Akbulut</a>
            {' '}\u2014 BSc &amp; MSc Sport Science, Marmara University \u00b7{' '}
            <a href="https://sporeus.com/esik/" target="_blank" rel="noreferrer" style={{ color:'#ff6600', textDecoration:'none' }}>E\u015e\u0130K Kitab\u0131</a>
          </p>
        </div>
      </div>

      <div className="sp-card" style={{ ...S.card, background:'#0a0a0a', animationDelay:'100ms' }}>
        <div style={{ ...S.cardTitle, color:'#ff6600', borderColor:'#333' }}>{t('installTitle')}</div>
        <div style={{ ...S.mono, fontSize:'12px', lineHeight:1.9, color:'#ccc' }}>
          <div>📱 <strong style={{ color:'#fff' }}>iOS:</strong> Safari \u2192 Share \u2192 Add to Home Screen</div>
          <div>🤖 <strong style={{ color:'#fff' }}>Android:</strong> Chrome menu \u2192 Install App</div>
          <div>💻 <strong style={{ color:'#fff' }}>Desktop:</strong> Address bar \u2192 Install icon</div>
          <div style={{ color:'#666', fontSize:'10px', marginTop:'6px' }}>Works fully offline once installed.</div>
        </div>
      </div>
    </div>
  )
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [log, setLog] = useLocalStorage('sporeus_log', [])
  const [profile, setProfile] = useLocalStorage('sporeus_profile', {})
  const [lang, setLang] = useLocalStorage('sporeus-lang', 'en')

  const t = useCallback(key => LABELS[lang]?.[key] ?? LABELS.en?.[key] ?? key, [lang])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})
  const dateStr = now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase()

  return (
    <LangCtx.Provider value={{ t, lang, setLang }}>
      <style>{ANIM_CSS}</style>
      <div style={S.app}>
        <div style={S.topBar}/>

        <header style={S.header}>
          <div>
            <div style={S.headerTitle}>\u25c8 {t('appTitle')}</div>
            <div style={S.headerSub}>{t('appSub')}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ ...S.mono, fontSize:'10px', color:'#888' }}>{timeStr}</div>
              <div style={{ ...S.mono, fontSize:'10px', color:'#555', letterSpacing:'0.06em' }}>{dateStr}</div>
            </div>
            <button
              onClick={()=>setLang(lang==='en'?'tr':'en')}
              style={{ ...S.mono, fontSize:'11px', fontWeight:600, padding:'5px 10px', borderRadius:'3px', border:'1px solid #444', background:'transparent', color:'#ccc', cursor:'pointer', letterSpacing:'0.08em' }}>
              {lang==='en'?'TR':'EN'}
            </button>
          </div>
        </header>

        <nav style={S.navWrap}>
          <div style={S.nav}>
            {TABS.map(tab2=>(
              <button key={tab2.id} style={S.navBtn(tab===tab2.id)} onClick={()=>setTab(tab2.id)}>
                {tab2.icon} {t(tab2.lk)}
              </button>
            ))}
          </div>
        </nav>

        <main style={S.content}>
          {tab==='dashboard'     && <Dashboard log={log} profile={profile}/>}
          {tab==='zones'         && <ZoneCalc/>}
          {tab==='tests'         && <TestProtocols/>}
          {tab==='log'           && <TrainingLog log={log} setLog={setLog}/>}
          {tab==='periodization' && <Periodization/>}
          {tab==='glossary'      && <Glossary/>}
          {tab==='recovery'      && <Recovery/>}
          {tab==='profile'       && <Profile profile={profile} setProfile={setProfile}/>}
        </main>

        <footer style={S.footer}>
          SPOREUS ATHLETE CONSOLE v2.0 \u00b7 SPOREUS.COM \u00b7 E\u015e\u0130K / THRESHOLD 2026
        </footer>
      </div>
    </LangCtx.Provider>
  )
}
