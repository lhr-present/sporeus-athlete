# Deployment Guide

## Production URL

**https://app.sporeus.com** — hosted on GitHub Pages with custom domain.

---

## Supabase — Required URL configuration

After setting up the custom domain, update **Authentication → URL Configuration** in the
Supabase dashboard for project `pvicqwapvvfempjdgwbm`:

### Site URL
```
https://app.sporeus.com
```

### Redirect URLs (allow list)
Add all of these:
```
https://app.sporeus.com/
https://app.sporeus.com/**
https://lhr-present.github.io/sporeus-athlete/    ← keep during DNS transition
https://lhr-present.github.io/sporeus-athlete/**  ← keep during DNS transition
http://localhost:5173/
http://localhost:5173/**
```

The old GitHub Pages URLs must remain in the allow list until all existing OAuth sessions
have expired and all bookmarks / PWA installs have migrated to the custom domain.

---

## Environment variables (GitHub Actions Secrets)

| Secret | Description |
|--------|-------------|
| `VITE_SUPABASE_URL` | `https://pvicqwapvvfempjdgwbm.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_STRAVA_CLIENT_ID` | Strava OAuth client ID |
| `VITE_VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `VITE_DODO_CHECKOUT_COACH` | Dodo Payments checkout URL (Coach tier) |
| `VITE_DODO_CHECKOUT_CLUB` | Dodo Payments checkout URL (Club tier) |
| `VITE_STRIPE_CHECKOUT_COACH` | Stripe checkout URL (Coach tier, international) |

---

## Deploy workflow

```bash
# 1. Verify tests pass locally
npm test
npm run lint

# 2. Build and verify
npm run build

# 3. Commit and push — GitHub Actions handles deploy automatically
git push    # triggers: lint → test → build → deploy to GH Pages
```

The `public/CNAME` file is copied into `dist/` at build time by Vite.
GitHub Pages reads it and enforces the custom domain.
