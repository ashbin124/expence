export const STORAGE_KEY = "expense-tracker-transactions-v1";
export const BUDGET_STORAGE_KEY = "expense-tracker-budget-v1";
export const REMINDER_STORAGE_KEY = "expense-tracker-reminders-v1";
export const SETTINGS_STORAGE_KEY = "expense-tracker-settings-v1";

const DEFAULT_SETTINGS = {
  locale: "en-IN",
  currency: "INR",
  timeZone: "Asia/Kolkata",
  reminderLeadDays: 1,
};

const SUPPORTED_LOCALES = new Set(["en-IN", "en-US", "en-GB"]);
const SUPPORTED_CURRENCIES = new Set(["INR", "USD", "EUR", "GBP"]);
const SUPPORTED_TIMEZONES = new Set([
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "Europe/London",
]);
const SUPPORTED_REMINDER_LEAD_DAYS = new Set([0, 1, 3, 7]);

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

function safeParseSettings(raw) {
  if (!raw) return { ...DEFAULT_SETTINGS };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SETTINGS };
    }

    const locale = SUPPORTED_LOCALES.has(parsed.locale)
      ? parsed.locale
      : DEFAULT_SETTINGS.locale;
    const currency = SUPPORTED_CURRENCIES.has(parsed.currency)
      ? parsed.currency
      : DEFAULT_SETTINGS.currency;
    const timeZone = SUPPORTED_TIMEZONES.has(parsed.timeZone)
      ? parsed.timeZone
      : DEFAULT_SETTINGS.timeZone;
    const parsedLeadDays = Number(parsed.reminderLeadDays);
    const reminderLeadDays = SUPPORTED_REMINDER_LEAD_DAYS.has(parsedLeadDays)
      ? parsedLeadDays
      : DEFAULT_SETTINGS.reminderLeadDays;

    return { locale, currency, timeZone, reminderLeadDays };
  } catch {
    return { ...DEFAULT_SETTINGS };
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

export function loadSettings() {
  return safeParseSettings(localStorage.getItem(SETTINGS_STORAGE_KEY));
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
