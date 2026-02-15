// scripts/extract-design-tokens.js
// Uses Playwright to visit a client's website and extract design tokens:
// colors (frequency-sorted), fonts, CSS custom properties, Google Fonts links, screenshot.

const { chromium } = require("playwright");

async function extractDesignTokens(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Extract computed styles from all DOM elements
    const tokens = await page.evaluate(() => {
      const colors = new Map();
      const fonts = new Set();

      document.querySelectorAll("*").forEach((el) => {
        const s = getComputedStyle(el);
        [s.color, s.backgroundColor, s.borderColor].forEach((c) => {
          if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") {
            colors.set(c, (colors.get(c) || 0) + 1);
          }
        });
        if (s.fontFamily) fonts.add(s.fontFamily);
      });

      // Sort colors by frequency (most used first)
      const sorted = [...colors.entries()].sort((a, b) => b[1] - a[1]);

      return {
        colors: sorted.slice(0, 12).map(([c]) => c),
        fonts: [...fonts],
      };
    });

    // Extract CSS custom properties from :root
    const cssVars = await page.evaluate(() => {
      const vars = {};
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === ":root") {
              for (const prop of rule.style) {
                if (prop.startsWith("--")) {
                  vars[prop] = rule.style.getPropertyValue(prop).trim();
                }
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheet — skip silently
        }
      }
      return vars;
    });

    // Detect Google Fonts link tags
    const googleFonts = await page.evaluate(() =>
      [...document.querySelectorAll('link[href*="fonts.googleapis"]')].map(
        (l) => l.href
      )
    );

    // Take full-page screenshot for LLM vision input
    await page.screenshot({
      path: "/tmp/client-screenshot.png",
      fullPage: true,
    });

    await browser.close();

    return { ...tokens, cssVars, googleFonts };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

module.exports = { extractDesignTokens };
