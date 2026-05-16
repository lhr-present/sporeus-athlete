// ─── InjuryReturnCard.jsx — Return-to-sport ramp (v9.184.0, EP-10 UI surface) ─
//
// Surfaces `buildReturnToSportRamp` (shipped v9.169.0) which had a full
// 3 / 5 / 7-week ramp builder grounded in Soligard 2016 + Gabbett 2016 +
// Mujika 2000 + Ardern 2016 + Bertelsen 2017 — but zero production call
// sites until now.
//
// Behaviour:
//   - Always rendered. Starts collapsed showing a "Returning from injury?"
//     entry point. Athletes who are NOT injured ignore it.
//   - When expanded: inputs for daysOff / injuryType / bodyRegion, with
//     preInjuryCTL auto-derived from PMC (max CTL in last 90 days that
//     comfortably exceeded recent rolling average). Athlete can override.
//   - Output: week-by-week ramp table (volume %, intensity cap, quality
//     session cap, ACWR target, bilingual note), RTS criteria checklist,
//     red flags, citation footer.
//   - Persists form state + collapsed/expanded to localStorage so the
//     card retains the athlete's last input across sessions.

import { useContext, useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { buildReturnToSportRamp } from '../../lib/athlete/injuryReturnRamp.js'
import { calculatePMC } from '../../lib/trainingLoad.js'

const STORAGE_KEY = 'sporeus-injuryReturnRamp'
const MONO = "'IBM Plex Mono', monospace"

const INJURY_TYPE_LABEL = {
  'impact':      { en: 'Impact (stress fx, achilles…)', tr: 'Çarpma (stres kırığı, aşil…)' },
  'soft-tissue': { en: 'Soft tissue (muscle, tendon)',  tr: 'Yumuşak doku (kas, tendon)' },
  'overuse':     { en: 'Overuse (chronic load)',        tr: 'Aşırı kullanım (kronik yük)' },
  'illness':     { en: 'Illness (flu, COVID, virus)',   tr: 'Hastalık (grip, COVID, virüs)' },
  'other':       { en: 'Other',                          tr: 'Diğer' },
}

const BODY_REGION_LABEL = {
  '':            { en: '— optional —',  tr: '— isteğe bağlı —' },
  'lower-leg':   { en: 'Lower leg',     tr: 'Alt bacak' },
  'knee':        { en: 'Knee',          tr: 'Diz' },
  'hip':         { en: 'Hip',           tr: 'Kalça' },
  'lumbar':      { en: 'Lower back',    tr: 'Bel' },
  'upper-body':  { en: 'Upper body',    tr: 'Üst gövde' },
}

const SPORT_FROM_PROFILE = {
  Running: 'run', running: 'run', run: 'run',
  Cycling: 'bike', cycling: 'bike', bike: 'bike',
  Swimming: 'swim', swimming: 'swim', swim: 'swim',
  Triathlon: 'triathlon', triathlon: 'triathlon',
  Rowing: 'rowing', rowing: 'rowing',
}

function derivePreInjuryCTL(log) {
  try {
    const pmc = calculatePMC(log || [], 120, 0)
    if (!Array.isArray(pmc) || pmc.length === 0) return null
    const past = pmc.filter(p => !p.isFuture && Number.isFinite(p.ctl))
    if (past.length === 0) return null
    const max = past.reduce((m, p) => p.ctl > m ? p.ctl : m, 0)
    return max > 0 ? Math.round(max * 10) / 10 : null
  } catch { return null }
}

export default function InjuryReturnCard({ log = [], profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const sport = useMemo(() => {
    const raw = profile?.primarySport || profile?.sport
    return SPORT_FROM_PROFILE[raw] || 'run'
  }, [profile?.primarySport, profile?.sport])

  const derivedCTL = useMemo(() => derivePreInjuryCTL(log), [log])

  const [stored, setStored] = useLocalStorage(STORAGE_KEY, {
    expanded: false,
    daysOff: '',
    injuryType: '',
    bodyRegion: '',
    preInjuryCTL: '',
  })

  const expanded = !!stored?.expanded
  const update = (patch) => setStored({ ...(stored || {}), ...patch })

  const ctlForRamp = useMemo(() => {
    const overridden = Number(stored?.preInjuryCTL)
    if (Number.isFinite(overridden) && overridden > 0) return overridden
    return derivedCTL
  }, [stored?.preInjuryCTL, derivedCTL])

  const ramp = useMemo(() => {
    if (!expanded) return null
    const daysOff = Number(stored?.daysOff)
    if (!Number.isFinite(daysOff) || daysOff < 0) return null
    if (!stored?.injuryType) return null
    if (!Number.isFinite(ctlForRamp) || ctlForRamp <= 0) return null
    const r = buildReturnToSportRamp({
      sport,
      injuryType: stored.injuryType,
      bodyRegion: stored.bodyRegion || null,
      daysOff,
      preInjuryCTL: ctlForRamp,
    })
    return r && !r._rejected ? r : null
  }, [expanded, sport, stored?.daysOff, stored?.injuryType, stored?.bodyRegion, ctlForRamp])

  const title = isTR ? 'YARALANMA SONRASI DÖNÜŞ' : 'RETURNING FROM INJURY'
  const ariaLabel = isTR ? 'Yaralanmadan dönüş rampası' : 'Injury return ramp'
  const toggleLabel = isTR ? 'Yaralanmadan dönüyor musun?' : 'Returning from injury?'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-injury-return-card={expanded ? 'expanded' : 'collapsed'}
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
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => update({ expanded: !expanded })}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: '0.06em',
          padding: 0,
          textAlign: 'left',
          width: '100%',
        }}
      >
        <span style={{ color: '#ff6600', marginRight: 6 }}>🩹</span>
        <span style={{ fontWeight: 700 }}>{title}</span>
        <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8, fontSize: 10 }}>
          · {toggleLabel} {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor="injury-days-off" style={{ display: 'block', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 4 }}>
                {isTR ? 'GÜN KAYBI' : 'DAYS OFF'}
              </label>
              <input
                id="injury-days-off"
                type="number"
                min={0}
                max={365}
                value={stored?.daysOff ?? ''}
                onChange={e => update({ daysOff: e.target.value })}
                style={{
                  fontFamily: MONO, fontSize: 12, padding: '6px 8px',
                  background: 'var(--input-bg)', color: 'var(--text)',
                  border: '1px solid var(--input-border)', borderRadius: 3,
                  width: '100%', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label htmlFor="injury-type" style={{ display: 'block', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 4 }}>
                {isTR ? 'YARALANMA TİPİ' : 'INJURY TYPE'}
              </label>
              <select
                id="injury-type"
                value={stored?.injuryType || ''}
                onChange={e => update({ injuryType: e.target.value })}
                style={{
                  fontFamily: MONO, fontSize: 12, padding: '6px 8px',
                  background: 'var(--input-bg)', color: 'var(--text)',
                  border: '1px solid var(--input-border)', borderRadius: 3,
                  width: '100%', boxSizing: 'border-box',
                }}
              >
                <option value="">{isTR ? '— seç —' : '— select —'}</option>
                {Object.entries(INJURY_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{isTR ? v.tr : v.en}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label htmlFor="injury-body-region" style={{ display: 'block', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 4 }}>
                {isTR ? 'BÖLGE' : 'BODY REGION'}
              </label>
              <select
                id="injury-body-region"
                value={stored?.bodyRegion || ''}
                onChange={e => update({ bodyRegion: e.target.value })}
                style={{
                  fontFamily: MONO, fontSize: 12, padding: '6px 8px',
                  background: 'var(--input-bg)', color: 'var(--text)',
                  border: '1px solid var(--input-border)', borderRadius: 3,
                  width: '100%', boxSizing: 'border-box',
                }}
              >
                {Object.entries(BODY_REGION_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{isTR ? v.tr : v.en}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor="injury-pre-ctl" style={{ display: 'block', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 4 }}>
                {isTR ? 'YARALANMA-ÖNCESİ CTL' : 'PRE-INJURY CTL'}
              </label>
              <input
                id="injury-pre-ctl"
                type="number"
                min={0}
                step="0.1"
                placeholder={derivedCTL != null ? String(derivedCTL) : ''}
                value={stored?.preInjuryCTL ?? ''}
                onChange={e => update({ preInjuryCTL: e.target.value })}
                style={{
                  fontFamily: MONO, fontSize: 12, padding: '6px 8px',
                  background: 'var(--input-bg)', color: 'var(--text)',
                  border: '1px solid var(--input-border)', borderRadius: 3,
                  width: '100%', boxSizing: 'border-box',
                }}
              />
              {derivedCTL != null && !stored?.preInjuryCTL ? (
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                  {isTR ? `Log'dan: ${derivedCTL}` : `From log: ${derivedCTL}`}
                </div>
              ) : null}
            </div>
          </div>

          {ramp ? (
            <div data-injury-ramp-output>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                {isTR
                  ? `${ramp.totalRampWeeks} haftalık dönüş protokolü · sport: ${ramp.sport}`
                  : `${ramp.totalRampWeeks}-week return protocol · sport: ${ramp.sport}`}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left',  padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? 'HAFTA' : 'WEEK'}</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? 'HACİM' : 'VOLUME'}</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--muted)' }}>TSS</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? 'TAVAN' : 'CAP'}</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', color: 'var(--muted)' }}>ACWR</th>
                    <th style={{ textAlign: 'left',  padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? 'NOT' : 'NOTE'}</th>
                  </tr>
                </thead>
                <tbody>
                  {ramp.weeks.map(w => (
                    <tr key={w.week} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '4px 6px', color: w.phase === 'preamble' ? '#ff6600' : 'var(--text)' }}>
                        W{w.week}{w.phase === 'preamble' ? ' ⓟ' : ''}
                      </td>
                      <td style={{ textAlign: 'right', padding: '4px 6px' }}>{w.volumePct}%</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px' }}>{w.weeklyTSS}</td>
                      <td style={{ textAlign: 'center', padding: '4px 6px' }}>{w.intensityCap}</td>
                      <td style={{ textAlign: 'center', padding: '4px 6px' }}>{w.acwrTarget.toFixed(2)}</td>
                      <td style={{ padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? w.note.tr : w.note.en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 4 }}>
                  {isTR ? 'DÖNÜŞ KRİTERLERİ (HEPSİ ✓ OLMALI)' : 'RETURN-TO-SPORT CRITERIA (ALL MUST ✓)'}
                </div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {ramp.criteria.map((c, i) => (
                    <li key={i} style={{ fontSize: 10, lineHeight: 1.55, color: 'var(--text)' }}>
                      {isTR ? c.tr : c.en}
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ padding: 8, background: '#e0303014', border: '1px solid #e0303055', borderRadius: 3, marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#e03030', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>
                  {isTR ? 'KIRMIZI BAYRAKLAR' : 'RED FLAGS'}
                </div>
                {ramp.redFlags.map((f, i) => (
                  <div key={i} style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--text)', marginBottom: 2 }}>
                    • {isTR ? f.tr : f.en}
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
                {ramp.citation}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              {isTR
                ? 'Gün kaybı + yaralanma tipini doldur. Yaralanma-öncesi CTL log\'undan otomatik türetilir.'
                : 'Fill in days off + injury type. Pre-injury CTL is auto-derived from your log.'}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
