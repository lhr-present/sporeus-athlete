# Sporeus Athlete Console

Bloomberg Terminal-inspired PWA for endurance athletes.

**Live:** https://lhr-present.github.io/sporeus-athlete/

## Features

| Tab | Contents |
|-----|----------|
| Dashboard | 7-day training load, readiness status, session history |
| Zone Calc | HR zones (Tanaka), Power zones (Coggan), Pace zones (McMillan) |
| Protocols | Cooper, Ramp, Beep, Conconi, Blood Lactate |
| Training Log | Session logger with RPE→TSS, full history, localStorage persistence |
| Macro Plan | 13-week polarized periodization planner with zone distribution |
| Glossary | 12 sport science terms (EN/TR), sourced from EŞİK/THRESHOLD |
| Profile | Athlete stats, install instructions |

## Tech stack

- React 18 + Vite 6
- vite-plugin-pwa (offline, installable)
- IBM Plex Mono/Sans fonts
- Zero dependencies beyond React
- All state persisted to `localStorage`

## Dev

```bash
npm install
npm run dev
```

## Deploy

Push to `main` — GitHub Actions deploys to Pages automatically.

Manual: `npm run deploy`

## Based on

**EŞİK / THRESHOLD** — Hüseyin Akbulut (sporeus.com, 2026)  
Turkey's first comprehensive endurance science book, 540 pages.
