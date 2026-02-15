// scripts/register-invoice.js
// Called after wrangler deploy to register invoice metadata in D1
// via the Worker's /api/register endpoint.

const fs = require("fs");

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
    throw new Error(
      `Registration failed (${response.status}): ${body}`
    );
  }

  const result = await response.json();
  console.log("Invoice registered successfully:", result);
}

registerInvoice().catch((err) => {
  console.error("Registration failed:", err);
  process.exit(1);
});
