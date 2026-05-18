// ─── RaceEquipmentChecklistCard.jsx — Race-week gear list (Batch 11) ────────
//
// Surfaces `buildRaceEquipmentChecklist` (pure fn) during race week:
//   - Renders ONLY when the athlete's next race is between 0 and 7 days
//     out. Outside that window the card returns null and disappears.
//   - Items are grouped by category (essentials / clothing / nutrition
//     / weather / transition / recovery). Each category is rendered as
//     a section heading with its items beneath.
//   - Each item is a checkbox + bilingual label. Tap to mark packed.
//     Check state persists to `sporeus-raceEquipmentChecks` localStorage
//     keyed by item id, so the athlete can pack across multiple sessions
//     without losing progress.
//   - Top progress bar: "X of N checked" with a thin gauge.
//
// No coaching logic — athletes own their gear lists in notes apps. This
// is a sport-specific MEMORY JOGGER for race week, grounded in Burke
// 2017 + Mujika 2010 (race-week behavioural preparation principles).
//
// Test anchors:
//   - data-race-equipment-checklist-card
//   - data-days-to-race
//   - data-items-checked / data-items-total
//   - data-item-id (per checkbox row)

import { useContext } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { buildRaceEquipmentChecklist } from '../../lib/athlete/raceEquipmentChecklist.js'

const STORAGE_KEY = 'sporeus-raceEquipmentChecks'
const MONO = "'IBM Plex Mono', monospace"

const CATEGORY_LABEL = {
  essentials:  { en: 'Essentials',   tr: 'Olmazsa olmazlar' },
  clothing:    { en: 'Clothing',     tr: 'Kıyafet' },
  nutrition:   { en: 'Nutrition',    tr: 'Beslenme' },
  weather:     { en: 'Weather',      tr: 'Hava' },
  transition:  { en: 'Transition',   tr: 'Geçiş' },
  recovery:    { en: 'Recovery',     tr: 'Toparlanma' },
}

const ACCENT = '#0064ff'
const SUCCESS = '#5bc25b'

export default function RaceEquipmentChecklistCard({ profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const checklist = buildRaceEquipmentChecklist({ profile })
  const [checks, setChecks] = useLocalStorage(STORAGE_KEY, {})

  if (!checklist) return null

  const { daysToRace, sport, items, citation } = checklist

  const checkedCount = items.reduce((acc, it) => (
    acc + (checks?.[it.id]?.checked ? 1 : 0)
  ), 0)
  const totalCount = items.length
  const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  const toggleItem = (id) => {
    const prev = checks?.[id]?.checked === true
    setChecks({ ...(checks || {}), [id]: { checked: !prev } })
  }

  // Group items by category preserving the item-bank order.
  const grouped = {}
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  }
  const orderedCategories = Object.keys(grouped)

  const title = isTR
    ? `YARIŞ MALZEME · T-${daysToRace} GÜN`
    : `RACE GEAR · T-${daysToRace} DAYS`
  const ariaLabel = isTR ? 'Yarış malzeme listesi' : 'Race equipment checklist'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-race-equipment-checklist-card={sport}
      data-days-to-race={daysToRace}
      data-items-checked={checkedCount}
      data-items-total={totalCount}
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
      <div style={{
        fontSize: 11, letterSpacing: '0.08em', fontWeight: 700,
        color: ACCENT, marginBottom: 4,
      }}>
        ◇ {title} · {sport.toUpperCase()}
      </div>

      <div style={{
        fontSize: 10, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5,
      }}>
        {isTR
          ? `${checkedCount} / ${totalCount} işaretlendi`
          : `${checkedCount} of ${totalCount} checked`}
      </div>

      {/* progress bar */}
      <div
        data-race-equipment-progress
        role="progressbar"
        aria-valuenow={checkedCount}
        aria-valuemin={0}
        aria-valuemax={totalCount}
        style={{
          width: '100%', height: 4, background: '#222',
          borderRadius: 2, overflow: 'hidden', marginBottom: 14,
        }}
      >
        <div
          style={{
            width: `${pct}%`, height: '100%',
            background: pct >= 100 ? SUCCESS : ACCENT,
            transition: 'width 120ms linear',
          }}
        />
      </div>

      {orderedCategories.map(cat => {
        const list = grouped[cat]
        const label = CATEGORY_LABEL[cat]?.[isTR ? 'tr' : 'en'] || cat
        const catChecked = list.filter(i => checks?.[i.id]?.checked).length
        return (
          <div
            key={cat}
            data-race-equipment-category={cat}
            style={{ marginBottom: 12 }}
          >
            <div style={{
              fontSize: 9, letterSpacing: '0.08em', fontWeight: 700,
              color: 'var(--muted)', marginBottom: 6,
              borderBottom: '1px solid var(--border)', paddingBottom: 3,
            }}>
              {label.toUpperCase()} · {catChecked}/{list.length}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {list.map(item => {
                const checked = !!checks?.[item.id]?.checked
                return (
                  <li
                    key={item.id}
                    data-item-id={item.id}
                    data-item-checked={checked ? 'true' : 'false'}
                    style={{
                      fontSize: 11, lineHeight: 1.55, marginBottom: 4,
                    }}
                  >
                    <label style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      cursor: 'pointer',
                      color: checked ? SUCCESS : 'var(--text)',
                    }}>
                      <input
                        type="checkbox"
                        aria-label={isTR ? item.label.tr : item.label.en}
                        checked={checked}
                        onChange={() => toggleItem(item.id)}
                        style={{
                          marginTop: 3, accentColor: SUCCESS,
                          cursor: 'pointer',
                        }}
                      />
                      <span style={{
                        textDecoration: checked ? 'line-through' : 'none',
                      }}>
                        {isTR ? item.label.tr : item.label.en}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      <div style={{
        marginTop: 4, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}
