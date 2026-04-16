// ─── dashboard/BackupReminder.jsx — periodic export reminder ─────────────────
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { S } from '../../styles.js'
import { exportAllData } from '../../lib/storage.js'

export default function BackupReminder({ log }) {
  const [lastBackup, setLastBackup] = useLocalStorage('sporeus-last-backup', null)
  const today = new Date().toISOString().slice(0, 10)
  const daysSince = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
    : null

  if (log.length < 50) return null
  if (lastBackup && daysSince !== null && daysSince < 30) return null

  const handleExport = () => {
    const json = exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `sporeus-backup-${today}.json`; a.click()
    URL.revokeObjectURL(url)
    setLastBackup(today)
  }

  return (
    <div style={{ ...S.card, borderLeft: '3px solid #f5c542', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
      <div>
        <div style={{ ...S.mono, fontSize: '10px', fontWeight: 600, color: '#f5c542', letterSpacing: '0.08em', marginBottom: '4px' }}>
          ⊞ BACKUP REMINDER
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)' }}>
          {log.length} sessions logged · Last backup: {lastBackup || 'never'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={{ ...S.btn, fontSize: '11px', padding: '6px 12px' }} onClick={handleExport}>Export Now</button>
        <button style={{ ...S.btnSec, fontSize: '11px', padding: '6px 12px' }} onClick={() => setLastBackup(today)}>Later</button>
      </div>
    </div>
  )
}
