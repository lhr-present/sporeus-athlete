# Sporeus Athlete Console

Bloomberg Terminal-inspired PWA for elite endurance athletes.

**Live:** https://lhr-present.github.io/sporeus-athlete/
**Repo:** https://github.com/lhr-present/sporeus-athlete

## Features

| Category | Features |
|----------|----------|
| Training Zones | HR (Tanaka), Power (Coggan FTP), Pace (LT-based), Race Predictor (Riegel) |
| Test Protocols | Cooper, Conconi, Beep, Ramp FTP, Blood Lactate, 20-min FTP, Wingate, YYIR1, 1RM Epley, Astrand |
| Training Log | RPE/TSS logger, time-in-zone fields, CSV export, session history |
| Analytics | TSS trend, CTL/ATL/TSB, weekly volume stacked chart, zone donut, monotony/strain, personal records, full fitness timeline |
| Workout Plans | Periodized plan generator (5K to marathon), phase auto-calculation, daily session cards, "Log this session" prefill |
| Recovery | Daily wellness survey (sleep, soreness, energy, mood, stress), readiness score, 7-day sparkline |
| Body & Nutrition | Navy body fat %, BMI, Mifflin-St Jeor TDEE, protein/carb targets, race day fueling table |
| Social | Shareable athlete card (Canvas PNG download), Web Share API |
| UX | Dark mode (☾/☀ toggle), TR/EN bilingual, 4-step onboarding wizard, notification reminders, PWA installable |
| Test Comparison | Side-by-side test result comparison with % delta and progress arrows |

## Tech Stack

- React 18 (single App.jsx, zero external UI libs)
- Vite 6 + vite-plugin-pwa (Workbox service worker, offline-ready)
- Pure SVG charts — no chart libraries
- Canvas 2D API for athlete card PNG download
- localStorage persistence throughout
- GitHub Actions → GitHub Pages (auto-deploy on push)

## Run Locally

```bash
npm install
npm run dev   # http://localhost:5173/sporeus-athlete/
```

## Deploy

Push to `main` — GitHub Actions builds and deploys in ~30s.

Manual: `npm run deploy`

## Author

**Hüseyin Akbulut** — BSc Sport Sciences (Rowing), MSc Neuroscience, Marmara University
[sporeus.com](https://sporeus.com) · Based on **EŞİK / THRESHOLD** — Turkey's first comprehensive endurance science book (2026)
