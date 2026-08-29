// semi-finished-products.js — ported from
// development/frontend/src/components/batch/SemiFinishedProductsScreen.tsx (SSOT-2 addendum-0043).
// Read-only: no drawer, no row actions. `measurement` is "<unit>-Box-Pallet" (addendum-095's own
// ladder convention) — only the first token is ever meaningful.
(function () {
  "use strict";

  const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

  const state = {
    rows: null,
    search: "",
    debouncedSearch: "",
    searching: false,
    rowsPerPage: 10,
    page: 0,
    debounceTimer: null,
  };

  function baseUnitOf(measurement) {
    return (measurement || "").split("-")[0] || measurement;
  }

  function statusBadge(status) {
    return status === "ACTIVE"
      ? el("span", { class: "ps-status-open" }, el("span", { class: "dot" }), "Active")
      : el("span", { class: "ps-status-open", style: "color:var(--fb-text-placeholder)" }, el("span", { class: "dot", style: "background:var(--fb-text-placeholder)" }), "Inactive");
  }

  function row(r) {
    return el("div", { class: "ps-row" },
      el("div", { class: "ps-row-grid" },
        el("div", { style: "min-width:0" }, el("div", { class: "ps-row-name" }, r.name), el("div", { class: "ps-row-meta" }, "📦 " + r.batchNumber)),
        el("span", { class: "ps-updated" }, `${r.stock} ${baseUnitOf(r.measurement)}`),
        statusBadge(r.status),
        el("span", { class: "ps-updated" }, fmtDateTimeNice(r.createdAt)),
        el("span", {})),
      el("div", { class: "ps-row-mobile" },
        el("div", { style: "flex:1;min-width:0" },
          el("div", { class: "ps-row-name" }, r.name),
          el("div", { class: "ps-row-meta" }, "📦 " + r.batchNumber),
          el("div", { style: "display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center" },
            el("span", { class: "ps-badge" }, `${r.stock} ${baseUnitOf(r.measurement)}`),
            statusBadge(r.status)),
          el("div", { class: "ps-updated", style: "margin-top:6px" }, "Captured " + fmtDateTimeNice(r.createdAt)))));
  }

  function emptyState(searching) {
    if (searching) {
      return el("div", { class: "ps-empty" },
        el("div", { class: "ps-empty-icon" }, "🔍"),
        el("div", { class: "ps-empty-title" }, "No semi-finished products match your search"),
        el("div", { class: "ps-empty-desc" }, "Try a different product name or batch number — or clear the search."),
        el("button", { type: "button", class: "ps-empty-action", onclick: () => { state.search = ""; state.debouncedSearch = ""; render(); load(); } }, "Clear search"));
    }
    return el("div", { class: "ps-empty" },
      el("div", { class: "ps-empty-icon" }, "🧺"),
      el("div", { class: "ps-empty-title" }, "No semi-finished products yet"),
      el("div", { class: "ps-empty-desc" }, "A batch's bulk/leftover residual shows up here once it's captured during Inventory Sync."));
  }

  async function load() {
    state.rows = await MockApi.listSemiFinishedProducts(state.debouncedSearch || undefined);
    render();
  }

  function onSearchInput(v) {
    state.search = v;
    state.searching = true;
    render();
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.debouncedSearch = state.search;
      state.searching = false;
      state.page = 0;
      render();
      load();
    }, 300);
  }

  function render() {
    const rows = state.rows;
    const searchRow = el("div", { class: "ps-search" }, "🔍",
      el("input", { type: "text", placeholder: "Search by product name or batch number…", value: state.search, oninput: (e) => onSearchInput(e.target.value) }),
      state.searching ? el("span", { class: "ps-search-spin" }, "⟳") : null,
      state.search && !state.searching ? el("button", { type: "button", class: "ps-search-clear", onclick: () => onSearchInput("") }, "Clear") : null);

    const thead = el("div", { class: "ps-thead" }, el("span", {}, "Product"), el("span", {}, "Stock"), el("span", {}, "Status"), el("span", {}, "Captured"), el("span", {}));

    let body;
    if (rows === null) {
      body = el("div", { class: "ps-table-card" }, thead);
    } else if (rows.length === 0) {
      body = el("div", { class: "ps-table-card" }, emptyState(!!state.debouncedSearch));
    } else {
      const totalPages = Math.max(1, Math.ceil(rows.length / state.rowsPerPage));
      const effectivePage = Math.min(state.page, totalPages - 1);
      const start = effectivePage * state.rowsPerPage;
      const visible = rows.slice(start, start + state.rowsPerPage);
      body = el("div", { class: "ps-table-card" },
        thead,
        el("div", {}, ...visible.map((r) => row(r))),
        el("div", { class: "ps-pagination" },
          el("span", {}, `Showing ${rows.length === 0 ? 0 : start + 1} to ${start + visible.length} of ${rows.length} record${rows.length === 1 ? "" : "s"}`),
          el("div", { style: "display:flex;align-items:center;gap:14px" },
            el("label", { style: "display:flex;align-items:center;gap:8px" },
              "Rows per page:",
              el("select", {
                onchange: (e) => { state.rowsPerPage = Number(e.target.value); state.page = 0; render(); },
              }, ...ROWS_PER_PAGE_OPTIONS.map((n) => el("option", { value: n, selected: n === state.rowsPerPage || undefined }, String(n))))),
            el("div", { class: "ps-page-nav" },
              el("button", { type: "button", class: "ps-page-btn", "aria-label": "Previous page", disabled: effectivePage === 0 || undefined, onclick: () => { state.page = effectivePage - 1; render(); } }, "‹"),
              el("span", { class: "ps-page-label" }, `Page ${effectivePage + 1} of ${totalPages}`),
              el("button", { type: "button", class: "ps-page-btn", "aria-label": "Next page", disabled: effectivePage >= totalPages - 1 || undefined, onclick: () => { state.page = effectivePage + 1; render(); } }, "›")))));
    }

    const root = document.getElementById("sfp-root");
    root.innerHTML = "";
    root.appendChild(el("div", { class: "ps-page" }, searchRow, body));
  }

  render();
  load();
})();
