function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function getVisibleTransactions(state) {
  const query = state.search.trim().toLowerCase();

  return state.transactions.filter((item) => {
    const passesFilter =
      state.filter === "all" ||
      (state.filter === "income" && item.amount > 0) ||
      (state.filter === "expense" && item.amount < 0);

    if (!passesFilter) return false;
    if (!query) return true;

    return (
      item.title.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });
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
  const visible = getVisibleTransactions(state)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

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
