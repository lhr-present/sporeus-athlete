// src/components/dashboard/DurabilityCard.jsx
// Durability Score — how well the athlete sustains high-end power in the last
// hour of long efforts. Only visible when the log contains ≥1 FIT-imported
// session (≥90 min with a power stream) and a baseline MMP can be computed.
//
// Reference: Maunder E. et al. (2021) Sports Med 51:1523–1550
import { memo, useMemo } from 'react'
import { computeDurability } from '../../lib/science/durabilityScore.js'
import { S } from '../../styles.js'

const TIER_COLOR = { high: '#5bc25b', moderate: '#ff6600', low: '#f5c542', very_low: '#e03030' }
const TIER_EN = { high: 'High', moderate: 'Moderate', low: 'Low', very_low: 'Very Low' }
const TIER_TR = { high: 'Yüksek', moderate: 'Orta', low: 'Düşük', very_low: 'Çok Düşük' }

// O(m) sliding-window 5-min MMP across all qualifying sessions (last 12 months)
function baselineMMP5(log) {
  const cutoff = Date.now() - 365 * 86400_000
  let best = 0
  for (const s of (log || [])) {
    if (!Array.isArray(s.powerStream) || s.powerStream.length < 300) continue
    if (new Date(s.date).getTime() < cutoff) continue
    const ps = s.powerStream
    let sum = 0
    for (let j = 0; j < 300; j++) sum += ps[j]
    if (sum / 300 > best) best = sum / 300
    for (let i = 300; i < ps.length; i++) {
      sum += ps[i] - ps[i - 300]
      if (sum / 300 > best) best = sum / 300
    }
  }
  return best > 0 ? Math.round(best * 10) / 10 : null
}

function DurabilityCard({ log, lang }) {
  const baseline = useMemo(() => baselineMMP5(log), [log])

  // Sessions ≥90 min with power stream, newest first, capped at 8 for history
  const qualifying = useMemo(() =>
    (log || [])
      .filter(s => Array.isArray(s.powerStream) && s.powerStream.length > 0 &&
                   ((s.durationSec ?? (s.duration != null ? s.duration * 60 : 0)) >= 5400))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8),
  [log])

  const scores = useMemo(() => {
    if (!baseline) return []
    return qualifying
      .map(s => computeDurability(s, baseline))
      .filter(Boolean)
      .reverse() // oldest→newest for the trend bar
  }, [qualifying, baseline])

  if (!scores.length) return null

  const latest = scores[scores.length - 1]
  const color  = TIER_COLOR[latest.tier]
  const label  = lang === 'tr' ? TIER_TR[latest.tier] : TIER_EN[latest.tier]

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '193ms', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <div style={S.cardTitle}>
          {lang === 'tr' ? 'DAYANIKLILIK SKORU' : 'DURABILITY SCORE'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>Maunder 2021</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '10px' }}>
        <div>
          <div style={{ ...S.mono, fontSize: '36px', fontWeight: 700, color, lineHeight: 1 }}>
            {latest.durabilityPct.toFixed(1)}%
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888', marginTop: '3px' }}>
            <span style={{ color }}>{label}</span>
            {' · '}
            {lang === 'tr' ? 'son saat 5dk pik / baz MMP' : 'last-hour 5min ÷ baseline MMP'}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: '#666' }}>
            {lang === 'tr' ? 'Son saat 5dk' : 'Last-hr 5min'}:{' '}
            <span style={{ color }}>{Math.round(latest.lastHour5minPeak)}W</span>
          </div>
          <div style={{ ...S.mono, fontSize: '10px', color: '#666' }}>
            {lang === 'tr' ? 'Baz 5dk MMP' : 'Baseline MMP'}:{' '}
            <span style={{ color: '#ff6600' }}>{Math.round(baseline)}W</span>
          </div>
        </div>
      </div>

      {/* Tier thresholds reference */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {[
          { label: '≥95%', tier: 'high',     text: lang === 'tr' ? 'Elit' : 'Elite'    },
          { label: '90%',  tier: 'moderate',  text: lang === 'tr' ? 'İyi'  : 'Good'    },
          { label: '85%',  tier: 'low',       text: lang === 'tr' ? 'Orta' : 'Fair'    },
          { label: '<85%', tier: 'very_low',  text: lang === 'tr' ? 'Düşük' : 'Low'   },
        ].map(t => (
          <div key={t.tier} style={{
            flex: 1, textAlign: 'center', padding: '3px 2px',
            background: latest.tier === t.tier ? `${TIER_COLOR[t.tier]}22` : 'transparent',
            borderRadius: '2px', border: `1px solid ${latest.tier === t.tier ? TIER_COLOR[t.tier] : '#1a1a1a'}`,
          }}>
            <div style={{ ...S.mono, fontSize: '8px', color: TIER_COLOR[t.tier] }}>{t.label}</div>
            <div style={{ ...S.mono, fontSize: '7px', color: '#555' }}>{t.text}</div>
          </div>
        ))}
      </div>

      {/* Session trend bars */}
      {scores.length > 1 && (
        <div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginBottom: '4px' }}>
            {scores.length}-{lang === 'tr' ? 'OTURUM TRENDİ' : 'SESSION TREND'}
          </div>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '28px' }}>
            {scores.map((r, i) => {
              const h    = Math.max(3, Math.round(r.durabilityPct / 100 * 28))
              const isLast = i === scores.length - 1
              return (
                <div key={i} style={{
                  flex: 1, height: `${h}px`, alignSelf: 'flex-end', borderRadius: '2px',
                  background: isLast ? TIER_COLOR[r.tier] : `${TIER_COLOR[r.tier]}66`,
                }} />
              )
            })}
          </div>
        </div>
      )}

      <div style={{ ...S.mono, fontSize: '8px', color: '#333', marginTop: '7px' }}>
        {lang === 'tr'
          ? '≥90dk güç akışlı antrenmanlar için geçerlidir'
          : 'Valid for sessions ≥90 min with 1Hz power stream only'}
      </div>
    </div>
  )
}

export default memo(DurabilityCard)
