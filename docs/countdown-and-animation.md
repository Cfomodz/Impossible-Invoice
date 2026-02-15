# Countdown Timer & Self-Destruct Animation — Technical Reference

## Countdown Timer (`static/countdown.js`)

### Design Principles

- Uses `requestAnimationFrame` instead of `setInterval`
  - Battery-efficient: automatically pauses in background tabs
  - Syncs with the browser's repaint cycle
  - No drift accumulation over long periods
- All calculations use `Date.now()` in UTC — eliminates timezone bugs entirely
- Expiry timestamp embedded as `data-expiry` attribute at build time (UTC milliseconds)

### Graduated Urgency Display

| Time Remaining | Message Format | Visual Style |
|---------------|---------------|-------------|
| > 3 days | "This invoice will self-destruct in 5d 12h 30m 15s" | Normal/calm |
| < 24 hours | "Self-destruct sequence initiated — 23h 14m 02s" | Warning/amber |
| < 1 hour | "Final countdown! 47m 12s" | Critical/red |
| = 0 | Triggers disintegration animation | N/A |

### Implementation Notes

```js
// Core countdown loop using requestAnimationFrame
function tick() {
  const now = Date.now();
  const remaining = expiryMs - now;

  if (remaining <= 0) {
    triggerSelfDestruct();
    return; // Stop the loop
  }

  updateDisplay(remaining);
  requestAnimationFrame(tick);
}
```

- The countdown element must have `data-expiry="{utcMilliseconds}"` attribute
- Display updates happen in the `requestAnimationFrame` callback — naturally throttled to screen refresh rate
- When reaching zero, calls the self-destruct function and stops the loop

## Self-Destruct Animation (`static/self-destruct.js`)

### The "Thanos Snap" Disintegration Effect

Uses `html2canvas` (~40KB, the only external dependency for this effect) to capture the invoice DOM as a canvas, then distributes pixels across 32 separate canvas layers with weighted randomness for a left-to-right dissolve.

### Algorithm

1. **Capture**: `html2canvas(element)` renders the invoice container to a canvas
2. **Distribute**: Loop through every pixel (RGBA). For each pixel:
   - Calculate base layer from X position: `Math.floor((x / width) * LAYERS)`
   - Add random jitter: `Math.floor((Math.random() - 0.5) * 8)`
   - Clamp to valid layer index: `Math.max(0, Math.min(LAYERS - 1, base + jitter))`
   - Copy pixel data to target layer's ImageData
3. **Hide original**: Set `element.style.opacity = '0'`
4. **Create layer canvases**: For each of the 32 layers:
   - Create a `<canvas>` element absolutely positioned over the original
   - Put the layer's ImageData into it
   - Append to `document.body`
5. **Animate**: Stagger animation start per layer:
   - Delay: `idx * 70ms`
   - Transition duration: `800 + idx * 50ms` for transform, `600 + idx * 50ms` for opacity
   - Transform: random rotation (+-30deg), random translate (X: +-120px, Y: +-80px)
   - Opacity: fade to 0
   - Filter: blur(2px)
6. **Cleanup**: After 1500ms per layer, remove canvas element from DOM

### Visual Result

The invoice literally dissolves into particles from left to right over ~2 seconds. The weighted randomness per layer creates a natural "disintegration" pattern rather than sharp vertical slices.

### Post-Animation Sequence

After animation completes (~2.5 seconds total):

1. Fade in the expired state container (`.expired-state`)
2. Show centered heading: "This invoice has self-destructed!"
3. Show subtitle: "Your mission, should you choose to accept it, is to book a new call"
4. Show CTA button linking to Calendly embed
5. Load Calendly inline embed with:
   - Pre-filled client name and email
   - UTM parameters: `utm_source=expired_invoice`, `utm_content={invoice_id}`

### Performance Considerations

- `html2canvas` may struggle with very complex DOMs — keep the invoice layout simple
- 32 canvas layers x full invoice size = significant memory during animation
- On mobile: consider reducing to 16 layers for performance
- All canvas elements are cleaned up after animation completes
- Animation uses CSS transitions (GPU-accelerated) rather than JavaScript frame-by-frame

### Dependencies

- `html2canvas` (~40KB) — loaded from local bundle, not CDN (for CSP compliance)
- No other external dependencies for the animation
