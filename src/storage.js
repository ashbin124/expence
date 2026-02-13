export const STORAGE_KEY = "expense-tracker-transactions-v1";
export const BUDGET_STORAGE_KEY = "expense-tracker-budget-v1";
export const REMINDER_STORAGE_KEY = "expense-tracker-reminders-v1";

function safeParseTransactions(raw) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.amount === "number" &&
        typeof item.category === "string" &&
        typeof item.date === "string",
    );
  } catch {
    return [];
  }
}

function safeParseBudget(raw) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function safeParseReminders(raw) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.amount === "number" &&
        Number.isFinite(item.amount) &&
        item.amount > 0 &&
        typeof item.dueDate === "string" &&
        dateRegex.test(item.dueDate) &&
        (item.lastNotifiedOn === null ||
          item.lastNotifiedOn === undefined ||
          (typeof item.lastNotifiedOn === "string" &&
            dateRegex.test(item.lastNotifiedOn))),
    );
  } catch {
    return [];
  }
}

export function loadTransactions() {
  return safeParseTransactions(localStorage.getItem(STORAGE_KEY));
}

export function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

export function loadBudget() {
  return safeParseBudget(localStorage.getItem(BUDGET_STORAGE_KEY));
}

export function saveBudget(budgetLimit) {
  localStorage.setItem(BUDGET_STORAGE_KEY, String(budgetLimit));
}

export function loadReminders() {
  return safeParseReminders(localStorage.getItem(REMINDER_STORAGE_KEY));
}

export function saveReminders(reminders) {
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
}
