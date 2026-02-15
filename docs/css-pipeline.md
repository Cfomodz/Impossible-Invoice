# LLM CSS Pipeline — Technical Reference

## Overview

The CSS matching pipeline has three stages: **Extract -> Prompt -> Validate**. At build time, a headless browser visits the client's website, captures computed styles, and distills them into structured design tokens. These tokens feed an LLM prompt that generates scoped CSS. A PostCSS validation step ensures the output is clean.

## Stage 1: Design Token Extraction

**File**: `scripts/extract-design-tokens.js`

Uses Playwright to render the client's site and extract the actual computed values — not just what's in the CSS files, but what the browser actually renders after cascade resolution, media queries, and JavaScript execution.

### Extraction targets:
- **Colors**: `color`, `backgroundColor`, `borderColor` from all DOM elements — frequency-sorted, top 12
- **Fonts**: All unique `fontFamily` values
- **CSS Custom Properties**: From `:root` rules across all stylesheets
- **Google Fonts**: Detected from `<link href="fonts.googleapis.com">` tags
- **Screenshot**: Full-page screenshot for LLM vision input

### Output format:
```js
{
  colors: ['rgb(51, 51, 51)', 'rgb(255, 255, 255)', ...],  // Top 12 by frequency
  fonts: ['"Inter", sans-serif', '"Roboto", sans-serif'],
  cssVars: { '--primary': '#2563eb', '--bg': '#ffffff', ... },
  googleFonts: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap']
}
```

### Error handling:
- Timeout after 30 seconds on page load
- Catch cross-origin stylesheet access errors silently
- Return partial tokens if some extraction fails
- Caller handles total failure via fallback CSS path

### Alternative: `dembrandt` npm package
Wraps Playwright and outputs design tokens in DTCG (Design Token Community Group) standard format:
```bash
dembrandt https://acme.com > tokens.json
```
Extracts colors, typography, spacing, borders, logos, and shadows automatically. Consider using this to simplify Stage 1.

## Stage 2: LLM CSS Generation

**File**: `scripts/generate-css.js`

### Claude API call configuration:
- **Model**: `claude-sonnet-4-20250514`
- **Temperature**: `0.2` (low creativity, high consistency)
- **Max tokens**: `4096`
- **System prompt**: "You are a CSS expert. Output only valid, scoped CSS. Never use !important or global selectors."

### Multimodal input:
1. **Image** (if screenshot exists): Base64-encoded PNG of client website
2. **Text prompt** with:
   - Top 6 colors by frequency
   - Top 3 font families
   - CSS custom properties from site
   - Google Fonts URLs
   - Strict requirements (see below)

### CSS Requirements (in prompt):
1. Scope ALL selectors under `.invoice-container`
2. Define CSS custom properties on `.invoice-container`
3. Must style these classes:
   - `.invoice-header`
   - `.invoice-meta`
   - `.invoice-table` (including `th` and `td`)
   - `.invoice-totals`
   - `.invoice-footer`
   - `.countdown-display`
   - `.cta-button`
4. Include `@media print` styles
5. Output ONLY valid CSS — no markdown fences, no backticks, no explanation text

### Post-processing:
Strip any residual markdown fences: remove ` ```css ` and ` ``` ` patterns from output.

## Stage 3: PostCSS Validation

Parses the LLM output with PostCSS and auto-prefixes any selectors that aren't properly scoped:

```js
const postcss = require('postcss');

async function validateCSS(css) {
  const root = postcss.parse(css);
  root.walkRules(rule => {
    if (!rule.selector.includes('.invoice-container')) {
      rule.selector = `.invoice-container ${rule.selector}`;
    }
  });
  return root.toString();
}
```

This ensures that even if the LLM generates unscoped selectors, they won't leak into the global CSS namespace.

## Fallback CSS

When extraction or LLM generation fails, `generateFallbackCSS(primaryColor)` produces a professional-looking invoice using CSS custom properties:

```js
function generateFallbackCSS(primaryColor) {
  return `.invoice-container {
    --brand-primary: ${primaryColor};
    --brand-text: #1f2937;
    --brand-bg: #ffffff;
    font-family: 'Inter', system-ui, sans-serif;
    /* ... standard invoice layout rules ... */
  }`;
}
```

**Fallback is triggered when**:
- Client website URL is not provided
- Playwright fails to load the client website (timeout, DNS failure, blocking)
- Claude API is unavailable or returns an error
- Generated CSS fails PostCSS parsing

**The build NEVER fails due to CSS generation issues.**

## Testing Strategy

Test the extraction + generation pipeline against diverse websites:

| Website Type | Example | Expected Challenge |
|-------------|---------|-------------------|
| Modern SPA (React) | Various | Dynamic rendering, lazy-loaded styles |
| WordPress | Various | Theme complexity, many stylesheets |
| Static site | Various | Clean extraction |
| Dark theme | Various | Inverted color palette |
| Minimal/brutalist | Various | Few colors, unusual fonts |
| Heavy custom fonts | Various | Google Fonts detection |

For each test:
1. Run extraction and log tokens
2. Generate CSS and visually inspect
3. Validate CSS scoping
4. Render sample invoice and compare to source site
