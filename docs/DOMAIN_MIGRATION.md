# Domain Migration: app.sporeus.com

## Status

- [x] Code changes committed (base path, manifest, SW, redirects)
- [ ] DNS record added in GoDaddy
- [ ] Supabase redirect URLs updated
- [ ] Old GH Pages URL verified to redirect → new domain

---

## DNS record to add in GoDaddy

Log in to GoDaddy → Domains → sporeus.com → DNS Management.

Add one record:

| Type  | Name | Value                        | TTL      |
|-------|------|------------------------------|----------|
| CNAME | app  | lhr-present.github.io        | 1 hour   |

> **Note:** GoDaddy shows `lhr-present.github.io` (no trailing dot). Some registrars
> require a trailing dot — omit it in GoDaddy.

After saving, propagation typically takes 5–30 minutes. GitHub Pages will automatically
issue a free TLS certificate via Let's Encrypt (may take up to 10 minutes after DNS
resolves).

---

## Verify after DNS propagates

```bash
# 1. DNS resolves
dig app.sporeus.com CNAME +short
# Expected: lhr-present.github.io.

# 2. HTTPS loads
curl -sI https://app.sporeus.com/ | grep "HTTP/"
# Expected: HTTP/2 200

# 3. Old URL redirects (GitHub Pages automatic redirect when CNAME is set)
curl -sI https://lhr-present.github.io/sporeus-athlete/ | grep -E "HTTP/|Location"
# Expected: HTTP/1.1 301 → Location: https://app.sporeus.com/sporeus-athlete/ (GH Pages redirect)

# 4. Run smoke tests against production
PLAYWRIGHT_BASE_URL=https://app.sporeus.com/ npm run test:e2e -- --project=chromium
```

---

## Rollback plan

If anything breaks before DNS fully propagates:
1. Delete the CNAME record in GoDaddy
2. Revert `public/CNAME` in the repo and redeploy
3. The old GH Pages URL `lhr-present.github.io/sporeus-athlete/` resumes serving

GitHub Pages will re-enable the old subdomain URL within ~5 minutes of removing the CNAME.
