import { describe, expect, it } from "vitest";
import { getCurrentMonthKey, getISODateInTimeZone, renderBudget } from "./budget.js";

function createBudgetElements() {
  return {
    budgetSpentEl: { textContent: "" },
    budgetLimitTextEl: { textContent: "" },
    budgetLeftEl: { textContent: "" },
    budgetSummaryNoteEl: { textContent: "", className: "" },
    budgetMeterBarEl: { style: { width: "" } },
    budgetAlertEl: { textContent: "", className: "" },
  };
}

function formatCurrency(value) {
  return `₹${Number(value).toFixed(2)}`;
}

describe("budget", () => {
  it("returns correctly formatted month key", () => {
    const monthKey = getCurrentMonthKey("Asia/Kolkata", "en-IN");
    expect(monthKey).toMatch(/^\d{4}-\d{2}$/);
  });

  it("returns correctly formatted ISO date", () => {
    const isoDate = getISODateInTimeZone("Asia/Kolkata", "en-IN");
    expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("renders not-set state when budget limit is zero", () => {
    const monthKey = getCurrentMonthKey("Asia/Kolkata", "en-IN");
    const elements = createBudgetElements();

    renderBudget({
      transactions: [{ amount: -250, date: `${monthKey}-10` }],
      budgetLimit: 0,
      elements,
      formatCurrency,
      locale: "en-IN",
      timeZone: "Asia/Kolkata",
    });

    expect(elements.budgetSpentEl.textContent).toBe("Spent this month: ₹250.00");
    expect(elements.budgetLimitTextEl.textContent).toBe("Limit: Not set");
    expect(elements.budgetLeftEl.textContent).toBe("Not set");
    expect(elements.budgetSummaryNoteEl.textContent).toBe("No monthly budget set.");
    expect(elements.budgetMeterBarEl.style.width).toBe("0%");
  });

  it("renders within-budget state correctly", () => {
    const monthKey = getCurrentMonthKey("Asia/Kolkata", "en-IN");
    const elements = createBudgetElements();

    renderBudget({
      transactions: [{ amount: -300, date: `${monthKey}-08` }],
      budgetLimit: 1000,
      elements,
      formatCurrency,
      locale: "en-IN",
      timeZone: "Asia/Kolkata",
    });

    expect(elements.budgetLimitTextEl.textContent).toBe("Limit: ₹1000.00");
    expect(elements.budgetLeftEl.textContent).toBe("₹700.00");
    expect(elements.budgetSummaryNoteEl.textContent).toBe("Within budget.");
    expect(elements.budgetSummaryNoteEl.className).toBe("summary-note income");
    expect(elements.budgetAlertEl.textContent).toBe("₹700.00 remaining for this month.");
    expect(elements.budgetMeterBarEl.style.width).toBe("30%");
  });

  it("renders over-budget state correctly", () => {
    const monthKey = getCurrentMonthKey("Asia/Kolkata", "en-IN");
    const elements = createBudgetElements();

    renderBudget({
      transactions: [{ amount: -750, date: `${monthKey}-05` }],
      budgetLimit: 500,
      elements,
      formatCurrency,
      locale: "en-IN",
      timeZone: "Asia/Kolkata",
    });

    expect(elements.budgetLeftEl.textContent).toBe("₹-250.00");
    expect(elements.budgetSummaryNoteEl.textContent).toBe("Budget exceeded.");
    expect(elements.budgetSummaryNoteEl.className).toBe("summary-note expense");
    expect(elements.budgetAlertEl.textContent).toBe("Over budget by ₹250.00.");
    expect(elements.budgetAlertEl.className).toBe("budget-alert expense");
    expect(elements.budgetMeterBarEl.style.width).toBe("100%");
  });
});
