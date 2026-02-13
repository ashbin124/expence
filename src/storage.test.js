import { beforeEach, describe, expect, it } from "vitest";
import {
  BUDGET_STORAGE_KEY,
  REMINDER_STORAGE_KEY,
  STORAGE_KEY,
  loadBudget,
  loadReminders,
  loadTransactions,
  saveBudget,
  saveReminders,
  saveTransactions,
} from "./storage.js";

function createLocalStorageMock() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
});

describe("storage", () => {
  it("returns an empty transaction list when storage is empty", () => {
    expect(loadTransactions()).toEqual([]);
  });

  it("saves and loads valid transactions", () => {
    const transactions = [
      {
        id: "tx-1",
        title: "Lunch",
        amount: -250,
        category: "Expense",
        date: "2026-02-13",
      },
    ];

    saveTransactions(transactions);

    expect(loadTransactions()).toEqual(transactions);
  });

  it("filters invalid transaction records", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "tx-valid",
          title: "Salary",
          amount: 1000,
          category: "Income",
          date: "2026-02-10",
        },
        {
          id: "tx-invalid",
          title: "Bad",
          amount: "100",
          category: "Expense",
          date: "2026-02-10",
        },
      ]),
    );

    expect(loadTransactions()).toEqual([
      {
        id: "tx-valid",
        title: "Salary",
        amount: 1000,
        category: "Income",
        date: "2026-02-10",
      },
    ]);
  });

  it("returns empty transactions for invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{invalid");
    expect(loadTransactions()).toEqual([]);
  });

  it("saves and loads budget correctly", () => {
    saveBudget(2500);
    expect(loadBudget()).toBe(2500);
  });

  it("returns 0 for invalid budget values", () => {
    localStorage.setItem(BUDGET_STORAGE_KEY, "not-a-number");
    expect(loadBudget()).toBe(0);

    localStorage.setItem(BUDGET_STORAGE_KEY, "-50");
    expect(loadBudget()).toBe(0);
  });

  it("saves and loads reminders correctly", () => {
    const reminders = [
      {
        id: "rem-1",
        title: "Internet",
        amount: 999,
        dueDate: "2026-02-20",
        lastNotifiedOn: null,
      },
    ];

    saveReminders(reminders);
    expect(loadReminders()).toEqual(reminders);
  });

  it("filters invalid reminder records", () => {
    localStorage.setItem(
      REMINDER_STORAGE_KEY,
      JSON.stringify([
        {
          id: "rem-good",
          title: "Rent",
          amount: 15000,
          dueDate: "2026-02-28",
          lastNotifiedOn: "2026-02-13",
        },
        {
          id: "rem-bad",
          title: "Invalid",
          amount: -50,
          dueDate: "13-02-2026",
        },
      ]),
    );

    expect(loadReminders()).toEqual([
      {
        id: "rem-good",
        title: "Rent",
        amount: 15000,
        dueDate: "2026-02-28",
        lastNotifiedOn: "2026-02-13",
      },
    ]);
  });
});
