-- D1 Database Schema for Impossible Invoice System
-- Apply with: wrangler d1 execute invoice-db --file=schema.sql

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  expiry_timestamp INTEGER NOT NULL,
  email_sent INTEGER DEFAULT 0,
  email_sent_at TEXT,
  page_url TEXT,
  calendly_link TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for the cron query: find expired invoices that haven't been emailed
CREATE INDEX IF NOT EXISTS idx_expiry ON invoices(expiry_timestamp, email_sent);
