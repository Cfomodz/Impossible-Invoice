# Implementation Plan

## Overview

Build a Cloudflare Worker-based self-destructing invoice system. A single API call triggers GitHub Actions to build a branded static HTML invoice page, deploy it to Cloudflare's edge, and register it in D1. A daily cron job detects expired invoices and sends notification emails via Resend. Expired invoices show a "Thanos snap" disintegration animation followed by a Calendly booking embed.

---

## Phase 1: Foundation (Day 1-2)

### Goal
Get the Cloudflare Worker project running with D1 database and basic infrastructure confirmed working.

### Tasks

#### 1.1 Initialize Cloudflare Worker Project
- Run `wrangler init invoice-system` (or manually create structure)
- Configure `wrangler.toml` with:
  - `name = "invoice-system"`
  - `main = "src/index.ts"`
  - `compatibility_date` set to current
  - `[assets]` block with `directory = "./public"`, `binding = "ASSETS"`, `html_handling = "drop-trailing-slash"`, `not_found_handling = "404-page"`, `run_worker_first = ["/api/*"]`
  - D1 binding (database_id to be filled after creation)
  - `[triggers] crons = ["0 9 * * *"]`
  - `[observability] enabled = true`

#### 1.2 Create D1 Database
- Run `npx wrangler d1 create invoice-db`
- Update `wrangler.toml` with the returned `database_id`
- Apply schema: `npx wrangler d1 execute invoice-db --file=schema.sql`
- Schema includes `invoices` table with columns: `id`, `client_name`, `client_email`, `amount`, `currency`, `expiry_timestamp`, `email_sent`, `email_sent_at`, `page_url`, `calendly_link`, `created_at`
- Index: `idx_expiry ON invoices(expiry_timestamp, email_sent)`

#### 1.3 Deploy Hello-World Worker
- Write minimal `src/index.ts` that returns "Invoice System Online"
- Run `npx wrangler deploy` to confirm infrastructure works
- Verify at deployed URL

#### 1.4 Configure GitHub Repository
- Set up repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `REGISTER_SECRET`
- Create `.gitignore` (node_modules, public/, .wrangler/, etc.)
- Initialize `package.json` with project dependencies
- Set up `tsconfig.json` for TypeScript compilation

### Acceptance Criteria
- [ ] `wrangler deploy` succeeds
- [ ] Worker responds at deployed URL
- [ ] D1 database created and schema applied
- [ ] All GitHub secrets configured
- [ ] `npm ci` installs all dependencies

### Dependencies
None — this is the foundation.

---

## Phase 2: Static Invoice Page (Day 2-4)

### Goal
Build a complete, working invoice page with countdown timer, self-destruct animation, and Calendly embed — all with hardcoded test data and default styling.

### Tasks

#### 2.1 Create Base CSS (`static/base.css`)
- Layout styles for invoice container
- Responsive grid for invoice header, meta, table, totals, footer
- Countdown display styling with graduated urgency colors
- CTA button styles
- Print media query (`@media print`)
- Mobile-responsive breakpoints

#### 2.2 Create EJS Invoice Template (`templates/invoice.ejs`)
- Full HTML5 document with security meta tags
- Slots for: brand CSS injection, invoice header (company logo/name), invoice metadata (date, due date, invoice number), line items table, totals section, countdown display, footer
- Data attribute `data-expiry` on countdown element (UTC milliseconds)
- Script tags for countdown.js and self-destruct.js
- Embedded Calendly configuration (hidden until expired)
- CSP meta tag

#### 2.3 Create Expired State Template (`templates/expired.ejs`)
- "This invoice has self-destructed!" heading
- Mission Impossible themed subtitle
- CTA button linking to Calendly
- Calendly inline embed with UTM parameters (`utm_source=expired_invoice`, `utm_content={invoice_id}`)
- Pre-filled client name and email in Calendly URL

#### 2.4 Implement Countdown Timer (`static/countdown.js`)
- Use `requestAnimationFrame` (not `setInterval`)
- Read expiry from `data-expiry` attribute
- All calculations in UTC via `Date.now()`
- Graduated urgency display:
  - `> 3 days`: "This invoice will self-destruct in Xd Xh Xm Xs"
  - `< 24 hours`: "Self-destruct sequence initiated — Xh Xm Xs"
  - `< 1 hour`: "Final countdown! Xm Xs"
  - `= 0`: Trigger self-destruct animation
- Export trigger function for self-destruct.js to hook into

#### 2.5 Implement Self-Destruct Animation (`static/self-destruct.js`)
- Import html2canvas (~40KB dependency)
- Capture invoice DOM to canvas
- Distribute pixels across 32 canvas layers with weighted randomness (left-to-right sweep)
- Animate each layer with staggered: rotation (random +-30deg), translation (random X/Y), blur (2px), fade-out
- Stagger: `idx * 70ms` delay, `800 + idx * 50ms` transition duration
- After animation (~2.5s): fade to expired state with Calendly embed
- Clean up canvas elements after animation

#### 2.6 Test with Hardcoded Data
- Create a test HTML file with sample invoice data
- Verify countdown displays correctly across all urgency levels
- Verify self-destruct animation triggers and completes
- Verify Calendly embed loads in expired state
- Test in Chrome, Firefox, Safari
- Test on mobile viewport sizes

### Acceptance Criteria
- [ ] Invoice page renders with all sections (header, meta, items, totals, countdown)
- [ ] Countdown timer works correctly using requestAnimationFrame
- [ ] Urgency messaging changes at correct thresholds
- [ ] Thanos snap animation triggers at zero and looks smooth
- [ ] Expired state shows with Calendly embed
- [ ] Page is responsive on mobile
- [ ] Print styles work correctly
- [ ] Security meta tags present

### Dependencies
- Phase 1 (for deployment testing only; local dev works independently)

---

## Phase 3: Build Pipeline (Day 4-5)

### Goal
Create the Node.js build script and GitHub Actions workflow that takes JSON invoice data as input and produces a deployed, registered invoice page.

### Tasks

#### 3.1 Create Build Script (`scripts/build.js`)
- Read invoice data from `INVOICE_DATA_FILE` env var (JSON file path)
- Generate UUID v4 if not provided in input
- Calculate 7-day expiry timestamp if not provided
- Orchestrate pipeline: extract tokens -> generate CSS -> render template -> write output
- Render EJS template with invoice data + brand CSS + expiry timestamp
- Write to `public/invoice/{uuid}/index.html`
- Copy static assets (countdown.js, self-destruct.js, base.css) to output directory
- Generate `public/robots.txt` with `Disallow: /invoice/`
- Write `/tmp/invoice-meta.json` for subsequent GitHub Actions steps
- Include fallback CSS generation when brand extraction fails

#### 3.2 Create Invoice Registration Script (`scripts/register-invoice.js`)
- Read `/tmp/invoice-meta.json`
- POST to `{WORKER_URL}/api/register` with invoice metadata
- Include `REGISTER_SECRET` for authentication
- Handle errors and retry logic
- Log success/failure

#### 3.3 Create GitHub Actions Workflow (`.github/workflows/generate-invoice.yml`)
- Trigger: `workflow_dispatch` with `invoice_data` input (base64-encoded JSON)
- Steps:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` (Node 20, npm cache)
  3. `npm ci`
  4. Decode invoice data: `base64 -d > invoice-data.json`
  5. Install Playwright Chromium: `npx playwright install chromium`
  6. Build invoice: `node scripts/build.js` with `INVOICE_DATA_FILE` and `ANTHROPIC_API_KEY`
  7. Deploy: `cloudflare/wrangler-action@v3` with `command: deploy`
  8. Register in D1: `node scripts/register-invoice.js` with `WORKER_URL` and `REGISTER_SECRET`

#### 3.4 Test Pipeline
- Trigger workflow via GitHub API with sample base64 invoice data
- Verify page deploys and is accessible
- Verify D1 registration succeeds

### Acceptance Criteria
- [ ] `node scripts/build.js` produces correct HTML in `public/invoice/{uuid}/`
- [ ] GitHub Actions workflow runs successfully end-to-end
- [ ] Deployed page is accessible at Cloudflare URL
- [ ] Invoice registered in D1 after deployment
- [ ] Build completes in under 60 seconds

### Dependencies
- Phase 1 (infrastructure)
- Phase 2 (templates and static assets)

---

## Phase 4: LLM CSS Matching (Day 5-7)

### Goal
Implement the automated brand-matching CSS pipeline: extract design tokens from a client's website using Playwright, generate matching CSS via Claude API, validate with PostCSS.

### Tasks

#### 4.1 Implement Design Token Extraction (`scripts/extract-design-tokens.js`)
- Launch headless Chromium via Playwright
- Navigate to client website with `waitUntil: 'networkidle'`
- Extract computed styles from all DOM elements:
  - Colors: `color`, `backgroundColor`, `borderColor` — frequency-sorted, top 12
  - Fonts: all unique `fontFamily` values
- Extract CSS custom properties from `:root` rules
- Detect Google Fonts `<link>` tags
- Take full-page screenshot to `/tmp/client-screenshot.png` (for LLM vision input)
- Return structured token object: `{ colors, fonts, cssVars, googleFonts }`
- Handle errors gracefully (timeout, blocked sites, etc.)

#### 4.2 Implement LLM CSS Generation (`scripts/generate-css.js`)
- Initialize Anthropic SDK client
- Build multimodal message:
  - If screenshot exists: include as base64 image
  - Text prompt with extracted tokens and strict CSS requirements
- Call Claude API (`claude-sonnet-4-20250514`, temperature 0.2, max_tokens 4096)
- System prompt: "CSS expert, output only valid scoped CSS, never use !important or global selectors"
- Requirements in prompt:
  1. Scope ALL selectors under `.invoice-container`
  2. Define CSS custom properties on `.invoice-container`
  3. Style: `.invoice-header`, `.invoice-meta`, `.invoice-table`, `.invoice-totals`, `.invoice-footer`, `.countdown-display`, `.cta-button`
  4. Include `@media print` styles
  5. Output ONLY valid CSS — no markdown, no backticks
- Strip any residual markdown fences from output

#### 4.3 Implement PostCSS Validation
- Parse generated CSS with PostCSS
- Walk all rules; if any selector doesn't include `.invoice-container`, prefix it
- Return cleaned CSS string
- Add to generate-css.js as validation step

#### 4.4 Implement Fallback CSS
- `generateFallbackCSS(primaryColor)` function
- Uses CSS custom properties with extracted or default colors
- Standard `Inter`/`system-ui` font stack
- Full invoice layout styles
- Called when: LLM API unavailable, client website unreachable, extraction timeout

#### 4.5 Test Against Multiple Client Websites
- Test extraction + generation against 5-10 diverse websites
- Verify CSS is valid and properly scoped
- Verify visual result matches client brand
- Tune prompt based on failures
- Document edge cases and handling

### Acceptance Criteria
- [ ] Design tokens extracted correctly from test websites
- [ ] Generated CSS is valid, scoped, and visually matches client brand
- [ ] PostCSS validation catches and fixes unscoped selectors
- [ ] Fallback CSS produces a professional-looking invoice
- [ ] Build never fails due to CSS generation issues
- [ ] Pipeline works for sites with various tech stacks (WordPress, React, static, etc.)

### Dependencies
- Phase 2 (CSS class names must match template)
- Phase 3 (integration into build pipeline)

### Alternative Approach
Consider the `dembrandt` npm package which wraps Playwright and outputs DTCG-standard design tokens with a single CLI command: `dembrandt https://acme.com > tokens.json`. This could simplify Stage 1 extraction.

---

## Phase 5: Expiry Email System (Day 7-8)

### Goal
Implement the Worker's cron handler that detects expired invoices and sends notification emails, plus the /api/register endpoint.

### Tasks

#### 5.1 Implement Worker Fetch Handler (`src/index.ts`)
- Handle `POST /api/register`:
  - Parse JSON body
  - Validate `REGISTER_SECRET` header/token
  - INSERT into D1 `invoices` table
  - Return 201 with `{ success: true }`
- Return 404 for all other routes (static assets handled by Cloudflare)

#### 5.2 Implement Worker Scheduled Handler (`src/index.ts`)
- `scheduled()` handler triggered by daily cron
- Use `ctx.waitUntil()` to ensure completion
- Call `processExpiredInvoices(env)`:
  - Query D1: `SELECT * FROM invoices WHERE expiry_timestamp < ? AND email_sent = 0`
  - For each expired invoice:
    - Send email via Resend API with branded HTML template
    - Email content: expired notice + Calendly booking link
    - On success: UPDATE `email_sent = 1`, `email_sent_at = NOW()`
    - On failure: log error, skip (will retry next cron run)

#### 5.3 Set Up Resend
- Create Resend account
- Configure sending domain DNS (SPF + DKIM records)
- Install `resend` npm package
- Test email sending with Resend API

#### 5.4 Test Cron Flow
- Test locally with `npx wrangler dev --test-scheduled`
- Insert test invoice into D1 with past expiry
- Trigger scheduled handler
- Verify email sent and D1 updated
- Verify no duplicate emails on subsequent runs

### Acceptance Criteria
- [ ] `/api/register` accepts and stores invoice data in D1
- [ ] Cron handler queries expired invoices correctly
- [ ] Emails sent via Resend with correct content and links
- [ ] D1 updated to prevent duplicate emails
- [ ] No emails sent for already-notified invoices
- [ ] Error handling prevents one failed email from blocking others

### Dependencies
- Phase 1 (D1 database, Worker infrastructure)

---

## Phase 6: Integration & Polish (Day 8-10)

### Goal
Connect the full pipeline end-to-end, add security headers, error handling, and create integration templates.

### Tasks

#### 6.1 End-to-End Integration
- Test complete flow: CRM webhook -> GitHub API -> build -> deploy -> register -> cron -> email
- Verify each handoff point
- Test with real Calendly link and real email address
- Measure total pipeline latency (target: under 60 seconds from trigger to deployed page)

#### 6.2 Security Headers
- Add `_headers` file in `public/` OR set headers in Worker fetch handler for `/invoice/*`:
  ```
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; script-src 'self' https://assets.calendly.com; frame-src https://calendly.com
  ```

#### 6.3 Error Handling & Logging
- Build script: catch and log all failures with context
- Worker: structured logging for cron runs (invoices processed, emails sent, errors)
- GitHub Actions: failure notifications
- Observability enabled in wrangler.toml

#### 6.4 Mobile Testing & Polish
- Test invoice page on mobile viewports (320px - 768px)
- Test self-destruct animation performance on mobile
- Polish expired page design
- Verify Calendly embed works on mobile

#### 6.5 Integration Templates
- Create example Zapier/Make.com integration configuration
- Document the base64 JSON encoding requirement
- Provide sample curl command for manual triggering
- Document the expected JSON invoice data schema

#### 6.6 Optional: Email Verification Gate
- For high-value invoices, add email verification before showing invoice
- Page prompts for client's email address
- Worker endpoint validates against stored `client_email` in D1
- Minimal friction, prevents casual link-sharing exposure

### Acceptance Criteria
- [ ] Full pipeline works end-to-end without manual intervention
- [ ] All security headers present and correct
- [ ] Page works on mobile devices
- [ ] Self-destruct animation performs well on mobile
- [ ] Integration templates documented for Zapier/Make.com
- [ ] Error handling covers all failure modes
- [ ] Pipeline completes in under 60 seconds

### Dependencies
- All previous phases

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Client website blocks Playwright scraping | Medium | Low | Fallback CSS with extracted colors or defaults |
| Claude API unavailable during build | Low | Low | Fallback CSS generation, build never fails |
| html2canvas fails on complex invoice layouts | Low | Medium | Test extensively; keep invoice DOM simple |
| Resend API rate limiting | Low | Low | Process invoices sequentially in cron; Resend free tier is 3K/month |
| D1 consistency issues with cron | Low | High | `email_sent` flag prevents duplicates; idempotent design |
| GitHub Actions timeout | Low | Medium | Build should complete in <60s; set explicit timeout |
| Calendly embed blocked by browser extensions | Medium | Low | Provide direct link as fallback alongside embed |

---

## Cost Analysis (Cloudflare Free Tier)

- **Workers**: 100,000 requests/day (free) — more than sufficient
- **D1**: 5 million reads/month, 100K writes/month (free)
- **Static Assets**: Unlimited bandwidth (free with Workers)
- **Resend**: 3,000 emails/month (free tier)
- **GitHub Actions**: 2,000 minutes/month (free tier)
- **Claude API**: Pay-per-use (~$0.01-0.03 per CSS generation)
- **Total monthly cost for typical invoice volume**: ~$0-5
