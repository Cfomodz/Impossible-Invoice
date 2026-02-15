# CLAUDE.md - Agent Instructions for Impossible Invoice System

## Project Overview

This is the **Mission Impossible Self-Destructing Invoice System** — a Cloudflare Worker with static assets, D1 database, and cron-triggered email expiry that creates a brand-matched invoice experience nudging prospects to act within 7 days. When the countdown hits zero, the invoice disintegrates with a "Thanos snap" animation, then shows a Calendly booking embed.

## Tech Stack

- **Runtime**: Cloudflare Workers (TypeScript)
- **Static Assets**: Pre-built HTML/CSS/JS served from Cloudflare's edge CDN
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Email**: Resend API (3,000 free emails/month)
- **Templates**: EJS (Embedded JavaScript templates)
- **CSS Generation**: Claude API (LLM-powered brand matching)
- **Design Token Extraction**: Playwright (headless Chromium)
- **Disintegration Effect**: html2canvas (~40KB)
- **CI/CD**: GitHub Actions with `workflow_dispatch`
- **Deployment**: `wrangler deploy` (single command deploys Worker + static assets)

## Architecture (3 Layers)

1. **Static Layer** — Pre-built HTML at `/invoice/{uuid}/index.html` with hardcoded expiry, countdown timer, self-destruct animation, and Calendly embed. Served free at the edge with zero Worker invocations.
2. **Worker Layer** — TypeScript Worker handles `/api/register` (POST, registers invoice in D1) and `scheduled()` (daily cron, sends expiry emails via Resend).
3. **Data Layer** — D1 stores invoice metadata. D1 chosen over KV because cron needs `WHERE expiry_timestamp < ? AND email_sent = 0` queries.

## Directory Structure

```
invoice-system/
├── .github/workflows/
│   └── generate-invoice.yml    # GitHub Actions: build + deploy
├── src/
│   └── index.ts                # Cloudflare Worker (cron + API)
├── templates/
│   ├── invoice.ejs             # Main invoice page template
│   └── expired.ejs             # Expired state template
├── static/
│   ├── countdown.js            # Countdown timer module
│   ├── self-destruct.js        # Thanos snap disintegration effect
│   └── base.css                # Base layout styles (non-brand)
├── scripts/
│   ├── build.js                # Main build script (Node.js)
│   ├── extract-design-tokens.js # Playwright -> design token extraction
│   ├── generate-css.js         # LLM-powered CSS generation
│   └── register-invoice.js     # POST to /api/register after deploy
├── public/                     # Build output (gitignored)
│   ├── invoice/{uuid}/index.html
│   └── robots.txt
├── docs/                       # Technical documentation
├── schema.sql                  # D1 database schema
├── wrangler.toml               # Cloudflare Worker config
├── package.json
├── tsconfig.json
└── .gitignore
```

## Key Commands

```bash
# Install dependencies
npm ci

# Local development
npx wrangler dev

# Test cron locally
npx wrangler dev --test-scheduled

# Build an invoice (needs INVOICE_DATA_FILE env var)
INVOICE_DATA_FILE=test-invoice.json node scripts/build.js

# Deploy to Cloudflare
npx wrangler deploy

# Create D1 database
npx wrangler d1 create invoice-db

# Apply D1 schema
npx wrangler d1 execute invoice-db --file=schema.sql

# Run tests
npm test
```

## Implementation Phases (see PLAN.md for details)

1. **Foundation** — Cloudflare Worker project setup, D1 database, GitHub repo config
2. **Static Invoice Page** — EJS template, countdown timer, self-destruct animation, Calendly embed
3. **Build Pipeline** — build.js script, GitHub Actions workflow with workflow_dispatch
4. **LLM CSS Matching** — Playwright extraction, Claude API CSS generation, PostCSS validation
5. **Expiry Email System** — Worker scheduled() handler, Resend integration, register-invoice.js
6. **Integration & Polish** — End-to-end pipeline, error handling, security headers, mobile testing

## Critical Design Decisions

- **Single Worker project** (not separate Pages + Workers) — unifies cron triggers, D1 access, and static serving under one deploy
- **`run_worker_first = ["/api/*"]`** — only API routes invoke Worker; static pages served free from CDN
- **UUID v4 for invoice URLs** — 122 bits of randomness, brute-force infeasible
- **`requestAnimationFrame` for countdown** — battery-efficient, auto-pauses in background tabs, syncs with repaint cycle
- **EJS over Handlebars/Nunjucks** — lowest friction for single-page generation, supports async rendering for LLM call
- **D1 over KV** — cron needs indexed queries by expiry_timestamp; KV can't do this without manual secondary indexes
- **Resend over MailChannels** — MailChannels free integration ended Aug 2024; Resend is officially recommended

## Security Requirements

- All invoice pages must include `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">`
- `robots.txt` must `Disallow: /invoice/`
- Security headers: `Cache-Control: no-store`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`
- CSP must whitelist only `'self'`, Calendly asset domain, and Calendly iframe origin
- Never use sequential IDs or UUID v1

## Environment Variables / Secrets (GitHub)

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers + D1 permissions
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account identifier
- `ANTHROPIC_API_KEY` — Claude API key for CSS generation
- `RESEND_API_KEY` — Resend email service API key
- `REGISTER_SECRET` — Shared secret for /api/register endpoint authentication

## Testing Strategy

- Unit tests for build pipeline functions (token extraction mocking, CSS generation)
- Integration tests for Worker endpoints (/api/register)
- Visual regression tests for countdown timer states
- End-to-end test: trigger workflow_dispatch -> verify deployed page -> verify D1 registration
- Test self-destruct animation in Chrome, Firefox, Safari
- Test against 5-10 different client websites for CSS matching reliability

## Agent Coordination

See `AGENTS.md` for how to divide work across multiple agents. The project is designed to be built in parallel tracks after Phase 1 (Foundation) is complete.
