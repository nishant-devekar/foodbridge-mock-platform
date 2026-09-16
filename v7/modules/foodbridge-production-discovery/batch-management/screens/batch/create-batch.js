// create-batch.js — ported from development/frontend/src/components/batch/CreateBatchDrawer.tsx
// + ProductionBatchForm.tsx + mixEngine.ts, as they exist at the v7 fork point (2026-08-10). Same
// two-stage Production Batch / SKU Planning form, A-127 multi-version select, A-129 required
// Planned Date, A-113 date-order validation, the real ratio⇄weight⇄qty mix engine — plus two
// deltas since the v6 freeze:
// - Recipe search now filters to published-only recipes (MockApi.listRecipes()) — a draft recipe
//   isn't shown at all anymore, not shown-disabled with a "Draft" chip the way v6's A-060 did.
// - Operator (SSOT-2 addendum-0040) is sourced from the real staff roster via the shared
//   OperatorPicker, not a free-text "Current User" input.
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const editBatchId = params.get("edit") || undefined;
  const isEdit = !!editBatchId;
  const r2 = (n) => Math.round(n * 100) / 100;

  const state = {
    // CreateBatchDrawer-level
    editing: null,        // the batch being edited, once loaded
    recipeId: undefined,
    versionId: undefined,
    changingRecipe: !isEdit,
    recipeQuery: "",
    recipes: null,        // null = not loaded yet
    dirty: false,
    confirmingClose: false,

    // ProductionBatchForm-level
    sub: "batch",          // "batch" | "sku"
    pickedVersionId: undefined,
    header: null,           // RecipeHeaderVM, once resolved
    headerLoading: false,
    packagingOptions: null, // PackagingLineVM[], once resolved
    batchSize: "",
    operator: { name: "" }, // SSOT-2 addendum-0040 — {id?, name} via OperatorPicker
    plannedDate: "",
    expectedFinishDate: "",
    mix: null,              // MixRow[] | null
    drafts: {},
    fieldErrors: {},
    confirming: false,
    busy: false,
    error: null,
  };

  function markTouched() { state.dirty = true; }

  function requestClose() {
    if (state.dirty) { state.confirmingClose = true; render(); }
    else goClose();
  }
  function goClose() {
    window.location.href = isEdit ? "batch-detail.html?id=" + encodeURIComponent(editBatchId) : "batch-workspace.html";
  }
  function goCreated(id) {
    window.location.href = "batch-detail.html?id=" + encodeURIComponent(id);
  }

  function selectRecipe(id, name) {
    state.recipeId = id;
    state.versionId = undefined;
    state.changingRecipe = false;
    state.recipeQuery = name;
    render();
    loadHeaderAndPackaging();
  }

  function effectiveVersionId() { return state.versionId ?? state.pickedVersionId; }
  function resolvedVersionId() {
    return effectiveVersionId() ?? (state.editing && state.editing.recipeVersionId) ?? (state.header && state.header.activeVersionId);
  }

  async function loadHeaderAndPackaging() {
    if (!state.recipeId) return;
    state.headerLoading = true;
    render();
    state.header = await MockApi.getRecipeHeader(state.recipeId, effectiveVersionId());
    state.headerLoading = false;
    // Default the batch size once the header resolves (create mode only).
    if (!isEdit && !state.batchSize) {
      state.batchSize = String(effectiveBatchBaseSize(state.header));
    }
    render();
    await loadPackaging();
  }

  async function loadPackaging() {
    const vId = resolvedVersionId();
    if (!vId) return;
    state.packagingOptions = await MockApi.getPackagingLines(vId);
    seedMix();
    render();
  }

  function seedMix() {
    if (!state.packagingOptions || state.mix) return;
    const batchUnit = (state.header && state.header.batchBaseUnit) || (state.editing && state.editing.batchUnit) || "kg";
    const massRows = state.packagingOptions
      .map((p) => ({ p, net: packagingVariantMass({ packSize: p.packSize, packUnit: p.packUnit }, batchUnit) }))
      .filter((x) => x.net !== undefined)
      .map(({ p, net }) => ({ packagingConfigId: p.id, name: p.packTitle, net }));

    if (state.editing && state.editing.packagingLines && state.editing.packagingLines.length) {
      const byId = new Map(state.editing.packagingLines.map((l) => [l.packagingConfigId, l]));
      const size = state.editing.batchSize || 1;
      state.mix = massRows.map((row) => {
        const line = byId.get(row.packagingConfigId);
        return { ...row, ratio: line ? (line.weightKg / size) * 100 : 0, locked: false };
      });
    } else {
      state.mix = equalSplit(massRows);
    }
  }

  function pickVersion(id) {
    state.pickedVersionId = id;
    state.batchSize = "";
    state.mix = null;
    state.drafts = {};
    state.fieldErrors = {};
    markTouched();
    render();
    loadHeaderAndPackaging();
  }

  // ── mix table interaction ──
  function commitRatio(i, ratio) { state.mix = rebalance(state.mix, i, ratio); }
  function draftValue(key, computed) { return key in state.drafts ? state.drafts[key] : String(r2(computed)); }
  function onDraftChange(key, value) { state.drafts[key] = value; markTouched(); render(); }
  function commitDraft(key, i, kind) {
    const raw = state.drafts[key];
    if (raw === undefined) return;
    const trimmed = raw.trim();
    const v = Number(trimmed);
    let err = null;
    if (trimmed === "" || Number.isNaN(v)) err = "Enter a number";
    else if (v < 0) err = "Must be 0 or greater";
    else if (kind === "ratio" && v > 100) err = "Can't exceed 100%";

    if (err) { state.fieldErrors[key] = err; render(); return; }
    delete state.fieldErrors[key];
    delete state.drafts[key];

    const sizeNum = Number(state.batchSize) || 0;
    const r = state.mix[i];
    if (kind === "ratio") commitRatio(i, v);
    else if (kind === "weight") commitRatio(i, sizeNum ? (v / sizeNum) * 100 : 0);
    else commitRatio(i, sizeNum ? (v * r.net / sizeNum) * 100 : 0);
    render();
  }
  function toggleLock(i) {
    state.mix = state.mix.map((r, idx) => (idx === i ? { ...r, locked: !r.locked } : r));
    markTouched();
    render();
  }

  async function submit() {
    state.busy = true;
    state.error = null;
    render();
    try {
      const sizeNum = Number(state.batchSize) || 0;
      const rows = state.mix ?? [];
      const packagingLines = rows
        .filter((r) => rowQty(r, sizeNum) > 0)
        .map((r) => ({ packagingConfigId: r.packagingConfigId, plannedUnits: rowQty(r, sizeNum) }));
      const input = {
        batchSize: sizeNum,
        operator: state.operator.name || undefined,
        operatorUserId: state.operator.id,
        plannedDate: state.plannedDate || undefined,
        expectedFinishDate: state.expectedFinishDate || undefined,
        packagingLines,
      };
      const batch = isEdit
        ? await MockApi.editBatch(editBatchId, input)
        : await MockApi.createBatch({ recipeVersionId: resolvedVersionId(), ...input });
      goCreated(batch.id);
    } catch (e) {
      state.confirming = false;
      state.error = e.message;
      state.busy = false;
      render();
    }
  }

  // ── render: header (dhead) ──
  function renderHead() {
    const dhead = document.getElementById("dhead");
    dhead.innerHTML = "";
    if (state.confirmingClose) {
      dhead.appendChild(ConfirmInline({
        prompt: "Discard this batch and close?",
        busy: false,
        onYes: goClose,
        onNo: () => { state.confirmingClose = false; render(); },
        yesAria: "Confirm discard and close",
        noAria: "Keep editing",
      }));
      return;
    }
    dhead.appendChild(el("span", {}, isEdit ? "Edit Batch" : "Create Batch"));
    dhead.appendChild(el("button", { onclick: requestClose, "aria-label": "Close" }, "✕"));
  }

  // ── render: recipe search card ──
  // Real CreateBatchDrawer.tsx: `.filter((r) => r.hasPublishedVersion)` — a draft recipe is
  // filtered out of the list entirely (MockApi.listRecipes() already does this server-side, same
  // as the real api-client), so this card never has a disabled/"Draft" option to show anymore.
  function renderRecipeSearch() {
    if (isEdit || !state.changingRecipe) return null;
    const q = state.recipeQuery.trim().toLowerCase();
    const matches = state.recipes === null ? [] : state.recipes.filter((r) => r.name.toLowerCase().includes(q));
    const results = state.recipes === null
      ? el("div", { class: "psr-item readonly-note" }, "Loading recipes…")
      : el("div", {},
          ...matches.map((r) => el("div", { class: "psr-item", onmousedown: () => selectRecipe(r.id, r.name) }, el("span", {}, r.name))),
          (state.recipeQuery && matches.length === 0) ? el("div", { class: "psr-item readonly-note" }, "No matching recipes") : null);

    return el("div", { class: "line-card" },
      el("div", { class: "field product-search-field" },
        el("label", { class: "label" }, "Recipe"),
        el("input", {
          class: "input", placeholder: "Search recipes…", value: state.recipeQuery, autofocus: "",
          oninput: (e) => { state.recipeQuery = e.target.value; render(); },
        }),
        el("div", { class: "product-search-results" }, results)));
  }

  // ── render: the Production Batch / SKU Planning form ──
  function renderForm() {
    const ready = isEdit ? !!state.editing : !!state.recipeId;
    if (!ready) {
      // A-135: no redundant second "search for a recipe" prompt in create mode — the search card
      // above already covers it. Edit mode still needs its own loading state.
      return isEdit ? LoadingOverlay() : null;
    }
    if (isEdit ? !state.editing : (state.recipeId && state.headerLoading)) return LoadingOverlay();

    const batchUnit = (state.header && state.header.batchBaseUnit) || (state.editing && state.editing.batchUnit) || "kg";
    const nominal = state.header ? effectiveBatchBaseSize(state.header) : undefined;
    const band = nominal != null ? toBatchSizeBandVM(nominal, batchUnit) : undefined;
    const notPublished = state.header ? !state.header.isLocked : false;

    const rows = state.mix ?? [];
    const sizeNum = Number(state.batchSize) || 0;
    const sizeOk = state.batchSize !== "" && (nominal != null ? inBatchSizeQualityBand(sizeNum, nominal) : sizeNum > 0);
    const alloc = allocated(rows, sizeNum);
    const over = r2(alloc - sizeNum) > 1e-9;
    const residual = Math.max(0, r2(sizeNum - alloc));
    // Derived, not stored — what kind of output this batch is planned to produce, surfaced as a
    // chip in SKU Planning. Recomputed from the same packagingLines/residual shape Complete's own
    // actual-output capture will mirror later.
    const packedLines = rows.filter((r) => rowQty(r, sizeNum) > 0).length;
    const outcomeType = packedLines > 0 && residual > 1e-9 ? "Bulk + Packaged" : packedLines > 0 ? "Packaged" : "Bulk";
    const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
    const plannedDateOk = state.plannedDate !== "";
    const dateOrderOk = !state.expectedFinishDate || !state.plannedDate || state.expectedFinishDate >= state.plannedDate;
    const canSubmit = (!isEdit ? (!!resolvedVersionId() && !notPublished && sizeOk && !over) : (sizeOk && !over))
      && !hasFieldErrors && plannedDateOk && dateOrderOk;

    const subtabs = el("div", { class: "prod-subtabs" },
      el("a", { class: state.sub === "batch" ? "on" : "", href: "#", onclick: (e) => { e.preventDefault(); state.sub = "batch"; render(); } }, "Production Batch ", el("span", { class: "u" }, batchUnit)),
      el("a", { class: state.sub === "sku" ? "on" : "", href: "#", onclick: (e) => { e.preventDefault(); state.sub = "sku"; render(); } }, "SKU Planning ", el("span", { class: "u" }, "pcs")));

    let stageBody = null;
    if (state.sub === "batch") {
      const bandPct = band ? Math.min(100, Math.max(0, ((sizeNum - band.lo) / (band.hi - band.lo)) * 100)) : 0;
      const recipeVersionField = (state.header && state.header.versions.length > 1)
        ? el("div", { style: "display:flex;align-items:center;gap:8px" },
            el("select", {
              class: "input", style: "max-width:220px",
              value: resolvedVersionId() ?? state.header.activeVersionId,
              onchange: (e) => pickVersion(e.target.value),
            }, ...state.header.versions.map((v) => el("option", { value: v.id }, v.label + (v.subLabel ? " · " + v.subLabel : "")))),
            el("span", { class: "bm-chip" }, state.header.isLocked ? "Published" : "Draft"))
        : el("div", { class: "auto-field" },
            (state.header && state.header.name) || (state.editing && state.editing.displayName) || "…",
            state.header ? el("span", { class: "bm-chip", style: "margin-left:8px" }, state.header.isLocked ? "Published" : "Draft") : null);

      stageBody = el("div", { class: "stage", "data-stage": "production" },
        el("div", { class: "stage-h" },
          el("div", {}, el("div", { class: "stage-sub" }, "Process manufacturing — mixing, baking, frying. Planned in ", el("b", {}, batchUnit), ", never in pieces.")),
          el("span", { class: "stage-tag stage-tag-kg" }, `Recipe quantity · ${batchUnit}`)),
        el("div", { class: "prod-form" },
          el("div", { class: "fld" },
            el("label", { class: "label" }, "Recipe Version"),
            recipeVersionField,
            el("div", { class: "hint" }, "Recorded on every batch — immutable once produced.")),
          el("div", { class: "fld" },
            el("label", { class: "label" }, "Batch Size"),
            el("div", { class: "num-in" },
              el("input", { class: "input", type: "number", min: "1", step: "0.5", value: state.batchSize, oninput: (e) => { state.batchSize = e.target.value; markTouched(); render(); } }),
              el("span", { class: "num-suffix" }, batchUnit)),
            band ? el("div", { class: "band" + (sizeOk ? "" : " out") },
              el("div", { class: "band-row" },
                el("span", {}, "Quality band ", el("b", {}, `${band.lo}–${band.hi} ${batchUnit}`), ` · nominal ${nominal} (±10%)`),
                el("span", { class: "band-val" }, `${sizeNum} ${batchUnit}`)),
              el("div", { class: "band-track" }, el("i", { class: "band-mark", style: `left:${bandPct}%` }))) : null,
            (!sizeOk && state.batchSize) ? el("div", { class: "alert-red", style: "margin-top:6px" }, "Beyond the quality tolerance for this recipe — taste & texture would change. Stay within the band, or create a dedicated recipe version for this size.") : null),
          el("div", { class: "fld" },
            el("label", { class: "label" }, "Planned Date ", el("span", { class: "req" }, "*")),
            el("input", { class: "input", type: "date", value: state.plannedDate, oninput: (e) => { state.plannedDate = e.target.value; markTouched(); render(); } })),
          el("div", { class: "fld" },
            el("label", { class: "label" }, "Expected Finish Date"),
            el("input", { class: "input", type: "date", min: state.plannedDate || undefined, value: state.expectedFinishDate, oninput: (e) => { state.expectedFinishDate = e.target.value; markTouched(); render(); } }),
            el("div", { class: "hint" }, "Packaging may run hours or days after production.")),
          el("div", { class: "fld" },
            OperatorPicker({ value: state.operator, label: "Operator", onChange: (v) => { state.operator = v; markTouched(); render(); } })),
          el("div", { class: "fld" },
            el("label", { class: "label" }, "Batch Number"),
            el("div", { class: "auto-field" }, "AUTO · generated on create"))));
    } else {
      const pePct = band ? sizeOk : false;
      const mixHead = el("div", { class: "mix-head" },
        el("span", {}, "Variant"), el("span", { class: "ta-r" }, "Ratio %"), el("span", { class: "ta-r" }, `Weight ${batchUnit}`), el("span", { class: "ta-r" }, "Qty pcs"), el("span", { class: "ta-c" }, "Lock"));

      let mixBody;
      if (state.mix === null) mixBody = el("div", { class: "readonly-note", style: "padding:12px" }, "Loading packaging…");
      else if (!rows.length) mixBody = el("div", { class: "readonly-note", style: "padding:12px" }, "This recipe version has no mass-denominated packaging to plan.");
      else {
        mixBody = el("div", {}, ...rows.map((r, i) => {
          const w = rowWeight(r, sizeNum);
          const q = rowQty(r, sizeNum);
          const rowErr = state.fieldErrors[`${i}:ratio`] ?? state.fieldErrors[`${i}:weight`] ?? state.fieldErrors[`${i}:qty`];
          return el("div", { class: "mix-row" + (r.locked ? " locked" : "") },
            el("div", { class: "vn" }, r.name, el("small", {}, ` ${r.net} ${batchUnit}/pack`)),
            el("div", { "data-cell": "Ratio %" }, el("input", {
              class: "mix-in" + (state.fieldErrors[`${i}:ratio`] ? " has-error" : ""), type: "number", min: "0", max: "100", step: "0.1",
              readonly: r.locked || undefined, value: draftValue(`${i}:ratio`, r.ratio),
              oninput: (e) => onDraftChange(`${i}:ratio`, e.target.value), onblur: () => commitDraft(`${i}:ratio`, i, "ratio"),
            })),
            el("div", { "data-cell": `Weight ${batchUnit}` }, el("input", {
              class: "mix-in" + (state.fieldErrors[`${i}:weight`] ? " has-error" : ""), type: "number", min: "0", step: "0.05",
              readonly: r.locked || undefined, value: draftValue(`${i}:weight`, w),
              oninput: (e) => onDraftChange(`${i}:weight`, e.target.value), onblur: () => commitDraft(`${i}:weight`, i, "weight"),
            })),
            el("div", { "data-cell": "Qty pcs" }, el("input", {
              class: "mix-in" + (state.fieldErrors[`${i}:qty`] ? " has-error" : ""), type: "number", min: "0", step: "1",
              readonly: r.locked || undefined, value: draftValue(`${i}:qty`, q),
              oninput: (e) => onDraftChange(`${i}:qty`, e.target.value), onblur: () => commitDraft(`${i}:qty`, i, "qty"),
            })),
            el("div", { class: "ta-c" }, el("button", {
              type: "button", class: "lock-btn", "aria-pressed": String(r.locked), "aria-label": (r.locked ? "Unlock " : "Lock ") + r.name,
              onclick: () => toggleLock(i),
            }, r.locked ? "🔒" : "🔓")),
            rowErr ? el("div", { class: "field-error-msg", style: "grid-column:1/-1" }, rowErr) : null);
        }));
      }

      stageBody = el("div", { class: "stage", "data-stage": "packaging" },
        el("div", { class: "stage-h" },
          el("div", {},
            el("div", { class: "stage-sub" }, "Converts the manufactured weight into finished SKUs. Planned in ", el("b", {}, "pieces"), ".") ,
            el("div", { class: "pivot pivot-edit" },
              el("span", { class: "pe-label" }, "Batch size"),
              el("span", { class: "num-in num-in-sm" },
                el("input", { class: "input", type: "number", min: "1", step: "0.5", value: state.batchSize, oninput: (e) => { state.batchSize = e.target.value; markTouched(); render(); } }),
                el("span", { class: "num-suffix" }, batchUnit)),
              band ? el("span", { class: "pe-note" + (sizeOk ? "" : " out") }, sizeOk ? `· within the ${band.lo}–${band.hi} ${batchUnit} quality band` : `· ⚠ beyond the ${band.lo}–${band.hi} ${batchUnit} quality band`) : null)),
          el("div", { style: "display:flex;align-items:center;gap:8px;flex-wrap:wrap" },
            el("span", { class: "bm-chip" }, "Expected: " + outcomeType),
            el("span", { class: "stage-tag stage-tag-pcs" }, "Finished SKU · pcs"))),
        el("div", { class: "mix-tbl" }, mixHead, mixBody),
        el("div", { class: "muted small mt8" }, "Edit ", el("b", {}, "Ratio"), ", ", el("b", {}, "Weight"), " or ", el("b", {}, "Quantity"), " to adjust by hand — unlocked rows rebalance to 100%."));
    }

    const notices = [];
    if (over) notices.push(el("div", { class: "nb nb-bad" }, "⚠ Over-allocated by ", el("b", {}, `${r2(alloc - sizeNum)} ${batchUnit}`), ` — this batch holds `, el("b", {}, `${sizeNum} ${batchUnit}`), ". Reduce quantities until the plan fits."));
    if (!over && residual > 1e-9) notices.push(el("div", { class: "nb" }, el("b", {}, `${residual} ${batchUnit}`), " has no packaging assigned yet — that's fine to leave for now. It's tracked separately as ", el("b", {}, "Semi Finished Inventory"), " (leftover stock from this batch) and can be packed into SKUs later."));
    if (notPublished && !isEdit) notices.push(el("div", { class: "nb nb-bad" }, "This recipe version is a draft. Production requires a published version."));
    if (!isEdit && state.header && !resolvedVersionId()) notices.push(el("div", { class: "nb nb-bad" }, "This recipe has no version to produce against yet — create and publish a version first."));
    if (!plannedDateOk) notices.push(el("div", { class: "nb nb-bad" }, "Planned Date is required."));
    if (plannedDateOk && !dateOrderOk) notices.push(el("div", { class: "nb nb-bad" }, "Expected Finish Date can't be earlier than Planned Date."));

    const confirmDetail = `${sizeNum} ${batchUnit}${packedLines ? ` · ${packedLines} packaging line${packedLines === 1 ? "" : "s"}` : ""}${state.plannedDate ? ` · planned ${state.plannedDate}` : ""}`;
    const statusMsg = (!sizeOk && state.batchSize) ? "⚠ Batch size beyond quality tolerance." : over ? "⚠ The SKU plan exceeds the batch." : hasFieldErrors ? "⚠ Fix the highlighted field(s) in SKU Planning." : "Batch numbers & QR are generated automatically.";

    const actions = state.confirming
      ? ConfirmInline({
          prompt: isEdit ? "Save these changes?" : "Create this production batch?",
          detail: confirmDetail, busy: state.busy, onYes: submit,
          onNo: () => { state.confirming = false; render(); },
          yesAria: isEdit ? "Confirm save changes" : "Confirm create production batch",
          noAria: "Cancel",
        })
      : el("div", { style: "display:flex;gap:8px" },
          el("button", { class: "btn", onclick: requestClose }, "Cancel"),
          el("button", { class: "btn btn-teal", disabled: !canSubmit || undefined, onclick: () => { state.confirming = true; render(); } }, isEdit ? "Save Changes" : "Create Production Order"));

    return el("div", {},
      subtabs, stageBody,
      el("div", { class: "notices" }, ...notices),
      state.error ? el("p", { role: "alert", class: "error small mt8" }, state.error) : null,
      el("div", { class: "v4-actions", style: "justify-content:space-between" },
        el("span", { class: "muted small" }, statusMsg),
        actions));
  }

  function render() {
    renderHead();
    const dbody = document.getElementById("dbody");
    dbody.innerHTML = "";
    const search = renderRecipeSearch();
    if (search) dbody.appendChild(search);
    const form = renderForm();
    if (form) dbody.appendChild(form);
  }

  document.getElementById("scrim").addEventListener("click", requestClose);

  // ── init ──
  (async function init() {
    if (isEdit) {
      state.editing = await MockApi.getBatch(editBatchId);
      state.recipeId = undefined; // a batch carries no recipeId — degrades to editing.displayName/batchUnit
      await loadPackaging_forEdit();
      // Prefill from the existing batch.
      state.batchSize = String(state.editing.batchSize ?? "");
      state.operator = { name: state.editing.operator ?? "", id: state.editing.operatorUserId };
      state.plannedDate = (state.editing.plannedDate || "").slice(0, 10);
      state.expectedFinishDate = (state.editing.expectedFinishDate || "").slice(0, 10);
      render();
    } else {
      render();
      state.recipes = await MockApi.listRecipes();
      render();
    }
  })();

  async function loadPackaging_forEdit() {
    state.packagingOptions = await MockApi.getPackagingLines(state.editing.recipeVersionId);
    seedMix();
  }
})();
