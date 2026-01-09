import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

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
  }, 100);

  // Update last seen
  if (lastUpdatedEl) {
    const now = new Date();
    lastUpdatedEl.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
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

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchUsage(false));
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", () => fetchUsage(false));
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      appWindow.hide().catch(err => console.error("Failed to hide window:", err));
    });
  }

  // Initial fetch
  fetchUsage(false);
});
