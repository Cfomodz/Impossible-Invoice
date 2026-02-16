// scripts/build.js
// Main build script: reads invoice JSON, extracts brand tokens, generates CSS,
// renders EJS template, writes static HTML output to public/

const ejs = require("ejs");
const fs = require("fs");
const path = require("path");
const { extractDesignTokens } = require("./extract-design-tokens");
const { generateBrandCSS, generateFallbackCSS } = require("./generate-css");
const { v4: uuidv4 } = require("uuid");

async function build() {
  // Load invoice data from file (written by GitHub Actions decode step)
  const dataFile = process.env.INVOICE_DATA_FILE;
  if (!dataFile) {
    throw new Error("INVOICE_DATA_FILE environment variable is required");
  }
  const raw = fs.readFileSync(dataFile, "utf8");
  const invoice = JSON.parse(raw);

  // Generate UUID if not provided
  invoice.id = invoice.id || uuidv4();

  // Calculate expiry: 7 days from now
  const expiryMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
  invoice.expiryTimestamp = invoice.expiryTimestamp || expiryMs;

  // Calculate total amount from line items
  invoice.amount =
    invoice.amount ||
    invoice.items.reduce((sum, item) => sum + item.hours * item.rate, 0);

  // Step 1: Extract client's design tokens and generate brand CSS
  let brandCSS;
  if (invoice.clientWebsite) {
    try {
      console.log(
        `Extracting design tokens from ${invoice.clientWebsite}...`
      );
      const tokens = await extractDesignTokens(invoice.clientWebsite);
      console.log(
        `Tokens extracted. Colors: ${tokens.colors.length}, Fonts: ${tokens.fonts.length}`
      );
      brandCSS = await generateBrandCSS(tokens);
      console.log("Brand CSS generated via LLM.");
    } catch (err) {
      console.warn("Brand extraction failed, using fallback:", err.message);
      brandCSS = generateFallbackCSS(invoice.brandColor || "#2563eb");
    }
  } else {
    console.log("No clientWebsite provided, using fallback CSS.");
    brandCSS = generateFallbackCSS(invoice.brandColor || "#2563eb");
  }

  // Step 2: Render invoice HTML
  const html = await ejs.renderFile(
    path.join(__dirname, "../templates/invoice.ejs"),
    {
      ...invoice,
      brandCSS,
      expiryTimestamp: invoice.expiryTimestamp,
    },
    { async: true }
  );

  // Step 3: Write to public/invoice/{id}/
  const outDir = path.join(__dirname, "../public/invoice", invoice.id);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);

  // Step 4: Copy static assets
  const staticDir = path.join(__dirname, "../static");
  for (const file of fs.readdirSync(staticDir)) {
    fs.copyFileSync(path.join(staticDir, file), path.join(outDir, file));
  }

  // Step 4b: Copy html2canvas from node_modules (used by self-destruct.js)
  const html2canvasPath = path.join(
    __dirname,
    "../node_modules/html2canvas/dist/html2canvas.min.js"
  );
  if (fs.existsSync(html2canvasPath)) {
    fs.copyFileSync(html2canvasPath, path.join(outDir, "html2canvas.min.js"));
  } else {
    console.warn("html2canvas.min.js not found in node_modules — self-destruct animation will be skipped");
  }

  // Step 5: Write robots.txt
  fs.mkdirSync(path.join(__dirname, "../public"), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, "../public/robots.txt"),
    "User-agent: *\nDisallow: /invoice/\n"
  );

  // Step 6: Write _headers file for security headers
  fs.writeFileSync(
    path.join(__dirname, "../public/_headers"),
    `/invoice/*
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; script-src 'self' https://assets.calendly.com; frame-src https://calendly.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:
`
  );

  console.log(`\nInvoice ${invoice.id} built → /invoice/${invoice.id}/`);

  // Output for GitHub Actions to use in subsequent steps
  const meta = {
    id: invoice.id,
    pageUrl: `/invoice/${invoice.id}/`,
    expiryTimestamp: invoice.expiryTimestamp,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    amount: invoice.amount,
    currency: invoice.currency || "USD",
    calendlyLink: invoice.calendlyLink,
  };
  fs.writeFileSync("/tmp/invoice-meta.json", JSON.stringify(meta, null, 2));
  console.log("Invoice metadata written to /tmp/invoice-meta.json");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
