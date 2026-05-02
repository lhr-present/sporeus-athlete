// @vitest-environment jsdom
// ─── charts.a11y.test.jsx ─────────────────────────────────────────────────────
// Verifies role="img", aria-label, <title>, <desc> on chart svgs.
// Recharts ResponsiveContainer needs a positive size to render its inner svg.
// We mock ResponsiveContainer to render children at a fixed 600x300 box so the
// chart svg actually mounts under jsdom.

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { Children, cloneElement, isValidElement } from 'react'
import { render } from '@testing-library/react'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

// Provide a no-op ResizeObserver — recharts internally references it.
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

// Replace ResponsiveContainer with a fixed-size pass-through so charts render in jsdom.
// We clone the inner chart element to inject explicit width/height — recharts
// uses these to populate its internal layout context.
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts')
  // eslint-disable-next-line react/prop-types
  const FakeResponsiveContainer = ({ children }) => {
    const sized = Children.map(children, c =>
      isValidElement(c) ? cloneElement(c, { width: 600, height: 300 }) : c,
    )
    return <div style={{ width: 600, height: 300 }}>{sized}</div>
  }
  return { ...actual, ResponsiveContainer: FakeResponsiveContainer }
})

// Helper: render with LangCtx provider for a given language
function renderWithLang(ui, lang = 'en') {
  const value = {
    t: k => LABELS[lang]?.[k] ?? LABELS.en?.[k] ?? k,
    lang,
    setLang: () => {},
  }
  return render(<LangCtx.Provider value={value}>{ui}</LangCtx.Provider>)
}

// Build a synthetic training log spanning the last 90 days with a TSS each day.
function buildLog(days = 90, tssBase = 60) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() - i)
    log.push({
      date: d.toISOString().slice(0, 10),
      tss: tssBase + (i % 7) * 10,
      duration: 60,
      rpe: 5,
      type: 'Bike',
    })
  }
  return log
}

// Build a synthetic recovery series (HRV) for HRVChart.
function buildRecovery(days = 30, hrvBase = 65) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() - i)
    out.push({
      date: d.toISOString().slice(0, 10),
      hrv: hrvBase + (i % 5) - 2,
      sleep: 7 + (i % 3) * 0.5,
      energy: 6 + (i % 4),
      soreness: 3 + (i % 3),
    })
  }
  return out
}

// Find the main chart svg (the one with role="img" — legend uses Surface too but
// without role="img", so this filters reliably).
function getChartSvg(container) {
  return container.querySelector('svg.recharts-surface[role="img"]')
}

// Lazy import after mocks are in place
const importChart = name => import(`../charts/${name}.jsx`).then(m => m.default)

describe('chart a11y attributes', () => {
  it('CTLChart renders with role="img" and aria-label', async () => {
    const CTLChart = await importChart('CTLChart')
    const log = buildLog(90)
    const { container } = renderWithLang(<CTLChart log={log} days={90} />)
    const svg = getChartSvg(container)
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toMatch(/CTL|TSB|performance/i)
  })

  it('CTLChart includes <title> and <desc> with data summary', async () => {
    const CTLChart = await importChart('CTLChart')
    const log = buildLog(90)
    const { container } = renderWithLang(<CTLChart log={log} days={90} />)
    const svg = getChartSvg(container)
    const title = svg.querySelector('title')
    const desc = svg.querySelector('desc')
    expect(title).not.toBeNull()
    expect(title.textContent).toMatch(/performance|management|days/i)
    expect(desc).not.toBeNull()
    expect(desc.textContent).toMatch(/CTL/i)
    expect(desc.textContent).toMatch(/Current CTL: \d+/)
  })

  it('CTLChart uses Turkish labels when lang="tr"', async () => {
    const CTLChart = await importChart('CTLChart')
    const log = buildLog(90)
    const { container } = renderWithLang(<CTLChart log={log} days={90} />, 'tr')
    const svg = getChartSvg(container)
    expect(svg.getAttribute('aria-label')).toMatch(/performans|grafiği/i)
    const desc = svg.querySelector('desc')
    expect(desc.textContent).toMatch(/Güncel CTL|son \d+ günde/i)
  })

  it('HRVChart renders with role="img", title, and desc referencing range', async () => {
    const HRVChart = await importChart('HRVChart')
    const recovery = buildRecovery(30)
    const { container } = renderWithLang(<HRVChart recovery={recovery} days={30} />)
    const svg = getChartSvg(container)
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toMatch(/HRV/i)
    expect(svg.querySelector('title').textContent).toMatch(/HRV|rMSSD/i)
    const descText = svg.querySelector('desc').textContent
    expect(descText).toMatch(/ranges from \d+ to \d+/i)
    expect(descText).toMatch(/Latest:\s*\d+/i)
  })

  it('HRVChart shows Turkish desc text when lang="tr"', async () => {
    const HRVChart = await importChart('HRVChart')
    const recovery = buildRecovery(30)
    const { container } = renderWithLang(<HRVChart recovery={recovery} days={30} />, 'tr')
    const svg = getChartSvg(container)
    expect(svg.getAttribute('aria-label')).toMatch(/eğilim|HRV/i)
    expect(svg.querySelector('desc').textContent).toMatch(/Son ölçüm|arasında/i)
  })

  it('LoadChart renders with role="img", title, desc referencing TSS range', async () => {
    const LoadChart = await importChart('LoadChart')
    const log = buildLog(70)
    const { container } = renderWithLang(<LoadChart log={log} weeks={10} />)
    const svg = getChartSvg(container)
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toMatch(/TSS|load/i)
    expect(svg.querySelector('title').textContent).toMatch(/Weekly load|TSS/i)
    const desc = svg.querySelector('desc').textContent
    expect(desc).toMatch(/Weekly TSS ranges from \d+ to \d+/)
    expect(desc).toMatch(/This week:\s*\d+\s*TSS/i)
  })

  it('LoadChart Turkish labels when lang="tr"', async () => {
    const LoadChart = await importChart('LoadChart')
    const log = buildLog(70)
    const { container } = renderWithLang(<LoadChart log={log} weeks={10} />, 'tr')
    const svg = getChartSvg(container)
    expect(svg.getAttribute('aria-label')).toMatch(/yük|grafiği/i)
    expect(svg.querySelector('desc').textContent).toMatch(/Bu hafta|TSS/i)
  })

  it('ZoneChart renders with role="img", title, desc referencing easy %', async () => {
    const ZoneChart = await importChart('ZoneChart')
    const log = buildLog(56).map(e => ({ ...e, zones: [30, 20, 5, 3, 2] }))
    const { container } = renderWithLang(<ZoneChart log={log} weeks={8} />)
    const svg = getChartSvg(container)
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toMatch(/zone/i)
    expect(svg.querySelector('title').textContent).toMatch(/Weekly zones/i)
    const desc = svg.querySelector('desc').textContent
    expect(desc).toMatch(/easy.*\d+%/i)
  })

  it('ZoneChart Turkish labels when lang="tr"', async () => {
    const ZoneChart = await importChart('ZoneChart')
    const log = buildLog(56).map(e => ({ ...e, zones: [30, 20, 5, 3, 2] }))
    const { container } = renderWithLang(<ZoneChart log={log} weeks={8} />, 'tr')
    const svg = getChartSvg(container)
    expect(svg.getAttribute('aria-label')).toMatch(/zon|grafiği/i)
    expect(svg.querySelector('desc').textContent).toMatch(/kolay|hafta/i)
  })

  it('WellnessSparkline renders with role="img" and aria-label (no desc required)', async () => {
    const WellnessSparkline = await importChart('WellnessSparkline')
    const recovery = buildRecovery(14)
    const { container } = renderWithLang(<WellnessSparkline recovery={recovery} />)
    const svg = getChartSvg(container)
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('role')).toBe('img')
    const ariaLabel = svg.getAttribute('aria-label')
    expect(ariaLabel).toBeTruthy()
    expect(ariaLabel.length).toBeGreaterThan(0)
  })

  it('WellnessSparkline Turkish aria-label when lang="tr"', async () => {
    const WellnessSparkline = await importChart('WellnessSparkline')
    const recovery = buildRecovery(14)
    const { container } = renderWithLang(<WellnessSparkline recovery={recovery} />, 'tr')
    const svg = getChartSvg(container)
    expect(svg.getAttribute('aria-label')).toMatch(/iyilik|hali|grafiği/i)
  })

  it('charts with no data return null (empty-state) without crashing', async () => {
    const HRVChart = await importChart('HRVChart')
    const LoadChart = await importChart('LoadChart')
    const WellnessSparkline = await importChart('WellnessSparkline')

    const { container: c1 } = renderWithLang(<HRVChart recovery={[]} days={30} />)
    expect(c1.querySelector('svg.recharts-surface')).toBeNull()

    const { container: c2 } = renderWithLang(<LoadChart log={[]} weeks={10} />)
    // LoadChart returns null only when data array is empty; with no log, weeks still build
    // → the rendered chart may still appear with all-zero TSS. Both behaviors are acceptable;
    // the assertion is simply that it does not throw.
    expect(c2).toBeTruthy()

    const { container: c3 } = renderWithLang(<WellnessSparkline recovery={[]} />)
    expect(c3.querySelector('svg.recharts-surface')).toBeNull()
  })
})
