// tests/register-invoice.test.js
// Tests for register-invoice.js retry/backoff logic.
// Uses injectable fetchFn and sleepFn to keep tests fast and deterministic.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { registerInvoice } = require("../scripts/register-invoice");

const TEST_META = {
  id: "test-invoice-id",
  pageUrl: "/invoice/test-invoice-id/",
  expiryTimestamp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  clientName: "Test Client",
  clientEmail: "test@example.com",
  amount: 1000,
  currency: "USD",
  calendlyLink: "https://calendly.com/test/30min",
};

// No-op sleep so the retry delay is instant in tests
const noSleep = () => Promise.resolve();

describe("registerInvoice retry logic", () => {
  let originalWorkerUrl;
  let originalRegisterSecret;

  before(() => {
    fs.writeFileSync("/tmp/invoice-meta.json", JSON.stringify(TEST_META));
    originalWorkerUrl = process.env.WORKER_URL;
    originalRegisterSecret = process.env.REGISTER_SECRET;
    process.env.WORKER_URL = "https://test-worker.example.com";
    process.env.REGISTER_SECRET = "test-secret";
  });

  after(() => {
    process.env.WORKER_URL = originalWorkerUrl;
    process.env.REGISTER_SECRET = originalRegisterSecret;
  });

  it("registers successfully on the first attempt", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return { ok: true, json: async () => ({ success: true }) };
    };

    await registerInvoice({ fetchFn: mockFetch, sleepFn: noSleep });
    assert.equal(callCount, 1);
  });

  it("aborts immediately on 4xx errors without retrying", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return { ok: false, status: 401, text: async () => "Unauthorized" };
    };

    await assert.rejects(
      () => registerInvoice({ fetchFn: mockFetch, sleepFn: noSleep }),
      /Registration failed \(401\)/
    );
    assert.equal(callCount, 1, "Should not retry after a 4xx response");
  });

  it("retries on network errors and succeeds when a later attempt works", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount < 3) throw new Error("Network error");
      return { ok: true, json: async () => ({ success: true }) };
    };

    await registerInvoice({ fetchFn: mockFetch, sleepFn: noSleep });
    assert.equal(callCount, 3, "Should retry twice before succeeding");
  });

  it("retries on 5xx server errors and succeeds when a later attempt works", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount < 2) {
        return { ok: false, status: 503, text: async () => "Service Unavailable" };
      }
      return { ok: true, json: async () => ({ success: true }) };
    };

    await registerInvoice({ fetchFn: mockFetch, sleepFn: noSleep });
    assert.equal(callCount, 2, "Should retry once before succeeding");
  });

  it("throws after exhausting all retries", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return { ok: false, status: 503, text: async () => "Service Unavailable" };
    };

    await assert.rejects(
      () => registerInvoice({ fetchFn: mockFetch, sleepFn: noSleep }),
      /Registration failed after/
    );
    // 1 initial attempt + MAX_RETRIES (4) = 5 total
    assert.equal(callCount, 5, "Should try 5 times before giving up");
  });
});
