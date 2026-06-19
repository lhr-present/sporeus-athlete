// ─── WeeklyVolumeIntensityRatioCard.jsx ─────────────────────────────────────
// Surfaces `analyzeWeeklyVolumeIntensityRatio` — weekly minutes ÷ weekly TSS
// over 8 ISO weeks. Detects intensity creep (ratio shrinking → more TSS per
// minute) vs aerobic-base building (ratio growing → longer easier sessions).
//
// Refs: Foster 2001 (Monitoring training in athletes with reference to
// overtraining syndrome); Seiler 2010 (polarized intensity distribution).
//
// Render rules:
//   - Returns null when the pure-fn returns null (insufficient valid weeks).
//   - Otherwise renders one of three bands (CREEPING_INTENSITY / STABLE /
//     VOLUME_GROWING).
//
// Bilingual EN/TR via LangCtx.
// Test anchors: data-weekly-volume-intensity-ratio-card, data-intensity-band,
//               data-delta, data-avg-ratio, data-week-bar.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeWeeklyVolumeIntensityRatio } from '../../lib/athlete/weeklyVolumeIntensityRatio.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  CREEPING_INTENSITY: '#ff6600', // orange
  STABLE:             '#5bc25b', // green
  VOLUME_GROWING:     '#0064ff', // blue
}

const BAND_LABEL_EN = {
  CREEPING_INTENSITY: 'CREEPING INTENSITY',
  STABLE:             'STABLE',
  VOLUME_GROWING:     'VOLUME GROWING',
}
const BAND_LABEL_TR = {
  CREEPING_INTENSITY: 'YOĞUNLUK ARTIYOR',
  STABLE:             'STABİL',
  VOLUME_GROWING:     'HACİM ARTIYOR',
}

const RECO_EN = {
  CREEPING_INTENSITY: "Same time, more strain — intensity is creeping up. Verify it's intentional (block plan) or reduce.",
  STABLE:             'Volume-to-intensity balance is steady — predictable load distribution.',
  VOLUME_GROWING:     'Longer easier sessions — classic aerobic-base building.',
}
const RECO_TR = {
  CREEPING_INTENSITY: 'Aynı süre, daha çok yük — yoğunluk gizlice artıyor. İstemli mi kontrol et, değilse azalt.',
  STABLE:             'Hacim-yoğunluk dengesi sabit — öngörülebilir yük dağılımı.',
  VOLUME_GROWING:     'Daha uzun ve daha kolay seanslar — klasik aerobik temel inşası.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function WeeklyVolumeIntensityRatioCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeWeeklyVolumeIntensityRatio({
      log,
      today: todayIso(),
      windowWeeks: 8,
    }),
    [log]
  )

  if (!result) return null

  const { band, delta, weeks, avgRatio, citation } = result
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const reco = isTR ? RECO_TR[band] : RECO_EN[band]

  const title     = isTR ? 'HACİM ÷ YOĞUNLUK · 8H' : 'VOLUME ÷ INTENSITY · 8W'
  const ariaLabel = isTR
    ? 'Haftalık hacim/yoğunluk oranı (Foster 2001; Seiler 2010)'
    : 'Weekly volume-to-intensity ratio (Foster 2001; Seiler 2010)'
  const ratioUnit = isTR ? 'dk/TSS' : 'min/TSS'
  const deltaLbl  = isTR ? 'DEĞİŞİM' : 'DELTA'
  const barsLbl   = isTR ? 'HAFTALIK ORAN' : 'WEEKLY RATIO'

  // Bar chart geometry.
  const barAreaH    = 48
  const barAreaGap  = 4
  const validRatios = weeks
    .map(w => w.ratio)
    .filter(r => Number.isFinite(r))
  const maxRatio = validRatios.length ? Math.max(...validRatios) : 0

  const deltaPct = (delta * 100)
  const deltaSign = deltaPct >= 0 ? '+' : ''

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-weekly-volume-intensity-ratio-card
      data-intensity-band={band}
      data-delta={delta.toFixed(4)}
      data-avg-ratio={avgRatio.toFixed(4)}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
            color: 'var(--text, #ccc)',
          }}>
            {title}
          </div>
          <div
            style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.1, marginTop: 6 }}
          >
            {avgRatio.toFixed(2)}{' '}
            <span style={{ fontSize: 11, color: 'var(--muted, #888)', fontWeight: 400 }}>
              {ratioUnit}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-intensity-band-label
            style={{
              display: 'inline-block',
              padding: '3px 8px',
              border: `1px solid ${color}`,
              color,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              borderRadius: 4,
            }}
          >
            {bandLabel}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 6 }}>
            {deltaLbl}
          </div>
          <div
            data-delta-display
            style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}
          >
            {deltaSign}{deltaPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 10, padding: '6px 8px',
        background: 'var(--surface, #111)', borderRadius: 4,
        fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
      }}>
        ↗ {reco}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 4 }}>
          {barsLbl}
        </div>
        <div
          role="group"
          aria-label={barsLbl}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: barAreaGap,
            height: barAreaH,
            background: 'var(--surface, #111)',
            padding: '4px 6px',
            borderRadius: 4,
          }}
        >
          {weeks.map((w, i) => {
            const isValid = Number.isFinite(w.ratio)
            const h = isValid && maxRatio > 0
              ? Math.max(2, Math.round((w.ratio / maxRatio) * (barAreaH - 8)))
              : 3
            return (
              <div
                key={`${w.weekStart}-${i}`}
                data-week-bar
                data-week-start={w.weekStart}
                data-week-ratio={isValid ? w.ratio.toFixed(4) : ''}
                title={isValid ? `${w.weekStart}: ${w.ratio.toFixed(2)} ${ratioUnit}` : w.weekStart}
                style={{
                  flex: 1,
                  height: h,
                  background: isValid ? color : 'var(--border, #333)',
                  opacity: isValid ? 1 : 0.35,
                  width: isValid ? undefined : 3,
                  minWidth: isValid ? 4 : 3,
                  borderRadius: 2,
                }}
              />
            )
          })}
        </div>
      </div>

      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(WeeklyVolumeIntensityRatioCard)
