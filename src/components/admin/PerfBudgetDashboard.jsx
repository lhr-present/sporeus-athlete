// src/components/admin/PerfBudgetDashboard.jsx
// E15 — Performance budget overview panel. Tier-gated: coach/club only.
// Static links + budget thresholds. No data fetching — CI is the source of truth.

import { BUNDLE_BUDGETS, LIGHTHOUSE_BUDGETS, CWV_BUDGETS } from '../../lib/observability/performanceBudget.js'

const MONO = "'IBM Plex Mono', monospace"

const S = {
  root:    { fontFamily: MONO, color: 'var(--text)', padding: '20px', maxWidth: 800 },
  title:   { fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ff6600', marginBottom: 20 },
  section: { marginBottom: 28 },
  heading: { fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: '10px' },
  th:      { textAlign: 'left', color: 'var(--muted)', fontWeight: 400, padding: '4px 8px', borderBottom: '1px solid var(--border)' },
  td:      { padding: '5px 8px', borderBottom: '1px solid #111' },
  link:    { color: '#0064ff', textDecoration: 'none', fontSize: '10px' },
}

export default function PerfBudgetDashboard({ tier, lang }) {
  if (tier !== 'coach' && tier !== 'club') return null

  const isEn = lang !== 'tr'

  return (
    <div style={S.root}>
      <div style={S.title}>
        {isEn ? '◈ Performance Budgets' : '◈ Performans Bütçeleri'}
      </div>

      {/* ── Bundle budgets ── */}
      <div style={S.section}>
        <div style={S.heading}>{isEn ? 'Bundle Size Budgets (gzip)' : 'Paket Boyutu Bütçeleri (gzip)'}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>{isEn ? 'Chunk' : 'Parça'}</th>
              <th style={S.th}>{isEn ? 'Max (gzip)' : 'Maks (gzip)'}</th>
              <th style={S.th}>CI</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={S.td}>{isEn ? 'Main entry' : 'Ana giriş'}</td><td style={S.td}>{BUNDLE_BUDGETS.mainBundleGzipMaxKB} KB</td><td style={S.td}><a href="https://github.com/lhr-present/sporeus-athlete/actions/workflows/bundle-size.yml" style={S.link} target="_blank" rel="noreferrer">→ {isEn ? 'Actions' : 'İş Akışları'}</a></td></tr>
            <tr><td style={S.td}>{isEn ? 'Any lazy chunk' : 'Herhangi lazy parça'}</td><td style={S.td}>{BUNDLE_BUDGETS.perChunkGzipMaxKB} KB</td><td style={S.td}>↑</td></tr>
            <tr><td style={S.td}>{isEn ? 'Total JS+CSS' : 'Toplam JS+CSS'}</td><td style={S.td}>{BUNDLE_BUDGETS.totalGzipMaxKB} KB</td><td style={S.td}>↑</td></tr>
            <tr><td style={S.td}>CSS</td><td style={S.td}>{BUNDLE_BUDGETS.cssGzipMaxKB} KB</td><td style={S.td}>↑</td></tr>
          </tbody>
        </table>
      </div>

      {/* ── Lighthouse budgets ── */}
      <div style={S.section}>
        <div style={S.heading}>{isEn ? 'Lighthouse Score Budgets' : 'Lighthouse Puan Bütçeleri'}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>{isEn ? 'Category' : 'Kategori'}</th>
              <th style={S.th}>{isEn ? 'Min Score' : 'Min Puan'}</th>
              <th style={S.th}>CI</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(LIGHTHOUSE_BUDGETS).map(([k, v]) => (
              <tr key={k}>
                <td style={S.td}>{k}</td>
                <td style={S.td}>≥ {v}</td>
                <td style={S.td}><a href="https://github.com/lhr-present/sporeus-athlete/actions/workflows/lighthouse.yml" style={S.link} target="_blank" rel="noreferrer">→ {isEn ? 'Actions' : 'İş Akışları'}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── CWV budgets ── */}
      <div style={S.section}>
        <div style={S.heading}>{isEn ? 'Core Web Vitals Budgets' : 'Temel Web Vitalleri Bütçeleri'}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>{isEn ? 'Metric' : 'Metrik'}</th>
              <th style={S.th}>{isEn ? '"Good" threshold' : '"İyi" eşiği'}</th>
              <th style={S.th}>{isEn ? 'Source' : 'Kaynak'}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={S.td}>LCP</td><td style={S.td}>≤ {CWV_BUDGETS.LCP_ms} ms</td><td style={S.td}><a href="https://plausible.io" style={S.link} target="_blank" rel="noreferrer">→ Plausible</a></td></tr>
            <tr><td style={S.td}>INP</td><td style={S.td}>≤ {CWV_BUDGETS.INP_ms} ms</td><td style={S.td}>↑</td></tr>
            <tr><td style={S.td}>CLS</td><td style={S.td}>≤ {CWV_BUDGETS.CLS}</td><td style={S.td}>↑</td></tr>
            <tr><td style={S.td}>FCP</td><td style={S.td}>≤ {CWV_BUDGETS.FCP_ms} ms</td><td style={S.td}>↑</td></tr>
            <tr><td style={S.td}>TTFB</td><td style={S.td}>≤ {CWV_BUDGETS.TTFB_ms} ms</td><td style={S.td}>↑</td></tr>
          </tbody>
        </table>
      </div>

      {/* ── Error monitoring ── */}
      <div style={S.section}>
        <div style={S.heading}>{isEn ? 'Error Monitoring' : 'Hata İzleme'}</div>
        <div style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: 1.7 }}>
          <div>
            {isEn ? 'Sentry DSN:' : 'Sentry DSN:'}{' '}
            {import.meta.env.VITE_SENTRY_DSN
              ? <span style={{ color: '#00c864' }}>✓ configured</span>
              : <span style={{ color: '#ff3232' }}>✗ not set — add VITE_SENTRY_DSN</span>}
          </div>
          <div style={{ marginTop: 8 }}>
            <a href="https://sentry.io" style={S.link} target="_blank" rel="noreferrer">
              → {isEn ? 'Open Sentry Dashboard' : 'Sentry Panosunu Aç'}
            </a>
          </div>
          <div style={{ marginTop: 4, color: '#555', fontSize: '9px' }}>
            {isEn
              ? 'Alert: error rate > 2% over 10 min → email. See docs/ops/observability_runbook.md'
              : 'Uyarı: 10 dakikada hata oranı > %2 → e-posta. Bkz: docs/ops/observability_runbook.md'}
          </div>
        </div>
      </div>
    </div>
  )
}
