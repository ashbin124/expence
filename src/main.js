import { getISODateInTimeZone, renderBudget } from "./budget.js";
import {
  loadBudget,
  loadReminders,
  loadSettings,
  loadTransactions,
  saveBudget,
  saveReminders,
  saveSettings,
  saveTransactions,
} from "./storage.js";
import {
  renderBillReminders,
  renderFilterButtons,
  renderInsights,
  renderMonthlyOverview,
  renderSummary,
  renderTransactions,
} from "./ui.js";

const DEFAULT_SETTINGS = {
  locale: "en-IN",
  currency: "INR",
  timeZone: "Asia/Kolkata",
  reminderLeadDays: 1,
};

const SUPPORTED_LOCALES = new Set([
  "en-IN",
  "en-US",
  "en-GB",
  "en-AU",
  "en-CA",
  "en-SG",
  "hi-IN",
  "fr-FR",
  "de-DE",
]);
const SUPPORTED_CURRENCIES = new Set([
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "AUD",
  "CAD",
  "JPY",
  "SGD",
]);
const SUPPORTED_TIMEZONES = new Set([
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
]);
const SUPPORTED_REMINDER_LEAD_DAYS = new Set([0, 1, 2, 3, 7, 14]);

const state = {
  transactions: [],
  reminders: [],
  settings: { ...DEFAULT_SETTINGS },
  filter: "all",
  sortBy: "date_desc",
  advancedFilters: {
    dateFrom: "",
    dateTo: "",
    minAmount: null,
    maxAmount: null,
    category: "all",
  },
  isAdvancedFiltersOpen: false,
  search: "",
  editingId: null,
  budgetLimit: 0,
};

const form = document.getElementById("transactionForm");
const formTitle = document.getElementById("formTitle");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const titleInput = document.getElementById("title");
const amountInput = document.getElementById("amount");
const txTypeInputs = document.querySelectorAll('input[name="txType"]');
const quickAmountButtons = document.querySelectorAll(".quick-amount-btn");
const errorEl = document.getElementById("error");
const searchInput = document.getElementById("searchInput");
const toggleAdvancedFiltersBtn = document.getElementById("toggleAdvancedFiltersBtn");
const advancedFiltersPanel = document.getElementById("advancedFiltersPanel");
const filterDateFromInput = document.getElementById("filterDateFrom");
const filterDateToInput = document.getElementById("filterDateTo");
const filterMinAmountInput = document.getElementById("filterMinAmount");
const filterMaxAmountInput = document.getElementById("filterMaxAmount");
const filterCategoryInput = document.getElementById("filterCategory");
const clearAdvancedFiltersBtn = document.getElementById("clearAdvancedFiltersBtn");
const activeFilterSummaryEl = document.getElementById("activeFilterSummary");
const sortTransactionsInput = document.getElementById("sortTransactions");
const clearAllBtn = document.getElementById("clearAllBtn");
const budgetForm = document.getElementById("budgetForm");
const budgetInput = document.getElementById("budgetLimit");
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const importDataInput = document.getElementById("importDataInput");
const backupNoticeEl = document.getElementById("backupNotice");
const installAppBtn = document.getElementById("installAppBtn");
const installAppHintEl = document.getElementById("installAppHint");
const reminderForm = document.getElementById("reminderForm");
const reminderTitleInput = document.getElementById("reminderTitle");
const reminderAmountInput = document.getElementById("reminderAmount");
const reminderDateInput = document.getElementById("reminderDate");
const reminderListEl = document.getElementById("reminderList");
const reminderNoticeEl = document.getElementById("reminderNotice");
const enableReminderAlertsBtn = document.getElementById("enableReminderAlertsBtn");
const reminderSubmitBtn = reminderForm?.querySelector('button[type="submit"]');
const settingsForm = document.getElementById("settingsForm");
const settingsLocaleInput = document.getElementById("settingsLocale");
const settingsCurrencyInput = document.getElementById("settingsCurrency");
const settingsTimeZoneInput = document.getElementById("settingsTimeZone");
const settingsReminderLeadDaysInput = document.getElementById("settingsReminderLeadDays");
const resetSettingsBtn = document.getElementById("resetSettingsBtn");
const settingsNoticeEl = document.getElementById("settingsNotice");
const settingsSubmitBtn = settingsForm?.querySelector('button[type="submit"]');
const undoToastEl = document.getElementById("undoToast");
const undoToastTextEl = document.getElementById("undoToastText");
const undoDeleteBtn = document.getElementById("undoDeleteBtn");
const mobileViewButtons = document.querySelectorAll("[data-mobile-view-btn]");
const mobileViewSections = document.querySelectorAll("[data-mobile-view]");
const mobileCards = document.querySelectorAll("[data-mobile-card]");
const mobileViewport = window.matchMedia("(max-width: 620px)");
const filterButtons = document.querySelectorAll(".filter-btn");
const budgetSubmitBtn = budgetForm.querySelector('button[type="submit"]');

let mainLoadingCount = 0;
const BACKUP_VERSION = 3;
const MOBILE_VIEW_STORAGE_KEY = "expense-tracker-mobile-view-v1";
const MOBILE_VIEWS = new Set([
  "transactions",
  "add",
  "insights",
  "reminders",
  "settings",
]);
let deferredInstallPrompt = null;
let pendingDeletedTransaction = null;
let undoDeleteTimer = null;
const savedMobileView = localStorage.getItem(MOBILE_VIEW_STORAGE_KEY);
let activeMobileView =
  savedMobileView && MOBILE_VIEWS.has(savedMobileView) ? savedMobileView : "transactions";

const elements = {
  listEl: document.getElementById("transactionList"),
  monthlyOverviewEl: document.getElementById("monthlyOverview"),
  insightGridEl: document.getElementById("insightGrid"),
  balanceEl: document.getElementById("balance"),
  incomeEl: document.getElementById("income"),
  expenseEl: document.getElementById("expense"),
  budgetSpentEl: document.getElementById("budgetSpent"),
  budgetLimitTextEl: document.getElementById("budgetLimitText"),
  budgetLeftEl: document.getElementById("budgetLeft"),
  budgetSummaryNoteEl: document.getElementById("budgetSummaryNote"),
  budgetMeterBarEl: document.getElementById("budgetMeterBar"),
  budgetAlertEl: document.getElementById("budgetAlert"),
};

function readErrorMessage(error, fallbackMessage) {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function normalizeSettings(input) {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const locale = SUPPORTED_LOCALES.has(input.locale)
    ? input.locale
    : DEFAULT_SETTINGS.locale;
  const currency = SUPPORTED_CURRENCIES.has(input.currency)
    ? input.currency
    : DEFAULT_SETTINGS.currency;
  const timeZone = SUPPORTED_TIMEZONES.has(input.timeZone)
    ? input.timeZone
    : DEFAULT_SETTINGS.timeZone;

  const parsedLeadDays = Number(input.reminderLeadDays);
  const reminderLeadDays = SUPPORTED_REMINDER_LEAD_DAYS.has(parsedLeadDays)
    ? parsedLeadDays
    : DEFAULT_SETTINGS.reminderLeadDays;

  return { locale, currency, timeZone, reminderLeadDays };
}

function getAppLocale() {
  return state.settings.locale;
}

function getAppCurrency() {
  return state.settings.currency;
}

function getAppTimeZone() {
  return state.settings.timeZone;
}

function getReminderLeadDays() {
  return state.settings.reminderLeadDays;
}

function getTodayISO() {
  return getISODateInTimeZone(getAppTimeZone(), getAppLocale());
}

function formatCurrency(value) {
  return new Intl.NumberFormat(getAppLocale(), {
    style: "currency",
    currency: getAppCurrency(),
  }).format(value);
}

function formatMonthLabel(value) {
  return new Date(value + "-01T00:00:00").toLocaleDateString(getAppLocale(), {
    month: "short",
    year: "numeric",
  });
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return String(Date.now() + Math.random());
}

function isMobileViewport() {
  return mobileViewport.matches;
}

function applyMobileViewState() {
  const isMobile = isMobileViewport();
  const isLedgerView =
    activeMobileView === "transactions" || activeMobileView === "insights";

  mobileCards.forEach((card) => {
    const cardType = card.dataset.mobileCard;
    const shouldShow =
      !isMobile || (isLedgerView ? cardType === "ledger" : cardType === "manage");
    card.classList.toggle("mobile-view-hidden", !shouldShow);
  });

  mobileViewSections.forEach((section) => {
    const sectionView = section.dataset.mobileView;
    const isCurrentView = sectionView === activeMobileView;
    section.classList.toggle("mobile-view-hidden", isMobile && !isCurrentView);
  });

  mobileViewButtons.forEach((button) => {
    const isCurrentView = button.dataset.mobileViewBtn === activeMobileView;
    button.classList.toggle("active", isCurrentView);
    button.setAttribute("aria-pressed", String(isCurrentView));
    button.setAttribute("aria-current", isCurrentView ? "page" : "false");
  });
}

function setMobileView(nextView, options = {}) {
  if (!MOBILE_VIEWS.has(nextView)) return;
  const { persist = true } = options;

  activeMobileView = nextView;

  if (persist) {
    localStorage.setItem(MOBILE_VIEW_STORAGE_KEY, nextView);
  }

  applyMobileViewState();
}

function setupMobileViewNavigation() {
  if (mobileViewButtons.length === 0 || mobileViewSections.length === 0) return;

  mobileViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.mobileViewBtn;
      if (!nextView) return;
      setMobileView(nextView);
    });
  });

  if (typeof mobileViewport.addEventListener === "function") {
    mobileViewport.addEventListener("change", () => {
      applyMobileViewState();
    });
  } else if (typeof mobileViewport.addListener === "function") {
    mobileViewport.addListener(() => {
      applyMobileViewState();
    });
  }

  applyMobileViewState();
}

function getActiveAdvancedFilterCount() {
  let count = 0;
  const filters = state.advancedFilters;
  if (filters.dateFrom) count += 1;
  if (filters.dateTo) count += 1;
  if (typeof filters.minAmount === "number") count += 1;
  if (typeof filters.maxAmount === "number") count += 1;
  if (filters.category && filters.category !== "all") count += 1;
  return count;
}

function syncCategoryFilterOptions() {
  if (!filterCategoryInput) return;

  const categories = Array.from(
    new Set(
      state.transactions
        .map((item) => item.category)
        .filter((value) => typeof value === "string" && value.trim().length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const previous = state.advancedFilters.category || "all";

  filterCategoryInput.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Categories";
  filterCategoryInput.append(allOption);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    filterCategoryInput.append(option);
  });

  state.advancedFilters.category = categories.includes(previous) ? previous : "all";
  filterCategoryInput.value = state.advancedFilters.category;
}

function syncAdvancedFilterInputs() {
  if (filterDateFromInput) {
    filterDateFromInput.value = state.advancedFilters.dateFrom;
  }
  if (filterDateToInput) {
    filterDateToInput.value = state.advancedFilters.dateTo;
  }
  if (filterMinAmountInput) {
    filterMinAmountInput.value =
      typeof state.advancedFilters.minAmount === "number"
        ? String(state.advancedFilters.minAmount)
        : "";
  }
  if (filterMaxAmountInput) {
    filterMaxAmountInput.value =
      typeof state.advancedFilters.maxAmount === "number"
        ? String(state.advancedFilters.maxAmount)
        : "";
  }
}

function syncSortInput() {
  if (!sortTransactionsInput) return;
  sortTransactionsInput.value = state.sortBy;
}

function updateAdvancedFiltersUi() {
  const activeCount = getActiveAdvancedFilterCount();

  if (advancedFiltersPanel) {
    advancedFiltersPanel.hidden = !state.isAdvancedFiltersOpen;
  }

  if (toggleAdvancedFiltersBtn) {
    toggleAdvancedFiltersBtn.setAttribute(
      "aria-expanded",
      state.isAdvancedFiltersOpen ? "true" : "false",
    );

    if (activeCount > 0) {
      toggleAdvancedFiltersBtn.classList.add("active");
      toggleAdvancedFiltersBtn.textContent = `Filters (${activeCount})`;
    } else {
      toggleAdvancedFiltersBtn.classList.remove("active");
      toggleAdvancedFiltersBtn.textContent = "More Filters";
    }
  }

  if (activeFilterSummaryEl) {
    activeFilterSummaryEl.textContent =
      activeCount > 0
        ? `${activeCount} advanced filter${activeCount === 1 ? "" : "s"} active.`
        : "No advanced filters active.";
  }
}

function resetAdvancedFilters() {
  state.advancedFilters = {
    dateFrom: "",
    dateTo: "",
    minAmount: null,
    maxAmount: null,
    category: "all",
  };

  syncCategoryFilterOptions();
  syncAdvancedFilterInputs();
  updateAdvancedFiltersUi();
}

function parseAdvancedAmount(value) {
  if (value === null || value === undefined) return null;

  const trimmed = String(value).trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function applyAdvancedFiltersFromInputs() {
  state.advancedFilters.dateFrom = filterDateFromInput?.value || "";
  state.advancedFilters.dateTo = filterDateToInput?.value || "";
  state.advancedFilters.minAmount = parseAdvancedAmount(filterMinAmountInput?.value);
  state.advancedFilters.maxAmount = parseAdvancedAmount(filterMaxAmountInput?.value);
  state.advancedFilters.category = filterCategoryInput?.value || "all";

  updateAdvancedFiltersUi();

  renderTransactions({
    state,
    elements,
    formatCurrency,
    locale: getAppLocale(),
  });
}

function getSelectedType() {
  const checked = Array.from(txTypeInputs).find((input) => input.checked);
  return checked ? checked.value : "expense";
}

function setSelectedType(nextType) {
  txTypeInputs.forEach((input) => {
    input.checked = input.value === nextType;
  });
}

function showError(message) {
  errorEl.textContent = message;
}

function clearError() {
  showError("");
}

function showBackupNotice(message, type = "info") {
  backupNoticeEl.textContent = message;
  backupNoticeEl.className = "backup-notice";

  if (type === "success") {
    backupNoticeEl.classList.add("backup-notice-success");
    return;
  }

  if (type === "error") {
    backupNoticeEl.classList.add("backup-notice-error");
  }
}

function clearBackupNotice() {
  showBackupNotice("");
}

function showReminderNotice(message, type = "info") {
  if (!reminderNoticeEl) return;

  reminderNoticeEl.textContent = message;
  reminderNoticeEl.className = "reminder-notice";

  if (type === "success") {
    reminderNoticeEl.classList.add("backup-notice-success");
    return;
  }

  if (type === "error") {
    reminderNoticeEl.classList.add("backup-notice-error");
  }
}

function clearReminderNotice() {
  showReminderNotice("");
}

function showSettingsNotice(message, type = "info") {
  if (!settingsNoticeEl) return;

  settingsNoticeEl.textContent = message;
  settingsNoticeEl.className = "settings-notice";

  if (type === "success") {
    settingsNoticeEl.classList.add("backup-notice-success");
    return;
  }

  if (type === "error") {
    settingsNoticeEl.classList.add("backup-notice-error");
  }
}

function clearSettingsNotice() {
  showSettingsNotice("");
}

function clearUndoToast() {
  if (undoDeleteTimer) {
    clearTimeout(undoDeleteTimer);
    undoDeleteTimer = null;
  }

  pendingDeletedTransaction = null;

  if (!undoToastEl || !undoToastTextEl) return;
  undoToastEl.hidden = true;
  undoToastTextEl.textContent = "Transaction deleted.";
}

function showUndoToast(deletedTransaction, deletedIndex) {
  if (!undoToastEl || !undoToastTextEl) return;

  if (undoDeleteTimer) {
    clearTimeout(undoDeleteTimer);
  }

  pendingDeletedTransaction = {
    transaction: deletedTransaction,
    index: deletedIndex,
  };

  undoToastTextEl.textContent = `Deleted "${deletedTransaction.title}".`;
  undoToastEl.hidden = false;

  undoDeleteTimer = window.setTimeout(() => {
    clearUndoToast();
  }, 6000);
}

function undoLastDeletedTransaction() {
  if (!pendingDeletedTransaction) return;

  const { transaction, index } = pendingDeletedTransaction;
  const insertAt = Math.min(Math.max(index, 0), state.transactions.length);
  const nextTransactions = state.transactions.slice();
  nextTransactions.splice(insertAt, 0, transaction);
  state.transactions = nextTransactions;

  saveTransactions(state.transactions);
  clearUndoToast();
  renderAll();
}

function shouldEnableReminderAlerts() {
  return typeof Notification !== "undefined";
}

function getReminderAlertPermission() {
  if (!shouldEnableReminderAlerts()) return "unsupported";
  return Notification.permission;
}

function updateReminderAlertButton() {
  if (!enableReminderAlertsBtn) return;

  const permission = getReminderAlertPermission();

  if (permission === "granted") {
    enableReminderAlertsBtn.textContent = "Alerts Enabled";
    enableReminderAlertsBtn.disabled = true;
    return;
  }

  if (permission === "denied") {
    enableReminderAlertsBtn.textContent = "Alerts Blocked";
    enableReminderAlertsBtn.disabled = true;
    return;
  }

  if (permission === "unsupported") {
    enableReminderAlertsBtn.textContent = "Alerts Unavailable";
    enableReminderAlertsBtn.disabled = true;
    return;
  }

  enableReminderAlertsBtn.textContent = "Enable Alerts";
  enableReminderAlertsBtn.disabled = false;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function isRunningStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isiOS = /iphone|ipad|ipod/.test(userAgent);
  const isSafari =
    /safari/.test(userAgent) && !/crios|fxios|edgios|chrome/.test(userAgent);

  return isiOS && isSafari;
}

function updateInstallUi() {
  if (!installAppBtn || !installAppHintEl) return;

  if (isRunningStandalone()) {
    installAppBtn.hidden = true;
    installAppBtn.disabled = true;
    installAppHintEl.textContent = "App is already installed on this device.";
    return;
  }

  if (deferredInstallPrompt) {
    installAppBtn.hidden = false;
    installAppBtn.disabled = mainLoadingCount > 0;
    installAppHintEl.textContent = "Tap Install App to add this app to your home screen.";
    return;
  }

  installAppBtn.hidden = false;
  installAppBtn.disabled = mainLoadingCount > 0;

  if (isIosSafari()) {
    installAppHintEl.textContent =
      "iPhone: tap the install icon, then use Safari Share > Add to Home Screen.";
    return;
  }

  installAppHintEl.textContent =
    "Tap the install icon. If no popup appears, use browser menu > Add to Home screen.";
}

function setupInstallPrompt() {
  if (!installAppBtn || !installAppHintEl) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallUi();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallUi();
  });

  if (window.matchMedia) {
    const standaloneMedia = window.matchMedia("(display-mode: standalone)");
    standaloneMedia.addEventListener?.("change", () => {
      updateInstallUi();
    });
  }

  installAppBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      if (isIosSafari()) {
        installAppHintEl.textContent =
          "In Safari: Share button -> Add to Home Screen -> Add.";
        return;
      }

      installAppHintEl.textContent =
        "Open your browser menu and choose Install App or Add to Home screen.";
      return;
    }

    installAppBtn.disabled = true;

    try {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        deferredInstallPrompt = null;
      }
    } catch (error) {
      void error;
    }

    updateInstallUi();
  });

  updateInstallUi();
}

async function requestReminderAlertPermission() {
  if (!shouldEnableReminderAlerts()) {
    showReminderNotice("Browser notifications are not supported on this device.");
    updateReminderAlertButton();
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      showReminderNotice("Bill alerts enabled.", "success");
      triggerDueReminderNotifications();
    } else if (permission === "denied") {
      showReminderNotice(
        "Alerts blocked. Enable notifications in browser settings.",
        "error",
      );
    } else {
      showReminderNotice("Alert permission request dismissed.");
    }
  } catch (error) {
    showReminderNotice(readErrorMessage(error, "Unable to enable alerts."), "error");
  } finally {
    updateReminderAlertButton();
  }
}

function triggerDueReminderNotifications() {
  if (getReminderAlertPermission() !== "granted") return;
  if (state.reminders.length === 0) return;

  const todayISO = getTodayISO();
  const todayAtMidnight = new Date(todayISO + "T00:00:00");
  const nextReminders = state.reminders.map((reminder) => {
    if (reminder.lastNotifiedOn === todayISO) return reminder;

    const dueDateAtMidnight = new Date(reminder.dueDate + "T00:00:00");
    const daysUntil = Math.round(
      (dueDateAtMidnight.getTime() - todayAtMidnight.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (daysUntil < 0 || daysUntil > getReminderLeadDays()) {
      return reminder;
    }

    const prefix =
      daysUntil === 0
        ? "Due today"
        : daysUntil === 1
          ? "Due tomorrow"
          : `Due in ${daysUntil} days`;
    new Notification(`Bill Reminder: ${reminder.title}`, {
      body: `${prefix} - ${formatCurrency(reminder.amount)}`,
      tag: `bill-reminder-${reminder.id}`,
    });

    return {
      ...reminder,
      lastNotifiedOn: todayISO,
    };
  });

  const changed = nextReminders.some(
    (reminder, index) =>
      reminder.lastNotifiedOn !== state.reminders[index].lastNotifiedOn,
  );
  if (!changed) return;

  state.reminders = nextReminders;
  saveReminders(state.reminders);
}

function setMainControlsDisabled(disabled) {
  submitBtn.disabled = disabled;
  cancelEditBtn.disabled = disabled;
  clearAllBtn.disabled = disabled;
  budgetInput.disabled = disabled;
  budgetSubmitBtn.disabled = disabled;
  exportDataBtn.disabled = disabled;
  importDataBtn.disabled = disabled;
  importDataInput.disabled = disabled;
  if (reminderTitleInput) {
    reminderTitleInput.disabled = disabled;
  }
  if (reminderAmountInput) {
    reminderAmountInput.disabled = disabled;
  }
  if (reminderDateInput) {
    reminderDateInput.disabled = disabled;
  }
  if (reminderSubmitBtn) {
    reminderSubmitBtn.disabled = disabled;
  }
  if (settingsLocaleInput) {
    settingsLocaleInput.disabled = disabled;
  }
  if (settingsCurrencyInput) {
    settingsCurrencyInput.disabled = disabled;
  }
  if (settingsTimeZoneInput) {
    settingsTimeZoneInput.disabled = disabled;
  }
  if (settingsReminderLeadDaysInput) {
    settingsReminderLeadDaysInput.disabled = disabled;
  }
  if (settingsSubmitBtn) {
    settingsSubmitBtn.disabled = disabled;
  }
  if (resetSettingsBtn) {
    resetSettingsBtn.disabled = disabled;
  }
  if (enableReminderAlertsBtn) {
    enableReminderAlertsBtn.disabled =
      disabled || getReminderAlertPermission() !== "default";
  }

  amountInput.disabled = disabled;
  titleInput.disabled = disabled;
  searchInput.disabled = disabled;
  if (sortTransactionsInput) {
    sortTransactionsInput.disabled = disabled;
  }
  if (toggleAdvancedFiltersBtn) {
    toggleAdvancedFiltersBtn.disabled = disabled;
  }
  if (filterDateFromInput) {
    filterDateFromInput.disabled = disabled;
  }
  if (filterDateToInput) {
    filterDateToInput.disabled = disabled;
  }
  if (filterMinAmountInput) {
    filterMinAmountInput.disabled = disabled;
  }
  if (filterMaxAmountInput) {
    filterMaxAmountInput.disabled = disabled;
  }
  if (filterCategoryInput) {
    filterCategoryInput.disabled = disabled;
  }
  if (clearAdvancedFiltersBtn) {
    clearAdvancedFiltersBtn.disabled = disabled;
  }

  filterButtons.forEach((button) => {
    button.disabled = disabled;
  });

  quickAmountButtons.forEach((button) => {
    button.disabled = disabled;
  });

  txTypeInputs.forEach((input) => {
    input.disabled = disabled;
  });

  if (installAppBtn) {
    installAppBtn.disabled = disabled;
  }

  mobileViewButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

async function runWithMainLoading(task) {
  mainLoadingCount += 1;
  setMainControlsDisabled(true);

  try {
    return await task();
  } finally {
    mainLoadingCount = Math.max(0, mainLoadingCount - 1);
    if (mainLoadingCount === 0) {
      setMainControlsDisabled(false);
    }
  }
}

function syncBudgetInput() {
  budgetInput.value = state.budgetLimit > 0 ? String(state.budgetLimit) : "";
}

function isValidTransactionRecord(item) {
  if (!item || typeof item !== "object") return false;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount) &&
    typeof item.category === "string" &&
    typeof item.date === "string" &&
    dateRegex.test(item.date)
  );
}

function isValidReminderRecord(item) {
  if (!item || typeof item !== "object") return false;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount) &&
    item.amount > 0 &&
    typeof item.dueDate === "string" &&
    dateRegex.test(item.dueDate) &&
    (item.lastNotifiedOn === null ||
      item.lastNotifiedOn === undefined ||
      (typeof item.lastNotifiedOn === "string" && dateRegex.test(item.lastNotifiedOn)))
  );
}

function normalizeImportedTransactions(records) {
  return records.filter(isValidTransactionRecord).map((item) => ({
    id: item.id,
    title: item.title,
    amount: item.amount,
    category: item.category,
    date: item.date,
  }));
}

function normalizeImportedReminders(records) {
  return records.filter(isValidReminderRecord).map((item) => ({
    id: item.id,
    title: item.title,
    amount: item.amount,
    dueDate: item.dueDate,
    lastNotifiedOn: item.lastNotifiedOn ?? null,
  }));
}

function parseBackupData(rawText) {
  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  if (Array.isArray(parsed)) {
    const transactions = normalizeImportedTransactions(parsed);

    return {
      transactions,
      budgetLimit: 0,
      reminders: [],
      settings: { ...DEFAULT_SETTINGS },
      skippedCount: parsed.length - transactions.length,
    };
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Unsupported backup format.");
  }

  if (!Array.isArray(parsed.transactions)) {
    throw new Error("Backup file does not contain a transactions list.");
  }

  const transactions = normalizeImportedTransactions(parsed.transactions);
  const reminders = Array.isArray(parsed.reminders)
    ? normalizeImportedReminders(parsed.reminders)
    : [];
  const settings = normalizeSettings(parsed.settings);
  const skippedCount = parsed.transactions.length - transactions.length;

  const parsedBudget = Number(parsed.budgetLimit);
  const budgetLimit =
    Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : 0;

  return { transactions, budgetLimit, reminders, settings, skippedCount };
}

function buildBackupData() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    budgetLimit: state.budgetLimit,
    transactions: state.transactions,
    reminders: state.reminders,
    settings: state.settings,
  };
}

function downloadBackupJson(data) {
  const prettyJson = JSON.stringify(data, null, 2);
  const blob = new Blob([prettyJson], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);

  const downloadAnchor = document.createElement("a");
  const datePart = getTodayISO();
  downloadAnchor.href = objectUrl;
  downloadAnchor.download = `expense-tracker-backup-${datePart}.json`;
  document.body.append(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  URL.revokeObjectURL(objectUrl);
}

async function handleImportBackupFile(file) {
  if (!file) return;

  clearError();

  try {
    await runWithMainLoading(async () => {
      const rawText = await file.text();
      const imported = parseBackupData(rawText);

      state.transactions = imported.transactions;
      state.budgetLimit = imported.budgetLimit;
      state.reminders = imported.reminders;
      state.settings = imported.settings;

      saveTransactions(state.transactions);
      saveBudget(state.budgetLimit);
      saveReminders(state.reminders);
      saveSettings(state.settings);

      syncBudgetInput();
      syncSettingsForm();
      clearUndoToast();
      renderAll();
      resetForm();
      resetReminderForm();
      triggerDueReminderNotifications();

      if (imported.skippedCount > 0) {
        showBackupNotice(
          `Backup imported with ${imported.skippedCount} invalid entr${
            imported.skippedCount === 1 ? "y" : "ies"
          } skipped.`,
          "success",
        );
      } else {
        showBackupNotice("Backup imported successfully.", "success");
      }
    });
  } catch (error) {
    showBackupNotice(readErrorMessage(error, "Unable to import backup."), "error");
  } finally {
    importDataInput.value = "";
  }
}

function setEditMode(transaction) {
  if (!transaction) {
    state.editingId = null;
    formTitle.textContent = "Quick Add";
    submitBtn.textContent = "Save Transaction";
    cancelEditBtn.hidden = true;
    setSelectedType("expense");
    return;
  }

  state.editingId = transaction.id;
  formTitle.textContent = "Edit Transaction";
  submitBtn.textContent = "Update Transaction";
  cancelEditBtn.hidden = false;

  const txType = transaction.amount < 0 ? "expense" : "income";
  const defaultTitle = txType === "expense" ? "Expense" : "Income";

  setSelectedType(txType);
  titleInput.value = transaction.title === defaultTitle ? "" : transaction.title;
  amountInput.value = String(Math.abs(transaction.amount));
}

function renderAll() {
  const todayISO = getTodayISO();
  syncCategoryFilterOptions();
  updateAdvancedFiltersUi();
  syncSortInput();

  renderSummary({ transactions: state.transactions, elements, formatCurrency });

  renderBudget({
    transactions: state.transactions,
    budgetLimit: state.budgetLimit,
    elements,
    formatCurrency,
    locale: getAppLocale(),
    timeZone: getAppTimeZone(),
  });

  renderTransactions({
    state,
    elements,
    formatCurrency,
    locale: getAppLocale(),
  });

  renderMonthlyOverview({
    transactions: state.transactions,
    monthlyOverviewEl: elements.monthlyOverviewEl,
    formatCurrency,
    formatMonthLabel,
  });

  renderInsights({
    transactions: state.transactions,
    insightGridEl: elements.insightGridEl,
    formatCurrency,
    todayISO,
  });

  renderBillReminders({
    reminders: state.reminders,
    reminderListEl,
    formatCurrency,
    locale: getAppLocale(),
    todayISO,
  });

  renderFilterButtons({
    filterButtons,
    activeFilter: state.filter,
  });
}

function resetForm() {
  form.reset();
  setEditMode(null);
  clearError();
  amountInput.focus();
}

function resetReminderForm() {
  if (!reminderForm || !reminderDateInput) return;

  reminderForm.reset();
  reminderDateInput.value = getTodayISO();
}

function syncSettingsForm() {
  if (!settingsLocaleInput || !settingsCurrencyInput || !settingsTimeZoneInput) return;
  if (!settingsReminderLeadDaysInput) return;

  settingsLocaleInput.value = state.settings.locale;
  settingsCurrencyInput.value = state.settings.currency;
  settingsTimeZoneInput.value = state.settings.timeZone;
  settingsReminderLeadDaysInput.value = String(state.settings.reminderLeadDays);
}

function loadLocalDataIntoState() {
  state.transactions = loadTransactions();
  state.budgetLimit = loadBudget();
  state.reminders = loadReminders();
  state.settings = normalizeSettings(loadSettings());
  syncBudgetInput();
  syncSettingsForm();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const note = titleInput.value.trim();
  const amount = Number(amountInput.value);
  const txType = getSelectedType();

  if (!Number.isFinite(amount) || amount <= 0) {
    showError("Amount must be a valid number greater than 0.");
    return;
  }

  const normalizedAmount = txType === "expense" ? -Math.abs(amount) : Math.abs(amount);
  const title = note || (txType === "expense" ? "Expense" : "Income");
  const category = txType === "expense" ? "Expense" : "Income";

  let date = getTodayISO();

  if (state.editingId) {
    const existing = state.transactions.find((item) => item.id === state.editingId);
    if (existing?.date) date = existing.date;
  }

  const payload = { title, amount: normalizedAmount, category, date };

  try {
    await runWithMainLoading(async () => {
      if (state.editingId) {
        state.transactions = state.transactions.map((item) => {
          if (item.id !== state.editingId) return item;
          return { ...item, ...payload };
        });
      } else {
        state.transactions.push({
          id: createId(),
          ...payload,
        });
      }

      saveTransactions(state.transactions);
      renderAll();
      resetForm();

      if (isMobileViewport()) {
        setMobileView("transactions", { persist: false });
      }
    });
  } catch (error) {
    showError(readErrorMessage(error, "Unable to save transaction right now."));
  }
});

elements.listEl.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest("button[data-action]");
  if (!(button instanceof HTMLButtonElement)) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  if (!id || !action) return;

  if (action === "delete") {
    try {
      await runWithMainLoading(async () => {
        const deletedIndex = state.transactions.findIndex((item) => item.id === id);
        if (deletedIndex < 0) return;

        const deletedTransaction = state.transactions[deletedIndex];
        state.transactions = state.transactions.filter((item) => item.id !== id);
        saveTransactions(state.transactions);

        if (state.editingId === id) {
          resetForm();
        }

        renderAll();
        showUndoToast(deletedTransaction, deletedIndex);
      });
    } catch (error) {
      showError(readErrorMessage(error, "Unable to delete transaction right now."));
    }

    return;
  }

  if (action === "edit") {
    const transaction = state.transactions.find((item) => item.id === id);
    if (!transaction) return;

    setEditMode(transaction);
    if (isMobileViewport()) {
      setMobileView("add", { persist: false });
    }
    clearError();
    amountInput.focus();
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter || "all";
    renderAll();
  });
});

quickAmountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const value = Number(button.dataset.amount);
    if (!Number.isFinite(value) || value <= 0) return;

    amountInput.value = String(value);
    clearError();
    amountInput.focus();
  });
});

if (toggleAdvancedFiltersBtn) {
  toggleAdvancedFiltersBtn.addEventListener("click", () => {
    state.isAdvancedFiltersOpen = !state.isAdvancedFiltersOpen;
    updateAdvancedFiltersUi();
  });
}

if (filterDateFromInput) {
  filterDateFromInput.addEventListener("change", () => {
    applyAdvancedFiltersFromInputs();
  });
}

if (filterDateToInput) {
  filterDateToInput.addEventListener("change", () => {
    applyAdvancedFiltersFromInputs();
  });
}

if (filterMinAmountInput) {
  filterMinAmountInput.addEventListener("input", () => {
    applyAdvancedFiltersFromInputs();
  });
}

if (filterMaxAmountInput) {
  filterMaxAmountInput.addEventListener("input", () => {
    applyAdvancedFiltersFromInputs();
  });
}

if (filterCategoryInput) {
  filterCategoryInput.addEventListener("change", () => {
    applyAdvancedFiltersFromInputs();
  });
}

if (clearAdvancedFiltersBtn) {
  clearAdvancedFiltersBtn.addEventListener("click", () => {
    resetAdvancedFilters();

    renderTransactions({
      state,
      elements,
      formatCurrency,
      locale: getAppLocale(),
    });
  });
}

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;

  renderTransactions({
    state,
    elements,
    formatCurrency,
    locale: getAppLocale(),
  });
});

if (sortTransactionsInput) {
  sortTransactionsInput.addEventListener("change", () => {
    state.sortBy = sortTransactionsInput.value || "date_desc";

    renderTransactions({
      state,
      elements,
      formatCurrency,
      locale: getAppLocale(),
    });
  });
}

cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

clearAllBtn.addEventListener("click", async () => {
  if (state.transactions.length === 0) {
    showError("No transactions to clear.");
    return;
  }

  if (!window.confirm("Delete all transactions?")) return;

  try {
    await runWithMainLoading(async () => {
      state.transactions = [];
      saveTransactions([]);
      clearUndoToast();
      renderAll();
      resetForm();
    });
  } catch (error) {
    showError(readErrorMessage(error, "Unable to clear all transactions right now."));
  }
});

budgetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const rawLimit = budgetInput.value.trim();

  if (rawLimit === "") {
    state.budgetLimit = 0;
  } else {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showError("Budget limit must be greater than 0, or leave it empty to clear.");
      return;
    }
    state.budgetLimit = Math.round(parsed * 100) / 100;
  }

  try {
    await runWithMainLoading(async () => {
      saveBudget(state.budgetLimit);

      renderBudget({
        transactions: state.transactions,
        budgetLimit: state.budgetLimit,
        elements,
        formatCurrency,
        locale: getAppLocale(),
        timeZone: getAppTimeZone(),
      });
    });
  } catch (error) {
    showError(readErrorMessage(error, "Unable to save budget right now."));
  }
});

exportDataBtn.addEventListener("click", () => {
  clearError();

  try {
    const backupData = buildBackupData();
    downloadBackupJson(backupData);
    showBackupNotice("Backup downloaded successfully.", "success");
  } catch (error) {
    showBackupNotice(readErrorMessage(error, "Unable to export backup."), "error");
  }
});

importDataBtn.addEventListener("click", () => {
  clearError();
  clearBackupNotice();
  importDataInput.click();
});

importDataInput.addEventListener("change", async () => {
  const selectedFile = importDataInput.files?.[0];
  await handleImportBackupFile(selectedFile);
});

if (settingsForm) {
  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearSettingsNotice();

    const nextSettings = normalizeSettings({
      locale: settingsLocaleInput?.value,
      currency: settingsCurrencyInput?.value,
      timeZone: settingsTimeZoneInput?.value,
      reminderLeadDays: Number(settingsReminderLeadDaysInput?.value),
    });

    try {
      await runWithMainLoading(async () => {
        state.settings = nextSettings;
        saveSettings(state.settings);
        syncSettingsForm();
        resetReminderForm();
        renderAll();
        triggerDueReminderNotifications();
      });

      showSettingsNotice("Settings updated.", "success");
    } catch (error) {
      showSettingsNotice(readErrorMessage(error, "Unable to save settings."), "error");
    }
  });
}

if (resetSettingsBtn) {
  resetSettingsBtn.addEventListener("click", async () => {
    clearSettingsNotice();

    try {
      await runWithMainLoading(async () => {
        state.settings = { ...DEFAULT_SETTINGS };
        saveSettings(state.settings);
        syncSettingsForm();
        resetReminderForm();
        renderAll();
        triggerDueReminderNotifications();
      });

      showSettingsNotice("Settings reset to defaults.", "success");
    } catch (error) {
      showSettingsNotice(readErrorMessage(error, "Unable to reset settings."), "error");
    }
  });
}

if (reminderForm) {
  reminderForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    clearReminderNotice();

    const title = reminderTitleInput.value.trim();
    const amount = Number(reminderAmountInput.value);
    const dueDate = reminderDateInput.value;

    if (!title) {
      showReminderNotice("Bill name is required.", "error");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showReminderNotice("Reminder amount must be greater than 0.", "error");
      return;
    }

    if (!dueDate) {
      showReminderNotice("Please select a due date.", "error");
      return;
    }

    try {
      await runWithMainLoading(async () => {
        state.reminders.push({
          id: createId(),
          title,
          amount: Math.round(amount * 100) / 100,
          dueDate,
          lastNotifiedOn: null,
        });

        saveReminders(state.reminders);
        resetReminderForm();
        renderAll();
        triggerDueReminderNotifications();
      });

      showReminderNotice("Reminder added.", "success");
    } catch (error) {
      showReminderNotice(readErrorMessage(error, "Unable to add reminder."), "error");
    }
  });
}

if (reminderListEl) {
  reminderListEl.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;

    const button = event.target.closest("button[data-action]");
    if (!(button instanceof HTMLButtonElement)) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    if (!id || !action) return;

    if (action === "delete-reminder") {
      try {
        await runWithMainLoading(async () => {
          state.reminders = state.reminders.filter((item) => item.id !== id);
          saveReminders(state.reminders);
          renderAll();
        });
        showReminderNotice("Reminder deleted.", "success");
      } catch (error) {
        showReminderNotice(
          readErrorMessage(error, "Unable to delete reminder."),
          "error",
        );
      }

      return;
    }

    if (action === "pay-reminder") {
      const reminder = state.reminders.find((item) => item.id === id);
      if (!reminder) return;

      const paymentDate = getTodayISO();

      try {
        await runWithMainLoading(async () => {
          state.transactions.push({
            id: createId(),
            title: reminder.title,
            amount: -Math.abs(reminder.amount),
            category: "Bill",
            date: paymentDate,
          });

          state.reminders = state.reminders.filter((item) => item.id !== id);

          saveTransactions(state.transactions);
          saveReminders(state.reminders);
          renderAll();
        });

        showReminderNotice("Bill logged as paid.", "success");
      } catch (error) {
        showReminderNotice(
          readErrorMessage(error, "Unable to log bill payment."),
          "error",
        );
      }
    }
  });
}

if (enableReminderAlertsBtn) {
  enableReminderAlertsBtn.addEventListener("click", async () => {
    await requestReminderAlertPermission();
  });
}

if (undoDeleteBtn) {
  undoDeleteBtn.addEventListener("click", () => {
    undoLastDeletedTransaction();
  });
}

(function init() {
  loadLocalDataIntoState();
  resetAdvancedFilters();
  setSelectedType("expense");
  resetReminderForm();
  clearBackupNotice();
  clearReminderNotice();
  clearSettingsNotice();
  updateReminderAlertButton();
  registerServiceWorker();
  setupInstallPrompt();
  setupMobileViewNavigation();
  triggerDueReminderNotifications();
  renderAll();
})();
