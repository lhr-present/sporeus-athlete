// ─── Pure math functions (no React imports) ──────────────────────────────────
import {
  ZONE_COLORS, ZONE_NAMES, DAY_PATTERNS, DUR_FRAC, SES_RPE,
  ZONE_BY_TYPE, DAYS7, ZLABEL, ZIDX, ZCOL, SESSION_DESCRIPTIONS,
} from './constants.js'

export function navyBF(neck, waist, hip, height, gender) {
  if (gender==='male') {
    return Math.max(0, Math.round((495/(1.0324-0.19077*Math.log10(waist-neck)+0.15456*Math.log10(height))-450)*10)/10)
  }
  return Math.max(0, Math.round((495/(1.29579-0.35004*Math.log10(waist+hip-neck)+0.22100*Math.log10(height))-450)*10)/10)
}
export function mifflinBMR(weight, height, age, gender) {
  const base = 10*weight + 6.25*height - 5*age
  return Math.round(gender==='male' ? base+5 : base-161)
}

export const hrZones    = maxHR => [[.50,.60],[.60,.70],[.70,.80],[.80,.90],[.90,1.00]].map(([lo,hi],i) => ({ name:ZONE_NAMES[i], low:Math.round(maxHR*lo), high:Math.round(maxHR*hi), color:ZONE_COLORS[i] }))
export const powerZones = ftp   => [[.55,.74],[.75,.89],[.90,1.04],[1.05,1.20],[1.21,1.50]].map(([lo,hi],i) => ({ name:ZONE_NAMES[i], low:Math.round(ftp*lo), high:Math.round(ftp*hi), color:ZONE_COLORS[i] }))
export const paceZones  = t0    => [1.30,1.15,1.06,1.00,0.92].map((f,i) => { const p=t0*f,m=Math.floor(p),s=Math.round((p-m)*60); return { name:ZONE_NAMES[i], pace:`${m}:${String(s).padStart(2,'0')} /km`, color:ZONE_COLORS[i] } })
export const calcTSS    = (dur, rpe) => Math.round((dur/60)*Math.pow((rpe/10)*1.05,2)*100)
export const cooperVO2  = d  => ((d-504.9)/44.73).toFixed(1)
export const rampFTP    = w  => Math.round(w*0.75)
export const ftpFrom20  = w  => Math.round(w*0.95)
export const epley1RM   = (w,r) => (w*(1+r/30)).toFixed(1)
export const astrandVO2 = (watts, bw, gender) => ((watts*(gender==='female'?5.88:6.12)/bw)+3.5).toFixed(1)
export const yyir1VO2   = (lv, sh) => (35.4 + ((lv-1)+(sh/8))*(62.8-35.4)/22).toFixed(1)
export const wingateStats = (peak, mean, low, bw) => ({ relPeak:(peak/bw).toFixed(1), relMean:(mean/bw).toFixed(1), fatigue:(((peak-low)/peak)*100).toFixed(1) })
export const riegel     = (t1, d1, d2) => t1 * Math.pow(d2/d1, 1.06)

// ─── W' (W-prime) Balance — Skiba 2012 differential model ────────────────────
// Normalized Power: 30s rolling mean → 4th-power mean → 0.25 root
export function normalizedPower(powers) {
  if (!powers || powers.length < 30) return 0
  const W = 30
  const rolling = []
  for (let i = W - 1; i < powers.length; i++) {
    let sum = 0
    for (let j = i - W + 1; j <= i; j++) sum += powers[j]
    rolling.push(sum / W)
  }
  const mean4 = rolling.reduce((s, v) => s + Math.pow(v, 4), 0) / rolling.length
  return Math.round(Math.pow(mean4, 0.25))
}

// Skiba differential equation: each second, deplete or recover W'
// τ_W = 546 × e^(−0.01×(CP − P̄)) + 316  (Skiba 2012)
// dW'/dt = (W'max − W'(t)) / τ_W           when P < CP
// dW'/dt = CP − P(t)                        when P ≥ CP
export function computeWPrime(powers, cp, wPrimeMax) {
  if (!powers || !powers.length || !cp || !wPrimeMax) return []
  let w = wPrimeMax
  const series = []
  const avgBelowCP = (() => {
    const below = powers.filter(p => p < cp)
    return below.length ? below.reduce((s, v) => s + v, 0) / below.length : cp * 0.6
  })()
  const tau = 546 * Math.exp(-0.01 * (cp - avgBelowCP)) + 316

  for (const p of powers) {
    if (p >= cp) {
      w = Math.max(0, w - (p - cp))
    } else {
      w = wPrimeMax - (wPrimeMax - w) * Math.exp(-1 / tau)
    }
    series.push(Math.round(w))
  }
  return series
}

export function parseTimeSec(str) {
  const p = str.split(':').map(Number)
  if (p.length===3) return p[0]*3600+p[1]*60+p[2]
  if (p.length===2) return p[0]*60+p[1]
  return NaN
}
export function fmtSec(s) {
  s = Math.round(s)
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60
  if (h>0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}
export function fmtPace(totalSec, distM) {
  const pps = totalSec/(distM/1000)
  const m=Math.floor(pps/60), s=Math.round(pps%60)
  return `${m}:${String(s).padStart(2,'0')}`
}

// ─── Training load (EMA) ───────────────────────────────────────────────────────
export function calcLoad(log) {
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

// ─── Monotony & Strain ────────────────────────────────────────────────────────
export function monotonyStrain(log) {
  const today = new Date()
  const last7 = []
  for (let i=6;i>=0;i--) {
    const d=new Date(today); d.setDate(d.getDate()-i)
    const ds=d.toISOString().slice(0,10)
    last7.push(log.filter(e=>e.date===ds).reduce((s,e)=>s+(e.tss||0),0))
  }
  const mean = last7.reduce((s,v)=>s+v,0)/7
  const std  = Math.sqrt(last7.reduce((s,v)=>s+Math.pow(v-mean,2),0)/7)
  const mono  = std>0 ? Math.round(mean/std*10)/10 : 0
  const strain = Math.round(mean*7*mono)
  return { mono, strain, mean:Math.round(mean) }
}

// ─── Personal Records ─────────────────────────────────────────────────────────
export function calcPRs(log) {
  if (!log.length) return []
  const sorted = [...log].sort((a,b) => new Date(a.date) - new Date(b.date))
  const highTSS = sorted.reduce((best,e)=>(!best||e.tss>best.tss)?e:best, null)
  const longDur  = sorted.reduce((best,e)=>(!best||e.duration>best.duration)?e:best, null)
  const highRPE  = sorted.reduce((best,e)=>(!best||e.rpe>best.rpe)?e:best, null)
  const dates = [...new Set(sorted.map(e=>e.date))].sort()
  let maxStreak=1, cur=1
  for (let i=1;i<dates.length;i++) {
    const diff=(new Date(dates[i])-new Date(dates[i-1]))/(864e5)
    cur = diff===1 ? cur+1 : 1
    if (cur>maxStreak) maxStreak=cur
  }
  return [
    highTSS && { label:'Highest TSS', value:highTSS.tss, date:highTSS.date, unit:'TSS' },
    longDur  && { label:'Longest Session', value:`${longDur.duration}min`, date:longDur.date, unit:longDur.type },
    highRPE  && { label:'Hardest Session', value:`RPE ${highRPE.rpe}`, date:highRPE.date, unit:highRPE.type },
    { label:'Best Streak', value:`${maxStreak} days`, date:'', unit:'consecutive sessions' },
  ].filter(Boolean)
}

// ─── API cache ─────────────────────────────────────────────────────────────────
const API_KEY='sporeus-api-cache', API_TTL=864e5
export function getApiCache() { try { const c=JSON.parse(localStorage.getItem(API_KEY)); if(c&&Date.now()-c.ts<API_TTL) return c.data } catch {} return null }
export function setApiCache(d) { try { localStorage.setItem(API_KEY,JSON.stringify({ts:Date.now(),data:d})) } catch {} }

// ─── Plan Generator ──────────────────────────────────────────────────────────
export function generatePlan(goal, totalWeeks, weeklyHours, level) {
  const w = parseInt(totalWeeks), h = parseFloat(weeklyHours)
  const taperW = w <= 6 ? 1 : 2
  const peakW  = w <= 8 ? 1 : w <= 14 ? 2 : 3
  const rem    = w - taperW - peakW
  const buildW = Math.max(2, Math.round(rem * 0.5))
  const baseW  = Math.max(0, rem - buildW)
  const phases = []
  for (let i=0;i<baseW;i++)  phases.push('Base')
  for (let i=0;i<buildW;i++) phases.push('Build')
  for (let i=0;i<peakW;i++)  phases.push('Peak')
  for (let i=0;i<taperW-1;i++) phases.push('Taper')
  phases.push('Race Week')
  const volByPhase = { Base:.85,Build:1.0,Peak:1.1,Taper:.65,'Race Week':.40 }
  const lk = (level||'intermediate').toLowerCase()
  return phases.map((phase, idx) => {
    const weekNum = idx + 1
    const isRecovery = weekNum % 4 === 0 && (phase==='Build'||phase==='Base') && weekNum < w - 2
    const effPhase = isRecovery ? 'Recovery' : phase
    const wHours = h * (isRecovery ? 0.6 : (volByPhase[phase]||1))
    const totalMins = wHours * 60
    const pats = DAY_PATTERNS[lk] || DAY_PATTERNS.intermediate
    const pattern = pats[effPhase] || pats.Base
    let weekTSS = 0
    const zoneMins = [0,0,0,0,0]
    const sessions = pattern.map((type, di) => {
      const frac = DUR_FRAC[type]||0
      const duration = Math.round(totalMins * frac)
      const rpe = SES_RPE[type]||0
      const tss = duration > 0 ? calcTSS(duration, rpe) : 0
      weekTSS += tss
      const zd = ZONE_BY_TYPE[type]||[0,0,0,0,0]
      if (duration > 0) zd.forEach((p,zi) => { zoneMins[zi] += p * duration / 100 })
      return { day:DAYS7[di], type, duration, rpe, tss, zone:ZLABEL[type]||'Z2', zoneIdx:ZIDX[type]??1, color:ZCOL(type), description:SESSION_DESCRIPTIONS[type]||'' }
    })
    const totalZ = zoneMins.reduce((s,v)=>s+v,0)||1
    const zonePct = zoneMins.map(v=>Math.round(v/totalZ*100))
    return { week:weekNum, phase:isRecovery?'Recovery':phase, sessions, totalHours:wHours.toFixed(1), tss:weekTSS, zonePct }
  })
}

// ─── normTR (Turkish normalizer, no JSX) ─────────────────────────────────────
export const normTR = s => (s||'').toLowerCase()
  .replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c')

// ─── Coach invite system ───────────────────────────────────────────────────────
const SPOREUS_SALT = 'sporeus-coach-salt-2026'
const MASTER_SALT  = 'sporeus-master-2026'
export const FREE_ATHLETE_LIMIT = 3

export async function generateCoachId(name, email) {
  const raw = (name||'').trim().toLowerCase() + (email||'').trim().toLowerCase() + SPOREUS_SALT
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hex = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
  return 'SP-' + hex.slice(0, 8)
}

export async function generateUnlockCode(coachId, limit) {
  const raw = coachId + String(limit) + MASTER_SALT
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hex = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
  return 'SPUNLOCK-' + coachId.replace('SP-','') + '-' + limit + '-' + hex.slice(0, 6)
}

export async function verifyUnlockCode(code, coachId) {
  const parts = code.trim().split('-')
  if (parts.length < 4 || parts[0] !== 'SPUNLOCK') return null
  const id = parts[1]
  const limit = parseInt(parts[2])
  const hash = parts[3]
  if (isNaN(limit) || limit < 1) return null
  const raw = 'SP-' + id + String(limit) + MASTER_SALT
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hex = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
  if (hex.slice(0, 6) !== hash) return null
  if ('SP-' + id !== coachId) return null
  return { coachId: 'SP-' + id, limit }
}
