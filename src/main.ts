import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, LogicalPosition } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

interface UsageData {
  sessionUtilization: number;
  sessionResetsAt: string | null;
  weeklyUtilization: number;
  weeklyResetsAt: string | null;
  sonnetUtilization?: number | null;
  sonnetResetsAt?: string | null;
}

let refreshBtn: HTMLButtonElement | null;
let retryBtn: HTMLButtonElement | null;
let loadingEl: HTMLElement | null;
let errorEl: HTMLElement | null;
let errorMessageEl: HTMLElement | null;
let usageContentEl: HTMLElement | null;
let usageRowsEl: HTMLElement | null;
let lastUpdatedEl: HTMLElement | null;
let closeBtn: HTMLElement | null;
let alwaysOnTopBtn: HTMLButtonElement | null;
let minifyBtn: HTMLButtonElement | null;
let refreshInterval: number | null = null;
let isAlwaysOnTop = false;
let isMinified = false;
let isInitialLoad = true;
let previousSize: { width: number; height: number } | null = null;

function getColorClass(percentage: number): string {
  if (percentage >= 90) return "red";
  if (percentage >= 70) return "yellow";
  return "green";
}

function formatTimeRemaining(dateString: string | null): string {
  if (!dateString) return "Soon";

  const now = new Date();
  const reset = new Date(dateString);
  const diff = reset.getTime() - now.getTime();

  if (diff <= 0) return "Soon";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `in ${days}d ${remainingHours}h`;
  }

  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

function createUsageRow(title: string, subtitle: string, percentage: number, resetsAt: string | null): string {
  const colorClass = getColorClass(percentage);
  const roundedPct = Math.round(percentage);
  const resetTime = formatTimeRemaining(resetsAt);

  return `
    <div class="usage-row">
      <div class="usage-row-header">
        <div class="usage-row-title">
          <h3>${title}</h3>
          <p>${subtitle}</p>
        </div>
        <div class="usage-percentage ${colorClass}">${roundedPct}%</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${colorClass}" style="width: 0%"></div>
      </div>
      <div class="reset-time">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span>Resets ${resetTime}</span>
      </div>
    </div>
  `;
}

function showLoading() {
  if (loadingEl) loadingEl.classList.remove("hidden");
  if (errorEl) errorEl.classList.add("hidden");
  if (usageContentEl) usageContentEl.classList.add("hidden");
}

function showError(message: string) {
  if (loadingEl) loadingEl.classList.add("hidden");
  if (errorEl) errorEl.classList.remove("hidden");
  if (usageContentEl) usageContentEl.classList.add("hidden");
  if (errorMessageEl) errorMessageEl.textContent = message;
}

function showUsage(data: UsageData) {
  if (loadingEl) loadingEl.classList.add("hidden");
  if (errorEl) errorEl.classList.add("hidden");
  if (usageContentEl) usageContentEl.classList.remove("hidden");

  if (!usageRowsEl) return;

  let html = "";

  // Session usage (5-hour)
  html += createUsageRow(
    "Session",
    "5-hour window",
    data.sessionUtilization,
    data.sessionResetsAt
  );

  // Weekly usage (7-day)
  html += createUsageRow(
    "Weekly",
    "7-day window",
    data.weeklyUtilization,
    data.weeklyResetsAt
  );

  // Sonnet only (if available)
  if (data.sonnetUtilization !== null && data.sonnetUtilization !== undefined) {
    html += createUsageRow(
      "Sonnet Only",
      "Model-specific",
      data.sonnetUtilization,
      data.sonnetResetsAt || null
    );
  }

  usageRowsEl.innerHTML = html;

  // Update last updated text (will be positioned after cards)
  updateLastUpdatedText();

  // Trigger progress bar animations
  setTimeout(() => {
    const fills = usageRowsEl?.querySelectorAll('.progress-fill');
    const percentages = [
      data.sessionUtilization,
      data.weeklyUtilization,
      data.sonnetUtilization ?? 0
    ].filter(v => v !== undefined && v !== null);

    fills?.forEach((fill, i) => {
      (fill as HTMLElement).style.width = `${Math.min(percentages[i], 100)}%`;
    });

    // Re-adapt cards after content is loaded
    adaptCardsToSize();
    // Update min height after content is rendered and cards have adapted
    requestAnimationFrame(() => {
      setTimeout(() => {
        updateMinHeight();
      }, 50);
    });
  }, 100);
}

async function fetchUsage(useTestData = false) {
  showLoading();

  try {
    const command = useTestData ? "fetch_usage_test" : "fetch_usage";
    const usage = await invoke<UsageData>(command);
    showUsage(usage);
  } catch (error: any) {
    console.error("Error fetching usage:", error);
    showError(error || "Failed to fetch usage data");
  }
}

function calculateMinSize(): { width: number; height: number } {
  const titlebar = document.querySelector(".titlebar") as HTMLElement;
  const container = document.querySelector(".container") as HTMLElement;
  const usageRows = document.querySelector("#usage-rows") as HTMLElement;
  const lastUpdated = document.querySelector("#last-updated") as HTMLElement;

  if (!titlebar || !container || !usageRows) {
    return { width: 180, height: 200 };
  }

  // Calculate actual content height
  const titlebarHeight = titlebar.offsetHeight;
  const containerPadding = parseFloat(getComputedStyle(container).paddingTop) +
    parseFloat(getComputedStyle(container).paddingBottom);
  const usageRowsHeight = usageRows.scrollHeight;
  const lastUpdatedHeight = lastUpdated?.offsetHeight || 0;

  // Total minimum height needed (including last updated text)
  // Use exact height without extra buffer to minimize bottom space
  const minHeight = titlebarHeight + containerPadding + usageRowsHeight + lastUpdatedHeight;

  return { width: 180, height: Math.ceil(minHeight) };
}

async function updateMinHeight() {
  const { width: minWidth, height } = calculateMinSize();

  // Set minimum size dynamically
  if (!isResizing) {
    appWindow.setMinSize(new LogicalSize(minWidth, height))
      .catch(err => console.error("Failed to set min size:", err));

    // If this is the initial load, force the window to shrink its height to the content size
    if (isInitialLoad && !isMinified) {
      try {
        const scaleFactor = await appWindow.scaleFactor();
        const currentSize = (await appWindow.outerSize()).toLogical(scaleFactor);

        // Preserve current width, only update height to fit content
        await appWindow.setSize(new LogicalSize(currentSize.width, height));
        isInitialLoad = false;
      } catch (err) {
        console.error("Failed to set initial size:", err);
      }
    }
  }
}

async function minifyWindow() {
  try {
    const scaleFactor = await appWindow.scaleFactor();
    const currentSize = (await appWindow.outerSize()).toLogical(scaleFactor);
    const currentPosition = (await appWindow.outerPosition()).toLogical(scaleFactor);

    if (isMinified) {
      if (previousSize) {
        // Calculate restored position
        const widthDiff = previousSize.width - currentSize.width;
        const restoredPosition = new LogicalPosition(
          currentPosition.x - widthDiff,
          currentPosition.y
        );

        // Apply both size and position as close as possible
        await appWindow.setSize(new LogicalSize(previousSize.width, previousSize.height));
        await appWindow.setPosition(restoredPosition);

        isMinified = false;
        isInitialLoad = false; // Disable auto-fit after user interaction
        if (minifyBtn) minifyBtn.setAttribute("title", "Minimize to Smallest Size");
      }
    } else {
      previousSize = { width: currentSize.width, height: currentSize.height };

      // Calculate min size after potential card adaptation
      const minWidth = 180;

      // Temporarily set width to min to see how cards look
      await appWindow.setSize(new LogicalSize(minWidth, 200));

      // Short delay for layout reflow
      setTimeout(async () => {
        const { width, height } = calculateMinSize();
        const finalWidth = Math.max(180, width);
        const finalHeight = Math.max(200, height);

        const finalWidthDiff = currentSize.width - finalWidth;
        const finalPosition = new LogicalPosition(currentPosition.x + finalWidthDiff, currentPosition.y);

        await appWindow.setSize(new LogicalSize(finalWidth, finalHeight));
        await appWindow.setPosition(finalPosition);
        await appWindow.setMinSize(new LogicalSize(finalWidth, finalHeight));

        isMinified = true;
        isInitialLoad = false; // Disable auto-fit after user interaction
        if (minifyBtn) minifyBtn.setAttribute("title", "Restore Previous Size");
      }, 50);
    }
  } catch (err) {
    console.error("Failed to minify/restore window:", err);
  }
}

function updateLastUpdatedText() {
  if (!lastUpdatedEl) return;

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  lastUpdatedEl.textContent = `Updated ${timeString}`;
}

function adaptHeaderToSize(width: number) {
  const titlebar = document.querySelector(".titlebar") as HTMLElement;
  if (!titlebar) return;

  titlebar.classList.toggle("compact-header", width <= 280 && width > 180);
  titlebar.classList.toggle("very-compact-header", width <= 180 && width > 140);
  titlebar.classList.toggle("ultra-compact-header", width <= 140);
}

let resizeTimeout: number | null = null;
let isResizing = false;
let resizeEndTimeout: number | null = null;

function adaptCardsToSize() {
  if (!usageRowsEl || !usageContentEl) return;

  const width = usageContentEl.clientWidth;
  const cards = usageRowsEl.querySelectorAll(".usage-row") as NodeListOf<HTMLElement>;

  adaptHeaderToSize(width);

  cards.forEach((card) => {
    card.classList.remove("compact", "ultra-compact", "percentage-only");

    if (width <= 140) card.classList.add("percentage-only");
    else if (width <= 180) card.classList.add("ultra-compact");
    else if (width <= 220) card.classList.add("compact");
  });

  if (!isResizing) {
    requestAnimationFrame(updateMinHeight);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  refreshBtn = document.querySelector("#refresh-btn");
  retryBtn = document.querySelector("#retry-btn");
  loadingEl = document.querySelector("#loading");
  errorEl = document.querySelector("#error");
  errorMessageEl = document.querySelector("#error-message");
  usageContentEl = document.querySelector("#usage-content");
  usageRowsEl = document.querySelector("#usage-rows");
  lastUpdatedEl = document.querySelector("#last-updated");
  closeBtn = document.querySelector("#titlebar-close");
  alwaysOnTopBtn = document.querySelector("#always-on-top-btn");
  minifyBtn = document.querySelector("#minify-btn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchUsage());
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", () => fetchUsage());
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      appWindow.hide().catch(err => console.error("Failed to hide window:", err));
    });
  }

  // Initialize always-on-top state and button
  async function updateAlwaysOnTopButton() {
    try {
      isAlwaysOnTop = await appWindow.isAlwaysOnTop();
      if (alwaysOnTopBtn) {
        if (isAlwaysOnTop) {
          alwaysOnTopBtn.classList.add("active");
          alwaysOnTopBtn.setAttribute("title", "Disable Keep on Top");
        } else {
          alwaysOnTopBtn.classList.remove("active");
          alwaysOnTopBtn.setAttribute("title", "Keep on Top");
        }
      }
    } catch (err) {
      console.error("Failed to check always-on-top state:", err);
    }
  }

  async function toggleAlwaysOnTop() {
    try {
      isAlwaysOnTop = !isAlwaysOnTop;
      await appWindow.setAlwaysOnTop(isAlwaysOnTop);
      // Verify it was set correctly
      const actualState = await appWindow.isAlwaysOnTop();
      isAlwaysOnTop = actualState; // Sync with actual state
      updateAlwaysOnTopButton();
      console.log("Always-on-top set to:", isAlwaysOnTop);
    } catch (err) {
      console.error("Failed to toggle always-on-top:", err);
      // Try to get actual state on error
      try {
        isAlwaysOnTop = await appWindow.isAlwaysOnTop();
        updateAlwaysOnTopButton();
      } catch (e) {
        console.error("Failed to get always-on-top state:", e);
      }
    }
  }

  if (alwaysOnTopBtn) {
    alwaysOnTopBtn.addEventListener("click", toggleAlwaysOnTop);
  }

  if (minifyBtn) {
    minifyBtn.addEventListener("click", minifyWindow);
  }

  // Check initial state
  updateAlwaysOnTopButton();

  // Set up ResizeObserver for dynamic adaptation with debouncing
  const container = document.querySelector(".container");
  if (container) {
    const resizeObserver = new ResizeObserver(() => {
      // Mark as resizing
      isResizing = true;
      isInitialLoad = false; // User is manually resizing, disable auto-fit

      // Clear any pending resize end
      if (resizeEndTimeout) {
        clearTimeout(resizeEndTimeout);
      }

      // Debounce resize handling to prevent jitter
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        adaptCardsToSize();
        resizeTimeout = null;
      }, 16); // ~60fps

      // Mark resize as ended after a delay (only update min height when resize stops)
      resizeEndTimeout = window.setTimeout(() => {
        isResizing = false;
        updateMinHeight(); // Update min height once resize has stopped
        resizeEndTimeout = null;
      }, 200); // Wait 200ms after last resize event
    });
    resizeObserver.observe(container);
  }

  // Initial adaptation
  adaptCardsToSize();

  // Initial header adaptation
  const initialContainer = document.querySelector(".container") as HTMLElement;
  if (initialContainer) {
    adaptHeaderToSize(initialContainer.clientWidth);
  }

  // Set initial min height after a brief delay to ensure DOM is ready
  setTimeout(() => {
    updateMinHeight();
  }, 100);

  // Initial fetch
  fetchUsage();

  // Set up automatic refresh every 5 minutes (300000ms)
  function startAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    refreshInterval = window.setInterval(() => {
      // Only refresh if window is visible
      if (!document.hidden) {
        fetchUsage();
      }
    }, 300000); // 5 minutes
  }

  // Start auto-refresh
  startAutoRefresh();

  // Pause refresh when window is hidden, resume when shown
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Window is hidden, clear interval to save resources
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    } else {
      // Window is visible, resume refresh
      startAutoRefresh();
      // Also refresh immediately when window becomes visible
      fetchUsage();
    }
  });
});
