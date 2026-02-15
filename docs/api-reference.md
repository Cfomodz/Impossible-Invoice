# API Reference

## Worker Endpoints

### POST /api/register

Registers a new invoice in the D1 database after deployment.

**Authentication**: `Authorization: Bearer {REGISTER_SECRET}`

**Request Body**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "clientName": "Acme Corp",
  "clientEmail": "cto@acme.com",
  "amount": 6000.00,
  "currency": "USD",
  "expiryTimestamp": 1739750400000,
  "pageUrl": "/invoice/a1b2c3d4-e5f6-7890-abcd-ef1234567890/",
  "calendlyLink": "https://calendly.com/you/30min"
}
```

**Response**:
- `201 Created`: `{ "success": true }`
- `401 Unauthorized`: Missing or invalid `REGISTER_SECRET`
- `400 Bad Request`: Invalid or missing required fields

**Required fields**: `id`, `clientName`, `clientEmail`, `amount`, `expiryTimestamp`, `pageUrl`, `calendlyLink`

**Optional fields**: `currency` (defaults to `"USD"`)

---

## GitHub Actions Trigger

### workflow_dispatch: Generate and Deploy Invoice

**Endpoint**: `POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/generate-invoice.yml/dispatches`

**Headers**:
```
Authorization: Bearer {GITHUB_PAT}
Accept: application/vnd.github+json
```

**Body**:
```json
{
  "ref": "main",
  "inputs": {
    "invoice_data": "<base64-encoded-json>"
  }
}
```

**Response**: `204 No Content` (workflow queued)

### Invoice Data JSON Schema (before base64 encoding)

```json
{
  "clientName": "Acme Corp",
  "clientEmail": "cto@acme.com",
  "clientWebsite": "https://acme.com",
  "calendlyLink": "https://calendly.com/you/30min",
  "companyName": "Your Company",
  "companyEmail": "hello@yourcompany.com",
  "items": [
    {
      "description": "Web Development",
      "hours": 40,
      "rate": 150
    },
    {
      "description": "Design Consultation",
      "hours": 10,
      "rate": 200
    }
  ],
  "brandColor": "#2563eb",
  "id": "optional-custom-uuid",
  "expiryTimestamp": 1739750400000,
  "currency": "USD",
  "notes": "Payment due within 7 days."
}
```

**Required fields**: `clientName`, `clientEmail`, `calendlyLink`, `items[]`

**Optional fields**: `clientWebsite` (for brand extraction), `companyName`, `companyEmail`, `brandColor` (fallback), `id` (auto-generated UUID v4), `expiryTimestamp` (defaults to 7 days from build), `currency` (defaults to USD), `notes`

### Example: Manual Trigger via curl

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

---

## D1 Database Schema

### Table: invoices

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT | (required) | UUID v4 primary key |
| `client_name` | TEXT NOT NULL | (required) | Client display name |
| `client_email` | TEXT NOT NULL | (required) | Client email for notifications |
| `amount` | REAL NOT NULL | (required) | Total invoice amount |
| `currency` | TEXT | `'USD'` | Currency code |
| `expiry_timestamp` | INTEGER NOT NULL | (required) | Expiry time in Unix ms |
| `email_sent` | INTEGER | `0` | 0 = not sent, 1 = sent |
| `email_sent_at` | TEXT | NULL | ISO 8601 datetime of email send |
| `page_url` | TEXT | NULL | Path to invoice page |
| `calendly_link` | TEXT | NULL | Calendly booking URL |
| `created_at` | TEXT | `datetime('now')` | Record creation time |

### Indexes

- `idx_expiry ON invoices(expiry_timestamp, email_sent)` — optimizes the cron query

---

## Resend Email Template

The cron handler sends this HTML email for expired invoices:

```html
<h1>Invoice Expired</h1>
<p>Hi {client_name},</p>
<p>The proposal we sent has passed its expiry window.
Pricing and availability may have changed.</p>
<p><a href="{calendly_link}">Book a quick call</a>
to get an updated proposal.</p>
```

---

## Security Headers

Applied to all `/invoice/*` routes via `public/_headers` or Worker response:

```
X-Robots-Tag: noindex, nofollow, noarchive
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; script-src 'self' https://assets.calendly.com; frame-src https://calendly.com
```
