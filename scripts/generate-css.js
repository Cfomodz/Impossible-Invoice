// scripts/generate-css.js
// Uses Claude API (multimodal) to generate brand-matching CSS for invoices.
// Falls back to a CSS-variables-based template if LLM is unavailable.

const Anthropic = require("@anthropic-ai/sdk");
const postcss = require("postcss");
const fs = require("fs");

/**
 * Generate brand-matching CSS using Claude API with extracted design tokens
 * and an optional screenshot of the client's website.
 */
async function generateBrandCSS(tokens) {
  const anthropic = new Anthropic();

  const hasScreenshot = fs.existsSync("/tmp/client-screenshot.png");

  const content = [
    // Include screenshot if available (multimodal vision input)
    ...(hasScreenshot
      ? [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: fs
                .readFileSync("/tmp/client-screenshot.png")
                .toString("base64"),
            },
          },
        ]
      : []),
    {
      type: "text",
      text: `Generate CSS for a professional invoice page matching this brand.

EXTRACTED TOKENS:
- Top colors by frequency: ${tokens.colors.slice(0, 6).join(", ")}
- Font families: ${tokens.fonts.slice(0, 3).join(", ")}
- CSS variables from site: ${JSON.stringify(tokens.cssVars)}
- Google Fonts: ${tokens.googleFonts.join(", ") || "none detected"}

REQUIREMENTS:
1. Scope ALL selectors under .invoice-container
2. Define CSS custom properties on .invoice-container
3. Style: .invoice-header, .invoice-meta, .invoice-table (th/td),
   .invoice-totals, .invoice-footer, .countdown-display, .cta-button
4. Include @media print styles
5. Output ONLY valid CSS — no markdown, no backticks, no explanation`,
    },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0.2,
    system:
      "You are a CSS expert. Output only valid, scoped CSS. Never use !important or global selectors.",
    messages: [{ role: "user", content }],
  });

  // Strip any residual markdown fences
  let css = response.content[0].text
    .replace(/```css\n?/g, "")
    .replace(/```\n?/g, "");

  // Validate and fix scoping
  css = await validateCSS(css);

  return css;
}

/**
 * PostCSS validation: ensure all selectors are scoped under .invoice-container
 */
async function validateCSS(css) {
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    if (!rule.selector.includes(".invoice-container")) {
      rule.selector = `.invoice-container ${rule.selector}`;
    }
  });
  return root.toString();
}

/**
 * Fallback CSS when LLM or extraction fails.
 * Uses CSS custom properties populated with extracted or default colors.
 */
function generateFallbackCSS(primaryColor) {
  return `.invoice-container {
  --brand-primary: ${primaryColor};
  --brand-primary-light: ${primaryColor}1a;
  --brand-text: #1f2937;
  --brand-text-light: #6b7280;
  --brand-bg: #ffffff;
  --brand-border: #e5e7eb;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: var(--brand-bg);
  color: var(--brand-text);
  line-height: 1.6;
}

.invoice-container .invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid var(--brand-primary);
  margin-bottom: 2rem;
}

.invoice-container .invoice-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 2rem;
  color: var(--brand-text-light);
}

.invoice-container .invoice-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
}

.invoice-container .invoice-table th {
  background: var(--brand-primary);
  color: white;
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
}

.invoice-container .invoice-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--brand-border);
}

.invoice-container .invoice-table tr:hover td {
  background: var(--brand-primary-light);
}

.invoice-container .invoice-totals {
  text-align: right;
  margin-bottom: 2rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--brand-primary);
}

.invoice-container .invoice-footer {
  padding-top: 1.5rem;
  border-top: 1px solid var(--brand-border);
  color: var(--brand-text-light);
  font-size: 0.875rem;
}

.invoice-container .countdown-display {
  text-align: center;
  padding: 1.5rem;
  margin: 2rem 0;
  border-radius: 0.5rem;
  background: #fef3c7;
  color: #92400e;
  font-size: 1.125rem;
  font-weight: 600;
}

.invoice-container .countdown-display.urgent {
  background: #fee2e2;
  color: #991b1b;
}

.invoice-container .countdown-display.critical {
  background: #991b1b;
  color: white;
  animation: pulse 1s ease-in-out infinite;
}

.invoice-container .cta-button {
  display: inline-block;
  padding: 1rem 2rem;
  background: var(--brand-primary);
  color: white;
  text-decoration: none;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 1.125rem;
  transition: opacity 0.2s;
}

.invoice-container .cta-button:hover {
  opacity: 0.9;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

@media print {
  .invoice-container .countdown-display,
  .invoice-container .cta-button {
    display: none;
  }
  .invoice-container {
    padding: 0;
    max-width: 100%;
  }
}

@media (max-width: 640px) {
  .invoice-container {
    padding: 1rem;
  }
  .invoice-container .invoice-header {
    flex-direction: column;
    gap: 1rem;
  }
  .invoice-container .invoice-meta {
    grid-template-columns: 1fr;
  }
}`;
}

module.exports = { generateBrandCSS, generateFallbackCSS, validateCSS };
