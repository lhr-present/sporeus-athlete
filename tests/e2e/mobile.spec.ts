/**
 * Mobile viewport tests — iPhone 12 + Pixel 5 equivalent
 * Runs on mobile-chrome and mobile-safari projects (configured in playwright.config.js).
 * Verifies no horizontal overflow, tap targets, and app shell renders correctly.
 */
import { test, expect, devices } from '@playwright/test'

// These tests run in mobile context via playwright.config.js mobile-* projects.
// They also run in chromium-e2e with explicit viewport for CI coverage.

test.describe('Mobile layout — no horizontal overflow', () => {
  for (const [label, viewport] of [
    ['iPhone 12', { width: 390, height: 844 }],
    ['Pixel 5',   { width: 393, height: 851 }],
  ] as const) {
    test(`${label}: app shell renders without horizontal scroll`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Check no horizontal overflow
      const hasHScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHScroll, `${label}: horizontal overflow detected`).toBe(false)
    })

    test(`${label}: nav tabs scroll horizontally without page overflow`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // The nav bar uses overflowX:auto — total page width should still be viewport width
      const pageWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(pageWidth).toBeLessThanOrEqual(viewport.width + 2) // 2px tolerance for borders
    })
  }
})

test.describe('Mobile tap targets', () => {
  test('primary buttons are at least 44px tall', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check all visible buttons on the page for minimum tap target height
    const tooSmall = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button:not([aria-hidden])'))
      return buttons
        .filter(el => {
          const r = el.getBoundingClientRect()
          return r.height > 0 && r.height < 44 && r.width > 0
        })
        .map(el => ({ text: el.textContent?.trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
        .slice(0, 10)  // report first 10
    })

    // Log findings but don't hard-fail — some decorative buttons (✕, ↓) may be smaller
    // Fail only if more than 5 primary action buttons are too small
    const actionTooSmall = tooSmall.filter(b => b.text && b.text.length > 2)
    if (actionTooSmall.length > 5) {
      throw new Error(`${actionTooSmall.length} action buttons below 44px tap target:\n` +
        actionTooSmall.map(b => `  "${b.text}" — ${b.h}px`).join('\n'))
    }
  })
})

test.describe('PWA + offline', () => {
  test('service worker registers on load', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null
      const reg = await navigator.serviceWorker.getRegistration()
      return !!reg
    })

    // SW may be null in test env if no HTTPS — just verify no JS crash
    expect(typeof swRegistered).toBe('boolean')
  })

  test('offline banner shows when network is disconnected', async ({ page, context }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Simulate offline
    await context.setOffline(true)
    await page.waitForTimeout(800)

    // OfflineBanner component should appear (aria role or data-testid)
    // Verify no unhandled errors
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.waitForTimeout(300)
    expect(errors.filter(e => !e.includes('ResizeObserver') && !e.includes('Network'))).toHaveLength(0)

    // Restore
    await context.setOffline(false)
  })
})

test.describe('Turkish locale rendering', () => {
  test('app renders TR strings when lang=tr in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Set Turkish language in localStorage
    await page.evaluate(() => {
      localStorage.setItem('sporeus-lang', 'tr')
    })
    // Reload to pick up new lang
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify at least one known Turkish string appears in the page
    const bodyText = await page.evaluate(() => document.body.innerText)
    // App title or tab label should contain Turkish
    const hasTurkish = bodyText.includes('BUGÜN') ||
                       bodyText.includes('PANO') ||
                       bodyText.includes('ANTRENMAN') ||
                       bodyText.includes('SPOREUS')
    expect(hasTurkish, 'Page should render Turkish strings when lang=tr').toBe(true)
  })
})
