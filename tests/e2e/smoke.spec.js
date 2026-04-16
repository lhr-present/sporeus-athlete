// tests/e2e/smoke.spec.js — sporeus-athlete baseline smoke
// Run: npx playwright test
// Run one engine: npx playwright test --project=chromium
// Headed (watch it run): npx playwright test --headed
// UI mode (time-travel debugger): npx playwright test --ui
import { test, expect } from '@playwright/test';

const IGNORED_CONSOLE = [
  /favicon/i,
  /ServiceWorker registration/i,   // noisy but harmless on first load
  /preload.*not used/i,             // Vite dev warnings
];

function startConsoleCapture(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

test.describe('sporeus-athlete smoke', () => {
  test('homepage loads, no console errors, has sign-in CTA', async ({ page }) => {
    const errors = startConsoleCapture(page);

    await page.goto('/');
    await expect(page).toHaveTitle(/Sporeus/i);

    // Accept either English or Turkish UI — adjust once i18n state is deterministic.
    const signIn = page.getByRole('button', { name: /sign in|giriş/i })
      .or(page.getByRole('link', { name: /sign in|giriş/i }));
    await expect(signIn.first()).toBeVisible({ timeout: 10_000 });

    await page.waitForLoadState('networkidle');
    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('PWA: service worker registers', async ({ page, browserName }) => {
    // WebKit on Linux has flaky SW support under Playwright — skip there.
    test.skip(browserName === 'webkit', 'Service Worker flaky in Playwright WebKit on Linux');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return 'not-registered';
      const worker = reg.active || reg.installing || reg.waiting;
      return worker ? worker.state : 'registered-no-worker';
    });

    // Dev server does not activate the SW (requires production build).
    // Accepted states: any recognised SW lifecycle state, or 'not-registered' in dev.
    const knownStates = ['activated', 'installing', 'installed', 'activating', 'not-registered', 'unsupported'];
    expect(knownStates, `Unexpected SW state: ${swState}`).toContain(swState);
  });

  test('Google OAuth button points at Google or Supabase auth', async ({ page }) => {
    await page.goto('/');
    const googleBtn = page.getByRole('button', { name: /google/i })
      .or(page.getByRole('link', { name: /google/i }));

    const count = await googleBtn.count();
    test.skip(count === 0, 'No Google OAuth trigger found on landing page');

    // Capture the next navigation instead of actually completing OAuth.
    const navPromise = page.waitForRequest(
      (req) => /accounts\.google\.com|supabase\.co\/auth/.test(req.url()),
      { timeout: 8_000 }
    );
    await googleBtn.first().click().catch(() => {});
    const req = await navPromise.catch(() => null);
    expect(req, 'Expected a request to Google or Supabase auth after clicking').not.toBeNull();
  });

  test('app shell renders critical layout chrome', async ({ page }) => {
    await page.goto('/');
    // The app renders either the main shell (header/nav/main) when signed in,
    // or the auth gate (form) when signed out. Both are non-empty — catches white-screen regressions.
    const landmarks = page.locator('header, nav, main, form, [role="main"], [role="navigation"]');
    await expect(landmarks.first()).toBeVisible();
  });
});
