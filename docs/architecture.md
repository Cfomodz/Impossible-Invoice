# Architecture Overview

## System Diagram

```
┌──────────────┐  workflow_dispatch  ┌──────────────────┐
│              │ ──────────────────→ │                  │
│  CRM/Zapier  │                     │  GitHub Actions  │
│  webhook     │                     │  1. Build HTML   │
│              │                     │  2. Generate CSS │
│              │                     │  3. wrangler dep │
│              │  JSON invoice data  │  4. Register D1  │
└──────────────┘                     └────────┬─────────┘
                                              │
                    ┌─────────────────────────┘│
                    │  Cloudflare Worker       ││
                    │  "invoice-system"        │▼
                    │                          │
                    │  Static Assets (free)    │
                    │  /invoice/{uuid}/        │
                    │                          │
                    │  Cron: 0 9 * * * (daily) │
                    │  → Query D1 for expired  │
                    │  → Send email via Resend │
                    │                          │
                    │  Bindings: D1, RESEND_KEY│
                    └──────────────────────────┘
```

## Three-Layer Architecture

### 1. Static Layer

Pre-built HTML/CSS/JS files served from Cloudflare's edge CDN with **zero Worker invocations**.

- Each invoice lives at `/invoice/{uuid}/index.html`
- Contains hardcoded UTC expiry timestamp
- Includes countdown timer, self-destruct animation code, Calendly embed config
- Pages load in under 50ms globally thanks to edge caching
- Served free via Cloudflare's asset pipeline

### 2. Worker Layer

A TypeScript Worker handles server-side logic:

- **`/api/register`** — POST endpoint called during deployment to register invoice metadata in D1
- **`scheduled()`** — Daily cron handler that queries D1 for expired invoices, sends emails via Resend, marks as sent
- Only API routes invoke the Worker (configured via `run_worker_first = ["/api/*"]`)

### 3. Data Layer

Cloudflare D1 (SQLite at the edge) stores invoice metadata.

**Why D1 over KV?**
- Cron needs to query by expiry timestamp: `WHERE expiry_timestamp < ? AND email_sent = 0`
- KV cannot do indexed queries without manual secondary indexes
- D1 provides strong consistency for tracking send status, preventing duplicate emails

## Build-Time Pipeline

```
Invoice JSON → Extract Design Tokens → LLM CSS Generation → EJS Render → Static HTML
                  (Playwright)           (Claude API)         (build.js)    (public/)
```

1. **Input**: JSON invoice data (from GitHub Actions `workflow_dispatch`)
2. **Token Extraction**: Playwright visits client website, captures computed styles, takes screenshot
3. **CSS Generation**: Claude API receives tokens + screenshot, generates scoped CSS
4. **Template Rendering**: EJS template populated with invoice data + brand CSS
5. **Output**: `public/invoice/{uuid}/index.html` + static assets
6. **Deploy**: `wrangler deploy` pushes everything to Cloudflare
7. **Register**: POST to `/api/register` stores metadata in D1

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single Worker project (not Pages + Workers) | Unifies cron triggers, D1 access, and static serving under one deploy command |
| `run_worker_first = ["/api/*"]` | Static pages served free from CDN; Worker only invoked for API routes |
| UUID v4 for invoice URLs | 122 bits of randomness; brute-force infeasible |
| `requestAnimationFrame` for countdown | Battery-efficient, auto-pauses in background tabs, syncs with repaint |
| EJS templates | Lowest friction for single-page generation, supports async rendering |
| D1 over KV | Cron needs indexed queries; D1 provides SQL and strong consistency |
| Resend for email | MailChannels free integration ended Aug 2024; Resend officially recommended |
| html2canvas for disintegration | Only ~40KB; captures DOM to canvas for pixel manipulation |
| PostCSS for CSS validation | Catches unscoped selectors; auto-prefixes with `.invoice-container` |
| Fallback CSS | Build never fails even if client website unreachable or LLM API down |

## Security Model

- **URL Security**: UUID v4 provides 5.3 x 10^36 possible values
- **No Indexing**: `robots.txt` + meta tags + `X-Robots-Tag` header
- **No Caching**: `Cache-Control: no-store` after expiry
- **No Framing**: `X-Frame-Options: DENY`
- **No Leaking**: `Referrer-Policy: no-referrer`
- **CSP**: Whitelists only self + Calendly domains
- **Optional**: Email verification gate for high-value invoices

## Cost (Cloudflare Free Tier)

| Service | Free Allocation | Typical Usage |
|---------|----------------|---------------|
| Workers | 100K requests/day | ~100/day |
| D1 | 5M reads/month | ~1000/month |
| Static Assets | Unlimited | ~100 pages |
| Resend | 3K emails/month | ~50/month |
| GitHub Actions | 2K minutes/month | ~100 min/month |
| Claude API | Pay-per-use | ~$0.01-0.03/invoice |
