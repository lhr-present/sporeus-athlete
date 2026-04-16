// ─── dashboard/RecentSessionsCard.jsx — filtered session history table ────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'

/**
 * @param {{ filteredLog: object[], rangeLabel: string, dl: object }} props
 */
export default function RecentSessionsCard({ filteredLog, rangeLabel, dl }) {
  const { t } = useContext(LangCtx)

  if (!dl.sessions) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '150ms' }}>
      <div style={S.cardTitle}>
        {t('recentSessions')} · <span style={{ color: '#ff6600' }}>{rangeLabel}</span>
      </div>
      {filteredLog.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ ...S.mono, fontSize: '13px', color: '#555', marginBottom: '6px' }}>No sessions in this period</div>
          <div style={{ ...S.mono, fontSize: '11px', color: '#888', lineHeight: 1.7 }}>
            Log a session to start tracking your progress.<br/>
            Takes less than 30 seconds →
          </div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', ...S.mono, fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: '#888', fontSize: '10px', letterSpacing: '0.06em' }}>
              {[t('dateL'), 'TYPE', 'MIN', 'RPE', 'TSS'].map(h => (
                <th key={h} style={{ textAlign: h === 'TSS' || h === 'MIN' || h === 'RPE' ? 'right' : 'left', padding: '4px 6px 8px 0', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...filteredLog].reverse().map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 6px 6px 0', color: 'var(--sub)' }}>{s.date}</td>
                <td style={{ padding: '6px 6px 6px 0' }}>{s.type}</td>
                <td style={{ textAlign: 'right', padding: '6px 6px 6px 0' }}>{s.duration}</td>
                <td style={{ textAlign: 'right', padding: '6px 6px 6px 0', color: s.rpe >= 8 ? '#e03030' : s.rpe >= 6 ? '#f5c542' : '#5bc25b' }}>{s.rpe}</td>
                <td style={{ textAlign: 'right', padding: '6px 0', color: '#ff6600', fontWeight: 600 }}>{s.tss}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
