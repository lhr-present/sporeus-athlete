// ─── PhaseTransitionPeek.jsx — TodayView phase-transition heads-up ─────────
//
// Surfaces a one-time banner the FIRST week the athlete crosses into a new
// periodization phase (Base→Build, Build→Peak, Peak→Taper, etc.). Reads the
// same `multiPeakSeason` data shape TodayView already consumes for its
// season peek. Self-gates — the parent does not need conditional logic.
//
// EN:  → PHASE TRANSITION · Base → Build · expect +15% TSS, more intensity
// TR:  → FAZ GEÇİŞİ · Yapılanma → İnşa · +%15 TSS, daha yüksek yoğunluk
//
// Dismissal: clicking DISMISS writes the active "From→To" pair to
// localStorage under `sporeus-phaseTransitionDismissed`. The banner stays
// hidden until the next transition (a different pair) shows up.
//
// Scientific grounding: Bompa 2009; Issurin 2010; Mujika 2003.
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { detectPhaseTransition } from '../../lib/athlete/phaseTransition.js'

const MONO = "'IBM Plex Mono', monospace"

// Bloomberg-terminal swatch matched to neighbouring TodayView peeks.
const S = {
  wrap: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--text, #ccc)',
    padding: '6px 10px',
    background: 'var(--surface, #0d1322)',
    border: '1px solid #0064ff',
    borderRadius: 4,
    marginBottom: 8,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  prefix: {
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#0064ff',
  },
  divider: { color: 'var(--muted, #666)' },
  fromTo: {
    color: 'var(--text, #ddd)',
    fontVariantNumeric: 'tabular-nums',
  },
  arrow: {
    color: '#0064ff',
    fontWeight: 700,
  },
  delta: {
    color: '#ff6600',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  hint: {
    color: 'var(--muted, #888)',
    fontStyle: 'italic',
  },
  dismiss: {
    marginLeft: 'auto',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: '0.08em',
    color: 'var(--muted, #888)',
    background: 'transparent',
    border: '1px solid var(--border, #333)',
    borderRadius: 3,
    padding: '2px 8px',
    cursor: 'pointer',
  },
}

// Bilingual phase labels. Keep the EN keys as the canonical source —
// detectPhaseTransition emits the EN strings; we localise here at the
// render boundary so the pure fn stays language-agnostic.
const PHASE_LABEL = {
  en: {
    Base: 'Base', Build: 'Build', Peak: 'Peak', Taper: 'Taper',
    Race: 'Race', Recovery: 'Recovery', Maintenance: 'Maintenance',
  },
  tr: {
    Base: 'Yapılanma', Build: 'İnşa', Peak: 'Zirve', Taper: 'Açılma',
    Race: 'Yarış', Recovery: 'Toparlanma', Maintenance: 'Koruma',
  },
}

// Bilingual hint strings keyed by the delta label produced by the pure fn.
const HINT = {
  en: {
    '+15%': 'expect +15% TSS, more intensity',
    '+10%': 'expect +10% TSS, race-specific work',
    '-30%': 'expect −30% volume, intensity preserved',
    'race-day': 'race week — taper into A-day',
    'recovery': 'recovery week — low volume, full rest',
    'new cycle': 'new cycle — rebuild aerobic base',
    'see plan': 'see plan for week details',
  },
  tr: {
    '+15%': '+%15 TSS, daha yüksek yoğunluk',
    '+10%': '+%10 TSS, yarışa özgü iş',
    '-30%': '−%30 hacim, yoğunluk korunur',
    'race-day': 'yarış haftası — A-güne açılma',
    'recovery': 'toparlanma haftası — düşük hacim',
    'new cycle': 'yeni döngü — aerobik taban',
    'see plan': 'haftalık detay için plana bakın',
  },
}

const DISMISS_KEY = 'sporeus-phaseTransitionDismissed'

export default function PhaseTransitionPeek({ multiPeakSeason, today }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const [dismissedPair, setDismissedPair] = useLocalStorage(DISMISS_KEY, '')

  const res = detectPhaseTransition({ multiPeakSeason, today })
  if (!res) return null
  if (!res.isTransition) return null

  const pairKey = `${res.fromPhase}→${res.toPhase}`
  if (dismissedPair === pairKey) return null

  const isTR = lang === 'tr'
  const prefixLabel = isTR ? 'FAZ GEÇİŞİ' : 'PHASE TRANSITION'
  const dismissLabel = isTR ? 'KAPAT' : 'DISMISS'
  const labels = PHASE_LABEL[isTR ? 'tr' : 'en']
  const fromLabel = labels[res.fromPhase] || res.fromPhase
  const toLabel = labels[res.toPhase] || res.toPhase
  const hint = (HINT[isTR ? 'tr' : 'en'] || HINT.en)[res.expectedTssDelta]
    || res.expectedTssDelta

  return (
    <div
      role="status"
      aria-label={isTR ? 'Faz geçişi bildirimi' : 'Phase transition notice'}
      data-phase-transition-peek="active"
      data-from-phase={res.fromPhase}
      data-to-phase={res.toPhase}
      style={S.wrap}
    >
      <span style={S.arrow} aria-hidden="true">→</span>
      <span style={S.prefix}>{prefixLabel}</span>
      <span style={S.divider}>·</span>
      <span style={S.fromTo}>
        {fromLabel} <span style={S.arrow}>→</span> {toLabel}
      </span>
      <span style={S.divider}>·</span>
      <span style={S.delta}>{res.expectedTssDelta}</span>
      <span style={S.hint}>· {hint}</span>
      <button
        type="button"
        style={S.dismiss}
        onClick={() => setDismissedPair(pairKey)}
        aria-label={dismissLabel}
      >
        {dismissLabel}
      </button>
    </div>
  )
}
