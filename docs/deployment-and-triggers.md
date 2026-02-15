# Deployment & External Triggers — Technical Reference

## GitHub Actions Pipeline

### Trigger: `workflow_dispatch`

The pipeline is triggered via the GitHub API's `workflow_dispatch` endpoint. This can be called by:
- CRM webhook (HubSpot, Salesforce, etc.)
- Zapier / Make.com automation
- Manual curl command
- Any HTTP client

Invoice data is passed as a **base64-encoded JSON string** to work around GitHub's 10-input limit for workflow_dispatch.

### Pipeline Steps

```
workflow_dispatch(invoice_data: base64)
  → checkout repo
  → setup Node.js 20
  → npm ci
  → base64 decode → invoice-data.json
  → install Playwright Chromium
  → node scripts/build.js (generates static HTML)
  → wrangler deploy (deploys Worker + static assets)
  → node scripts/register-invoice.js (registers in D1)
```

### Target: Under 60 seconds from trigger to deployed page

- `npm ci` with cache: ~5-10s
- Playwright install: ~10-15s
- Build (extraction + LLM + render): ~15-25s
- `wrangler deploy`: ~5-10s
- Registration: ~1-2s

## Cloudflare Deployment

### `wrangler deploy`

Single command deploys both:
1. Static assets in `public/` → served from Cloudflare's CDN
2. Worker script in `src/index.ts` → handles API and cron

Uses `cloudflare/wrangler-action@v3` (current recommended action; the older `cloudflare/pages-action` is deprecated).

### Asset Serving Configuration

```toml
[assets]
directory = "./public"
binding = "ASSETS"
html_handling = "drop-trailing-slash"
not_found_handling = "404-page"
run_worker_first = ["/api/*"]
```

- `run_worker_first = ["/api/*"]` ensures only API routes invoke the Worker
- All static invoice pages served directly from CDN with **zero compute cost**

## External Integration Examples

### Zapier Integration

1. **Trigger**: New deal closed in CRM (or any Zapier trigger)
2. **Code Step**: Build JSON and base64 encode
   ```js
   const data = {
     clientName: inputData.clientName,
     clientEmail: inputData.clientEmail,
     clientWebsite: inputData.clientWebsite,
     calendlyLink: "https://calendly.com/you/30min",
     items: [{
       description: inputData.serviceDescription,
       hours: parseInt(inputData.hours),
       rate: parseInt(inputData.rate)
     }]
   };
   output = { encoded: btoa(JSON.stringify(data)) };
   ```
3. **HTTP POST**:
   - URL: `https://api.github.com/repos/{owner}/{repo}/actions/workflows/generate-invoice.yml/dispatches`
   - Headers: `Authorization: Bearer {GITHUB_PAT}`, `Accept: application/vnd.github+json`
   - Body: `{"ref": "main", "inputs": {"invoice_data": "{encoded}"}}`
4. **Expected response**: `204 No Content` (workflow queued)

### Make.com Integration

1. **Trigger**: Watch module for CRM events
2. **JSON Module**: Compose invoice data object
3. **Tools > Base64**: Encode JSON string
4. **HTTP Module**: POST to GitHub API (same as Zapier)

### Manual curl Command

```bash
ENCODED=$(echo '{
  "clientName": "Acme Corp",
  "clientEmail": "cto@acme.com",
  "clientWebsite": "https://acme.com",
  "calendlyLink": "https://calendly.com/you/30min",
  "items": [{"description": "Web Dev", "hours": 40, "rate": 150}]
}' | base64 -w0)

curl -X POST \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/you/invoice-system/actions/workflows/generate-invoice.yml/dispatches" \
  -d "{\"ref\":\"main\",\"inputs\":{\"invoice_data\":\"$ENCODED\"}}"
```

## Cron Job: Daily Expiry Check

### Configuration

```toml
[triggers]
crons = ["0 9 * * *"]   # Daily at 9 AM UTC
```

### Flow

1. Cron fires `scheduled()` handler
2. Query D1: `SELECT * FROM invoices WHERE expiry_timestamp < ? AND email_sent = 0`
3. For each result:
   - Send email via Resend API
   - On success: `UPDATE invoices SET email_sent = 1, email_sent_at = ? WHERE id = ?`
   - On failure: Log error, skip (will retry next cron run)

### Local Testing

```bash
# Start dev server with cron support
npx wrangler dev --test-scheduled

# In another terminal, trigger the cron:
curl http://localhost:8787/__scheduled
```

## DNS & Email Setup (Resend)

### Required DNS Records

For sending domain (e.g., `invoices.yourdomain.com`):

1. **SPF** (TXT record): `v=spf1 include:_spf.resend.com ~all`
2. **DKIM** (TXT record): Provided by Resend during domain verification
3. **Return-Path** (CNAME): Provided by Resend

### Resend Configuration

- Sending address: `invoices@yourdomain.com`
- Free tier: 3,000 emails/month
- API key stored as `RESEND_API_KEY` in GitHub secrets and Cloudflare Worker secrets
