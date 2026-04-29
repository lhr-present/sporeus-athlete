// src/components/dashboard/RaceGoalDashCard.jsx — E87 v2
// Olympic-coach daily training card: phase context, readiness, full multi-modal
// prescription (run + drills + strength + preventive) with zone-coded visual hierarchy.
import { useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { detectVdotFromLog } from '../../lib/athlete/vdotTracker.js'
import { translateAllZones } from '../../lib/athlete/paceZoneTranslator.js'
import { analyzeRaceGoal, parseMmSs } from '../../lib/athlete/raceGoalEngine.js'
import { buildTrainingPlan, getCurrentPlanWeek } from '../../lib/athlete/trainingBridge.js'
import { predictFitness } from '../../lib/intelligence.js'

const MONO = "'IBM Plex Mono', monospace"

// Zone colour system — consistent across all visual elements
const ZONE_COLOR  = { 1: '#555555', 2: '#0064ff', 3: '#5bc25b', 4: '#f5c542', 5: '#ff6600' }
const ZONE_LABEL  = { 1: 'Z1 · REC', 2: 'Z2 · EASY', 3: 'Z3 · MARATHON', 4: 'Z4 · THRESHOLD', 5: 'Z5 · VO₂MAX' }
const ZONE_LABEL_TR = { 1: 'Z1 · TOPARLANMA', 2: 'Z2 · KOLAY', 3: 'Z3 · MARATON', 4: 'Z4 · EŞİK', 5: 'Z5 · VO₂MAX' }

const DRILLS_COLOR = '#4a90d9'
const STR_COLOR    = '#c87137'
const PREV_COLOR   = '#5bc25b'
const ORANGE       = '#ff6600'
const GREEN        = '#5bc25b'
const AMBER        = '#f5c542'
const RED          = '#e03030'
const BLUE         = '#0064ff'
const DIM          = '#444'
const DIM2         = '#2a2a2a'
const DIM3         = '#1a1a1a'

const CONF_COLOR = { high: GREEN, medium: AMBER, low: RED }

function zoneColor(z) { return ZONE_COLOR[z] ?? '#555' }

// TSB freshness label
function tsbStatus(tsb) {
  if (tsb > 10)  return { label: 'FRESH',     tr: 'DİNÇ',      color: GREEN }
  if (tsb > -5)  return { label: 'NORMAL',    tr: 'NORMAL',    color: BLUE  }
  if (tsb > -20) return { label: 'TIRED',     tr: 'YORGUN',    color: AMBER }
  return              { label: 'VERY TIRED', tr: 'ÇOK YORGUN', color: RED  }
}

// Downgrade today's session when TSB is critically low
function adaptSession(session, tsb) {
  if (!session || tsb >= -5) return { session, downgraded: false, warn: false }
  if (tsb < -20) return {
    session: { ...session, type: 'Easy Run — TSB Adapted', tr: 'Kolay Koşu — TSB Uyarlaması', zone: 1, paceStr: null },
    downgraded: true, warn: false,
  }
  return { session, downgraded: false, warn: true }
}

// TSS accumulated in current week from log
function weekTSSLogged(log, weekStart, weekEnd) {
  return log
    .filter(e => e.date >= weekStart && e.date <= weekEnd && e.tss > 0)
    .reduce((s, e) => s + (e.tss || 0), 0)
}

// Parse structure text into WU / MAIN SET / COOL-DOWN rows
function parseStructure(text) {
  if (!text) return null
  const wu   = text.match(/^WU\s+(.+?)(?=\.\s*MAIN|$)/i)?.[1]?.replace(/\.$/, '').trim()
  const main = text.match(/MAIN[:\s]+(.+?)(?=\.\s*CD\s|$)/i)?.[1]?.replace(/\.$/, '').trim()
  const cd   = text.match(/\.\s*CD\s+(.+?)(?=\.\s*(?:Feel|Science|PURPOSE|RPE|Note|Last|Key|Stimulus)|$)/i)?.[1]?.replace(/\.$/, '').trim()
  if (!wu && !main && !cd) return null
  return [
    wu   && { label: 'WU',   text: wu },
    main && { label: 'MAIN', text: main },
    cd   && { label: 'CD',   text: cd },
  ].filter(Boolean)
}

// Extract trailing science/adaptation note from structure text
function parseAdaptation(text) {
  if (!text) return null
  return (
    text.match(/\.\s*Science[:\s]+([^.]+)/i)?.[1]?.trim() ||
    text.match(/\.\s*Stimulus[:\s]+([^.]+)/i)?.[1]?.trim() ||
    text.match(/\.\s*Key adaptation[s]?[:\s]+([^.]+)/i)?.[1]?.trim() ||
    null
  )
}

// ── Shared primitive ──────────────────────────────────────────────────────────
function SectionHeader({ label, badge, badgeColor, detail, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 7, color: '#555', letterSpacing: '0.12em' }}>▸ {label}</span>
        {badge && (
          <span style={{
            fontSize: 7, color: badgeColor ?? '#888',
            border: `1px solid ${badgeColor ?? '#444'}33`,
            borderRadius: 2, padding: '1px 5px', letterSpacing: '0.06em',
          }}>
            {badge}
          </span>
        )}
        {detail && <span style={{ fontSize: 7, color: '#444' }}>{detail}</span>}
      </div>
      {right && <span style={{ fontSize: 7, color: '#444' }}>{right}</span>}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#111', margin: '0 -14px' }} />
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RaceGoalDashCard({ log = [], profile = {}, isTR, onLogSession }) {
  const [saved] = useLocalStorage('sporeus-race-goal-v2', null)
  const today    = new Date().toISOString().slice(0, 10)

  // Mon-first index: Mon=0 … Sun=6  (getUTCDay returns 0=Sun, 1=Mon … 6=Sat)
  const todayDow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7

  const detected = useMemo(() => detectVdotFromLog(log, 90, today), [log, today])

  const maxHR = useMemo(() => {
    if (profile?.maxhr > 0) return parseInt(profile.maxhr)
    if (profile?.age   > 0) return Math.round(208 - 0.7 * parseFloat(profile.age))
    return null
  }, [profile])

  const zones = useMemo(() => {
    const vdot = detected?.vdot
    if (!vdot) return null
    return translateAllZones(vdot, maxHR)
  }, [detected, maxHR])

  const { analysis, plan, currentWeekData } = useMemo(() => {
    if (!saved) return {}
    const cSec = parseMmSs(saved.currentTime)
    const gSec = parseMmSs(saved.goalTime)
    const a = analyzeRaceGoal(cSec, gSec, saved.distM || 10000, profile || {}, log)
    if (!a) return {}
    const planStart = saved.planStart || today
    const p = buildTrainingPlan(a, planStart)
    const cw = getCurrentPlanWeek(p, today)
    return { analysis: a, plan: p, currentWeekData: cw }
  }, [saved, profile, log, today])

  const fitness = useMemo(() => predictFitness(log || []), [log])
  const tsb  = fitness?.tsb  ?? 0
  const ctl  = fitness?.ctl  ?? 0
  const acwr = fitness?.acwr ?? null

  const tsbInfo = tsbStatus(tsb)

  const todayRaw = currentWeekData?.week?.sessions?.[todayDow] ?? null
  const { session: day, downgraded, warn } = adaptSession(todayRaw, tsb)

  // Zone key: prefer explicit zone number (always correct from sessionLibrary)
  function zoneKey(s) {
    const z = s?.run?.zone ?? s?.zone
    if (z === 5) return 'I'
    if (z === 4) return 'T'
    if (z === 3) return 'M'
    const t = (s?.run?.type || s?.type || '').toLowerCase()
    if (/interval|aralık/i.test(t)) return 'I'
    if (/rep|sprint/i.test(t)) return 'R'
    if (/threshold|tempo|eşik/i.test(t)) return 'T'
    if (/marathon|maraton/i.test(t)) return 'M'
    return 'E'
  }
  const zk       = day ? zoneKey(day) : 'E'
  const zoneInfo = zones?.[zk]  // used for feel text + pace/HR/RPE fallback only

  const loggedTSS  = useMemo(() => {
    if (!currentWeekData?.week) return 0
    return weekTSSLogged(log, currentWeekData.week.startDate, currentWeekData.week.endDate)
  }, [log, currentWeekData])
  const plannedTSS = currentWeekData?.week?.tss ?? 0
  const tssRatio   = plannedTSS > 0 ? Math.min(1, loggedTSS / plannedTSS) : 0

  const week     = currentWeekData?.week
  const runZone  = day?.run?.zone ?? (day?.zone ?? 1)
  const runColor = zoneColor(runZone)  // always from zone number — zoneInfo.color can mismatch (e.g. RACE DAY)

  // Derived date display
  const dateObj   = new Date(today + 'T12:00:00Z')
  const dayName   = dateObj.toLocaleDateString(isTR ? 'tr-TR' : 'en-US', { weekday: 'short' }).toUpperCase()
  const dateShort = dateObj.toLocaleDateString(isTR ? 'tr-TR' : 'en-US', { day: '2-digit', month: 'short' }).toUpperCase()

  if (!saved && !detected) return null

  // ── Prescription parse ────────────────────────────────────────────────────
  const structure   = day?.run ? (isTR ? day.run.structureTr : day.run.structure) : null
  const parsedSteps = parseStructure(structure)
  const adaptation  = day?.run ? parseAdaptation(isTR ? day.run.structureTr : day.run.structure) : null

  // ── Render ────────────────────────────────────────────────────────────────
  const cardStyle = {
    fontFamily: MONO,
    background: '#080808',
    border: '1px solid #1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  }

  return (
    <div style={cardStyle}>

      {/* ══ PHASE HEADER ═════════════════════════════════════════════════════ */}
      <div style={{
        background: '#0d0d0d',
        borderBottom: `1px solid ${ORANGE}22`,
        padding: '8px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 7, color: ORANGE, letterSpacing: '0.14em', fontWeight: 700 }}>
            {week
              ? `${week.isDeload ? '↓ DELOAD' : (isTR ? week.phaseTr ?? week.phase : week.phase).toUpperCase()} · W${week.weekNum}/${plan?.length}`
              : (isTR ? '◈ SPOREUS COACH' : '◈ SPOREUS COACH')
            }
          </span>
          {detected && (
            <span style={{ fontSize: 7, color: CONF_COLOR[detected.confidence], border: `1px solid ${CONF_COLOR[detected.confidence]}33`, borderRadius: 2, padding: '1px 5px' }}>
              VDOT {detected.vdot}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {analysis && (
            <span style={{ fontSize: 8, color: '#555', letterSpacing: '0.04em' }}>
              {analysis.goalTimeStr} · {analysis.distanceLabel}
            </span>
          )}
        </div>
      </div>

      {/* ══ READINESS STRIP ══════════════════════════════════════════════════ */}
      <div style={{
        background: '#060606',
        borderBottom: '1px solid #0f0f0f',
        padding: '6px 14px',
        display: 'flex', gap: 0, alignItems: 'center', flexWrap: 'wrap',
      }}>
        {[
          { label: isTR ? 'FİTNES' : 'CTL',  value: Math.round(ctl), color: '#888' },
          { label: 'TSB',  value: `${tsb >= 0 ? '+' : ''}${tsb}`, color: tsbInfo.color },
          acwr != null && { label: 'ACWR', value: acwr.toFixed(2), color: acwr > 1.3 ? RED : acwr < 0.8 ? AMBER : '#888' },
        ].filter(Boolean).map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 14 }}>
            <span style={{ fontSize: 7, color: '#333', letterSpacing: '0.08em' }}>{item.label}</span>
            <span style={{ fontSize: 9, color: item.color, fontWeight: 600 }}>{item.value}</span>
          </span>
        ))}
        <span style={{
          marginLeft: 'auto',
          fontSize: 7, color: tsbInfo.color,
          border: `1px solid ${tsbInfo.color}33`,
          borderRadius: 2, padding: '1px 6px', letterSpacing: '0.08em',
        }}>
          {isTR ? tsbInfo.tr : tsbInfo.label}
        </span>
      </div>

      {/* ══ DATE + TOTAL HEADER ══════════════════════════════════════════════ */}
      <div style={{
        padding: '10px 14px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        borderBottom: day ? '1px solid #0f0f0f' : 'none',
      }}>
        <span style={{ fontSize: 10, color: '#777', letterSpacing: '0.06em' }}>
          {dayName} {dateShort}
          {downgraded && (
            <span style={{ color: AMBER, marginLeft: 8, fontSize: 8 }}>△ TSB {isTR ? 'UYARLAMASI' : 'ADAPTED'}</span>
          )}
          {warn && !downgraded && (
            <span style={{ color: AMBER, marginLeft: 8, fontSize: 8 }}>△ {isTR ? 'YORGUNLUK VAR' : 'FATIGUE NOTED'}</span>
          )}
        </span>
        {day?.totalDurationMin > 0 && (
          <span style={{ fontSize: 8, color: '#444', letterSpacing: '0.06em' }}>
            ~{day.totalDurationMin}min {isTR ? 'toplam' : 'total'}
          </span>
        )}
      </div>

      {/* ══ TSB DOWNGRADE WARNING ════════════════════════════════════════════ */}
      {downgraded && (
        <div style={{ margin: '0 14px 12px', padding: '8px 10px', background: '#1a0800', border: `1px solid ${AMBER}33`, borderRadius: 3 }}>
          <div style={{ fontSize: 9, color: AMBER, fontWeight: 700, marginBottom: 3, letterSpacing: '0.06em' }}>
            {isTR ? '↓ ANTRENMAN DÜŞÜRÜLDÜ' : '↓ SESSION DOWNGRADED'}
          </div>
          <div style={{ fontSize: 8, color: '#888', lineHeight: 1.5 }}>
            {isTR
              ? `TSB ${tsb}: çok düşük. Bugün kolay koş, beslen, uyu. Yarın tekrar değerlendir.`
              : `TSB ${tsb}: critically low. Run easy, eat, sleep. Reassess tomorrow.`}
          </div>
        </div>
      )}

      {/* ══ RUN SESSION ══════════════════════════════════════════════════════ */}
      {day?.run && (
        <div style={{ borderLeft: `3px solid ${runColor}`, padding: '12px 14px 12px 11px' }}>
          {/* Session title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 7, color: '#444', letterSpacing: '0.12em', marginBottom: 3 }}>
                ▸ {isTR ? 'KOŞU ANTRENMANI' : 'RUN'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ccc', letterSpacing: '0.02em' }}>
                {isTR ? (day.run.tr || day.run.type) : day.run.type}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{
                fontSize: 7, color: runColor,
                border: `1px solid ${runColor}44`,
                borderRadius: 2, padding: '2px 7px', letterSpacing: '0.07em', fontWeight: 700,
              }}>
                {(isTR ? ZONE_LABEL_TR : ZONE_LABEL)[runZone] ?? `Z${runZone}`}
              </span>
              <span style={{ fontSize: 7, color: '#444' }}>TSS ~{day.run.tss}</span>
            </div>
          </div>

          {/* Pace · HR · RPE row */}
          <div style={{
            display: 'flex', gap: 14, marginBottom: 10,
            padding: '6px 10px', background: '#0a0a0a', borderRadius: 3,
          }}>
            {(day.run.paceStr || zoneInfo?.pace) && (
              <div>
                <div style={{ fontSize: 7, color: '#444', letterSpacing: '0.08em', marginBottom: 2 }}>
                  {isTR ? 'TEMPO' : 'PACE'}
                </div>
                <div style={{ fontSize: 11, color: runColor, fontWeight: 700 }}>
                  {day.run.paceStr ?? `${zoneInfo.pace}/km`}
                </div>
              </div>
            )}
            {(day.run.hrLow || zoneInfo?.hrRange) && (
              <div>
                <div style={{ fontSize: 7, color: '#444', letterSpacing: '0.08em', marginBottom: 2 }}>
                  {isTR ? 'NABIZ' : 'HEART RATE'}
                </div>
                <div style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>
                  {day.run.hrLow && day.run.hrHigh
                    ? `${day.run.hrLow}–${day.run.hrHigh} bpm`
                    : zoneInfo?.hrRange?.str}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 7, color: '#444', letterSpacing: '0.08em', marginBottom: 2 }}>RPE</div>
              <div style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>
                {zoneInfo?.rpeRange ?? `${day.run.rpeLow}–${day.run.rpeHigh}`} / 10
              </div>
            </div>
            {day.run.durationMin > 0 && (
              <div style={{ marginLeft: 'auto' }}>
                <div style={{ fontSize: 7, color: '#444', letterSpacing: '0.08em', marginBottom: 2 }}>
                  {isTR ? 'SÜRE' : 'DURATION'}
                </div>
                <div style={{ fontSize: 10, color: '#666', fontWeight: 600 }}>
                  {day.run.durationMin}min
                </div>
              </div>
            )}
          </div>

          {/* Structured prescription WU / MAIN / CD */}
          {parsedSteps ? (
            <div style={{ background: '#050505', borderRadius: 3, overflow: 'hidden' }}>
              {parsedSteps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '6px 10px',
                  borderBottom: i < parsedSteps.length - 1 ? '1px solid #0d0d0d' : 'none',
                  alignItems: 'flex-start',
                }}>
                  <span style={{
                    fontSize: 7, color: '#555',
                    minWidth: 30, paddingTop: 2,
                    letterSpacing: '0.06em', fontWeight: 700,
                  }}>
                    {step.label}
                  </span>
                  <span style={{ fontSize: 8, color: '#777', lineHeight: 1.6, flex: 1 }}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          ) : structure ? (
            <div style={{ background: '#050505', padding: '8px 10px', borderRadius: 3, fontSize: 8, color: '#666', lineHeight: 1.6 }}>
              {structure}
            </div>
          ) : null}

          {/* Zone feel */}
          {zoneInfo?.feelEN && !downgraded && (
            <div style={{ fontSize: 7, color: '#444', marginTop: 6, fontStyle: 'italic' }}>
              "{isTR ? zoneInfo.feelTR : zoneInfo.feelEN}"
            </div>
          )}

          {/* Adaptation / science note */}
          {adaptation && (
            <div style={{
              display: 'flex', gap: 6, alignItems: 'flex-start',
              marginTop: 8, padding: '5px 8px',
              background: `${runColor}08`, border: `1px solid ${runColor}15`,
              borderRadius: 3,
            }}>
              <span style={{ fontSize: 7, color: runColor, letterSpacing: '0.06em', paddingTop: 1, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {isTR ? 'ADAPTASYON' : 'SCIENCE'}
              </span>
              <span style={{ fontSize: 7, color: '#666', lineHeight: 1.5 }}>{adaptation}</span>
            </div>
          )}
        </div>
      )}

      {/* Rest day message — no run, no strength (Taper Mon / Deload Mon etc.) */}
      {!day?.run && !day?.strength && day && (
        <div style={{ padding: '10px 14px', fontSize: 9, color: '#333', letterSpacing: '0.06em' }}>
          {isTR ? '— DİNLENME / AKTIF TOPARLANMA' : '— REST / ACTIVE RECOVERY'}
        </div>
      )}

      {/* ══ DRILLS ═══════════════════════════════════════════════════════════ */}
      {!downgraded && day?.drills && (
        <>
          <Divider />
          <div style={{ padding: '12px 14px' }}>
            <SectionHeader
              label={isTR ? 'FORM HAREKETLERİ (koşu öncesi)' : 'DRILLS (pre-run warmup)'}
              badge={day.drills.level.toUpperCase()}
              badgeColor={DRILLS_COLOR}
              right={`${day.drills.durationMin}min`}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {day.drills.exercises.map((ex, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', borderBottom: i < day.drills.exercises.length - 1 ? '1px solid #0d0d0d' : 'none' }}>
                  <span style={{ fontSize: 8, color: '#777', flex: 1, paddingRight: 8 }}>
                    {isTR ? ex.tr : ex.name}
                  </span>
                  {(ex.distance || ex.reps) && (
                    <span style={{ fontSize: 7, color: DRILLS_COLOR, whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {ex.distance || ex.reps}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══ STRENGTH ═════════════════════════════════════════════════════════ */}
      {!downgraded && day?.strength && (
        <>
          <Divider />
          <div style={{ padding: '12px 14px' }}>
            <SectionHeader
              label={isTR ? 'KUVVETLENDİRME' : 'STRENGTH'}
              badge={(isTR ? day.strength.tr : day.strength.name).split('—')[0]?.trim().toUpperCase() || day.strength.category.toUpperCase()}
              badgeColor={STR_COLOR}
              right={`${day.strength.durationMin}min`}
            />
            <div>
              {day.strength.exercises.map((ex, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '4px 0',
                  borderBottom: i < day.strength.exercises.length - 1 ? '1px solid #0d0d0d' : 'none',
                }}>
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    <div style={{ fontSize: 8, color: '#888' }}>
                      {isTR ? ex.tr : ex.name}
                    </div>
                    {ex.notes && (
                      <div style={{ fontSize: 7, color: '#3a3a3a', lineHeight: 1.4, marginTop: 1 }}>
                        {isTR ? ex.notesTr : ex.notes}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 9, color: STR_COLOR, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {ex.sets}×{ex.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══ PREVENTIVE ═══════════════════════════════════════════════════════ */}
      {!downgraded && day?.preventive && (
        <>
          <Divider />
          <div style={{ padding: '12px 14px' }}>
            <SectionHeader
              label={isTR ? 'KORUYUCU ÇALIŞMALAR' : 'PREVENTIVE'}
              badge={(isTR ? day.preventive.tr : day.preventive.name).toUpperCase()}
              badgeColor={PREV_COLOR}
              right={`${day.preventive.durationMin}min`}
            />
            <div>
              {day.preventive.exercises.map((ex, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '4px 0',
                  borderBottom: i < day.preventive.exercises.length - 1 ? '1px solid #0d0d0d' : 'none',
                }}>
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    <div style={{ fontSize: 8, color: '#888' }}>
                      {isTR ? ex.tr : ex.name}
                    </div>
                    {ex.notes && (
                      <div style={{ fontSize: 7, color: '#3a3a3a', lineHeight: 1.4, marginTop: 1 }}>
                        {isTR ? ex.notesTr : ex.notes}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 9, color: PREV_COLOR, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {ex.sets}×{ex.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══ LOG SESSION SHORTCUT ════════════════════════════════════════════ */}
      {onLogSession && day?.run && !downgraded && (
        <>
          <Divider />
          <div style={{ padding: '10px 14px' }}>
            <button
              onClick={onLogSession}
              style={{
                width: '100%', fontFamily: MONO,
                background: 'transparent',
                border: `1px solid ${runColor}44`,
                borderRadius: 3, padding: '7px 0',
                fontSize: 8, color: runColor,
                letterSpacing: '0.1em', cursor: 'pointer',
              }}
            >
              + {isTR ? 'ANTRENMAN KAYDET' : 'LOG THIS SESSION'}
            </button>
          </div>
        </>
      )}

      {/* ══ WEEKLY TSS PROGRESS ══════════════════════════════════════════════ */}
      {plannedTSS > 0 && (
        <>
          <Divider />
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
              <span style={{ color: '#444', letterSpacing: '0.08em' }}>
                {isTR ? 'HAFTALIK TSS HEDEFİ' : 'WEEKLY TSS TARGET'}
              </span>
              <span style={{ color: tssRatio >= 1 ? GREEN : '#666' }}>
                {loggedTSS} / {plannedTSS}
                {tssRatio >= 1 && ' ✓'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 4, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${Math.round(tssRatio * 100)}%`,
                  background: tssRatio >= 1 ? GREEN : tssRatio >= 0.6 ? ORANGE : BLUE,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 7, color: '#444', minWidth: 28, textAlign: 'right' }}>
                {Math.round(tssRatio * 100)}%
              </span>
            </div>
          </div>
        </>
      )}

      {/* ══ NO PLAN CTA ══════════════════════════════════════════════════════ */}
      {!saved && detected && (
        <>
          <Divider />
          <div style={{ padding: '10px 14px', fontSize: 8, color: '#444', lineHeight: 1.6 }}>
            {isTR
              ? 'Antrenman planı almak için Yarış Hedef Analizi kartına hedef sürenizi girin.'
              : 'Enter your goal time in Race Goal Analyzer to unlock your full training plan.'}
          </div>
        </>
      )}

      {/* ══ BOTTOM TAG ═══════════════════════════════════════════════════════ */}
      {week && (
        <div style={{
          background: '#050505', borderTop: '1px solid #0f0f0f',
          padding: '5px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 7, color: '#2a2a2a', letterSpacing: '0.06em' }}>
            {isTR ? 'SPOREUS KOÇLUK SİSTEMİ' : 'SPOREUS COACHING SYSTEM'}
          </span>
          {analysis && (
            <span style={{ fontSize: 7, color: '#2a2a2a' }}>
              VDOT {analysis.currentVdot} → {analysis.goalVdot} · {analysis.weeksToGoal}w
            </span>
          )}
        </div>
      )}

    </div>
  )
}
