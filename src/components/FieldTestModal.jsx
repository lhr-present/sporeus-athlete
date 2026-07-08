// ─── FieldTestModal.jsx — Record post-Base field test, re-anchor program ────
//
// v9.177.0. Closes the gap between the orchestrator's v9.8.0
// `actualFieldTestResults` input + EP-3 (v9.163.0) `reAnchorEliteProgram`
// API and the v9.5.0 field-test milestone marker on ProgramCalendar.
// The milestone has been shown on the calendar for months with no way to
// record the actual result; this modal fills that gap.
//
// Sport-conditional inputs:
//   run / triathlon → VDOT (Daniels 30-85)
//   bike            → FTP watts (50-500)
//   swim            → CSS sec/100m (60-200)
//   rowing          → 2k split sec/500m (70-180)
//
// On submit:
//   1. Append raw entry to `sporeus-field-test-results` (array, keyed by
//      sport+raceDate program ID)
//   2. Call reAnchorEliteProgram(program, fieldTest, today, profile)
//   3. Persist re-anchored program back to `sporeus-eliteProgram`
//   4. Show before/after Peak+Taper weekly-TSS comparison + synthesized
//      bilingual delta note

import { useState, useMemo, useRef } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { reAnchorEliteProgram } from '../lib/athlete/eliteProgram.js'
import { logger } from '../lib/logger.js'

const MONO = "'IBM Plex Mono', monospace"
const STORAGE_PROGRAM = 'sporeus-eliteProgram'
const STORAGE_RESULTS = 'sporeus-field-test-results'

const SPORT_FIELD = {
  run:       { key: 'vdot',        unit: 'VDOT',     min: 30, max: 85,  step: 0.1, hint: 'Daniels VDOT after a recent race or 1-mile time trial' },
  triathlon: { key: 'vdot',        unit: 'VDOT',     min: 30, max: 85,  step: 0.1, hint: 'Daniels VDOT after a recent running test' },
  bike:      { key: 'ftp',         unit: 'W',        min: 50, max: 500, step: 1,   hint: 'FTP from a 20-min test × 0.95, or ramp test' },
  swim:      { key: 'cssSec',      unit: 'sec/100m', min: 60, max: 200, step: 0.5, hint: 'CSS from a 400m + 200m time-trial pair' },
  rowing:    { key: 'split2kSec',  unit: 'sec/500m', min: 70, max: 180, step: 0.1, hint: '2k erg test split (sec/500m)' },
}

const TITLE = { en: 'Record Field Test', tr: 'Saha Testi Kaydet' }
const HINT  = {
  en: 'After your post-Base field test, enter the result. Your remaining Peak + Taper phases will be re-anchored to the new physiology baseline (race date unchanged).',
  tr: 'Base sonrası saha testinden sonra sonucu gir. Kalan Peak + Taper fazları yeni fizyolojik tabana göre yeniden hizalanır (yarış tarihi sabit).',
}
const SUBMIT = { en: 'Re-anchor program', tr: 'Programı yeniden hizala' }
const CANCEL = { en: 'Cancel',            tr: 'İptal' }
const CLOSE  = { en: 'Close',             tr: 'Kapat' }
const APPLIED= { en: 'Re-anchored ✓',     tr: 'Yeniden hizalandı ✓' }

function programId(program) {
  if (!program) return 'unknown'
  const race = program.feasibility?.effectiveRaceDate || program.raceDate || 'no-race'
  return `${program.sport || '?'}-${race}`
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

function sumTSS(weeklyTSS, phases, phaseNames) {
  if (!Array.isArray(weeklyTSS) || !Array.isArray(phases)) return 0
  let total = 0
  for (const ph of phases) {
    if (!phaseNames.includes(ph.phase)) continue
    for (const wkNum of (ph.weeks || [])) {
      // v9.489 (program-content F6): weeklyTSS is an array of NUMBERS indexed
      // by week-1 — .find(w => w.week === n) on numbers never matched, so the
      // before/after TSS comparison always showed 0 → 0.
      const wk = weeklyTSS[wkNum - 1]
      if (typeof wk === 'number') { total += wk; continue }
      if (wk) total += Number(wk.tss) || 0
    }
  }
  return Math.round(total)
}

function deltaNote(previous, next, lang) {
  if (!previous || !next) return null
  // Pull primary physiology metric per sport
  const isTR = lang === 'tr'
  const fields = ['vdot', 'ftp', 'css', 'split500Sec', 'split2kSec']
  for (const f of fields) {
    if (previous[f] != null && next[f] != null) {
      const delta = next[f] - previous[f]
      const dir   = f === 'css' || f === 'split500Sec' || f === 'split2kSec'
        ? (delta < 0 ? 'faster' : delta > 0 ? 'slower' : 'flat')
        : (delta > 0 ? 'gained' : delta < 0 ? 'lost' : 'flat')
      const abs = Math.abs(Math.round(delta * 10) / 10)
      const metric = f.toUpperCase()
      if (dir === 'faster') return isTR ? `${metric} ${abs} daha hızlı — Peak/Taper yeniden hizalandı.` : `${metric} dropped ${abs} (faster) — Peak/Taper re-anchored.`
      if (dir === 'slower') return isTR ? `${metric} ${abs} daha yavaş — Peak/Taper yeniden hizalandı.` : `${metric} rose ${abs} (slower) — Peak/Taper re-anchored.`
      if (dir === 'gained') return isTR ? `${metric} +${abs} — Peak/Taper yeniden hizalandı.`            : `${metric} +${abs} gained — Peak/Taper re-anchored.`
      if (dir === 'lost'  ) return isTR ? `${metric} ${delta} — Peak/Taper yeniden hizalandı.`           : `${metric} ${delta} regressed — Peak/Taper re-anchored.`
      return isTR ? `${metric} değişmedi — Peak/Taper yine de yeniden hizalandı.` : `${metric} flat — Peak/Taper still re-anchored.`
    }
  }
  return null
}

export default function FieldTestModal({ program, profile, onClose, lang = 'en' }) {
  const isTR = lang === 'tr'
  const containerRef = useRef(null)
  useFocusTrap(containerRef, { active: true, onEscape: onClose })
  const [persistedProgram, setPersistedProgram] = useLocalStorage(STORAGE_PROGRAM, null)
  const [results, setResults]   = useLocalStorage(STORAGE_RESULTS, [])
  const [value, setValue]       = useState('')
  const [notes, setNotes]       = useState('')
  const [rpe, setRpe]           = useState('')
  const [submitted, setSubmitted] = useState(null) // { newProgram, prevTSS, newTSS, note, previousProgram }
  const [error, setError]       = useState(null)

  const sport = program?.sport
  const field = SPORT_FIELD[sport]
  const programIdValue = useMemo(() => programId(program), [program])

  if (!program || !field) {
    return (
      <Backdrop onClose={onClose}>
        <Container panelRef={containerRef}>
          <Header isTR={isTR} />
          <div style={{ color: '#e03030', fontSize: 12 }}>
            {isTR ? 'Aktif elite program yok veya bu spor desteklenmiyor.' : 'No active elite program or sport not supported.'}
          </div>
          <FooterRow><CloseBtn onClose={onClose} isTR={isTR} /></FooterRow>
        </Container>
      </Backdrop>
    )
  }

  function handleSubmit(e) {
    e?.preventDefault?.()
    setError(null)
    const num = parseFloat(value)
    if (!Number.isFinite(num) || num < field.min || num > field.max) {
      setError(isTR ? `Geçersiz değer (${field.min}-${field.max} ${field.unit})` : `Invalid value (${field.min}-${field.max} ${field.unit})`)
      return
    }
    const fieldTest = { [field.key]: num }
    const today = todayISO()

    const reAnchored = reAnchorEliteProgram(program, fieldTest, today, profile || {})
    if (!reAnchored) {
      setError(isTR ? 'Yeniden hizalama başarısız.' : 'Re-anchor failed.')
      return
    }
    if (reAnchored._rejected) {
      setError(isTR ? `Reddedildi: ${reAnchored.reason}` : `Rejected: ${reAnchored.reason}`)
      return
    }

    const prevPeakTaperTSS = sumTSS(program.weeklyTSS, program.phases, ['Peak', 'Taper'])
    const newPeakTaperTSS  = sumTSS(reAnchored.weeklyTSS, reAnchored.phases, ['Peak', 'Taper'])
    const note = deltaNote(program.currentLevel, reAnchored.currentLevel, lang)

    // Append the raw entry — optional notes/rpe only included when set
    // so the array stays minimal for older readers.
    const rpeNum = parseFloat(rpe)
    const entry = {
      programId: programIdValue,
      sport,
      date: today,
      field: field.key,
      value: num,
      previousLevel: program.currentLevel,
      newLevel:      reAnchored.currentLevel,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(Number.isFinite(rpeNum) && rpeNum >= 1 && rpeNum <= 10 ? { rpe: rpeNum } : {}),
    }
    try {
      const next = Array.isArray(results) ? [...results] : []
      next.push(entry)
      setResults(next)
    } catch (e) { logger.warn('field-test results save:', e?.message) }

    // Capture previous program for undo BEFORE overwriting
    const previousProgram = persistedProgram || program
    // v9.490 (program-dataflow HIGH F4): persisting the raw BUILT program here
    // destroyed the {input, form} storage contract — every reader requires
    // .input, so recording a field test WIPED the program (card fell back to
    // the empty form). Persist non-destructively: keep {input, form}, stash
    // the re-anchored build under .reAnchored. NOTE: evaluation does not yet
    // consume .reAnchored — wiring it requires the split2kSec unit
    // normalization first (program_content F1); until then the test is
    // recorded + shown without silently corrupting the program.
    try {
      // v9.493 (general-check F1): built programs have NO .input key, so the
      // old fallback wrote {input: undefined, ...} for legacy stores — wiping
      // the program on Close. Spread whatever exists; never synthesize keys.
      setPersistedProgram({
        ...(persistedProgram || program || {}),
        reAnchored,
        reAnchoredAt: todayISO(),
      })
    }
    catch (e) { logger.warn('field-test program save:', e?.message) }

    setSubmitted({
      newProgram: reAnchored,
      previousProgram,
      prevTSS: prevPeakTaperTSS,
      newTSS:  newPeakTaperTSS,
      note,
    })
  }

  return (
    <Backdrop onClose={onClose}>
      <Container panelRef={containerRef}>
        <Header isTR={isTR} />

        {!submitted ? (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12, lineHeight: 1.5 }}>
              {isTR ? HINT.tr : HINT.en}
            </div>

            <label style={{ display: 'block', fontSize: 10, color: '#888', letterSpacing: '0.08em', marginBottom: 4 }}>
              {isTR ? 'SPOR' : 'SPORT'}
            </label>
            <div style={{ fontSize: 12, color: '#ccc', marginBottom: 12, textTransform: 'uppercase' }}>{sport}</div>

            <label htmlFor="ft-value" style={{ display: 'block', fontSize: 10, color: '#888', letterSpacing: '0.08em', marginBottom: 4 }}>
              {field.unit.toUpperCase()} ({field.min}-{field.max})
            </label>
            <input
              id="ft-value"
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
              style={{
                width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
                color: '#fff', fontFamily: MONO, fontSize: 16, padding: '8px 10px', marginBottom: 4,
              }}
            />
            <div style={{ fontSize: 10, color: '#666', marginBottom: 14 }}>{field.hint}</div>

            <details style={{ marginBottom: 14 }}>
              <summary style={{ fontSize: 10, color: '#888', cursor: 'pointer', letterSpacing: '0.06em', marginBottom: 6 }}>
                {isTR ? '+ ek not / RPE (opsiyonel)' : '+ notes / RPE (optional)'}
              </summary>
              <label htmlFor="ft-rpe" style={{ display: 'block', fontSize: 10, color: '#888', letterSpacing: '0.08em', marginTop: 8, marginBottom: 4 }}>
                {isTR ? 'RPE (1-10)' : 'RPE (1-10)'}
              </label>
              <input
                id="ft-rpe"
                type="number"
                min={1}
                max={10}
                step={1}
                value={rpe}
                onChange={e => setRpe(e.target.value)}
                style={{
                  width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
                  color: '#fff', fontFamily: MONO, fontSize: 13, padding: '6px 8px', marginBottom: 8,
                }}
              />
              <label htmlFor="ft-notes" style={{ display: 'block', fontSize: 10, color: '#888', letterSpacing: '0.08em', marginBottom: 4 }}>
                {isTR ? 'NOT' : 'NOTES'}
              </label>
              <textarea
                id="ft-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder={isTR ? 'Hava, koşullar, hissedilen efor…' : 'Weather, conditions, felt-effort…'}
                style={{
                  width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
                  color: '#fff', fontFamily: MONO, fontSize: 11, padding: '6px 8px', resize: 'vertical',
                }}
              />
            </details>

            {error && (
              <div role="alert" style={{ fontSize: 11, color: '#e03030', marginBottom: 10 }}>{error}</div>
            )}

            <FooterRow>
              <button type="button" onClick={onClose} style={btnSecondary}>
                {isTR ? CANCEL.tr : CANCEL.en}
              </button>
              <button type="submit" style={btnPrimary}>
                {isTR ? SUBMIT.tr : SUBMIT.en}
              </button>
            </FooterRow>
          </form>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: '#5bc25b', fontWeight: 700, marginBottom: 10, letterSpacing: '0.06em' }}>
              {isTR ? APPLIED.tr : APPLIED.en}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={statBox}>
                <div style={statLabel}>{isTR ? 'Önceki Peak+Taper TSS' : 'Previous Peak+Taper TSS'}</div>
                <div style={statValue}>{submitted.prevTSS}</div>
              </div>
              <div style={statBox}>
                <div style={statLabel}>{isTR ? 'Yeni Peak+Taper TSS' : 'New Peak+Taper TSS'}</div>
                <div style={{ ...statValue, color: submitted.newTSS > submitted.prevTSS ? '#5bc25b' : submitted.newTSS < submitted.prevTSS ? '#ff6600' : '#ccc' }}>
                  {submitted.newTSS}
                  <span style={{ fontSize: 10, marginLeft: 6, color: '#888' }}>
                    {submitted.newTSS !== submitted.prevTSS && `(${submitted.newTSS > submitted.prevTSS ? '+' : ''}${submitted.newTSS - submitted.prevTSS})`}
                  </span>
                </div>
              </div>
            </div>

            {submitted.note && (
              <div style={{ fontSize: 11, color: '#cce0ff', background: '#0a0a20', border: '1px solid #0064ff', borderRadius: 4, padding: '8px 10px', marginBottom: 14, lineHeight: 1.5 }}>
                {submitted.note}
              </div>
            )}

            <FooterRow>
              <button
                type="button"
                onClick={() => {
                  // Restore the previous program + remove the last results entry
                  try { setPersistedProgram(submitted.previousProgram) }
                  catch (e) { logger.warn('field-test undo program:', e?.message) }
                  try {
                    const arr = Array.isArray(results) ? results.slice(0, -1) : []
                    setResults(arr)
                  } catch (e) { logger.warn('field-test undo results:', e?.message) }
                  setSubmitted(null)
                  setValue('')
                  setNotes('')
                  setRpe('')
                }}
                style={btnSecondary}
                aria-label={isTR ? 'Geri al' : 'Undo'}>
                {isTR ? '↶ Geri al' : '↶ Undo'}
              </button>
              <button type="button" onClick={onClose} style={btnPrimary}>
                {isTR ? CLOSE.tr : CLOSE.en}
              </button>
            </FooterRow>
          </div>
        )}
      </Container>
    </Backdrop>
  )
}

// ── Layout primitives ────────────────────────────────────────────────────────
function Backdrop({ children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10010,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: MONO,
      }}>
      {/* Dimmed backdrop is a SIBLING behind the dialog (aria-hidden) so it isn't an
          unnamed clickable in the AT tree, and doesn't hide the dialog it used to wrap.
          Click-to-close preserved; keyboard close is handled by the dialog focus-trap onEscape. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)' }}
      />
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

function Container({ children, panelRef }) {
  return (
    <div ref={panelRef} role="dialog" aria-modal="true" style={{
      background: '#0f0f0f', border: '1px solid #333', borderRadius: 6,
      padding: 20, maxWidth: 480, width: '90vw', maxHeight: '85vh', overflowY: 'auto',
      color: '#ccc',
    }}>
      {children}
    </div>
  )
}

function Header({ isTR }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 16 }}>📊</span>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>
        {isTR ? TITLE.tr : TITLE.en}
      </h2>
    </div>
  )
}

function FooterRow({ children }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>{children}</div>
}

function CloseBtn({ onClose, isTR }) {
  return (
    <button onClick={onClose} style={btnPrimary}>
      {isTR ? CLOSE.tr : CLOSE.en}
    </button>
  )
}

const btnPrimary = {
  fontFamily: MONO, fontSize: 11, fontWeight: 700, padding: '8px 16px',
  background: '#0064ff', border: 'none', color: '#fff', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.06em',
}
const btnSecondary = {
  fontFamily: MONO, fontSize: 11, padding: '8px 16px',
  background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 3, cursor: 'pointer',
}
const statBox = {
  padding: '10px 12px', background: '#1a1a1a', border: '1px solid #222', borderRadius: 4,
}
const statLabel = {
  fontSize: 9, color: '#666', letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase',
}
const statValue = {
  fontSize: 18, fontWeight: 700, color: '#ccc',
}
