# TODO - Impossible Invoice System

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1: Foundation

- [x] Initialize project with `npm init` and install dependencies
- [x] Configure `wrangler.toml` with all bindings and triggers
- [x] Create `schema.sql` with invoices table and index
- [x] Write `src/index.ts` hello-world Worker
- [x] Create `tsconfig.json` for TypeScript
- [x] Create `.gitignore`
- [ ] Run `wrangler d1 create invoice-db` and update wrangler.toml with database_id
- [ ] Apply schema: `wrangler d1 execute invoice-db --file=schema.sql`
- [ ] Deploy hello-world Worker and verify it responds
- [ ] Configure GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `REGISTER_SECRET`

## Phase 2: Static Invoice Page

- [x] Create `static/base.css` — layout, responsive grid, urgency colors, print styles
- [x] Create `templates/invoice.ejs` — full HTML5 invoice page with all sections
- [x] Create `templates/expired.ejs` — expired state with Calendly embed
- [x] Create `static/countdown.js` — requestAnimationFrame countdown with graduated urgency
- [x] Create `static/self-destruct.js` — html2canvas Thanos snap disintegration effect
- [ ] Test countdown timer at all urgency thresholds (>3d, <24h, <1h, zero)
- [ ] Test self-destruct animation triggers and completes smoothly
- [ ] Test Calendly embed loads in expired state
- [ ] Test responsive layout on mobile viewports
- [ ] Test print styles

## Phase 3: Build Pipeline

- [x] Create `scripts/build.js` — orchestrates token extraction -> CSS generation -> EJS render -> file output
- [x] Create `scripts/register-invoice.js` — POST to /api/register after deploy
- [x] Create `.github/workflows/generate-invoice.yml` — workflow_dispatch pipeline
- [x] Test build script locally with sample invoice JSON
- [ ] Test GitHub Actions workflow via API trigger
- [ ] Verify deployed page is accessible
- [ ] Verify D1 registration succeeds
- [ ] Measure build time (target: <60 seconds)

## Phase 4: LLM CSS Matching

- [x] Create `scripts/extract-design-tokens.js` — Playwright extraction of colors, fonts, CSS vars, Google Fonts, screenshot
- [x] Create `scripts/generate-css.js` — Claude API multimodal CSS generation with PostCSS validation
- [x] Implement `generateFallbackCSS()` — CSS-variables-based fallback for when extraction/LLM fails
- [x] Implement PostCSS validation — auto-prefix unscoped selectors with `.invoice-container`
- [ ] Test extraction against 5+ diverse client websites
- [ ] Tune LLM prompt based on test results
- [x] Verify build never fails regardless of extraction/LLM failures
- [x] Document edge cases and handling

## Phase 5: Expiry Email System

- [x] Implement `/api/register` endpoint in `src/index.ts` with secret validation
- [x] Implement `scheduled()` handler in `src/index.ts` for daily cron
- [x] Implement `processExpiredInvoices()` — D1 query + Resend email + status update
- [ ] Set up Resend account and configure DNS (SPF/DKIM)
- [ ] Test cron locally with `wrangler dev --test-scheduled`
- [ ] Verify no duplicate emails
- [ ] Test error handling (Resend failure doesn't block other emails)

## Phase 6: Integration & Polish

- [ ] End-to-end test: CRM webhook -> GitHub API -> build -> deploy -> register -> cron -> email
- [x] Add security headers (`_headers` file or Worker response headers)
- [ ] Add structured error logging throughout pipeline
- [ ] Test on mobile devices (320px - 768px viewports)
- [ ] Test self-destruct animation performance on mobile
- [ ] Create Zapier/Make.com integration template
- [x] Document invoice JSON data schema
- [x] Provide sample curl command for manual triggering
- [ ] Optional: implement email verification gate for high-value invoices

---

## Notes

- Phases 2 and 5 can be developed in parallel after Phase 1
- Phase 4 can begin as soon as Phase 2 establishes the CSS class names
- Phase 3 integrates Phases 2 and 4, so it can start with stubs
- Phase 6 requires all other phases complete

------------------

Based on the documentation (AGENTS.md, TODO.md, PLAN.md, CLAUDE.md), the project is largely implemented, with the main focus now shifting to __runtime validation, external setup/deployment, and final integration/polish.__

Here are the next steps, organized by parallelizable passes, as suggested in AGENTS.md, along with a consolidated view of remaining tasks:

__Pass A: Cloudflare and Worker Setup/Validation (High Priority - foundational for other passes)__

- __Goal:__ Get the Cloudflare Worker infrastructure fully configured and verified.

- __Tasks:__

  1. Run `wrangler d1 create invoice-db` and update `wrangler.toml` with the `database_id`.
  2. Apply the schema: `wrangler d1 execute invoice-db --file=schema.sql`.
  3. Deploy the Worker and verify it responds.
  4. Configure all GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `REGISTER_SECRET`.
  5. Set up the Resend account and configure DNS (SPF/DKIM).
  6. Verify local or deployed `/api/register` functionality.
  7. Run scheduled cron verification locally (`wrangler dev --test-scheduled`) with seeded expired invoices.
  8. Verify duplicate-email prevention and per-invoice failure isolation in runtime.

__Pass B: Browser Validation (Can be parallelized with Pass A & C)__

- __Goal:__ Thoroughly test the frontend components across various scenarios.

- __Tasks:__

  1. Validate countdown timer behavior at all urgency thresholds (>3d, <24h, <1h, zero).
  2. Validate self-destruct animation triggers and completes smoothly.
  3. Validate Calendly embed loads correctly in the expired state.
  4. Validate responsive layout on mobile viewports.
  5. Validate print styles.

__Pass C: LLM CSS Pipeline Quality & Coverage (Can be parallelized with Pass A & B)__

- __Goal:__ Improve and validate the LLM-powered CSS generation.

- __Tasks:__

  1. Test design token extraction against 5+ diverse client websites.
  2. Tune the Claude prompt based on real-site output quality.
  3. Validate generated CSS quality with Playwright/browser support installed.

__Pass D: Live Pipeline Validation (Dependent on Pass A & B, can start once deployed infrastructure is stable)__

- __Goal:__ Verify the end-to-end build and deployment process in a live environment.

- __Tasks:__

  1. Run live GitHub Actions `workflow_dispatch` trigger validation.
  2. Verify the deployed page is publicly accessible.
  3. Verify live D1 registration after deployment.
  4. Measure end-to-end timing (target: <60 seconds).

__Pass E: Phase 6 Polish (Dependent on all other passes)__

- __Goal:__ Final integration, error handling, mobile polish, and external integration templates.

- __Tasks:__

  1. Perform end-to-end testing: CRM webhook -> GitHub API -> build -> deploy -> register -> cron -> email.
  2. Add structured error logging throughout the pipeline.
  3. Create Zapier/Make.com integration template.
  4. (Optional) Implement an email verification gate for high-value invoices.

__Prioritization:__ Pass A (Cloudflare and Worker Setup/Validation) is the most critical initial step as it sets up the core environment required for other passes, especially for live testing and worker functionality. Passes B and C can be worked on in parallel once Pass A has established the foundational Cloudflare environment and secrets. Pass D builds upon A and B, and Pass E is the final integration and polish.
