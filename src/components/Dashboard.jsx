import { useContext, useState, useEffect, useMemo } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { TSSChart, WeeklyVolChart, ZoneDonut, ZoneBar, CTLTimeline, HelpTip } from './ui.jsx'
import CTLChart  from './charts/CTLChart.jsx'
import ZoneChart from './charts/ZoneChart.jsx'
import LoadChart from './charts/LoadChart.jsx'
import HRVChart  from './charts/HRVChart.jsx'
import { monotonyStrain, calcPRs, navyBF, mifflinBMR, riegel, fmtSec, fmtPace, calcLoad } from '../lib/formulas.js'
import { calculateACWR } from '../lib/trainingLoad.js'
import { exportAllData } from '../lib/storage.js'
import { useCountUp } from '../hooks/useCountUp.js'
import Achievements from './Achievements.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { SPORT_BRANCHES, ATHLETE_LEVELS, LEVEL_CONFIG, DASH_CARD_DEFS } from '../lib/constants.js'
import { analyzeLoadTrend, analyzeRecoveryCorrelation, analyzeZoneBalance, predictInjuryRisk, predictFitness, generateWeeklyNarrative, detectMilestones, computeRaceReadiness, predictRacePerformance, assessDataQuality } from '../lib/intelligence.js'
import { getTriggeredNotes } from '../lib/scienceNotes.js'
import { correlateTrainingToResults, findRecoveryPatterns, mineInjuryPatterns, findOptimalWeekStructure, findSeasonalPatterns } from '../lib/patterns.js'
import { useData } from '../contexts/DataContext.jsx'

function BackupReminder({ log }) {
  const [lastBackup, setLastBackup] = useLocalStorage('sporeus-last-backup', null)
  const today = new Date().toISOString().slice(0, 10)
  const daysSince = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000) : null

  if (log.length < 50) return null
  if (lastBackup && daysSince !== null && daysSince < 30) return null

  const handleExport = () => {
    const json = exportAllData()
    const blob = new Blob([json], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `sporeus-backup-${today}.json`; a.click()
    URL.revokeObjectURL(url)
    setLastBackup(today)
  }

  return (
    <div style={{ ...S.card, borderLeft:'3px solid #f5c542', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px' }}>
      <div>
        <div style={{ ...S.mono, fontSize:'10px', fontWeight:600, color:'#f5c542', letterSpacing:'0.08em', marginBottom:'4px' }}>
          ⊞ BACKUP REMINDER
        </div>
        <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)' }}>
          {log.length} sessions logged · Last backup: {lastBackup || 'never'}
        </div>
      </div>
      <div style={{ display:'flex', gap:'8px' }}>
        <button style={{ ...S.btn, fontSize:'11px', padding:'6px 12px' }} onClick={handleExport}>Export Now</button>
        <button style={{ ...S.btnSec, fontSize:'11px', padding:'6px 12px' }} onClick={() => setLastBackup(today)}>Later</button>
      </div>
    </div>
  )
}

// ─── Training Insights Card (v4.3) ────────────────────────────────────────────
function InsightsCard({ log, recovery, profile, lang }) {
  const { t } = useContext(LangCtx)
  const [open, setOpen] = useState(false)
  if (log.length < 4) return null

  const loadTrend   = useMemo(() => analyzeLoadTrend(log),                     [log])
  const zoneBalance = useMemo(() => analyzeZoneBalance(log),                    [log])
  const fitness     = useMemo(() => predictFitness(log),                        [log])
  const recovCorr   = useMemo(() => analyzeRecoveryCorrelation(log, recovery),  [log, recovery])

  const insights = [
    { label: t('loadTrendLabel'),  value: loadTrend.trend.toUpperCase(),       color: loadTrend.trend==='building'?'#5bc25b':loadTrend.trend==='recovering'?'#4a90d9':'#f5c542', text: loadTrend.advice[lang] || loadTrend.advice.en },
    { label: t('zoneBalanceLabel'),value: zoneBalance.status.replace('_',' ').toUpperCase(), color: zoneBalance.status==='polarized'?'#5bc25b':zoneBalance.status==='too_hard'?'#e03030':'#f5c542', text: zoneBalance.recommendation[lang] || zoneBalance.recommendation.en },
    { label: t('fitnessLabel'),    value: fitness.trajectory.toUpperCase(),     color: fitness.trajectory==='improving'?'#5bc25b':fitness.trajectory==='declining'?'#e03030':'#f5c542', text: fitness.label[lang] || fitness.label.en },
    { label: t('recovCorrLabel'),  value: recovCorr.correlation !== null ? (recovCorr.correlation > 5 ? 'LINKED' : 'RESILIENT') : 'PENDING', color: recovCorr.correlation !== null ? (recovCorr.correlation > 5 ? '#f5c542' : '#5bc25b') : '#888', text: recovCorr.insight[lang] || recovCorr.insight.en },
  ]

  const smartAdj = []
  if (loadTrend.trend === 'building' && (loadTrend.change || 0) > 20) smartAdj.push({ en: 'Load increasing >20%/week — add a recovery day before next hard session.', tr: 'Yük haftada %20\'den fazla artıyor — bir sonraki zorlu seans öncesine toparlanma günü ekle.' })
  if (zoneBalance.status === 'threshold_heavy') smartAdj.push({ en: 'Too much Z3 — replace 2 moderate sessions with true easy (Z1/Z2) or hard (Z4+) efforts.', tr: 'Fazla Z3 — 2 orta seansı gerçek kolay (Z1/Z2) veya zorlu (Z4+) efora değiştir.' })
  if (fitness.trajectory === 'declining') smartAdj.push({ en: 'CTL declining — add 1 base session (60–90 min Z2) per week to halt decay.', tr: 'KTY düşüyor — azalmayı durdurmak için haftada 1 baz seans (60–90 dak Z2) ekle.' })
  if (fitness.in4w > fitness.current + 8) smartAdj.push({ en: `Fitness projected +${fitness.in4w - fitness.current} CTL in 4 weeks — maintain consistency.`, tr: `Kondisyon 4 haftada +${fitness.in4w - fitness.current} KTY artacak — tutarlılığını sürdür.` })

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'55ms' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div style={S.cardTitle}>{t('insightsTitle')}</div>
        <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={() => setOpen(o => !o)}>
          {open ? '▲ LESS' : '▼ MORE'}
        </button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {insights.map(ins => (
          <div key={ins.label} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px', borderLeft:`3px solid ${ins.color}` }}>
            <div style={{ minWidth:'120px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.06em' }}>{ins.label}</div>
              <div style={{ ...S.mono, fontSize:'13px', fontWeight:600, color:ins.color }}>{ins.value}</div>
            </div>
            {open && <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.6 }}>{ins.text}</div>}
          </div>
        ))}
      </div>
      {open && smartAdj.length > 0 && (
        <div style={{ marginTop:'12px', padding:'10px 12px', background:'#ff660011', borderRadius:'4px', borderLeft:'3px solid #ff6600' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#ff6600', letterSpacing:'0.08em', marginBottom:'6px' }}>◈ {t('smartAdjTitle')}</div>
          {smartAdj.map((adj, i) => (
            <div key={i} style={{ ...S.mono, fontSize:'11px', color:'var(--text)', lineHeight:1.7, marginBottom: i < smartAdj.length-1 ? '6px' : 0 }}>
              → {adj[lang] || adj.en}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── This Week's Story Card (v4.4) ────────────────────────────────────────────
function WeekStoryCard({ log, recovery, profile, lang }) {
  const { t } = useContext(LangCtx)
  const [copied, setCopied] = useState(false)
  if (log.length < 2) return null

  const narrative = generateWeeklyNarrative(log, recovery, profile, lang)
  const text = narrative[lang] || narrative.en

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'My Training Week — Sporeus', text })
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'57ms', borderLeft:'4px solid #0064ff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <div style={S.cardTitle}>{t('weekStoryTitle')}</div>
        <div style={{ display:'flex', gap:'6px' }}>
          {copied && <span style={{ ...S.mono, fontSize:'10px', color:'#5bc25b' }}>✓</span>}
          <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={handleShare}>
            {navigator.share ? t('shareStoryBtn') : t('copyStoryBtn')}
          </button>
        </div>
      </div>
      <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.8 }}>{text}</div>
    </div>
  )
}

// ─── Did You Know Card (v4.4) ─────────────────────────────────────────────────
function DidYouKnowCard({ log, recovery, profile, lang }) {
  const { t } = useContext(LangCtx)
  const [shownIds, setShownIds] = useLocalStorage('sporeus-shown-notes', [])
  const [noteIdx, setNoteIdx] = useState(0)

  const triggered = getTriggeredNotes(log, recovery, profile, shownIds)
  if (!triggered.length) return null

  const note = triggered[noteIdx % triggered.length]

  const handleNext = () => {
    setShownIds(prev => {
      const updated = [...new Set([...prev, note.id])]
      // Reset shown list every 7 days worth of notes (to allow repeats)
      return updated.length > 20 ? updated.slice(-7) : updated
    })
    setNoteIdx(i => i + 1)
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'59ms', borderLeft:'3px solid #f5c542' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
        <div style={{ ...S.mono, fontSize:'10px', fontWeight:600, color:'#f5c542', letterSpacing:'0.08em' }}>◈ {t('didYouKnowTitle')}</div>
        <button style={{ ...S.mono, fontSize:'10px', color:'#888', background:'transparent', border:'1px solid var(--border)', borderRadius:'3px', padding:'2px 8px', cursor:'pointer' }} onClick={handleNext}>
          {t('nextNoteBtn')}
        </button>
      </div>
      <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.8, marginBottom:'6px' }}>
        {note[lang] || note.en}
      </div>
      <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{note.source}</div>
    </div>
  )
}

// ─── Milestone Overlay (v4.4) ─────────────────────────────────────────────────
function MilestoneOverlay({ log, profile }) {
  const { t } = useContext(LangCtx)
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const [seenMilestones, setSeenMilestones] = useLocalStorage('sporeus-milestones', [])
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    if (!log.length) return
    const newOnes = detectMilestones(log, profile, seenMilestones)
    if (newOnes.length > 0) {
      setCurrent(newOnes[0])
      setSeenMilestones(prev => [...new Set([...prev, ...newOnes.map(m => m.id)])])
      const timer = setTimeout(() => setCurrent(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [log.length])

  if (!current) return null

  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'#000000cc', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={() => setCurrent(null)}>
      <div style={{ background:'var(--card-bg)', border:'2px solid #ff6600', borderRadius:'12px', padding:'32px 40px', textAlign:'center', maxWidth:'320px', animation:'sp-fade-in 0.3s ease' }}>
        <div style={{ fontSize:'48px', marginBottom:'12px' }}>{current.emoji}</div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600', letterSpacing:'0.12em', marginBottom:'8px' }}>{t('milestoneTitle')}</div>
        <div style={{ ...S.mono, fontSize:'16px', fontWeight:600, color:'var(--text)', lineHeight:1.5 }}>{current[lang] || current.en}</div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'12px' }}>tap to dismiss</div>
      </div>
    </div>
  )
}

// ─── Your Patterns Card (v4.5) ────────────────────────────────────────────────
function YourPatternsCard({ log, recovery, injuries, profile, lang }) {
  const { t } = useContext(LangCtx)
  const { testResults } = useData()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (log.length < 14) return null

  const trainTest  = correlateTrainingToResults(log, testResults)
  const recPat     = findRecoveryPatterns(log, recovery)
  const seasonal   = findSeasonalPatterns(log, recovery)
  const weekStruct = findOptimalWeekStructure(log, recovery)

  const allPatterns = [
    ...trainTest.patterns.map(p => ({ icon:'🔬', text: p[lang] || p.en, confidence: p.confidence, basis: `${trainTest.dataPoints} test results` })),
    ...(recPat.optimalReadiness ? [{ icon:'💤', text: recPat.optimalReadiness[lang] || recPat.optimalReadiness.en, confidence:'moderate', basis:`${recPat.sampleSize} sessions` }] : []),
    ...(recPat.optimalSleep     ? [{ icon:'💤', text: recPat.optimalSleep[lang]     || recPat.optimalSleep.en,     confidence:'moderate', basis:`${recPat.sampleSize} sessions` }] : []),
    ...(recPat.redFlags.map(rf  => ({ icon:'⚠', text: rf[lang] || rf.en, confidence:'moderate', basis:`${recPat.sampleSize} pairs` }))),
    ...(recPat.bestDay  ? [{ icon:'📅', text: recPat.bestDay[lang]  || recPat.bestDay.en,  confidence:'low', basis:'' }] : []),
    ...(recPat.worstDay ? [{ icon:'📅', text: recPat.worstDay[lang] || recPat.worstDay.en, confidence:'low', basis:'' }] : []),
    ...(seasonal.strongMonths.length ? [{ icon:'🌡️', text: seasonal[lang] || seasonal.en, confidence:'moderate', basis:`${log.length} sessions` }] : []),
    ...(weekStruct.reliable ? [{ icon:'📋', text: weekStruct[lang] || weekStruct.en, confidence:'moderate', basis:`${weekStruct.sampleSize} weeks` }] : []),
  ]

  // Data collection incentives (not enough data yet)
  const hints = [
    ...(testResults.length < 3 ? [{ icon:'🔬', text: lang==='tr' ? `Antrenman→test desenlerini bulmak için ${Math.max(0,3-testResults.length)} test sonucu daha gir.` : `${Math.max(0,3-testResults.length)} more test results needed to find your training→performance patterns.` }] : []),
    ...(recovery.length < 7    ? [{ icon:'💤', text: lang==='tr' ? `Optimal koşullarınızı bulmak için ${Math.max(0,7-recovery.length)} gün daha toparlanma kaydet.` : `Log recovery for ${Math.max(0,7-recovery.length)} more days to discover your optimal conditions.` }] : []),
    ...(!weekStruct.reliable && weekStruct.needMore > 0 ? [{ icon:'📋', text: lang==='tr' ? `Optimal hafta yapınızı bulmak için ${weekStruct.needMore} seans daha gerekiyor.` : `${weekStruct.needMore} more sessions needed to find your optimal week structure.` }] : []),
  ]

  if (allPatterns.length === 0 && hints.length === 0) return null

  const handleCopy = () => {
    const text = ['YOUR PERSONAL PATTERNS', '─'.repeat(30), ...allPatterns.map(p => `${p.icon} ${p.text}`)].join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const confColor = c => c === 'high' ? '#5bc25b' : c === 'moderate' ? '#f5c542' : '#888'

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'56ms' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div style={S.cardTitle}>{lang==='tr'?'SENİN DESENLERİN':'YOUR PATTERNS'}</div>
        <div style={{ display:'flex', gap:'6px' }}>
          {copied && <span style={{ ...S.mono, fontSize:'10px', color:'#5bc25b' }}>✓</span>}
          {allPatterns.length > 0 && <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={handleCopy}>⎘ Copy</button>}
          <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={() => setOpen(o => !o)}>{open ? '▲' : '▼'}</button>
        </div>
      </div>

      {allPatterns.length === 0 && hints.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {hints.map((h, i) => (
            <div key={i} style={{ ...S.mono, fontSize:'11px', color:'#888', lineHeight:1.6 }}>{h.icon} {h.text}</div>
          ))}
        </div>
      )}

      {allPatterns.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
          {allPatterns.slice(0, open ? undefined : 3).map((p, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
              <span style={{ fontSize:'16px', flexShrink:0 }}>{p.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ ...S.mono, fontSize:'11px', color:'var(--text)', lineHeight:1.7 }}>{p.text}</div>
                {p.basis && <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'2px' }}>based on {p.basis}</div>}
              </div>
              <span style={{ ...S.mono, fontSize:'9px', fontWeight:600, color:confColor(p.confidence), flexShrink:0, border:`1px solid ${confColor(p.confidence)}44`, padding:'1px 5px', borderRadius:'2px' }}>{p.confidence.toUpperCase()}</span>
            </div>
          ))}
          {!open && allPatterns.length > 3 && (
            <button style={{ ...S.mono, fontSize:'10px', color:'#888', background:'transparent', border:'none', cursor:'pointer', padding:'4px 0' }} onClick={() => setOpen(true)}>
              +{allPatterns.length - 3} more patterns →
            </button>
          )}
          {open && hints.length > 0 && (
            <div style={{ marginTop:'4px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
              {hints.map((h, i) => <div key={i} style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'4px' }}>{h.icon} {h.text}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Proactive Injury Alert (v4.5) ────────────────────────────────────────────
function ProactiveInjuryAlert({ log, injuries, lang }) {
  const injPatterns = mineInjuryPatterns(log, injuries, [])
  const highConf    = injPatterns.patterns.filter(p => p.confidence === 'high')
  if (!highConf.length) return null

  // Check if current week matches any trigger pattern
  const now  = new Date().toISOString().slice(0, 10)
  const w1   = (() => { const d = new Date(); d.setDate(d.getDate()-7);  return d.toISOString().slice(0,10) })()
  const w2   = (() => { const d = new Date(); d.setDate(d.getDate()-14); return d.toISOString().slice(0,10) })()
  const recent7  = log.filter(e => e.date >= w1)
  const recent14 = log.filter(e => e.date >= w2)

  const tss7  = recent7.reduce((s, e) => s + (e.tss || 0), 0)
  const tss14 = recent14.reduce((s, e) => s + (e.tss || 0), 0) / 2
  const prevTSS = log.filter(e => e.date >= w2 && e.date < w1).reduce((s, e) => s + (e.tss || 0), 0)
  const spikeP  = prevTSS > 0 ? (tss7 - prevTSS) / prevTSS * 100 : 0
  const longRun = Math.max(...recent7.map(e => e.duration || 0), 0)
  const consec  = (() => { let c = 0; for (const e of [...recent7].sort((a,b) => b.date>a.date?1:-1)) { if((e.rpe||0)>=7)c++;else break }; return c })()

  const active = highConf.filter(p => {
    if (p.triggers.includes('volume_spike') && spikeP > 20) return true
    if (p.triggers.includes('long_run_duration') && longRun > 90) return true
    if (p.triggers.includes('consecutive_hard_days') && consec >= 3) return true
    return false
  })

  if (!active.length) return null

  const zoneStr = active.map(p => p.zone).join(', ')
  return (
    <div className="sp-card" style={{ ...S.card, borderLeft:'4px solid #e03030', animationDelay:'0ms', background:'#e0303011' }}>
      <div style={{ ...S.mono, fontSize:'10px', color:'#e03030', letterSpacing:'0.08em', fontWeight:600, marginBottom:'6px' }}>
        ⚠ {lang==='tr'?'PROAKTİF YARALANMA UYARISI':'PROACTIVE INJURY RISK'}
      </div>
      <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.7, marginBottom:'8px' }}>
        {lang==='tr'
          ? `Bu haftaki antrenman deseni önceki ${zoneStr} sorunlarından önce gelen koşullarla eşleşiyor.`
          : `Current week matches conditions that preceded your previous ${zoneStr} injury issues.`}
      </div>
      {spikeP > 20 && <div style={{ ...S.mono, fontSize:'10px', color:'#e03030' }}>→ Volume spike: +{Math.round(spikeP)}% this week</div>}
      {longRun > 90 && <div style={{ ...S.mono, fontSize:'10px', color:'#e03030' }}>→ Long session: {longRun} min</div>}
      {consec >= 3  && <div style={{ ...S.mono, fontSize:'10px', color:'#e03030' }}>→ {consec} consecutive hard days</div>}
      <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', marginTop:'8px', lineHeight:1.6 }}>
        Suggestion: {lang==='tr'?'Yarınki seansı kolay çalışma ile değiştirin veya dinlenme günü ekleyin.':'Replace tomorrow\'s session with easy work or add a rest day.'}
      </div>
    </div>
  )
}

// ─── Race Readiness Gauge (v4.6) ──────────────────────────────────────────────
function RaceReadinessCard({ log, recovery, injuries, profile, plan, planStatus, lang }) {
  const { t } = useContext(LangCtx)
  const { testResults, raceResults: raceResult, setRaceResults: setRaceResult } = useData()
  const [expanded, setExpanded] = useState(false)
  const [showPostRace, setShowPostRace] = useState(false)
  const [resultForm, setResultForm] = useState({ time:'', conditions:'normal', feeling:'3', notes:'' })

  const raceDate = profile?.raceDate
  if (!raceDate && !profile?.goal) return null
  if (log.length < 7) return null

  const rr = computeRaceReadiness(log, recovery, injuries, profile, plan, planStatus)
  const perf = predictRacePerformance(log, testResults, profile)

  const gradeColor = { 'A+':'#f5c542', A:'#5bc25b', B:'#0064ff', C:'#f5c542', D:'#e03030', F:'#e03030' }[rr.grade] || '#888'

  // SVG ring gauge
  const R = 48, CX = 60, CY = 60, STROKE = 8
  const circumference = 2 * Math.PI * R
  const filled = circumference * rr.score / 100
  const dash   = `${filled} ${circumference - filled}`

  // Days to race display
  const daysDisp = rr.daysToRace !== null
    ? (rr.daysToRace <= 0 ? (lang==='tr'?'YARIŞ GÜNÜ!':'RACE DAY!') : `${lang==='tr'?'YARIŞA':'RACE IN'} ${rr.daysToRace} ${lang==='tr'?'GÜN':'DAYS'}`)
    : null

  // Race Week Mode: special header when ≤7 days
  const isRaceWeek = rr.daysToRace !== null && rr.daysToRace >= 0 && rr.daysToRace <= 7

  // Sorted factors: worst first
  const sortedFactors = [...rr.factors].sort((a, b) => (a.score * a.weight) - (b.score * b.weight))

  // Post-race: if raceDate passed
  const raceIsPast = raceDate && new Date(raceDate) < new Date()
  const hasResult  = raceResult.some(r => r.raceDate === raceDate)

  const saveResult = () => {
    const entry = { raceDate, ...resultForm, savedAt: new Date().toISOString() }
    const predicted = perf.predictions.find(p => (profile?.goal || '').toLowerCase().includes(p.label.toLowerCase()))
    if (predicted && resultForm.time) {
      const parts = resultForm.time.split(':').map(Number)
      const actualSec = parts.length === 3 ? parts[0]*3600+parts[1]*60+parts[2] : parts.length === 2 ? parts[0]*60+parts[1] : 0
      const predParts = predicted.predicted.split(':').map(Number)
      const predSec   = predParts.length === 3 ? predParts[0]*3600+predParts[1]*60+predParts[2] : predParts[0]*60+predParts[1]
      if (actualSec && predSec) {
        const delta = Math.round((predSec - actualSec) / predSec * 100)
        entry.accuracyDelta = delta
        entry.predictedTime = predicted.predicted
      }
    }
    setRaceResult(prev => [...prev, entry])
    setShowPostRace(false)
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'0ms', borderLeft:`4px solid ${gradeColor}`, ...(isRaceWeek ? { background: '#ff660008', border:`1px solid #ff660044` } : {}) }}>
      {isRaceWeek && (
        <div style={{ background:'#ff6600', margin:'-12px -16px 12px', padding:'10px 16px', borderRadius:'6px 6px 0 0' }}>
          <div style={{ ...S.mono, fontSize:'14px', fontWeight:700, color:'#fff', letterSpacing:'0.12em' }}>⚡ RACE WEEK</div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px', flexWrap:'wrap' }}>
        {/* SVG gauge */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE}/>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={gradeColor} strokeWidth={STROKE}
              strokeDasharray={dash} strokeDashoffset={circumference * 0.25}
              strokeLinecap="round" style={{ transition:'stroke-dasharray 0.5s ease' }}/>
            <text x={CX} y={CY - 6} textAnchor="middle" style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'22px', fontWeight:700, fill:gradeColor }}>{rr.grade}</text>
            <text x={CX} y={CY + 14} textAnchor="middle" style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', fill:'var(--sub)' }}>{rr.score}/100</text>
          </svg>
          <div style={{ ...S.mono, fontSize:'8px', color:'#888' }}>{rr.confidence.toUpperCase()} CONFIDENCE</div>
        </div>

        {/* Verdict + details */}
        <div style={{ flex:1, minWidth:'160px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
            <div style={S.cardTitle}>{lang==='tr'?'YARIŞ HAZIRLIĞI':'RACE READINESS'}</div>
            <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={() => setExpanded(e => !e)}>
              {expanded ? '▲' : '▼ DETAILS'}
            </button>
          </div>
          <div style={{ ...S.mono, fontSize:'11px', color:'var(--text)', lineHeight:1.7, marginBottom:'8px' }}>
            {rr.verdict[lang] || rr.verdict.en}
          </div>
          {daysDisp && (
            <div style={{ ...S.mono, fontSize:'10px', fontWeight:600, color:rr.daysToRace <= 7 ? '#ff6600' : '#888', marginBottom:'6px' }}>
              {daysDisp}
            </div>
          )}
          {perf.reliable && perf.predictions.length > 0 && (() => {
            const goalDist = profile?.goal?.toLowerCase() || ''
            const match = perf.predictions.find(p => goalDist.includes(p.label.toLowerCase())) || perf.predictions[1]
            if (!match) return null
            return (
              <div style={{ ...S.mono, fontSize:'10px', color:'#888', lineHeight:1.6 }}>
                Predicted: <strong style={{ color:'#ff6600' }}>{match.predicted}</strong> (best {match.best} — worst {match.worst})<br/>
                <span style={{ fontSize:'9px' }}>via {perf.method}</span>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Factor breakdown */}
      {expanded && (
        <div style={{ marginTop:'12px', borderTop:'1px solid var(--border)', paddingTop:'12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.06em', marginBottom:'8px' }}>FACTOR BREAKDOWN (worst first)</div>
          {sortedFactors.map(f => (
            <div key={f.name} style={{ marginBottom:'7px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2px' }}>
                <span style={{ ...S.mono, fontSize:'9px', color: f.score < 50 ? '#e03030' : f.score < 70 ? '#f5c542' : '#888', letterSpacing:'0.04em' }}>{f.name}</span>
                <span style={{ ...S.mono, fontSize:'10px', fontWeight:600, color: f.score < 50 ? '#e03030' : f.score < 70 ? '#f5c542' : '#5bc25b' }}>{f.score}/100</span>
              </div>
              <div style={{ width:'100%', height:'4px', background:'var(--border)', borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ width:`${f.score}%`, height:'100%', background: f.score < 50 ? '#e03030' : f.score < 70 ? '#f5c542' : '#5bc25b', borderRadius:'2px' }}/>
              </div>
              <div style={{ ...S.mono, fontSize:'9px', color:'var(--sub)', marginTop:'2px' }}>{f[lang] || f.en} (weight {Math.round(f.weight*100)}%)</div>
            </div>
          ))}

          {/* Race pacing predictions table */}
          {perf.reliable && perf.predictions.length > 0 && (
            <div style={{ marginTop:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#0064ff', letterSpacing:'0.06em', marginBottom:'6px' }}>RACE PREDICTIONS</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {perf.predictions.map(p => (
                  <div key={p.label} style={{ flex:'1 1 70px', textAlign:'center' }}>
                    <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{p.label}</div>
                    <div style={{ ...S.mono, fontSize:'13px', fontWeight:600, color:'#ff6600' }}>{p.predicted}</div>
                    <div style={{ ...S.mono, fontSize:'8px', color:'#888' }}>{p.best}–{p.worst}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...S.mono, fontSize:'8px', color:'#888', marginTop:'4px' }}>{perf.method}</div>
            </div>
          )}

          {/* Training Paces from VDOT Daniels table */}
          {perf.trainingPaces && (
            <div style={{ marginTop:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#ff6600', letterSpacing:'0.06em', marginBottom:'6px' }}>
                YOUR TRAINING PACES · VDOT {perf.trainingPaces.vdot}
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {[
                  { lbl:'E  EASY',      val: perf.trainingPaces.easy,      color:'#5bc25b' },
                  { lbl:'M  MARATHON',  val: perf.trainingPaces.marathon,  color:'#0064ff' },
                  { lbl:'T  THRESHOLD', val: perf.trainingPaces.threshold, color:'#ff6600' },
                  { lbl:'I  INTERVAL',  val: perf.trainingPaces.interval,  color:'#f5c542' },
                  { lbl:'R  REPS',      val: perf.trainingPaces.rep,       color:'#e03030' },
                ].map(({ lbl, val, color }) => (
                  <div key={lbl} style={{ flex:'1 1 70px', textAlign:'center' }}>
                    <div style={{ ...S.mono, fontSize:'10px', fontWeight:700, color }}>{val}</div>
                    <div style={{ ...S.mono, fontSize:'7px', color:'#555', letterSpacing:'0.08em', marginTop:'2px' }}>{lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...S.mono, fontSize:'8px', color:'#555', marginTop:'4px' }}>min:sec per km · Daniels 1998</div>
            </div>
          )}
        </div>
      )}

      {/* Race Week taper checklist */}
      {isRaceWeek && rr.daysToRace >= 0 && (
        <div style={{ marginTop:'12px', borderTop:'1px solid #ff660033', paddingTop:'12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#ff6600', letterSpacing:'0.06em', marginBottom:'8px' }}>TAPER CHECKLIST</div>
          {[
            { day: 6, en:"Last hard session — threshold or race-pace intervals", tr:"Son zorlu seans — eşik veya yarış temposu aralıklar" },
            { day: 5, en:"Easy run only — shakeout pace", tr:"Sadece kolay koşu — hafif tempo" },
            { day: 4, en:"Easy or rest — begin carb loading (8g/kg)", tr:"Kolay ya da dinlenme — karbonhidrat yüklemesi başlat (8g/kg)" },
            { day: 3, en:"Easy 30min — hydration focus — lay out race kit", tr:"30 dak kolay — sıvı alımına odaklan — yarış ekipmanını hazırla" },
            { day: 2, en:"Complete rest or light walk", tr:"Tam dinlenme veya hafif yürüyüş" },
            { day: 1, en:"Rest — pasta dinner — visualize the course — sleep early", tr:"Dinlenme — makarna — güzergahı zihinsel prova et — erken uyu" },
            { day: 0, en:"RACE DAY — trust the training", tr:"YARIŞ GÜNÜ — antrenmanına güven" },
          ].filter(c => c.day >= rr.daysToRace).map(c => {
            const isToday = c.day === rr.daysToRace
            return (
              <div key={c.day} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'5px 0', borderBottom:'1px solid var(--border)', opacity: isToday ? 1 : 0.6 }}>
                <span style={{ ...S.mono, fontSize:'10px', color: isToday ? '#ff6600' : '#888', minWidth:'50px' }}>
                  {c.day === 0 ? '🏁 TODAY' : `D-${c.day}`}
                </span>
                <span style={{ ...S.mono, fontSize:'10px', color: isToday ? 'var(--text)' : 'var(--sub)', lineHeight:1.6 }}>
                  {c[lang] || c.en}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Post-race analysis */}
      {raceIsPast && !hasResult && (
        <div style={{ marginTop:'12px', borderTop:'1px solid var(--border)', paddingTop:'10px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', marginBottom:'8px' }}>📝 How did it go? Log your result.</div>
          {!showPostRace ? (
            <button style={{ ...S.btn, fontSize:'11px', padding:'6px 14px' }} onClick={() => setShowPostRace(true)}>
              {lang==='tr'?'Yarış Sonucunu Kaydet':'Log Race Result'}
            </button>
          ) : (
            <div>
              <div style={S.row}>
                <div style={{ flex:'1 1 130px' }}>
                  <label style={S.label}>FINISH TIME (hh:mm:ss)</label>
                  <input style={S.input} placeholder="3:28:45" value={resultForm.time} onChange={e=>setResultForm(f=>({...f,time:e.target.value}))}/>
                </div>
                <div style={{ flex:'1 1 130px' }}>
                  <label style={S.label}>CONDITIONS</label>
                  <select style={S.input} value={resultForm.conditions} onChange={e=>setResultForm(f=>({...f,conditions:e.target.value}))}>
                    {['normal','hot','cold','windy','hilly','wet'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:'8px' }}>
                <label style={S.label}>OVERALL FEELING</label>
                <div style={{ display:'flex', gap:'8px' }}>
                  {['😞','😕','😐','🙂','😄'].map((em,i)=>(
                    <button key={i} onClick={()=>setResultForm(f=>({...f,feeling:String(i+1)}))}
                      style={{ fontSize:'20px', padding:'4px 8px', borderRadius:'4px', border:`2px solid ${resultForm.feeling===String(i+1)?'#ff6600':'var(--border)'}`, background:resultForm.feeling===String(i+1)?'#ff660022':'transparent', cursor:'pointer' }}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button style={S.btn} onClick={saveResult}>{lang==='tr'?'Kaydet':'Save'}</button>
                <button style={S.btnSec} onClick={()=>setShowPostRace(false)}>{lang==='tr'?'Vazgeç':'Cancel'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show last result accuracy */}
      {hasResult && (() => {
        const r = raceResult.find(x => x.raceDate === raceDate)
        if (!r || r.accuracyDelta === undefined) return null
        const delta = r.accuracyDelta
        const color = Math.abs(delta) <= 3 ? '#5bc25b' : '#f5c542'
        return (
          <div style={{ marginTop:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
            <div style={{ ...S.mono, fontSize:'10px', color:color, fontWeight:600 }}>
              {delta > 0 ? `🏆 ${delta}% faster than predicted!` : delta < 0 ? `${Math.abs(delta)}% slower than predicted` : '✓ Prediction was spot-on!'}
            </div>
            <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'2px' }}>Predicted: {r.predictedTime} · Actual: {r.time}</div>
          </div>
        )
      })()}
    </div>
  )
}

export default function Dashboard({ log, profile }) {
  const [dark] = useLocalStorage('sporeus-dark', false)
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const [plan] = useLocalStorage('sporeus-plan', null)
  const [planStatus] = useLocalStorage('sporeus-plan-status', {})
  const { recovery, injuries, testResults, raceResults } = useData()
  const [myCoach] = useLocalStorage('sporeus-my-coach', null)
  const [reportVisible, setReportVisible] = useState(false)
  const { t } = useContext(LangCtx)
  const sportLabel = SPORT_BRANCHES.find(b=>b.id===profile.primarySport)?.label || profile.sport || ''
  const levelLabel = ATHLETE_LEVELS.find(l=>l.id===profile.athleteLevel)?.label || ''
  const lc = LEVEL_CONFIG[profile.athleteLevel] || LEVEL_CONFIG.competitive
  const [showAdvanced, setShowAdvanced] = useState(false)
  const defaultLayout = Object.fromEntries(DASH_CARD_DEFS.map(c => [c.id, true]))
  const [dashLayout, setDashLayout] = useLocalStorage('sporeus-dash-layout', defaultLayout)
  const [showCustomize, setShowCustomize] = useState(false)
  const dl = { ...defaultLayout, ...dashLayout }
  const toggleCard = id => setDashLayout(prev => ({ ...defaultLayout, ...prev, [id]: !prev[id] }))
  const last7 = log.slice(-7)
  const totalTSS = last7.reduce((s,e)=>s+(e.tss||0),0)
  const totalMin = last7.reduce((s,e)=>s+(e.duration||0),0)
  const avgRPE   = last7.length ? (last7.reduce((s,e)=>s+(e.rpe||0),0)/last7.length).toFixed(1) : '\u2014'
  const { atl, ctl, tsb, daily } = calcLoad(log)
  const acwr = calculateACWR(log)
  const readiness = totalTSS>600?{label:t('fatigued'),color:'#e03030'}:totalTSS>400?{label:t('trained'),color:'#f5c542'}:{label:t('fresh'),color:'#5bc25b'}
  const tsbColor = tsb>5?'#5bc25b':tsb<-10?'#e03030':'#f5c542'
  const countSess = useCountUp(last7.length)
  const countTSS  = useCountUp(totalTSS)
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()

  // Coaching message — tone adapts to athlete level
  const coachingMsg = (() => {
    const lvl = profile.athleteLevel || 'competitive'
    const isBusy = totalTSS > 400
    if (lvl==='beginner') return isBusy
      ? "Take it easy today — rest is part of training!"
      : "Keep showing up — consistency beats intensity every time."
    if (!isBusy) return null
    if (lvl==='recreational') return "Consider an easy session today — your body needs recovery."
    if (lvl==='competitive') return `Readiness low — consider swapping tomorrow's tempo for an easy run.`
    return `TSB ${tsb>=0?'+':''}${tsb} · High load detected — deload recommended. Swap threshold → Z2 45min.`
  })()

  const dqResult = assessDataQuality(log, recovery, testResults, profile)
  const [showDQ, setShowDQ] = useState(false)

  const headerBadges = (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'6px', alignItems:'center' }}>
      {sportLabel && (
        <span style={{ ...S.mono, fontSize:'10px', color:'#ff6600', border:'1px solid #ff660044', padding:'2px 7px', borderRadius:'2px' }}>
          {sportLabel.toUpperCase()}
          {profile.triathlonType && profile.primarySport==='triathlon' ? ` · ${profile.triathlonType.toUpperCase()}` : ''}
        </span>
      )}
      {levelLabel && (
        <span style={{ ...S.mono, fontSize:'10px', color:'#4a90d9', border:'1px solid #4a90d944', padding:'2px 7px', borderRadius:'2px' }}>
          {levelLabel.toUpperCase()}
        </span>
      )}
      {myCoach==='huseyin-sporeus' && (
        <span style={{ ...S.mono, fontSize:'10px', color:'#5bc25b', border:'1px solid #5bc25b44', padding:'2px 7px', borderRadius:'2px' }}>
          ◈ COACH: HÜSEYİN AKBULUT
        </span>
      )}
      <button
        onClick={() => setShowDQ(s => !s)}
        title="Data quality — click for tips"
        style={{ ...S.mono, fontSize:'10px', color: dqResult.gradeColor, border:`1px solid ${dqResult.gradeColor}44`, padding:'2px 7px', borderRadius:'2px', background:'transparent', cursor:'pointer', letterSpacing:'0.06em' }}>
        DATA: {dqResult.grade} {dqResult.score}/100
      </button>
      {showDQ && (
        <div style={{ width:'100%', background:'var(--card-bg)', border:`1px solid ${dqResult.gradeColor}44`, borderRadius:'5px', padding:'10px 12px', marginTop:'4px' }}>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'8px' }}>
            {dqResult.factors.map(f => (
              <div key={f.name} style={{ textAlign:'center', minWidth:'56px' }}>
                <div style={{ ...S.mono, fontSize:'14px', fontWeight:700, color: f.score>=80?'#5bc25b':f.score>=60?'#0064ff':f.score>=40?'#f5c542':'#e03030' }}>{f.score}</div>
                <div style={{ ...S.mono, fontSize:'8px', color:'#555', letterSpacing:'0.06em' }}>{f.name}</div>
              </div>
            ))}
          </div>
          {dqResult.tips.length > 0 && (
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', lineHeight:1.7, borderTop:'1px solid var(--border)', paddingTop:'6px' }}>
              {dqResult.tips.map((tip,i) => <div key={i}>→ {lang==='tr'?tip.tr:tip.en}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ── Beginner simplified dashboard ────────────────────────────────────────────
  if (lc.dashSimple && !showAdvanced) {
    return (
      <div className="sp-fade">
        <div style={{ marginBottom:'16px' }}>
          <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginBottom:'4px' }}>{today}</div>
          <div style={{ ...S.mono, fontSize:'18px', fontWeight:600 }}>
            {profile.name ? `ATHLETE: ${profile.name.toUpperCase()}` : t('appTitle')}
          </div>
          {headerBadges}
        </div>

        <div className="sp-card" style={{ ...S.row, marginBottom:'16px', animationDelay:'0ms' }}>
          {[
            { val:countSess, lbl:t('sessions') },
            { val:`${Math.floor(totalMin/60)}h ${totalMin%60}m`, lbl:t('volume') },
            { val:avgRPE, lbl:t('avgRpe') },
          ].map(({val,lbl})=>(
            <div key={lbl} style={S.stat}>
              <span style={S.statVal}>{val}</span>
              <span style={S.statLbl}>{lbl}</span>
            </div>
          ))}
        </div>

        <div className="sp-card" style={{ ...S.card, animationDelay:'50ms', borderLeft:'4px solid #5bc25b' }}>
          <div style={{ ...S.mono, fontSize:'12px', lineHeight:1.8, color:'var(--text)' }}>{coachingMsg}</div>
          {avgRPE!=='—' && (
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'8px' }}>
              {parseFloat(avgRPE)>=7 ? '⚠ Average RPE is high this week — include easy days.' : parseFloat(avgRPE)<5 ? '✓ Low-RPE week — body recovering well.' : '○ Moderate effort week — on track.'}
            </div>
          )}
        </div>

        <div className="sp-card" style={{ ...S.card, animationDelay:'80ms' }}>
          <div style={S.cardTitle}>{t('recentSessions')}</div>
          {last7.length===0 ? (
            <div style={{ ...S.mono, fontSize:'12px', color:'#aaa', textAlign:'center', padding:'20px 0' }}>{t('noSessions')}</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)', color:'#888', fontSize:'10px' }}>
                  {[t('dateL'),'TYPE','MIN','RPE'].map(h=>(
                    <th key={h} style={{ textAlign:'left', padding:'4px 0 8px', fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...last7].reverse().map((s,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'6px 0', color:'var(--sub)' }}>{s.date}</td>
                    <td style={{ padding:'6px 0' }}>{s.type}</td>
                    <td style={{ padding:'6px 0' }}>{s.duration}</td>
                    <td style={{ padding:'6px 0', color:s.rpe>=8?'#e03030':s.rpe>=6?'#f5c542':'#5bc25b' }}>{s.rpe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Achievements log={log} dark={dark} lang={lang}/>

        <div style={{ textAlign:'center', padding:'20px 0' }}>
          <button style={{ ...S.btnSec, fontSize:'11px' }} onClick={()=>setShowAdvanced(true)}>
            SHOW ADVANCED ANALYTICS ↓
          </button>
        </div>
      </div>
    )
  }
  // ── End beginner simplified dashboard ────────────────────────────────────────

  return (
    <div className="sp-fade">
      <MilestoneOverlay log={log} profile={profile}/>
      <BackupReminder log={log}/>
      <div style={{ marginBottom:'16px' }}>
        <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginBottom:'4px' }}>{today}</div>
        <div style={{ ...S.mono, fontSize:'18px', fontWeight:600 }}>
          {profile.name ? `ATHLETE: ${profile.name.toUpperCase()}` : t('appTitle')}
        </div>
        {headerBadges}
        {showAdvanced && (
          <button style={{ ...S.btnSec, fontSize:'10px', marginTop:'8px', padding:'3px 8px' }} onClick={()=>setShowAdvanced(false)}>
            ← SIMPLE VIEW
          </button>
        )}
        <button style={{ ...S.mono, fontSize:'9px', color:'var(--muted)', background:'transparent', border:'1px solid var(--border)', borderRadius:'3px', padding:'2px 8px', cursor:'pointer', marginTop:'8px', marginLeft:'8px' }} onClick={()=>setShowCustomize(s=>!s)}>
          ⚙ Customize Dashboard
        </button>
        {showCustomize && (
          <div style={{ marginTop:'10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'12px' }}>
            <div style={{ ...S.mono, fontSize:'10px', color:'var(--muted)', marginBottom:'8px', letterSpacing:'0.06em' }}>SHOW / HIDE CARDS</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
              {DASH_CARD_DEFS.map(card => (
                <label key={card.id} style={{ display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', ...S.mono, fontSize:'11px', color: dl[card.id] ? 'var(--text)' : 'var(--muted)' }}>
                  <input type="checkbox" checked={!!dl[card.id]} onChange={() => toggleCard(card.id)} style={{ accentColor:'#ff6600' }}/>
                  {card.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {dl.readiness && <div className="sp-card" style={{ ...S.card, borderLeft:`4px solid ${readiness.color}`, animationDelay:'0ms' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={S.cardTitle}>{t('readiness')}</div>
            <span style={S.tag(readiness.color)}>{readiness.label}</span>
            {lc.showCTL && (
              <div style={{ display:'flex', gap:'16px', marginTop:'10px', flexWrap:'wrap' }}>
                {[
                  { lbl:t('ctlLabel'), v:ctl,  c:'#0064ff', tip:'Chronic Training Load — your fitness. Higher = fitter. 42-day average of daily TSS.' },
                  { lbl:t('atlLabel'), v:atl,  c:'#ef4444', tip:'Acute Training Load — your fatigue. 7-day average. Drops after rest days.' },
                  { lbl:t('tsbLabel'), v:(tsb>=0?'+':'')+tsb, c:tsbColor, tip:'Training Stress Balance = CTL − ATL. Positive = fresh, ready to race. Negative = fatigued.' },
                ].map(({lbl,v,c,tip})=>(
                  <div key={lbl}>
                    <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.08em', display:'flex', alignItems:'center' }}>
                      {lbl}<HelpTip text={tip}/>
                    </div>
                    <div style={{ ...S.mono, fontSize:'16px', fontWeight:600, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ ...S.mono, fontSize:'40px', fontWeight:600, color:readiness.color }}>{countTSS}</div>
        </div>
        {coachingMsg && (
          <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', marginTop:'10px', padding:'7px 10px', background:'var(--card-bg)', borderRadius:'4px', lineHeight:1.7, borderLeft:'3px solid #ff660066' }}>
            ◈ {coachingMsg}
          </div>
        )}
      </div>}

      <RaceReadinessCard log={log} recovery={recovery} injuries={injuries} profile={profile} plan={plan} planStatus={planStatus} lang={lang}/>
      <ProactiveInjuryAlert log={log} injuries={injuries} lang={lang}/>
      {recovery.some(e => parseFloat(e.hrv) > 0) && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'20ms' }}>
          <div style={S.cardTitle}>HRV TREND</div>
          <HRVChart recovery={recovery} days={30} />
        </div>
      )}
      <InsightsCard log={log} recovery={recovery} profile={profile} lang={lang}/>
      <YourPatternsCard log={log} recovery={recovery} injuries={injuries} profile={profile} lang={lang}/>
      <WeekStoryCard log={log} recovery={recovery} profile={profile} lang={lang}/>
      <DidYouKnowCard log={log} recovery={recovery} profile={profile} lang={lang}/>

      {dl.stats && <div className="sp-card" style={{ ...S.row, marginBottom:'16px', animationDelay:'50ms' }}>
        {[
          { val:countSess,                                   lbl:t('sessions') },
          { val:`${Math.floor(totalMin/60)}h ${totalMin%60}m`, lbl:t('volume') },
          { val:avgRPE,                                       lbl:t('avgRpe') },
          { val:totalTSS,                                     lbl:t('tss7'), tip:'Training Stress Score. Combines duration × intensity². Easy day ~50, hard day ~100+.' },
        ].map(({val,lbl,tip})=>(
          <div key={lbl} style={S.stat}>
            <span style={S.statVal}>{val}</span>
            <span style={S.statLbl}>{lbl}{tip && <HelpTip text={tip}/>}</span>
          </div>
        ))}
      </div>}

      {dl.chart && <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
        <div style={S.cardTitle}>{t('tssChartTitle')}</div>
        {daily.length === 0 ? (
          <div style={{ textAlign:'center', padding:'28px 0' }}>
            <div style={{ ...S.mono, fontSize:'13px', color:'#555', marginBottom:'6px' }}>No sessions yet</div>
            <div style={{ ...S.mono, fontSize:'11px', color:'#888', lineHeight:1.7 }}>
              Log your first session to see your fitness trend here.<br/>
              Tap the <span style={{ color:'#ff6600' }}>Log</span> tab →
            </div>
          </div>
        ) : (
          <TSSChart daily={daily} t={t} />
        )}
      </div>}

      {dl.sessions && <div className="sp-card" style={{ ...S.card, animationDelay:'150ms' }}>
        <div style={S.cardTitle}>{t('recentSessions')}</div>
        {last7.length===0 ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ ...S.mono, fontSize:'13px', color:'#555', marginBottom:'6px' }}>No sessions this week</div>
            <div style={{ ...S.mono, fontSize:'11px', color:'#888', lineHeight:1.7 }}>
              Log a session to start tracking your progress.<br/>
              Takes less than 30 seconds →
            </div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', color:'#888', fontSize:'10px', letterSpacing:'0.06em' }}>
                {[t('dateL'),'TYPE','MIN','RPE','TSS'].map(h=>(
                  <th key={h} style={{ textAlign:h==='TSS'||h==='MIN'||h==='RPE'?'right':'left', padding:'4px 6px 8px 0', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...last7].reverse().map((s,i)=>(
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 6px 6px 0', color:'var(--sub)' }}>{s.date}</td>
                  <td style={{ padding:'6px 6px 6px 0' }}>{s.type}</td>
                  <td style={{ textAlign:'right', padding:'6px 6px 6px 0' }}>{s.duration}</td>
                  <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:s.rpe>=8?'#e03030':s.rpe>=6?'#f5c542':'#5bc25b' }}>{s.rpe}</td>
                  <td style={{ textAlign:'right', padding:'6px 0', color:'#ff6600', fontWeight:600 }}>{s.tss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>}

      {dl.weekly && log.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'170ms' }}>
          <div style={S.cardTitle}>WEEKLY VOLUME — LAST 8 WEEKS</div>
          <WeeklyVolChart log={log}/>
        </div>
      )}

      {dl.zones && lc.showZoneDonut && log.length>0 && (() => {
        const { mono, strain } = monotonyStrain(log)
        const monoRed = mono>2.0, strainRed = strain>6000
        return (
          <div className="sp-card" style={{ ...S.row, marginBottom:'16px', animationDelay:'180ms' }}>
            <div style={{ ...S.card, flex:'1 1 200px', marginBottom:0 }}>
              <div style={S.cardTitle}>ZONE DISTRIBUTION</div>
              <ZoneDonut log={log}/>
            </div>
            {lc.showMonotony && (
              <div style={{ flex:'1 1 200px', display:'flex', flexDirection:'column', gap:'8px' }}>
                <div style={{ ...S.card, marginBottom:0, borderLeft:`3px solid ${monoRed?'#e03030':'#5bc25b'}` }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>MONOTONY INDEX</div>
                  <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:monoRed?'#e03030':'#1a1a1a' }}>{mono}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>{monoRed?'⚠ INJURY RISK':'Normal'} (alert &gt;2.0)</div>
                </div>
                <div style={{ ...S.card, marginBottom:0, borderLeft:`3px solid ${strainRed?'#e03030':'#5bc25b'}` }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>STRAIN INDEX</div>
                  <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:strainRed?'#e03030':'#1a1a1a' }}>{strain}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>{strainRed?'⚠ HIGH':'Normal'} (alert &gt;6000)</div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {dl.records && log.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'190ms' }}>
          <div style={S.cardTitle}>🏆 PERSONAL RECORDS</div>
          <div style={S.row}>
            {calcPRs(log).map(pr=>(
              <div key={pr.label} style={{ ...S.stat, flex:'1 1 130px', textAlign:'left', padding:'10px 12px' }}>
                <span style={{ ...S.statVal, fontSize:'15px', textAlign:'left' }}>{pr.value}</span>
                <span style={S.statLbl}>{pr.label}</span>
                {pr.date&&<div style={{ ...S.mono, fontSize:'9px', color:'var(--sub)', marginTop:'2px' }}>{pr.date} · {pr.unit}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {dl.timeline && lc.showCTL && log.length>3 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'195ms' }}>
          <div style={S.cardTitle}>PERFORMANCE MANAGEMENT CHART (90d)</div>
          {/* ACWR · Monotony · Strain badges */}
          {(() => {
            const { mono, strain } = monotonyStrain(log)
            const acwrColor = acwr.status === 'danger' ? '#e03030'
              : acwr.status === 'caution'       ? '#f5c542'
              : acwr.status === 'optimal'        ? '#5bc25b'
              : '#888'
            return (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', margin:'6px 0 10px' }}>
                {acwr.ratio !== null && (
                  <span style={{ ...S.mono, fontSize:'10px', padding:'2px 7px', border:`1px solid ${acwrColor}44`, borderRadius:'2px', color: acwrColor }}>
                    ACWR {acwr.ratio} · {acwr.status.toUpperCase()}
                  </span>
                )}
                <span style={{ ...S.mono, fontSize:'10px', padding:'2px 7px', border:`1px solid ${mono>2?'#e03030':'#333'}44`, borderRadius:'2px', color: mono>2?'#e03030':'#888' }}>
                  MONOTONY {mono}{mono>2?' ⚠':''}
                </span>
                <span style={{ ...S.mono, fontSize:'10px', padding:'2px 7px', border:'1px solid #33333344', borderRadius:'2px', color:'#888' }}>
                  STRAIN {strain}
                </span>
              </div>
            )
          })()}
          <CTLChart log={log} days={90} raceResults={raceResults} />
          <div style={{ height:'16px' }}/>
          <LoadChart log={log} weeks={10} />
          <div style={{ height:'16px' }}/>
          <ZoneChart log={log} weeks={8} />
        </div>
      )}

      {dl.body && (() => {
        const h = parseFloat(profile.height||0), w = parseFloat(profile.weight||0)
        const a = parseFloat(profile.age||0), g = profile.gender||'male'
        const n = parseFloat(profile.neck||0), wa = parseFloat(profile.waist||0), hi_p = parseFloat(profile.hip||0)
        const bf = (n&&wa&&h) ? navyBF(n, wa, hi_p, h, g) : null
        const bmi = (w&&h) ? Math.round(w/(h/100)**2*10)/10 : null
        const bmr = (w&&h&&a) ? mifflinBMR(w,h,a,g) : null
        if (!bf && !bmi) return null
        const bfColor = g==='male' ? (bf<10?'#4a90d9':bf<20?'#5bc25b':bf<25?'#f5c542':'#e03030') : (bf<20?'#4a90d9':bf<28?'#5bc25b':bf<35?'#f5c542':'#e03030')
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'198ms' }}>
            <div style={S.cardTitle}>BODY COMPOSITION</div>
            <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
              {bf !== null && (
                <div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>BODY FAT (NAVY)</div>
                  <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:bfColor }}>{bf}%</div>
                </div>
              )}
              {bmi !== null && (
                <div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>BMI</div>
                  <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:bmi<18.5||bmi>=30?'#e03030':bmi<25?'#5bc25b':'#f5c542' }}>{bmi}</div>
                </div>
              )}
              {bmr !== null && (
                <div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>BMR (TDEE@1.55)</div>
                  <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:'var(--text)' }}>{Math.round(bmr*1.55)}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>kcal/day</div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {dl.predictions && (() => {
        if (!profile.ftp && !profile.ltPace) return null
        const ftp = parseFloat(profile.ftp||0)
        const ltPaceSec = profile.ltPace ? profile.ltPace.split(':').reduce((a,v,i,arr)=>a+(arr.length===3?[3600,60,1][i]:i===0?60:1)*parseFloat(v),0) : 0
        if (!ftp && !ltPaceSec) return null
        const targets = [
          {label:'5K', m:5000},{label:'10K', m:10000},{label:'HM', m:21097},{label:'Marathon', m:42195}
        ]
        const d1 = ltPaceSec ? 1000 : 0
        const t1 = ltPaceSec ? ltPaceSec : 0
        if (!t1) return null
        const preds = targets.map(({label,m})=>({ label, time:fmtSec(riegel(t1,d1,m)), pace:fmtPace(riegel(t1,d1,m),m) }))
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'199ms' }}>
            <div style={S.cardTitle}>RACE PREDICTIONS (RIEGEL)</div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {preds.map(p=>(
                <div key={p.label} style={{ flex:'1 1 100px', background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'5px', padding:'10px 12px' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{p.label}</div>
                  <div style={{ ...S.mono, fontSize:'15px', fontWeight:600, color:'#ff6600' }}>{p.time}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'var(--sub)' }}>{p.pace}/km</div>
                </div>
              ))}
            </div>
            <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'6px' }}>Based on LT pace · Riegel formula</div>
          </div>
        )
      })()}

      {dl.achievements !== false && <Achievements log={log} dark={dark} lang={lang}/>}

      {/* Goal Countdown */}
      {dl.goal && lc.showTaper && plan && (() => {
        const startDate = new Date(plan.generatedAt)
        const raceDate = new Date(startDate)
        raceDate.setDate(raceDate.getDate() + plan.weeks.length * 7)
        const todayD = new Date(); todayD.setHours(0,0,0,0)
        const daysLeft = Math.round((raceDate - todayD) / 864e5)
        const weeksElapsed = Math.min(Math.floor((todayD - startDate) / (7*864e5)), plan.weeks.length)
        const progressPct = Math.round(weeksElapsed / plan.weeks.length * 100)
        const currentPhase = plan.weeks[Math.min(weeksElapsed, plan.weeks.length-1)]?.phase || ''
        const phaseMotivation = {
          Base:'Building your aerobic engine — every easy mile counts.',
          Build:'Threshold is developing — discomfort is adaptation.',
          Peak:'Race-specific fitness peaking — trust the hard work.',
          Taper:'Taper mode — your body is supercompensating. Trust it.',
          Recovery:'Recovery week — adaptation happens here, not in workouts.',
          'Race Week':'RACE WEEK — warm up, execute, enjoy every meter.',
        }[currentPhase] || 'Stay consistent. Every session compounds.'
        const borderColor = daysLeft <= 7 ? '#ff6600' : daysLeft <= 21 ? '#f5c542' : '#0064ff'

        return (
          <div className="sp-card" style={{ ...S.card, borderLeft:`4px solid ${borderColor}`, animationDelay:'191ms' }}>
            {daysLeft <= 0 ? (
              <div style={{ ...S.mono, fontSize:'20px', fontWeight:600, color:'#ff6600', textAlign:'center', padding:'12px 0' }}>
                🏁 RACE DAY — {plan.goal.toUpperCase()}
              </div>
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                  <div>
                    <div style={S.cardTitle}>{plan.goal.toUpperCase()} IN</div>
                    <div style={{ ...S.mono, fontSize:'32px', fontWeight:600, color:borderColor }}>{daysLeft}</div>
                    <div style={{ ...S.mono, fontSize:'10px', color:'var(--muted)' }}>DAYS</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'4px' }}>PLAN PROGRESS</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <div style={{ width:'80px', height:'8px', background:'var(--border)', borderRadius:'4px', overflow:'hidden' }}>
                        <div style={{ width:`${progressPct}%`, height:'100%', background:borderColor, borderRadius:'4px' }}/>
                      </div>
                      <span style={{ ...S.mono, fontSize:'12px', fontWeight:600, color:borderColor }}>{progressPct}%</span>
                    </div>
                    <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'4px' }}>PHASE: <strong style={{ color:'var(--text)' }}>{currentPhase?.toUpperCase()}</strong></div>
                  </div>
                </div>
                {daysLeft <= 7 && <div style={{ ...S.mono, fontSize:'11px', color:'#ff6600', marginTop:'8px', padding:'6px 10px', background:'#ff660011', borderRadius:'4px' }}>⚡ TAPER MODE — trust the training</div>}
                <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', marginTop:'8px', lineHeight:1.6 }}>◈ {phaseMotivation}</div>
              </>
            )}
          </div>
        )
      })()}

      {/* Weekly Report */}
      {(() => {
        const recLast7 = recovery.filter(e=>{
          const d=new Date(e.date),cutoff=new Date(); cutoff.setDate(cutoff.getDate()-7)
          return d>=cutoff
        })
        const avgRec = recLast7.length ? Math.round(recLast7.reduce((s,e)=>s+(e.score||0),0)/recLast7.length) : null
        const {mono:monoIdx, strain:strainIdx} = last7.length ? (() => { try { return require('../lib/formulas').monotonyStrain(log) } catch { return {mono:0,strain:0} } })() : {mono:0,strain:0}

        const generateReport = () => {
          const { mono, strain } = monotonyStrain(log)
          const zoneDonutData = (() => {
            const zm=[0,0,0,0,0]
            last7.forEach(e=>{
              const dur=e.duration||0
              if(e.zones&&e.zones.some(z=>z>0)) e.zones.forEach((z,i)=>{zm[i]+=z})
              else { const r=e.rpe||5; zm[r<=3?0:r<=5?1:r<=7?2:r===8?3:4]+=dur }
            })
            const tot=zm.reduce((s,v)=>s+v,0)||1
            return zm.map((v,i)=>({name:['Z1','Z2','Z3','Z4','Z5'][i],pct:Math.round(v/tot*100)})).filter(z=>z.pct>0)
          })()

          // Plan compliance this week
          const thisWeekIdx = plan ? Math.min(Math.floor((new Date()-new Date(plan.generatedAt))/(7*864e5)), plan.weeks.length-1) : -1
          let complianceStr = ''
          if (thisWeekIdx >= 0 && plan) {
            const w = plan.weeks[thisWeekIdx]
            let tot=0,done=0
            w.sessions.forEach((s,di)=>{ if(s.type!=='Rest'&&s.duration>0){tot++;const st=planStatus[`${thisWeekIdx}-${di}`];if(st==='done'||st==='modified')done++} })
            if (tot) complianceStr = `${Math.round(done/tot*100)}% week compliance`
          }

          const html = `<div style="font-family:'Courier New',monospace;font-size:12px;color:#1a1a1a;max-width:480px">
<div style="background:#0a0a0a;color:#ff6600;padding:8px 12px;font-weight:600;font-size:14px">◈ SPOREUS WEEKLY REPORT</div>
<div style="padding:12px;background:#f8f8f8">
<div style="margin-bottom:8px;font-size:11px;color:#888">${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px">
<span><strong>${last7.length}</strong> sessions</span>
<span><strong>${Math.floor(totalMin/60)}h ${totalMin%60}m</strong> volume</span>
<span><strong>${totalTSS}</strong> TSS</span>
<span>RPE avg <strong>${avgRPE}</strong></span>
</div>
${zoneDonutData.map(z=>`<div>${z.name}: ${z.pct}%</div>`).join('')}
${avgRec!==null?`<div style="margin-top:8px">Recovery score avg: <strong>${avgRec}/100</strong></div>`:''}
${complianceStr?`<div>Plan: <strong>${complianceStr}</strong></div>`:''}
<div style="margin-top:8px;font-size:10px;color:#888">sporeus.com — Science-based training</div>
</div></div>`

          if (navigator.share) {
            navigator.share({ title:'Sporeus Weekly Report', text: `${last7.length} sessions | ${totalTSS} TSS | ${Math.floor(totalMin/60)}h ${totalMin%60}m | RPE ${avgRPE}` })
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(html)
            setReportVisible(true); setTimeout(()=>setReportVisible(false), 2500)
          }
        }

        if (!last7.length) return null
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'196ms' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={S.cardTitle}>WEEKLY REPORT</div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                {reportVisible && <span style={{ ...S.mono, fontSize:'10px', color:'#5bc25b' }}>✓ Copied!</span>}
                <button onClick={generateReport} style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px' }}>⤴ Share / Copy</button>
              </div>
            </div>
            <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
              {[
                {l:'SESSIONS',v:last7.length},
                {l:'VOLUME',v:`${Math.floor(totalMin/60)}h ${totalMin%60}m`},
                {l:'TSS',v:totalTSS},
                {l:'AVG RPE',v:avgRPE},
                avgRec!==null && {l:'RECOVERY',v:`${avgRec}/100`},
              ].filter(Boolean).map(({l,v})=>(
                <div key={l}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{l}</div>
                  <div style={{ ...S.mono, fontSize:'16px', fontWeight:600, color:'#ff6600' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ACWR — Acute:Chronic Workload Ratio */}
      {dl.acwr && lc.showACWR && (() => {
        if (log.length < 7) return null
        const now = Date.now()
        const ms7  = 7  * 864e5
        const ms28 = 28 * 864e5
        const acute   = log.filter(e=>now-new Date(e.date).getTime()<ms7 ).reduce((s,e)=>s+(e.tss||0),0)
        const chronic28 = log.filter(e=>now-new Date(e.date).getTime()<ms28).reduce((s,e)=>s+(e.tss||0),0) / 4
        if (!chronic28) return null
        const acwr = Math.round(acute / chronic28 * 100) / 100
        const { color, label, rec } = acwr < 0.8
          ? { color:'#0064ff', label:t('acwrUnder'),   rec:'Consider adding a moderate session tomorrow' }
          : acwr <= 1.3
          ? { color:'#5bc25b', label:t('acwrSweet'),   rec:'Maintain current load — great zone' }
          : acwr <= 1.5
          ? { color:'#f5c542', label:t('acwrCaution'), rec:'Easy run or rest day tomorrow' }
          : { color:'#e03030', label:t('acwrDanger'),  rec:'Rest day mandatory tomorrow' }

        // 8-week ACWR trend (weekly)
        const weeklyACWR = Array.from({length:8},(_,wi)=>{
          const wEnd   = now - wi * 7 * 864e5
          const wStart = wEnd - 7 * 864e5
          const wAcute = log.filter(e=>{ const t=new Date(e.date).getTime(); return t>=wStart&&t<wEnd }).reduce((s,e)=>s+(e.tss||0),0)
          const wChron = log.filter(e=>new Date(e.date).getTime()<wEnd&&new Date(e.date).getTime()>=wEnd-28*864e5).reduce((s,e)=>s+(e.tss||0),0)/4
          return wChron ? Math.round(wAcute/wChron*100)/100 : 0
        }).reverse()

        const maxVal = Math.max(...weeklyACWR, 1.6)
        const svgW=200, svgH=40, pts=weeklyACWR.map((v,i)=>`${Math.round(i*(svgW-1)/7)},${Math.round(svgH-(v/maxVal)*svgH)}`).join(' ')

        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'198ms', borderLeft:`3px solid ${color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px', flexWrap:'wrap' }}>
              <div>
                <div style={{ ...S.cardTitle, display:'flex', alignItems:'center' }}>{t('acwrTitle')}<HelpTip text="Acute:Chronic Workload Ratio. Sweet spot: 0.8–1.3. Above 1.5 = injury risk (Hulin et al. 2016)."/></div>
                <div style={{ display:'flex', gap:'20px', marginTop:'8px' }}>
                  <div>
                    <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{t('acwrAcute')}</div>
                    <div style={{ ...S.mono, fontSize:'16px', fontWeight:600, color:'#ff6600' }}>{Math.round(acute)}</div>
                  </div>
                  <div>
                    <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{t('acwrChronic')}</div>
                    <div style={{ ...S.mono, fontSize:'16px', fontWeight:600, color:'#888' }}>{Math.round(chronic28)}</div>
                  </div>
                </div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ ...S.mono, fontSize:'36px', fontWeight:600, color, lineHeight:1 }}>{acwr.toFixed(2)}</div>
                <div style={{ ...S.mono, fontSize:'9px', color, fontWeight:600, marginTop:'4px' }}>{label}</div>
              </div>
            </div>
            <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', marginTop:'10px', padding:'6px 8px', background:'var(--card-bg)', borderRadius:'4px' }}>
              ↗ {t('acwrRec')}: {rec}
            </div>
            <div style={{ marginTop:'10px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'4px' }}>8-WEEK ACWR TREND</div>
              <svg width={svgW} height={svgH} style={{ display:'block' }}>
                {/* Danger/caution bands */}
                <rect x="0" y={Math.round(svgH-(1.5/maxVal)*svgH)} width={svgW} height={Math.round((1.5/maxVal)*svgH-(1.3/maxVal)*svgH)} fill="#f5c54222"/>
                <rect x="0" y="0" width={svgW} height={Math.round(svgH-(1.5/maxVal)*svgH)} fill="#e0303011"/>
                <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'6px' }}>{t('acwrNote')}</div>

            {/* Next-week load forecast */}
            <div style={{ marginTop:'12px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.08em', marginBottom:'6px' }}>NEXT WEEK FORECAST (TSS targets)</div>
              <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                {[
                  { label:'CONSERV', mult:0.8,  clr:'#0064ff' },
                  { label:'MAINTAIN', mult:1.0, clr:'#5bc25b' },
                  { label:'BUILD',    mult:1.2, clr:'#ff6600' },
                  { label:'LIMIT',    mult:1.5, clr:'#e03030' },
                ].map(({ label, mult, clr }) => {
                  const tss = Math.round(chronic28 * mult)
                  const proj = (tss / chronic28).toFixed(2)
                  const isCurrent = acwr >= mult * 0.9 && acwr < mult * 1.1
                  return (
                    <div key={label} style={{ flex:'1 1 60px', textAlign:'center', padding:'5px 4px', background: isCurrent ? `${clr}18` : 'var(--surface)', borderRadius:'4px', border:`1px solid ${clr}33` }}>
                      <div style={{ ...S.mono, fontSize:'13px', fontWeight:700, color:clr }}>{tss}</div>
                      <div style={{ ...S.mono, fontSize:'7px', color:'#555', marginTop:'1px' }}>{label}</div>
                      <div style={{ ...S.mono, fontSize:'8px', color:'#444' }}>ACWR {proj}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

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
