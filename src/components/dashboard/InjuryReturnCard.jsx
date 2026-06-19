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

import { memo, useContext, useEffect, useMemo  } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { buildReturnToSportRamp } from '../../lib/athlete/injuryReturnRamp.js'
import { detectComebackGap } from '../../lib/athlete/comebackDetector.js'
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

function InjuryReturnCard({ log = [], profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const sport = useMemo(() => {
    const raw = profile?.primarySport || profile?.sport
    return SPORT_FROM_PROFILE[raw] || 'run'
  }, [profile?.primarySport, profile?.sport])

  // v9.189.0 — comebackDetector integration. When ≥14 days of silence
  // on the log AND the athlete had real prior CTL (≥10), the detector
  // returns priorCTL read at the LAST training date — a more honest
  // baseline than `derivePreInjuryCTL`'s 120-day max (which can be
  // months stale after a long layoff). Prefer comeback.priorCTL when
  // it fires.
  const comeback = useMemo(() => detectComebackGap(log), [log])

  const derivedCTL = useMemo(() => {
    if (comeback?.isComeback && comeback.priorCTL > 0) return comeback.priorCTL
    return derivePreInjuryCTL(log)
  }, [log, comeback])

  const [stored, setStored] = useLocalStorage(STORAGE_KEY, {
    expanded: false,
    daysOff: '',
    injuryType: '',
    bodyRegion: '',
    preInjuryCTL: '',
    dismissedComeback: false,
    rampStartDate: '',
    rtsCriteriaMet: [],
  })

  const expanded = !!stored?.expanded
  const update = (patch) => setStored({ ...(stored || {}), ...patch })

  // Show the comeback banner when: detector fires, athlete hasn't already
  // dismissed it, and they haven't started filling the form themselves
  // (so we don't overwrite their judgement). Once they accept the
  // suggestion or dismiss, the banner stays out.
  const formStarted = !!(stored?.daysOff || stored?.injuryType || stored?.preInjuryCTL)
  const showComebackBanner = !!comeback?.isComeback && !stored?.dismissedComeback && !formStarted

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

  // v9.198.0 — Calendar-anchor the ramp. Stamp `rampStartDate` the first
  // moment the ramp builds successfully (athlete has filled enough form
  // fields to produce a valid output). The stamp persists in localStorage
  // so the "TODAY → Wn" pointer stays consistent across reloads even as
  // the calendar advances. Athletes can re-anchor by clicking the
  // re-anchor button below.
  useEffect(() => {
    if (!ramp) return
    if (stored?.rampStartDate) return
    const todayISO = new Date().toISOString().slice(0, 10)
    setStored({ ...(stored || {}), rampStartDate: todayISO })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ramp, stored?.rampStartDate])

  // Compute the current ramp week from the stamp. clamp so very stale
  // stamps don't underflow into negatives or overflow past totalWeeks.
  const currentWeekIdx = useMemo(() => {
    if (!ramp || !stored?.rampStartDate) return null
    const start = new Date(stored.rampStartDate + 'T12:00:00Z')
    const today = new Date()
    if (Number.isNaN(start.getTime())) return null
    const days = Math.floor((today.getTime() - start.getTime()) / 86400000)
    const wk = Math.floor(days / 7) + 1
    return Math.max(1, Math.min(ramp.totalRampWeeks, wk))
  }, [ramp, stored?.rampStartDate])

  const reAnchorRamp = () => {
    const todayISO = new Date().toISOString().slice(0, 10)
    setStored({ ...(stored || {}), rampStartDate: todayISO })
  }

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
      {showComebackBanner ? (
        <div
          data-comeback-banner
          role="status"
          style={{
            marginBottom: 12, padding: '8px 10px',
            background: '#ff660014', border: '1px solid #ff660055',
            borderRadius: 4, fontSize: 10, lineHeight: 1.5,
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ color: '#ff6600', fontWeight: 700 }}>
            ⚠ {isTR
              ? `${comeback.gapDays} gündür antrenman yok`
              : `${comeback.gapDays} days since last training`}
          </span>
          <span style={{ color: 'var(--muted)' }}>
            · {isTR ? `Önceki CTL ${comeback.priorCTL}` : `Prior CTL ${comeback.priorCTL}`}
          </span>
          <button
            type="button"
            onClick={() => update({
              expanded: true,
              daysOff: String(comeback.gapDays),
              preInjuryCTL: String(comeback.priorCTL),
              dismissedComeback: true,
            })}
            style={{
              fontFamily: MONO, fontSize: 10, padding: '4px 10px',
              background: '#ff6600', color: '#000',
              border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700,
            }}
          >
            {isTR ? 'ÖNERİYİ KULLAN' : 'USE SUGGESTION'}
          </button>
          <button
            type="button"
            onClick={() => update({ dismissedComeback: true })}
            style={{
              fontFamily: MONO, fontSize: 10, padding: '4px 8px',
              background: 'transparent', color: 'var(--muted)',
              border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
            }}
          >
            {isTR ? 'GİZLE' : 'DISMISS'}
          </button>
        </div>
      ) : null}
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
              {/* v9.198.0 — TODAY pointer + current-week target callout */}
              {currentWeekIdx ? (() => {
                const currentWeek = ramp.weeks.find(w => w.week === currentWeekIdx)
                if (!currentWeek) return null
                return (
                  <div
                    data-injury-ramp-today
                    data-current-week={currentWeekIdx}
                    style={{
                      marginBottom: 10, padding: 8,
                      background: '#5bc25b14', border: '1px solid #5bc25b55',
                      borderRadius: 3,
                    }}
                  >
                    <div style={{ fontSize: 9, letterSpacing: '0.08em', fontWeight: 700, color: '#5bc25b', marginBottom: 4 }}>
                      ● {isTR ? `BUGÜN → H${currentWeekIdx}` : `TODAY → W${currentWeekIdx}`} ·
                      {' '}{currentWeek.volumePct}% · {currentWeek.intensityCap}
                      {currentWeek.maxQualitySessions > 0
                        ? (isTR ? ` · ${currentWeek.maxQualitySessions} kalite` : ` · ${currentWeek.maxQualitySessions} quality`)
                        : (isTR ? ' · kalite yok' : ' · no quality')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.5, marginBottom: 4 }}>
                      {isTR ? currentWeek.note.tr : currentWeek.note.en}
                    </div>
                    <button
                      type="button"
                      data-injury-ramp-reanchor
                      onClick={reAnchorRamp}
                      style={{
                        fontFamily: MONO, fontSize: 9, padding: '3px 8px',
                        background: 'transparent', color: 'var(--muted)',
                        border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
                      }}
                    >
                      ↻ {isTR ? 'YENİDEN BAŞLAT' : 'RE-ANCHOR'}
                    </button>
                  </div>
                )
              })() : null}
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
                  {ramp.weeks.map(w => {
                    const isCurrent = w.week === currentWeekIdx
                    return (
                      <tr
                        key={w.week}
                        data-week-row={w.week}
                        data-week-current={isCurrent ? 'true' : 'false'}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: isCurrent ? '#5bc25b14' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '4px 6px', color: w.phase === 'preamble' ? '#ff6600' : 'var(--text)', fontWeight: isCurrent ? 700 : 400 }}>
                          {isCurrent ? '● ' : ''}W{w.week}{w.phase === 'preamble' ? ' ⓟ' : ''}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 6px' }}>{w.volumePct}%</td>
                        <td style={{ textAlign: 'right', padding: '4px 6px' }}>{w.weeklyTSS}</td>
                        <td style={{ textAlign: 'center', padding: '4px 6px' }}>{w.intensityCap}</td>
                        <td style={{ textAlign: 'center', padding: '4px 6px' }}>{w.acwrTarget.toFixed(2)}</td>
                        <td style={{ padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? w.note.tr : w.note.en}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* v9.200.0 — Interactive RTS criteria checklist. Each
                  Ardern 2016 criterion becomes a checkbox; state persists
                  across sessions. When all 5 are checked, a "READY TO
                  RETURN" badge appears (athletes get a tangible progress
                  marker through the ramp). */}
              {(() => {
                const criteriaMet = Array.isArray(stored?.rtsCriteriaMet) ? stored.rtsCriteriaMet : []
                const metCount = criteriaMet.filter(Boolean).length
                const allMet = metCount === ramp.criteria.length
                const toggleCriterion = (idx) => {
                  const next = ramp.criteria.map((_, i) =>
                    i === idx ? !criteriaMet[i] : !!criteriaMet[i])
                  update({ rtsCriteriaMet: next })
                }
                return (
                  <div style={{ marginBottom: 10 }} data-rts-criteria-block>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 6, flexWrap: 'wrap',
                    }}>
                      <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em' }}>
                        {isTR ? 'DÖNÜŞ KRİTERLERİ' : 'RETURN-TO-SPORT CRITERIA'}
                        {' '}({metCount}/{ramp.criteria.length})
                      </div>
                      {allMet ? (
                        <span
                          data-rts-ready-badge
                          style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                            padding: '2px 8px', background: '#5bc25b',
                            color: '#000', borderRadius: 3,
                          }}
                        >
                          ✓ {isTR ? 'DÖNÜŞE HAZIR' : 'READY TO RETURN'}
                        </span>
                      ) : null}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                      {ramp.criteria.map((c, i) => {
                        const checked = !!criteriaMet[i]
                        return (
                          <li key={i} style={{ fontSize: 10, lineHeight: 1.55, marginBottom: 3 }}>
                            <label style={{
                              display: 'flex', alignItems: 'flex-start', gap: 6,
                              cursor: 'pointer',
                              color: checked ? '#5bc25b' : 'var(--text)',
                            }}>
                              <input
                                type="checkbox"
                                data-rts-criterion={i}
                                checked={checked}
                                onChange={() => toggleCriterion(i)}
                                style={{
                                  marginTop: 2, accentColor: '#5bc25b',
                                  cursor: 'pointer',
                                }}
                              />
                              <span style={{ textDecoration: checked ? 'line-through' : 'none' }}>
                                {isTR ? c.tr : c.en}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })()}

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

export default memo(InjuryReturnCard)
