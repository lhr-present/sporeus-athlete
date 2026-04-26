// ─── RunningCVCard.jsx — Critical Velocity + D' from multi-distance log (E42) ─
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { computeRunningCV, fmtPace, classifyCV } from '../../lib/athlete/runningCV.js'

// Classification → color mapping
const CLASS_COLORS = {
  elite:        '#e03030',
  advanced:     '#ff6600',
  intermediate: '#f5c542',
  recreational: '#5bc25b',
}

// Classification → display label (bilingual)
const CLASS_LABELS = {
  elite:        { en: 'ELITE',        tr: 'ELİT'        },
  advanced:     { en: 'ADVANCED',     tr: 'GELİŞMİŞ'    },
  intermediate: { en: 'INTERMEDIATE', tr: 'ORTA SEVİYE'  },
  recreational: { en: 'RECREATIONAL', tr: 'REKREASYONEL' },
}

export default function RunningCVCard({ log = [] }) {
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const { t }  = useContext(LangCtx)

  const data = useMemo(() => computeRunningCV(log), [log])

  if (!data) return null

  const { CV: _CV, DAna, CVPaceSecKm, effortsUsed, efforts } = data
  const classification = classifyCV(CVPaceSecKm)
  const classColor     = CLASS_COLORS[classification]
  const classLabel     = CLASS_LABELS[classification]?.[lang] || CLASS_LABELS[classification]?.en

  const title = t('cvTitle') || (lang === 'tr' ? 'KRİTİK HIZ' : 'CRITICAL VELOCITY')

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

      {/* Main metrics row */}
      <div style={{
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap',
        marginBottom: '12px',
      }}>
        {/* CV Pace */}
        <div>
          <span style={{ ...S.statVal, fontSize: '26px' }}>
            {fmtPace(CVPaceSecKm)}
          </span>
          <span style={{ ...S.statLbl }}>
            {t('cvPaceLabel') || (lang === 'tr' ? 'KV TEMPO' : 'CV PACE')}
          </span>
        </div>

        {/* D' Anaerobic Reserve */}
        <div>
          <span style={{ ...S.statVal, fontSize: '26px', color: '#0064ff' }}>
            {DAna}m
          </span>
          <span style={{ ...S.statLbl }}>
            {t('cvDAnaLabel') || (lang === 'tr' ? "D' ANAEROBİK REZERVİ" : "D' ANAEROBIC RESERVE")}
          </span>
        </div>
      </div>

      {/* Classification badge */}
      <div style={{ marginBottom: '10px' }}>
        <span style={{
          display: 'inline-block',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '11px',
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: '3px',
          background: classColor + '22',
          color: classColor,
          border: `1px solid ${classColor}44`,
          letterSpacing: '0.07em',
        }}>
          {classLabel}
        </span>
      </div>

      {/* Efforts used */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '11px',
        color: 'var(--muted)',
        marginBottom: '10px',
        letterSpacing: '0.03em',
      }}>
        {lang === 'tr'
          ? `${effortsUsed} mesafe çabasından türetildi`
          : `Derived from ${effortsUsed} distance efforts`}
      </div>

      {/* Efforts table */}
      <div style={{ overflowX: 'auto', marginBottom: '10px' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '11px',
        }}>
          <thead>
            <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left',  padding: '4px 6px', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {lang === 'tr' ? 'MESAFE' : 'DISTANCE'}
              </th>
              <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {lang === 'tr' ? 'TEMPO' : 'PACE'}
              </th>
              <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {lang === 'tr' ? 'TARİH' : 'DATE'}
              </th>
            </tr>
          </thead>
          <tbody>
            {efforts.map((e, i) => {
              const paceSecKm = e.timeSec / (e.distanceM / 1000)
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '5px 6px', color: '#ff6600', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {e.label}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {fmtPace(paceSecKm)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {e.date || '—'}
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
        letterSpacing: '0.03em',
      }}>
        ℹ Monod &amp; Scherrer (1965) · Morton (1986) — Critical velocity model
      </div>

    </div>
  )
}
