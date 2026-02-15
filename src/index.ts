import { Resend } from "resend";

interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  ASSETS: Fetcher;
  REGISTER_SECRET: string;
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

        // TODO: Add input validation for required fields

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
        from: "invoices@yourdomain.com", // TODO: Configure sending domain
        to: inv.client_email,
        subject: "Your invoice has self-destructed",
        html: `<h1>Invoice Expired</h1>
<p>Hi ${inv.client_name},</p>
<p>The proposal we sent has passed its expiry window.
Pricing and availability may have changed.</p>
<p><a href="${inv.calendly_link}">Book a quick call</a>
to get an updated proposal.</p>`,
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
