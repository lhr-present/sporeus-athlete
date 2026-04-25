// ─── SwimmingZonesCard.jsx — Wakayoshi 1992 CSS T-pace + 6-zone table (E41) ───
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { computeSwimZones, fmtPaceSecKm } from '../../lib/athlete/swimZones.js'

// Zone colors: progressive from easy (grey) to anaerobic (red)
const ZONE_COLORS = [
  '#444444', // Z1 Recovery
  '#5bc25b', // Z2 Aerobic
  '#0064ff', // Z3 CSS
  '#f5c542', // Z4 Threshold
  '#ff6600', // Z5 VO2max
  '#e03030', // Z6 Anaerobic
]

export default function SwimmingZonesCard({ log = [] }) {
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const { t }  = useContext(LangCtx)

  const data = useMemo(() => computeSwimZones(log), [log])

  if (!data) return null

  const { cssSecPer100m, zones, sessionsScanned } = data

  const title = t('swimZonesTitle')
    || (lang === 'tr' ? 'YÜZME ZON SİSTEMİ (Wakayoshi)' : 'SWIM ZONE SYSTEM (Wakayoshi)')

  const subtitle = `${t('swimTPace') || (lang === 'tr' ? 'T-TEMPO / CSS' : 'T-PACE / CSS')}: `
    + `${fmtPaceSecKm(cssSecPer100m)}/100m · ${sessionsScanned} `
    + (lang === 'tr' ? 'seans' : 'sessions')

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
        <span>◈ {title}</span>
      </div>

      {/* Subtitle: T-pace · sessions count */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '11px',
        color: 'var(--muted)',
        marginBottom: '12px',
        letterSpacing: '0.04em',
      }}>
        {subtitle}
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
              <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>PACE /100m</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z, i) => {
              const color = ZONE_COLORS[i] || '#888'

              // Pace range label
              // Z1 Recovery: paceMax is null → faster than X:XX (no lower limit)
              // Z6 Anaerobic: paceMin is 0 → faster than Z5 boundary → show "< X:XX"
              // paceMin = slower bound (higher sec = slower), paceMax = faster bound (lower sec)
              // In swimmingZones: paceMin = cssSecPer100m * pctMin, paceMax = cssSecPer100m * pctMax
              // Zone 1: pctMin=1.20, pctMax=Infinity → paceMin=108 (css=90), paceMax=null
              //   meaning: pace > 108 s/100m (slower than 1:48)
              // Zone 6: pctMin=0, pctMax=0.85 → paceMin=0, paceMax=76.5
              //   meaning: pace < 76.5 s/100m (faster than 1:16.5)
              let paceLabel
              if (z.paceMax === null) {
                // Zone 1: slower than paceMin bound
                paceLabel = `> ${fmtPaceSecKm(z.paceMin)}`
              } else if (!z.paceMin || z.paceMin <= 0) {
                // Zone 6: faster than paceMax bound
                paceLabel = `< ${fmtPaceSecKm(z.paceMax)}`
              } else {
                paceLabel = `${fmtPaceSecKm(z.paceMax)}–${fmtPaceSecKm(z.paceMin)}`
              }

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
                    {paceLabel}
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
        ℹ Wakayoshi et al. (1992) — Critical Swim Speed
      </div>
    </div>
  )
}
