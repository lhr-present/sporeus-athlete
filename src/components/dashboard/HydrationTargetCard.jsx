// ─── HydrationTargetCard.jsx — Daily + per-session hydration targets ───────
//
// Surfaces `computeHydrationTarget` (Sawka 2007 ACSM Position Stand;
// Casa 2000 NATA) on the dashboard. Always renders the daily target
// when the athlete has a weight on file. When today carries a planned
// session ≥60 min, additionally surfaces:
//   - 500 mL pre-session (2-3 h before)
//   - per-hour fluid (climate-adjusted, capped at 1 L/hr)
//   - per-hour sodium (climate-adjusted)
//   - post-session 1.5 L per kg lost rule of thumb
//
// Distinct from `FuelingCard` (CHO/protein/fat periodisation) and
// `CaffeineDoseCard` (ergogenic dose) — both can render alongside.
//
// Bilingual EN/TR, inline styles, MONO font, citation footer.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { getTodayPlannedSession } from '../../lib/intelligence.js'
import { computeHydrationTarget } from '../../lib/athlete/hydrationTarget.js'

const MONO = "'IBM Plex Mono', monospace"
const ACCENT = '#0064ff'  // blue — informational, matches Caffeine + Fueling

export default function HydrationTargetCard({ profile = {}, plan = null }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = new Date().toISOString().slice(0, 10)
  const plannedSession = useMemo(
    () => getTodayPlannedSession(plan, today),
    [plan, today],
  )

  const target = useMemo(
    () => computeHydrationTarget({ profile, plannedSession, today }),
    [profile, plannedSession, today],
  )

  if (!target) return null

  // Only surface per-session values when a real session of ≥60 min is planned.
  const sessionDuration = Number(plannedSession?.duration) || 0
  const showPerSession = sessionDuration >= 60

  const title          = isTR ? 'HİDRASYON HEDEFİ'                   : 'HYDRATION TARGET'
  const aria           = isTR ? 'Günlük ve seans hidrasyon hedefi'    : 'Daily and per-session hydration target'
  const dailyLbl       = isTR ? 'Günlük'                              : 'Daily'
  const preLbl         = isTR ? 'Antrenman Öncesi'                    : 'Pre-session'
  const perHourLbl     = isTR ? 'Saatte'                              : 'Per Hour'
  const sodiumLbl      = isTR ? 'Sodyum'                              : 'Sodium'
  const postLbl        = isTR ? 'Antrenman Sonrası'                   : 'Post-session'
  const preTimingTxt   = isTR ? '2-3 sa önce'                         : '2-3 h before'
  const postRuleTxt    = isTR
    ? 'kaybedilen her kg için (terleme açığı)'
    : 'per kg of bodyweight lost'

  return (
    <div
      role="region"
      aria-label={aria}
      data-hydration-target-card
      data-daily-ml={target.dailyMl}
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
      <div style={{
        fontSize: 12,
        letterSpacing: '0.06em',
        fontWeight: 700,
        marginBottom: 10,
        color: 'var(--text)',
      }}>
        <span style={{ color: ACCENT, marginRight: 6 }}>◢</span>
        {title}
      </div>

      {/* Daily target — always shown */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          {dailyLbl}
        </span>
        <span style={{
          fontSize: 28,
          fontWeight: 700,
          color: ACCENT,
          lineHeight: 1,
        }}>
          {target.dailyMl} mL
        </span>
      </div>

      {/* Per-session block — only when planned session ≥60 min */}
      {showPerSession ? (
        <div data-hydration-per-session style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text)',
            marginBottom: 4,
          }}>
            <span style={{ color: 'var(--muted)' }}>{preLbl}:</span>
            {' '}
            <strong>{target.preSessionMl} mL</strong>
            <span style={{ color: 'var(--muted)' }}> · {preTimingTxt}</span>
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--text)',
            marginBottom: 4,
          }}>
            <span style={{ color: 'var(--muted)' }}>{perHourLbl}:</span>
            {' '}
            <strong>{target.perHourFluidMl} mL</strong>
            <span style={{ color: 'var(--muted)' }}> · {sodiumLbl} </span>
            <strong>{target.perHourSodiumMg} mg</strong>
          </div>
        </div>
      ) : null}

      <div style={{
        fontSize: 10,
        color: 'var(--muted)',
        lineHeight: 1.5,
        marginBottom: 8,
      }}>
        ↳ {postLbl}: <strong style={{ color: 'var(--text)' }}>
          {target.postSessionMlPerKgLost} mL
        </strong> {postRuleTxt}
      </div>

      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        {target.citation}
      </div>
    </div>
  )
}
