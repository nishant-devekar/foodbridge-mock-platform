// semi-finished-products.js — ported from
// development/frontend/src/components/batch/SemiFinishedProductsScreen.tsx (SSOT-2 addendum-0043).
// Read-only: no drawer, no row actions. `measurement` is "<unit>-Box-Pallet" (addendum-095's own
// ladder convention) — only the first token is ever meaningful.
//
// Freezer Stock (Production integration, 26 Sep 2026): with the production store loaded,
// a row is one big bag in the freezer — what the last step on the floor filled and what
// packing takes, oldest first — with its kg left, date made and use-by. Without it, the
// original semi-finished list.
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

  const FREEZER = !!window.FB_PRODUCTION;
  function daysTo(iso) { return Math.round((new Date(iso).getTime() - Date.now()) / 86400000); }
  function bagStatus(r) {
    const d = daysTo(r.useBy);
    if (d < 0) return el("span", { class: "ps-status-open", style: "color:#b91c1c" }, el("span", { class: "dot", style: "background:#b91c1c" }), "Past use-by");
    if (d <= 30) return el("span", { class: "ps-status-open", style: "color:#b45309" }, el("span", { class: "dot", style: "background:#b45309" }), `Use in ${d} days`);
    return el("span", { class: "ps-status-open" }, el("span", { class: "dot" }), r.first ? "Packs next" : "In freezer");
  }
  function bagRow(r) {
    const made = new Date(r.madeAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const useBy = new Date(r.useBy).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    return el("div", { class: "ps-row" },
      el("div", { class: "ps-row-grid" },
        el("div", { style: "min-width:0" }, el("div", { class: "ps-row-name" }, `${r.product} · bag ${r.bagNo}`), el("div", { class: "ps-row-meta" }, "🧊 " + r.batchNumber)),
        el("span", { class: "ps-updated" }, `${r.remaining} of ${r.kg} kg`),
        bagStatus(r),
        el("span", { class: "ps-updated" }, `Made ${made} · use by ${useBy}`),
        el("span", {})),
      el("div", { class: "ps-row-mobile" },
        el("div", { style: "flex:1;min-width:0" },
          el("div", { class: "ps-row-name" }, `${r.product} · bag ${r.bagNo}`),
          el("div", { class: "ps-row-meta" }, "🧊 " + r.batchNumber),
          el("div", { style: "display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center" },
            el("span", { class: "ps-badge" }, `${r.remaining} of ${r.kg} kg`), bagStatus(r)),
          el("div", { class: "ps-updated", style: "margin-top:6px" }, `Made ${made} · use by ${useBy}`))));
  }
  function summary() {
    const rows = window.FB_PRODUCTION.read((D, d) => d.recipeOrder.map((rid) => {
      const bags = D.bagsFIFO(rid);
      return { name: D.book(rid).name, kg: D.inFreezer(rid), bags: bags.length, oldest: bags[0] };
    }));
    return el("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:14px" },
      ...rows.map((r) => el("div", { style: "background:#fff;border:1px solid var(--fb-border);border-radius:12px;padding:14px 16px" },
        el("div", { style: "font-size:13px;color:var(--fb-text-muted)" }, r.name),
        el("div", { style: "font-size:22px;font-weight:700;margin-top:2px" }, `${Math.round(r.kg * 10) / 10} kg`),
        el("div", { style: "font-size:12px;color:var(--fb-text-muted);margin-top:2px" }, r.bags ? `${r.bags} bag${r.bags > 1 ? "s" : ""} · packs next from ${r.oldest.bagNo}` : "No bags — make a batch"))));
  }

  function row(r) {
    if (FREEZER) return bagRow(r);
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
      el("div", { class: "ps-empty-title" }, FREEZER ? "The freezer is empty" : "No semi-finished products yet"),
      el("div", { class: "ps-empty-desc" }, FREEZER ? "Bags go in when a batch's last step on the floor fills them." : "A batch's bulk/leftover residual shows up here once it's captured during Inventory Sync."));
  }

  async function load() {
    if (FREEZER) {
      const q = (state.debouncedSearch || "").trim().toLowerCase();
      state.rows = window.FB_PRODUCTION.read((D, d) => {
        const out = [];
        d.recipeOrder.forEach((rid) => D.bagsFIFO(rid).forEach((g, i) => out.push({ ...g, first: i === 0 })));
        return out.filter((g) => !q || g.product.toLowerCase().includes(q) || g.batchNumber.toLowerCase().includes(q) || g.bagNo.includes(q));
      });
      render();
      return;
    }
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
      el("input", { type: "text", placeholder: FREEZER ? "Search by product, batch or bag number…" : "Search by product name or batch number…", value: state.search, oninput: (e) => onSearchInput(e.target.value) }),
      state.searching ? el("span", { class: "ps-search-spin" }, "⟳") : null,
      state.search && !state.searching ? el("button", { type: "button", class: "ps-search-clear", onclick: () => onSearchInput("") }, "Clear") : null);

    const thead = FREEZER
      ? el("div", { class: "ps-thead" }, el("span", {}, "Bag"), el("span", {}, "Kg left"), el("span", {}, "Status"), el("span", {}, "Made · use-by"), el("span", {}))
      : el("div", { class: "ps-thead" }, el("span", {}, "Product"), el("span", {}, "Stock"), el("span", {}, "Status"), el("span", {}, "Captured"), el("span", {}));

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
    root.appendChild(el("div", { class: "ps-page" }, FREEZER ? summary() : null, searchRow, body));
  }

  render();
  load();
  window.addEventListener("storage", (e) => { if (FREEZER && e.key === window.FB_PRODUCTION.KEY) load(); });
})();
