// ─── MultiPeakSeasonCard.jsx — Multi-race season planner (v9.185.0, EP-4 UI) ─
//
// Surfaces `buildMultiPeakSeason` (shipped v9.170.0) which had a full
// A/B/C-race periodization builder grounded in Issurin 2010 + Bompa
// 2009 + Mujika 2010 + Pyne 2009 — but zero production call sites
// until now.
//
// `EliteProgramCard` handles a SINGLE race. This card handles the
// season: an A-race (full taper + recovery), B-races (mini-taper,
// shorter recovery), and C-races (race as a training day, no taper).
// The output is a week-by-week phase skeleton (Base / Build / Peak /
// Taper / Race / Recovery / Maintenance) for the whole calendar of
// races.
//
// Behaviour:
//   - Starts collapsed showing a "Plan a multi-race season?" entry
//     point. Athletes with one race don't need this card.
//   - When expanded: add races (date + optional label + A/B/C
//     priority). Season builds live as races are added.
//   - Output: count of peaks, ordered race list with phase-week
//     index, warnings (Bompa cap, leg-too-short), citation.
//   - Persisted to `sporeus-multiPeakSeason` localStorage.

import { memo, useContext, useEffect, useMemo  } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { buildMultiPeakSeason } from '../../lib/athlete/multiPeakSeason.js'
import { getProfileRaceDate } from '../../lib/validate.js'

const STORAGE_KEY = 'sporeus-multiPeakSeason'
const MONO = "'IBM Plex Mono', monospace"

const SPORT_FROM_PROFILE = {
  Running: 'run', running: 'run', run: 'run',
  Cycling: 'bike', cycling: 'bike', bike: 'bike',
  Swimming: 'swim', swimming: 'swim', swim: 'swim',
  Triathlon: 'triathlon', triathlon: 'triathlon',
  Rowing: 'rowing', rowing: 'rowing',
}

const PRIORITY_COLOR = { A: '#e03030', B: '#f5c542', C: '#5bc25b' }
const PHASE_COLOR = {
  Base:         '#666666',
  Build:        '#0064ff',
  Peak:         '#ff6600',
  Taper:        '#f5c542',
  Race:         '#e03030',
  Recovery:     '#5bc25b',
  Maintenance:  '#888888',
}
const PHASE_LABEL_TR = {
  Base:         'Temel',
  Build:        'Yapılanma',
  Peak:         'Tepe',
  Taper:        'Dinçlenme',
  Race:         'Yarış',
  Recovery:     'Toparlanma',
  Maintenance:  'Koruma',
}

function MultiPeakSeasonCard({ profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const sport = useMemo(() => {
    const raw = profile?.primarySport || profile?.sport
    return SPORT_FROM_PROFILE[raw] || 'run'
  }, [profile?.primarySport, profile?.sport])

  const [stored, setStored] = useLocalStorage(STORAGE_KEY, {
    expanded: false,
    races: [],
    seededFromProfile: false,
  })
  const expanded = !!stored?.expanded
  const races = useMemo(() => (
    Array.isArray(stored?.races) ? stored.races : []
  ), [stored?.races])
  const update = (patch) => setStored({ ...(stored || {}), ...patch })

  // v9.195.0 — One-time auto-seed from profile.raceDate / nextRaceDate.
  // When the card is first expanded AND races is empty AND the athlete
  // has a profile race date AND we haven't seeded yet → drop in one
  // A-priority race row so the season builds immediately. The
  // `seededFromProfile` flag in localStorage prevents re-seeding if the
  // athlete later removes all races on purpose. They can still edit /
  // remove the seeded row freely.
  const profileRaceDate = getProfileRaceDate(profile)
  useEffect(() => {
    if (!expanded) return
    if (stored?.seededFromProfile) return
    if (races.length > 0) return
    if (!profileRaceDate) return
    setStored({
      ...(stored || {}),
      races: [{ date: profileRaceDate, label: '', priority: 'A' }],
      seededFromProfile: true,
    })
  // We intentionally do not depend on `setStored` (stable identity from
  // useLocalStorage) — including stored.races would cause the effect to
  // re-fire after seeding and possibly stomp athlete edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, profileRaceDate, races.length, stored?.seededFromProfile])

  const season = useMemo(() => {
    if (!expanded) return null
    const valid = races.filter(r => r?.date && r?.priority)
    if (valid.length === 0) return null
    const r = buildMultiPeakSeason({ sport, races: valid })
    return r && !r._rejected ? r : null
  }, [expanded, sport, races])

  const addRace = () => {
    update({ races: [...races, { date: '', label: '', priority: 'B' }] })
  }
  const updateRace = (idx, patch) => {
    update({ races: races.map((r, i) => i === idx ? { ...r, ...patch } : r) })
  }
  const removeRace = (idx) => {
    update({ races: races.filter((_, i) => i !== idx) })
  }

  const title = isTR ? 'ÇOKLU YARIŞ SEZONU' : 'MULTI-RACE SEASON'
  const ariaLabel = isTR ? 'Çoklu yarış sezon planlayıcısı' : 'Multi-race season planner'
  const toggleLabel = isTR ? 'Çoklu yarış sezonu planla?' : 'Plan a multi-race season?'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-multi-peak-card={expanded ? 'expanded' : 'collapsed'}
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
          background: 'transparent', border: 'none', color: 'var(--text)',
          cursor: 'pointer', fontFamily: MONO, fontSize: 12,
          letterSpacing: '0.06em', padding: 0, textAlign: 'left', width: '100%',
        }}
      >
        <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
        <span style={{ fontWeight: 700 }}>{title}</span>
        <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8, fontSize: 10 }}>
          · {toggleLabel} {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 12 }}>
            {races.length === 0 ? (
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                {isTR
                  ? 'Sezona en az bir yarış ekle. A = ana hedef (tam taper), B = ikincil (mini-taper), C = antrenman yarışı (taper yok).'
                  : 'Add at least one race. A = main goal (full taper), B = secondary (mini-taper), C = race-as-training (no taper).'}
              </div>
            ) : null}
            {races.map((r, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: 6, alignItems: 'center',
                marginBottom: 6, flexWrap: 'wrap',
              }}>
                <input
                  type="date"
                  aria-label={isTR ? `Yarış ${idx + 1} tarihi` : `Race ${idx + 1} date`}
                  value={r?.date || ''}
                  onChange={e => updateRace(idx, { date: e.target.value })}
                  style={{
                    fontFamily: MONO, fontSize: 11, padding: '4px 6px',
                    background: 'var(--input-bg)', color: 'var(--text)',
                    border: '1px solid var(--input-border)', borderRadius: 3,
                  }}
                />
                <input
                  type="text"
                  aria-label={isTR ? `Yarış ${idx + 1} etiketi` : `Race ${idx + 1} label`}
                  placeholder={isTR ? 'etiket (örn. Istanbul Half)' : 'label (e.g. Istanbul Half)'}
                  value={r?.label || ''}
                  onChange={e => updateRace(idx, { label: e.target.value })}
                  maxLength={40}
                  style={{
                    flex: '1 1 140px',
                    fontFamily: MONO, fontSize: 11, padding: '4px 6px',
                    background: 'var(--input-bg)', color: 'var(--text)',
                    border: '1px solid var(--input-border)', borderRadius: 3,
                  }}
                />
                <div role="group" aria-label={isTR ? 'Öncelik' : 'Priority'} style={{ display: 'flex', gap: 2 }}>
                  {['A', 'B', 'C'].map(p => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={r?.priority === p}
                      onClick={() => updateRace(idx, { priority: p })}
                      style={{
                        fontFamily: MONO, fontSize: 11, padding: '4px 8px',
                        background: r?.priority === p ? PRIORITY_COLOR[p] : 'transparent',
                        color: r?.priority === p ? '#000' : PRIORITY_COLOR[p],
                        border: `1px solid ${PRIORITY_COLOR[p]}`, borderRadius: 3,
                        cursor: 'pointer', fontWeight: 700,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label={isTR ? `Yarış ${idx + 1} kaldır` : `Remove race ${idx + 1}`}
                  onClick={() => removeRace(idx)}
                  style={{
                    fontFamily: MONO, fontSize: 11, padding: '4px 8px',
                    background: 'transparent', color: 'var(--muted)',
                    border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRace}
              style={{
                fontFamily: MONO, fontSize: 10, padding: '6px 10px',
                background: 'transparent', color: '#0064ff',
                border: '1px dashed #0064ff', borderRadius: 3, cursor: 'pointer',
                marginTop: 4,
              }}
            >
              + {isTR ? 'YARIŞ EKLE' : 'ADD RACE'}
            </button>
          </div>

          {season ? (
            <div data-multi-peak-output>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                {isTR
                  ? `${season.totalWeeks} hafta · ${season.peakCount} tepe · sport: ${season.sport}`
                  : `${season.totalWeeks} weeks · ${season.peakCount} peaks · sport: ${season.sport}`}
              </div>

              {/* Phase bar — one cell per week */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, marginBottom: 10 }}>
                {season.weeks.map(w => {
                  const c = PHASE_COLOR[w.phase] || '#888'
                  return (
                    <div
                      key={w.weekIdx}
                      title={`W${w.weekIdx} · ${w.phase} · ${w.startISO}`}
                      data-week-phase={w.phase}
                      style={{
                        flex: '1 1 24px', minWidth: 22, height: 22,
                        background: `${c}55`, border: `1px solid ${c}`,
                        borderRadius: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, color: 'var(--text)',
                      }}
                    >
                      {w.phase[0]}
                    </div>
                  )
                })}
              </div>

              {/* Race list */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 8 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left',  padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? 'YARIŞ' : 'RACE'}</th>
                    <th style={{ textAlign: 'left',  padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? 'TARİH' : 'DATE'}</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? 'ÖNC' : 'PRI'}</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--muted)' }}>{isTR ? 'HAFTA' : 'WEEK'}</th>
                  </tr>
                </thead>
                <tbody>
                  {season.races.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '4px 6px', color: 'var(--text)' }}>{r.label || '—'}</td>
                      <td style={{ padding: '4px 6px', color: 'var(--muted)' }}>{r.date}</td>
                      <td style={{ textAlign: 'center', padding: '4px 6px', color: PRIORITY_COLOR[r.priority], fontWeight: 700 }}>
                        {r.priority}
                      </td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--muted)' }}>
                        W{r.weekIdx ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Phase-color legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {['Base', 'Build', 'Peak', 'Taper', 'Race', 'Recovery', 'Maintenance'].map(ph => {
                  const c = PHASE_COLOR[ph]
                  return (
                    <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--muted)' }}>
                      <div style={{ width: 10, height: 10, background: `${c}55`, border: `1px solid ${c}`, borderRadius: 2 }} />
                      {isTR ? PHASE_LABEL_TR[ph] : ph}
                    </div>
                  )
                })}
              </div>

              {/* Warnings */}
              {season.warnings.length > 0 ? (
                <div style={{ padding: 8, background: '#f5c54214', border: '1px solid #f5c54255', borderRadius: 3, marginBottom: 8 }}>
                  {season.warnings.map(w => (
                    <div key={w.code} style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.5, marginBottom: 4 }}>
                      <div>⚠ {isTR ? w.tr : w.en}</div>
                      {/* v9.202.0 — One-tap Bompa fix: demote earlier A-races
                          to B so only the latest A (chronologically) remains.
                          Athletes typically race a season toward a single
                          "main" event with prep races earlier; this collapses
                          the multi-A warning to a single-A season aligned
                          with the typical periodization pattern. */}
                      {w.code === 'leg-too-short' && w.raceDate ? (
                        <button
                          type="button"
                          data-leg-too-short-remove
                          data-race-date={w.raceDate}
                          onClick={() => {
                            update({ races: races.filter(r => r.date !== w.raceDate) })
                          }}
                          style={{
                            fontFamily: MONO, fontSize: 10, padding: '4px 10px',
                            background: '#f5c542', color: '#000',
                            border: 'none', borderRadius: 3, cursor: 'pointer',
                            fontWeight: 700, letterSpacing: '0.05em', marginTop: 4,
                          }}
                        >
                          {isTR
                            ? '↳ BU YARIŞI KALDIR'
                            : '↳ REMOVE THIS RACE'}
                        </button>
                      ) : null}
                      {w.code === 'multiple-A-races' ? (
                        <button
                          type="button"
                          data-bompa-demote-action
                          onClick={() => {
                            // Find the chronologically latest A by date
                            const sorted = [...races]
                              .map((r, idx) => ({ ...r, _idx: idx }))
                              .sort((a, b) => String(a.date).localeCompare(String(b.date)))
                            const lastA = [...sorted].reverse().find(r => r.priority === 'A')
                            if (!lastA) return
                            const nextRaces = races.map((r, idx) => (
                              r.priority === 'A' && idx !== lastA._idx
                                ? { ...r, priority: 'B' }
                                : r
                            ))
                            update({ races: nextRaces })
                          }}
                          style={{
                            fontFamily: MONO, fontSize: 10, padding: '4px 10px',
                            background: '#f5c542', color: '#000',
                            border: 'none', borderRadius: 3, cursor: 'pointer',
                            fontWeight: 700, letterSpacing: '0.05em', marginTop: 4,
                          }}
                        >
                          {isTR
                            ? '↳ EN SON A DIŞINDAKİLERİ B YAP'
                            : '↳ DEMOTE EARLIER A-RACES TO B'}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
                {season.citation}
              </div>
            </div>
          ) : races.length > 0 ? (
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              {isTR
                ? 'Yarış tarihlerini ve önceliklerini doldur — sezon iskeleti otomatik oluşacak.'
                : 'Fill in race dates and priorities — season skeleton will appear automatically.'}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default memo(MultiPeakSeasonCard)
