# Sporeus Athlete Console v6.0.0 — Launch Release

**April 15, 2026**

---

Sporeus Athlete Console v6.0.0 ships today alongside the THRESHOLD book launch — the science text that underpins every formula in this app. After eight months of incremental builds, the platform is now a full-stack progressive web app: 570 unit tests, a 91 KB gzip initial bundle, and a CI gate that blocks every deploy that can't pass a clean test run.

## What's new in v6.0.0

**Contextual upsell system (M1).** Six trigger conditions — ACWR danger, accumulated fatigue, low consistency, and first check-in — surface a dismissible card in the Today tab after each wellness check-in. Per-trigger dismissal is persisted to localStorage. Impressions are logged for analytics. All four triggers have unit tests; null case is covered.

**Embeddable widget (M2).** A 3 KB standalone `embed.js` injects a fixed bottom-right "Track your training →" button on any host page. Clicking it opens an iframe overlay pointing to `?embed=true`, which strips the app's navigation and renders only the Today view. On check-in, the iframe posts a `sporeus-checkin-complete` message so the host page can react — score surfaced in the trigger button for 4 seconds.

**Referral system (M3).** Coaches on the coach or club tier get a deterministic "SP-XXXXXXXX" referral code (djb2 hash of their user ID). A new Supabase migration adds `referral_codes` and `referral_rewards` tables with RLS. The Profile tab shows the code, a copyable share URL, and live usage stats. Every three referrals triggers a reward row.

**Launch countdown (M4).** A dismissible orange banner in the Today tab counts down to April 15, then flips to "Now available →". A canvas-based social share button draws a 600×320 dark-mode PNG with athlete name, readiness score, ACWR, and a 7-day TSS bar chart, then invokes the Web Share API (or falls back to download).

**Prompt pack CTA (M5).** Athletes active for 7+ days see a collapsed card in Profile offering the Sporeus Audit Prompt Pack — 40 structured coaching prompts for use with the Claude AI integration. Collapses by default; no impression until the user opts in.

## Numbers

| Metric | v5.50.0 | v6.0.0 |
|---|---|---|
| Unit tests | 558 | 570 |
| Initial bundle | 87.4 KB gz | 91.5 KB gz |
| Components | 25+ | 27 |
| New lib modules | — | bookUpsell, referral |

The +4 KB bundle delta is entirely the Today tab additions (upsell, countdown, share). Recharts remains lazy-loaded; the initial bundle contains no chart code.

---

*Built with Claude Sonnet 4.6. Live at lhr-present.github.io/sporeus-athlete/*
