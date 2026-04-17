// ─── test.ts — Deno tests for generate-report edge function ───────────────────
// Run with: deno test --allow-net --allow-env supabase/functions/generate-report/test.ts

import { assertEquals, assertGreater, assert } from "https://deno.land/std@0.224.0/assert/mod.ts"
import React from "https://esm.sh/react@18.2.0"
import { pdf } from "https://esm.sh/@react-pdf/renderer@3.4.4?deps=react@18.2.0"

import { WeeklyAthleteReport } from "./templates/WeeklyAthleteReport.tsx"
import { MonthlySquadReport   } from "./templates/MonthlySquadReport.tsx"
import { RaceReadinessReport  } from "./templates/RaceReadinessReport.tsx"
import type { WeeklyReportData  } from "./templates/WeeklyAthleteReport.tsx"
import type { MonthlySquadData  } from "./templates/MonthlySquadReport.tsx"
import type { RaceReadinessData } from "./templates/RaceReadinessReport.tsx"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const weeklyFixture: WeeklyReportData = {
  athlete: { display_name: "Test Athlete", email: "test@test.com" },
  weekStart: "2026-04-07",
  weekEnd: "2026-04-13",
  metrics: {
    ctl: 65.4, atl: 70.1, tsb: -4.7,
    weekTss: 420, sessionsCount: 5,
    totalDurationMin: 380, avgRpe: 6.5,
  },
  sessions: [
    { date: "2026-04-07", type: "run", duration_min: 70, tss: 85, rpe: 6, notes: "Easy aerobic" },
    { date: "2026-04-09", type: "bike", duration_min: 90, tss: 110, rpe: 7, notes: "Threshold intervals" },
    { date: "2026-04-11", type: "swim", duration_min: 60, tss: 75, rpe: 6, notes: null },
  ],
  insights: [
    { kind: "load_summary", content: "Good week — CTL is building steadily.", created_at: "2026-04-14T06:00:00Z" },
  ],
  suggestedFocus: "Continue your threshold work with 1 quality session this week.",
}

const squadFixture: MonthlySquadData = {
  coach: { display_name: "Coach Leonardo" },
  month: "2026-04",
  monthStart: "2026-04-01",
  monthEnd: "2026-04-30",
  athletes: [
    {
      athlete_id: "uid1", display_name: "Alice",
      ctl: 72, atl: 68, tsb: 4,
      weeklyTss: [310, 350, 390, 420],
      sessionsCount: 18, plannedSessions: 20,
      flags: [],
    },
    {
      athlete_id: "uid2", display_name: "Bob",
      ctl: 55, atl: 70, tsb: -15,
      weeklyTss: [200, 280, 340, 390],
      sessionsCount: 14, plannedSessions: 20,
      flags: ["High ACWR", "HRV alert"],
    },
  ],
}

const raceFixture: RaceReadinessData = {
  athlete: { display_name: "Test Athlete" },
  race: { name: "Istanbul Marathon", date: "2026-05-03", distance_km: 42.195, sport: "run" },
  predictedTime: "3:42:00",
  predictionBasis: "Based on 10km test in 46:30 on 2026-03-20",
  taperStatus: "trained",
  readinessScore: 74,
  metrics: { ctl: 68, atl: 62, tsb: 6 },
  recentSessions: [
    { date: "2026-04-12", type: "run", duration_min: 90, tss: 105, notes: "Long run easy" },
    { date: "2026-04-10", type: "run", duration_min: 50, tss: 55, notes: "Tempo 2×20min" },
  ],
  injuryFlags: [],
  daysToRace: 16,
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function renderToPdfBytes(element: React.ReactElement): Promise<Uint8Array> {
  const instance = pdf(element)
  const buffer = await instance.toBuffer()
  return new Uint8Array(buffer)
}

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46])   // %PDF

function isPdf(bytes: Uint8Array): boolean {
  return bytes[0] === PDF_MAGIC[0] && bytes[1] === PDF_MAGIC[1] &&
         bytes[2] === PDF_MAGIC[2] && bytes[3] === PDF_MAGIC[3]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

Deno.test("WeeklyAthleteReport renders valid PDF bytes", async () => {
  const element = React.createElement(WeeklyAthleteReport, { data: weeklyFixture })
  const bytes = await renderToPdfBytes(element)

  assert(isPdf(bytes), "PDF header %PDF not found")
  assertGreater(bytes.length, 5_000,  "PDF too small (< 5KB)")
  assert(bytes.length < 2_000_000,   "PDF too large (> 2MB)")
})

Deno.test("MonthlySquadReport renders valid PDF bytes", async () => {
  const element = React.createElement(MonthlySquadReport, { data: squadFixture })
  const bytes = await renderToPdfBytes(element)

  assert(isPdf(bytes), "PDF header %PDF not found")
  assertGreater(bytes.length, 5_000,  "PDF too small (< 5KB)")
  assert(bytes.length < 2_000_000,   "PDF too large (> 2MB)")
})

Deno.test("RaceReadinessReport renders valid PDF bytes", async () => {
  const element = React.createElement(RaceReadinessReport, { data: raceFixture })
  const bytes = await renderToPdfBytes(element)

  assert(isPdf(bytes), "PDF header %PDF not found")
  assertGreater(bytes.length, 5_000,  "PDF too small (< 5KB)")
  assert(bytes.length < 2_000_000,   "PDF too large (> 2MB)")
})

Deno.test("RaceReadinessReport handles null predictedTime gracefully", async () => {
  const fixture = { ...raceFixture, predictedTime: null, predictionBasis: undefined }
  const element = React.createElement(RaceReadinessReport, { data: fixture })
  const bytes = await renderToPdfBytes(element)

  assert(isPdf(bytes), "PDF header %PDF not found")
  assertGreater(bytes.length, 5_000, "PDF too small with null predictedTime")
})

Deno.test("WeeklyAthleteReport renders with empty sessions list", async () => {
  const fixture = { ...weeklyFixture, sessions: [], insights: [] }
  const element = React.createElement(WeeklyAthleteReport, { data: fixture })
  const bytes = await renderToPdfBytes(element)

  assert(isPdf(bytes), "PDF header %PDF not found")
  assertGreater(bytes.length, 5_000, "PDF too small with empty sessions")
})

Deno.test("MonthlySquadReport renders with single athlete", async () => {
  const fixture = { ...squadFixture, athletes: [squadFixture.athletes[0]] }
  const element = React.createElement(MonthlySquadReport, { data: fixture })
  const bytes = await renderToPdfBytes(element)

  assert(isPdf(bytes), "PDF header %PDF not found")
  assertGreater(bytes.length, 5_000, "PDF too small with single athlete")
})
