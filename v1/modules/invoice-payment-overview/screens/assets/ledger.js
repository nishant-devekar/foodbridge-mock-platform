/* Shared ledger engine for the Invoice & Payments discovery prototype (v2).
   Two screens load this same file — Customer Receivables (/invoices-payments) and
   Supplier Payables (/supplier-invoices-payments). Each page sets
   window.LEDGER_CONFIG = { kind, seed } and everything else derives from `kind`.
   Summary tiles are COMPUTED from the seed rows, so any data you add shows up. */
(function () {
  const CFG = window.LEDGER_CONFIG || {};
  const kind = CFG.kind === 'supplier' ? 'supplier' : 'customer';
  const SEED = CFG.seed || '../seed-data/seed.json';
  const PAGE_SIZE = 8;

  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const esc = s => String(s == null ? '' : s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const sum = (rows, k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  // ---- icons ----
  const I = {
    trend: '<svg viewBox="0 0 24 24" width="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4M9 13h6M9 17h6"/></svg>',
    card: '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/></svg>',
    bell: '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M6 8.5a6 6 0 0 1 12 0c0 4.2 1.4 5.7 2 6.3H4c.6-.6 2-2.1 2-6.3Z"/><path d="M9.6 17.8a2.6 2.6 0 0 0 4.8 0"/></svg>'
  };

  // ---- per-kind config ----
  const CUSTOMER = {
    party: 'customer', showDate: true, showBatch: true,
    searchPlaceholder: 'Search dispatch, buyer...',
    statusOutstanding: 'Has Outstanding', statusAdvance: 'Advance Received', statusSettled: 'Settled',
    mSettled: 'Collected', mAdvance: 'Advance Received', mNet: 'Net Receivable',
    ordersTitle: 'Order History', ordersCount: 'Total Orders', ordersTotal: 'Total Invoiced', docPrefix: 'Invoice #',
    paymentsTitle: 'Payments Records', paidCol: 'Collected (Cash/Bank)',
    advanceCol: 'Total Advance Received (Over-collected)', advanceRow: 'Advance Received (Over-collected)',
    footPaid: 'Total Collected (Cash/Bank)', footAdvance: 'Total Advance Received (Over-collected)',
    primaryLabel: 'Collect Payment', hasRemind: true, drawer: 'split',
    drawerTitle: 'Record Payment', boxA: 'Net Payable', boxB: 'Collected', boxC: 'Outstanding',
    boxAsub: 'This invoice', boxBsub: 'All invoices', boxCsub: 'All invoices', submitLabel: 'Collect Payment',
    successVerb: 'collected from', successBack: 'Back to invoices', toastPay: 'Payment collected successfully',
    tiles(rows) {
      const outCount = rows.filter(r => Number(r.outstanding) > 0).length;
      const advCount = rows.filter(r => Number(r.advance) > 0).length;
      const invCount = sum(rows, 'invoices');
      return [
        { label: 'Total Invoiced', value: sum(rows, 'invoiced'), meta: plural(invCount, 'invoice'), tone: 'ink', icon: I.trend },
        { label: 'Collected', value: sum(rows, 'collected'), meta: 'Cash / UPI', tone: 'green', valueClass: 'pos', icon: I.check },
        { label: 'Awaiting Payment', value: sum(rows, 'outstanding'), meta: `${outCount} Customer${outCount === 1 ? '' : 's'} Outstanding`, tone: 'amber', valueClass: 'amber', icon: I.clock },
        { label: 'Advance Received', value: sum(rows, 'advance'), meta: `${advCount} Customer${advCount === 1 ? '' : 's'} over-collected`, tone: 'blue', valueClass: 'blue', icon: I.trend }
      ];
    }
  };
  const SUPPLIER = {
    party: 'supplier', showDate: false, showBatch: false,
    searchPlaceholder: 'Search by supplier name, mobile number or supplier code',
    statusOutstanding: 'Payment Due', statusAdvance: 'Advance Paid', statusSettled: 'Settled',
    mSettled: 'Paid', mAdvance: 'Advance', mNet: 'Net Payable',
    ordersTitle: 'Purchase Invoices', ordersCount: 'Count', ordersTotal: 'Total Invoiced', docPrefix: 'Bill #',
    paymentsTitle: 'Payment Records', paidCol: 'Paid (Cash/Bank)',
    advanceCol: 'Total Advance Paid', advanceRow: 'Advance Paid (Prepaid)',
    footPaid: 'Total Paid (Cash/Bank)', footAdvance: 'Total Advance Paid',
    primaryLabel: 'Record Payment', hasRemind: false, drawer: 'methods',
    drawerTitle: 'Record Payment to Supplier', boxA: 'Outstanding', boxB: 'Paid', boxC: 'Advance',
    boxAsub: 'We owe them', boxBsub: 'All time', boxCsub: 'Prepaid', submitLabel: 'Record Payment',
    successVerb: 'paid to', successBack: 'Back to payables', toastPay: 'Supplier payment recorded',
    tiles(rows) {
      const outCount = rows.filter(r => Number(r.outstanding) > 0).length;
      return [
        { label: 'Total Invoiced', value: sum(rows, 'invoiced'), meta: plural(rows.length, 'supplier'), tone: 'ink', icon: I.doc },
        { label: 'Paid', value: sum(rows, 'collected'), meta: 'Cash / bank / UPI / cheque', tone: 'green', valueClass: 'pos', icon: I.check },
        { label: 'Outstanding', value: sum(rows, 'outstanding'), meta: outCount ? `${outCount} supplier${outCount === 1 ? '' : 's'} due` : 'Nothing owed', tone: 'amber', valueClass: 'amber', icon: I.clock },
        { label: 'Advance Paid', value: sum(rows, 'advance'), meta: 'Prepaid, not yet invoiced against', tone: 'blue', valueClass: 'blue', icon: I.trend }
      ];
    }
  };
  const C = kind === 'supplier' ? SUPPLIER : CUSTOMER;
  const METHODS = [
    { key: 'cash', title: 'Cash', sub: 'Pay in cash' },
    { key: 'upi', title: 'UPI', sub: 'GPay · PhonePe · Paytm' },
    { key: 'bank', title: 'Bank Transfer', sub: 'NEFT / RTGS / IMPS' },
    { key: 'cheque', title: 'Cheque', sub: 'Pay by cheque' }
  ];

  const state = {
    rows: [], expanded: new Set(), sections: new Set(), invoices: new Set(), selected: new Set(),
    active: null, page: 1, filter: { search: '', from: '', to: '' },
    calendar: { view: new Date(2026, 7, 1), start: '', end: '' },
    pay: { cod: true, online: false, codAmount: 0, onlineAmount: 0, method: 'cash', methodAmount: 0, complete: false }
  };

  function showToast(msg) {
    const t = $('#toast');
    t.innerHTML = `<span class="t-check">${I.check}</span><div>${esc(msg)}</div><span class="t-bar"></span>`;
    t.classList.remove('hide'); clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => t.classList.add('hide'), 2600);
  }
  const statusOf = r => Number(r.outstanding) > 0 ? 'outstanding' : Number(r.advance) > 0 ? 'advance' : 'settled';
  const statusLabel = r => ({ outstanding: C.statusOutstanding, advance: C.statusAdvance, settled: C.statusSettled }[statusOf(r)]);

  // ---- summary ----
  function renderSummary() {
    $('#summary').innerHTML = C.tiles(state.rows).map(x => `<article class="summary-card ${x.tone}"><span class="eyebrow">${x.label}<i class="info">i</i></span><span class="tile-icon">${x.icon}</span><h2 class="${x.valueClass || ''}">${money(x.value)}</h2><p>${x.meta}</p></article>`).join('');
    updateSummaryThumb();
  }
  function updateSummaryThumb() {
    const el = $('#summary'), track = $('#summaryTrack'), thumb = $('#summaryThumb'); if (!el || !track || !thumb) return;
    const scrollable = el.scrollWidth > el.clientWidth + 1; track.classList.toggle('hide', !scrollable); if (!scrollable) return;
    const ratio = el.clientWidth / el.scrollWidth, tw = track.clientWidth, thw = Math.max(28, ratio * tw), maxS = el.scrollWidth - el.clientWidth, maxL = tw - thw, left = maxS > 0 ? (el.scrollLeft / maxS) * maxL : 0;
    thumb.style.width = thw + 'px'; thumb.style.transform = `translateX(${left}px)`;
  }

  // ---- filtering + paging ----
  function filtered() {
    const q = state.filter.search.toLowerCase();
    const from = state.filter.from, to = state.filter.to;
    return state.rows.filter(r => {
      const text = (r.name + ' ' + r.phone + ' ' + (r.code || '')).toLowerCase();
      if (q && !text.includes(q)) return false;
      // date range only narrows rows that have dated invoices; advance-only (0-invoice) rows always show
      if ((from || to) && Number(r.invoices) > 0) {
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
      }
      return true;
    });
  }
  function debtors() { return state.rows.filter(r => Number(r.outstanding) > 0); }

  function mCell(label, value, cls, sign) { return `<div class="metric"><span class="eyebrow">${label}</span><span class="money ${cls || ''}">${sign || ''}${money(value)}</span></div>`; }

  // ---- ledger ----
  function renderLedger() {
    const rows = filtered();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * PAGE_SIZE, pageRows = rows.slice(start, start + PAGE_SIZE);
    const ledger = $('#ledger');
    if (!rows.length) { ledger.innerHTML = `<div class="acct"><div class="empty">No ${C.party}s match these filters.<br><button class="btn" id="clearFilters" style="margin-top:12px">Clear filters</button></div></div>`; $('#pager').classList.add('hide'); bindLedger(); return; }
    ledger.innerHTML = pageRows.map(r => {
      const open = state.expanded.has(r.id), st = statusOf(r);
      const out = Number(r.outstanding), adv = Number(r.advance), col = Number(r.collected);
      const metrics = [
        mCell('Invoiced', r.invoiced, 'pos', '+'),
        col > 0 ? mCell(C.mSettled, col, 'pos', '') : '',
        out > 0 ? mCell('Outstanding', out, 'amber', '') : (adv > 0 ? mCell(C.mAdvance, adv, 'blue', '+') : ''),
        mCell(C.mNet, out, '', '')
      ].join('');
      const actions = kind === 'supplier'
        ? `<div class="row-actions"><button class="btn green" data-collect="${r.id}">${I.card}<span>${C.primaryLabel}</span></button></div>`
        : (out > 0 ? `<div class="row-actions"><button class="btn green" data-collect="${r.id}">${I.card}<span>${C.primaryLabel}</span></button><button class="btn amber" data-remind="${r.id}">${I.bell}<span>Remind</span></button></div>` : '');
      return `<article class="acct"><div class="acct-head" data-acct="${r.id}" role="button" tabindex="0" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(r.name)}"><span class="chevron" aria-hidden="true">${open ? '⌃' : '⌄'}</span><div class="avatar">${esc(r.name[0].toUpperCase())}</div><div class="identity"><div class="identity-row"><strong>${esc(r.name)}</strong><span class="status st-${st}">${statusLabel(r)}</span></div><div class="sub">✆ ${esc(r.phone)}${r.code ? ' · ' + esc(r.code) : ''} · ${plural(Number(r.invoices || 0), 'invoice')}</div></div><div class="metrics">${metrics}</div>${actions}</div>${open ? details(r) : ''}</article>`;
    }).join('');
    renderPager(rows.length, pages, start, pageRows.length);
    bindLedger();
  }

  function renderPager(total, pages, start, shown) {
    const pager = $('#pager');
    pager.classList.remove('hide');
    let btns = `<button data-page="prev" ${state.page === 1 ? 'disabled' : ''}>‹</button>`;
    for (let p = 1; p <= pages; p++) btns += `<button data-page="${p}" class="${p === state.page ? 'active' : ''}">${p}</button>`;
    btns += `<button data-page="next" ${state.page === pages ? 'disabled' : ''}>›</button>`;
    pager.innerHTML = `<span class="count-label">Showing ${total ? start + 1 : 0}-${start + shown} of ${total}</span><div class="pager-btns">${btns}</div>`;
    $$('[data-page]', pager).forEach(b => b.onclick = () => {
      const d = b.dataset.page;
      state.page = d === 'prev' ? Math.max(1, state.page - 1) : d === 'next' ? Math.min(pages, state.page + 1) : Number(d);
      renderLedger();
    });
  }

  function details(r) {
    const oOpen = state.sections.has(r.id + ':orders'), pOpen = state.sections.has(r.id + ':payments');
    const orders = r.orders || [];
    const orderBody = oOpen ? `<div class="section-body">${orders.length ? orders.map((o, i) => invoiceRow(r, o, i)).join('') : '<div class="empty">No documents recorded yet.</div>'}</div>` : '';
    const out = Number(r.outstanding), adv = Number(r.advance), col = Number(r.collected);
    const payRows = (r.payments || []).map(p => `<tr><td><span class="method-badge">${esc(p.method)}</span></td><td>${esc(r.name)}</td><td>${esc(p.date)}</td><td class="money pos">+${money(p.amount)}</td></tr>`).join('');
    const advRow = adv > 0 ? `<tr><td><span class="method-badge blue">${C.advanceRow}</span></td><td>—</td><td>—</td><td class="money blue">+${money(adv)}</td></tr>` : '';
    const paymentBody = pOpen ? `<div class="section-body"><div class="payment-totals"><div class="payment-total"><span class="eyebrow">Total Invoiced</span><div class="money">${money(r.invoiced)}</div></div><div class="payment-total"><span class="eyebrow">${C.paidCol}</span><div class="money pos">+${money(col)}</div></div><div class="payment-total"><span class="eyebrow">${C.advanceCol}</span><div class="money blue">+${money(adv)}</div></div></div><div class="payment-scroll"><table class="payment-table"><thead><tr><th>Method / note</th><th>Location</th><th>Date</th><th>Amount</th></tr></thead><tbody>${payRows || '<tr><td colspan="4" class="muted" style="text-align:center">No payments recorded yet.</td></tr>'}${advRow}<tr class="payment-foot green"><td colspan="3">${C.footPaid}</td><td>+${money(col)}</td></tr>${adv > 0 ? `<tr class="payment-foot blue"><td colspan="3">${C.footAdvance}</td><td>+${money(adv)}</td></tr>` : ''}</tbody></table></div></div>` : '';
    return `<div class="details">
      <section class="section"><div class="section-head" data-section="${r.id}:orders" role="button" tabindex="0" aria-expanded="${oOpen}"><span class="chevron">${oOpen ? '⌃' : '⌄'}</span><div class="avatar">${esc(r.name[0].toUpperCase())}</div><strong>${C.ordersTitle}</strong><div class="section-summary">${mCell(C.ordersCount, orders.length, 'pos', '')}${mCell(C.ordersTotal, r.invoiced, '', '')}</div></div>${orderBody}</section>
      <section class="section"><div class="section-head" data-section="${r.id}:payments" role="button" tabindex="0" aria-expanded="${pOpen}"><span class="chevron">${pOpen ? '⌃' : '⌄'}</span><div class="avatar">${esc(r.name[0].toUpperCase())}</div><strong>${C.paymentsTitle}</strong><div class="section-summary">${mCell(C.mSettled, col, 'pos', '')}${mCell('Outstanding', out, out ? 'amber' : '', '')}</div></div>${paymentBody}</section>
    </div>`;
  }

  function invoiceRow(r, o, i) {
    const open = state.invoices.has(r.id + ':' + i);
    const items = o.items || [];
    const itemSummary = items.length ? items.map(it => it.name).join(', ') : (o.summary || '');
    const table = open && items.length ? `<table class="line-table"><thead><tr><th>Product</th><th>Unit Price</th><th>Qty</th><th>Total</th></tr></thead><tbody>${items.map(it => `<tr><td>${esc(it.name)}<div class="line-sku">${esc(it.sku || '')}</div></td><td>${money(it.unitPrice)}${it.unit ? '/' + esc(it.unit) : ''}</td><td>${it.qty} ${esc(it.unit || '')}</td><td>${money(it.total)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Total</td><td>${money(items.reduce((a, it) => a + Number(it.total || 0), 0))}</td></tr></tfoot></table>` : '';
    return `<div class="invoice-wrap"><div class="invoice-row" data-inv="${r.id}:${i}" role="button" tabindex="0" aria-expanded="${open}"><span class="chevron">${open ? '⌃' : '⌄'}</span><span class="icon">${I.doc}</span><div><strong>${C.docPrefix}${esc(o.invoiceNo)}</strong><div class="sub">${plural(items.length || 1, 'item')} · ${esc(o.date)} · ${esc(itemSummary)}</div></div><div class="invoice-stats">${mCell('Invoiced', o.invoiced, 'pos', '+')}${mCell('Net Payable', o.netPayable, '', '')}</div><button class="inv-btn" data-inv-btn="${r.id}:${i}">${I.doc} ${C.docPrefix.replace(' #', '')} ${open ? '⌃' : '⌄'}</button></div>${table}</div>`;
  }

  function bindLedger() {
    const key = (e, b) => { if (e.type === 'keydown') { if (e.key !== 'Enter' && e.key !== ' ') return false; if (e.target !== b) return false; e.preventDefault(); } return true; };
    $$('[data-acct]').forEach(b => { const t = e => { if (e.target.closest('[data-collect],[data-remind]')) return; if (!key(e, b)) return; const id = b.dataset.acct; state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id); renderLedger(); }; b.onclick = t; b.onkeydown = t; });
    $$('[data-section]').forEach(b => { const t = e => { if (!key(e, b)) return; const id = b.dataset.section; state.sections.has(id) ? state.sections.delete(id) : state.sections.add(id); renderLedger(); }; b.onclick = t; b.onkeydown = t; });
    const invToggle = id => { state.invoices.has(id) ? state.invoices.delete(id) : state.invoices.add(id); renderLedger(); };
    $$('[data-inv]').forEach(b => { const t = e => { if (e.target.closest('[data-inv-btn]')) return; if (!key(e, b)) return; invToggle(b.dataset.inv); }; b.onclick = t; b.onkeydown = t; });
    $$('[data-inv-btn]').forEach(b => b.onclick = e => { e.stopPropagation(); invToggle(b.dataset.invBtn); });
    $$('[data-collect]').forEach(b => b.onclick = e => { e.stopPropagation(); openPayment(b.dataset.collect); });
    $$('[data-remind]').forEach(b => b.onclick = e => { e.stopPropagation(); state.selected = new Set([b.dataset.remind]); openReminder(); });
    $('#clearFilters')?.addEventListener('click', () => { state.filter = { search: '', from: '', to: '' }; state.calendar.start = ''; state.calendar.end = ''; $('#search').value = ''; state.page = 1; if (C.showDate) { updateDateTrigger(); renderCalendar(); } renderLedger(); });
  }

  // ---- overlay / reminders ----
  function overlay(show) { $('#overlay').classList.toggle('hide', !show); document.body.style.overflow = show ? 'hidden' : ''; }
  function closeAll() { $('#reminderModal')?.classList.add('hide'); $('#paymentDrawer').classList.add('hide'); overlay(false); }
  function openReminder() { renderReminder(); overlay(true); $('#reminderModal').classList.remove('hide'); setTimeout(() => $('#reminderSearch').focus(), 0); }
  function renderReminder() {
    const q = $('#reminderSearch')?.value.toLowerCase() || '';
    const list = debtors().filter(r => (r.name + ' ' + r.phone).toLowerCase().includes(q));
    $('#debtorCount').textContent = debtors().length;
    $('#reminderList').innerHTML = list.map(r => `<label class="reminder-row ${state.selected.has(r.id) ? 'selected' : ''}"><input type="checkbox" data-reminder="${r.id}" ${state.selected.has(r.id) ? 'checked' : ''}/><span class="avatar">${esc(r.name[0].toUpperCase())}</span><span><strong>${esc(r.name)}</strong><span class="sub">✆ ${esc(r.phone)} ⧉</span></span><span style="text-align:right"><span class="eyebrow">Outstanding</span><span class="money amber" style="display:block">${money(r.outstanding)}</span></span></label>`).join('');
    const n = state.selected.size;
    $('#selectedTop').textContent = n;
    $('#selectAll').checked = n === debtors().length && n > 0; $('#selectAll').indeterminate = n > 0 && n < debtors().length;
    $('#sendReminders').disabled = !n; $('#sendReminders').innerHTML = `${I.bell} Send${n ? ' (' + n + ')' : ''}`;
    $('#reminderHelp').textContent = n ? `${plural(n, 'customer')} will receive a WhatsApp reminder` : 'Select customers to send reminders';
    $$('[data-reminder]').forEach(x => x.onchange = () => { x.checked ? state.selected.add(x.dataset.reminder) : state.selected.delete(x.dataset.reminder); renderReminder(); });
  }

  // ---- payment drawer ----
  const todayStr = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  function openPayment(id) {
    state.active = state.rows.find(r => r.id === id); if (!state.active) return;
    state.pay = { cod: true, online: false, codAmount: 0, onlineAmount: 0, method: 'cash', methodAmount: 0, complete: false };
    renderPayment(); overlay(true); $('#paymentDrawer').classList.remove('hide');
  }
  function paidNow() { const p = state.pay; return C.drawer === 'split' ? (p.cod ? Number(p.codAmount) : 0) + (p.online ? Number(p.onlineAmount) : 0) : Number(p.methodAmount); }
  function renderPayment() {
    const r = state.active, p = state.pay, net = Number(r.outstanding);
    if (p.complete) { $('#paymentDrawer').innerHTML = `<div class="success-view"><div><div class="big-check">✓</div><h2>Payment recorded</h2><p>${money(p._paid)} ${C.successVerb} ${esc(r.name)}.</p><button class="btn primary" data-close style="margin-top:20px">${C.successBack}</button></div></div>`; bindClose(); return; }
    const head = `<header class="drawer-head"><span class="icon" style="background:var(--green-soft);color:var(--green-dark)">${I.card}</span><div><h2 id="paymentTitle">${C.drawerTitle}</h2><p>👤 ${esc(r.name)} · ✆ ${esc(r.phone)}${kind === 'customer' ? ' · #2026081103481651' : ''}</p></div><button class="close" data-close aria-label="Close">×</button></header>`;
    const boxes = `<div class="drawer-summary"><div class="${kind === 'supplier' ? 'green-box' : ''}"><span class="eyebrow">${C.boxA}</span><span class="money">${money(net)}</span><small>${C.boxAsub}</small></div><div class="${kind === 'customer' ? 'green-box' : ''}"><span class="eyebrow ${kind === 'customer' ? 'pos' : ''}">${C.boxB}</span><span class="money ${kind === 'customer' ? 'pos' : ''}">${money(r.collected)}</span><small>${C.boxBsub}</small></div><div class="${kind === 'customer' ? 'amber-box' : 'blue-box'}"><span class="eyebrow ${kind === 'customer' ? 'amber' : 'blue'}">${C.boxC}</span><span class="money ${kind === 'customer' ? 'amber' : 'blue'}">${money(kind === 'customer' ? net : (r.advance || 0))}</span><small>${C.boxCsub}</small></div></div>`;
    const content = C.drawer === 'split'
      ? `${boxes}<div class="split-title">◧ Split Payment <span style="font-weight:400">— select methods & enter amounts</span></div>${splitMethod('cod', 'Cash on Delivery (COD)', 'Pay on delivery', p.cod, p.codAmount, 'Cash')}${splitMethod('online', 'Pay Online', 'UPI / card / bank transfer', p.online, p.onlineAmount, 'Online')}`
      : `${boxes}<div class="split-title" style="background:#eef6ff;border-color:#c7dbff;color:#1d4ed8">Payment Method</div>${METHODS.map(m => radioMethod(m, p)).join('')}`;
    $('#paymentDrawer').innerHTML = head + `<div class="drawer-content" id="drawerContent">${content}</div><footer class="drawer-foot" id="drawerFoot">${footHTML()}</footer>`;
    if (C.drawer === 'split') bindSplit(); else bindMethods();
    bindFoot();
  }
  function footHTML() {
    const net = Number(state.active.outstanding), paid = paidNow(), valid = paid > 0;
    const submit = `<div class="foot-actions"><button class="btn" data-close>Cancel</button><button id="paySubmit" class="btn primary" ${valid ? '' : 'disabled'}>${I.card} ${C.submitLabel}</button></div><p class="secure">🔒 All transactions are secured and encrypted</p>`;
    if (C.drawer !== 'split') return submit;
    const remaining = net - paid;
    const status = remaining > 0 ? `<span>Remaining: ${money(remaining)}</span>` : remaining < 0 ? `<span class="surplus">Surplus ${money(-remaining)} will be collected</span>` : '<span class="surplus">Fully collected</span>';
    return `<div class="progress-info"><span>Paying now</span><strong style="float:right">${money(paid)} / ${money(net)}</strong><div class="progress-line"><span style="width:${net > 0 ? Math.min(100, paid / net * 100) : (paid > 0 ? 100 : 0)}%"></span></div>${status}<button id="equalSplit" style="float:right;border:0;background:transparent;color:#7d89a0;cursor:pointer">↶ Equal split</button></div>${submit}`;
  }
  function refreshFoot() { $('#drawerFoot').innerHTML = footHTML(); bindFoot(); }
  const amtField = (id, dataAttr, value, label, title) => `<div class="amount-wrap"><label for="${id}">${label} amount</label><div class="amount"><span>₹</span><input id="${id}" ${dataAttr} type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="${value > 0 ? value : ''}" aria-label="${title} amount"/></div></div>`;
  function splitMethod(key, title, sub, checked, value, amtLabel) {
    return `<section class="method ${checked ? 'selected' : ''}"><label class="method-head"><span class="m-ic">◧</span><span><strong>${title}</strong><span class="sub" style="display:block">${sub}</span></span><input type="checkbox" data-method="${key}" ${checked ? 'checked' : ''}/></label>${checked ? amtField(key + 'Amount', `data-amount="${key}"`, value, amtLabel, title) : ''}</section>`;
  }
  function radioMethod(m, p) {
    const sel = p.method === m.key;
    return `<section class="method radio ${sel ? 'selected' : ''}"><label class="method-head"><span class="m-ic">${m.key === 'cash' ? '$' : m.key === 'upi' ? '▤' : m.key === 'bank' ? '▦' : '✎'}</span><span><strong>${m.title}</strong><span class="sub" style="display:block">${m.sub}</span></span><input type="radio" name="paymethod" data-radio="${m.key}" ${sel ? 'checked' : ''}/></label>${sel ? amtField('mAmount', 'data-mamount', p.methodAmount, m.title, m.title) : ''}</section>`;
  }
  // typed digits update state + footer only — the input node is never re-rendered, so the caret stays put
  const readAmount = el => { const v = el.value.replace(/[^0-9.]/g, ''); if (v !== el.value) el.value = v; return Number(v) || 0; };
  function bindSplit() {
    $$('[data-method]').forEach(x => x.onchange = () => { state.pay[x.dataset.method] = x.checked; if (!x.checked) state.pay[x.dataset.method + 'Amount'] = 0; renderPayment(); });
    $$('[data-amount]').forEach(x => x.oninput = () => { state.pay[x.dataset.amount + 'Amount'] = readAmount(x); refreshFoot(); });
  }
  function bindMethods() {
    $$('[data-radio]').forEach(x => x.onchange = () => { state.pay.method = x.dataset.radio; renderPayment(); });
    const amt = $('#mAmount'); if (amt) amt.oninput = () => { state.pay.methodAmount = readAmount(amt); refreshFoot(); };
  }
  function bindFoot() {
    const eq = $('#equalSplit'); if (eq) eq.onclick = () => { const active = ['cod', 'online'].filter(k => state.pay[k]); if (!active.length) return; const net = Number(state.active.outstanding); const each = Math.floor(net / active.length * 100) / 100; active.forEach((k, i) => state.pay[k + 'Amount'] = i === active.length - 1 ? net - each * (active.length - 1) : each); renderPayment(); };
    $('#paySubmit')?.addEventListener('click', submitPay);
    bindClose();
  }
  // record the payment against the row: settle outstanding, bank the rest as advance, log the rows, recompute
  function applyPayment(r, entries, totalPaid) {
    const out = Number(r.outstanding), applied = Math.min(totalPaid, out), surplus = totalPaid - applied;
    let left = applied;
    entries.forEach((e, i) => { const amt = i === entries.length - 1 ? left : Math.round(applied * (e.amount / totalPaid)); left -= amt; if (amt > 0) (r.payments = r.payments || []).unshift({ method: e.method, date: todayStr(), amount: amt }); });
    r.collected = Number(r.collected) + applied;
    r.advance = Number(r.advance || 0) + surplus;
    r.outstanding = Math.max(0, out - applied);
  }
  function submitPay() {
    const r = state.active, p = state.pay, paid = paidNow();
    if (!(paid > 0)) return;
    const entries = C.drawer === 'split'
      ? [p.cod && Number(p.codAmount) > 0 ? { method: 'Cash', amount: Number(p.codAmount) } : null, p.online && Number(p.onlineAmount) > 0 ? { method: 'Online', amount: Number(p.onlineAmount) } : null].filter(Boolean)
      : [{ method: METHODS.find(m => m.key === p.method).title, amount: paid }];
    applyPayment(r, entries, paid);
    p.complete = true; p._paid = paid;
    state.expanded.add(r.id); state.sections.add(r.id + ':payments');
    renderSummary(); renderLedger(); renderPayment(); showToast(C.toastPay);
  }
  function bindClose() { $$('[data-close]').forEach(b => b.onclick = closeAll); }

  // ---- calendar (customer only) ----
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const displayDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  const displayFull = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  function renderCalendar() {
    const c = state.calendar, year = c.view.getFullYear(), month = c.view.getMonth(), first = new Date(year, month, 1), gridStart = new Date(year, month, 1 - first.getDay());
    $('#calendarTitle').textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    $('#calendarGrid').innerHTML = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); const iso = isoDate(d), outside = d.getMonth() !== month, inRange = c.start && c.end && iso > c.start && iso < c.end, selected = iso === c.start || iso === c.end; const hasRange = c.start && c.end; return `<button class="calendar-day ${outside ? 'outside ' : ''}${inRange ? 'in-range ' : ''}${hasRange && iso === c.start ? 'range-start ' : ''}${hasRange && iso === c.end ? 'range-end ' : ''}${selected ? 'selected ' : ''}" data-calendar-date="${iso}" role="gridcell" aria-label="${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}"><span>${d.getDate()}</span></button>`; }).join('');
    const status = $('#calendarStatus'); status.innerHTML = !c.start ? '<span>●</span><span>Select the <strong>start date</strong></span>' : !c.end ? `<span>●</span><span>Start: <strong>${displayDate(c.start)}</strong> · now select the end date</span>` : `<span>✓</span><span><strong>${displayDate(c.start)} – ${displayDate(c.end)}</strong> · ${Math.round((new Date(c.end) - new Date(c.start)) / 86400000) + 1} days</span>`;
    $$('[data-calendar-date]').forEach(b => b.onclick = e => {
      e.stopPropagation(); // re-rendering detaches this button; without this the outside-click handler would see a detached node and close the panel
      const date = b.dataset.calendarDate;
      if (!c.start || c.end) { c.start = date; c.end = ''; }
      else if (date < c.start) { c.end = c.start; c.start = date; }
      else { c.end = date; }
      if (c.start && c.end) { state.filter.from = c.start; state.filter.to = c.end; state.page = 1; renderLedger(); } // apply live once a full range is picked
      updateDateTrigger(); renderCalendar();
    });
  }
  function closeCalendar() { $('#datePanel')?.classList.add('hide'); $('#dateToggle')?.setAttribute('aria-expanded', 'false'); }
  function updateDateTrigger() {
    const c = state.calendar, from = state.filter.from, to = state.filter.to, active = from && to;
    const label = $('#dateToggleLabel'), badge = $('#dateBadge'), toggle = $('#dateToggle'); if (!toggle) return;
    label.textContent = (c.start && !c.end) ? `${displayFull(c.start)} – …` : active ? `${displayFull(from)} – ${displayFull(to)}` : 'Filter by date range';
    toggle.classList.toggle('date-active', !!active);
    if (active) { const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1; badge.textContent = days; badge.classList.remove('hide'); } else badge.classList.add('hide');
  }

  // ---- init ----
  async function init() {
    try { const data = await fetch(SEED).then(r => { if (!r.ok) throw Error('seed'); return r.json(); }); state.rows = data.rows || data.customers || []; }
    catch (e) { $('#ledger').innerHTML = '<div class="acct"><div class="empty">Unable to load prototype data. Serve the discovery folder over HTTP.</div></div>'; return; }
    renderSummary(); renderLedger();
    $('#summary').addEventListener('scroll', updateSummaryThumb, { passive: true }); addEventListener('resize', updateSummaryThumb);
    $('#search').oninput = e => { state.filter.search = e.target.value; state.page = 1; renderLedger(); };

    // mobile hamburger
    const closeNav = () => { document.body.classList.remove('nav-open'); $('#navBackdrop').classList.add('hide'); };
    $('#menuBtn')?.addEventListener('click', () => { const open = document.body.classList.toggle('nav-open'); $('#navBackdrop').classList.toggle('hide', !open); });
    $('#navBackdrop')?.addEventListener('click', closeNav);
    $$('.sidebar a').forEach(a => a.addEventListener('click', closeNav));

    if (C.showDate) {
      const n = debtors().length; const oc = $('#outstandingCount'); if (oc) oc.textContent = n;
      updateDateTrigger(); renderCalendar();
      $('#dateToggle').onclick = () => { const p = $('#datePanel'), willOpen = p.classList.contains('hide'); if (willOpen) { state.calendar.start = state.filter.from; state.calendar.end = state.filter.to; if (state.filter.from) { const d = new Date(state.filter.from + 'T00:00:00'); state.calendar.view = new Date(d.getFullYear(), d.getMonth(), 1); } renderCalendar(); } p.classList.toggle('hide'); $('#dateToggle').setAttribute('aria-expanded', String(willOpen)); };
      $('#calendarPrev').onclick = () => { state.calendar.view = new Date(state.calendar.view.getFullYear(), state.calendar.view.getMonth() - 1, 1); renderCalendar(); };
      $('#calendarNext').onclick = () => { state.calendar.view = new Date(state.calendar.view.getFullYear(), state.calendar.view.getMonth() + 1, 1); renderCalendar(); };
      $('#dateApply').onclick = () => { if (!state.calendar.start) return showToast('Select a start date'); state.filter.from = state.calendar.start; state.filter.to = state.calendar.end || state.calendar.start; state.page = 1; updateDateTrigger(); closeCalendar(); renderLedger(); };
      $('#dateReset').onclick = () => { state.calendar.start = ''; state.calendar.end = ''; state.filter.from = ''; state.filter.to = ''; state.page = 1; updateDateTrigger(); renderCalendar(); renderLedger(); };
      document.addEventListener('click', e => { if (!e.target.closest('.date-wrap')) closeCalendar(); });
    }
    if (C.showBatch) {
      $('#remindersOpen').onclick = () => { state.selected.clear(); openReminder(); };
      $('#reminderSearch').oninput = renderReminder;
      $('#selectAll').onchange = e => { state.selected = e.target.checked ? new Set(debtors().map(r => r.id)) : new Set(); renderReminder(); };
      $('#sendReminders').onclick = () => { const c = state.selected.size; closeAll(); showToast(`${plural(c, 'WhatsApp reminder')} sent`); };
    }
    $('#overlay').onclick = closeAll; bindClose();
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCalendar(); closeAll(); closeNav(); } });

    const params = new URLSearchParams(location.search), demo = params.get('state');
    if (demo === 'reminders' && C.showBatch) openReminder();
    if (demo === 'payment') openPayment((kind === 'supplier' ? state.rows[0] : (debtors()[0] || state.rows[0]))?.id);
    if (demo === 'details') { const first = filtered()[0]; if (first) { state.expanded.add(first.id); state.sections.add(first.id + ':orders'); state.sections.add(first.id + ':payments'); renderLedger(); } }
    if (demo === 'calendar' && C.showDate) $('#dateToggle').click();
    if (params.get('nav') === 'open') $('#menuBtn').click();
    if (params.get('viewport') === 'mobile' && innerWidth > 760) showToast('Resize below 760px to preview the mobile layout');
  }
  init();
})();
