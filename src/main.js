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
const filterButtons = document.querySelectorAll(".filter-btn");
const budgetSubmitBtn = budgetForm.querySelector('button[type="submit"]');

let mainLoadingCount = 0;

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

function setMainControlsDisabled(disabled) {
  submitBtn.disabled = disabled;
  cancelEditBtn.disabled = disabled;
  clearAllBtn.disabled = disabled;
  budgetInput.disabled = disabled;
  budgetSubmitBtn.disabled = disabled;

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

(function init() {
  loadLocalDataIntoState();
  setSelectedType("expense");
  renderAll();
})();
