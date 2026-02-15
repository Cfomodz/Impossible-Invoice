# AGENTS.md - Agent Coordination Guide

## Overview

This document defines how multiple AI agents (or human developers) can work on the Impossible Invoice System in parallel. After Phase 1 (Foundation) is complete, the project splits into independent workstreams that converge in Phase 6.

---

## Workstream Definitions

### Agent A: Frontend / Static Page (Phase 2)

**Scope**: Everything the end user sees in the browser.

**Files owned**:
- `templates/invoice.ejs`
- `templates/expired.ejs`
- `static/base.css`
- `static/countdown.js`
- `static/self-destruct.js`

**Key responsibilities**:
- Build the complete invoice HTML page template with all sections
- Implement `requestAnimationFrame`-based countdown timer with graduated urgency messaging
- Implement the Thanos snap disintegration effect using `html2canvas`
- Create the expired state with Calendly inline embed
- Ensure responsive design (mobile-first)
- Ensure print styles work
- Embed security meta tags in template

**Interface contract**:
- Template expects these EJS variables: `id`, `clientName`, `clientEmail`, `amount`, `currency`, `items[]`, `expiryTimestamp`, `brandCSS`, `calendlyLink`, `companyName`, `companyEmail`
- Countdown reads expiry from `data-expiry` attribute (UTC milliseconds)
- Self-destruct targets element with class `.invoice-container`
- After disintegration, shows element with class `.expired-state`
- CSS class names that must exist (for LLM CSS generation to target):
  - `.invoice-container`
  - `.invoice-header`
  - `.invoice-meta`
  - `.invoice-table` (with `th`, `td`)
  - `.invoice-totals`
  - `.invoice-footer`
  - `.countdown-display`
  - `.cta-button`
  - `.expired-state`

**Can start**: Immediately after Phase 1
**Blocked by**: Nothing
**Blocks**: Phase 3 (build pipeline needs templates), Phase 4 (CSS class names must be finalized)

---

### Agent B: Worker / Backend (Phase 5)

**Scope**: Server-side logic — the Cloudflare Worker that handles API registration and cron-triggered email.

**Files owned**:
- `src/index.ts`
- `schema.sql`

**Key responsibilities**:
- Implement `POST /api/register` endpoint with secret-based auth
- Implement `scheduled()` cron handler
- Implement `processExpiredInvoices()` — D1 query, Resend email, status update
- Ensure idempotent email sending (no duplicates)
- Handle errors gracefully (one failed email doesn't block others)

**Interface contract**:
- `/api/register` accepts POST with JSON body:
  ```json
  {
    "id": "uuid-v4",
    "clientName": "string",
    "clientEmail": "email",
    "amount": 0.00,
    "currency": "USD",
    "expiryTimestamp": 1234567890000,
    "pageUrl": "/invoice/{uuid}/",
    "calendlyLink": "https://calendly.com/..."
  }
  ```
- Authentication: `Authorization: Bearer {REGISTER_SECRET}` header
- Response: `201 { success: true }` on success, `401` on bad auth, `400` on invalid data
- D1 schema must match `schema.sql`
- Cron runs daily at 9 AM UTC
- Email sent via Resend with HTML template including client name and Calendly link

**Environment bindings**:
```typescript
interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  ASSETS: Fetcher;
  REGISTER_SECRET: string;
}
```

**Can start**: Immediately after Phase 1
**Blocked by**: Nothing
**Blocks**: Phase 6 (end-to-end integration)

---

### Agent C: Build Pipeline (Phase 3)

**Scope**: The Node.js build script and GitHub Actions workflow that orchestrates invoice generation and deployment.

**Files owned**:
- `scripts/build.js`
- `scripts/register-invoice.js`
- `.github/workflows/generate-invoice.yml`

**Key responsibilities**:
- Read JSON invoice data, generate UUID, calculate expiry
- Orchestrate: extract tokens -> generate CSS -> render EJS -> write files
- Copy static assets to output directory
- Generate robots.txt
- Write invoice metadata for subsequent GitHub Actions steps
- Create GitHub Actions workflow with `workflow_dispatch` trigger
- Handle base64 decoding of input data
- Implement registration script that POSTs to /api/register post-deploy

**Interface contract**:
- Input: JSON file at path in `INVOICE_DATA_FILE` env var
  ```json
  {
    "clientName": "Acme Corp",
    "clientEmail": "cto@acme.com",
    "clientWebsite": "https://acme.com",
    "calendlyLink": "https://calendly.com/you/30min",
    "companyName": "Your Company",
    "companyEmail": "hello@yourcompany.com",
    "items": [
      { "description": "Web Development", "hours": 40, "rate": 150 }
    ],
    "brandColor": "#2563eb",
    "id": "optional-uuid",
    "expiryTimestamp": "optional-ms"
  }
  ```
- Output: `public/invoice/{uuid}/index.html` + static assets
- Metadata: `/tmp/invoice-meta.json` for register step
- GitHub Actions: triggered via `workflow_dispatch` with base64-encoded `invoice_data` input

**Can start**: After Phase 2 templates exist (can use stubs initially)
**Blocked by**: Phase 2 (templates), Phase 4 (CSS generation — can use fallback initially)
**Blocks**: Phase 6

---

### Agent D: LLM CSS Pipeline (Phase 4)

**Scope**: The automated brand-matching CSS generation pipeline.

**Files owned**:
- `scripts/extract-design-tokens.js`
- `scripts/generate-css.js`

**Key responsibilities**:
- Extract design tokens from client websites via Playwright
- Generate brand-matching CSS via Claude API (multimodal with screenshot)
- Validate CSS output with PostCSS (ensure scoping)
- Provide fallback CSS when extraction or generation fails
- Ensure build never fails due to CSS pipeline issues

**Interface contract**:
- `extractDesignTokens(url)` returns:
  ```js
  {
    colors: string[],     // Top 12 colors by frequency
    fonts: string[],      // Unique font families
    cssVars: object,      // CSS custom properties from :root
    googleFonts: string[] // Google Fonts link URLs
  }
  ```
- `generateBrandCSS(tokens)` returns: valid CSS string scoped under `.invoice-container`
- `generateFallbackCSS(primaryColor)` returns: default CSS string with the given primary color
- `validateCSS(css)` returns: cleaned CSS string with all selectors properly scoped
- Screenshot saved to `/tmp/client-screenshot.png`

**Can start**: After Phase 2 CSS class names are finalized
**Blocked by**: Phase 2 (class name contract)
**Blocks**: Phase 3 (full integration — but build.js can use fallback CSS initially)

---

## Parallel Execution Timeline

```
Phase 1: Foundation
    |
    |──── Agent A: Frontend (Phase 2)  ─────────┐
    |                                             │
    |──── Agent B: Backend (Phase 5)  ──────────┤
    |                                             │
    |     Agent D: LLM CSS (Phase 4) ───────────┤ (starts after Phase 2 class names)
    |                                             │
    |     Agent C: Build Pipeline (Phase 3) ────┤ (starts after Phase 2 templates)
    |                                             │
    └─────────────────────────────────────────────┘
                                                  │
                                          Phase 6: Integration
```

## Communication Protocol

### Shared Contracts (do not change without coordination)

1. **EJS Template Variables** — defined in Agent A's interface contract above
2. **CSS Class Names** — the 9 classes listed in Agent A's contract
3. **D1 Schema** — `schema.sql` is the source of truth
4. **Invoice JSON Schema** — defined in Agent C's interface contract
5. **`/api/register` API** — defined in Agent B's interface contract
6. **Design Token Format** — defined in Agent D's interface contract

### Merge Order

1. Phase 1 merges first (foundation)
2. Phase 2 (Agent A) and Phase 5 (Agent B) can merge independently
3. Phase 4 (Agent D) merges after Phase 2
4. Phase 3 (Agent C) merges after Phases 2 and 4
5. Phase 6 is final integration — done on the combined codebase

### Conflict Prevention

- Each agent owns specific files (listed above) — no overlapping file ownership
- Shared contracts are defined in this document and should not change unilaterally
- `package.json` is a shared file — coordinate dependency additions
- `wrangler.toml` is configured in Phase 1 and should not need per-agent changes
- If an agent needs to modify a shared contract, they must document the change and notify all affected agents

---

## Quick Start for Each Agent

### Agent A (Frontend)
```bash
# Focus on templates/ and static/ directories
# Test locally by opening HTML files in browser
# No backend needed for development
npm install ejs html2canvas
# Create test HTML with hardcoded data to iterate on design
```

### Agent B (Backend)
```bash
# Focus on src/index.ts
# Test locally with wrangler dev
npx wrangler dev
# Test cron with --test-scheduled flag
npx wrangler dev --test-scheduled
# Test /api/register with curl
curl -X POST http://localhost:8787/api/register -H "Authorization: Bearer test-secret" -d '{"id":"test","clientName":"Test",...}'
```

### Agent C (Build Pipeline)
```bash
# Focus on scripts/ and .github/workflows/
# Test build locally
echo '{"clientName":"Test","items":[{"description":"Dev","hours":10,"rate":100}]}' > test-invoice.json
INVOICE_DATA_FILE=test-invoice.json node scripts/build.js
# Inspect output in public/invoice/
```

### Agent D (LLM CSS Pipeline)
```bash
# Focus on scripts/extract-design-tokens.js and scripts/generate-css.js
# Install Playwright
npx playwright install chromium
# Test extraction
node -e "require('./scripts/extract-design-tokens').extractDesignTokens('https://example.com').then(console.log)"
# Test generation
node -e "require('./scripts/generate-css').generateBrandCSS({colors:['#333','#fff'],fonts:['Inter']}).then(console.log)"
```
