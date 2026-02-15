# Security Reference

## URL Security

Invoice URLs use UUID v4 identifiers: 122 bits of randomness (~5.3 x 10^36 possible values). Brute-forcing is computationally infeasible.

**URL pattern**: `https://invoices.yourdomain.com/invoice/a1b2c3d4-e5f6-7890-abcd-ef1234567890/`

**Never use**:
- Sequential IDs (guessable)
- UUID v1 (leaks MAC address and timestamp)
- Short IDs or hash-based IDs (reduced entropy)

## Search Engine Prevention

### Meta Tags (in invoice HTML)

```html
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
```

### robots.txt (in public/)

```
User-agent: *
Disallow: /invoice/
```

## HTTP Security Headers

Applied to all `/invoice/*` routes via `public/_headers` file:

```
/invoice/*
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; script-src 'self' https://assets.calendly.com; frame-src https://calendly.com
```

### Header Explanations

| Header | Purpose |
|--------|---------|
| `X-Robots-Tag` | Prevents search engine indexing at the HTTP level |
| `Cache-Control: no-store` | Prevents browsers and CDNs from caching invoice content after expiry |
| `X-Content-Type-Options: nosniff` | Prevents MIME type sniffing attacks |
| `X-Frame-Options: DENY` | Prevents clickjacking by blocking iframe embedding |
| `Referrer-Policy: no-referrer` | Prevents URL leakage through referrer headers |
| `Content-Security-Policy` | Whitelists only self + Calendly; blocks all other script/frame sources |

## API Endpoint Security

### `/api/register` Authentication

- Requires `Authorization: Bearer {REGISTER_SECRET}` header
- `REGISTER_SECRET` is a shared secret stored in:
  - GitHub Actions secrets (for the register-invoice.js script)
  - Cloudflare Worker secrets (for the Worker to validate)
- Reject with `401 Unauthorized` if missing or invalid

### Rate Limiting

Consider adding rate limiting to `/api/register` via Cloudflare's built-in rate limiting rules or a simple in-memory counter in the Worker.

## Optional: Email Verification Gate

For high-value invoices, add a verification step before showing the invoice:

1. Page initially shows a verification prompt instead of the invoice
2. User enters their email address
3. Worker endpoint validates email against stored `client_email` in D1
4. On match: set a short-lived cookie/token and show the invoice
5. On mismatch: show generic "Invoice not found" message

This prevents casual link-sharing exposure with minimal friction.

## Data Privacy

- Invoice pages contain client names, email addresses, and financial amounts
- No data is sent to third parties except:
  - Calendly (via embed, only after expiry, with client consent via click)
  - Resend (email service, for expiry notification)
- D1 database stores minimal metadata (no full invoice content)
- Consider adding a data retention policy: delete D1 records after N days post-expiry
