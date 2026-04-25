// ─── CyclingZonesCard.jsx — Coggan 7-zone power table (E40) ───────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { computeCyclingZones } from '../../lib/athlete/cyclingZones.js'

// Zone colors: progressive from recovery (grey) to neuromuscular (purple)
const ZONE_COLORS = [
  '#444444', // Z1 Active Recovery
  '#5bc25b', // Z2 Endurance
  '#0064ff', // Z3 Tempo
  '#f5c542', // Z4 Lactate Threshold
  '#ff6600', // Z5 VO2max
  '#e03030', // Z6 Anaerobic
  '#cc00cc', // Z7 Neuromuscular
]

const METHOD_LABELS = {
  profile: { en: 'PROFILE FTP',   tr: 'PROFİL FTP' },
  ftp20:   { en: '20-MIN TEST',   tr: '20-DAK TEST' },
  ramp:    { en: 'RAMP TEST',     tr: 'RAMPA TESTİ' },
  cp:      { en: 'CP TEST',       tr: 'CP TESTİ' },
}

export default function CyclingZonesCard({ testResults = [], profile = {} }) {
  const [lang]  = useLocalStorage('sporeus-lang', 'en')
  const { t }   = useContext(LangCtx)

  const data = useMemo(
    () => computeCyclingZones(testResults, profile),
    [testResults, profile]
  )

  if (!data) return null

  const { ftpWatts, zones, wperkg, method } = data
  const methodLabel = (METHOD_LABELS[method] || {})[lang] || method.toUpperCase()

  const subtitleParts = [
    `FTP: ${ftpWatts}W`,
    wperkg != null ? `${wperkg}${t('cyclingWperKg') || 'W/kg'}` : null,
    methodLabel,
  ].filter(Boolean)

  return (
    <div className="sp-card" style={{ ...S.card, marginBottom: '16px' }}>
      {/* Title */}
      <div style={{
        ...S.cardTitle,
        color: '#ff6600',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: '4px',
      }}>
        <span>
          {t('cyclingZonesTitle') || (lang === 'tr' ? 'BİSİKLET GÜÇ ZONESİ (Coggan)' : 'CYCLING POWER ZONES (Coggan)')}
        </span>
      </div>

      {/* Subtitle: FTP · W/kg · method */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '11px',
        color: 'var(--muted)',
        marginBottom: '12px',
        letterSpacing: '0.04em',
      }}>
        {subtitleParts.join(' · ')}
      </div>

      {/* Zone table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '11px',
        }}>
          <thead>
            <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left',  padding: '4px 6px', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ZONE</th>
              <th style={{ textAlign: 'left',  padding: '4px 6px', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>NAME</th>
              <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>WATTS</th>
              <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>% FTP</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z, i) => {
              const color    = ZONE_COLORS[i] || '#888'
              const maxLabel = z.maxWatts != null ? `${z.maxWatts}W` : '∞'
              const wattRange = `${z.minWatts}–${maxLabel}`
              const pctRange  = z.pctMax === Infinity
                ? `>${Math.round(z.pctMin * 100)}%`
                : `${Math.round(z.pctMin * 100)}–${Math.round(z.pctMax * 100)}%`
              return (
                <tr key={z.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px', height: '8px',
                      borderRadius: '2px',
                      background: color,
                      marginRight: '6px',
                      verticalAlign: 'middle',
                    }}/>
                    <span style={{ color, fontWeight: 700 }}>Z{z.id}</span>
                  </td>
                  <td style={{ padding: '5px 6px', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {z.name}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {z.maxWatts != null ? `${z.minWatts}–${z.maxWatts}W` : `${z.minWatts}W+`}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {pctRange}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Citation */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '9px',
        color: 'var(--muted)',
        marginTop: '10px',
        letterSpacing: '0.03em',
      }}>
        ℹ Coggan (2003) — 7-zone power system
      </div>
    </div>
  )
}
