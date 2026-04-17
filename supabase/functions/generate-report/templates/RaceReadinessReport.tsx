/** @jsxImportSource https://esm.sh/react@18.2.0 */
// ─── RaceReadinessReport.tsx — Single-page race readiness one-pager ──────────
import React from 'https://esm.sh/react@18.2.0'
import { Document, Page, Text, View, StyleSheet } from 'https://esm.sh/@react-pdf/renderer@3.4.4?deps=react@18.2.0'

export interface RaceReadinessData {
  athlete: { display_name: string }
  race: {
    name:        string
    date:        string
    distance_km: number
    sport:       string
  }
  predictedTime:  string | null   // e.g. "2:34:15" or null if no test data
  predictionBasis?: string        // e.g. "Based on 42km run in 3:55 on 2026-03-12"
  taperStatus:    'fresh' | 'trained' | 'fatigued' | 'unknown'
  readinessScore: number          // 0–100
  metrics: {
    ctl:   number
    atl:   number
    tsb:   number
  }
  recentSessions: Array<{
    date:         string
    type:         string
    duration_min: number | null
    tss:          number | null
    notes?:       string | null
  }>
  injuryFlags:    string[]
  taperPlan?:     string          // Coach-supplied or AI-generated taper narrative
  daysToRace:     number
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
    paddingTop: 35, paddingBottom: 35,
    paddingLeft: 45, paddingRight: 45,
    fontFamily: 'Helvetica',
    fontSize: 10, color: '#222',
  },
  header: {
    backgroundColor: DARK, padding: '16 14',
    marginBottom: 18, borderRadius: 4,
  },
  raceName: { fontSize: 20, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  raceDate: { fontSize: 10, color: '#aaa', marginTop: 4 },
  athleteName: { fontSize: 11, color: ORANGE, marginTop: 6 },
  headerRight: { position: 'absolute', top: 16, right: 14 },
  scoreBadge: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
  },
  scoreVal: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scoreLabel: { fontSize: 7, color: '#fff', textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  col: { flex: 1 },
  sectionTitle: {
    fontSize: 8, fontWeight: 'bold', color: ORANGE,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 6, borderBottom: `1px solid #eee`, paddingBottom: 3,
  },
  predictionBox: {
    border: `2px solid ${ORANGE}`, borderRadius: 4, padding: '10 12',
    alignItems: 'center',
  },
  predTime: { fontSize: 24, fontWeight: 'bold', color: DARK },
  predLabel: { fontSize: 8, color: GREY, marginTop: 3 },
  predBasis: { fontSize: 7, color: '#aaa', marginTop: 4, textAlign: 'center' },
  metricsBox: { backgroundColor: '#f8f8f8', borderRadius: 4, padding: '8 10' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  metricKey: { fontSize: 8, color: GREY },
  metricVal: { fontSize: 8, fontWeight: 'bold', color: DARK },
  taperBox: { borderRadius: 4, padding: '8 10', marginBottom: 4 },
  sessionRow: { flexDirection: 'row', padding: '3 0', borderBottom: '1px solid #f5f5f5' },
  th: { fontSize: 7, color: GREY, textTransform: 'uppercase', fontWeight: 'bold' },
  td: { fontSize: 8, color: '#333' },
  injuryFlag: {
    backgroundColor: '#fff0f0', border: `1px solid ${RED}`,
    borderRadius: 3, padding: '2 6', marginBottom: 3,
  },
  injuryText: { fontSize: 8, color: RED },
  footer: {
    position: 'absolute', bottom: 20, left: 45, right: 45,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '1px solid #eee', paddingTop: 5,
  },
  footerText: { fontSize: 7, color: '#bbb' },
})

function taperBg(status: string) {
  if (status === 'fresh')   return { backgroundColor: '#f0fff4', borderLeft: `3px solid ${GREEN}` }
  if (status === 'fatigued') return { backgroundColor: '#fff5f5', borderLeft: `3px solid ${RED}` }
  return { backgroundColor: '#fffbe6', borderLeft: `3px solid ${YELLOW}` }
}

function taperText(status: string, days: number) {
  if (status === 'fresh')    return `Excellent readiness. You are ${days}d out and your form (TSB) is positive. Maintain easy volume, include 1–2 strides to keep legs sharp. Avoid any new intensity.`
  if (status === 'fatigued') return `Higher fatigue detected ${days}d from race. Reduce training volume by 40–50%, avoid threshold sessions, prioritize sleep and nutrition.`
  if (status === 'trained')  return `Good trained state ${days}d out. Begin taper: reduce volume by 20–30%, keep 1 short quality session to maintain neuromuscular sharpness. Focus on race execution strategy.`
  return `${days} days to race. Monitor your form daily (TSB) and adjust volume as needed.`
}

function scoreColor(s: number) {
  if (s >= 80) return GREEN
  if (s >= 55) return ORANGE
  return RED
}

function fmt(v: number | null | undefined, dec = 0): string {
  if (v == null || isNaN(v)) return '—'
  return v.toFixed(dec)
}

function fmtDur(min: number | null): string {
  if (!min) return '—'
  if (min < 60) return `${min}min`
  return `${Math.floor(min / 60)}h${min % 60 ? `${min % 60}m` : ''}`
}

export function RaceReadinessReport({ data }: { data: RaceReadinessData }) {
  const { athlete, race, predictedTime, predictionBasis, taperStatus, readinessScore, metrics,
          recentSessions, injuryFlags, taperPlan, daysToRace } = data

  const showedSessions = recentSessions.slice(0, 8)

  return (
    <Document title={`Race Readiness — ${athlete.display_name} — ${race.name}`} author="Sporeus">
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.raceName}>{race.name}</Text>
          <Text style={S.raceDate}>{race.sport.toUpperCase()} · {race.distance_km}km · {race.date}</Text>
          <Text style={S.athleteName}>{athlete.display_name}</Text>

          <View style={S.headerRight}>
            <View style={{ ...S.scoreBadge, backgroundColor: scoreColor(readinessScore) }}>
              <Text style={S.scoreVal}>{readinessScore}</Text>
              <Text style={S.scoreLabel}>READY</Text>
            </View>
          </View>
        </View>

        <View style={S.row}>
          {/* Predicted time */}
          <View style={{ flex: 1 }}>
            <Text style={S.sectionTitle}>Predicted Finish Time</Text>
            {predictedTime ? (
              <View style={S.predictionBox}>
                <Text style={S.predTime}>{predictedTime}</Text>
                <Text style={S.predLabel}>{race.sport} · {race.distance_km}km</Text>
                {predictionBasis && <Text style={S.predBasis}>{predictionBasis}</Text>}
              </View>
            ) : (
              <View style={{ ...S.predictionBox, borderColor: '#ddd' }}>
                <Text style={{ ...S.predTime, fontSize: 14, color: GREY }}>No prediction</Text>
                <Text style={S.predBasis}>No recent test result found. Log a time trial to enable prediction.</Text>
              </View>
            )}
          </View>

          {/* Current metrics */}
          <View style={{ flex: 1 }}>
            <Text style={S.sectionTitle}>Current Metrics</Text>
            <View style={S.metricsBox}>
              {[
                { k: 'CTL (Fitness)',    v: fmt(metrics.ctl, 1) },
                { k: 'ATL (Fatigue)',    v: fmt(metrics.atl, 1) },
                { k: 'TSB (Form)',        v: fmt(metrics.tsb, 1) },
                { k: 'Days to Race',      v: String(Math.max(0, daysToRace)) },
                { k: 'Form Status',       v: taperStatus.charAt(0).toUpperCase() + taperStatus.slice(1) },
                { k: 'Readiness Score',   v: `${readinessScore}/100` },
              ].map(m => (
                <View key={m.k} style={S.metricRow}>
                  <Text style={S.metricKey}>{m.k}</Text>
                  <Text style={S.metricVal}>{m.v}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Taper plan */}
        <Text style={S.sectionTitle}>Taper & Race Preparation</Text>
        <View style={{ ...S.taperBox, ...taperBg(taperStatus), marginBottom: 14 }}>
          <Text style={{ fontSize: 9, color: '#333', lineHeight: 1.5 }}>
            {taperPlan || taperText(taperStatus, daysToRace)}
          </Text>
        </View>

        {/* Injury flags */}
        {injuryFlags.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ ...S.sectionTitle, color: RED }}>⚠ Injury / Health Flags</Text>
            {injuryFlags.map((f, i) => (
              <View key={i} style={S.injuryFlag}>
                <Text style={S.injuryText}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent key sessions */}
        <Text style={S.sectionTitle}>Key Sessions (last 8 weeks)</Text>
        {showedSessions.length === 0 ? (
          <Text style={{ fontSize: 9, color: GREY }}>No sessions logged in the last 8 weeks.</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', paddingBottom: 3, borderBottom: '1px solid #eee' }}>
              <Text style={{ ...S.th, width: '16%' }}>Date</Text>
              <Text style={{ ...S.th, width: '16%' }}>Type</Text>
              <Text style={{ ...S.th, width: '14%' }}>Duration</Text>
              <Text style={{ ...S.th, width: '10%' }}>TSS</Text>
              <Text style={{ ...S.th, width: '44%' }}>Notes</Text>
            </View>
            {showedSessions.map((s, i) => (
              <View key={i} style={S.sessionRow}>
                <Text style={{ ...S.td, width: '16%' }}>{s.date}</Text>
                <Text style={{ ...S.td, width: '16%' }}>{s.type || '—'}</Text>
                <Text style={{ ...S.td, width: '14%' }}>{fmtDur(s.duration_min)}</Text>
                <Text style={{ ...S.td, width: '10%' }}>{fmt(s.tss)}</Text>
                <Text style={{ ...S.td, width: '44%', fontSize: 7 }} numberOfLines={1}>
                  {s.notes || ''}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={S.footer}>
          <Text style={S.footerText}>Sporeus Athlete Console — sporeus.com</Text>
          <Text style={S.footerText}>Generated: {new Date().toISOString().slice(0, 10)}</Text>
        </View>
      </Page>
    </Document>
  )
}
