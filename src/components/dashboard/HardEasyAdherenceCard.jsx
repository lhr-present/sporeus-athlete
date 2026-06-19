// ─── HardEasyAdherenceCard.jsx ──────────────────────────────────────────────
// Surfaces analyzeHardEasyAdherence (Daniels 2014; Foster 2001) — what % of
// the last 12 ISO weeks were "clean" (zero hard-after-hard adjacencies) given
// the athlete actually did hard work (≥2 hard days that week).
//
// Distinct from HardDaySpacingCard, which tracks mean spacing intervals.
// This card answers: "are you obeying the no-two-hard-days-in-a-row rule?"
//
// Render rule: returns null when the analyzer returns null (no meaningful
// weeks in the window). Otherwise renders for all four bands.
//
// Bilingual EN/TR via LangCtx.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  analyzeHardEasyAdherence,
  HARD_EASY_ADHERENCE_CITATION,
} from '../../lib/athlete/hardEasyAdherence.js'

const MONO = "'IBM Plex Mono', monospace"
const BAR_AREA_HEIGHT = 36

const BAND_COLOR = {
  STRICT:                 '#5bc25b', // green
  GOOD:                   '#88c070', // soft green
  OCCASIONAL_VIOLATIONS:  '#f5c542', // amber
  CHRONIC_VIOLATIONS:     '#e03030', // red
}

const BAND_LABEL_EN = {
  STRICT:                 'STRICT',
  GOOD:                   'GOOD',
  OCCASIONAL_VIOLATIONS:  'OCCASIONAL',
  CHRONIC_VIOLATIONS:     'CHRONIC',
}
const BAND_LABEL_TR = {
  STRICT:                 'KATI',
  GOOD:                   'İYİ',
  OCCASIONAL_VIOLATIONS:  'ARA SIRA',
  CHRONIC_VIOLATIONS:     'KRONİK',
}

const HINT_EN = {
  STRICT:
    "Excellent hard/easy discipline — virtually every week respects Daniels' no-two-hard-days rule.",
  GOOD:
    'Good adherence to the hard/easy rule. Most weeks are clean; isolated back-to-back hard days are tolerable.',
  OCCASIONAL_VIOLATIONS:
    'Hard-after-hard adjacencies appearing regularly. Insert an easy or rest day between quality sessions to protect recovery.',
  CHRONIC_VIOLATIONS:
    'Chronic violations of the hard/easy rule — back-to-back hard days are the norm. Restructure: never two quality days in a row.',
}
const HINT_TR = {
  STRICT:
    "Mükemmel sert/kolay disiplini — neredeyse her hafta Daniels'in iki-sert-gün-üst-üste-olmaz kuralına uyuyor.",
  GOOD:
    'Sert/kolay kuralına iyi uyum. Çoğu hafta temiz; arada bir ardışık sert günler kabul edilebilir.',
  OCCASIONAL_VIOLATIONS:
    'Ardışık sert günler düzenli olarak görülüyor. Kaliteli seanslar arasına kolay veya dinlenme günü ekleyerek toparlanmayı koru.',
  CHRONIC_VIOLATIONS:
    'Sert/kolay kuralı kronik olarak ihlal ediliyor — ardışık sert günler normalleşmiş. Yeniden yapılandır: iki kaliteli gün üst üste olmasın.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function formatPct(rate) {
  const v = Number(rate)
  if (!Number.isFinite(v)) return '—'
  return `${Math.round(v * 100)}%`
}

function HardEasyAdherenceCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeHardEasyAdherence({ log, today: todayIso(), windowWeeks: 12 }),
    [log]
  )

  if (!result) return null

  const {
    band,
    weeks,
    totalViolations,
    totalHardDays,
    cleanWeeks,
    weeksAnalyzed,
    cleanWeekRate,
    citation,
  } = result

  const color = BAND_COLOR[band] || '#888888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'SERT-KOLAY KURALI · 12H' : 'HARD/EASY RULE · 12W'
  const ariaLabel = isTR
    ? 'Sert-kolay kuralı uyum göstergesi (Daniels 2014; Foster 2001)'
    : 'Hard/easy rule adherence tracker (Daniels 2014; Foster 2001)'

  const ratePct = formatPct(cleanWeekRate)
  const violationsLabel = isTR
    ? `${totalViolations} ihlal · ${totalHardDays} sert gün`
    : `${totalViolations} violation${totalViolations === 1 ? '' : 's'} · ${totalHardDays} hard day${totalHardDays === 1 ? '' : 's'}`
  const denomLabel = isTR
    ? `${cleanWeeks}/${weeksAnalyzed} temiz hafta`
    : `${cleanWeeks}/${weeksAnalyzed} clean week${weeksAnalyzed === 1 ? '' : 's'}`

  const maxHardDays = weeks.reduce((m, w) => Math.max(m, w.hardDays || 0), 0)

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="hard-easy-adherence"
      data-hard-easy-band={band}
      data-clean-week-rate={cleanWeekRate}
      data-total-violations={totalViolations}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
            color: 'var(--text, #ccc)',
          }}>
            {title}
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted, #888)' }}>
              {denomLabel}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginTop: 2 }}>
              {violationsLabel}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-clean-week-rate-display
            style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}
          >
            {ratePct}
          </div>
          <div
            data-hard-easy-band-label
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              color, marginTop: 8,
            }}
          >
            {bandLabel}
          </div>
          {totalViolations > 0 ? (
            <div
              data-violation-badge
              aria-label={isTR ? `${totalViolations} ihlal` : `${totalViolations} violations`}
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '2px 6px',
                fontSize: 10,
                fontWeight: 700,
                color: '#e03030',
                background: '#e0303018',
                border: '1px solid #e0303055',
                borderRadius: 3,
                letterSpacing: '0.04em',
              }}
            >
              {isTR ? `! ${totalViolations}` : `! ${totalViolations}`}
            </div>
          ) : null}
        </div>
      </div>

      {/* 12 mini bars — height = hardDays, dot color = violations */}
      <div
        data-hard-easy-bars
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: BAR_AREA_HEIGHT + 8,
          marginTop: 12,
          marginBottom: 10,
        }}
      >
        {weeks.map((w, i) => {
          const hd = w.hardDays || 0
          const vio = w.violations || 0
          const barH = maxHardDays > 0
            ? Math.max(3, Math.round((hd / maxHardDays) * BAR_AREA_HEIGHT))
            : 3
          const dotColor = vio > 0 ? '#e03030' : '#5bc25b'
          const barColor = hd > 0 ? color : '#888888'
          return (
            <div
              key={`${w.weekStart}-${i}`}
              data-week-bar
              data-week-start={w.weekStart}
              data-week-hard-days={hd}
              data-week-violations={vio}
              title={
                isTR
                  ? `${w.weekStart} · ${hd} sert · ${vio} ihlal`
                  : `${w.weekStart} · ${hd} hard · ${vio} violation${vio === 1 ? '' : 's'}`
              }
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 2,
                height: '100%',
              }}
            >
              <div
                data-week-violation-dot={vio > 0 ? 'true' : 'false'}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: dotColor,
                  border: `1px solid ${dotColor}`,
                }}
              />
              <div
                style={{
                  width: '100%',
                  height: barH,
                  background: hd > 0 ? barColor : `${barColor}55`,
                  border: `1px solid ${barColor}`,
                  borderRadius: 1,
                }}
              />
            </div>
          )
        })}
      </div>

      <div
        data-hard-easy-interpretation
        style={{
          marginTop: 10, padding: '6px 8px',
          background: 'var(--surface, #111)',
          borderLeft: `2px solid ${color}`,
          borderRadius: 4,
          fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
        }}
      >
        {hint}
      </div>

      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation || HARD_EASY_ADHERENCE_CITATION}
      </div>
    </div>
  )
}

export default memo(HardEasyAdherenceCard)
