import { Resend } from "resend";

interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  ASSETS: Fetcher;
  REGISTER_SECRET: string;
  FROM_EMAIL?: string;
}

interface InvoiceRecord {
  id: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  expiry_timestamp: number;
  email_sent: number;
  email_sent_at: string | null;
  page_url: string;
  calendly_link: string;
  created_at: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/register" && request.method === "POST") {
      // Validate authentication
      const authHeader = request.headers.get("Authorization");
      if (authHeader !== `Bearer ${env.REGISTER_SECRET}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const invoice = (await request.json()) as Record<string, unknown>;

        // Validate required fields
        const required = [
          "id",
          "clientName",
          "clientEmail",
          "amount",
          "expiryTimestamp",
          "pageUrl",
        ] as const;
        const missing = required.filter((f) => !invoice[f]);
        if (missing.length > 0) {
          return new Response(
            JSON.stringify({
              error: `Missing required fields: ${missing.join(", ")}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (typeof invoice.amount !== "number" || invoice.amount <= 0) {
          return new Response(
            JSON.stringify({ error: "amount must be a positive number" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        if (typeof invoice.expiryTimestamp !== "number") {
          return new Response(
            JSON.stringify({
              error: "expiryTimestamp must be a number (UTC milliseconds)",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        await env.DB.prepare(
          `INSERT INTO invoices (id, client_name, client_email, amount, currency, expiry_timestamp, page_url, calendly_link)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            invoice.id,
            invoice.clientName,
            invoice.clientEmail,
            invoice.amount,
            invoice.currency || "USD",
            invoice.expiryTimestamp,
            invoice.pageUrl,
            invoice.calendlyLink
          )
          .run();

        return new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // All other routes: let Cloudflare serve static assets (this 404 is the fallback)
    return new Response("Not Found", { status: 404 });
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ) {
    ctx.waitUntil(processExpiredInvoices(env));
  },
};

async function processExpiredInvoices(env: Env): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY);
  const now = Date.now();

  const { results } = await env.DB.prepare(
    "SELECT * FROM invoices WHERE expiry_timestamp < ? AND email_sent = 0"
  )
    .bind(now)
    .all<InvoiceRecord>();

  for (const inv of results) {
    try {
      const { error } = await resend.emails.send({
        from: env.FROM_EMAIL || "invoices@yourdomain.com",
        to: inv.client_email,
        subject: "Your invoice has expired — book a call for updated pricing",
        html: `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 2rem;">
  <h1 style="color: #991b1b;">Invoice Expired</h1>
  <p>Hi ${inv.client_name},</p>
  <p>The invoice we sent you (${inv.currency} ${inv.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}) has passed its expiry window. Pricing and availability may have changed.</p>
  <p>Ready to move forward? Book a quick call to get an updated proposal:</p>
  <p style="text-align: center; margin: 2rem 0;">
    <a href="${inv.calendly_link}" style="display: inline-block; padding: 0.75rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600;">Book a Call</a>
  </p>
</body>
</html>`,
      });

      if (!error) {
        await env.DB.prepare(
          "UPDATE invoices SET email_sent = 1, email_sent_at = ? WHERE id = ?"
        )
          .bind(new Date().toISOString(), inv.id)
          .run();
        console.log(`Email sent for invoice ${inv.id}`);
      } else {
        console.error(`Failed to send email for invoice ${inv.id}:`, error);
      }
    } catch (err) {
      // Log error but continue processing other invoices
      console.error(`Error processing invoice ${inv.id}:`, err);
    }
  }

  console.log(`Processed ${results.length} expired invoices`);
}
