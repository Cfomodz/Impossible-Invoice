# AGENTS.md - Current Coordination Guide

## Overview

This document is now a current-state coordination reference for the Impossible Invoice System.

Most implementation work described in the original plan is already present in the repo. The main open work is now:

- runtime validation
- external setup and deployment
- Phase 6 integration and polish

Use this file to understand file ownership, shared contracts, and the remaining work per area. Use `TODO.md` as the execution tracker and `PLAN.md` for full-phase detail.

---

## Workstream Status

### Agent A: Frontend / Static Page

**Files owned**:
- `templates/invoice.ejs`
- `templates/expired.ejs`
- `static/base.css`
- `static/countdown.js`
- `static/self-destruct.js`

**Status**: Implemented in repo

**Still open**:
- browser validation for countdown threshold states
- self-destruct animation validation in real browsers
- Calendly embed validation
- responsive/mobile validation
- print-style validation

**Notes**:
- This area is no longer blocked on implementation work.
- Changes here must preserve the template variable and CSS class contracts below.

### Agent B: Worker / Backend

**Files owned**:
- `src/index.ts`
- `schema.sql`

**Status**: Implemented in repo, pending runtime and external verification

**Still open**:
- create real D1 database and update `wrangler.toml` with a real `database_id`
- apply schema to the real database
- run local or deployed `/api/register` verification
- run scheduled cron verification with seeded expired invoices
- verify duplicate-email prevention and per-invoice failure isolation in runtime
- complete Resend account and DNS setup

**Notes**:
- Core endpoint and cron control flow exist.
- Remaining work is mostly environment-backed testing rather than repo construction.

### Agent C: Build Pipeline

**Files owned**:
- `scripts/build.js`
- `scripts/register-invoice.js`
- `.github/workflows/generate-invoice.yml`

**Status**: Implemented in repo, locally validated, pending live integration checks

**Still open**:
- live `workflow_dispatch` trigger validation
- deployed page accessibility verification
- live D1 registration verification after deploy
- timing measurement on the real Playwright + Claude path

**Notes**:
- Local build and unit-style validation are in place.
- Live deployment behavior still depends on Cloudflare and GitHub configuration.

### Agent D: LLM CSS Pipeline

**Files owned**:
- `scripts/extract-design-tokens.js`
- `scripts/generate-css.js`

**Status**: Implemented in repo, fallback path validated

**Still open**:
- test extraction against 5+ real client websites
- tune the Claude prompt based on real-site output quality
- validate generated CSS quality with Playwright/browser support installed

**Notes**:
- Fallback CSS path is already working and keeps builds from failing.
- Remaining work is quality and coverage validation, not missing architecture.

---

## Shared Contracts

Do not change these without coordinating the affected files and docs.

### Frontend Template Contract

- Template expects these EJS variables: `id`, `clientName`, `clientEmail`, `amount`, `currency`, `items[]`, `expiryTimestamp`, `brandCSS`, `calendlyLink`, `companyName`, `companyEmail`
- Countdown reads expiry from `data-expiry` attribute in UTC milliseconds
- Self-destruct targets `.invoice-container`
- After disintegration, the UI must reveal `.expired-state`

### Required CSS Targets

- `.invoice-container`
- `.invoice-header`
- `.invoice-meta`
- `.invoice-table` with `th` and `td`
- `.invoice-totals`
- `.invoice-footer`
- `.countdown-display`
- `.cta-button`
- `.expired-state`

### Worker API Contract

- `POST /api/register` accepts JSON with:

```json
{
  "id": "uuid-v4",
  "clientName": "string",
  "clientEmail": "email",
  "amount": 0.0,
  "currency": "USD",
  "expiryTimestamp": 1234567890000,
  "pageUrl": "/invoice/{uuid}/",
  "calendlyLink": "https://calendly.com/..."
}
```

- Authentication: `Authorization: Bearer {REGISTER_SECRET}`
- Success response: `201 { success: true }`
- Error responses: `401` for bad auth, `400` for invalid data
- D1 schema in `schema.sql` is the source of truth
- Cron target remains daily at 9 AM UTC

### Build Pipeline Contract

- Input: JSON file path in `INVOICE_DATA_FILE`
- Output: `public/invoice/{uuid}/index.html` plus copied static assets
- Metadata handoff file: `/tmp/invoice-meta.json`
- GitHub Actions trigger: `workflow_dispatch` with base64-encoded `invoice_data`

### CSS Pipeline Contract

- `extractDesignTokens(url)` returns:

```js
{
  colors: string[],
  fonts: string[],
  cssVars: object,
  googleFonts: string[]
}
```

- `generateBrandCSS(tokens)` returns valid CSS scoped under `.invoice-container`
- `generateFallbackCSS(primaryColor)` returns a working default CSS string
- `validateCSS(css)` returns cleaned CSS with selectors properly scoped
- Screenshot path remains `/tmp/client-screenshot.png`

---

## Current Coordination Rules

- Treat `TODO.md` as the source of truth for what is still open.
- Treat `PLAN.md` as the fuller explanation of phases, risks, and acceptance criteria.
- Preserve file ownership above when splitting work across agents.
- Coordinate any change to shared contracts before editing multiple workstreams.
- `package.json` remains shared; dependency additions should be deliberate.
- `wrangler.toml` is effectively shared because deployment, D1, and cron settings affect multiple areas.

---

## Suggested Next Passes

If work is being split now, divide it along these lines instead of the original build-out order.

### Pass A: Browser Validation

- validate countdown thresholds
- validate self-destruct animation
- validate Calendly embed
- validate mobile and print behavior

### Pass B: Cloudflare and Worker Validation

- create and bind real D1
- apply schema
- verify `/api/register`
- run `wrangler dev --test-scheduled`
- verify duplicate prevention and failure isolation

### Pass C: Live Pipeline Validation

- run live GitHub Actions dispatch
- verify deployment output and public accessibility
- verify registration handoff into D1
- measure end-to-end timing

### Pass D: Phase 6 Polish

- structured logging
- Zapier/Make.com integration template
- optional email verification gate
