import { useContext, useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { TSSChart, WeeklyVolChart, ZoneDonut, HelpTip } from './ui.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
const HRVChart  = lazy(() => import('./charts/HRVChart.jsx'))
import { monotonyStrain, calcPRs, navyBF, mifflinBMR, riegel, fmtSec, fmtPace, calcLoad } from '../lib/formulas.js'
import { calculateACWR, fitBanister, predictBanister } from '../lib/trainingLoad.js'
import { zoneDistribution, trainingModel, MODEL_META } from '../lib/zoneDistrib.js'
import ShareCard from './ShareCard.jsx'
import { exportAllData } from '../lib/storage.js'
import { useCountUp } from '../hooks/useCountUp.js'
import Achievements from './Achievements.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { SPORT_BRANCHES, ATHLETE_LEVELS, LEVEL_CONFIG, DASH_CARD_DEFS } from '../lib/constants.js'
import { assessDataQuality } from '../lib/intelligence.js'
import { useData } from '../contexts/DataContext.jsx'

// ── Extracted sub-components ─────────────────────────────────────────────────
import InsightsPanel         from './dashboard/InsightsPanel.jsx'
import WeekStoryCard         from './dashboard/WeekStoryCard.jsx'
import DidYouKnowCard        from './dashboard/DidYouKnowCard.jsx'
import MilestonesList        from './dashboard/MilestonesList.jsx'
import YourPatternsCard      from './dashboard/YourPatternsCard.jsx'
import ProactiveInjuryAlert  from './dashboard/ProactiveInjuryAlert.jsx'
import RaceReadinessCard     from './dashboard/RaceReadinessCard.jsx'
import LoadTrendChart        from './dashboard/LoadTrendChart.jsx'
import TriDashboard           from './dashboard/TriDashboard.jsx'
import NormativeCard          from './NormativeCard.jsx'
import { getFTPNorm, getCTLNorm } from '../lib/sport/normativeTables.js'

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

  // ── Date range filter ─────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useLocalStorage('sporeus-dash-range', '28')
  const rangeStart = useMemo(() => {
    if (dateRange === 'season') return '2000-01-01'
    const d = new Date(); d.setDate(d.getDate() - parseInt(dateRange, 10))
    return d.toISOString().slice(0, 10)
  }, [dateRange])
  const filteredLog = useMemo(() => log.filter(e => e.date >= rangeStart), [log, rangeStart])
  const ctlChartDays = dateRange === '7' ? 30 : dateRange === '28' ? 90 : dateRange === '90' ? 180 : 730
  const rangeLabel   = dateRange === 'season' ? 'SEASON' : `LAST ${dateRange}D`

  const last7 = filteredLog
  const totalTSS = last7.reduce((s,e)=>s+(e.tss||0),0)
  const totalMin = last7.reduce((s,e)=>s+(e.duration||0),0)
  const avgRPE   = last7.length ? (last7.reduce((s,e)=>s+(e.rpe||0),0)/last7.length).toFixed(1) : '\u2014'
  const srpeLoad = last7.reduce((s,e) => s + ((e.rpe||0) * (e.duration||0)), 0)
  const { atl, ctl, tsb, daily } = calcLoad(log)
  const acwr = calculateACWR(log)

  const w7Start     = (() => { const d = new Date(); d.setDate(d.getDate()-7);  return d.toISOString().slice(0,10) })()
  const w14Start    = (() => { const d = new Date(); d.setDate(d.getDate()-14); return d.toISOString().slice(0,10) })()
  const thisWeekTSS = log.filter(e => e.date >= w7Start).reduce((s,e) => s+(e.tss||0), 0)
  const prevWeekTSS = log.filter(e => e.date >= w14Start && e.date < w7Start).reduce((s,e) => s+(e.tss||0), 0)
  const loadSpikeP  = prevWeekTSS > 10 ? Math.round((thisWeekTSS - prevWeekTSS) / prevWeekTSS * 100) : 0
  const readiness = totalTSS>600?{label:t('fatigued'),color:'#e03030'}:totalTSS>400?{label:t('trained'),color:'#f5c542'}:{label:t('fresh'),color:'#5bc25b'}
  const tsbColor = tsb>5?'#5bc25b':tsb<-10?'#e03030':'#f5c542'
  const countSess = useCountUp(last7.length)
  const countTSS  = useCountUp(totalTSS)
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()
  const prev7     = daily.length >= 8 ? daily[daily.length - 8] : null
  const trendCTL  = prev7 ? ctl - prev7.ctl : 0
  const trendATL  = prev7 ? atl - prev7.atl : 0
  const trendTSB  = prev7 ? (ctl - atl) - (prev7.ctl - prev7.atl) : 0

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

  return (
    <div className="sp-fade">
      <MilestonesList log={log} profile={profile}/>
      <BackupReminder log={log}/>
      <div style={{ marginBottom:'16px' }}>
        <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginBottom:'4px' }}>{today}</div>
        <div style={{ ...S.mono, fontSize:'18px', fontWeight:600 }}>
          {profile.name ? `ATHLETE: ${profile.name.toUpperCase()}` : t('appTitle')}
        </div>
        {headerBadges}
        <div style={{ display:'flex', gap:'5px', marginTop:'10px', flexWrap:'wrap' }}>
          {[['7','7D'],['28','28D'],['90','90D'],['season','SEASON']].map(([val, lbl]) => (
            <button key={val} onClick={() => setDateRange(val)}
              style={{ ...S.mono, fontSize:'9px', padding:'3px 10px', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em', border:`1px solid ${dateRange===val?'#ff6600':'var(--border)'}`, background: dateRange===val?'rgba(255,102,0,0.12)':'transparent', color: dateRange===val?'#ff6600':'var(--muted)', fontWeight: dateRange===val?700:400 }}>
              {lbl}
            </button>
          ))}
        </div>
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
                  { lbl:t('ctlLabel'), v:ctl,  c:'#0064ff', delta:trendCTL, tip:'Chronic Training Load — your fitness. Higher = fitter. 42-day average of daily TSS.' },
                  { lbl:t('atlLabel'), v:atl,  c:'#ef4444', delta:trendATL, tip:'Acute Training Load — your fatigue. 7-day average. Drops after rest days.' },
                  { lbl:t('tsbLabel'), v:(tsb>=0?'+':'')+tsb, c:tsbColor, delta:trendTSB, tip:'Training Stress Balance = CTL − ATL. Positive = fresh, ready to race. Negative = fatigued.' },
                ].map(({lbl,v,c,delta,tip})=>(
                  <div key={lbl}>
                    <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.08em', display:'flex', alignItems:'center' }}>
                      {lbl}<HelpTip text={tip}/>
                    </div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:'5px' }}>
                      <div style={{ ...S.mono, fontSize:'16px', fontWeight:600, color:c }}>{v}</div>
                      {delta !== 0 && prev7 && (
                        <div style={{ ...S.mono, fontSize:'10px', color: delta > 0 ? '#5bc25b' : '#e03030', letterSpacing:'0.04em' }}>
                          {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
                        </div>
                      )}
                    </div>
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

      <ErrorBoundary inline name="Race Readiness">
        <RaceReadinessCard log={log} recovery={recovery} injuries={injuries} profile={profile} plan={plan} planStatus={planStatus} lang={lang}/>
      </ErrorBoundary>
      <ProactiveInjuryAlert log={log} injuries={injuries} lang={lang}/>

      {loadSpikeP >= 10 && (
        <div className="sp-card" style={{ ...S.card, borderLeft:'4px solid #f5c542', background:'#f5c54209', animationDelay:'0ms' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', fontWeight:600, letterSpacing:'0.08em', marginBottom:'4px' }}>
            ⚠ LOAD SPIKE DETECTED
          </div>
          <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.7 }}>
            {lang==='tr'
              ? `Bu haftanın yükü geçen haftaya göre +%${loadSpikeP} arttı.`
              : `This week's load is +${loadSpikeP}% higher than last week.`}
          </div>
          <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'4px' }}>
            {loadSpikeP >= 30
              ? (lang==='tr' ? '→ Yüksek artış — bu haftaki tempo seansını kolay antrenmanla değiştirin.' : '→ Large spike — swap this week\'s intensity session for easy aerobic work.')
              : (lang==='tr' ? '→ Yükü takip edin; hafif bir seans ekleyebilirsiniz.' : '→ Monitor closely; consider adding one extra easy session.')}
          </div>
        </div>
      )}

      {recovery.some(e => parseFloat(e.hrv) > 0) && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'20ms' }}>
          <div style={S.cardTitle}>HRV TREND</div>
          <Suspense fallback={null}><HRVChart recovery={recovery} days={30} /></Suspense>
        </div>
      )}
      <InsightsPanel log={log} recovery={recovery} profile={profile} lang={lang}/>
      <YourPatternsCard log={log} recovery={recovery} injuries={injuries} profile={profile} lang={lang}/>
      <WeekStoryCard log={log} recovery={recovery} profile={profile} lang={lang}/>
      <DidYouKnowCard log={log} recovery={recovery} profile={profile} lang={lang}/>

      {dl.stats && <div className="sp-card" style={{ ...S.row, marginBottom:'16px', animationDelay:'50ms' }}>
        {[
          { val:countSess,                                      lbl:t('sessions') },
          { val:`${Math.floor(totalMin/60)}h ${totalMin%60}m`,  lbl:t('volume') },
          { val:avgRPE,                                          lbl:t('avgRpe') },
          { val:totalTSS,                                        lbl:t('tss7'), tip:'Training Stress Score. Combines duration × intensity². Easy day ~50, hard day ~100+.' },
          { val:srpeLoad > 0 ? srpeLoad : '—',                   lbl:'sRPE LOAD', tip:'Session-RPE load: RPE × minutes (Foster 2001). Quantifies internal load without heart rate or power data.' },
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
        <div style={S.cardTitle}>{t('recentSessions')} · <span style={{ color:'#ff6600' }}>{rangeLabel}</span></div>
        {last7.length===0 ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ ...S.mono, fontSize:'13px', color:'#555', marginBottom:'6px' }}>No sessions in this period</div>
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

      {filteredLog.length > 0 && (() => {
        const dist = zoneDistribution(filteredLog)
        if (!dist) return null
        const model  = trainingModel(dist)
        const meta   = MODEL_META[model] || MODEL_META.mixed
        const zones  = [1,2,3,4,5]
        const zColors = ['#5bc25b','#0064ff','#f5c542','#ff6600','#e03030']
        const zLabels = ['Z1','Z2','Z3','Z4','Z5']
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'188ms' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:6 }}>
              <div style={S.cardTitle}>ZONE DISTRIBUTOR · <span style={{ color:'#ff6600' }}>{rangeLabel}</span></div>
              <span style={{ ...S.mono, fontSize:10, fontWeight:700, color:meta.color, border:`1px solid ${meta.color}44`, borderRadius:2, padding:'2px 8px' }}>
                {lang==='tr' ? meta.tr : meta.en}
              </span>
            </div>
            <div style={{ display:'flex', width:'100%', height:14, borderRadius:3, overflow:'hidden', marginBottom:8 }}>
              {zones.map((z,i) => dist[z] > 0 && (
                <div key={z} style={{ width:`${dist[z]}%`, background:zColors[i], transition:'width 0.3s' }} title={`Z${z}: ${dist[z]}%`}/>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:8 }}>
              {zones.map((z,i) => (
                <div key={z} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:1, background:zColors[i] }}/>
                  <span style={{ ...S.mono, fontSize:9, color: dist[z] > 0 ? zColors[i] : '#444' }}>
                    {zLabels[i]} {dist[z]}%
                  </span>
                </div>
              ))}
            </div>
            <div style={{ ...S.mono, fontSize:9, color:'#666', lineHeight:1.5 }}>
              {lang==='tr' ? meta.tip.replace('Seiler','Seiler').replace('Optimal','Optimal') : meta.tip}
            </div>
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

      {(profile.sport || '').toLowerCase().includes('tri') && (
        <TriDashboard log={log} lang={lang} />
      )}
      <LoadTrendChart log={log} acwr={acwr} ctlChartDays={ctlChartDays} raceResults={raceResults} plan={plan} dl={dl} lc={lc}/>

      {(testResults?.length ?? 0) >= 3 && (() => {
        const fit = fitBanister(log, testResults)
        if (!fit) return null
        const proj  = predictBanister(log, fit, [], 60)
        const today = new Date().toISOString().slice(0, 10)
        const range = fit.maxV - fit.minV || 1
        const normTests = testResults
          .filter(t => t.date && typeof t.value === 'number')
          .map(t => ({ date: t.date, norm: Math.round((t.value - fit.minV) / range * 100) }))
          .sort((a, b) => a.date > b.date ? 1 : -1)
        const allDates = [...normTests.map(t => t.date), ...proj.map(p => p.date)]
        const minDate = allDates[0], maxDate = allDates[allDates.length - 1]
        const spanMs  = new Date(maxDate) - new Date(minDate) || 1
        const W = 280, H = 80, padL = 4, padR = 4, padT = 6, padB = 16
        const iW = W - padL - padR, iH = H - padT - padB
        const px = d => padL + (new Date(d) - new Date(minDate)) / spanMs * iW
        const py = v => padT + (1 - v / 100) * iH
        const todayX = px(today)
        const projPath = proj.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.date).toFixed(1)},${py(p.predicted).toFixed(1)}`).join(' ')
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'196ms' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:6 }}>
              <div style={S.cardTitle}>BANISTER MODEL</div>
              <div style={{ display:'flex', gap:10 }}>
                <span style={{ ...S.mono, fontSize:9, color:'#888' }}>R² {fit.r2}</span>
                <span style={{ ...S.mono, fontSize:9, color:'#5bc25b' }}>k₁ {fit.k1.toFixed(3)}</span>
                <span style={{ ...S.mono, fontSize:9, color:'#e03030' }}>k₂ {fit.k2.toFixed(3)}</span>
              </div>
            </div>
            <svg width={W} height={H} style={{ display:'block', overflow:'visible', width:'100%', maxWidth:W }}>
              <line x1={todayX} y1={padT} x2={todayX} y2={padT + iH} stroke="#333" strokeWidth="1" strokeDasharray="3,3"/>
              <text x={todayX + 3} y={padT + 8} fontFamily="'IBM Plex Mono',monospace" fontSize={7} fill="#555">TODAY</text>
              {proj.length > 1 && <path d={projPath} fill="none" stroke="#ff6600" strokeWidth="2" strokeLinejoin="round"/>}
              {normTests.map((t, i) => (
                <g key={i}>
                  <circle cx={px(t.date)} cy={py(t.norm)} r={3.5} fill="#ff6600" stroke="#111" strokeWidth="1"/>
                </g>
              ))}
              <text x={padL} y={H} fontFamily="'IBM Plex Mono',monospace" fontSize={7} fill="#555">{minDate?.slice(5)}</text>
              <text x={W - padR} y={H} fontFamily="'IBM Plex Mono',monospace" fontSize={7} fill="#555" textAnchor="end">{maxDate?.slice(5)}</text>
            </svg>
            <div style={{ ...S.mono, fontSize:9, color:'#555', marginTop:6, lineHeight:1.5 }}>
              {lang==='tr'
                ? `Banister 1975: performans = k₁·fitness − k₂·yorgunluk. Nokta = gerçek test. Çizgi = 60 günlük projeksiyon.`
                : `Banister 1975: performance = k₁·fitness − k₂·fatigue. Dots = actual tests. Line = 60-day projection.`}
            </div>
          </div>
        )
      })()}

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

      {/* ── Normative comparison (FTP + CTL) ─────────────────────────────── */}
      {(() => {
        const ftp    = parseFloat(profile.ftp  || 0)
        const weight = parseFloat(profile.weight || 0)
        const sport  = (profile.sport || 'cycling').toLowerCase()
        const gender = (profile.gender || 'male').toLowerCase()
        const ctl    = acwr && typeof acwr === 'object' ? null : null  // placeholder
        const ctlVal = log.length >= 7 ? Math.round(log.slice(-28).reduce((s, e) => s + (e.tss || 0), 0) / 42) : null
        const normSport = sport.includes('tri') ? 'triathlon' : sport.includes('cycl') || sport.includes('bike') ? 'cycling' : null

        const cards = []

        if (ftp > 0 && weight > 0 && normSport) {
          const ftpPerKg = Math.round((ftp / weight) * 100) / 100
          const norm = getFTPNorm(normSport, gender, ftpPerKg)
          if (norm.category !== 'Unknown') {
            cards.push(
              <NormativeCard
                key="ftp"
                label="FTP"
                value={`${ftpPerKg} w/kg`}
                percentile={norm.percentile}
                category={norm.category}
                context={`vs ${normSport} ${gender}s`}
              />
            )
          }
        }

        if (ctlVal != null && ctlVal > 0) {
          const level = (profile.level || 'recreational').toLowerCase().replace('-', '')
          const ctlSport = sport.includes('run') ? 'running' : sport.includes('row') ? 'rowing' : sport.includes('swim') ? 'swimming' : 'cycling'
          const normLevel = level.includes('elite') ? 'elite' : level.includes('expert') || level.includes('well') ? 'masters' : level.includes('trained') ? 'amateur' : 'recreational'
          const ctlNorm = getCTLNorm(ctlSport, normLevel, ctlVal)
          if (ctlNorm.status !== 'Unknown') {
            cards.push(
              <NormativeCard
                key="ctl"
                label="CTL (Fitness)"
                value={`${ctlVal} TSS/d`}
                percentile={Math.max(0, Math.min(100, ctlNorm.percentileOfTypical))}
                category={ctlNorm.status}
                context={`${ctlSport} · ${normLevel}`}
              />
            )
          }
        }

        if (!cards.length) return null
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'210ms' }}>
            <div style={S.cardTitle}>NORMATIVE COMPARISON</div>
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
              {cards}
            </div>
          </div>
        )
      })()}

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

      {(() => {
        const recLast7 = recovery.filter(e=>{
          const d=new Date(e.date),cutoff=new Date(); cutoff.setDate(cutoff.getDate()-7)
          return d>=cutoff
        })
        const avgRec = recLast7.length ? Math.round(recLast7.reduce((s,e)=>s+(e.score||0),0)/recLast7.length) : null

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
                {l:`SESSIONS (${rangeLabel})`,v:last7.length},
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

      {dl.acwr && lc.showACWR && (() => {
        if (log.length < 7) return null
        const now = Date.now()
        const ms7  = 7  * 864e5
        const ms28 = 28 * 864e5
        const acute   = log.filter(e=>now-new Date(e.date).getTime()<ms7 ).reduce((s,e)=>s+(e.tss||0),0)
        const chronic28 = log.filter(e=>now-new Date(e.date).getTime()<ms28).reduce((s,e)=>s+(e.tss||0),0) / 4
        if (!chronic28) return null
        const acwrVal = Math.round(acute / chronic28 * 100) / 100
        const { color, label, rec } = acwrVal < 0.8
          ? { color:'#0064ff', label:t('acwrUnder'),   rec:'Consider adding a moderate session tomorrow' }
          : acwrVal <= 1.3
          ? { color:'#5bc25b', label:t('acwrSweet'),   rec:'Maintain current load — great zone' }
          : acwrVal <= 1.5
          ? { color:'#f5c542', label:t('acwrCaution'), rec:'Easy run or rest day tomorrow' }
          : { color:'#e03030', label:t('acwrDanger'),  rec:'Rest day mandatory tomorrow' }

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
                <div style={{ ...S.mono, fontSize:'36px', fontWeight:600, color, lineHeight:1 }}>{acwrVal.toFixed(2)}</div>
                <div style={{ ...S.mono, fontSize:'9px', color, fontWeight:600, marginTop:'4px' }}>{label}</div>
              </div>
            </div>
            <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', marginTop:'10px', padding:'6px 8px', background:'var(--card-bg)', borderRadius:'4px' }}>
              ↗ {t('acwrRec')}: {rec}
            </div>
            <div style={{ marginTop:'10px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'4px' }}>8-WEEK ACWR TREND</div>
              <svg width={svgW} height={svgH} style={{ display:'block' }}>
                <rect x="0" y={Math.round(svgH-(1.5/maxVal)*svgH)} width={svgW} height={Math.round((1.5/maxVal)*svgH-(1.3/maxVal)*svgH)} fill="#f5c54222"/>
                <rect x="0" y="0" width={svgW} height={Math.round(svgH-(1.5/maxVal)*svgH)} fill="#e0303011"/>
                <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'6px' }}>{t('acwrNote')}</div>
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
                  const isCurrent = acwrVal >= mult * 0.9 && acwrVal < mult * 1.1
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

      <ShareCard log={log} profile={profile} filteredLog={filteredLog} />

      <div className="sp-card" style={{ ...S.card, animationDelay:'200ms' }}>
        <div style={S.cardTitle}>{t('quickLinks')}</div>
        <div style={S.row}>
          {[
            ['sporeus.com','https://sporeus.com'],
            ['Hesaplayıcılar','https://sporeus.com/hesaplayicilar/'],
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
