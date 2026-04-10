// ─── MigrationModal.jsx — localStorage → Supabase import prompt ──────────────
import { useState, useCallback } from 'react'
import { migrateToSupabase } from '../lib/dataMigration.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const RED    = '#e03030'

export default function MigrationModal({ userId, localData, onComplete, lang }) {
  const [phase, setPhase]       = useState('prompt')  // 'prompt' | 'running' | 'done' | 'error'
  const [progress, setProgress] = useState(0)
  const [total, setTotal]       = useState(0)
  const [errMsg, setErrMsg]     = useState(null)
  const isTR = lang === 'tr'

  const handleImport = useCallback(async () => {
    setPhase('running')
    setTotal(Object.values(localData).filter(v => typeof v === 'number' && v > 0).length || 1)
    try {
      await migrateToSupabase(userId, (step, steps) => {
        setProgress(step)
        setTotal(steps)
      })
      setPhase('done')
    } catch (e) {
      setErrMsg(e.message)
      setPhase('error')
    }
  }, [userId, localData])

  const pct = total > 0 ? Math.round(progress / total * 100) : 0

  // Summarise what was found
  const lines = [
    localData.log         > 0 && `${localData.log} ${isTR ? 'antrenman seansı' : 'training sessions'}`,
    localData.recovery    > 0 && `${localData.recovery} ${isTR ? 'toparlanma kaydı' : 'recovery entries'}`,
    localData.injuries    > 0 && `${localData.injuries} ${isTR ? 'yaralanma kaydı' : 'injury entries'}`,
    localData.testResults > 0 && `${localData.testResults} ${isTR ? 'test sonucu' : 'test results'}`,
    localData.raceResults > 0 && `${localData.raceResults} ${isTR ? 'yarış sonucu' : 'race results'}`,
    localData.trainingAge      && `${isTR ? 'antrenman yaşı' : 'training age'}`,
  ].filter(Boolean)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 20000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: MONO,
    }}>
      <div style={{
        background: '#111',
        border: '1px solid #2a2a2a',
        borderRadius: '8px',
        padding: '36px 32px',
        width: '100%',
        maxWidth: '420px',
        boxSizing: 'border-box',
      }}>

        {/* ── PROMPT ── */}
        {phase === 'prompt' && (<>
          <div style={{ fontSize: '13px', fontWeight: 700, color: ORANGE, letterSpacing: '0.08em', marginBottom: '8px' }}>
            ◈ {isTR ? 'Mevcut Veri Bulundu' : 'Local Data Found'}
          </div>
          <div style={{ fontSize: '10px', color: '#666', letterSpacing: '0.08em', marginBottom: '20px' }}>
            {isTR
              ? 'Bu cihazda antrenman verisi mevcut. Hesabınıza aktarmak ister misiniz?'
              : 'Training data exists on this device. Import it to your account?'}
          </div>

          <div style={{ background: '#1a1a1a', borderRadius: '5px', padding: '14px 16px', marginBottom: '24px' }}>
            {lines.map((l, i) => (
              <div key={i} style={{ fontSize: '11px', color: '#aaa', padding: '3px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: GREEN, fontSize: '9px' }}>◆</span> {l}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleImport} style={{
              flex: 2, padding: '11px', border: 'none', borderRadius: '4px',
              background: ORANGE, color: '#fff', fontFamily: MONO,
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
            }}>
              {isTR ? 'AKTAR' : 'IMPORT'}
            </button>
            <button onClick={onComplete} style={{
              flex: 1, padding: '11px', border: '1px solid #333', borderRadius: '4px',
              background: 'transparent', color: '#555', fontFamily: MONO,
              fontSize: '11px', cursor: 'pointer',
            }}>
              {isTR ? 'Atla' : 'Skip'}
            </button>
          </div>

          <p style={{ fontSize: '9px', color: '#333', marginTop: '14px', lineHeight: 1.6, textAlign: 'center' }}>
            {isTR
              ? 'Yerel veri silinmez. Aktarım sonrası her iki yerde de mevcut olacak.'
              : 'Local data is not deleted. After import it exists in both places.'}
          </p>
        </>)}

        {/* ── RUNNING ── */}
        {phase === 'running' && (<>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#eee', letterSpacing: '0.08em', marginBottom: '20px' }}>
            {isTR ? 'Aktarılıyor...' : 'Importing...'}
          </div>
          <div style={{ background: '#1a1a1a', borderRadius: '4px', height: '8px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{
              height: '100%', background: ORANGE, borderRadius: '4px',
              width: `${pct}%`, transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: '10px', color: '#555', textAlign: 'center', letterSpacing: '0.08em' }}>
            {progress} / {total} {isTR ? 'tablo' : 'tables'} · {pct}%
          </div>
        </>)}

        {/* ── DONE ── */}
        {phase === 'done' && (<>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>✓</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: GREEN, letterSpacing: '0.08em', marginBottom: '8px' }}>
              {isTR ? 'Aktarım Tamamlandı' : 'Import Complete'}
            </div>
            <div style={{ fontSize: '10px', color: '#666', lineHeight: 1.7, marginBottom: '24px' }}>
              {isTR
                ? 'Verileriniz artık hesabınızda. Her cihazdan erişebilirsiniz.'
                : 'Your data is now in your account. Access it from any device.'}
            </div>
            <button onClick={onComplete} style={{
              padding: '11px 32px', border: 'none', borderRadius: '4px',
              background: ORANGE, color: '#fff', fontFamily: MONO,
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
            }}>
              {isTR ? 'DEVAM ET' : 'CONTINUE'}
            </button>
          </div>
        </>)}

        {/* ── ERROR ── */}
        {phase === 'error' && (<>
          <div style={{ fontSize: '12px', fontWeight: 700, color: RED, marginBottom: '12px' }}>
            {isTR ? 'Aktarım Hatası' : 'Import Error'}
          </div>
          <div style={{ fontSize: '10px', color: '#888', background: '#1a1a1a', padding: '12px', borderRadius: '4px', marginBottom: '20px', lineHeight: 1.7, wordBreak: 'break-word' }}>
            {errMsg}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleImport} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '4px',
              background: ORANGE, color: '#fff', fontFamily: MONO, fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}>
              {isTR ? 'Tekrar Dene' : 'Retry'}
            </button>
            <button onClick={onComplete} style={{
              flex: 1, padding: '10px', border: '1px solid #333', borderRadius: '4px',
              background: 'transparent', color: '#555', fontFamily: MONO, fontSize: '11px', cursor: 'pointer',
            }}>
              {isTR ? 'Atla' : 'Skip'}
            </button>
          </div>
        </>)}

      </div>
    </div>
  )
}
