/**
 * tests/e2e/helpers/auth.ts — Playwright auth helpers
 *
 * Two modes:
 *   injectSession(page, user) — pre-injects a real Supabase session into
 *     localStorage before page.goto(), bypassing the login UI. Use this for
 *     Paths 2-5 where authentication is a precondition, not the thing being tested.
 *
 *   signUpViaUI(page, email, password) — clicks through the actual sign-up form.
 *     Use for Path 1 where the signup flow IS the test.
 *
 * localStorage bypass keys:
 *   sporeus-consent-v1     = '1.1'   (CONSENT_VERSION — skips GDPR modal)
 *   sporeus-onboarded      = 'true'  (skips OnboardingWizard)
 *   sporeus-lang           = '"en"'  (force English — deterministic selectors)
 */
import { Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from '../../fixtures/factories.js'

// supabase-js v2 localStorage key: sb-{projectRef}-auth-token
// projectRef is the subdomain of the Supabase URL.
function storageKey(supabaseUrl: string): string {
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0]
    return `sb-${ref}-auth-token`
  } catch {
    return 'sb-auth-token'
  }
}

/** Sign in via Supabase password auth and return the raw session JSON. */
async function getSession(email: string, password: string): Promise<string> {
  const url    = requireEnv('E2E_SUPABASE_URL')
  const anon   = requireEnv('E2E_SUPABASE_ANON_KEY')
  const client = createClient(url, anon, { auth: { persistSession: false } })

  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`getSession(${email}): ${error?.message ?? 'no session returned'}`)
  }
  return JSON.stringify(data.session)
}

/**
 * Inject a real Supabase session into the page's localStorage before navigation.
 * Also sets consent + onboarding bypass keys so modals don't block tests.
 *
 * Call BEFORE page.goto().
 */
export async function injectSession(
  page: Page,
  user: { email: string; password: string },
): Promise<void> {
  const url         = requireEnv('E2E_SUPABASE_URL')
  const sessionJson = await getSession(user.email, user.password)
  const sbKey       = storageKey(url)

  await page.addInitScript(
    ({ key, session, consentKey, consentVal, onboardKey }) => {
      // Supabase session
      localStorage.setItem(key, session)
      // Skip GDPR consent modal (CONSENT_VERSION = '1.1')
      localStorage.setItem(consentKey, consentVal)
      // Skip onboarding wizard
      localStorage.setItem(onboardKey, 'true')
      // Force English UI for deterministic selectors
      localStorage.setItem('sporeus-lang', '"en"')
    },
    {
      key:        sbKey,
      session:    sessionJson,
      consentKey: 'sporeus-consent-v1',
      consentVal: '1.1',
      onboardKey: 'sporeus-onboarded',
    },
  )
}

/**
 * Navigate to the app and click through the email/password sign-up form.
 * For Path 1 — where the signup flow IS the thing under test.
 *
 * Supabase email confirmation is disabled in E2E test branches
 * (set via Dashboard → Auth → Email → "Enable email confirmations" = OFF,
 *  or use a Inbucket/Mailpit SMTP capture in CI — see README.md).
 */
export async function signUpViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/')
  // Click "Sign up" mode toggle
  await page.getByRole('button', { name: /sign up/i }).click()

  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /create account|sign up/i }).click()
}

/**
 * Navigate to the app and sign in via the email/password form.
 * Slower than injectSession — only use when the sign-in UI is part of the test.
 */
export async function signInViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/')
  // The form defaults to 'login' mode
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|login/i }).click()
}

/**
 * Click the named tab in the app's main nav.
 * Tab labels are uppercase English strings (e.g. 'TRAINING LOG', 'PROFILE').
 */
export async function clickTab(page: Page, tabLabel: string): Promise<void> {
  await page.getByRole('tab', { name: new RegExp(tabLabel, 'i') }).click()
}

/**
 * Wait for the auth gate to disappear (i.e. the user is now signed in
 * and the main app shell is visible).
 */
export async function waitForAppShell(page: Page): Promise<void> {
  // The app header is only rendered when authenticated + onboarded
  await page.waitForSelector('header', { timeout: 15_000 })
  // Confirm the tab bar is present
  await page.waitForSelector('[role="tablist"]', { timeout: 10_000 })
}
