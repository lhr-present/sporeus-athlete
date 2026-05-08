// ─── coach/CoachAthleteProgramCard.jsx — coach-side ingestion of v=1 share ──
// v8.101.0 — coach pastes the athlete's "SHARE WITH COACH" JSON envelope
// here; card renders a read-only summary of the plan. Companion to
// `EliteProgramCard.shareWithCoach` (athlete side).
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo, useRef, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import {
  parseCoachShareEnvelope,
  COACH_SHARE_ERRORS,
} from '../../lib/athlete/coachShareEnvelope.js'
import CoachEditPanel from './CoachEditPanel.jsx'

const STORAGE_KEY = 'sporeus-coach-ingested-share'

// Mirror EliteProgramCard visual tokens so coach + athlete views stay aligned.
const PHASE_COLORS = {
  Base:  '#0064ff',
  Build: '#00aa66',
  Peak:  '#ff6600',
  Taper: '#9966cc',
}
const PHASE_LABEL = {
  Base:  { en: 'BASE',  tr: 'TEMEL' },
  Build: { en: 'BUILD', tr: 'YAPI' },
  Peak:  { en: 'PEAK',  tr: 'ZİRVE' },
  Taper: { en: 'TAPER', tr: 'KÖŞELEME' },
}
const BAND_COLOR = {
  comfortable: '#28a745',
  realistic:   '#0064ff',
  aggressive:  '#ff9500',
  unrealistic: '#dc3545',
}
const BAND_LABEL = {
  comfortable: { en: 'COMFORTABLE', tr: 'RAHAT' },
  realistic:   { en: 'REALISTIC',   tr: 'GERÇEKÇİ' },
  aggressive:  { en: 'AGGRESSIVE',  tr: 'AGRESİF' },
  unrealistic: { en: 'UNREALISTIC', tr: 'GERÇEKDIŞI' },
}
const LIFECYCLE_COLOR = {
  draft:           '#6c757d',
  applied:         '#0064ff',
  'in-progress':   '#ff6600',
  complete:        '#28a745',
  'autopsy-ready': '#ff9500',
  expired:         '#999',
}
const LIFECYCLE_LABEL = {
  draft:           { en: 'DRAFT',         tr: 'TASLAK' },
  applied:         { en: 'APPLIED',       tr: 'UYGULANDI' },
  'in-progress':   { en: 'IN PROGRESS',   tr: 'DEVAM EDİYOR' },
  complete:        { en: 'COMPLETE',      tr: 'TAMAMLANDI' },
  'autopsy-ready': { en: 'AUTOPSY READY', tr: 'OTOPSI HAZIR' },
  expired:         { en: 'EXPIRED',       tr: 'SÜRESİ DOLDU' },
}
const SPORT_LABEL = {
  run:       { en: 'RUN',  tr: 'KOŞU' },
  bike:      { en: 'BIKE', tr: 'BİSİKLET' },
  swim:      { en: 'SWIM', tr: 'YÜZME' },
  triathlon: { en: 'TRI',  tr: 'TRİ' },
}

function fmtSec(sec) {
  if (sec == null) return '—'
  const s = Math.round(Number(sec) || 0)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

function PhaseSplitBar({ phases, isTR }) {
  const total = phases.reduce((a, p) => a + (p.weeks || 0), 0) || 1
  const aria = isTR
    ? `Faz dağılımı: ${phases.map(p => `${PHASE_LABEL[p.phase]?.tr || p.phase} ${p.weeks || 0}h`).join(', ')}`
    : `Phase split: ${phases.map(p => `${PHASE_LABEL[p.phase]?.en || p.phase} ${p.weeks || 0}w`).join(', ')}`
  return (
    <div role="img" aria-label={aria} data-coach-phase-split style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', width: '100%', height: '14px', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {phases.map((p, i) => {
          const w = (p.weeks || 0) / total
          if (w <= 0) return null
          return <div key={i} style={{ flex: `${w} 0 0`, background: PHASE_COLORS[p.phase] || '#888' }} />
        })}
      </div>
      <div style={{ display: 'flex', marginTop: '4px', gap: '6px', flexWrap: 'wrap' }}>
        {phases.map((p, i) => (
          <div key={i} style={{ ...S.mono, fontSize: '9px', color: 'var(--sub, var(--muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span aria-hidden="true" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: PHASE_COLORS[p.phase] || '#888' }} />
            {PHASE_LABEL[p.phase]?.[isTR ? 'tr' : 'en'] || p.phase} · {p.weeks || 0}{isTR ? 'h' : 'w'}
          </div>
        ))}
      </div>
    </div>
  )
}

function PhysiologyBlock({ sport, physiology, isTR }) {
  if (!physiology) return null
  const ROW = { display: 'flex', gap: '8px', borderBottom: '1px dashed var(--border)', padding: '3px 0', flexWrap: 'wrap', alignItems: 'baseline' }
  const KEY = { ...S.mono, fontSize: '10px', color: 'var(--muted)', flex: '0 0 60px', letterSpacing: '0.06em' }
  const VAL = { ...S.mono, fontSize: '11px', color: 'var(--text)' }
  const HEAD = { ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }

  const rows = []
  if (physiology.currentVDOT != null && physiology.targetVDOT != null) {
    rows.push({ k: 'VDOT', cur: physiology.currentVDOT, tgt: physiology.targetVDOT })
  }
  if (physiology.currentFTP != null && physiology.targetFTP != null) {
    rows.push({ k: 'FTP', cur: `${physiology.currentFTP} W`, tgt: `${physiology.targetFTP} W` })
  }
  if (physiology.currentCSS != null && physiology.targetCSS != null) {
    rows.push({ k: 'CSS', cur: physiology.currentCSS, tgt: physiology.targetCSS })
  }
  if (rows.length === 0) return null

  return (
    <div role="region" data-coach-physiology={sport || 'unknown'}
      aria-label={isTR ? 'Fizyoloji' : 'Physiology'}
      style={{ marginBottom: '12px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}>
      <div style={{ ...HEAD, marginBottom: '4px' }}>
        {isTR ? 'FİZYOLOJİ' : 'PHYSIOLOGY'}
        <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
        {isTR ? 'PHYSIOLOGY' : 'FİZYOLOJİ'}
      </div>
      {rows.map(r => (
        <div key={r.k} style={ROW}>
          <span style={KEY}>{r.k}</span>
          <span style={{ ...VAL, flex: '1 1 80px' }}>{r.cur}</span>
          <span aria-hidden="true" style={{ ...VAL, flex: '0 0 12px' }}>→</span>
          <span style={{ ...VAL, flex: '1 1 80px' }}>{r.tgt}</span>
        </div>
      ))}
    </div>
  )
}

export default function CoachAthleteProgramCard() {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [stored, setStored] = useLocalStorage(STORAGE_KEY, null)
  const [textValue, setTextValue] = useState('')
  const [errorCode, setErrorCode] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [pendingEdits, setPendingEdits] = useLocalStorage('sporeus-coach-pending-edits', [])
  const fileInputRef = useRef(null)

  const titleEN = 'ATHLETE PROGRAM'
  const titleTR = 'SPORCU PROGRAMI'
  const ariaLabel = isTR ? 'Sporcu programı kartı' : 'Athlete program card'

  const cardBase = { ...S.card, borderLeft: '4px solid #0064ff' }

  function handleIngest() {
    const r = parseCoachShareEnvelope(textValue)
    if (!r.ok) {
      setErrorCode(r.error)
      setTextValue('')
      return
    }
    setStored(r.envelope)
    setTextValue('')
    setErrorCode(null)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      setErrorCode('invalid-json')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      const text = String(ev.target?.result || '')
      const r = parseCoachShareEnvelope(text)
      if (!r.ok) {
        setErrorCode(r.error)
        setTextValue('')
      } else {
        setStored(r.envelope)
        setTextValue('')
        setErrorCode(null)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleClear() {
    setStored(null)
    setTextValue('')
    setErrorCode(null)
    setEditMode(false)
    setPendingEdits([])
  }

  // Defensive: re-validate stored envelope on every render (in case shape drift).
  const envelope = useMemo(() => {
    if (!stored || typeof stored !== 'object') return null
    if (stored.kind !== 'sporeus-elite-program-share') return null
    if (stored.v !== 1 && stored.v !== 2) return null
    if (!stored.athleteSnapshot || !Array.isArray(stored.phases)) return null
    return stored
  }, [stored])

  // ── Empty mode ───────────────────────────────────────────────────────────
  if (!envelope) {
    const ingestDisabled = textValue.trim().length === 0
    const errMsg = errorCode ? COACH_SHARE_ERRORS[errorCode]?.[isTR ? 'tr' : 'en'] : null
    return (
      <div className="sp-card" role="region" aria-label={ariaLabel} data-coach-athlete-program="empty"
        style={cardBase}>
        <div style={S.cardTitle}>
          {titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub, var(--muted))', lineHeight: 1.6, marginBottom: '12px' }}>
          {isTR
            ? 'Sporcunun plan özetini buraya yapıştır veya JSON dosyasını yükle.'
            : "Paste the athlete's plan summary here, or upload the JSON file."}
        </div>
        <textarea
          aria-label={isTR ? 'Plan özeti JSON' : 'Plan summary JSON'}
          value={textValue}
          onChange={e => { setTextValue(e.target.value); if (errorCode) setErrorCode(null) }}
          rows={6}
          placeholder='{"v":1,"kind":"sporeus-elite-program-share",...}'
          style={{ ...S.input, fontSize: '11px', minHeight: '120px', resize: 'vertical', width: '100%', marginBottom: '8px' }}
        />
        {errMsg ? (
          <div role="alert" data-coach-share-error={errorCode}
            style={{ ...S.mono, fontSize: '11px', color: '#fff', background: '#dc3545', padding: '6px 10px', borderRadius: '3px', marginBottom: '8px' }}>
            {errMsg}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button"
            disabled={ingestDisabled}
            onClick={handleIngest}
            data-coach-ingest-btn
            aria-label={isTR ? 'Plan özetini içe aktar' : 'Ingest plan summary'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', padding: '8px 14px', background: ingestDisabled ? '#0064ff55' : '#0064ff', color: '#fff', border: 'none', borderRadius: '3px', cursor: ingestDisabled ? 'not-allowed' : 'pointer', minHeight: '36px' }}>
            {isTR ? 'İÇE AKTAR' : 'INGEST'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'INGEST' : 'İÇE AKTAR'}
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json"
            onChange={handleFile}
            aria-label={isTR ? 'JSON dosyası yükle' : 'Upload JSON file'}
            style={{ ...S.mono, fontSize: '10px', color: 'var(--text)' }}
          />
        </div>
      </div>
    )
  }

  // ── Loaded mode ──────────────────────────────────────────────────────────
  const snap = envelope.athleteSnapshot || {}
  const sport = snap.sport || 'run'
  const sportLbl = SPORT_LABEL[sport]?.[isTR ? 'tr' : 'en'] || (sport || '').toUpperCase()
  const band = snap.feasibilityBand
  const bandColor = BAND_COLOR[band] || '#0064ff'
  const bandLbl = BAND_LABEL[band]?.[isTR ? 'tr' : 'en'] || (band || '').toUpperCase()
  const lifecycle = envelope.lifecycle
  const lcColor = lifecycle?.state ? LIFECYCLE_COLOR[lifecycle.state] : null
  const lcLbl = lifecycle?.state ? (LIFECYCLE_LABEL[lifecycle.state]?.[isTR ? 'tr' : 'en'] || lifecycle.state.toUpperCase()) : null
  const showPct = lifecycle && typeof lifecycle.percentComplete === 'number'
    && lifecycle.percentComplete > 5 && lifecycle.percentComplete < 95
  const synthetic = envelope.synthetic
  const phases = Array.isArray(envelope.phases) ? envelope.phases : []
  const accent = bandColor

  return (
    <div className="sp-card" role="region" aria-label={ariaLabel} data-coach-athlete-program="loaded"
      style={{ ...cardBase, borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          {titleEN}<span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>{titleTR}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button"
            onClick={() => setEditMode(m => !m)}
            data-coach-edit-toggle
            aria-pressed={editMode}
            aria-label={isTR ? 'Düzenleme modu' : 'Edit mode'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: editMode ? '#ff6600' : 'transparent', color: editMode ? '#fff' : '#ff6600', border: '1px solid #ff6600', borderRadius: '3px', cursor: 'pointer', minHeight: '32px' }}>
            {editMode ? (isTR ? '✓ DÜZENLE' : '✓ EDIT') : (isTR ? 'DÜZENLE' : 'EDIT')}
          </button>
          <button type="button"
            onClick={handleClear}
            data-coach-clear-btn
            aria-label={isTR ? 'Sporcu programını temizle' : 'Clear athlete program'}
            style={{ ...S.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', color: '#ff6600', border: '1px solid #ff6600', borderRadius: '3px', cursor: 'pointer', minHeight: '32px' }}>
            {isTR ? 'TEMİZLE' : 'CLEAR'}<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>{isTR ? 'CLEAR' : 'TEMİZLE'}
          </button>
        </div>
      </div>

      {/* Lifecycle pill (if present) */}
      {lcLbl ? (
        <div role="status" data-coach-lifecycle={lifecycle.state}
          aria-label={isTR ? `Plan durumu: ${lcLbl}` : `Plan status: ${lcLbl}`}
          style={{ display: 'inline-block', ...S.mono, fontSize: '10px', fontWeight: 700, color: '#fff', background: lcColor || '#888', padding: '3px 8px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '6px', marginRight: '6px' }}>
          {lcLbl}{showPct ? ` · ${lifecycle.percentComplete}%` : ''}
        </div>
      ) : null}

      {/* Feasibility band pill */}
      {band ? (
        <div data-coach-band={band}
          aria-label={isTR ? `Fizibilite: ${bandLbl}` : `Feasibility: ${bandLbl}`}
          style={{ display: 'inline-block', ...S.mono, fontSize: '11px', fontWeight: 700, color: '#fff', background: bandColor, padding: '4px 10px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '8px', marginRight: '6px' }}>
          {bandLbl}
        </div>
      ) : null}

      {/* Synthetic auto-derived badge */}
      {synthetic ? (
        <div data-coach-synthetic-badge
          aria-label={isTR ? 'Otomatik türetilmiş' : 'Auto-derived'}
          style={{ display: 'inline-block', ...S.mono, fontSize: '10px', fontWeight: 700, color: '#fff', background: '#9966cc', padding: '3px 8px', borderRadius: '3px', letterSpacing: '0.08em', marginBottom: '8px', marginRight: '6px' }}>
          {isTR ? 'OTOMATİK TÜRETİLMİŞ' : 'AUTO-DERIVED'}
          <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
          {isTR ? 'AUTO-DERIVED' : 'OTOMATİK TÜRETİLMİŞ'}
        </div>
      ) : null}

      {/* Snapshot block: sport + currentTime → targetTime + raceDate */}
      <div data-coach-snapshot
        style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}>
        <div style={{ flex: '1 1 100px' }}>
          <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }} data-coach-sport={sport}>{sportLbl}</div>
          <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
            {isTR ? 'SPOR' : 'SPORT'}
          </div>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
            <span data-coach-current-time>{fmtSec(snap.currentTime)}</span>
            <span aria-hidden="true" style={{ margin: '0 4px' }}>→</span>
            <span data-coach-target-time>{fmtSec(snap.targetTime)}</span>
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
            {isTR ? 'MEVCUT → HEDEF' : 'CURRENT → TARGET'}
          </div>
        </div>
        <div style={{ flex: '1 1 100px' }}>
          <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }} data-coach-race-date>
            {snap.raceDate || '—'}
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
            {isTR ? 'YARIŞ TARİHİ' : 'RACE DATE'}
          </div>
        </div>
        {snap.weeksAvailable != null ? (
          <div style={{ flex: '1 1 80px' }}>
            <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              {snap.weeksAvailable}{isTR ? 'h' : 'w'}
            </div>
            <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
              {isTR ? 'MEVCUT' : 'AVAILABLE'}
            </div>
          </div>
        ) : null}
      </div>

      <PhysiologyBlock sport={sport} physiology={envelope.physiology} isTR={isTR} />

      {phases.length > 0 ? <PhaseSplitBar phases={phases} isTR={isTR} /> : null}

      {envelope.citation ? (
        <div data-coach-citation
          style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
          {envelope.citation}
          {envelope.generatedAt ? (
            <span style={{ marginLeft: '8px' }}>· {isTR ? 'oluşturuldu' : 'generated'} {envelope.generatedAt}</span>
          ) : null}
        </div>
      ) : null}

      {editMode ? (
        <CoachEditPanel
          envelope={envelope}
          edits={pendingEdits}
          onChange={setPendingEdits}
          isTR={isTR}
        />
      ) : null}
    </div>
  )
}
