import { useState } from 'react'
import { rankSquad, exportSquadCSV, limitSelection } from '../../lib/sport/squadBenchmark.js'
import { S } from '../../styles.js'

// ─── Color helpers ────────────────────────────────────────────────────────────

function ctlColor(ctl) {
  if (ctl > 60) return '#5bc25b'
  if (ctl >= 30) return '#ff6600'
  return '#e03030'
}

function acwrColor(acwr) {
  if (acwr > 1.3) return '#e03030'
  if (acwr >= 1.0) return '#ff6600'
  return '#5bc25b'
}

function complianceColor(pct) {
  if (pct > 80) return '#5bc25b'
  if (pct >= 50) return '#ff6600'
  return '#e03030'
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ ctl, atl }) {
  const days = 28
  const W = 120, H = 40, pad = 4

  // Simulate 28-day history for CTL and ATL
  const ctlPoints = Array.from({ length: days }, (_, i) => ctl * Math.pow(i / (days - 1), 0.3))
  const atlPoints = Array.from({ length: days }, (_, i) => atl * Math.pow(i / (days - 1), 0.3))
  const tsbPoints = ctlPoints.map((c, i) => c - atlPoints[i])

  const allVals = [...ctlPoints, ...atlPoints, ...tsbPoints]
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const range = maxV - minV || 1

  function toPath(pts) {
    return pts
      .map((v, i) => {
        const x = pad + (i / (days - 1)) * (W - pad * 2)
        const y = pad + (1 - (v - minV) / range) * (H - pad * 2)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      {/* TSB dashed grey */}
      <path d={toPath(tsbPoints)} fill="none" stroke="#555" strokeWidth="1" strokeDasharray="3,2" />
      {/* ATL blue */}
      <path d={toPath(atlPoints)} fill="none" stroke="#0064ff" strokeWidth="1.5" />
      {/* CTL orange */}
      <path d={toPath(ctlPoints)} fill="none" stroke="#ff6600" strokeWidth="1.5" />
    </svg>
  )
}

// ─── AthleteComparisonPanel ───────────────────────────────────────────────────

function AthleteComparisonPanel({ athletes, selectedIds, onReset }) {
  const selected = athletes.filter(a => selectedIds.has(a.id))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ ...S.mono, fontSize: '11px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.1em' }}>
          ATHLETE COMPARISON — {selected.length} SELECTED
        </div>
        <button
          onClick={onReset}
          style={{ ...S.mono, fontSize: '10px', padding: '4px 12px', background: 'transparent', border: '1px solid #ff6600', color: '#ff6600', borderRadius: '3px', cursor: 'pointer' }}
        >
          ← RESET COMPARISON
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
        {selected.map(athlete => {
          const ctl = athlete.ctl ?? 0
          const atl = ctl * 1.1  // ATL slightly above CTL for simulation
          const wellnessPct = Math.min(100, Math.max(0, ((athlete.wellness_avg ?? 0) / 10) * 100))
          const wColor = complianceColor(wellnessPct)

          return (
            <div
              key={athlete.id}
              style={{
                minWidth: '160px',
                flex: '0 0 160px',
                background: 'var(--surface)',
                border: '1px solid #ff660044',
                borderRadius: '6px',
                padding: '12px',
              }}
            >
              {/* Name header */}
              <div style={{ ...S.mono, fontSize: '11px', fontWeight: 700, color: '#e0e0e0', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {athlete.name}
              </div>

              {/* 28-day CTL/ATL/TSB sparkline */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ ...S.mono, fontSize: '8px', color: '#555', marginBottom: '4px', letterSpacing: '0.07em' }}>
                  28D CTL / ATL / TSB
                </div>
                <Sparkline ctl={ctl} atl={atl} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                  <span style={{ ...S.mono, fontSize: '7px', color: '#ff6600' }}>— CTL</span>
                  <span style={{ ...S.mono, fontSize: '7px', color: '#0064ff' }}>— ATL</span>
                  <span style={{ ...S.mono, fontSize: '7px', color: '#555' }}>-- TSB</span>
                </div>
              </div>

              {/* Wellness bar */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ ...S.mono, fontSize: '8px', color: '#555', marginBottom: '3px', letterSpacing: '0.07em' }}>
                  WELLNESS {athlete.wellness_avg != null ? athlete.wellness_avg.toFixed(1) : '—'}/10
                </div>
                <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${wellnessPct}%`, background: wColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
              </div>

              {/* ACWR badge */}
              <div style={{ ...S.mono, fontSize: '9px', color: acwrColor(athlete.acwr ?? 0), fontWeight: 700 }}>
                ACWR {athlete.acwr != null ? athlete.acwr.toFixed(2) : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLS = [
  { id: 'select',         label: '☐',    sortable: false, width: '32px'  },
  { id: 'name',           label: 'Name', sortable: true,  width: '1fr'   },
  { id: 'ctl',            label: 'CTL',  sortable: true,  width: '64px'  },
  { id: 'acwr',           label: 'ACWR', sortable: true,  width: '72px'  },
  { id: 'compliance_pct', label: 'Comp%',sortable: true,  width: '72px'  },
  { id: 'wellness_avg',   label: 'WEL',  sortable: true,  width: '64px'  },
]

// ─── SquadBenchmarkTable ──────────────────────────────────────────────────────

export default function SquadBenchmarkTable({ athletes }) {
  const [sortBy, setSortBy] = useState('ctl')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [compareMode, setCompareMode] = useState(false)

  // Sort athletes via rankSquad
  const sorted = rankSquad(athletes, sortBy)

  // Toggle column sort (re-use same col = same direction, always desc rank)
  function handleSort(col) {
    setSortBy(col)
  }

  // Toggle selection, enforcing max-5 via limitSelection
  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      // Add: enforce limit
      const limited = limitSelection([...next, id], 5)
      return new Set(limited)
    })
  }

  // Export CSV download
  function handleExport() {
    const csv = exportSquadCSV(athletes)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'squad_benchmark.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Header cell style
  function headerCellStyle(col) {
    const active = sortBy === col
    return {
      ...S.mono,
      fontSize: '9px',
      fontWeight: 700,
      color: active ? '#ff6600' : '#555',
      letterSpacing: '0.08em',
      cursor: col === 'select' ? 'default' : 'pointer',
      userSelect: 'none',
      padding: '4px 6px',
      borderBottom: `1px solid ${active ? '#ff6600' : '#222'}`,
      textAlign: col === 'name' ? 'left' : 'center',
    }
  }

  const cellStyle = {
    ...S.mono,
    fontSize: '11px',
    padding: '6px 6px',
    borderBottom: '1px solid #1a1a1a',
    verticalAlign: 'middle',
    textAlign: 'center',
  }

  const nameCellStyle = { ...cellStyle, textAlign: 'left', color: '#e0e0e0', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

  if (compareMode) {
    return (
      <div>
        <AthleteComparisonPanel
          athletes={athletes}
          selectedIds={selectedIds}
          onReset={() => { setCompareMode(false); setSelectedIds(new Set()) }}
        />
      </div>
    )
  }

  return (
    <div>
      {/* Action bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setCompareMode(true)}
            disabled={selectedIds.size < 2}
            style={{
              ...S.mono,
              fontSize: '10px',
              fontWeight: 700,
              padding: '5px 12px',
              background: selectedIds.size >= 2 ? '#ff6600' : '#333',
              color: selectedIds.size >= 2 ? '#fff' : '#555',
              border: 'none',
              borderRadius: '3px',
              cursor: selectedIds.size >= 2 ? 'pointer' : 'not-allowed',
            }}
          >
            COMPARE ({selectedIds.size})
          </button>
        )}
        <button
          onClick={handleExport}
          style={{ ...S.mono, fontSize: '10px', padding: '5px 12px', background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: '3px', cursor: 'pointer' }}
        >
          EXPORT CSV
        </button>
        {selectedIds.size === 5 && (
          <span style={{ ...S.mono, fontSize: '9px', color: '#ff6600' }}>MAX 5 SELECTED</span>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '32px' }} />
            <col style={{ width: 'auto' }} />
            <col style={{ width: '64px' }} />
            <col style={{ width: '72px' }} />
            <col style={{ width: '72px' }} />
            <col style={{ width: '64px' }} />
          </colgroup>
          <thead>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.id}
                  style={headerCellStyle(col.sortable ? col.id : 'select')}
                  onClick={col.sortable ? () => handleSort(col.id) : undefined}
                >
                  {col.label}{col.sortable && sortBy === col.id ? ' ↓' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...cellStyle, color: '#444', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                  No athletes to display.
                </td>
              </tr>
            )}
            {sorted.map(athlete => {
              const isChecked = selectedIds.has(athlete.id)
              return (
                <tr
                  key={athlete.id}
                  style={{ background: isChecked ? '#ff660011' : 'transparent', cursor: 'pointer' }}
                  onClick={() => toggleSelect(athlete.id)}
                >
                  {/* Checkbox */}
                  <td style={{ ...cellStyle, textAlign: 'center', fontSize: '13px', color: isChecked ? '#ff6600' : '#333' }}>
                    {isChecked ? '☑' : '☐'}
                  </td>

                  {/* Name */}
                  <td style={nameCellStyle}>{athlete.name}</td>

                  {/* CTL */}
                  <td style={{ ...cellStyle, color: ctlColor(athlete.ctl ?? 0), fontWeight: 700 }}>
                    {athlete.ctl ?? '—'}
                  </td>

                  {/* ACWR */}
                  <td style={{ ...cellStyle, color: acwrColor(athlete.acwr ?? 0), fontWeight: 700 }}>
                    {athlete.acwr != null ? athlete.acwr.toFixed(2) : '—'}
                  </td>

                  {/* Compliance% */}
                  <td style={{ ...cellStyle, color: complianceColor(athlete.compliance_pct ?? 0), fontWeight: 700 }}>
                    {athlete.compliance_pct != null ? `${athlete.compliance_pct}%` : '—'}
                  </td>

                  {/* Wellness avg */}
                  <td style={{ ...cellStyle, color: athlete.wellness_avg != null ? (athlete.wellness_avg >= 7 ? '#5bc25b' : athlete.wellness_avg >= 5 ? '#ff6600' : '#e03030') : '#444', fontWeight: 700 }}>
                    {athlete.wellness_avg != null ? athlete.wellness_avg.toFixed(1) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
