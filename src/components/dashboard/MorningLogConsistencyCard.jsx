// ─── MorningLogConsistencyCard.jsx — habit-formation surface ───────────────
//
// Surfaces the pure-fn `analyzeMorningLogConsistency`
// (src/lib/athlete/morningLogConsistency.js). Renders a 28-day
// completion-rate dashboard for the morning recovery log so the
// athlete can see — at a glance — whether the input pipeline is
// reliable enough to drive insights.
//
// Citations:
//   Wood W. & Neal D.T. (2013) "The Habits of Health and Wellness:
//     Understanding the Psychology of Habit."
//   Lally P. et al. (2010) "How are habits formed: Modelling habit
//     formation in the real world."
//
// Renders NULL when:
//   - analyzer returns null (empty/invalid recovery array, bad window)
//   - daysLogged === 0 (no point shouting "0% logged" — onboarding job)

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeMorningLogConsistency } from '../../lib/athlete/morningLogConsistency.js'

const MONO = "'IBM Plex Mono', monospace"
const MS_PER_DAY = 86400000

const BAND_COLOR = {
  HABITUATED: '#5bc25b', // green
  DEVELOPING: '#0064ff', // blue
  SPORADIC:   '#ff6600', // orange
}
const BAND_TR = {
  HABITUATED: 'ALIŞKANLIK',
  DEVELOPING: 'GELİŞİYOR',
  SPORADIC:   'DÜZENSİZ',
}
const BAND_HINT = {
  HABITUATED: {
    en: 'Strong morning routine — recovery data is consistent enough to drive insights.',
    tr: 'Güçlü sabah rutini — toparlanma verisi içgörü üretmeye yetecek kadar düzenli.',
  },
  DEVELOPING: {
    en: 'Routine is forming. Aim for one more morning entry per week.',
    tr: 'Rutin oluşuyor. Haftada bir sabah kaydı daha hedefle.',
  },
  SPORADIC: {
    en: 'Inconsistent logging limits insight quality. Try logging 5 of next 7 mornings.',
    tr: 'Düzensiz kayıt içgörü kalitesini düşürüyor. Sonraki 7 sabahın 5\'ini kaydetmeyi dene.',
  },
}

function isLoggedEntry(entry) {
  if (!entry || typeof entry !== 'object') return false
  for (const f of ['sleepHrs', 'hrv', 'restingHR']) {
    const v = entry[f]
    if (v === null || v === undefined || v === '') continue
    if (Number.isFinite(Number(v))) return true
  }
  return false
}

function isoFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

function todayUTCms() {
  const t = new Date().toISOString().slice(0, 10)
  return new Date(t + 'T12:00:00Z').getTime()
}

/**
 * @description Surface `analyzeMorningLogConsistency` as a Dashboard card.
 * @param {{ recovery: Array }} props
 */
function MorningLogConsistencyCard({ recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeMorningLogConsistency({ recovery }),
    [recovery]
  )

  // Build the 28-cell grid in the same UTC frame the analyzer uses so
  // labels always match the analyzer's counts.
  const cells = useMemo(() => {
    if (!analysis) return []
    const win = analysis.windowDays
    const todayMs = todayUTCms()
    const loggedSet = new Set()
    for (const e of (Array.isArray(recovery) ? recovery : [])) {
      if (!isLoggedEntry(e)) continue
      const raw = e?.date
      if (!raw) continue
      const d = new Date(String(raw).slice(0, 10) + 'T12:00:00Z')
      if (Number.isNaN(d.getTime())) continue
      loggedSet.add(isoFromMs(d.getTime()))
    }
    // Build oldest → newest for left-to-right reading.
    const out = []
    for (let i = win - 1; i >= 0; i--) {
      const iso = isoFromMs(todayMs - i * MS_PER_DAY)
      out.push({ iso, logged: loggedSet.has(iso) })
    }
    return out
  }, [analysis, recovery])

  if (!analysis) return null
  if (analysis.daysLogged === 0) return null

  const color = BAND_COLOR[analysis.band]
  const hint = BAND_HINT[analysis.band]
  const bandLabel = isTR ? BAND_TR[analysis.band] : analysis.band
  const title = isTR
    ? `SABAH KAYDI · ${analysis.windowDays}G`
    : `MORNING LOG · ${analysis.windowDays}D`
  const ariaLabel = isTR ? 'Sabah kaydı tutarlılığı' : 'Morning log consistency'
  const pctText = `${Math.round(analysis.completionRate * 100)}%`
  const ofText = isTR
    ? `${analysis.daysLogged} / ${analysis.windowDays} gün`
    : `${analysis.daysLogged} / ${analysis.windowDays} days`
  const currentLabel = isTR ? 'MEVCUT' : 'CURRENT'
  const longestLabel = isTR ? 'EN UZUN' : 'LONGEST'
  const streakUnit = isTR ? 'gün' : 'd'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-morning-log-consistency-card
      data-consistency-band={analysis.band}
      data-completion-rate={analysis.completionRate.toFixed(4)}
      data-current-streak={String(analysis.currentStreak)}
      data-longest-streak={String(analysis.longestStreak)}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-consistency-band-label
          style={{
            fontSize: 10,
            letterSpacing: '0.05em',
            fontWeight: 700,
            padding: '3px 8px',
            background: `${color}22`,
            color,
            border: `1px solid ${color}`,
            borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Big percentage + days */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 10,
      }}>
        <div
          data-completion-pct
          style={{
            fontSize: 28,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {pctText}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          {ofText}
        </div>
      </div>

      {/* Streak chips */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 12,
        flexWrap: 'wrap',
      }}>
        <div
          data-current-streak-chip
          style={{
            fontSize: 10,
            padding: '4px 8px',
            background: `${color}18`,
            color: 'var(--text)',
            border: `1px solid ${color}55`,
            borderRadius: 3,
            letterSpacing: '0.03em',
          }}
        >
          <span style={{ color: 'var(--muted)' }}>{currentLabel}</span>
          {' '}
          <span style={{ color, fontWeight: 700 }}>{analysis.currentStreak}{streakUnit}</span>
        </div>
        <div
          data-longest-streak-chip
          style={{
            fontSize: 10,
            padding: '4px 8px',
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border, #333)',
            borderRadius: 3,
            letterSpacing: '0.03em',
          }}
        >
          <span style={{ color: 'var(--muted)' }}>{longestLabel}</span>
          {' '}
          <span style={{ fontWeight: 700 }}>{analysis.longestStreak}{streakUnit}</span>
        </div>
      </div>

      {/* 28-cell mini grid */}
      <div
        data-morning-log-grid
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${analysis.windowDays}, 1fr)`,
          gap: 2,
          marginBottom: 12,
        }}
      >
        {cells.map(c => (
          <div
            key={c.iso}
            data-day-cell
            data-day-iso={c.iso}
            data-day-logged={c.logged ? 'true' : 'false'}
            title={c.iso}
            style={{
              height: 10,
              borderRadius: 1,
              background: c.logged ? color : 'transparent',
              border: c.logged ? `1px solid ${color}` : '1px solid var(--border, #333)',
            }}
          />
        ))}
      </div>

      {/* Interpretation hint */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${color}10`,
        border: `1px solid ${color}40`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {isTR ? hint.tr : hint.en}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Wood 2013; Lally 2010
      </div>
    </div>
  )
}

export default memo(MorningLogConsistencyCard)
