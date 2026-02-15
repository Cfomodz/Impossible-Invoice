// static/self-destruct.js
// "Thanos snap" pixel disintegration effect using html2canvas.
// Captures the invoice container, distributes pixels across 32 canvas layers,
// then animates each layer with staggered rotation, translation, blur, and fade.

(function () {
  "use strict";

  const LAYERS = 32;

  /**
   * Disintegrate the given DOM element with a left-to-right particle dissolve.
   */
  async function disintegrate(element) {
    // html2canvas must be loaded (included in the page)
    if (typeof html2canvas !== "function") {
      console.error("html2canvas is required for the self-destruct animation");
      showExpiredState();
      return;
    }

    const sourceCanvas = await html2canvas(element);
    const { width, height } = sourceCanvas;
    const ctx = sourceCanvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, width, height).data;

    // Create empty ImageData for each layer
    const layers = Array.from({ length: LAYERS }, () =>
      ctx.createImageData(width, height)
    );

    // Distribute pixels across layers with left-to-right sweep + jitter
    for (let i = 0; i < imageData.length; i += 4) {
      const x = (i / 4) % width;
      const base = Math.floor((x / width) * LAYERS);
      const jitter = Math.floor((Math.random() - 0.5) * 8);
      const target = Math.max(0, Math.min(LAYERS - 1, base + jitter));

      for (let c = 0; c < 4; c++) {
        layers[target].data[i + c] = imageData[i + c];
      }
    }

    // Hide the original element
    element.style.opacity = "0";

    const rect = element.getBoundingClientRect();

    // Create and animate each layer canvas
    layers.forEach((imgData, idx) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      Object.assign(canvas.style, {
        position: "absolute",
        left: `${rect.left}px`,
        top: `${rect.top + window.scrollY}px`,
        pointerEvents: "none",
        transition: `transform ${800 + idx * 50}ms ease-out,
                     opacity ${600 + idx * 50}ms ease-out`,
      });

      canvas.getContext("2d").putImageData(imgData, 0, 0);
      document.body.appendChild(canvas);

      // Stagger the animation start for each layer
      requestAnimationFrame(() =>
        setTimeout(() => {
          const rotDeg = (Math.random() - 0.5) * 30;
          const transX = (Math.random() - 0.3) * 120;
          const transY = (Math.random() - 0.7) * 80;

          canvas.style.transform = `rotate(${rotDeg}deg) translate(${transX}px, ${transY}px)`;
          canvas.style.opacity = "0";
          canvas.style.filter = "blur(2px)";

          // Clean up canvas after animation completes
          setTimeout(() => canvas.remove(), 1500);
        }, idx * 70)
      );
    });

    // Show expired state after animation completes
    const totalAnimationTime = LAYERS * 70 + 1500 + 500;
    setTimeout(showExpiredState, totalAnimationTime);
  }

  /**
   * Show the expired state with Calendly embed.
   */
  function showExpiredState() {
    const expiredEl = document.querySelector(".expired-state");
    if (expiredEl) {
      expiredEl.style.display = "flex";
      expiredEl.style.opacity = "0";
      // Fade in
      requestAnimationFrame(() => {
        expiredEl.style.transition = "opacity 0.5s ease-in";
        expiredEl.style.opacity = "1";
      });
    }
  }

  /**
   * Entry point — called by countdown.js when timer reaches zero.
   */
  window.triggerSelfDestruct = function () {
    const invoiceEl = document.querySelector(".invoice-container");
    if (invoiceEl) {
      disintegrate(invoiceEl);
    } else {
      showExpiredState();
    }
  };
})();
