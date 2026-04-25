// ─── TriathlonLoadCard.jsx — 28-day triathlon load breakdown (E44) ────────────
// Consumes computeTriLoad from triLoad.js (which wires calculateTriathlonTSS,
// brickFatigueAdjustment, TRIATHLON_DISTANCES from triathlon.js).
// Banister & Calvert (1980) · Wakayoshi et al. (1992)

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { computeTriLoad, computeTriZones } from '../../lib/athlete/triLoad.js'

// Discipline colours — swim blue, bike orange, run green
const DISC_COLORS = {
  swim: '#0064ff',
  bike: '#ff6600',
  run:  '#5bc25b',
}

// Distance key → display label (bilingual)
const DIST_LABELS = {
  sprint:  { en: 'Sprint',  tr: 'Sprint' },
  olympic: { en: 'Olympic', tr: 'Olimpik' },
  half:    { en: 'Half',    tr: 'Yarı-IM' },
  full:    { en: 'Full',    tr: 'Full IM' },
}

export default function TriathlonLoadCard({ log = [], profile = {} }) {
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const { t }  = useContext(LangCtx)

  const data     = useMemo(() => computeTriLoad(log, profile), [log, profile])
  const triZones = useMemo(() => computeTriZones(profile), [profile])

  if (!data) return null

  const {
    swimTSS, bikeTSS, runTSS, totalTSS,
    swimCount, bikeCount, runCount,
    bricks, repWeekTSS, nearestRace, DISTANCES,
  } = data

  const title = t('triLoadTitle') || (lang === 'tr' ? 'TRİATLON YÜK ANALİZİ' : 'TRIATHLON LOAD BREAKDOWN')

  // Max TSS across disciplines — used to scale bars
  const maxTSS = Math.max(swimTSS, bikeTSS, runTSS, 1)

  // Max brick factor for summary line
  const maxFactor = bricks.reduce((m, b) => Math.max(m, b.brickFactor), 1.0)

  // Nearest race info
  const raceInfo = nearestRace ? DISTANCES[nearestRace] : null
  const distLabel = nearestRace ? (DIST_LABELS[nearestRace]?.[lang] || nearestRace) : null
  const weeklyAvgTSS = totalTSS > 0 ? Math.round(totalTSS / 4) : 0

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
        marginBottom: '12px',
      }}>
        <span>◈ {title}</span>
        <span style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 400 }}>28D</span>
      </div>

      {/* 28-day TSS by discipline */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '9px',
        color: 'var(--muted)',
        letterSpacing: '0.07em',
        marginBottom: '8px',
      }}>
        {t('triTSSBreak') || (lang === 'tr' ? '28 GÜNLÜK DİSİPLİN BAZLI TSS' : '28-DAY TSS BY DISCIPLINE')}
      </div>

      {[
        { key: 'swim', label: 'SWIM', tss: swimTSS, count: swimCount },
        { key: 'bike', label: 'BIKE', tss: bikeTSS, count: bikeCount },
        { key: 'run',  label: 'RUN',  tss: runTSS,  count: runCount  },
      ].map(({ key, label, tss, count }) => {
        const color   = DISC_COLORS[key]
        const barPct  = maxTSS > 0 ? Math.max(2, Math.round(tss / maxTSS * 100)) : 2
        return (
          <div key={key} style={{ marginBottom: '8px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '3px',
            }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px',
                color,
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}>
                {label}
              </span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px',
                color: 'var(--text)',
              }}>
                {tss} TSS
                <span style={{ color: 'var(--muted)', fontSize: '9px', marginLeft: '6px' }}>
                  ({count} {lang === 'tr' ? 'seans' : 'sess'})
                </span>
              </span>
            </div>
            {/* Thin colour bar */}
            <div style={{
              height: '3px',
              borderRadius: '2px',
              background: 'var(--border)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${barPct}%`,
                background: color,
                borderRadius: '2px',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )
      })}

      {/* Total row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        borderTop: '1px solid var(--border)',
        paddingTop: '8px',
        marginTop: '4px',
        marginBottom: '12px',
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '11px',
          color: 'var(--muted)',
          letterSpacing: '0.06em',
        }}>
          TOTAL
        </span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '16px',
          fontWeight: 700,
          color: '#ff6600',
        }}>
          {totalTSS} TSS
        </span>
      </div>

      {/* Brick sessions */}
      {bricks.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid #ff660033',
          borderRadius: '4px',
          padding: '8px 10px',
          marginBottom: '12px',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            color: '#ff6600',
            letterSpacing: '0.07em',
            marginBottom: '4px',
          }}>
            {t('triBrick') || (lang === 'tr' ? 'BRICK SEANSLAR' : 'BRICK SESSIONS')}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px',
            color: 'var(--text)',
            marginBottom: '2px',
          }}>
            {bricks.length} {lang === 'tr'
              ? `brick seans${bricks.length > 1 ? '' : ''} (son 28 gün)`
              : `brick session${bricks.length > 1 ? 's' : ''} this period`}
          </div>
          {maxFactor > 1.0 && (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              color: '#f5c542',
            }}>
              {lang === 'tr'
                ? `Maks brick yorgunluğu: +${((maxFactor - 1) * 100).toFixed(1)}% koşu tempo kaybı`
                : `Max brick fatigue: +${((maxFactor - 1) * 100).toFixed(1)}% run pace degradation`}
            </div>
          )}
        </div>
      )}

      {/* Race distance context */}
      {raceInfo && weeklyAvgTSS > 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '8px 10px',
          marginBottom: '12px',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.07em',
            marginBottom: '4px',
          }}>
            {lang === 'tr' ? 'YARIŞ MESAFESİ BAĞLAMI' : 'RACE DISTANCE CONTEXT'}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px',
            color: 'var(--text)',
            lineHeight: 1.6,
          }}>
            {lang === 'tr'
              ? `Haftalık ort. TSS ~${weeklyAvgTSS}, ${distLabel} mesafesi hedefine uyuyor (${raceInfo.typicalTSS.lo}–${raceInfo.typicalTSS.hi})`
              : `Weekly avg TSS ~${weeklyAvgTSS} matches ${distLabel} distance target (${raceInfo.typicalTSS.lo}–${raceInfo.typicalTSS.hi})`}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            color: 'var(--muted)',
            marginTop: '4px',
          }}>
            {lang === 'tr'
              ? `${distLabel}: ${raceInfo.swim}km yüzme · ${raceInfo.bike}km bisiklet · ${raceInfo.run}km koşu`
              : `${distLabel}: ${raceInfo.swim}km swim · ${raceInfo.bike}km bike · ${raceInfo.run}km run`}
          </div>
        </div>
      )}

      {/* Rep week TSS (if available) */}
      {repWeekTSS != null && (
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '10px',
          color: 'var(--muted)',
          marginBottom: '10px',
        }}>
          {lang === 'tr'
            ? `Temsili haftalık TSS (calculateTriathlonTSS): ~${Math.round(repWeekTSS)}`
            : `Representative week TSS (calculateTriathlonTSS): ~${Math.round(repWeekTSS)}`}
        </div>
      )}

      {/* Discipline zone system */}
      {triZones && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '6px' }}>
            {lang === 'tr' ? '◈ DİSİPLİN ZON SİSTEMİ' : '◈ DISCIPLINE ZONE SYSTEM'}
          </div>
          {triZones.cycling && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '8px', color: '#ff6600', marginBottom: '3px' }}>BIKE ZONES (Coggan)</div>
              {triZones.cycling.slice(0, 4).map(z => (
                <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555', padding: '2px 0' }}>
                  <span>Z{z.id} {z.name}</span>
                  <span style={{ color: '#888' }}>{z.minWatts}–{z.maxWatts ?? '∞'}W</span>
                </div>
              ))}
            </div>
          )}
          {triZones.running && (
            <div>
              <div style={{ fontSize: '8px', color: '#5bc25b', marginBottom: '3px' }}>RUN ZONES (Daniels)</div>
              {triZones.running.slice(0, 3).map(z => {
                const m = Math.floor(z.paceSecKm / 60)
                const s = String(Math.round(z.paceSecKm % 60)).padStart(2, '0')
                return (
                  <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555', padding: '2px 0' }}>
                    <span>Z{z.id} {z.name}</span>
                    <span style={{ color: '#888' }}>{m}:{s}/km</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Citation */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '9px',
        color: 'var(--muted)',
        letterSpacing: '0.03em',
      }}>
        ℹ Banister &amp; Calvert (1980) · Wakayoshi (1992) — Tri load model
      </div>

    </div>
  )
}
