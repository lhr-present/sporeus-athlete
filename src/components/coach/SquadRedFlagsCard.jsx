// ─── SquadRedFlagsCard.jsx — coach triage card (v9.48.0) ────────────────────
// Pure derived view from get_squad_overview() RPC output. Surfaces athletes
// who need attention TODAY based on three signals already in the squad data:
//   1. INJURY-RISK   — acwr_ratio > 1.5  (Gabbett 2016 sweet-spot ceiling)
//   2. DEEPLY-FATIGUED — today_tsb < -20 (Coggan 2003 form floor)
//   3. SILENT        — last_session_date >= 5 days ago (no logging)
//
// Rendered above the squad table so coaches see triage at a glance instead
// of scanning row-by-row. Bilingual EN/TR.
//
// Citations: Gabbett 2016 (Br J Sports Med); Coggan & Allen 2010; Hulin 2014

import { useContext, useMemo, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'

const MONO = "'IBM Plex Mono', monospace"

function daysSince(dateStr) {
  if (!dateStr) return Infinity
  const d = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(d.getTime())) return Infinity
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function deriveFlags(ath, isTR) {
  const out = []
  // 1. Injury-risk: ACWR > 1.5
  const acwr = Number(ath.acwr_ratio)
  if (Number.isFinite(acwr) && acwr > 1.5) {
    out.push({
      kind: 'injury-risk',
      severity: 'high',
      label: isTR ? 'YARALANMA RİSKİ' : 'INJURY-RISK',
      detail: isTR
        ? `ACWR ${acwr.toFixed(2)} (>1.5 — Gabbett zinde-bölge tavanı aşıldı)`
        : `ACWR ${acwr.toFixed(2)} (>1.5 — Gabbett sweet-spot ceiling exceeded)`,
    })
  }
  // 2. Deeply fatigued: TSB < -20
  const tsb = Number(ath.today_tsb)
  if (Number.isFinite(tsb) && tsb < -20) {
    out.push({
      kind: 'fatigued',
      severity: 'high',
      label: isTR ? 'AŞIRI YORGUN' : 'DEEPLY-FATIGUED',
      detail: isTR
        ? `TSB ${tsb} (form bodrumu — toparlama gerekli)`
        : `TSB ${tsb} (form floor — recovery needed)`,
    })
  }
  // 3. Silent: no log entry in 5+ days
  const dsl = daysSince(ath.last_session_date)
  if (dsl >= 5 && dsl !== Infinity) {
    out.push({
      kind: 'silent',
      severity: 'moderate',
      label: isTR ? 'SESSİZ' : 'SILENT',
      detail: isTR
        ? `${dsl} gündür log yok — ulaş`
        : `${dsl} days no log — reach out`,
    })
  } else if (dsl === Infinity) {
    out.push({
      kind: 'never-logged',
      severity: 'moderate',
      label: isTR ? 'KAYIT YOK' : 'NEVER-LOGGED',
      detail: isTR ? 'Hiç antrenman kaydı yok' : 'No training logged yet',
    })
  }
  return out
}

const SEVERITY_PALETTE = {
  high:     { bg: 'rgba(220,53,69,0.15)',  bd: '#dc3545' },
  moderate: { bg: 'rgba(255,102,0,0.12)',  bd: '#ff6600' },
}

export default function SquadRedFlagsCard({ athletes, onSelectAthlete }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [collapsed, setCollapsed] = useState(false)

  const flagged = useMemo(() => {
    if (!Array.isArray(athletes)) return []
    return athletes
      .map(ath => ({ ath, flags: deriveFlags(ath, isTR) }))
      .filter(({ flags }) => flags.length > 0)
      // High-severity first, then by name
      .sort((a, b) => {
        const aHi = a.flags.some(f => f.severity === 'high') ? 0 : 1
        const bHi = b.flags.some(f => f.severity === 'high') ? 0 : 1
        if (aHi !== bHi) return aHi - bHi
        return (a.ath.athlete_name || '').localeCompare(b.ath.athlete_name || '')
      })
  }, [athletes, isTR])

  if (!Array.isArray(athletes) || athletes.length === 0) return null

  return (
    <div
      data-squad-red-flags
      role="region"
      aria-label={isTR ? 'Bugünün dikkat gerektirenleri' : "Today's red flags"}
      style={{
        marginBottom: 12,
        padding: '8px 10px',
        background: flagged.length > 0 ? 'rgba(220,53,69,0.08)' : 'rgba(40,167,69,0.06)',
        border: `1px solid ${flagged.length > 0 ? '#dc3545' : '#28a745'}33`,
        borderRadius: 4,
        fontFamily: MONO,
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, color: 'var(--text)', fontFamily: MONO,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', textAlign: 'left',
        }}
      >
        <span>
          {flagged.length > 0 ? '🚩' : '✓'}{' '}
          {isTR ? "BUGÜNÜN UYARI BAYRAKLARI" : "TODAY'S RED FLAGS"}
          {flagged.length > 0 ? (
            <span style={{ color: '#dc3545', marginLeft: 6 }}>· {flagged.length}</span>
          ) : (
            <span style={{ color: '#28a745', marginLeft: 6 }}>
              · {isTR ? 'tümü iyi' : 'all clear'}
            </span>
          )}
        </span>
        <span style={{ fontSize: 9, color: 'var(--muted)' }}>{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && flagged.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
          {isTR
            ? 'Squad sağlıklı: ACWR güvenli, TSB yeterli, herkes son 5 günde log girdi.'
            : 'Squad healthy: ACWR safe, TSB adequate, everyone logged in last 5 days.'}
        </div>
      ) : null}

      {!collapsed && flagged.length > 0 ? (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {flagged.map(({ ath, flags }) => {
            const pal = flags.some(f => f.severity === 'high')
              ? SEVERITY_PALETTE.high
              : SEVERITY_PALETTE.moderate
            return (
              <button
                key={ath.athlete_id}
                type="button"
                onClick={() => onSelectAthlete?.(ath.athlete_id)}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  background: pal.bg,
                  borderLeft: `2px solid ${pal.bd}`,
                  border: 'none',
                  borderRadius: 3,
                  cursor: onSelectAthlete ? 'pointer' : 'default',
                  fontFamily: MONO,
                  color: 'var(--text)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                  {ath.athlete_name || (isTR ? 'İsimsiz sporcu' : 'Unnamed athlete')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {flags.map((f, i) => (
                    <span
                      key={i}
                      title={f.detail}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        padding: '1px 6px',
                        background: f.severity === 'high' ? '#dc3545' : '#ff6600',
                        color: '#fff',
                        borderRadius: 2,
                      }}
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
                {flags[0]?.detail ? (
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                    {flags.map(f => f.detail).join(' · ')}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

// Exported for unit tests
export { deriveFlags, daysSince }
