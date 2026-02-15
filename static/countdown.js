// static/countdown.js
// Countdown timer using requestAnimationFrame.
// Reads expiry from data-expiry attribute (UTC milliseconds).
// Displays graduated urgency messages. Triggers self-destruct at zero.

(function () {
  "use strict";

  const countdownEl = document.querySelector(".countdown-display");
  if (!countdownEl) return;

  const expiryMs = parseInt(countdownEl.getAttribute("data-expiry"), 10);
  if (!expiryMs || isNaN(expiryMs)) {
    console.error("Invalid or missing data-expiry attribute");
    return;
  }

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, "0");

    if (days > 0) {
      return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    }
    if (hours > 0) {
      return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    }
    return `${pad(minutes)}m ${pad(seconds)}s`;
  }

  function updateDisplay(remaining) {
    const timeStr = formatTime(remaining);

    if (remaining > THREE_DAYS_MS) {
      // Normal/calm state
      countdownEl.className = "countdown-display";
      countdownEl.textContent = `This invoice will self-destruct in ${timeStr}`;
    } else if (remaining > ONE_HOUR_MS) {
      // Warning state (< 24 hours, or < 3 days)
      countdownEl.className = "countdown-display urgent";
      if (remaining <= ONE_DAY_MS) {
        countdownEl.textContent = `Self-destruct sequence initiated \u2014 ${timeStr}`;
      } else {
        countdownEl.textContent = `This invoice will self-destruct in ${timeStr}`;
      }
    } else {
      // Critical state (< 1 hour)
      countdownEl.className = "countdown-display critical";
      countdownEl.textContent = `Final countdown! ${timeStr}`;
    }
  }

  function tick() {
    const now = Date.now();
    const remaining = expiryMs - now;

    if (remaining <= 0) {
      countdownEl.textContent = "Self-destructing...";
      countdownEl.className = "countdown-display critical";

      // Trigger self-destruct animation (defined in self-destruct.js)
      if (typeof window.triggerSelfDestruct === "function") {
        window.triggerSelfDestruct();
      }
      return; // Stop the loop
    }

    updateDisplay(remaining);
    requestAnimationFrame(tick);
  }

  // Start the countdown
  requestAnimationFrame(tick);
})();
