// ─── dashboard/NutritionTimingCard.jsx — E126: Pre/During/Post fueling card ──
// Surfaces fueling targets for TODAY's planned session (or most recent logged
// session if today is a rest day) using computeNutritionTiming(). Unlike the
// historical-load FuelGuidanceCard, this card answers: "what should I eat
// before / during / after this specific session?"
// Citation: Burke 2014; Jeukendrup 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeNutritionTiming } from '../../lib/athlete/nutritionTiming.js'
import { getTodayPlannedSession } from '../../lib/intelligence.js'

// ─── Map a session.type string to a computeNutritionTiming intent ────────────
function mapTypeToIntent(typeRaw) {
  const t = String(typeRaw || '').toLowerCase()
  if (/recovery|easy/.test(t)) return 'recovery'
  if (/long/.test(t))          return 'long'
  if (/tempo/.test(t))         return 'tempo'
  if (/interval|vo2|threshold|hard/.test(t)) return 'intervals'
  return 'steady'
}

// ─── Pick the session to fuel for ────────────────────────────────────────────
// 1. If a saved plan has today's session → use it
// 2. Otherwise fall back to the most recent log entry (so post-workout view
//    still works on rest days)
// 3. Otherwise → null
function pickSession(plan, log) {
  const today = new Date().toISOString().slice(0, 10)
  const planned = plan ? getTodayPlannedSession(plan, today) : null
  if (planned && planned.type && planned.duration > 0) {
    return { type: planned.type, duration: planned.duration, source: 'plan' }
  }
  if (Array.isArray(log) && log.length) {
    const sorted = [...log].filter(e => e && e.date).sort((a, b) => (a.date < b.date ? 1 : -1))
    const recent = sorted[0]
    if (recent && recent.type && (recent.duration || 0) > 0) {
      return { type: recent.type, duration: recent.duration, source: 'log' }
    }
  }
  return null
}

export default function NutritionTimingCard({ profile = {}, plan = null, log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  // ─── Resolve session ─────────────────────────────────────────────────────
  const session = useMemo(() => pickSession(plan, log), [plan, log])

  // ─── Validate weight ─────────────────────────────────────────────────────
  const weightKg = useMemo(() => {
    const w = parseFloat(profile?.weight)
    return Number.isFinite(w) && w > 0 ? w : null
  }, [profile?.weight])

  // ─── Compute targets ─────────────────────────────────────────────────────
  const result = useMemo(() => {
    if (!session || !weightKg) return null
    return computeNutritionTiming({
      intent:      mapTypeToIntent(session.type),
      durationMin: Number(session.duration),
      weightKg,
      heatStress:  false,
    })
  }, [session, weightKg])

  // ─── Empty state: no session at all ──────────────────────────────────────
  if (!session) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Bugün için beslenme zamanlaması' : 'Nutrition timing for today'}
        style={{ ...S.card, animationDelay: '34ms' }}
      >
        <div style={S.cardTitle}>{isTR ? 'BESLENME — BUGÜN' : 'FUELING — TODAY'}</div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', lineHeight: 1.5 }}>
          {isTR
            ? 'Bugün seans yok — yakıt hedeflerini görmek için plan veya seans gir'
            : 'No session today — set a plan or log one to see fueling targets'}
        </div>
      </div>
    )
  }

  // ─── Weight-missing prompt ───────────────────────────────────────────────
  if (!weightKg || !result) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Bugün için beslenme zamanlaması' : 'Nutrition timing for today'}
        style={{ ...S.card, animationDelay: '34ms' }}
      >
        <div style={S.cardTitle}>{isTR ? 'BESLENME — BUGÜN' : 'FUELING — TODAY'}</div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', lineHeight: 1.5 }}>
          {isTR
            ? 'Beslenme hedeflerini görmek için profile kilo ekle'
            : 'Add weight to profile to see nutrition targets'}
        </div>
      </div>
    )
  }

  // ─── Compose section data ────────────────────────────────────────────────
  const sections = [
    {
      key:   'pre',
      label: { en: 'PRE',    tr: 'ÖNCE' },
      aria:  { en: 'Pre-workout fueling',    tr: 'Antrenman öncesi beslenme' },
      lines: [
        { val: `${result.pre.carbGrams.mid}g`,  unit: isTR ? 'karb' : 'carb' },
        { val: `${result.pre.fluidMl}ml`,       unit: isTR ? 'sıvı' : 'fluid' },
      ],
      note:  result.pre.note[isTR ? 'tr' : 'en'],
    },
    {
      key:   'during',
      label: { en: 'DURING', tr: 'SIRADA' },
      aria:  { en: 'During-workout fueling', tr: 'Antrenman sırası beslenme' },
      lines: result.during.carbGramsPerHour
        ? [
            { val: `${result.during.carbGramsPerHour.mid}g/h`, unit: isTR ? 'karb' : 'carb' },
            { val: `${result.during.fluidMlPerHour}ml/h`,      unit: isTR ? 'sıvı' : 'fluid' },
          ]
        : [
            { val: `${result.during.fluidMlPerHour}ml/h`, unit: isTR ? 'sıvı' : 'fluid' },
          ],
      note:  result.during.note[isTR ? 'tr' : 'en'],
    },
    {
      key:   'post',
      label: { en: 'POST',   tr: 'SONRA' },
      aria:  { en: 'Post-workout fueling',   tr: 'Antrenman sonrası beslenme' },
      lines: [
        { val: `${result.post.carbGrams}g`,    unit: isTR ? 'karb' : 'carb' },
        { val: `${result.post.proteinGrams}g`, unit: isTR ? 'protein' : 'protein' },
      ],
      note:  result.post.note[isTR ? 'tr' : 'en'],
    },
  ]

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Bugün için beslenme zamanlaması' : 'Nutrition timing for today'}
      style={{ ...S.card, animationDelay: '34ms' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={S.cardTitle}>{isTR ? 'BESLENME — BUGÜN' : 'FUELING — TODAY'}</div>
        <span style={{ ...S.mono, fontSize: '9px', color: '#555' }}>
          {session.type} · {session.duration}min
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        {sections.map(sec => (
          <div
            key={sec.key}
            role="group"
            aria-label={isTR ? sec.aria.tr : sec.aria.en}
            style={{
              flex: '1 1 140px', background: 'var(--surface)',
              borderRadius: '3px', padding: '8px 10px',
              borderLeft: '3px solid #ff6600',
            }}
          >
            <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginBottom: '4px', letterSpacing: '0.08em' }}>
              {isTR ? sec.label.tr : sec.label.en}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              {sec.lines.map((line, i) => (
                <div key={i} style={{ ...S.mono }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                    {line.val}
                  </span>
                  <span style={{ fontSize: '9px', color: '#888', marginLeft: '3px' }}>
                    {line.unit}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ ...S.mono, fontSize: '9px', color: '#666', lineHeight: 1.4 }}>
              {sec.note}
            </div>
          </div>
        ))}
      </div>

      <div
        aria-live="polite"
        style={{ ...S.mono, fontSize: '10px', color: '#aaa', borderTop: '1px solid var(--border)', paddingTop: '6px' }}
      >
        {isTR
          ? `Toplam: ~${result.total.carbGrams}g karb · ${result.total.fluidMl}ml sıvı`
          : `Total: ~${result.total.carbGrams}g carb · ${result.total.fluidMl}ml fluid`}
      </div>

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '6px' }}>
        {result.citation}
      </div>
    </div>
  )
}
