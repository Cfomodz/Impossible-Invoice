# TODO Validation Brief

## Goal

Determine which unchecked items in `TODO.md` are already implemented and which still need real work, external setup, or runtime verification.

Do not start by editing code or `TODO.md`. First run the checks below and produce a report. Only make code changes if a check fails because of an obvious repo bug, and list those changes separately.

## Reporting Format

For every unchecked item in `TODO.md`, classify it as one of:

- `repo-done`: implemented in the repository and supported by file inspection or automated checks
- `runtime-verified`: exercised successfully in a real run
- `blocked-external`: depends on Cloudflare, GitHub, Resend, DNS, secrets, or another external system you cannot fully verify here
- `manual-only`: requires human visual inspection or interaction and was not executed
- `not-done`: missing or materially incomplete

For each item, include:

1. The exact TODO line
2. The classification
3. Evidence: command output summary, file path, or manual observation
4. Whether it should be checked off now

End with three short sections:

1. `Safe to check off now`
2. `Implemented but still needs runtime proof`
3. `Still genuinely incomplete or externally blocked`

## Preconditions

- Use Node 20+
- Run from the repo root
- Install dependencies with `npm ci`
- If Playwright browsers are missing, run `npx playwright install chromium`
- Do not replace placeholder secrets with fake values unless a specific local-only test needs them

## Static Validation

Run these first:

```bash
npm ci
npx tsc --noEmit
npm test
```

Capture:

- whether type-check passes
- whether tests pass
- any skipped or missing coverage areas

## Build Pipeline Validation

Run the build with the included fixture:

```bash
INVOICE_DATA_FILE=test-invoice.json node scripts/build.js
```

Verify these outputs exist and contain the expected content:

- `public/invoice/<uuid>/index.html`
- `public/invoice/<uuid>/base.css`
- `public/invoice/<uuid>/countdown.js`
- `public/invoice/<uuid>/self-destruct.js`
- `public/invoice/<uuid>/html2canvas.min.js`
- `public/robots.txt`
- `public/_headers`
- `/tmp/invoice-meta.json`

Confirm from generated output:

- invoice HTML includes the countdown element with `data-expiry`
- invoice HTML includes the expired state and Calendly widget
- robots file disallows `/invoice/`
- headers file includes `Cache-Control`, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, and CSP

## Frontend Runtime Validation

Use the generated invoice page in a browser and verify these manually:

1. Countdown messaging at these thresholds:
   - more than 3 days
   - less than 24 hours
   - less than 1 hour
   - zero
2. Self-destruct animation triggers at zero and completes without JS errors
3. Expired state becomes visible after animation
4. Calendly embed loads in expired state
5. Responsive layout works on mobile-width viewports
6. Print styles hide countdown and CTA as intended

If needed, temporarily edit the generated `data-expiry` in the built HTML to force each threshold for manual testing. If you do that, note it in the report and do not commit those generated-file edits.

## Worker / API Validation

If local Cloudflare dev works, use it. Otherwise report the exact blocker.

Preparation:

```bash
npx wrangler d1 execute invoice-db --local --file=schema.sql
```

Then start local dev:

```bash
npx wrangler dev
```

Exercise `POST /api/register` with three cases:

1. Bad auth -> expect `401`
2. Missing required field -> expect `400`
3. Valid payload -> expect `201 { success: true }`

Use this valid payload shape:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "clientName": "Acme Corp",
  "clientEmail": "cto@acme.com",
  "amount": 8625,
  "currency": "USD",
  "expiryTimestamp": 1739750400000,
  "pageUrl": "/invoice/11111111-1111-4111-8111-111111111111/",
  "calendlyLink": "https://calendly.com/you/30min"
}
```

If inserts succeed, query the local D1 database and confirm the row exists.

## Scheduled / Email Validation

If local scheduled testing works, run:

```bash
npx wrangler dev --test-scheduled
```

Seed at least two expired invoices into local D1:

- one that should succeed
- one that simulates email failure if you can safely mock or intercept Resend

Trigger the scheduled handler and verify:

1. expired invoices are selected
2. successful sends mark `email_sent = 1` and set `email_sent_at`
3. one failed email does not stop the next invoice from processing
4. rerunning does not resend already-marked invoices

If true end-to-end Resend sending is not possible locally, explicitly state whether this is a runtime blocker or whether you validated the control flow by mocking.

## Workflow Validation

Inspect `.github/workflows/generate-invoice.yml` and determine whether these are true:

1. workflow is triggered by `workflow_dispatch`
2. invoice data is accepted as base64 input
3. build, deploy, and register steps are present

Only attempt a live GitHub Actions dispatch if credentials and repo access are available. Otherwise classify the live trigger item as `blocked-external`.

## Documentation / Checklist Crosswalk

Specifically assess these TODO lines, because they look likely to be stale based on repo contents:

### Phase 1

- Initialize project with `npm init` and install dependencies
- Configure `wrangler.toml` with all bindings and triggers
- Create `schema.sql` with invoices table and index
- Write `src/index.ts` hello-world Worker
- Create `tsconfig.json` for TypeScript
- Create `.gitignore`

### Phase 2

- Create `static/base.css`
- Create `templates/invoice.ejs`
- Create `templates/expired.ejs`
- Create `static/countdown.js`
- Create `static/self-destruct.js`

### Phase 3

- Create `scripts/build.js`
- Create `scripts/register-invoice.js`
- Create `.github/workflows/generate-invoice.yml`
- Test build script locally with sample invoice JSON

### Phase 4

- Create `scripts/extract-design-tokens.js`
- Create `scripts/generate-css.js`
- Implement `generateFallbackCSS()`
- Implement PostCSS validation

### Phase 5

- Implement `/api/register` endpoint in `src/index.ts` with secret validation
- Implement `scheduled()` handler in `src/index.ts` for daily cron
- Implement `processExpiredInvoices()`

### Phase 6

- Add security headers (`_headers` file or Worker response headers)
- Document invoice JSON data schema
- Provide sample curl command for manual triggering

## Current Copilot Assessment

Before running anything, assume the following are probably `repo-done` unless runtime checks prove otherwise:

- core project scaffolding files exist
- static invoice templates and frontend assets exist
- build, registration, token extraction, and CSS generation scripts exist
- workflow file exists and matches the intended shape
- worker code includes `/api/register`, `scheduled()`, and `processExpiredInvoices()`
- docs already include invoice JSON schema and a manual GitHub API curl trigger

Do not assume external setup items are done just because code exists. Cloudflare deployment, D1 creation, schema application against a real DB, GitHub secrets, Resend DNS setup, and end-to-end cron/email proof all require explicit evidence.