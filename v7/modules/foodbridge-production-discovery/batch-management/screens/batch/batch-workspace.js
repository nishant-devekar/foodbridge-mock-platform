// batch-workspace.js — ported from development/frontend/src/components/batch/BatchList.tsx +
// batchUi.tsx, as they exist at the v7 fork point (2026-08-10). Same structure, same classNames,
// same behaviour as the v6 baseline this file extends, plus the drift since 2026-07-28:
//
// - Rejected is now its own 5th section/tab (not folded into Needs Attention) — a terminal
//   dead-end, not something awaiting resolution. bucketOf()/RejectedCard/rowKebabActions all
//   branch on it explicitly (see batch-shared.js's bucketOf).
// - Default tab is "All" unconditionally (no more "smart default" landing on whichever of
//   attention/inprogress/waiting has something first — human report: that landed on "Needs
//   Attention" by surprise).
// - Search now shares one `.list-toolbar` row with a new Planned Date filter (A-142), both inside
//   the same `.ws-card` as the table/list below them (A-138).
// - The desktop table gets an explicit <colgroup> column-width split (A-140) instead of relying on
//   table-layout:auto, which let "Batch" silently absorb all the leftover width.
// - The "View all (N) / Show less" cap is gone (A-137) — every batch in the active section renders
//   directly, no truncation, no expand/collapse.
// - Inventory Sync badge (SSOT-2 addendum-0038) renders next to the status badge, mirroring the
//   Settlement Required badge's own slot — which itself is now commented out (human direction,
//   hidden not removed) rather than rendered.
(function () {
  "use strict";

  const SECTIONS = [
    { key: "attention", label: "Needs Attention", emptyMsg: "No batches need attention" },
    { key: "rejected", label: "Rejected", emptyMsg: "No rejected batches" },
    { key: "inprogress", label: "In Progress", emptyMsg: "No batches in progress" },
    { key: "waiting", label: "Waiting to Start", emptyMsg: "No batches waiting to start" },
    { key: "done", label: "Completed", emptyMsg: "No completed batches" },
  ];

  const state = {
    batches: null,
    searchQuery: "",
    plannedDateFilter: "",
    activeFilter: "all", // "all" | SectionKey — always defaults to "all" now (no smart-default)
  };

  function sortedList() {
    const q = state.searchQuery.trim().toLowerCase();
    return (state.batches ?? [])
      .filter((b) => !q || b.batchNumber.toLowerCase().includes(q) || b.displayName.toLowerCase().includes(q))
      .filter((b) => !state.plannedDateFilter || (b.plannedDate || "").slice(0, 10) === state.plannedDateFilter)
      // A-119: latest-created first — batchNumber ("PB-2026-00183") is a zero-padded per-year sequence.
      .sort((a, b) => (a.batchNumber < b.batchNumber ? 1 : a.batchNumber > b.batchNumber ? -1 : 0));
  }

  function bySection() {
    const map = { attention: [], rejected: [], inprogress: [], waiting: [], done: [] };
    for (const b of sortedList()) map[bucketOf(b.statusLabel, b.expectedFinishDate)].push(b);
    return map;
  }

  function openDetail(id) {
    window.location.href = "batch-detail.html?id=" + encodeURIComponent(id);
  }
  function openCreate() {
    window.location.href = "create-batch.html";
  }
  function openEdit(id) {
    window.location.href = "create-batch.html?edit=" + encodeURIComponent(id);
  }

  // ── row/card kebab actions — matches BatchList.tsx's kebabActionsFor exactly ──
  function kebabActionsFor(b) {
    const actions = [{ label: "View details", onClick: () => openDetail(b.id) }];
    const bucket = bucketOf(b.statusLabel, b.expectedFinishDate);
    if (b.stateId === "planned") {
      actions.push({ label: "Start", onClick: () => openDetail(b.id) });
      actions.push({ label: "Edit batch", onClick: () => openEdit(b.id) });
    } else if (bucket === "attention") {
      actions.push({ label: b.statusLabel === "On Hold" ? "Resolve" : "Review", onClick: () => openDetail(b.id) });
    } else if (b.stateId === "completed") {
      actions.push({ label: "Close batch", danger: true, onClick: () => openDetail(b.id) });
    }
    return actions;
  }

  // ── card renderers (mirrors OpCard + Attention/Rejected/InProgress/Waiting/DoneCard) — mobile-only. ──
  function opCard(b, sectionCls, iconCls, iconHtml, dateHtml, ctaLabel, ctaCls, reasonTag, hideKebab) {
    const inventoryBadge = b.inventorySyncStatus && b.inventorySyncStatus !== "synced"
      ? el("span", { class: "inventory-sync-badge" + (b.inventorySyncStatus === "failed" ? " failed" : "") },
          b.inventorySyncStatus === "failed" ? "Inventory Sync Failed" : "Inventory Pending")
      : null;
    return el("div", { class: "op-card " + sectionCls, onclick: () => openDetail(b.id) },
      el("div", { class: "op-row-icon " + iconCls, html: iconHtml }),
      el("div", { class: "op-main" },
        el("div", { class: "op-name" }, b.displayName),
        el("div", { class: "op-number" }, b.batchNumber)),
      el("div", { class: "op-progout" }, el("span", { class: "op-qty-text" }, `${b.batchSize ?? "—"} ${b.batchUnit ?? "kg"}`)),
      el("div", { class: "op-meta" }, el("div", { class: "op-date" }, dateHtml)),
      el("div", { class: "op-status-cell" },
        el("span", { class: "badge " + statusBadgeClass(b.statusLabel) }, b.statusLabel),
        // dev addendum — human direction: hide the Settlement Required badge for now (commented
        // out, not removed — re-enable by uncommenting this line).
        // b.settlementRequired ? el("span", { class: "settlement-badge" }, "Settlement Required") : null,
        inventoryBadge,
        reasonTag ? el("span", { class: "op-reason-tag" }, reasonTag) : null),
      el("div", { class: "op-cta" },
        el("button", { type: "button", class: ctaCls, onclick: (e) => { e.stopPropagation(); openDetail(b.id); } }, ctaLabel)),
      hideKebab ? null : KebabButton(b.id, "op-kebab", `More actions for ${b.batchNumber}`, kebabActionsFor(b)));
  }
  function dateNode(iconHtml, label) {
    const span = document.createElement("span");
    span.innerHTML = iconHtml;
    const wrap = document.createElement("span");
    wrap.appendChild(span);
    wrap.appendChild(document.createTextNode(" " + label));
    return wrap;
  }
  function cardFor(b) {
    const bucket = bucketOf(b.statusLabel, b.expectedFinishDate);
    if (bucket === "attention") {
      return opCard(b, "op-na", "oi-red", IconPackage(), dateNode(IconCalendar(), fmtDateNice(b.expectedFinishDate)),
        "Resolve", "btn btn-primary btn-sm", attentionReason(b.statusLabel, b.expectedFinishDate));
    }
    if (bucket === "rejected") {
      // Terminal, muted/gray, no kebab — a dead end, not something awaiting resolution.
      return opCard(b, "op-na op-na-terminal", "oi-gray", IconPackage(), dateNode(IconCalendar(), fmtDateNice(b.expectedFinishDate)),
        "View Details", "btn btn-sm", null, true);
    }
    if (bucket === "inprogress") {
      return opCard(b, "op-inprogress", "oi-blue", IconPackage(), dateNode(IconCalendar(), fmtDateNice(b.expectedFinishDate)), "Open", "btn btn-outline-blue btn-sm");
    }
    if (bucket === "waiting") {
      return opCard(b, "op-waiting", "oi-orange", IconClock(), dateNode(IconCalendar(), fmtDateNice(b.plannedDate)), "Open", "btn btn-outline-orange btn-sm");
    }
    return opCard(b, "op-done", "oi-green", IconPackageCheck(), dateNode(IconCalendar(), fmtDateNice(b.plannedDate)), "View", "btn btn-outline-green btn-sm");
  }

  // ── desktop table (ported from BatchList.tsx's HomeRow/WorkspaceTable) ──
  function rowAction(b) {
    const bucket = bucketOf(b.statusLabel, b.expectedFinishDate);
    const go = (e) => { e.stopPropagation(); openDetail(b.id); };
    if (b.stateId === "planned") return el("button", { type: "button", class: "btn btn-primary btn-sm", onclick: go }, "Start");
    if (b.stateId === "rejected") return el("button", { type: "button", class: "btn btn-sm", onclick: go }, "View Details");
    if (bucket === "attention") return el("button", { type: "button", class: "btn btn-danger btn-sm", onclick: go }, b.statusLabel === "On Hold" ? "Resolve" : "Review");
    if (b.stateId === "completed") return el("button", { type: "button", class: "btn btn-primary btn-sm", onclick: go }, "Close");
    if (b.stateId === "closed") return el("button", { type: "button", class: "btn btn-sm", onclick: go }, "View");
    return el("button", { type: "button", class: "btn btn-sm", onclick: go }, "Update");
  }

  function homeRowTr(b, now) {
    const bucket = bucketOf(b.statusLabel, b.expectedFinishDate);
    const icon = rowIcon(b.statusLabel, b.expectedFinishDate);
    const due = dueLabel(b.expectedFinishDate, now);
    const reason = attentionReasonDetail(b.statusLabel, b.expectedFinishDate);
    const tint = icon.cls === "attn" ? "tint-attn" : icon.cls === "wait" ? "tint-wait" : "";
    const inventoryBadge = b.inventorySyncStatus && b.inventorySyncStatus !== "synced"
      ? el("span", { class: "inventory-sync-badge" + (b.inventorySyncStatus === "failed" ? " failed" : "") },
          b.inventorySyncStatus === "failed" ? "Inventory Sync Failed" : "Inventory Pending")
      : null;
    return el("tr", {
      class: tint, tabindex: "0", role: "button",
      "aria-label": `${b.displayName}, ${b.batchNumber}, ${b.statusLabel}`,
      onclick: () => openDetail(b.id),
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(b.id); } },
    },
      el("td", { class: "ws-home-td-batch" },
        el("div", { class: "ws-home-td-batch-inner" },
          el("div", { class: "ws-home-row-icon " + icon.cls, "aria-hidden": "true" }, icon.glyph),
          el("div", { class: "ws-home-row-main" },
            el("div", { class: "ws-home-row-name" }, b.displayName),
            el("div", { class: "ws-home-row-tags" },
              el("span", { class: "ws-home-row-num" }, b.batchNumber),
              bucket === "attention" ? el("span", { class: "ws-home-tag " + icon.cls }, b.statusLabel) : null,
              // dev addendum — human direction: hide the Settlement Required badge for now
              // (commented out, not removed — re-enable by uncommenting this line).
              // b.settlementRequired ? el("span", { class: "settlement-badge" }, "Settlement Required") : null,
              inventoryBadge),
            reason ? el("div", { class: "ws-home-row-reason" }, reason) : null))),
      el("td", { class: "ws-home-td-qty num" }, `${b.batchSize ?? "—"} ${b.batchUnit ?? "kg"}`, el("span", { class: "u" }, "Batch Size")),
      el("td", { class: "ws-home-td-due" },
        el("div", { class: "d " + due.cls }, due.text),
        el("div", { class: "sub" }, fmtDateNice(b.plannedDate)),
        el("div", { class: "sub" }, "Expected " + fmtDateNice(b.expectedFinishDate))),
      el("td", { class: "ws-home-td-op" },
        el("div", { class: "ws-home-td-op-inner" },
          el("div", { class: "ws-home-avatar", "aria-hidden": "true" }, initials(b.operator)),
          el("div", { class: "ws-home-row-op-meta" },
            el("div", { class: "ws-home-row-op-name" }, b.operator || "Unassigned"),
            el("div", { class: "ws-home-row-op-label" }, "Operator")))),
      el("td", { class: "ws-home-td-actions", onclick: (e) => e.stopPropagation() },
        el("div", { class: "ws-home-td-actions-inner" },
          rowAction(b),
          b.stateId !== "rejected" ? KebabButton(b.id, "ws-home-row-kebab", `More actions for ${b.batchNumber}`, kebabActionsFor(b)) : null)));
  }

  const TABLE_COLUMNS = ["Batch", "Size", "Due", "Operator", "Actions"];
  function tableFor(items) {
    const now = new Date();
    // A-140: explicit column shares via <colgroup>, not per-cell width classes — table-layout:fixed
    // reads the FIRST row's own widths (thead here); without this "Batch" silently absorbed all the
    // leftover width on a wide screen, bunching Size/Due/Operator/Actions at the right edge.
    const colgroup = el("colgroup", {},
      el("col", { class: "ws-col-batch" }), el("col", { class: "ws-col-qty" }), el("col", { class: "ws-col-due" }),
      el("col", { class: "ws-col-op" }), el("col", { class: "ws-col-actions" }));
    const thead = el("thead", {}, el("tr", {}, ...TABLE_COLUMNS.map((label, i) =>
      el("th", { class: i === 1 ? "num" : i === TABLE_COLUMNS.length - 1 ? "ws-th-static" : "" }, label))));
    const table = el("table", { class: "ws-table ws-home-table" }, colgroup, thead, el("tbody", {}, ...items.map((b) => homeRowTr(b, now))));
    return el("div", { class: "op-table-wrap" }, el("div", { class: "ws-table-scroll" }, table));
  }

  // ── section body: the real table on desktop, cards on mobile — CSS toggles which is visible. ──
  function sectionBody(items) {
    return el("div", {},
      tableFor(items),
      el("div", { class: "op-card-list" }, ...items.map((b) => cardFor(b))));
  }

  // No section heading — the active tab immediately above already names this section and shows its
  // count. A-137: the "View all (N) / Show less" cap is gone too — every batch in the active
  // section renders directly now, no truncation.
  function group(section, items) {
    const body = items.length === 0
      ? el("div", { class: "op-empty" }, el("span", { class: "op-empty-ic" }, "✓"), section.emptyMsg)
      : sectionBody(items);
    return el("div", { class: "op-section", id: "section-" + section.key }, body);
  }

  function render() {
    const sections = bySection();
    const counts = {
      attention: sections.attention.length,
      rejected: sections.rejected.length,
      inprogress: sections.inprogress.length,
      waiting: sections.waiting.length,
      done: sections.done.length,
    };
    const allCount = counts.attention + counts.rejected + counts.inprogress + counts.waiting + counts.done;
    const tabs = [
      { key: "all", label: "All", count: allCount, cls: "section-tab-all" },
      { key: "attention", label: "Needs Attention", count: counts.attention, cls: "section-tab-attention" },
      { key: "rejected", label: "Rejected", count: counts.rejected, cls: "section-tab-rejected" },
      { key: "inprogress", label: "In Progress", count: counts.inprogress, cls: "section-tab-inprogress" },
      { key: "waiting", label: "Waiting to Start", count: counts.waiting, cls: "section-tab-waiting" },
      { key: "done", label: "Completed", count: counts.done, cls: "section-tab-done" },
    ];
    const list = sortedList();
    const overviewDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    function setFilter(key) { state.activeFilter = key; render(); }

    const kpiRow = el("div", { class: "kpi-row" }, ...tabs.map((t) =>
      el("button", { type: "button", class: "section-tab " + t.cls + (state.activeFilter === t.key ? " active" : ""), onclick: () => setFilter(t.key) },
        t.label, el("span", { class: "section-tab-count" }, String(t.count)))));

    const chipRow = el("div", { class: "chip-row" }, ...tabs.map((t) =>
      el("button", { type: "button", class: "kpi-chip kpi-chip-" + t.key + (state.activeFilter === t.key ? " active" : ""), onclick: () => setFilter(t.key) },
        t.label, t.key !== "all" ? el("span", { class: "kpi-chip-count" }, String(t.count)) : null)));

    // A-138: search shares one card with the table. A-142: a Planned Date filter now shares that
    // same toolbar row, pinned to the right (fixed-width) while search fills the rest.
    const listToolbar = el("div", { class: "list-toolbar" },
      el("div", { class: "tb-search list-search" + (state.searchQuery ? " has-value" : "") },
        el("span", { class: "ic", html: IconSearch() }),
        el("input", {
          placeholder: "Search this tab by product or batch number...",
          value: state.searchQuery,
          oninput: (e) => { state.searchQuery = e.target.value; render(); },
        }),
        el("button", { type: "button", class: "clear-btn", "aria-label": "Clear search", onclick: () => { state.searchQuery = ""; render(); }, html: IconClose() })),
      el("div", { class: "list-date-filter" + (state.plannedDateFilter ? " has-value" : "") },
        el("span", { class: "ic", html: IconCalendar() }),
        !state.plannedDateFilter ? el("span", { class: "df-placeholder" }, "Filter by Planned Date") : null,
        el("input", {
          type: "date", "aria-label": "Planned Date", value: state.plannedDateFilter,
          oninput: (e) => { state.plannedDateFilter = e.target.value; render(); },
        }),
        state.plannedDateFilter
          ? el("button", { type: "button", class: "clear-btn", "aria-label": "Clear date filter", onclick: () => { state.plannedDateFilter = ""; render(); }, html: IconClose() })
          : null));

    let listBody;
    if (state.batches === null) {
      listBody = el("p", { class: "muted small", style: "padding:20px" }, "Loading batches…");
    } else if (state.activeFilter === "all") {
      // A-123: "All" is a flat, latest-first list — not the 5 sections stacked.
      listBody = list.length === 0
        ? el("div", { class: "op-empty" }, el("span", { class: "op-empty-ic" }, "✓"), "No batches yet")
        : sectionBody(list);
    } else {
      const visible = SECTIONS.filter((s) => s.key === state.activeFilter);
      listBody = el("div", {}, ...visible.map((s) => group(s, sections[s.key])));
    }

    const wsCard = el("div", { class: "ws-card" }, listToolbar, listBody);
    const opListPane = el("div", { class: "op-list-pane" }, wsCard);
    const workspace = el("div", { class: "workspace2" }, opListPane);

    const bottomNav = el("nav", { class: "bottom-nav" },
      el("button", { type: "button", class: "bn-item bn-item-primary", onclick: openCreate },
        el("span", { html: IconPlus() }), el("span", {}, "Create Batch")));

    const content = el("div", { class: "content2" },
      el("div", { class: "overview-row" },
        el("span", { class: "overview-date" }, "Today, " + overviewDate),
        el("div", { style: "display:flex;gap:10px;position:relative" },
          el("button", { class: "btn btn-primary", onclick: openCreate }, "+ New Batch"))),
      el("div", { class: "kpi-wrap" }, kpiRow),
      chipRow,
      workspace,
      bottomNav);

    const root = document.getElementById("content2-root");
    root.innerHTML = "";
    root.appendChild(content);
    closeKebabMenu();
  }

  MockApi.listBatches().then((batches) => {
    state.batches = batches;
    render();
  });
})();
