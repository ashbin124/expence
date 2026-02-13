import { getISODateInTimeZone, renderBudget } from "./budget.js";
import {
  loadBudget,
  loadReminders,
  loadTransactions,
  saveBudget,
  saveReminders,
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

const APP_LOCALE = "en-IN";
const APP_CURRENCY = "INR";
const APP_TIMEZONE = "Asia/Kolkata";

const state = {
  transactions: [],
  reminders: [],
  filter: "all",
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
const BACKUP_VERSION = 2;
const MOBILE_VIEW_STORAGE_KEY = "expense-tracker-mobile-view-v1";
const MOBILE_VIEWS = new Set(["transactions", "add", "insights", "reminders"]);
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

function formatCurrency(value) {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency: APP_CURRENCY,
  }).format(value);
}

function formatMonthLabel(value) {
  return new Date(value + "-01T00:00:00").toLocaleDateString(APP_LOCALE, {
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

  const todayISO = getISODateInTimeZone(APP_TIMEZONE, APP_LOCALE);
  const todayAtMidnight = new Date(todayISO + "T00:00:00");
  const nextReminders = state.reminders.map((reminder) => {
    if (reminder.lastNotifiedOn === todayISO) return reminder;

    const dueDateAtMidnight = new Date(reminder.dueDate + "T00:00:00");
    const daysUntil = Math.round(
      (dueDateAtMidnight.getTime() - todayAtMidnight.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (daysUntil < 0 || daysUntil > 1) {
      return reminder;
    }

    const prefix = daysUntil === 0 ? "Due today" : "Due tomorrow";
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
  if (enableReminderAlertsBtn) {
    enableReminderAlertsBtn.disabled =
      disabled || getReminderAlertPermission() !== "default";
  }

  amountInput.disabled = disabled;
  titleInput.disabled = disabled;
  searchInput.disabled = disabled;

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
  const skippedCount = parsed.transactions.length - transactions.length;

  const parsedBudget = Number(parsed.budgetLimit);
  const budgetLimit =
    Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : 0;

  return { transactions, budgetLimit, reminders, skippedCount };
}

function buildBackupData() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    budgetLimit: state.budgetLimit,
    transactions: state.transactions,
    reminders: state.reminders,
  };
}

function downloadBackupJson(data) {
  const prettyJson = JSON.stringify(data, null, 2);
  const blob = new Blob([prettyJson], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);

  const downloadAnchor = document.createElement("a");
  const datePart = getISODateInTimeZone(APP_TIMEZONE, APP_LOCALE);
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

      saveTransactions(state.transactions);
      saveBudget(state.budgetLimit);
      saveReminders(state.reminders);

      syncBudgetInput();
      clearUndoToast();
      renderAll();
      resetForm();
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
  const todayISO = getISODateInTimeZone(APP_TIMEZONE, APP_LOCALE);

  renderSummary({ transactions: state.transactions, elements, formatCurrency });

  renderBudget({
    transactions: state.transactions,
    budgetLimit: state.budgetLimit,
    elements,
    formatCurrency,
    locale: APP_LOCALE,
    timeZone: APP_TIMEZONE,
  });

  renderTransactions({
    state,
    elements,
    formatCurrency,
    locale: APP_LOCALE,
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
    locale: APP_LOCALE,
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
  reminderDateInput.value = getISODateInTimeZone(APP_TIMEZONE, APP_LOCALE);
}

function loadLocalDataIntoState() {
  state.transactions = loadTransactions();
  state.budgetLimit = loadBudget();
  state.reminders = loadReminders();
  syncBudgetInput();
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

  let date = getISODateInTimeZone(APP_TIMEZONE, APP_LOCALE);

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

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;

  renderTransactions({
    state,
    elements,
    formatCurrency,
    locale: APP_LOCALE,
  });
});

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
        locale: APP_LOCALE,
        timeZone: APP_TIMEZONE,
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

      const paymentDate = getISODateInTimeZone(APP_TIMEZONE, APP_LOCALE);

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
  setSelectedType("expense");
  resetReminderForm();
  clearBackupNotice();
  clearReminderNotice();
  updateReminderAlertButton();
  registerServiceWorker();
  setupInstallPrompt();
  setupMobileViewNavigation();
  triggerDueReminderNotifications();
  renderAll();
})();
