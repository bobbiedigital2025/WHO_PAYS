const STORAGE_KEY = "household_money_tracker_v3";
const SAFE_TEXT_PATTERN = /^[\p{L}\p{N} .,'&()\-_/]{1,80}$/u;
const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const state = loadState();

const personForm = document.getElementById("person-form");
const personName = document.getElementById("person-name");
const peopleList = document.getElementById("people-list");
const personSelect = document.getElementById("person");

const transactionForm = document.getElementById("transaction-form");
const txBody = document.getElementById("transactions-body");
const filterPerson = document.getElementById("filter-person");
const filterType = document.getElementById("filter-type");
const filterMonth = document.getElementById("filter-month");

const summaryEl = document.getElementById("summary");
const byPersonEl = document.getElementById("by-person");
const byCategoryEl = document.getElementById("by-category");
const byPayeeEl = document.getElementById("by-payee");
const mcpResourceUriEl = document.getElementById("mcp-resource-uri");
const mcpOutputEl = document.getElementById("mcp-output");
const mcpDiscoverBtn = document.getElementById("mcp-discover-btn");
const mcpFetchBtn = document.getElementById("mcp-fetch-btn");

document.getElementById("date").valueAsDate = new Date();

personForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = personName.value.trim();
  if (!isSafeText(name, 40) || state.people.includes(name)) {
    alert("Please enter a valid, unique name.");
    return;
  }
  state.people.push(name);
  personName.value = "";
  saveAndRender();
});

transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.people.length) {
    alert("Add at least one person first.");
    return;
  }

  const tx = {
    id: crypto.randomUUID(),
    date: document.getElementById("date").value,
    person: document.getElementById("person").value,
    type: document.getElementById("type").value,
    payee: document.getElementById("payee").value.trim(),
    category: document.getElementById("category").value.trim(),
    amount: Number(document.getElementById("amount").value),
    method: document.getElementById("method").value.trim(),
    notes: document.getElementById("notes").value.trim(),
  };

  if (!validateTransaction(tx, { allowUnlistedPerson: false })) {
    alert("Please fill valid transaction details.");
    return;
  }

  state.transactions.unshift(tx);
  transactionForm.reset();
  document.getElementById("date").valueAsDate = new Date();
  saveAndRender();
});

[filterPerson, filterType, filterMonth].forEach((element) => {
  element.addEventListener("change", render);
});

txBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  state.transactions = state.transactions.filter((tx) => tx.id !== button.dataset.deleteId);
  saveAndRender();
});

document.getElementById("export-json").addEventListener("click", () => {
  downloadFile(
    "money-tracker-data.json",
    JSON.stringify(state, null, 2),
    "application/json"
  );
});

document.getElementById("export-csv").addEventListener("click", () => {
  const headers = ["date", "person", "type", "payee", "category", "amount", "method", "notes"];
  const rows = state.transactions.map((tx) => headers.map((h) => csvEscape(tx[h])));
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadFile("money-transactions.csv", csv, "text/csv;charset=utf-8");
});


mcpDiscoverBtn.addEventListener("click", async () => {
  mcpOutputEl.value = "Loading discovery...";
  try {
    const data = await fetchJson("/api/mcp/discover");
    mcpOutputEl.value = JSON.stringify(data, null, 2);
  } catch (error) {
    mcpOutputEl.value = `Discovery failed: ${error.message}`;
  }
});

mcpFetchBtn.addEventListener("click", async () => {
  const uri = mcpResourceUriEl.value.trim();
  if (!uri) {
    alert("Enter a resource URI first.");
    return;
  }
  mcpOutputEl.value = "Loading resource...";
  try {
    const data = await fetchJson("/api/mcp/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri }),
    });
    mcpOutputEl.value = JSON.stringify(data, null, 2);
  } catch (error) {
    mcpOutputEl.value = `Fetch failed: ${error.message}`;
  }
});

document.getElementById("import-json").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.people) || !Array.isArray(data.transactions)) {
      throw new Error("Invalid format.");
    }
    state.people = [...new Set(data.people.filter((p) => isSafeText(String(p), 40)))];
    state.transactions = data.transactions.filter((tx) => validateTransaction(tx, { allowUnlistedPerson: true }));
    saveAndRender();
  } catch {
    alert("Could not import JSON file.");
  }
});

function validateTransaction(tx, options = {}) {
  const amountSafe = Number.isFinite(tx.amount) && tx.amount > 0 && tx.amount <= 1000000;
  const dateSafe = /^\d{4}-\d{2}-\d{2}$/.test(tx.date);
  const typeSafe = tx.type === "income" || tx.type === "expense";
  const personSafe = options.allowUnlistedPerson
    ? isSafeText(tx.person, 40)
    : state.people.includes(tx.person);

  return Boolean(
    tx?.id &&
      dateSafe &&
      personSafe &&
      typeSafe &&
      isSafeText(tx.payee, 80) &&
      isSafeText(tx.category, 40) &&
      amountSafe &&
      (!tx.method || isSafeText(tx.method, 30)) &&
      (!tx.notes || isSafeText(tx.notes, 250))
  );
}

function isSafeText(value, maxLength = 80) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed.length > maxLength) {
    return false;
  }
  return SAFE_TEXT_PATTERN.test(trimmed);
}

function getFilteredTransactions() {
  return state.transactions.filter((tx) => {
    const personPass = filterPerson.value === "all" || tx.person === filterPerson.value;
    const typePass = filterType.value === "all" || tx.type === filterType.value;
    const monthPass = !filterMonth.value || tx.date.startsWith(filterMonth.value);
    return personPass && typePass && monthPass;
  });
}

function render() {
  renderPeople();

  const transactions = getFilteredTransactions();
  txBody.innerHTML = transactions
    .map(
      (tx) => `
      <tr>
        <td>${escapeHtml(tx.date)}</td>
        <td>${escapeHtml(tx.person)}</td>
        <td>${escapeHtml(tx.type)}</td>
        <td>${escapeHtml(tx.payee)}</td>
        <td>${escapeHtml(tx.category)}</td>
        <td class="amount ${tx.type}">${tx.type === "expense" ? "-" : "+"}${CURRENCY.format(tx.amount)}</td>
        <td>${escapeHtml(tx.method || "-")}</td>
        <td>${escapeHtml(tx.notes || "-")}</td>
        <td><button class="delete" data-delete-id="${tx.id}">Delete</button></td>
      </tr>
    `
    )
    .join("");

  renderSummary(transactions);
}

function renderPeople() {
  peopleList.innerHTML = state.people.map((name) => `<li>${escapeHtml(name)}</li>`).join("");

  if (!state.people.length) {
    personSelect.innerHTML = `<option value="" disabled selected>Add a member first</option>`;
  } else {
    const personOptions = state.people
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("");
    personSelect.innerHTML = personOptions;
  }

  const currentFilter = filterPerson.value;
  const filterOptions = state.people
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  filterPerson.innerHTML = `<option value="all">All</option>${filterOptions}`;
  if (["all", ...state.people].includes(currentFilter)) {
    filterPerson.value = currentFilter;
  }
}

function renderSummary(transactions) {
  const totalIncome = sumWhere(transactions, (tx) => tx.type === "income");
  const totalExpense = sumWhere(transactions, (tx) => tx.type === "expense");
  const net = totalIncome - totalExpense;

  summaryEl.innerHTML = [
    ["Total Income", totalIncome],
    ["Total Expense", totalExpense],
    ["Net", net],
    ["Transactions", transactions.length],
  ]
    .map(([label, value]) => {
      const content = typeof value === "number" && label !== "Transactions" ? CURRENCY.format(value) : value;
      return `<div class="kpi"><strong>${label}</strong><div>${content}</div></div>`;
    })
    .join("");

  const byPerson = rollup(transactions, (tx) => tx.person, (tx) => (tx.type === "income" ? tx.amount : -tx.amount));
  byPersonEl.innerHTML = toList(byPerson, "No person data yet.");

  const byCategory = rollup(
    transactions.filter((tx) => tx.type === "expense"),
    (tx) => tx.category,
    (tx) => tx.amount
  );
  byCategoryEl.innerHTML = toList(byCategory, "No spending category data yet.");

  const byPayee = rollup(
    transactions.filter((tx) => tx.type === "expense"),
    (tx) => tx.payee,
    (tx) => tx.amount
  );
  byPayeeEl.innerHTML = toList(byPayee, "No payee data yet.");
}

function toList(items, emptyText) {
  if (!items.length) return `<p>${emptyText}</p>`;
  return `<ol>${items
    .map(([name, amount]) => `<li>${escapeHtml(name)}: ${CURRENCY.format(amount)}</li>`)
    .join("")}</ol>`;
}

function rollup(transactions, keyFn, valueFn) {
  const map = new Map();
  transactions.forEach((tx) => {
    const key = keyFn(tx);
    map.set(key, (map.get(key) || 0) + valueFn(tx));
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function sumWhere(items, predicate) {
  return items.reduce((sum, item) => (predicate(item) ? sum + item.amount : sum), 0);
}

function loadState() {
  const fallback = { people: ["Mom", "Boyfriend"], transactions: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.people) || !Array.isArray(parsed.transactions)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value = "") {
  const safe = String(value).replace(/"/g, '""');
  return `"${safe}"`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // intentionally silent for offline-safe optional enhancement
    });
  });
}

render();
