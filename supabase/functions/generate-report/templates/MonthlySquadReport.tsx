/** @jsxImportSource https://esm.sh/react@18.2.0 */
// ─── MonthlySquadReport.tsx — PDF template for coach monthly squad overview ──
import React from 'https://esm.sh/react@18.2.0'
import { Document, Page, Text, View, StyleSheet } from 'https://esm.sh/@react-pdf/renderer@3.4.4?deps=react@18.2.0'

export interface AthleteMonthlyData {
  athlete_id:    string
  display_name:  string
  ctl:           number
  atl:           number
  tsb:           number
  weeklyTss:     number[]   // last 4 weeks, oldest first
  sessionsCount: number
  plannedSessions?: number
  flags:         string[]   // e.g., ['HRV alert', 'High ACWR', 'Injury logged']
}

export interface MonthlySquadData {
  coach:      { display_name: string }
  month:      string   // YYYY-MM label
  monthStart: string
  monthEnd:   string
  athletes:   AthleteMonthlyData[]
}

const ORANGE = '#ff6600'
const DARK   = '#0a0a0a'
const GREY   = '#888'
const GREEN  = '#2d8c2d'
const RED    = '#c0392b'
const YELLOW = '#c47a00'

const S = StyleSheet.create({
  page: {
    backgroundColor: '#fff',
    paddingTop: 40, paddingBottom: 40,
    paddingLeft: 45, paddingRight: 45,
    fontFamily: 'Helvetica',
    fontSize: 10, color: '#222',
  },
  header: {
    borderBottom: `3px solid ${ORANGE}`,
    marginBottom: 20, paddingBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  title:  { fontSize: 16, fontWeight: 'bold', color: DARK, letterSpacing: 1 },
  sub:    { fontSize: 9,  color: GREY, marginTop: 3 },
  athleteCard: {
    border: '1px solid #e0e0e0', borderRadius: 4,
    marginBottom: 14, overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: DARK, padding: '7 10',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardName:  { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  cardBadge: { fontSize: 8,  color: '#aaa' },
  cardBody:  { padding: '10 10', flexDirection: 'row', gap: 0 },
  statCol:   { flex: 1, alignItems: 'center', borderRight: '1px solid #f0f0f0' },
  statVal:   { fontSize: 16, fontWeight: 'bold', color: DARK },
  statLabel: { fontSize: 7,  color: GREY, textTransform: 'uppercase', marginTop: 2 },
  sparkline: { flex: 1.5, paddingLeft: 10, paddingRight: 10, justifyContent: 'center' },
  sparkLabel:{ fontSize: 7, color: GREY, marginBottom: 3 },
  sparkBar:  { flexDirection: 'row', alignItems: 'flex-end', height: 24, gap: 2 },
  flagSection: { borderTop: '1px solid #f0f0f0', padding: '6 10', flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  flag: { fontSize: 7, padding: '2 6', borderRadius: 10 },
  footer: {
    position: 'absolute', bottom: 20, left: 45, right: 45,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '1px solid #eee', paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#bbb' },
  summaryTable: { marginTop: 8 },
  summaryHeader: { flexDirection: 'row', backgroundColor: DARK, padding: '5 8', borderRadius: 2 },
  summaryRow:    { flexDirection: 'row', padding: '5 8', borderBottom: '1px solid #f5f5f5' },
  summaryRowAlt: { flexDirection: 'row', padding: '5 8', borderBottom: '1px solid #f5f5f5', backgroundColor: '#fafafa' },
  th: { fontSize: 8, color: '#fff', fontWeight: 'bold' },
  td: { fontSize: 9, color: '#333' },
})

function tsbColor(tsb: number) {
  if (tsb > 10) return GREEN
  if (tsb < -10) return RED
  return ORANGE
}

function complianceColor(pct: number) {
  if (pct >= 85) return GREEN
  if (pct >= 60) return YELLOW
  return RED
}

function fmt(v: number | null | undefined, dec = 0): string {
  if (v == null || isNaN(v)) return '—'
  return v.toFixed(dec)
}

function compliance(actual: number, planned?: number): string {
  if (!planned) return '—'
  return `${Math.round((actual / planned) * 100)}%`
}

function SparklineBars({ values, maxH = 20 }: { values: number[], maxH?: number }) {
  const max = Math.max(...values, 1)
  return (
    <View style={S.sparkBar}>
      {values.map((v, i) => (
        <View key={i} style={{
          width: 12,
          height: Math.max(2, (v / max) * maxH),
          backgroundColor: i === values.length - 1 ? ORANGE : '#ccc',
          borderRadius: 1,
        }} />
      ))}
    </View>
  )
}

function flagStyle(flag: string) {
  if (flag.includes('HRV') || flag.includes('Injury'))
    return { ...S.flag, backgroundColor: '#fff0f0', color: RED }
  if (flag.includes('High ACWR'))
    return { ...S.flag, backgroundColor: '#fffbe6', color: YELLOW }
  return { ...S.flag, backgroundColor: '#e8f5e9', color: GREEN }
}

const ATHLETES_PER_PAGE = 4

export function MonthlySquadReport({ data }: { data: MonthlySquadData }) {
  const { coach, month, athletes } = data

  // Split athletes across pages
  const pages: AthleteMonthlyData[][] = []
  for (let i = 0; i < athletes.length; i += ATHLETES_PER_PAGE) {
    pages.push(athletes.slice(i, i + ATHLETES_PER_PAGE))
  }
  if (pages.length === 0) pages.push([])

  return (
    <Document title={`Squad Monthly Report — ${coach.display_name} — ${month}`} author="Sporeus">
      {/* ── Cover + Summary Table ─────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.title}>MONTHLY SQUAD REPORT</Text>
            <Text style={S.sub}>Coach: {coach.display_name} · {month}</Text>
            <Text style={S.sub}>{athletes.length} athlete{athletes.length !== 1 ? 's' : ''}</Text>
          </View>
          <Text style={{ fontSize: 9, color: '#aaa' }}>Sporeus Athlete Console</Text>
        </View>

        {/* Summary table */}
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: ORANGE, marginBottom: 8,
          textTransform: 'uppercase', letterSpacing: 1 }}>
          Squad Overview
        </Text>
        <View style={S.summaryTable}>
          <View style={S.summaryHeader}>
            <Text style={{ ...S.th, flex: 2 }}>Athlete</Text>
            <Text style={{ ...S.th, flex: 1 }}>CTL</Text>
            <Text style={{ ...S.th, flex: 1 }}>TSB</Text>
            <Text style={{ ...S.th, flex: 1 }}>Sessions</Text>
            <Text style={{ ...S.th, flex: 1 }}>Compliance</Text>
            <Text style={{ ...S.th, flex: 2 }}>Flags</Text>
          </View>
          {athletes.map((a, i) => (
            <View key={a.athlete_id} style={i % 2 === 0 ? S.summaryRow : S.summaryRowAlt}>
              <Text style={{ ...S.td, flex: 2, fontWeight: 'bold' }}>{a.display_name}</Text>
              <Text style={{ ...S.td, flex: 1 }}>{fmt(a.ctl, 1)}</Text>
              <Text style={{ ...S.td, flex: 1, color: tsbColor(a.tsb) }}>{fmt(a.tsb, 1)}</Text>
              <Text style={{ ...S.td, flex: 1 }}>{a.sessionsCount}</Text>
              <Text style={{ ...S.td, flex: 1,
                color: a.plannedSessions ? complianceColor((a.sessionsCount / a.plannedSessions) * 100) : '#888'
              }}>
                {compliance(a.sessionsCount, a.plannedSessions)}
              </Text>
              <Text style={{ ...S.td, flex: 2, fontSize: 8, color: a.flags.length ? RED : GREY }}>
                {a.flags.length ? a.flags.join(' · ') : 'No flags'}
              </Text>
            </View>
          ))}
        </View>

        <View style={S.footer}>
          <Text style={S.footerText}>Sporeus Athlete Console — sporeus.com</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ── Per-athlete detail pages ──────────────────────────────────────── */}
      {pages.map((group, pageIdx) => (
        <Page key={pageIdx} size="A4" style={S.page}>
          <View style={{ ...S.header, marginBottom: 14 }}>
            <Text style={{ ...S.title, fontSize: 13 }}>ATHLETE DETAIL — {month}</Text>
            <Text style={{ fontSize: 9, color: '#aaa' }}>{coach.display_name}</Text>
          </View>

          {group.map(a => (
            <View key={a.athlete_id} style={S.athleteCard}>
              <View style={S.cardHeader}>
                <Text style={S.cardName}>{a.display_name}</Text>
                <Text style={S.cardBadge}>
                  {a.sessionsCount} sessions · {compliance(a.sessionsCount, a.plannedSessions)} compliance
                </Text>
              </View>

              <View style={S.cardBody}>
                {/* Metrics */}
                {[
                  { label: 'CTL', val: fmt(a.ctl, 1) },
                  { label: 'ATL', val: fmt(a.atl, 1) },
                  { label: 'TSB', val: fmt(a.tsb, 1), color: tsbColor(a.tsb) },
                ].map(m => (
                  <View key={m.label} style={S.statCol}>
                    <Text style={{ ...S.statVal, color: m.color || DARK }}>{m.val}</Text>
                    <Text style={S.statLabel}>{m.label}</Text>
                  </View>
                ))}

                {/* Sparkline */}
                {a.weeklyTss.length > 0 && (
                  <View style={S.sparkline}>
                    <Text style={S.sparkLabel}>4-week TSS trend</Text>
                    <SparklineBars values={a.weeklyTss} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={{ fontSize: 6, color: '#bbb' }}>4w ago</Text>
                      <Text style={{ fontSize: 6, color: '#bbb' }}>This week</Text>
                    </View>
                  </View>
                )}
              </View>

              {a.flags.length > 0 && (
                <View style={S.flagSection}>
                  {a.flags.map((f, fi) => (
                    <View key={fi} style={flagStyle(f)}>
                      <Text>{f}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          <View style={S.footer}>
            <Text style={S.footerText}>Sporeus Athlete Console — sporeus.com</Text>
            <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  )
}
