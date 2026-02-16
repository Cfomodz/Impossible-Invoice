// tests/generate-css.test.js
// Tests for CSS generation — fallback CSS and PostCSS validation.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { generateFallbackCSS, validateCSS } = require("../scripts/generate-css");

describe("generateFallbackCSS", () => {
  it("returns valid CSS string", () => {
    const css = generateFallbackCSS("#2563eb");
    assert.ok(typeof css === "string");
    assert.ok(css.length > 100);
  });

  it("uses provided primary color", () => {
    const css = generateFallbackCSS("#ff0000");
    assert.ok(css.includes("#ff0000"));
  });

  it("scopes all selectors under .invoice-container", () => {
    const css = generateFallbackCSS("#2563eb");
    // Extract selectors (lines starting with . or containing {)
    const lines = css.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith(".") &&
        trimmed.includes("{") &&
        !trimmed.startsWith(".invoice-container")
      ) {
        assert.fail(
          `Selector not scoped under .invoice-container: ${trimmed}`
        );
      }
    }
  });

  it("includes all required CSS class targets", () => {
    const css = generateFallbackCSS("#2563eb");
    const requiredClasses = [
      ".invoice-header",
      ".invoice-meta",
      ".invoice-table",
      ".invoice-totals",
      ".invoice-footer",
      ".countdown-display",
      ".cta-button",
    ];
    for (const cls of requiredClasses) {
      assert.ok(css.includes(cls), `Expected CSS to include ${cls}`);
    }
  });

  it("includes print media query", () => {
    const css = generateFallbackCSS("#2563eb");
    assert.ok(css.includes("@media print"));
  });

  it("includes mobile responsive breakpoint", () => {
    const css = generateFallbackCSS("#2563eb");
    assert.ok(css.includes("@media (max-width:"));
  });
});

describe("validateCSS", () => {
  it("prefixes unscoped selectors with .invoice-container", async () => {
    const input = `.some-class { color: red; }`;
    const result = await validateCSS(input);
    assert.ok(result.includes(".invoice-container .some-class"));
  });

  it("leaves already-scoped selectors unchanged", async () => {
    const input = `.invoice-container .header { color: blue; }`;
    const result = await validateCSS(input);
    assert.ok(result.includes(".invoice-container .header"));
    // Should not double-prefix
    assert.ok(!result.includes(".invoice-container .invoice-container"));
  });

  it("handles media queries", async () => {
    const input = `@media print { .hide { display: none; } }`;
    const result = await validateCSS(input);
    assert.ok(result.includes("@media print"));
    assert.ok(result.includes(".invoice-container .hide"));
  });
});
