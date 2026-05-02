// ─── src/components/PlanTemplatePicker.jsx ────────────────────────────────────
// Quick-start preset picker. Surfaces preconfigured plans (5K / 10K / Half /
// Marathon / Base Building / 2k Row / Endurance Block) as a card grid that
// loads a full plan into localStorage with one click.
//
// The presets feed into the same E13 adaptive `generatePlan` lib that the
// manual PlanGenerator uses; output is adapted to the legacy week-card shape
// via `adaptE13PlanToLegacy` so existing UI keeps rendering it. The picker
// writes to the SAME localStorage key (`sporeus-plan`) PlanGenerator owns.

import { useContext, useState } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { generatePlan, SESSION_INTENTS } from '../lib/plan/generatePlan.js'
import { calcLoad } from '../lib/formulas.js'
import { ZONE_COLORS } from '../lib/constants.js'
import { announce } from '../lib/a11y/announcer.js'
import ConfirmModal from './ui/ConfirmModal.jsx'

// ─── Adapter (duplicated from PlanGenerator.jsx) ─────────────────────────────
// Maps E13 adaptive plan output → legacy week-card shape so the existing
// week-card UI keeps rendering. Mirrors PlanGenerator's `adaptE13PlanToLegacy`.
const E13_ZONE_INDEX = { Z1: 0, Z2: 1, Z3: 2, Z4: 3, Z5: 4 }
const E13_ZONE_COLOR = (z) => ZONE_COLORS[E13_ZONE_INDEX[z] ?? 1]
function adaptE13PlanToLegacy(adaptivePlan, lang = 'en') {
  if (!adaptivePlan || !Array.isArray(adaptivePlan.weeks)) return null
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  return adaptivePlan.weeks.map(wk => {
    const sessions = wk.sessions.map((s) => {
      const lbl = SESSION_INTENTS[s.intent]
      const typeName = lbl ? (lang === 'tr' ? lbl.tr : lbl.en) : s.intent
      const rpeMid = (s.rpeLow + s.rpeHigh) / 2
      const intensityFactor = Math.max(0.5, rpeMid / 10)
      const duration = s.intent === 'rest'
        ? 0
        : Math.max(20, Math.round(s.targetTSS / (intensityFactor * intensityFactor) * 0.6))
      return {
        day:         dayNames[(s.day - 1) % 7] || dayNames[0],
        type:        typeName,
        duration,
        rpe:         rpeMid,
        tss:         s.targetTSS,
        zone:        s.zone === 'Z0' ? '—' : s.zone,
        color:       E13_ZONE_COLOR(s.zone),
        description: '',
      }
    })
    const zd = wk.zoneDistribution || {}
    const zonePct = ['Z1','Z2','Z3','Z4','Z5'].map(z => Math.round((zd[z] || 0) * 100))
    return {
      week:       wk.weekNum,
      phase:      wk.phase,
      sessions,
      totalHours: ((wk.weeklyTSS / 60) * 0.9).toFixed(1),
      tss:        wk.weeklyTSS,
      zonePct,
      isDeload:   wk.isDeload || false,
    }
  })
}

// ─── Preset definitions ─────────────────────────────────────────────────────
// Each preset maps to a generatePlan() call. `goal` is the legacy display
// string we put on `plan.goal` (e.g. "5K"); `genGoal` is the E13 goal key.
export const PLAN_TEMPLATE_PRESETS = [
  {
    id:           '5k',
    sport:        'running',
    goal:         '5K',
    genGoal:      'pr',
    weeksToRace:  8,
    availableDays: 4,
    model:        'polarized',
    level:        'intermediate',
    name:         { en: '5K Race',           tr: '5K Yarış' },
    focus:        { en: 'Speed + VO2max',    tr: 'Hız + VO2max' },
    desc:         {
      en: '8-week sharpening block for a 5K. Polarized: easy mileage + hard intervals.',
      tr: '5K için 8 haftalık keskinleştirme bloğu. Polarize: kolay tempo + sert interval.',
    },
  },
  {
    id:           '10k',
    sport:        'running',
    goal:         '10K',
    genGoal:      'pr',
    weeksToRace:  10,
    availableDays: 4,
    model:        'polarized',
    level:        'intermediate',
    name:         { en: '10K Race',          tr: '10K Yarış' },
    focus:        { en: 'Threshold + VO2',   tr: 'Eşik + VO2' },
    desc:         {
      en: '10-week polarized 10K plan. Long runs, threshold reps, race-pace finishers.',
      tr: '10 haftalık polarize 10K planı. Uzun koşular, eşik tekrarları ve yarış-temposu bitişler.',
    },
  },
  {
    id:           'half',
    sport:        'running',
    goal:         'Half Marathon',
    genGoal:      'pr',
    weeksToRace:  12,
    availableDays: 5,
    model:        'traditional',
    level:        'intermediate',
    name:         { en: 'Half Marathon',     tr: 'Yarı Maraton' },
    focus:        { en: 'Aerobic + tempo',   tr: 'Aerobik + tempo' },
    desc:         {
      en: '12-week traditional periodization to a 21.1 km race. Build → peak → taper.',
      tr: '21.1 km yarışa 12 haftalık geleneksel periyodizasyon. Yapı → zirve → taper.',
    },
  },
  {
    id:           'marathon',
    sport:        'running',
    goal:         'Marathon',
    genGoal:      'pr',
    weeksToRace:  16,
    availableDays: 5,
    model:        'traditional',
    level:        'intermediate',
    name:         { en: 'Marathon',          tr: 'Maraton' },
    focus:        { en: 'Long runs + MP',    tr: 'Uzun koşu + MP' },
    desc:         {
      en: '16-week marathon build. Progressive long runs, marathon-pace tempo, 3-week taper.',
      tr: '16 haftalık maraton hazırlığı. Artan uzun koşular, maraton tempo, 3 haftalık taper.',
    },
  },
  {
    id:           'base',
    sport:        'running',
    goal:         'Base Building',
    genGoal:      'fitness',
    weeksToRace:  8,
    availableDays: 5,
    model:        'traditional',
    level:        'intermediate',
    name:         { en: 'Base Building',     tr: 'Temel Yapı' },
    focus:        { en: 'Aerobic base',      tr: 'Aerobik temel' },
    desc:         {
      en: '8-week aerobic base block. Easy mileage, gradual progression, no hard intervals.',
      tr: '8 haftalık aerobik temel blok. Kolay tempo, kademeli artış, sert interval yok.',
    },
  },
  {
    id:           'row2k',
    sport:        'rowing',
    goal:         '2000m Row',
    genGoal:      'pr',
    weeksToRace:  12,
    availableDays: 5,
    model:        'traditional',
    level:        'intermediate',
    name:         { en: '2000m Row',         tr: '2000m Kürek' },
    focus:        { en: 'AT + race pace',    tr: 'AT + yarış tempo' },
    desc:         {
      en: '12-week build for a 2k erg/row. Threshold pieces, race-pace intervals, taper.',
      tr: '2k erg/kürek için 12 haftalık hazırlık. Eşik parçaları, yarış-tempo intervalleri, taper.',
    },
  },
  {
    id:           'rowblock',
    sport:        'rowing',
    goal:         'Endurance Block',
    genGoal:      'fitness',
    weeksToRace:  8,
    availableDays: 5,
    model:        'block',
    level:        'intermediate',
    name:         { en: 'Endurance Block',   tr: 'Dayanıklılık Bloğu' },
    focus:        { en: 'UT2 volume',        tr: 'UT2 hacim' },
    desc:         {
      en: '8-week block-periodized endurance push. Concentrated aerobic loads.',
      tr: '8 haftalık blok-periyodize dayanıklılık bloğu. Yoğunlaştırılmış aerobik yükler.',
    },
  },
]

// localStorage key MUST match PlanGenerator's `useLocalStorage('sporeus-plan',...)`
const PLAN_STORAGE_KEY = 'sporeus-plan'

export default function PlanTemplatePicker({ presets = PLAN_TEMPLATE_PRESETS }) {
  const { lang: ctxLang } = useContext(LangCtx)
  const [lang] = useLocalStorage('sporeus-lang', ctxLang || 'en')
  const [, setPlan] = useLocalStorage(PLAN_STORAGE_KEY, null)
  const { log } = useData() || { log: [] }
  const [pending, setPending] = useState(null)  // preset awaiting confirmation

  const tr = (en, tr) => (lang === 'tr' ? tr : en)

  const today = new Date().toISOString().slice(0,10)

  function onCardClick(preset) {
    setPending(preset)
  }

  function onCancel() {
    setPending(null)
  }

  function onConfirm() {
    const preset = pending
    if (!preset) return
    const ctlNow = calcLoad(log)?.ctl ?? 0
    const currentCTL = Math.max(20, ctlNow)
    const adaptive = generatePlan({
      goal:          preset.genGoal,
      currentCTL,
      weeksToRace:   preset.weeksToRace,
      availableDays: preset.availableDays,
      model:         preset.model,
      level:         preset.level,
    })
    const legacyWeeks = adaptE13PlanToLegacy(adaptive, lang) || []
    const planObj = {
      goal:        preset.goal,
      weeks:       legacyWeeks,
      generatedAt: today,
      level:       preset.level.charAt(0).toUpperCase() + preset.level.slice(1),
      hoursPerWeek: Math.max(3, Math.round(preset.availableDays * 1.5)),
      isAdaptive:  true,
      fromTemplate: preset.id,
      adaptiveMeta: adaptive ? { model: adaptive.model } : null,
    }
    setPlan(planObj)

    const presetName = lang === 'tr' ? preset.name.tr : preset.name.en
    announce(
      lang === 'tr' ? `Plan yüklendi: ${presetName}` : `Plan loaded: ${presetName}`,
      'polite',
    )
    // Window event so other components can react if desired
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('sporeus:plan-loaded', {
          detail: { presetId: preset.id, plan: planObj },
        }))
      } catch (_) { /* CustomEvent may be unavailable in some test envs */ }
    }
    setPending(null)
  }

  // Empty / defensive state
  if (!Array.isArray(presets) || presets.length === 0) {
    return (
      <div className="sp-card" style={{ ...S.card }} data-testid="plan-template-picker-empty">
        <div style={S.cardTitle}>
          {tr('Quick start templates', 'Hızlı başlangıç şablonları')}
        </div>
        <div style={{ ...S.mono, fontSize:'11px', color:'var(--muted)' }}>
          {tr('No templates available.', 'Şablon bulunamadı.')}
        </div>
      </div>
    )
  }

  const sportColor = (sport) => sport === 'rowing' ? '#0064ff' : '#ff6600'

  return (
    <div className="sp-card" style={{ ...S.card }} data-testid="plan-template-picker">
      <div style={S.cardTitle}>
        {tr('Quick start templates', 'Hızlı başlangıç şablonları')}
      </div>
      <div
        role="list"
        aria-label={tr('Plan templates', 'Plan şablonları')}
        style={{
          display:        'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
          gap:            '10px',
          overflowX:      'auto',
        }}
      >
        {presets.map(preset => {
          const name  = lang === 'tr' ? preset.name.tr  : preset.name.en
          const focus = lang === 'tr' ? preset.focus.tr : preset.focus.en
          const desc  = lang === 'tr' ? preset.desc.tr  : preset.desc.en
          const accent = sportColor(preset.sport)
          const ariaLabel = lang === 'tr'
            ? `${name}: ${preset.weeksToRace} hafta, haftada ${preset.availableDays} gün`
            : `${name}: ${preset.weeksToRace} weeks, ${preset.availableDays} days/week`
          return (
            <div
              key={preset.id}
              role="listitem"
              aria-label={ariaLabel}
              data-testid={`preset-card-${preset.id}`}
              style={{
                background:   'var(--card-bg)',
                border:       '1px solid var(--border)',
                borderLeft:   `3px solid ${accent}`,
                borderRadius: '5px',
                padding:      '10px 12px',
                minWidth:     '180px',
                maxWidth:     '220px',
                minHeight:    '140px',
                display:      'flex',
                flexDirection: 'column',
                gap:          '4px',
              }}
            >
              <div style={{ ...S.mono, fontSize:'12px', fontWeight:700, color: accent }}>
                {name}
              </div>
              <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)' }}>
                {focus}
              </div>
              <div style={{ display:'flex', gap:'8px', ...S.mono, fontSize:'10px', color:'var(--muted)' }}>
                <span>
                  {preset.weeksToRace} {tr('wk', 'hf')}
                </span>
                <span>·</span>
                <span>
                  {preset.availableDays} {tr('d/wk', 'g/hf')}
                </span>
              </div>
              <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', lineHeight:1.5, flex:1, marginTop:'4px' }}>
                {desc}
              </div>
              <button
                type="button"
                onClick={() => onCardClick(preset)}
                aria-label={lang === 'tr'
                  ? `${name} planını kullan`
                  : `Use ${name} plan`}
                style={{
                  ...S.mono,
                  fontSize:    '10px',
                  fontWeight:  700,
                  padding:     '6px 10px',
                  marginTop:   '6px',
                  background:  'transparent',
                  color:       accent,
                  border:      `1px solid ${accent}`,
                  borderRadius: '3px',
                  cursor:      'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                {tr('Use this plan', 'Bu planı kullan')}
              </button>
            </div>
          )
        })}
      </div>

      <ConfirmModal
        open={!!pending}
        title={tr('Replace current plan?', 'Mevcut plan değiştirilsin mi?')}
        body={tr(
          'This will replace your current plan. Continue?',
          'Bu mevcut planınızı değiştirecek. Devam edilsin mi?',
        )}
        confirmLabel={tr('Use this plan', 'Bu planı kullan')}
        cancelLabel={tr('Cancel', 'İptal')}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </div>
  )
}
