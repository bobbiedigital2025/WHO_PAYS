/**
 * WHO PAYS – Household Income & Expense Tracker
 * Stores all data in localStorage under the key "whopays_data".
 */

(function () {
  'use strict';

  // ── Data helpers ──────────────────────────────────────────────────────────

  const STORAGE_KEY = 'whopays_data';

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return { roommates: [], transactions: [] };
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ── State ─────────────────────────────────────────────────────────────────

  let state = loadData();

  function nextId() {
    const maxId = state.transactions.reduce((m, t) => Math.max(m, t.id || 0), 0);
    return maxId + 1;
  }

  // ── DOM references ────────────────────────────────────────────────────────

  const roommateForm  = document.getElementById('roommate-form');
  const roommateInput = document.getElementById('roommate-name');
  const roommateList  = document.getElementById('roommate-list');

  const incomeForm   = document.getElementById('income-form');
  const incomeDesc   = document.getElementById('income-desc');
  const incomeAmt    = document.getElementById('income-amount');
  const incomeWho    = document.getElementById('income-who');
  const incomeDate   = document.getElementById('income-date');

  const expenseForm  = document.getElementById('expense-form');
  const expenseDesc  = document.getElementById('expense-desc');
  const expenseAmt   = document.getElementById('expense-amount');
  const expenseWho   = document.getElementById('expense-who');
  const expenseDate  = document.getElementById('expense-date');

  const summaryTotals = document.getElementById('summary-totals');
  const balancesDiv   = document.getElementById('balances');

  const logFilter    = document.getElementById('log-filter');
  const logBody      = document.getElementById('log-body');
  const logEmpty     = document.getElementById('log-empty');
  const clearAllBtn  = document.getElementById('clear-all-btn');

  // ── Utilities ─────────────────────────────────────────────────────────────

  function fmt(amount) {
    return '$' + Number(amount).toFixed(2);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  // ── Roommates ─────────────────────────────────────────────────────────────

  function renderRoommates() {
    roommateList.innerHTML = '';
    state.roommates.forEach((name) => {
      const li = document.createElement('li');
      const safe = escapeHtml(name);
      li.innerHTML = `<span>${safe}</span>
        <button class="small" data-action="remove-roommate" data-name="${safe}" aria-label="Remove ${safe}">✕</button>`;
      roommateList.appendChild(li);
    });
    refreshSelects();
  }

  function refreshSelects() {
    [incomeWho, expenseWho].forEach((sel) => {
      const current = sel.value;
      sel.innerHTML = `<option value="">${sel === incomeWho ? '-- Select Roommate --' : '-- Who Paid? --'}</option>`;
      state.roommates.forEach((name) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === current) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  }

  roommateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = roommateInput.value.trim();
    if (!name) return;
    if (state.roommates.includes(name)) {
      alert(`"${name}" is already in the list.`);
      return;
    }
    state.roommates.push(name);
    saveData(state);
    roommateInput.value = '';
    renderRoommates();
  });

  roommateList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove-roommate"]');
    if (!btn) return;
    const name = btn.dataset.name;
    const hasTransactions = state.transactions.some((t) => t.who === name);
    if (hasTransactions) {
      if (!confirm(`"${name}" has transactions. Remove them anyway?`)) return;
    }
    state.roommates = state.roommates.filter((r) => r !== name);
    saveData(state);
    renderRoommates();
    renderAll();
  });

  // ── Income ────────────────────────────────────────────────────────────────

  incomeDate.value = today();

  incomeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!incomeWho.value) { alert('Please select a roommate.'); return; }
    state.transactions.push({
      id: nextId(),
      type: 'income',
      desc: incomeDesc.value.trim(),
      amount: parseFloat(incomeAmt.value),
      who: incomeWho.value,
      date: incomeDate.value,
    });
    saveData(state);
    incomeForm.reset();
    incomeDate.value = today();
    renderAll();
  });

  // ── Expenses ──────────────────────────────────────────────────────────────

  expenseDate.value = today();

  expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!expenseWho.value) { alert('Please select a roommate.'); return; }
    state.transactions.push({
      id: nextId(),
      type: 'expense',
      desc: expenseDesc.value.trim(),
      amount: parseFloat(expenseAmt.value),
      who: expenseWho.value,
      date: expenseDate.value,
    });
    saveData(state);
    expenseForm.reset();
    expenseDate.value = today();
    renderAll();
  });

  // ── Summary & Balances ────────────────────────────────────────────────────

  function renderSummary() {
    const totalIncome  = state.transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const totalExpense = state.transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const net = totalIncome - totalExpense;

    summaryTotals.innerHTML = `
      <div class="summary-card">
        <div class="label">Total Income</div>
        <div class="value income">${fmt(totalIncome)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Expenses</div>
        <div class="value expense">${fmt(totalExpense)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Net Balance</div>
        <div class="value balance ${net >= 0 ? 'positive' : 'negative'}">${fmt(net)}</div>
      </div>`;
  }

  /**
   * Calculate who owes whom using a simple greedy algorithm.
   * Each person's net = their paid expenses – their fair share of total expenses.
   * Positive net → others owe them; negative net → they owe others.
   */
  function renderBalances() {
    balancesDiv.innerHTML = '';
    const roommates = state.roommates;
    if (roommates.length < 2) {
      balancesDiv.innerHTML = '<p class="empty-msg">Add at least 2 roommates to see balance details.</p>';
      return;
    }

    const expenses = state.transactions.filter((t) => t.type === 'expense');
    if (expenses.length === 0) {
      balancesDiv.innerHTML = '<p class="empty-msg">No expenses recorded yet.</p>';
      return;
    }

    const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
    const fairShare = totalExp / roommates.length;

    // How much each roommate paid
    const paid = {};
    roommates.forEach((r) => { paid[r] = 0; });
    expenses.forEach((t) => {
      if (paid[t.who] !== undefined) paid[t.who] += t.amount;
    });

    // Net for each: positive = owed money back, negative = owes money
    const nets = roommates.map((r) => ({ name: r, net: paid[r] - fairShare }));

    // Greedy settlement
    const creditors = nets.filter((x) => x.net > 0.005).sort((a, b) => b.net - a.net);
    const debtors   = nets.filter((x) => x.net < -0.005).sort((a, b) => a.net - b.net);

    const settlements = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const cred = creditors[ci];
      const debt = debtors[di];
      const amount = Math.min(cred.net, -debt.net);
      settlements.push({ from: debt.name, to: cred.name, amount });
      cred.net -= amount;
      debt.net += amount;
      if (Math.abs(cred.net) < 0.005) ci++;
      if (Math.abs(debt.net) < 0.005) di++;
    }

    if (settlements.length === 0) {
      balancesDiv.innerHTML = '<div class="balance-row settle">✅ All expenses are settled evenly!</div>';
      return;
    }

    settlements.forEach(({ from, to, amount }) => {
      const row = document.createElement('div');
      row.className = 'balance-row owe';
      row.innerHTML = `<span><strong>${escapeHtml(from)}</strong> owes <strong>${escapeHtml(to)}</strong></span>
        <span class="amount">${fmt(amount)}</span>`;
      balancesDiv.appendChild(row);
    });
  }

  // ── Transaction Log ───────────────────────────────────────────────────────

  function renderLog() {
    const filter = logFilter.value;
    const rows = state.transactions.filter((t) => filter === 'all' || t.type === filter);
    rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    logBody.innerHTML = '';
    if (rows.length === 0) {
      logEmpty.style.display = 'block';
      return;
    }
    logEmpty.style.display = 'none';

    rows.forEach((t) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(t.date)}</td>
        <td><span class="badge ${t.type}">${t.type}</span></td>
        <td>${escapeHtml(t.desc)}</td>
        <td>${escapeHtml(t.who)}</td>
        <td>${fmt(t.amount)}</td>
        <td><button class="small" data-action="remove-tx" data-id="${t.id}" aria-label="Delete">✕</button></td>`;
      logBody.appendChild(tr);
    });
  }

  logFilter.addEventListener('change', renderLog);

  logBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove-tx"]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (!confirm('Delete this transaction?')) return;
    state.transactions = state.transactions.filter((t) => t.id !== id);
    saveData(state);
    renderAll();
  });

  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Are you sure you want to clear ALL data? This cannot be undone.')) return;
    state = { roommates: [], transactions: [] };
    saveData(state);
    renderRoommates();
    renderAll();
  });

  // ── Master render ─────────────────────────────────────────────────────────

  function renderAll() {
    renderSummary();
    renderBalances();
    renderLog();
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  renderRoommates();
  renderAll();
})();
