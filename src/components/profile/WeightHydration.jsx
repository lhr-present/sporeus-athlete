// ─── WeightHydration — daily weight log, sweat rate, race weight planner ────
import { useState, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { Sparkline } from '../ui.jsx'

export default function WeightHydration({ profile: _profile }) {
  const { t } = useContext(LangCtx)
  const [weightLog, setWeightLog] = useLocalStorage('sporeus-weight', [])
  const today = new Date().toISOString().slice(0, 10)
  const [wInput,      setWInput]      = useState('')
  const [sweatPre,    setSweatPre]    = useState('')
  const [sweatPost,   setSweatPost]   = useState('')
  const [sweatFluid,  setSweatFluid]  = useState('')
  const [sweatDur,    setSweatDur]    = useState('')
  const [sweatResult, setSweatResult] = useState(null)
  const [raceTarget,  setRaceTarget]  = useState('')
  const [raceWeeks,   setRaceWeeks]   = useState('')

  const saveWeight = () => {
    const w = parseFloat(wInput)
    if (!w) return
    const updated = weightLog.filter(e => e.date !== today)
    setWeightLog([...updated, { date: today, weight: w }].slice(-90))
    setWInput('')
  }

  const last30 = weightLog.slice(-30)
  const last7w  = weightLog.slice(-7).map(e => e.weight)
  const avg7w   = last7w.length ? Math.round(last7w.reduce((s, v) => s + v, 0) / last7w.length * 10) / 10 : null
  const latest  = weightLog.length ? weightLog[weightLog.length - 1] : null
  const prev    = weightLog.length > 1 ? weightLog[weightLog.length - 2] : null
  const dehydWarn = latest && prev && ((prev.weight - latest.weight) / prev.weight * 100) > 2

  const calcSweat = () => {
    const pre = parseFloat(sweatPre), post = parseFloat(sweatPost), fl = parseFloat(sweatFluid) || 0, dur = parseFloat(sweatDur) || 60
    if (!pre || !post) return
    const rate   = Math.round(((pre - post) + fl / 1000) / (dur / 60) * 100) / 100
    const per15  = Math.round(rate * 0.8 / 4 * 1000)
    setSweatResult({ rate, per15 })
  }

  const raceWeightFeasible = (() => {
    if (!raceTarget || !raceWeeks || !latest) return null
    const target = parseFloat(raceTarget), weeks = parseInt(raceWeeks)
    const diff = latest.weight - target
    if (diff <= 0) return { ok: true, msg: 'Already at or below target!' }
    const weeklyLoss = diff / weeks
    const maxSafe = latest.weight * 0.01
    return { ok: weeklyLoss <= maxSafe, weeklyLoss: Math.round(weeklyLoss * 100) / 100, maxSafe: Math.round(maxSafe * 100) / 100 }
  })()

  return (
    <div>
      {/* Daily weight */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '14px' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={S.label}>{t('morningWtL')}</label>
          <input style={S.input} type="number" step="0.1" placeholder="70.5" value={wInput}
            onChange={e => setWInput(e.target.value)}/>
        </div>
        <button style={S.btn} onClick={saveWeight}>{t('weightSaveBtn')}</button>
      </div>
      {dehydWarn && (
        <div style={{ ...S.mono, fontSize: '11px', color: '#f5c542', padding: '6px 10px', background: '#f5c54211', borderRadius: '4px', marginBottom: '12px' }}>
          ⚠ {t('weightDehydWarn')}
        </div>
      )}
      {last30.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ ...S.mono, fontSize: '10px', color: '#888', letterSpacing: '0.06em' }}>{t('weightTrend')}</div>
            {avg7w && <div style={{ ...S.mono, fontSize: '11px', color: '#0064ff' }}>{t('weight7avg')}: {avg7w} kg</div>}
          </div>
          <Sparkline data={last30.map(e => e.weight)} w={240} h={36}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...S.mono, fontSize: '9px', color: '#aaa', marginTop: '2px' }}>
            <span>{last30[0]?.date?.slice(5)}</span><span>{last30[last30.length - 1]?.date?.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Sweat rate */}
      <div style={{ ...S.mono, fontSize: '10px', color: '#888', letterSpacing: '0.06em', marginBottom: '8px' }}>{t('sweatTitle')}</div>
      <div style={S.row}>
        <div style={{ flex: '1 1 100px' }}>
          <label style={S.label}>{t('sweatPre')}</label>
          <input style={S.input} type="number" step="0.1" placeholder="70.5" value={sweatPre} onChange={e => setSweatPre(e.target.value)}/>
        </div>
        <div style={{ flex: '1 1 100px' }}>
          <label style={S.label}>{t('sweatPost')}</label>
          <input style={S.input} type="number" step="0.1" placeholder="69.8" value={sweatPost} onChange={e => setSweatPost(e.target.value)}/>
        </div>
        <div style={{ flex: '1 1 100px' }}>
          <label style={S.label}>{t('sweatFluid')}</label>
          <input style={S.input} type="number" placeholder="500" value={sweatFluid} onChange={e => setSweatFluid(e.target.value)}/>
        </div>
        <div style={{ flex: '1 1 100px' }}>
          <label style={S.label}>{t('sweatDur')}</label>
          <input style={S.input} type="number" placeholder="60" value={sweatDur} onChange={e => setSweatDur(e.target.value)}/>
        </div>
      </div>
      <button style={{ ...S.btnSec, marginTop: '10px' }} onClick={calcSweat}>{t('sweatCalcBtn')}</button>
      {sweatResult && (
        <div style={{ ...S.mono, fontSize: '12px', marginTop: '10px', lineHeight: 1.7 }}>
          <span style={{ color: '#ff6600', fontWeight: 600 }}>{t('sweatResult')}: {sweatResult.rate} L/hr</span>
          <br/>
          <span style={{ color: '#888', fontSize: '10px' }}>Aim to {t('sweatReplace')}: {sweatResult.per15} ml every 15min</span>
        </div>
      )}

      {/* Race weight target */}
      {latest && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: '#888', letterSpacing: '0.06em', marginBottom: '8px' }}>{t('raceWeightTitle')}</div>
          <div style={S.row}>
            <div style={{ flex: '1 1 120px' }}>
              <label style={S.label}>{t('raceWeightTarget')}</label>
              <input style={S.input} type="number" step="0.5" placeholder={(latest.weight - 2).toFixed(1)} value={raceTarget} onChange={e => setRaceTarget(e.target.value)}/>
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label style={S.label}>{t('raceWeeksTil')}</label>
              <input style={S.input} type="number" placeholder="12" value={raceWeeks} onChange={e => setRaceWeeks(e.target.value)}/>
            </div>
          </div>
          {raceWeightFeasible && (
            <div style={{ ...S.mono, fontSize: '11px', marginTop: '8px', padding: '6px 10px', borderRadius: '4px',
              background: raceWeightFeasible.ok ? '#5bc25b11' : '#e0303011',
              color: raceWeightFeasible.ok ? '#5bc25b' : '#e03030' }}>
              {raceWeightFeasible.ok
                ? `✓ ${t('raceWeightOk')} — ${raceWeightFeasible.weeklyLoss} kg/week (max safe: ${raceWeightFeasible.maxSafe} kg/week)`
                : `✗ ${t('raceWeightAggressive')} — ${raceWeightFeasible.weeklyLoss} kg/week needed (max safe: ${raceWeightFeasible.maxSafe} kg/week)`}
            </div>
          )}
          <div style={{ ...S.mono, fontSize: '9px', color: '#aaa', marginTop: '6px' }}>Max safe loss: 0.5–1% body weight per week</div>
        </div>
      )}
    </div>
  )
}
