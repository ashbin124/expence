import { getISODateInTimeZone, renderBudget } from "./budget.js";
import { loadBudget, loadTransactions, saveBudget, saveTransactions } from "./storage.js";
import {
  renderFilterButtons,
  renderMonthlyOverview,
  renderSummary,
  renderTransactions,
} from "./ui.js";

const APP_LOCALE = "en-IN";
const APP_CURRENCY = "INR";
const APP_TIMEZONE = "Asia/Kolkata";

const state = {
  transactions: [],
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
const filterButtons = document.querySelectorAll(".filter-btn");
const budgetSubmitBtn = budgetForm.querySelector('button[type="submit"]');

let mainLoadingCount = 0;
const BACKUP_VERSION = 1;
let deferredInstallPrompt = null;

const elements = {
  listEl: document.getElementById("transactionList"),
  monthlyOverviewEl: document.getElementById("monthlyOverview"),
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

  installAppBtn.hidden = true;
  installAppBtn.disabled = true;

  if (isIosSafari()) {
    installAppHintEl.textContent = "On iPhone, tap Share and choose Add to Home Screen.";
    return;
  }

  installAppHintEl.textContent =
    "Install option appears automatically when supported by your browser.";
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
    if (!deferredInstallPrompt) return;

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

function setMainControlsDisabled(disabled) {
  submitBtn.disabled = disabled;
  cancelEditBtn.disabled = disabled;
  clearAllBtn.disabled = disabled;
  budgetInput.disabled = disabled;
  budgetSubmitBtn.disabled = disabled;
  exportDataBtn.disabled = disabled;
  importDataBtn.disabled = disabled;
  importDataInput.disabled = disabled;

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
    installAppBtn.disabled = disabled || !deferredInstallPrompt;
  }
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

function normalizeImportedTransactions(records) {
  return records.filter(isValidTransactionRecord).map((item) => ({
    id: item.id,
    title: item.title,
    amount: item.amount,
    category: item.category,
    date: item.date,
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
  const skippedCount = parsed.transactions.length - transactions.length;

  const parsedBudget = Number(parsed.budgetLimit);
  const budgetLimit =
    Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : 0;

  return { transactions, budgetLimit, skippedCount };
}

function buildBackupData() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    budgetLimit: state.budgetLimit,
    transactions: state.transactions,
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

      saveTransactions(state.transactions);
      saveBudget(state.budgetLimit);

      syncBudgetInput();
      renderAll();
      resetForm();

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

function loadLocalDataIntoState() {
  state.transactions = loadTransactions();
  state.budgetLimit = loadBudget();
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
        state.transactions = state.transactions.filter((item) => item.id !== id);
        saveTransactions(state.transactions);

        if (state.editingId === id) {
          resetForm();
        }

        renderAll();
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

(function init() {
  loadLocalDataIntoState();
  setSelectedType("expense");
  clearBackupNotice();
  registerServiceWorker();
  setupInstallPrompt();
  renderAll();
})();
