// scripts/register-invoice.js
// Called after wrangler deploy to register invoice metadata in D1
// via the Worker's /api/register endpoint.
// Retries up to 4 times with exponential backoff on network failures.

const fs = require("fs");

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerInvoice() {
  const metaPath = "/tmp/invoice-meta.json";

  if (!fs.existsSync(metaPath)) {
    throw new Error(`Invoice metadata not found at ${metaPath}`);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const workerUrl = process.env.WORKER_URL;
  const registerSecret = process.env.REGISTER_SECRET;

  if (!workerUrl) {
    throw new Error("WORKER_URL environment variable is required");
  }
  if (!registerSecret) {
    throw new Error("REGISTER_SECRET environment variable is required");
  }

  console.log(`Registering invoice ${meta.id} at ${workerUrl}/api/register...`);

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${workerUrl}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${registerSecret}`,
        },
        body: JSON.stringify(meta),
      });

      if (!response.ok) {
        const body = await response.text();
        // Don't retry on 4xx client errors — they won't succeed on retry
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Registration failed (${response.status}): ${body}`);
        }
        throw new Error(`Server error (${response.status}): ${body}`);
      }

      const result = await response.json();
      console.log("Invoice registered successfully:", result);
      return;
    } catch (err) {
      lastError = err;
      // Don't retry client errors (4xx)
      if (err.message && err.message.includes("Registration failed")) {
        throw err;
      }
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `Attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delay / 1000}s...`
        );
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Registration failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`
  );
}

registerInvoice().catch((err) => {
  console.error("Registration failed:", err);
  process.exit(1);
});
