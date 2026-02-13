export const STORAGE_KEY = "expense-tracker-transactions-v1";
export const BUDGET_STORAGE_KEY = "expense-tracker-budget-v1";

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
