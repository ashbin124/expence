function getMonthlyExpense(transactions, monthKey) {
  return transactions
    .filter((item) => item.amount < 0 && item.date.startsWith(monthKey))
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
}

export function getISODateInTimeZone(timeZone, locale) {
  const dateParts = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = dateParts.find((part) => part.type === "year")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;
  const day = dateParts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    const now = new Date();
    const fallbackMonth = String(now.getMonth() + 1).padStart(2, "0");
    const fallbackDay = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${fallbackMonth}-${fallbackDay}`;
  }

  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey(timeZone, locale) {
  const dateParts = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = dateParts.find((part) => part.type === "year")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  return `${year}-${month}`;
}

export function renderBudget({
  transactions,
  budgetLimit,
  elements,
  formatCurrency,
  locale,
  timeZone,
}) {
  const monthKey = getCurrentMonthKey(timeZone, locale);
  const spent = getMonthlyExpense(transactions, monthKey);

  elements.budgetSpentEl.textContent = `Spent this month: ${formatCurrency(spent)}`;

  if (budgetLimit <= 0) {
    elements.budgetLimitTextEl.textContent = "Limit: Not set";
    elements.budgetLeftEl.textContent = "Not set";
    elements.budgetSummaryNoteEl.textContent = "No monthly budget set.";
    elements.budgetSummaryNoteEl.className = "summary-note";
    elements.budgetMeterBarEl.style.width = "0%";
    elements.budgetAlertEl.textContent = "Set a monthly budget to track spending limits.";
    elements.budgetAlertEl.className = "budget-alert";
    return;
  }

  const remaining = budgetLimit - spent;
  const usedPercent = Math.min((spent / budgetLimit) * 100, 100);

  elements.budgetLimitTextEl.textContent = `Limit: ${formatCurrency(budgetLimit)}`;
  elements.budgetLeftEl.textContent = formatCurrency(remaining);
  elements.budgetMeterBarEl.style.width = `${usedPercent}%`;

  if (remaining >= 0) {
    elements.budgetSummaryNoteEl.textContent = "Within budget.";
    elements.budgetSummaryNoteEl.className = "summary-note income";
    elements.budgetAlertEl.textContent = `${formatCurrency(remaining)} remaining for this month.`;
    elements.budgetAlertEl.className = "budget-alert income";
    return;
  }

  elements.budgetSummaryNoteEl.textContent = "Budget exceeded.";
  elements.budgetSummaryNoteEl.className = "summary-note expense";
  elements.budgetAlertEl.textContent = `Over budget by ${formatCurrency(Math.abs(remaining))}.`;
  elements.budgetAlertEl.className = "budget-alert expense";
}
