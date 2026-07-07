// RowingMetricsCard — renders for sessions with sport_type='rowing' (last 30 days)
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  splitPer500m, formatSplit,
  strokeEfficiency, classifyStrokeRate,
  rowingEfficiencyFactor,
  predict2000m, concept2VO2max,  // ADD THESE
} from '../../lib/sport/rowing.js'
import { getReference } from '../../lib/sport/sportsRecords.js'

const ZONE_COLORS = {
  recovery:  '#4caf50',
  steady:    '#2196f3',
  threshold: '#ff9800',
  race:      '#f44336',
  sprint:    '#9c27b0',
}

function RowingMetricsCard({ log = [], profile = {} }) {
  const { lang, t } = useContext(LangCtx)

  const rowingData = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    // v9.474 — the card matched only `sport_type === 'rowing'`, a shape NO real
    // path produces post-sanitize (Strava entries carry type='row'; even the
    // Concept2 CSV import lost sport_type to the sanitizer whitelist) — so it
    // showed "no rowing sessions" forever, for everyone. Match the canonical
    // entry shape and normalize to the field names/units the card math expects:
    // duration SECONDS (entries store minutes; durationSec wins when present),
    // distance (distanceM fallback), avg_hr (avgHR), avg_spm — Strava rowing
    // cadence IS strokes/min — with strokes derived when absent.
    const sessions = log
      .filter(s => s && (s.sport_type === 'rowing' || /row/i.test(s.type || '') || /row/i.test(s.sport || '')) && s.date >= cutoff)
      .map(s => {
        const durationSec = Number(s.durationSec) > 0 ? Number(s.durationSec) : (Number(s.duration) || 0) * 60
        const avg_spm = s.avg_spm ?? (Number(s.avgCadence) > 0 ? Number(s.avgCadence) : null)
        return {
          ...s,
          duration: durationSec,
          distance: s.distance ?? s.distanceM ?? null,
          avg_hr:   s.avg_hr ?? s.avgHR ?? null,
          avg_spm,
          strokes:  s.strokes ?? (avg_spm && durationSec ? Math.round(avg_spm * (durationSec / 60)) : null),
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
    return sessions
  }, [log])

  const last = rowingData[0]

  // v9.52.0 — Drag factor vs class norm. Concept2 + Kleshnev RBN Vol 5 (2005):
  //   HW male  (>72.5kg):    130-140
  //   LW male  (≤72.5kg):    115-130
  //   HW female (>59kg):     120-130
  //   LW female (≤59kg):     110-125
  // Below norm = under-loaded for class; above = stroke-shortening / lumbar
  // overload. In-range = green. Skipped entirely when dragFactor unset.
  const dfClass = useMemo(() => {
    const df = parseFloat(profile?.dragFactor || 0)
    if (!df) return null
    const wt = parseFloat(profile?.weight || 0)
    const gender = profile?.gender
    let norm = { min: 120, max: 140, label: { en: 'Concept2 standard', tr: 'Concept2 standart' } }
    if (gender === 'male' && wt > 0) {
      norm = wt > 72.5
        ? { min: 130, max: 140, label: { en: 'HW male norm', tr: 'Ağır sıklet erkek normu' } }
        : { min: 115, max: 130, label: { en: 'LW male norm', tr: 'Hafif sıklet erkek normu' } }
    } else if (gender === 'female' && wt > 0) {
      norm = wt > 59
        ? { min: 120, max: 130, label: { en: 'HW female norm', tr: 'Ağır sıklet kadın normu' } }
        : { min: 110, max: 125, label: { en: 'LW female norm', tr: 'Hafif sıklet kadın normu' } }
    }
    let status, color
    if (df < norm.min)      { status = { en: 'below norm',  tr: 'norm altı'    }; color = '#4a90d9' }
    else if (df > norm.max) { status = { en: 'above norm',  tr: 'norm üstü'    }; color = '#e03030' }
    else                    { status = { en: 'in range',    tr: 'aralık içi'  }; color = '#5bc25b' }
    return { df, norm, status, color }
  }, [profile])

  // 2000m prediction and VO2max — hoisted before early return to satisfy Rules of Hooks
  // v9.487 (rowing deep-dive F1) — Paul's Law is a MAXIMAL-effort scaling law;
  // running it on the most recent session of any kind painted a pessimistic
  // "2k prediction" from every steady UT2 paddle and overwrote real test
  // results. Gate to maximal-ish sessions (RPE ≥ 8, a test tag, or a
  // test-looking name) and pick the FASTEST qualifying split in the window,
  // not merely the newest session. No qualifying effort → no prediction.
  const isMaximalish = (s) =>
    (s.rpe != null && Number(s.rpe) >= 8) ||
    s.sessionTag === 'test' ||
    /\b(2k|2000m?)\b.*test|test.*\b(2k|2000m?)\b|time.?trial|\btt\b/i.test(`${s.type || ''} ${s.notes || ''}`)
  const pred2k = useMemo(() => {
    const candidates = rowingData.filter(s => isMaximalish(s) && s.duration > 0 && s.distance > 0)
    if (!candidates.length) return null
    // Fastest split wins (best maximal effort in the window)
    const best = candidates.reduce((a, b) =>
      (a.duration / a.distance) <= (b.duration / b.distance) ? a : b)
    const timeSec = best.duration
    const distM   = best.distance
    const predicted = Math.abs(distM - 2000) < 200
      ? timeSec                              // close enough to 2000m
      : predict2000m(timeSec, distM)         // Paul's Law projection
    if (!predicted) return null
    const bw = parseFloat(profile?.weight_kg || profile?.weight || 0)
    const trained = ['competitive', 'elite'].includes((profile?.athleteLevel || '').toLowerCase())
    const vo2 = bw > 0 ? concept2VO2max(predicted, bw, { gender: profile?.gender || 'male', trained }) : null
    // v9.51.0 — W/kg from predicted 2k split.
    // Concept2 power formula: P (W) = 2.80 / (split_sec / 500)^3
    // Benchmarks (Mikulic 2008, Kerr 2007 AIS rowing):
    //   ≥6.4 elite HW men · ≥5.4 university D1/Henley men · ≥4.4 club · <3.5 recreational
    let wkg = null, wkgBand = null
    if (bw > 0) {
      const splitSec = predicted / 4
      const powerW = 2.80 / Math.pow(splitSec / 500, 3)
      wkg = Math.round((powerW / bw) * 100) / 100
      if (wkg >= 6.4) wkgBand = { en: 'World class',  tr: 'Dünya sınıfı', color: '#f5c542' }
      else if (wkg >= 5.4) wkgBand = { en: 'University', tr: 'Üniversite',   color: '#ff6600' }
      else if (wkg >= 4.4) wkgBand = { en: 'Club',       tr: 'Kulüp',        color: '#5bc25b' }
      else if (wkg >= 3.5) wkgBand = { en: 'Competitive', tr: 'Rekabetçi',  color: '#4a90d9' }
      else                 wkgBand = { en: 'Recreational', tr: 'Rekreasyon', color: '#888' }
    }
    // v9.52.0 — % of 2k WR. Predicted 2k vs WR (sportsRecords rowing 2000 = 5:35.8).
    // Note: ratio is WR/predicted so faster=higher percent (WR-grade).
    const wrRef = getReference('rowing', 2000)
    const pctWR = wrRef ? Math.round((wrRef.wr / predicted) * 1000) / 10 : null
    const predTotal = Math.round(predicted)  // v9.487 (F5): total-first — no "6:60"
    const mm = Math.floor(predTotal / 60)
    const ss = String(predTotal % 60).padStart(2, '0')
    return { timeStr: `${mm}:${ss}`, isProjection: Math.abs(distM - 2000) >= 200, vo2, wkg, wkgBand, pctWR }
  }, [rowingData, profile])

  if (!last) return (
    <div style={{ ...S.card, marginBottom: 16, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {lang === 'tr' ? 'Kürek Metrikleri' : 'Rowing Metrics'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
        {lang === 'tr' ? 'Son 30 günde kürek antrenmanı yok.' : 'No rowing sessions in the last 30 days.'}
      </div>
    </div>
  )

  const split = splitPer500m(last.distance, last.duration)
  const strEff = strokeEfficiency(last.distance, last.strokes)
  const srClass = last.avg_spm ? classifyStrokeRate(last.avg_spm) : null
  const ef = rowingEfficiencyFactor(last.distance, last.duration, last.avg_hr)

  // v9.52.0 — DPS (distance per stroke) class bands per Kleshnev 2016
  // (Biomechanics of Rowing) + Nolte 2005 (Rowing Faster). Single-scull on-
  // water norms; erg DPS runs ~1m higher per zone. Caveat (Kleshnev 2016):
  // DPS only meaningful given speed — same DPS at low velocity = paddling.
  // We surface it anyway because the split is rendered alongside.
  const dpsBand = strEff
    ? (strEff >= 10.8 ? { en: 'Elite',        tr: 'Elit',          color: '#f5c542' }
      : strEff >= 9.5  ? { en: 'University',  tr: 'Üniversite',    color: '#ff6600' }
      : strEff >= 8    ? { en: 'Club',        tr: 'Kulüp',         color: '#5bc25b' }
      : strEff >= 6.5  ? { en: 'Recreational', tr: 'Rekreasyon',   color: '#4a90d9' }
      :                  { en: 'Novice',       tr: 'Acemi',         color: '#888' })
    : null

  const cardStyle = {
    ...S.card,
    marginBottom: 16,
    padding: '16px 20px',
  }

  const labelStyle = {
    fontSize: 11,
    color: 'var(--muted)',
    fontFamily: "'IBM Plex Mono', monospace",
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 2,
  }

  const valueStyle = {
    fontSize: 26,
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1.1,
  }

  const subStyle = {
    fontSize: 11,
    color: 'var(--muted)',
    fontFamily: "'IBM Plex Mono', monospace",
    marginTop: 2,
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {t('rowingMetrics') || (lang === 'tr' ? 'Kürek Metrikleri' : 'Rowing Metrics')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
          {last.date}
        </span>
      </div>

      {/* Split + Stroke Efficiency */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
        <div>
          <div style={labelStyle}>{t('rowingSplit') || '/500m split'}</div>
          <div style={valueStyle}>{split ? formatSplit(split) : '—'}</div>
          <div style={subStyle}>
            {last.distance ? `${(last.distance / 1000).toFixed(1)} km` : ''}
            {last.duration ? ` · ${Math.round(last.duration / 60)} min` : ''}
          </div>
        </div>

        {strEff && (
          <div>
            <div style={labelStyle}>{t('rowingStrokeEff') || 'DPS (m/stroke)'}</div>
            <div style={{ ...valueStyle, color: dpsBand?.color || valueStyle.color }}>{strEff.toFixed(1)}</div>
            <div style={{ ...subStyle, color: dpsBand?.color || subStyle.color, fontWeight: 600 }}>
              {dpsBand ? (dpsBand[lang] || dpsBand.en) : ''}
              {last.strokes ? ` · ${last.strokes} strokes` : ''}
            </div>
          </div>
        )}

        {ef && (
          <div>
            <div style={labelStyle} title="Efficiency Factor: metres per second per heartbeat">{t('rowingEF') || 'Rowing EF'}</div>
            <div style={valueStyle}>{ef}</div>
            <div style={subStyle}>m·s⁻¹/bpm</div>
          </div>
        )}
      </div>

      {/* v9.52.0 — Drag factor vs class norm */}
      {dfClass && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {lang === 'tr' ? 'Drag faktörü' : 'Drag factor'}
          </span>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 600,
            background: dfClass.color + '22',
            color: dfClass.color,
            border: `1px solid ${dfClass.color}55`,
          }}>
            DF {dfClass.df} · {dfClass.status[lang] || dfClass.status.en}
            <span style={{ opacity: 0.7, fontWeight: 400 }}>
              {' · '}{dfClass.norm.label[lang] || dfClass.norm.label.en} {dfClass.norm.min}-{dfClass.norm.max}
            </span>
          </span>
        </div>
      )}

      {/* Stroke rate zone badge */}
      {srClass && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {t('rowingStrokeRate') || 'Stroke rate'}
          </span>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 600,
            background: ZONE_COLORS[srClass.zone] + '22',
            color: ZONE_COLORS[srClass.zone],
            border: `1px solid ${ZONE_COLORS[srClass.zone]}55`,
          }}>
            {srClass.label[lang] || srClass.label.en}
            {last.avg_spm ? ` · ${last.avg_spm} spm` : ''}
          </span>
        </div>
      )}

      {/* Session count footer */}
      {rowingData.length > 1 && (
        <div style={{ ...subStyle, marginTop: 10 }}>
          {rowingData.length} rowing sessions in last 30 days
        </div>
      )}

      {pred2k && (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 6 }}>
            {lang === 'tr' ? '◈ 2000m TAHMİNİ' : '◈ 2000m PREDICTION'}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                {pred2k.isProjection ? (lang === 'tr' ? 'TAHMİN (Paul Yasası)' : 'PROJECTED (Paul\'s Law)') : (lang === 'tr' ? 'ÖLÇÜLEN' : 'MEASURED')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.1 }}>
                {pred2k.timeStr}
              </div>
            </div>
            {pred2k.vo2 && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  VO2max (Concept2)
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0064ff', fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.1 }}>
                  {pred2k.vo2}
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", marginTop: 2 }}>mL/kg/min</div>
              </div>
            )}
            {pred2k.wkg && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  W/kg (2k erg)
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: pred2k.wkgBand.color, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.1 }}>
                  {pred2k.wkg}
                </div>
                <div style={{ fontSize: 9, color: pred2k.wkgBand.color, fontFamily: "'IBM Plex Mono',monospace", marginTop: 2, fontWeight: 600 }}>
                  {pred2k.wkgBand[lang] || pred2k.wkgBand.en}
                </div>
              </div>
            )}
            {pred2k.pctWR != null && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  % of 2k WR
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.1 }}>
                  {pred2k.pctWR}%
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace", marginTop: 2 }}>
                  {lang === 'tr' ? '5:35.8 DR' : 'WR 5:35.8'}
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 9, color: '#333', marginTop: 8 }}>
            ℹ Paul (1969) · Concept2 VO2max formula · Mikulic 2008 / Kerr 2007 W/kg bands · Concept2 WR
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(RowingMetricsCard)
