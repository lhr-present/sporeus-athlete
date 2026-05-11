/**
 * Path 6 — Beginner mission invariants (v9.67–v9.70 regression lock)
 *
 * Locks the four day-1 beginner invariants we just stabilized:
 *   v9.67.0  athleteLevel normalization → dashSimple branch fires for 'beginner'
 *   v9.68.0  DailyBriefingCard non-null empty state + onGoToProfile wired +
 *            showAdvanced persisted to localStorage
 *   v9.69/70 No dual-language empty-state surfaces
 *
 * Guest mode (no auth, no Supabase preview branch). Beginner invariants are
 * pure UI state — auth would add infra cost without coverage benefit. We
 * pre-seed localStorage with a beginner profile + empty log via
 * page.addInitScript, then exercise the dashboard.
 *
 * MissionHeadline is intentionally bilingual (a brand banner with
 * 'BUILD YOUR YEARLY PROGRAM · YILLIK PROGRAMINI OLUŞTUR'). It is
 * allow-listed in assertion #3 — that's a deliberate design call, not the
 * empty-state explanation anti-pattern v9.69/70 fixed.
 */
import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PERF_FILE = path.join(HERE, 'perf-baseline.json')

function recordTiming(name: string, ms: number) {
  let baseline: Record<string, number[]> = {}
  try { baseline = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8')) } catch { /* fresh file */ }
  baseline[name] = [...(baseline[name] ?? []).slice(-9), ms]
  fs.writeFileSync(PERF_FILE, JSON.stringify(baseline, null, 2))
}

const BEGINNER_PROFILE = {
  name: 'TestBeginner',
  sport: 'running',
  primarySport: 'running',
  athleteLevel: 'beginner',
  age: '30',
  gender: 'male',
}

async function seedBeginnerGuest(page: Page, lang: 'en' | 'tr') {
  await page.addInitScript(
    ({ profile, lang }) => {
      localStorage.setItem('sporeus-onboarded', 'true')
      localStorage.setItem('sporeus-profile', JSON.stringify(profile))
      localStorage.setItem('sporeus_log', '[]')
      localStorage.setItem('sporeus-eliteProgram', 'null')
      localStorage.setItem('sporeus-show-advanced', 'false')
      localStorage.setItem('sporeus-lang', lang)
      // Bypass consent gate (path1 shows it can be skipped via button click;
      // for a deterministic non-auth path we set a sane default here).
      localStorage.setItem('sporeus-gdpr-consent', JSON.stringify({ accepted: true, ts: Date.now() }))
    },
    { profile: BEGINNER_PROFILE, lang },
  )
}

for (const lang of ['en', 'tr'] as const) {
  test.describe(`Path 6 — beginner mission invariants (${lang.toUpperCase()})`, () => {
    test.beforeEach(async ({ page }) => {
      await seedBeginnerGuest(page, lang)
    })

    test(`[${lang}] 1. mission cards: MissionHeadline appears before EliteProgramCard`, async ({ page }) => {
      const t0 = Date.now()
      await page.goto('/')

      const mission = page.getByRole('region', { name: /Mission · Görev/ })
      const program = page.locator('[data-elite-program-card]').first()

      await expect(mission).toBeVisible({ timeout: 10_000 })
      await expect(program).toBeVisible({ timeout: 10_000 })

      // DOM-order check: MissionHeadline must precede EliteProgramCard
      const beforeProgram = await mission.evaluate((m, p) => {
        const pos = m.compareDocumentPosition(p as Node)
        // Node.DOCUMENT_POSITION_FOLLOWING === 4
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      }, await program.elementHandle())

      expect(beforeProgram, 'MissionHeadline must render before EliteProgramCard').toBe(true)

      recordTiming(`path6_${lang}_mission_order`, Date.now() - t0)
    })

    test(`[${lang}] 2. DailyBriefingCard renders mission-framed placeholder (NOT null)`, async ({ page }) => {
      await page.goto('/')

      const headerText = lang === 'tr' ? '◈ GÜNLÜK REÇETE' : '◈ DAILY BRIEFING'
      const header = page.getByText(headerText).first()
      await expect(header).toBeVisible({ timeout: 10_000 })

      // The card must have more than just the header — assert the mission
      // chain text appears in the same card.
      const card = header.locator('xpath=ancestor::div[1]')
      const placeholderNeedle = lang === 'tr'
        ? 'hedef → fizyoloji → plan → günlük cevap'
        : 'target → physiology → plan → daily answer'

      await expect(card).toContainText(placeholderNeedle)
    })

    test(`[${lang}] 3. no dual-language empty-state surfaces (MissionHeadline allow-listed)`, async ({ page }) => {
      await page.goto('/')

      // Let lazy dashboard cards settle
      await page.waitForLoadState('networkidle')

      const violations = await page.evaluate(() => {
        const main = document.querySelector('main')
        if (!main) return ['no <main> element']

        const ALLOW_LIST_SELECTOR = '[aria-label*="Mission"]'
        const TR_CHARS = /[şŞçÇğĞıİüÜöÖ]/
        const EN_WORD  = /[A-Za-z]{4,}/

        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
        const hits: string[] = []
        let node: Node | null
        while ((node = walker.nextNode())) {
          const text = (node.textContent || '').trim()
          if (!text) continue
          // Skip if ancestor is in the allow-list (MissionHeadline)
          let el: Element | null = node.parentElement
          let allowed = false
          while (el) {
            if (el.matches?.(ALLOW_LIST_SELECTOR)) { allowed = true; break }
            el = el.parentElement
          }
          if (allowed) continue
          // Skip aria-hidden separators
          if (node.parentElement?.getAttribute('aria-hidden') === 'true') continue
          // The actual check
          if (TR_CHARS.test(text) && EN_WORD.test(text)) {
            hits.push(text.slice(0, 120))
          }
        }
        return hits
      })

      expect(violations, `dual-language surfaces found: ${violations.join(' | ')}`).toEqual([])
    })

    test(`[${lang}] 4. SHOW ADVANCED persists across reload (v9.68.0 useLocalStorage)`, async ({ page }) => {
      await page.goto('/')

      const showBtn = page.getByText(
        lang === 'tr' ? /İLERİ ANALİZLERİ GÖSTER/ : /SHOW ADVANCED ANALYTICS/,
      )
      await expect(showBtn).toBeVisible({ timeout: 10_000 })
      await showBtn.click()

      // localStorage updated
      const stored = await page.evaluate(() => localStorage.getItem('sporeus-show-advanced'))
      expect(stored).toBe('true')

      // Button now says SIMPLE VIEW (or TR equivalent)
      const simpleBtn = page.getByText(lang === 'tr' ? /BASİT GÖRÜNÜM/ : /SIMPLE VIEW/)
      await expect(simpleBtn).toBeVisible({ timeout: 5_000 })

      // Reload, state survives
      await page.reload()
      const storedAfter = await page.evaluate(() => localStorage.getItem('sporeus-show-advanced'))
      expect(storedAfter).toBe('true')
      await expect(page.getByText(lang === 'tr' ? /BASİT GÖRÜNÜM/ : /SIMPLE VIEW/)).toBeVisible({ timeout: 10_000 })
    })

    test(`[${lang}] 5. three must-stay tabs reachable for beginners`, async ({ page }) => {
      await page.goto('/')

      // Tab labels are localized via t() — match either language
      const labels: Record<'profile' | 'zones' | 'sport', RegExp> = {
        profile: /PROFILE|PROFİL/i,
        zones:   /ZONE CALC|ZON HESAP/i,
        sport:   /SPORT PLAN|SPOR PLAN/i,
      }

      for (const key of ['profile', 'zones', 'sport'] as const) {
        const tabBtn = page.getByRole('tab', { name: labels[key] }).first()
        await expect(tabBtn, `tab "${key}" should exist`).toBeVisible({ timeout: 10_000 })
        await tabBtn.click()
        // aria-selected becomes true once route lands
        await expect(tabBtn).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 })
        // No global error boundary tripped
        await expect(page.locator('text=/something went wrong|bir hata oluştu/i')).toHaveCount(0)
      }
    })

    test(`[${lang}] 6. EliteMetricsStrip is clickable → Profile (v9.68.0 onGoToProfile wired)`, async ({ page }) => {
      await page.goto('/')

      // Beginner with no FTP/VO2max: strip shows the "Add FTP and VO2max" fallback.
      // That fallback div is itself clickable in the advanced branch but NOT in
      // the beginner branch's fallback (it's the items-list div that's clickable).
      // For this test we trust that the EliteMetricsStrip parent ErrorBoundary in
      // the beginner branch passes onGoToProfile (v9.68.0 fix). Cover the click
      // surface by targeting the prominent items-row if present, otherwise via
      // the EliteMetricsStrip fallback text.
      const stripFallback = page.getByText(/Add FTP and VO2max|FTP ve VO2max ekle/i).first()
      if (await stripFallback.isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Fallback path: strip shows "add FTP" message. v9.68.0 wired
        // onGoToProfile to the strip's parent click handler. For coverage of the
        // wiring itself, assert the prop arrives — check via the strip's parent
        // div's cursor style or click handler.
        const strip = stripFallback.locator('xpath=ancestor::div[contains(@style,"cursor")][1]')
        if (await strip.count() > 0) {
          await strip.click({ timeout: 3_000 }).catch(() => { /* fallback div may not be clickable */ })
        }
      } else {
        // Strip rendered with metrics — click it
        const wkg = page.getByText(/W\/kg|VDOT|MaxHR|MaksKA/).first()
        if (await wkg.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await wkg.click()
        }
      }

      // After any successful click, Profile tab should be active.
      // If neither path produced a click, this assertion fails loudly — that
      // would mean onGoToProfile is wired but unreachable, which is the bug.
      const profileTab = page.getByRole('tab', { name: /PROFILE|PROFİL/i }).first()
      await expect(profileTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 })
    })
  })
}
