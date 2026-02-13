function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function getVisibleTransactions(state) {
  const query = state.search.trim().toLowerCase();
  const advanced = state.advancedFilters || {};
  const categoryFilter = advanced.category || "all";

  let dateFrom = advanced.dateFrom || "";
  let dateTo = advanced.dateTo || "";

  let minAmount =
    typeof advanced.minAmount === "number" && Number.isFinite(advanced.minAmount)
      ? advanced.minAmount
      : null;
  let maxAmount =
    typeof advanced.maxAmount === "number" && Number.isFinite(advanced.maxAmount)
      ? advanced.maxAmount
      : null;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const swapValue = dateFrom;
    dateFrom = dateTo;
    dateTo = swapValue;
  }

  if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
    const swapValue = minAmount;
    minAmount = maxAmount;
    maxAmount = swapValue;
  }

  return state.transactions.filter((item) => {
    const passesFilter =
      state.filter === "all" ||
      (state.filter === "income" && item.amount > 0) ||
      (state.filter === "expense" && item.amount < 0);

    if (!passesFilter) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (dateFrom && item.date < dateFrom) return false;
    if (dateTo && item.date > dateTo) return false;

    const absoluteAmount = Math.abs(item.amount);
    if (minAmount !== null && absoluteAmount < minAmount) return false;
    if (maxAmount !== null && absoluteAmount > maxAmount) return false;

    if (!query) return true;

    return (
      item.title.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });
}

function getUtcTimeFromIso(isoDate) {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function getPreviousMonthKey(monthKey) {
  const parts = monthKey.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;

  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function renderSummary({ transactions, elements, formatCurrency }) {
  const income = transactions
    .filter((item) => item.amount > 0)
    .reduce((sum, item) => sum + item.amount, 0);

  const expense = transactions
    .filter((item) => item.amount < 0)
    .reduce((sum, item) => sum + item.amount, 0);

  const balance = income + expense;

  elements.balanceEl.textContent = formatCurrency(balance);
  elements.incomeEl.textContent = formatCurrency(income);
  elements.expenseEl.textContent = formatCurrency(Math.abs(expense));
}

export function renderTransactions({ state, elements, formatCurrency, locale }) {
  const sortBy = state.sortBy || "date_desc";

  const visible = getVisibleTransactions(state)
    .slice()
    .sort((a, b) => {
      if (sortBy === "date_asc") {
        return new Date(a.date) - new Date(b.date);
      }

      if (sortBy === "amount_desc") {
        return Math.abs(b.amount) - Math.abs(a.amount);
      }

      if (sortBy === "amount_asc") {
        return Math.abs(a.amount) - Math.abs(b.amount);
      }

      return new Date(b.date) - new Date(a.date);
    });

  if (visible.length === 0) {
    elements.listEl.innerHTML = '<li class="empty">No transactions match this view.</li>';
    return;
  }

  elements.listEl.innerHTML = visible
    .map((item) => {
      const isIncome = item.amount > 0;
      const signed = `${isIncome ? "+" : "-"}${formatCurrency(Math.abs(item.amount))}`;
      const formattedDate = new Date(item.date + "T00:00:00").toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      return `
        <li class="transaction-item">
          <div>
            <p class="transaction-title">${escapeHTML(item.title)}</p>
            <div class="meta">${escapeHTML(item.category)} - ${formattedDate}</div>
          </div>
          <div class="amount ${isIncome ? "income" : "expense"}">${signed}</div>
          <div class="row-actions">
            <button class="edit-btn" type="button" data-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHTML(item.title)}">Edit</button>
            <button class="delete-btn" type="button" data-action="delete" data-id="${item.id}" aria-label="Delete ${escapeHTML(item.title)}">x</button>
          </div>
        </li>
      `;
    })
    .join("");
}

export function renderMonthlyOverview({
  transactions,
  monthlyOverviewEl,
  formatCurrency,
  formatMonthLabel,
}) {
  if (transactions.length === 0) {
    monthlyOverviewEl.innerHTML =
      '<div class="empty compact">Add transactions to see monthly trends.</div>';
    return;
  }

  const monthMap = new Map();

  transactions.forEach((item) => {
    const key = item.date.slice(0, 7);
    if (!monthMap.has(key)) {
      monthMap.set(key, { income: 0, expense: 0 });
    }

    const bucket = monthMap.get(key);
    if (item.amount > 0) {
      bucket.income += item.amount;
    } else {
      bucket.expense += Math.abs(item.amount);
    }
  });

  const entries = Array.from(monthMap.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 4);

  const peak = entries.reduce((max, [, values]) => {
    return Math.max(max, values.income, values.expense);
  }, 1);

  monthlyOverviewEl.innerHTML = entries
    .map(([month, values]) => {
      const net = values.income - values.expense;
      const incomeWidth = Math.max(
        (values.income / peak) * 100,
        values.income > 0 ? 4 : 0,
      );
      const expenseWidth = Math.max(
        (values.expense / peak) * 100,
        values.expense > 0 ? 4 : 0,
      );

      return `
        <article class="month-card">
          <div class="month-head">
            <strong>${formatMonthLabel(month)}</strong>
            <span class="${net >= 0 ? "income" : "expense"}">${net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(net))}</span>
          </div>
          <div class="meter">
            <span class="meter-income" style="width: ${incomeWidth}%"></span>
          </div>
          <div class="meter">
            <span class="meter-expense" style="width: ${expenseWidth}%"></span>
          </div>
          <div class="month-foot">
            <span>In ${formatCurrency(values.income)}</span>
            <span>Out ${formatCurrency(values.expense)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderFilterButtons({ filterButtons, activeFilter }) {
  filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === activeFilter);
  });
}

export function renderInsights({
  transactions,
  insightGridEl,
  formatCurrency,
  todayISO,
}) {
  if (!insightGridEl) return;

  if (transactions.length === 0) {
    insightGridEl.innerHTML =
      '<div class="empty compact">Add transactions to unlock insights.</div>';
    return;
  }

  const thisMonthKey = todayISO.slice(0, 7);
  const previousMonthKey = getPreviousMonthKey(thisMonthKey);
  const dayOfMonth = Math.max(Number(todayISO.slice(8, 10)) || 1, 1);

  const monthIncome = transactions
    .filter((item) => item.amount > 0 && item.date.startsWith(thisMonthKey))
    .reduce((sum, item) => sum + item.amount, 0);

  const monthExpense = transactions
    .filter((item) => item.amount < 0 && item.date.startsWith(thisMonthKey))
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);

  const previousMonthExpense = transactions
    .filter((item) => item.amount < 0 && item.date.startsWith(previousMonthKey))
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);

  const monthNet = monthIncome - monthExpense;
  const savingsRate = monthIncome > 0 ? (monthNet / monthIncome) * 100 : null;
  const dailyBurn = monthExpense / dayOfMonth;

  const largestExpense = transactions
    .filter((item) => item.amount < 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];

  const todayUtc = getUtcTimeFromIso(todayISO);
  const thirtyDayThreshold = todayUtc ? todayUtc - 29 * 24 * 60 * 60 * 1000 : null;

  const last30DayExpense = transactions
    .filter((item) => item.amount < 0)
    .filter((item) => {
      if (thirtyDayThreshold === null) return false;
      const itemUtc = getUtcTimeFromIso(item.date);
      return itemUtc !== null && itemUtc >= thirtyDayThreshold;
    })
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);

  let expenseTrendText = "No previous month baseline.";
  let expenseTrendClass = "summary-note";

  if (previousMonthExpense > 0) {
    const trendPct = ((monthExpense - previousMonthExpense) / previousMonthExpense) * 100;
    const signedPct = `${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}%`;
    expenseTrendText = `${signedPct} vs last month`;
    expenseTrendClass = trendPct <= 0 ? "summary-note income" : "summary-note expense";
  } else if (monthExpense > 0) {
    expenseTrendText = "First month with spending data.";
  }

  insightGridEl.innerHTML = `
    <article class="insight-card">
      <div class="insight-label">This Month Net</div>
      <div class="insight-value ${monthNet >= 0 ? "income" : "expense"}">
        ${monthNet >= 0 ? "+" : "-"}${formatCurrency(Math.abs(monthNet))}
      </div>
      <p class="summary-note">
        Savings rate:
        ${
          savingsRate === null
            ? "No income logged."
            : `<span class="${savingsRate >= 0 ? "income" : "expense"}">${savingsRate.toFixed(1)}%</span>`
        }
      </p>
    </article>
    <article class="insight-card">
      <div class="insight-label">Expense Trend</div>
      <div class="insight-value">${formatCurrency(monthExpense)}</div>
      <p class="${expenseTrendClass}">${expenseTrendText}</p>
    </article>
    <article class="insight-card">
      <div class="insight-label">Biggest Expense</div>
      <div class="insight-value">
        ${largestExpense ? formatCurrency(Math.abs(largestExpense.amount)) : formatCurrency(0)}
      </div>
      <p class="summary-note">
        ${largestExpense ? escapeHTML(largestExpense.title) : "No expenses logged yet."}
      </p>
    </article>
    <article class="insight-card">
      <div class="insight-label">Spend Velocity</div>
      <div class="insight-value">${formatCurrency(dailyBurn)}</div>
      <p class="summary-note">Avg/day this month - 30d total: ${formatCurrency(last30DayExpense)}</p>
    </article>
  `;
}

export function renderBillReminders({
  reminders,
  reminderListEl,
  formatCurrency,
  locale,
  todayISO,
}) {
  if (!reminderListEl) return;

  if (reminders.length === 0) {
    reminderListEl.innerHTML = '<li class="empty compact">No reminders yet.</li>';
    return;
  }

  const todayUtc = getUtcTimeFromIso(todayISO);

  reminderListEl.innerHTML = reminders
    .slice()
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    .map((item) => {
      const dueUtc = getUtcTimeFromIso(item.dueDate);
      const daysToDue =
        dueUtc !== null && todayUtc !== null
          ? Math.round((dueUtc - todayUtc) / (24 * 60 * 60 * 1000))
          : 0;

      let statusText;
      let statusClass = "reminder-status";

      if (daysToDue < 0) {
        statusText = `Overdue by ${Math.abs(daysToDue)} day${Math.abs(daysToDue) === 1 ? "" : "s"}`;
        statusClass = "reminder-status expense";
      } else if (daysToDue === 0) {
        statusText = "Due today";
        statusClass = "reminder-status expense";
      } else if (daysToDue <= 3) {
        statusText = `Due in ${daysToDue} day${daysToDue === 1 ? "" : "s"}`;
        statusClass = "reminder-status warning";
      } else {
        statusText = `Due in ${daysToDue} days`;
      }

      const formattedDate = new Date(item.dueDate + "T00:00:00").toLocaleDateString(
        locale,
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        },
      );

      return `
        <li class="reminder-item">
          <div class="reminder-main">
            <p class="transaction-title">${escapeHTML(item.title)}</p>
            <div class="meta">Due ${formattedDate} - ${formatCurrency(item.amount)}</div>
            <p class="${statusClass}">${statusText}</p>
          </div>
          <div class="row-actions">
            <button
              class="edit-btn"
              type="button"
              data-action="pay-reminder"
              data-id="${item.id}"
              aria-label="Mark ${escapeHTML(item.title)} as paid"
            >
              Log Paid
            </button>
            <button
              class="delete-btn"
              type="button"
              data-action="delete-reminder"
              data-id="${item.id}"
              aria-label="Delete reminder ${escapeHTML(item.title)}"
            >
              x
            </button>
          </div>
        </li>
      `;
    })
    .join("");
}
