// ─── useAdaptivePlan.js — Weekly adherence tracking + load adjustment ────────
// Compares actual log TSS per week against projected phase targets.
// Returns adherence history and next-week adjustment recommendation.
//
// Adjustment rules (Impellizzeri 2004 ramping model):
//   adherence < 0.65  → reduce next week by 20% (under-recovery risk)
//   adherence 0.65–0.79 → reduce by 10%
//   adherence 0.80–1.20 → on-track, no change
//   adherence 1.21–1.40 → warn: exceeded plan (>10% ramp risk)
//   adherence > 1.40  → flag: significant overreach — insert recovery week

import { useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage.js'

function weekKey(date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1) // Monday
  return d.toISOString().slice(0, 10)
}

function getWeekDates(mondayStr) {
  const start = new Date(mondayStr)
  const end   = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function getMonday(d = new Date()) {
  const day = d.getDay() || 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - day + 1)
  mon.setHours(0, 0, 0, 0)
  return mon.toISOString().slice(0, 10)
}

export function useAdaptivePlan(log, plan) {
  const [dismissed, setDismissed] = useLocalStorage('sporeus-adaptive-dismissed', {})

  const adaptation = useMemo(() => {
    if (!plan?.weeks?.length || !log?.length) return null

    const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date))
    const planStart = plan.start_date
    if (!planStart) return null

    const today = new Date().toISOString().slice(0, 10)
    const thisMonday = getMonday()
    const prevMonday = (() => {
      const d = new Date(thisMonday)
      d.setDate(d.getDate() - 7)
      return d.toISOString().slice(0, 10)
    })()

    // Find which plan week index last week corresponds to
    const planStartDate = new Date(planStart)
    const prevDate = new Date(prevMonday)
    const weekIndex = Math.floor((prevDate - planStartDate) / (7 * 86400000))
    if (weekIndex < 0 || weekIndex >= plan.weeks.length) return null

    const plannedWeek = plan.weeks[weekIndex]
    const plannedTSS  = plannedWeek?.TSS || plannedWeek?.tss || 0
    if (!plannedTSS) return null

    // Actual TSS in the previous week
    const { start, end } = getWeekDates(prevMonday)
    const actualTSS = sorted
      .filter(e => e.date >= start && e.date < end)
      .reduce((s, e) => s + (e.tss || 0), 0)

    const adherence = plannedTSS > 0 ? actualTSS / plannedTSS : null
    if (adherence === null) return null

    // Next week plan
    const nextWeekIndex = weekIndex + 1
    const nextWeek = plan.weeks[nextWeekIndex]
    const nextPlannedTSS = nextWeek?.TSS || nextWeek?.tss || 0

    let status, adjustPct, message, messageTr
    if (adherence > 1.40) {
      status = 'overreach'; adjustPct = 0
      message  = `Last week: ${Math.round(actualTSS)} TSS vs ${Math.round(plannedTSS)} planned (${Math.round(adherence * 100)}%). Significant overreach — consider a recovery day before resuming planned load.`
      messageTr = `Geçen hafta: ${Math.round(actualTSS)} TSS / ${Math.round(plannedTSS)} planlı (%${Math.round(adherence * 100)}). Önemli aşırı yüklenme — planlı yüke dönmeden önce toparlanma günü ekle.`
    } else if (adherence > 1.20) {
      status = 'exceeded'; adjustPct = 0
      message  = `Last week: ${Math.round(actualTSS)} TSS vs ${Math.round(plannedTSS)} planned (${Math.round(adherence * 100)}%). Above plan — monitor fatigue before adding more load.`
      messageTr = `Geçen hafta: ${Math.round(actualTSS)} TSS / ${Math.round(plannedTSS)} planlı (%${Math.round(adherence * 100)}). Plan üzeri — daha fazla yük eklemeden yorgunluğu izle.`
    } else if (adherence >= 0.80) {
      status = 'on_track'; adjustPct = 0
      message  = `Last week: ${Math.round(actualTSS)} TSS vs ${Math.round(plannedTSS)} planned (${Math.round(adherence * 100)}%). On track — proceed with planned load.`
      messageTr = `Geçen hafta: ${Math.round(actualTSS)} TSS / ${Math.round(plannedTSS)} planlı (%${Math.round(adherence * 100)}). Yolunda — planlı yükle devam et.`
    } else if (adherence >= 0.65) {
      status = 'under'; adjustPct = -10
      message  = `Last week: ${Math.round(actualTSS)} TSS vs ${Math.round(plannedTSS)} planned (${Math.round(adherence * 100)}%). Below plan — next week reduced 10% to avoid spike.`
      messageTr = `Geçen hafta: ${Math.round(actualTSS)} TSS / ${Math.round(plannedTSS)} planlı (%${Math.round(adherence * 100)}). Plan altı — ani artıştan kaçınmak için sonraki hafta %10 azaltıldı.`
    } else {
      status = 'low'; adjustPct = -20
      message  = `Last week: ${Math.round(actualTSS)} TSS vs ${Math.round(plannedTSS)} planned (${Math.round(adherence * 100)}%). Significantly under plan — next week reduced 20%.`
      messageTr = `Geçen hafta: ${Math.round(actualTSS)} TSS / ${Math.round(plannedTSS)} planlı (%${Math.round(adherence * 100)}). Plan çok altında — sonraki hafta %20 azaltıldı.`
    }

    const adjustedNextTSS = nextPlannedTSS > 0 && adjustPct !== 0
      ? Math.round(nextPlannedTSS * (1 + adjustPct / 100))
      : null

    return {
      weekIndex,
      prevMonday,
      actualTSS:      Math.round(actualTSS),
      plannedTSS:     Math.round(plannedTSS),
      adherence:      Math.round(adherence * 100),
      status,
      adjustPct,
      adjustedNextTSS,
      nextPlannedTSS: Math.round(nextPlannedTSS),
      message,
      messageTr,
    }
  }, [log, plan])

  const isDismissed = adaptation
    ? !!dismissed[`${adaptation.prevMonday}-${adaptation.weekIndex}`]
    : false

  const dismiss = () => {
    if (!adaptation) return
    setDismissed(prev => ({
      ...prev,
      [`${adaptation.prevMonday}-${adaptation.weekIndex}`]: true,
    }))
  }

  return { adaptation: isDismissed ? null : adaptation, dismiss }
}
