# TODO - Impossible Invoice System

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1: Foundation

- [ ] Initialize project with `npm init` and install dependencies
- [ ] Configure `wrangler.toml` with all bindings and triggers
- [ ] Create `schema.sql` with invoices table and index
- [ ] Write `src/index.ts` hello-world Worker
- [ ] Create `tsconfig.json` for TypeScript
- [ ] Create `.gitignore`
- [ ] Run `wrangler d1 create invoice-db` and update wrangler.toml with database_id
- [ ] Apply schema: `wrangler d1 execute invoice-db --file=schema.sql`
- [ ] Deploy hello-world Worker and verify it responds
- [ ] Configure GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `REGISTER_SECRET`

## Phase 2: Static Invoice Page

- [ ] Create `static/base.css` — layout, responsive grid, urgency colors, print styles
- [ ] Create `templates/invoice.ejs` — full HTML5 invoice page with all sections
- [ ] Create `templates/expired.ejs` — expired state with Calendly embed
- [ ] Create `static/countdown.js` — requestAnimationFrame countdown with graduated urgency
- [ ] Create `static/self-destruct.js` — html2canvas Thanos snap disintegration effect
- [ ] Test countdown timer at all urgency thresholds (>3d, <24h, <1h, zero)
- [ ] Test self-destruct animation triggers and completes smoothly
- [ ] Test Calendly embed loads in expired state
- [ ] Test responsive layout on mobile viewports
- [ ] Test print styles

## Phase 3: Build Pipeline

- [ ] Create `scripts/build.js` — orchestrates token extraction -> CSS generation -> EJS render -> file output
- [ ] Create `scripts/register-invoice.js` — POST to /api/register after deploy
- [ ] Create `.github/workflows/generate-invoice.yml` — workflow_dispatch pipeline
- [ ] Test build script locally with sample invoice JSON
- [ ] Test GitHub Actions workflow via API trigger
- [ ] Verify deployed page is accessible
- [ ] Verify D1 registration succeeds
- [ ] Measure build time (target: <60 seconds)

## Phase 4: LLM CSS Matching

- [ ] Create `scripts/extract-design-tokens.js` — Playwright extraction of colors, fonts, CSS vars, Google Fonts, screenshot
- [ ] Create `scripts/generate-css.js` — Claude API multimodal CSS generation with PostCSS validation
- [ ] Implement `generateFallbackCSS()` — CSS-variables-based fallback for when extraction/LLM fails
- [ ] Implement PostCSS validation — auto-prefix unscoped selectors with `.invoice-container`
- [ ] Test extraction against 5+ diverse client websites
- [ ] Tune LLM prompt based on test results
- [ ] Verify build never fails regardless of extraction/LLM failures
- [ ] Document edge cases and handling

## Phase 5: Expiry Email System

- [ ] Implement `/api/register` endpoint in `src/index.ts` with secret validation
- [ ] Implement `scheduled()` handler in `src/index.ts` for daily cron
- [ ] Implement `processExpiredInvoices()` — D1 query + Resend email + status update
- [ ] Set up Resend account and configure DNS (SPF/DKIM)
- [ ] Test cron locally with `wrangler dev --test-scheduled`
- [ ] Verify no duplicate emails
- [ ] Test error handling (Resend failure doesn't block other emails)

## Phase 6: Integration & Polish

- [ ] End-to-end test: CRM webhook -> GitHub API -> build -> deploy -> register -> cron -> email
- [ ] Add security headers (`_headers` file or Worker response headers)
- [ ] Add structured error logging throughout pipeline
- [ ] Test on mobile devices (320px - 768px viewports)
- [ ] Test self-destruct animation performance on mobile
- [ ] Create Zapier/Make.com integration template
- [ ] Document invoice JSON data schema
- [ ] Provide sample curl command for manual triggering
- [ ] Optional: implement email verification gate for high-value invoices

---

## Notes

- Phases 2 and 5 can be developed in parallel after Phase 1
- Phase 4 can begin as soon as Phase 2 establishes the CSS class names
- Phase 3 integrates Phases 2 and 4, so it can start with stubs
- Phase 6 requires all other phases complete
