// tests/build.test.js
// Tests for the build pipeline — verifies that build.js produces correct output
// from test invoice data, including HTML structure, static assets, and metadata.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const TEST_DATA = path.join(ROOT, "test-invoice.json");

describe("Build Pipeline", () => {
  let invoiceId;

  before(() => {
    // Clean any previous build output
    if (fs.existsSync(PUBLIC_DIR)) {
      fs.rmSync(PUBLIC_DIR, { recursive: true });
    }

    // Run the build
    execSync(`node scripts/build.js`, {
      cwd: ROOT,
      env: { ...process.env, INVOICE_DATA_FILE: TEST_DATA },
      stdio: "pipe",
    });

    // Read the generated metadata to get the invoice ID
    const meta = JSON.parse(fs.readFileSync("/tmp/invoice-meta.json", "utf8"));
    invoiceId = meta.id;
  });

  after(() => {
    // Clean up build output
    if (fs.existsSync(PUBLIC_DIR)) {
      fs.rmSync(PUBLIC_DIR, { recursive: true });
    }
  });

  it("generates invoice HTML in correct output directory", () => {
    const htmlPath = path.join(PUBLIC_DIR, "invoice", invoiceId, "index.html");
    assert.ok(fs.existsSync(htmlPath), `Expected ${htmlPath} to exist`);
  });

  it("copies static assets to output directory", () => {
    const dir = path.join(PUBLIC_DIR, "invoice", invoiceId);
    assert.ok(fs.existsSync(path.join(dir, "base.css")));
    assert.ok(fs.existsSync(path.join(dir, "countdown.js")));
    assert.ok(fs.existsSync(path.join(dir, "self-destruct.js")));
  });

  it("copies html2canvas.min.js to output directory", () => {
    const dir = path.join(PUBLIC_DIR, "invoice", invoiceId);
    assert.ok(fs.existsSync(path.join(dir, "html2canvas.min.js")));
  });

  it("generates robots.txt with invoice disallow", () => {
    const robots = fs.readFileSync(
      path.join(PUBLIC_DIR, "robots.txt"),
      "utf8"
    );
    assert.ok(robots.includes("Disallow: /invoice/"));
  });

  it("generates _headers file with security headers", () => {
    const headers = fs.readFileSync(
      path.join(PUBLIC_DIR, "_headers"),
      "utf8"
    );
    assert.ok(headers.includes("X-Frame-Options: DENY"));
    assert.ok(headers.includes("Cache-Control: no-store"));
    assert.ok(headers.includes("Content-Security-Policy:"));
    assert.ok(headers.includes("Referrer-Policy: no-referrer"));
  });

  it("writes invoice metadata to /tmp/invoice-meta.json", () => {
    const meta = JSON.parse(fs.readFileSync("/tmp/invoice-meta.json", "utf8"));
    assert.ok(meta.id);
    assert.ok(meta.pageUrl);
    assert.ok(meta.expiryTimestamp);
    assert.equal(meta.clientName, "Acme Corp");
    assert.equal(meta.clientEmail, "cto@acme.com");
    assert.equal(meta.currency, "USD");
  });

  describe("Generated HTML content", () => {
    let html;

    before(() => {
      html = fs.readFileSync(
        path.join(PUBLIC_DIR, "invoice", invoiceId, "index.html"),
        "utf8"
      );
    });

    it("includes security meta tags", () => {
      assert.ok(html.includes('name="robots" content="noindex'));
      assert.ok(html.includes("Content-Security-Policy"));
    });

    it("includes client name", () => {
      assert.ok(html.includes("Acme Corp"));
    });

    it("includes line items", () => {
      assert.ok(html.includes("Web Application Development"));
      assert.ok(html.includes("UI/UX Design Consultation"));
      assert.ok(html.includes("Project Management"));
    });

    it("includes correct total", () => {
      // 40*150 + 10*200 + 5*125 = 6000 + 2000 + 625 = 8625
      assert.ok(html.includes("8,625.00"));
    });

    it("includes countdown element with data-expiry", () => {
      assert.ok(html.includes('class="countdown-display"'));
      assert.ok(html.includes("data-expiry="));
    });

    it("includes expired state with Calendly", () => {
      assert.ok(html.includes('class="expired-state"'));
      assert.ok(html.includes("calendly.com/you/30min"));
      assert.ok(html.includes("utm_source=expired_invoice"));
    });

    it("includes all required script tags", () => {
      assert.ok(html.includes('src="html2canvas.min.js"'));
      assert.ok(html.includes('src="self-destruct.js"'));
      assert.ok(html.includes('src="countdown.js"'));
      assert.ok(html.includes("assets.calendly.com"));
    });

    it("includes brand CSS (fallback)", () => {
      assert.ok(html.includes("--brand-primary:"));
      assert.ok(html.includes(".invoice-container"));
    });

    it("includes notes when provided", () => {
      assert.ok(html.includes("Payment is due within 7 days"));
    });

    it("sets expiry timestamp 7 days in the future", () => {
      const match = html.match(/data-expiry="(\d+)"/);
      assert.ok(match, "Expected data-expiry attribute");
      const expiry = parseInt(match[1], 10);
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      // Allow 60 seconds of tolerance for test execution time
      assert.ok(
        Math.abs(expiry - (now + sevenDays)) < 60000,
        `Expiry ${expiry} should be ~7 days from now (${now + sevenDays})`
      );
    });
  });
});
