// batch-detail.js — ported from development/frontend/src/components/batch/BatchDetailDrawer.tsx,
// as it exists at the v7 fork point (2026-08-10). Extends the v6 baseline (2-tab Overview/Activity,
// two-step status-update modal) with everything that landed since the 2026-07-28 freeze:
//
// - A third "Ingredients" tab: the summary grid + Issue/Bulk-Issue/Return/History drawers
//   (SSOT-2 addendum-0041).
// - NextAction's status-update flow now carries an optional operator handover (checkbox + the
//   shared OperatorPicker), on every transition (SSOT-2 addendum-0040).
// - Complete gets its own outcome-verification table (Track B, ratified in v6) — unchanged here.
// - Overview gains an Inventory Sync block + the "Add to Inventory" drawer (per-line product
//   link/actual-qty/dates table), and an Edit Dates modal usable at any batch state (SSOT-2
//   addendum-0036/0038).
// - Activity is now a 5-source merged timeline (status transitions, date edits, inventory-sync
//   events, operator handovers, ingredient transactions) instead of a bare status-history list.
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const batchId = params.get("id");

  const state = {
    batch: null,
    tab: "overview", // "overview" | "ingredients" | "activity"

    // NextAction / status-update
    selectedTrigger: null,
    actualOutcome: null,
    confirmingUpdate: false,
    comment: "",
    handoverOn: false,
    newOperator: { name: "" },
    busy: false,
    error: null,

    // Overview extras
    editingDates: false,
    dates: { plannedDate: "", expectedFinishDate: "", note: "" },
    invSyncHandle: null, // the shared InventorySyncDrawer's own { destroy() } handle, while open

    // Ingredients tab
    issueFor: null,       // IngredientSummaryRowVM | null
    issueDraft: null,
    bulkIssueOpen: false,
    bulkIssueSelected: [],
    bulkIssueLines: {},
    returnFor: null,
    returnDraft: null,
    historyFor: null,
    historyData: null,
  };

  let modalScrimEl = null; // mounted once, top-level sibling of the drawer/scrim — see mountModal()
  let modalBodyEl = null;
  let modalTriggerEl = null;
  let pendingModalFocus = false;

  function nextActionGuidance(stateId, statusLabel) {
    switch (stateId) {
      case "planned": return "Ready to start production";
      case "in-progress": return "Production is underway";
      case "on-hold": return "Resolve the hold to continue";
      case "completed": return "Ready to close out";
      default: return statusLabel;
    }
  }
  function terminalStateMessage(stateId) {
    if (stateId === "closed") return "Production completed and closed — nothing further to do.";
    if (stateId === "rejected") return "This batch was rejected and is closed out — nothing further to do.";
    return "This batch has reached a terminal state.";
  }

  function goEdit(id) { window.location.href = "create-batch.html?edit=" + encodeURIComponent(id); }
  function goClose() { window.location.href = "batch-workspace.html"; }

  // ── Complete's own draft (Track B) ──
  function buildOutcomeDraft(b) {
    return {
      lines: b.packagingLines.map((l) => ({ packagingConfigId: l.packagingConfigId, name: l.name, plannedUnits: l.plannedUnits, actualUnits: null })),
      plannedSemiFinishedKg: b.semiFinishedKg || null,
      actualSemiFinishedKg: null,
      touched: {},
    };
  }
  function actualFieldError(value, isBulk) {
    if (value === null || value === "" || value === undefined || Number.isNaN(value)) return isBulk ? "Enter the actual weight" : "Enter the actual quantity";
    if (value < 0) return "Must be 0 or more";
    if (!isBulk && !Number.isInteger(value)) return "Must be a whole number";
    return null;
  }

  // ── the optional handover block shared by ConfirmStatusUpdateModal / CompleteOutcomeModal ──
  function handoverFields() {
    return el("div", { class: "ws-comment-field" },
      el("label", { class: "ws-su-label", style: "display:flex;align-items:center;gap:8px;cursor:pointer" },
        el("input", {
          type: "checkbox", checked: state.handoverOn || undefined, disabled: state.busy || undefined,
          onchange: (e) => { state.handoverOn = e.target.checked; render(); },
        }),
        "Hand over to a new operator (optional)"),
      state.handoverOn
        ? el("div", { style: "margin-top:8px" }, OperatorPicker({
            value: state.newOperator, disabled: state.busy, placeholder: "Search operators…",
            onChange: (v) => { state.newOperator = v; },
          }))
        : null);
  }

  // ── status-update option grid ──
  function statusUpdatePanel() {
    const b = state.batch;
    const opts = b.availableTransitions || [];

    if (!opts.length) {
      return el("div", { class: "ws-status-update" },
        el("div", { class: "ws-su-label" }, "Update Batch Status"),
        el("div", { class: "readonly-note", style: "margin-top:8px" }, terminalStateMessage(b.stateId)));
    }

    const optionCards = opts.map((o) => {
      const meta = TRIGGER_META[o.trigger] || { icon: "•", cls: "", desc: "" };
      const selected = state.selectedTrigger === o.trigger;
      return el("button", {
        type: "button", class: "ws-status-option" + (selected ? " selected" : ""), "aria-pressed": String(selected),
        onclick: () => {
          state.selectedTrigger = selected ? null : o.trigger;
          state.actualOutcome = state.selectedTrigger === "complete" ? buildOutcomeDraft(b) : null;
          render();
        },
      },
        el("span", { class: "radio", "aria-hidden": "true" }),
        el("span", { class: "icon " + meta.cls, "aria-hidden": "true" }, meta.icon),
        el("span", { class: "label" }, o.label),
        el("span", { class: "desc" }, meta.desc));
    });

    const pickActions = state.selectedTrigger
      ? el("div", { class: "ws-status-update-footer" },
          el("button", {
            type: "button", class: "btn", disabled: state.busy || undefined,
            onclick: () => { state.selectedTrigger = null; state.comment = ""; state.actualOutcome = null; state.handoverOn = false; state.newOperator = { name: "" }; state.error = null; render(); },
          }, "Cancel"),
          el("button", { type: "button", class: "btn btn-primary", disabled: state.busy || undefined, onclick: openConfirmUpdate }, "Update Status"))
      : null;

    return el("div", { class: "ws-status-update" },
      el("div", { class: "ws-su-current" }, "Current status: ", el("b", {}, b.statusLabel)),
      el("div", { class: "ws-su-label" }, "Next Status Options"),
      el("div", { class: "ws-su-hint" }, "Choose the next status to update to."),
      el("div", { class: "ws-status-options" }, ...optionCards),
      pickActions);
  }

  function openConfirmUpdate() {
    if (!state.selectedTrigger) return;
    modalTriggerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.confirmingUpdate = true;
    pendingModalFocus = true;
    render();
  }
  function closeConfirmModal() {
    if (state.busy) return;
    state.confirmingUpdate = false;
    state.error = null;
    render();
    if (modalTriggerEl && document.body.contains(modalTriggerEl)) modalTriggerEl.focus();
    modalTriggerEl = null;
  }

  function confirmUpdateModal() {
    const b = state.batch;
    const trigger = state.selectedTrigger;
    if (!trigger) return null;
    const meta = TRIGGER_META[trigger] || { icon: "•", cls: "" };
    const newLabel = TRIGGER_RESULT_LABEL[trigger] || trigger;

    return el("div", { class: "ws-modal", role: "dialog", "aria-modal": "true", "aria-label": "Confirm status update" },
      el("div", { class: "ws-modal-head" },
        el("div", {},
          el("div", { class: "ws-modal-title" }, "Confirm Status Update"),
          el("div", { class: "ws-modal-sub" }, "You are about to update the batch status.")),
        el("button", { type: "button", class: "ws-modal-close", "aria-label": "Close", onclick: closeConfirmModal }, "✕")),
      el("div", { class: "ws-modal-status-row" },
        el("div", { class: "ws-modal-status-col" },
          el("div", { class: "ws-modal-status-kicker" }, "Current Status"),
          el("div", { class: "ws-modal-status-pill" }, el("span", { class: "icon", "aria-hidden": "true" }, STATUS_ICON[b.statusLabel] || "•"), b.statusLabel)),
        el("div", { class: "ws-modal-arrow", "aria-hidden": "true" }, "→"),
        el("div", { class: "ws-modal-status-col" },
          el("div", { class: "ws-modal-status-kicker" }, "New Status"),
          el("div", { class: "ws-modal-status-pill new" }, el("span", { class: "icon " + meta.cls, "aria-hidden": "true" }, meta.icon), newLabel))),
      el("div", { class: "ws-comment-field" },
        el("label", { class: "ws-su-label", style: "display:block;margin-bottom:6px" }, "Comment (optional)"),
        el("textarea", {
          placeholder: "Add a comment about this update…", maxlength: "250", value: state.comment,
          oninput: (e) => { state.comment = e.target.value; const c = modalScrimEl.querySelector(".ws-comment-count"); if (c) c.textContent = `${e.target.value.length}/250`; },
        }),
        el("div", { class: "ws-comment-count" }, `${state.comment.length}/250`)),
      handoverFields(),
      state.error ? el("div", { role: "alert", class: "error small", style: "margin-top:12px" }, state.error) : null,
      el("div", { class: "ws-modal-footer" },
        el("button", { type: "button", class: "btn", disabled: state.busy || undefined, onclick: closeConfirmModal }, "Cancel"),
        el("button", { type: "button", class: "btn btn-primary", disabled: state.busy || undefined, onclick: submitStatusUpdate }, state.busy ? "Updating…" : "Confirm Update")));
  }

  function actualInputCell(outcome, key, value, isBulk, onChange) {
    const err = actualFieldError(value, isBulk);
    const showErr = outcome.touched[key] && err;
    const markTouched = () => { outcome.touched[key] = true; };
    return el("td", { class: "num" },
      el("input", {
        class: "input qty-input" + (showErr ? " has-error" : ""),
        type: "number", min: "0", step: isBulk ? "0.01" : "1", inputmode: isBulk ? "decimal" : "numeric",
        value: value ?? "",
        oninput: (e) => { markTouched(); onChange(e.target.value === "" ? null : Number(e.target.value)); render(); },
        onblur: () => { markTouched(); render(); },
      }),
      el("div", { class: "field-error-msg", style: "min-height:15px" }, showErr ? err : " "));
  }

  function confirmCompleteModal() {
    const outcome = state.actualOutcome;
    const b = state.batch;
    if (!outcome) return null;
    const batchUnit = b.batchUnit ?? "kg";

    const rows = outcome.lines.map((l, i) => el("tr", {},
      el("td", {}, l.name),
      el("td", { class: "num" }, `${b.batchSize ?? "—"} ${batchUnit}`),
      el("td", { class: "num" }, String(l.plannedUnits)),
      actualInputCell(outcome, String(i), l.actualUnits, false, (v) => { outcome.lines[i].actualUnits = v; })));
    if (outcome.plannedSemiFinishedKg != null) {
      rows.push(el("tr", {},
        el("td", {}, "Bulk"),
        el("td", { class: "num" }, `${b.batchSize ?? "—"} ${batchUnit}`),
        el("td", { class: "num" }, `${outcome.plannedSemiFinishedKg} ${batchUnit}`),
        actualInputCell(outcome, "bulk", outcome.actualSemiFinishedKg, true, (v) => { outcome.actualSemiFinishedKg = v; })));
    }

    const lineErrors = outcome.lines.map((l) => actualFieldError(l.actualUnits, false));
    const bulkError = outcome.plannedSemiFinishedKg != null ? actualFieldError(outcome.actualSemiFinishedKg, true) : null;
    const allValid = lineErrors.every((e) => !e) && !bulkError;

    let summary;
    if (!allValid) {
      summary = el("div", { class: "ws-note", style: "margin-top:14px" }, "Enter the actual output for every line to continue.");
    } else {
      const lineMismatchCount = outcome.lines.filter((l) => l.actualUnits !== l.plannedUnits).length;
      const bulkMismatched = outcome.plannedSemiFinishedKg != null && outcome.actualSemiFinishedKg !== outcome.plannedSemiFinishedKg;
      const mismatchCount = lineMismatchCount + (bulkMismatched ? 1 : 0);
      const parts = [];
      if (lineMismatchCount > 0) parts.push(`${lineMismatchCount} packaging line${lineMismatchCount === 1 ? "" : "s"}`);
      if (bulkMismatched) parts.push("the bulk residual");
      summary = mismatchCount > 0
        ? el("div", { class: "ws-note attn", style: "margin-top:14px" }, `⚠ ${parts.join(" and ")} ${mismatchCount === 1 ? "differs" : "differ"} from expected — this batch will be flagged for Production Settlement.`)
        : el("div", { class: "ws-note ok", style: "margin-top:14px" }, "✓ Matches expected output");
    }

    return el("div", { class: "ws-modal ws-modal-wide", role: "dialog", "aria-modal": "true", "aria-label": "Complete production" },
      el("div", { class: "ws-modal-head" },
        el("div", {},
          el("div", { class: "ws-modal-title" }, "Complete Production"),
          el("div", { class: "ws-modal-sub" }, "Record what was actually produced.")),
        el("button", { type: "button", class: "ws-modal-close", "aria-label": "Close", onclick: closeConfirmModal }, "✕")),
      el("table", { class: "bm-table" },
        el("thead", {}, el("tr", {}, el("th", {}, "Product"), el("th", { class: "num" }, "Batch Size"), el("th", { class: "num" }, "Expected"), el("th", { class: "num" }, "Actual"))),
        el("tbody", {}, ...rows)),
      summary,
      el("div", { class: "ws-comment-field", style: "margin-top:14px" },
        el("label", { class: "ws-su-label", style: "display:block;margin-bottom:6px" }, "Comment (optional)"),
        el("textarea", {
          placeholder: "Add a comment about this update…", maxlength: "250", value: state.comment,
          oninput: (e) => { state.comment = e.target.value; const c = modalScrimEl.querySelector(".ws-comment-count"); if (c) c.textContent = `${e.target.value.length}/250`; },
        }),
        el("div", { class: "ws-comment-count" }, `${state.comment.length}/250`)),
      handoverFields(),
      state.error ? el("div", { role: "alert", class: "error small", style: "margin-top:12px" }, state.error) : null,
      el("div", { class: "ws-modal-footer" },
        el("button", { type: "button", class: "btn", disabled: state.busy || undefined, onclick: closeConfirmModal }, "Cancel"),
        el("button", { type: "button", class: "btn btn-primary", disabled: (state.busy || !allValid) || undefined, onclick: submitCompleteUpdate }, state.busy ? "Completing…" : "Complete Production")));
  }

  async function submitStatusUpdate() {
    const b = state.batch;
    const trigger = state.selectedTrigger;
    if (!trigger) return;
    state.busy = true; state.error = null; render();
    try {
      const newOperator = state.handoverOn && state.newOperator.id ? { id: state.newOperator.id, name: state.newOperator.name } : undefined;
      const updated = await MockApi.transitionBatch(b.id, { trigger, comment: state.comment.trim() || undefined, newOperator });
      state.batch = updated;
      state.selectedTrigger = null; state.comment = ""; state.confirmingUpdate = false; state.handoverOn = false; state.newOperator = { name: "" };
    } catch (e) {
      state.error = e.message;
    } finally {
      state.busy = false;
      render();
    }
  }

  async function submitCompleteUpdate() {
    const b = state.batch;
    const outcome = state.actualOutcome;
    if (!outcome) return;
    state.busy = true; state.error = null; render();
    try {
      const newOperator = state.handoverOn && state.newOperator.id ? { id: state.newOperator.id, name: state.newOperator.name } : undefined;
      const updated = await MockApi.transitionBatch(b.id, {
        trigger: "complete", comment: state.comment.trim() || undefined,
        actualOutcome: { lines: outcome.lines.map((l) => ({ packagingConfigId: l.packagingConfigId, actualUnits: l.actualUnits })), actualSemiFinishedKg: outcome.actualSemiFinishedKg },
        newOperator,
      });
      state.batch = updated;
      state.selectedTrigger = null; state.comment = ""; state.actualOutcome = null; state.confirmingUpdate = false; state.handoverOn = false; state.newOperator = { name: "" };
    } catch (e) {
      state.error = e.message;
    } finally {
      state.busy = false;
      render();
    }
  }

  // ── Edit Dates modal (SSOT-2 addendum-0036) — usable at ANY batch state ──
  function openEditDates() {
    const b = state.batch;
    state.dates = { plannedDate: (b.plannedDate || "").slice(0, 10), expectedFinishDate: (b.expectedFinishDate || "").slice(0, 10), note: "" };
    state.editingDates = true;
    state.error = null;
    render();
  }
  function closeEditDates() {
    if (state.busy) return;
    state.editingDates = false; state.error = null; render();
  }
  const DATE_EDIT_NOTE_REQUIRED_STATES = ["in-progress", "on-hold", "completed"];
  function editDatesModal() {
    const b = state.batch;
    const d = state.dates;
    const noteRequired = DATE_EDIT_NOTE_REQUIRED_STATES.includes(b.stateId);
    const plannedDateOk = d.plannedDate !== "";
    const dateOrderOk = !d.expectedFinishDate || !d.plannedDate || d.expectedFinishDate >= d.plannedDate;
    const noteOk = !noteRequired || d.note.trim() !== "";
    const changed = d.plannedDate !== (b.plannedDate || "").slice(0, 10) || d.expectedFinishDate !== (b.expectedFinishDate || "").slice(0, 10);
    const canSave = plannedDateOk && dateOrderOk && noteOk && changed && !state.busy;

    return el("div", { class: "ws-modal", role: "dialog", "aria-modal": "true", "aria-label": "Edit dates" },
      el("div", { class: "ws-modal-head" },
        el("div", {}, el("div", { class: "ws-modal-title" }, "Edit Dates"), el("div", { class: "ws-modal-sub" }, "Changes are recorded in this batch's Activity log.")),
        el("button", { type: "button", class: "ws-modal-close", "aria-label": "Close", disabled: state.busy || undefined, onclick: closeEditDates }, "✕")),
      el("div", { class: "fld", style: "margin-top:14px" },
        el("label", { class: "label" }, "Planned Date ", el("span", { class: "req" }, "*")),
        el("input", { class: "input", type: "date", value: d.plannedDate, disabled: state.busy || undefined, oninput: (e) => { state.dates.plannedDate = e.target.value; render(); } })),
      !plannedDateOk ? el("div", { class: "nb nb-bad" }, "Planned Date is required.") : null,
      el("div", { class: "fld", style: "margin-top:10px" },
        el("label", { class: "label" }, "Expected Finish Date"),
        el("input", { class: "input", type: "date", min: d.plannedDate || undefined, value: d.expectedFinishDate, disabled: state.busy || undefined, oninput: (e) => { state.dates.expectedFinishDate = e.target.value; render(); } }),
        el("div", { class: "hint" }, "Packaging may run hours or days after production.")),
      plannedDateOk && !dateOrderOk ? el("div", { class: "nb nb-bad" }, "Expected Finish Date can't be earlier than Planned Date.") : null,
      el("div", { class: "ws-comment-field", style: "margin-top:14px" },
        el("label", { class: "ws-su-label", style: "display:block;margin-bottom:6px" }, noteRequired ? `Reason — required for a ${b.statusLabel} batch *` : "Reason (optional)"),
        el("textarea", { placeholder: "Why is this date changing?", maxlength: "250", value: d.note, disabled: state.busy || undefined, oninput: (e) => { state.dates.note = e.target.value; render(); } }),
        el("div", { class: "ws-comment-count" }, `${d.note.length}/250`)),
      noteRequired && !noteOk ? el("div", { class: "nb nb-bad" }, `A reason is required to edit dates on a ${b.statusLabel} batch.`) : null,
      state.error ? el("div", { role: "alert", class: "error small", style: "margin-top:12px" }, state.error) : null,
      el("div", { class: "ws-modal-footer" },
        el("button", { type: "button", class: "btn", disabled: state.busy || undefined, onclick: closeEditDates }, "Cancel"),
        el("button", { type: "button", class: "btn btn-primary", disabled: !canSave, onclick: saveDates }, state.busy ? "Saving…" : "Save")));
  }
  async function saveDates() {
    state.busy = true; state.error = null; render();
    try {
      const updated = await MockApi.editBatchDates(state.batch.id, { plannedDate: state.dates.plannedDate, expectedFinishDate: state.dates.expectedFinishDate || undefined, note: state.dates.note.trim() || undefined });
      state.batch = updated; state.editingDates = false;
    } catch (e) { state.error = e.message; } finally { state.busy = false; render(); }
  }

  // ── Inventory Sync block (SSOT-2 addendum-0038) — the drawer itself is the shared
  // InventorySyncDrawer() factory in batch-shared.js, the same component
  // InventorySyncWorkspaceScreen (inventory-sync.js) reuses. ──
  function inventorySyncBlock() {
    const b = state.batch;
    const sync = b.inventorySync;
    if (!sync) return null;
    const events = sync.events && sync.events.length
      ? el("div", { class: "ws-timeline", style: "margin-top:12px" }, ...sync.events.map((e) =>
          el("div", { class: "ws-tl-item" },
            el("div", { class: "ws-tl-node " + (e.status === "ok" ? "complete" : "reject"), "aria-hidden": "true" }, e.status === "ok" ? "✓" : "✗"),
            el("div", { class: "ws-tl-content" },
              el("div", { class: "ws-tl-title" }, `${inventorySyncLineName(b, e.lineRef)} — ${INVENTORY_SYNC_ACTION_LABEL[e.action]}`),
              el("div", { class: "ws-tl-meta" }, `${fmtDateNice(e.timestamp)} at ${fmtTime(e.timestamp)} · by ${e.actor}${e.message ? ` · ${e.message}` : ""}`))))
        )
      : null;
    return el("div", { class: "ov-block" },
      el("div", { class: "ds-label" }, "Inventory"),
      sync.status === "synced"
        ? el("div", { class: "ws-note ok" }, `✓ Pushed to inventory${sync.syncedAt ? ` — ${fmtDateNice(sync.syncedAt)} at ${fmtTime(sync.syncedAt)}` : ""}`)
        : el("div", {},
            el("div", { class: "nb" + (sync.status === "failed" ? " nb-bad" : "") }, sync.status === "failed" ? "⚠ Inventory sync failed for one or more lines." : "⏳ Inventory update pending — push this batch's output to inventory."),
            el("button", { type: "button", class: "btn btn-sm btn-teal", style: "margin-top:10px", onclick: openInventorySync }, sync.status === "failed" ? "Retry Inventory Sync" : "Add to Inventory")),
      events);
  }

  function openInventorySync() {
    state.invSyncHandle = InventorySyncDrawer({
      batch: state.batch,
      onClose: () => { state.invSyncHandle = null; },
      onSynced: async () => { state.invSyncHandle = null; state.batch = await MockApi.getBatch(state.batch.id); render(); },
    });
  }

  // ── Overview tab ──
  function overviewTab() {
    const b = state.batch;
    const urgent = b.statusLabel === "On Hold";
    const reason = attentionReasonDetail(b.statusLabel, b.expectedFinishDate);
    const batchUnit = b.batchUnit ?? "kg";

    const packagingBlock = b.packagingLines.length
      ? el("table", { class: "bm-table" },
          el("thead", {}, el("tr", {}, el("th", {}, "Pack"), el("th", { class: "num" }, "Planned"), el("th", { class: "num" }, "Weight"), el("th", { class: "num" }, "% of batch"))),
          el("tbody", {}, ...b.packagingLines.map((l) => el("tr", {},
            el("td", {}, l.name, l.packSizeLabel ? el("span", { class: "bm-chip" }, l.packSizeLabel) : null),
            el("td", { class: "num" }, String(l.plannedUnits)),
            el("td", { class: "num" }, `${l.weightKg.toFixed(2)} ${batchUnit}`),
            el("td", { class: "num" }, `${l.ratioPct.toFixed(1)}%`)))))
      : el("div", { class: "readonly-note" }, "No packaging planned for this batch.");

    const outcomeBlock = b.actualOutcome ? (() => {
      const outcome = b.actualOutcome;
      const outRows = outcome.lines.map((l) => el("tr", {},
        el("td", {}, l.name),
        el("td", { class: "num" }, String(l.plannedUnits)),
        el("td", { class: "num outcome-" + (l.actualUnits === l.plannedUnits ? "match" : "mismatch") }, String(l.actualUnits))));
      if (outcome.plannedSemiFinishedKg != null) {
        outRows.push(el("tr", {},
          el("td", {}, "Bulk"),
          el("td", { class: "num" }, `${outcome.plannedSemiFinishedKg} ${batchUnit}`),
          el("td", { class: "num outcome-" + (outcome.actualSemiFinishedKg === outcome.plannedSemiFinishedKg ? "match" : "mismatch") }, `${outcome.actualSemiFinishedKg} ${batchUnit}`)));
      }
      return el("div", { class: "ov-block" },
        el("div", { class: "ds-label" }, "Outcome Verification"),
        el("table", { class: "bm-table" },
          el("thead", {}, el("tr", {}, el("th", {}, "Product"), el("th", { class: "num" }, "Expected"), el("th", { class: "num" }, "Actual"))),
          el("tbody", {}, ...outRows)));
      // dev addendum — human direction: hide the Settlement Required banner for now (commented
      // out, not removed — re-enable by uncommenting).
      // outcome.settlementRequired ? el("div", { class: "nb nb-bad", style: "margin-top:12px" }, "⚠ Settlement Required — actual output differs from what was planned.") : null
    })() : null;

    return el("div", {},
      reason ? el("div", { class: "nb nb-bad ds-attention-reason" }, "⚠ " + reason) : null,
      el("div", { class: "ov-block ds-next-action" + (urgent ? " urgent" : "") },
        b.stateId === "planned" ? el("div", { style: "margin-bottom:10px" }, el("button", { type: "button", class: "btn", onclick: () => goEdit(b.id) }, "Edit Batch")) : null,
        statusUpdatePanel()),
      el("div", { class: "ov-block" },
        el("div", { class: "ds-label" }, "Packaging Mix ", el("span", { class: "ds-label-note" }, `— ${b.packagingLines.length} line${b.packagingLines.length === 1 ? "" : "s"}`)),
        packagingBlock,
        b.semiFinishedKg ? el("div", { class: "kv" }, el("span", { class: "k" }, "Left unpacked (semi-finished)"), el("span", { class: "v" }, `${b.semiFinishedKg.toFixed(2)} ${batchUnit}`)) : null),
      outcomeBlock,
      inventorySyncBlock(),
      el("div", { class: "ov-block" },
        el("div", { class: "ds-label" }, "Batch Facts"),
        el("div", { class: "kv" }, el("span", { class: "k" }, "Planned Batch Size"), el("span", { class: "v" }, `${b.batchSize ?? "—"} ${batchUnit}`)),
        el("div", { class: "kv" }, el("span", { class: "k" }, "Operator"), el("span", { class: "v" }, b.operator ?? "—")),
        el("div", { class: "kv" }, el("span", { class: "k" }, "Planned Date"), el("span", { class: "v" }, b.plannedDate ? fmtDateNice(b.plannedDate) : "Not set")),
        el("div", { class: "kv" }, el("span", { class: "k" }, "Expected Finish"), el("span", { class: "v" }, b.expectedFinishDate ? fmtDateNice(b.expectedFinishDate) : "Not set")),
        b.stateId !== "planned" ? el("button", { type: "button", class: "btn btn-sm", style: "margin-top:8px", onclick: openEditDates }, "✎ Edit Dates") : null),
      (b.stateId === "completed" || b.stateId === "closed")
        ? el("div", { class: "ov-quickactions" }, el("button", { type: "button", class: "btn btn-sm", onclick: () => window.print() }, "🖨 Print Label"))
        : null);
  }

  // ── Ingredients tab (SSOT-2 addendum-0041) ──
  function varianceClass(v) { return v === 0 ? "outcome-match" : v > 0 ? "outcome-mismatch" : ""; }
  function rowKebabActions(row, availableToReturn) {
    const actions = [{ label: "Issue", onClick: () => { state.issueFor = row; state.issueDraft = { ingredientId: row.ingredientId, quantity: "", uom: row.uom, warehouseId: "", remarks: "" }; render(); } }];
    if (availableToReturn > 0) actions.push({ label: "Return", onClick: () => { state.returnFor = row; state.returnDraft = { quantity: "", warehouseId: "", remarks: "" }; render(); } });
    actions.push({ label: "History", onClick: async () => { state.historyFor = row; state.historyData = null; render(); const r = await MockApi.listIngredients(state.batch.id, row.ingredientId); state.historyData = r.transactions; render(); } });
    return actions;
  }
  function ingredientsTab() {
    const b = state.batch;
    const rows = b.ingredientSummary || [];
    return el("div", {},
      el("div", { class: "ov-block" },
        el("div", { class: "ds-label", style: "display:flex;align-items:center;justify-content:space-between" },
          el("span", {}, "Ingredients ", el("span", { class: "ds-label-note" }, `— ${rows.length} row${rows.length === 1 ? "" : "s"}`)),
          el("button", { type: "button", class: "btn btn-sm", onclick: () => { state.bulkIssueOpen = true; state.bulkIssueSelected = []; state.bulkIssueLines = {}; render(); } }, "+ Issue Ingredient")),
        !rows.length ? el("div", { class: "readonly-note" }, "No ingredients recorded for this batch yet.") : el("div", { class: "ws-table-scroll" },
          el("table", { class: "bm-table" },
            el("thead", {}, el("tr", {}, el("th", {}, "Ingredient"), el("th", { class: "num" }, "Recommended"), el("th", { class: "num" }, "Issued"), el("th", { class: "num" }, "Returned"), el("th", { class: "num" }, "Consumed"), el("th", { class: "num" }, "Remaining"), el("th", { class: "num" }, "Variance"), el("th", {}, "Actions"))),
            el("tbody", {}, ...rows.map((r) => {
              const availableToReturn = r.issuedQty - r.returnedQty;
              return el("tr", {},
                el("td", {}, r.ingredientName, !r.recipeIngredient ? el("span", { class: "bm-chip" }, "Manual") : null),
                el("td", { class: "num" }, `${r.recommendedQty.toFixed(2)} ${r.uom}`),
                el("td", { class: "num" }, `${r.issuedQty.toFixed(2)} ${r.uom}`),
                el("td", { class: "num" }, `${r.returnedQty.toFixed(2)} ${r.uom}`),
                el("td", { class: "num" }, `${r.netConsumed.toFixed(2)} ${r.uom}`),
                el("td", { class: "num" }, `${r.remainingRecommended.toFixed(2)} ${r.uom}`),
                el("td", { class: "num " + varianceClass(r.variance), style: r.variance < 0 ? "color:var(--fb-amber-700,#c2410c);font-weight:700" : "" }, `${r.variance > 0 ? "+" : ""}${r.variance.toFixed(2)} ${r.uom}`),
                el("td", {}, KebabButton("ing-" + r.ingredientId, "ws-table-kebab", `More actions for ${r.ingredientName}`, rowKebabActions(r, availableToReturn))));
            }))))));
  }

  function issueDrawer() {
    const b = state.batch;
    const d = state.issueDraft;
    const recipeOptions = (b.ingredientSummary || []).filter((r) => r.recipeIngredient);
    const selectedRow = recipeOptions.find((r) => r.ingredientId === d.ingredientId) || null;
    const canSubmit = !state.busy && Number(d.quantity) > 0 && d.uom.trim() !== "" && d.warehouseId.trim() !== "" && d.ingredientId !== "";
    return el("div", { class: "ws-modal", role: "dialog", "aria-modal": "true", "aria-label": "Issue ingredient" },
      el("div", { class: "ws-modal-head" },
        el("div", {}, el("div", { class: "ws-modal-title" }, "Issue Ingredient"), el("div", { class: "ws-modal-sub" }, `Record an ingredient issued against ${b.batchNumber}.`)),
        el("button", { type: "button", class: "ws-modal-close", "aria-label": "Close", disabled: state.busy || undefined, onclick: closeIssueDrawer }, "✕")),
      el("div", { class: "fld", style: "margin-top:14px" },
        el("label", { class: "label" }, "Ingredient ", el("span", { class: "req" }, "*")),
        el("select", {
          class: "input", value: d.ingredientId, disabled: state.busy || undefined,
          onchange: (e) => { d.ingredientId = e.target.value; const r = recipeOptions.find((x) => x.ingredientId === e.target.value); if (r) d.uom = r.uom; render(); },
        }, el("option", { value: "" }, "Select an ingredient…"), ...recipeOptions.map((r) => el("option", { value: r.ingredientId }, r.ingredientName)))),
      selectedRow ? el("div", { class: "ov-block", style: "margin-top:12px" },
        el("div", { class: "kv" }, el("span", { class: "k" }, "Recommended"), el("span", { class: "v" }, `${selectedRow.recommendedQty.toFixed(2)} ${selectedRow.uom}`)),
        el("div", { class: "kv" }, el("span", { class: "k" }, "Already Issued"), el("span", { class: "v" }, `${selectedRow.issuedQty.toFixed(2)} ${selectedRow.uom}`)),
        el("div", { class: "kv" }, el("span", { class: "k" }, "Remaining Recommendation"), el("span", { class: "v" }, `${selectedRow.remainingRecommended.toFixed(2)} ${selectedRow.uom}`))) : null,
      el("div", { class: "fld", style: "margin-top:10px" }, el("label", { class: "label" }, "Quantity ", el("span", { class: "req" }, "*")), el("input", { class: "input", type: "number", min: "0", step: "0.01", value: d.quantity, disabled: state.busy || undefined, oninput: (e) => { d.quantity = e.target.value; render(); } })),
      el("div", { class: "fld", style: "margin-top:10px" }, el("label", { class: "label" }, "UOM ", el("span", { class: "req" }, "*")), el("input", { class: "input", value: d.uom, disabled: true, readonly: true })),
      el("div", { class: "fld", style: "margin-top:10px" }, el("label", { class: "label" }, "Warehouse ", el("span", { class: "req" }, "*")), el("input", { class: "input", value: d.warehouseId, disabled: state.busy || undefined, oninput: (e) => { d.warehouseId = e.target.value; render(); } })),
      el("div", { class: "ws-comment-field", style: "margin-top:10px" },
        el("label", { class: "ws-su-label", style: "display:block;margin-bottom:6px" }, "Remarks (optional)"),
        el("textarea", { placeholder: "Add a note about this issue…", maxlength: "250", value: d.remarks, disabled: state.busy || undefined, oninput: (e) => { d.remarks = e.target.value; render(); } }),
        el("div", { class: "ws-comment-count" }, `${d.remarks.length}/250`)),
      state.error ? el("div", { role: "alert", class: "error small", style: "margin-top:12px" }, state.error) : null,
      el("div", { class: "ws-modal-footer" },
        el("button", { type: "button", class: "btn", disabled: state.busy || undefined, onclick: closeIssueDrawer }, "Cancel"),
        el("button", { type: "button", class: "btn btn-primary", disabled: !canSubmit, onclick: submitIssue }, state.busy ? "Issuing…" : "Issue Ingredient")));
  }
  function closeIssueDrawer() { if (state.busy) return; state.issueFor = null; state.error = null; render(); }
  async function submitIssue() {
    state.busy = true; state.error = null; render();
    try {
      const d = state.issueDraft;
      const updated = await MockApi.issueIngredient(state.batch.id, { ingredientId: d.ingredientId, quantity: Number(d.quantity), uom: d.uom.trim(), warehouseId: d.warehouseId.trim(), remarks: d.remarks.trim() || undefined });
      state.batch = updated; state.issueFor = null;
    } catch (e) { state.error = e.message; } finally { state.busy = false; render(); }
  }

  function bulkIssueDrawer() {
    const b = state.batch;
    const recipeOptions = (b.ingredientSummary || []).filter((r) => r.recipeIngredient);
    const selectedRows = recipeOptions.filter((r) => state.bulkIssueSelected.includes(r.ingredientId));
    const lineValid = (id) => { const l = state.bulkIssueLines[id]; return !!l && Number(l.quantity) > 0 && l.warehouseId.trim() !== ""; };
    const canSubmit = !state.busy && selectedRows.length > 0 && selectedRows.every((r) => lineValid(r.ingredientId));
    return el("div", { class: "ws-modal ws-modal-wide", role: "dialog", "aria-modal": "true", "aria-label": "Issue ingredients" },
      el("div", { class: "ws-modal-head" },
        el("div", {}, el("div", { class: "ws-modal-title" }, "Issue Ingredients"), el("div", { class: "ws-modal-sub" }, `Select ingredients to issue against ${b.batchNumber} in one go.`)),
        el("button", { type: "button", class: "ws-modal-close", "aria-label": "Close", disabled: state.busy || undefined, onclick: closeBulkIssue }, "✕")),
      el("div", { class: "fld", style: "margin-top:14px" },
        el("label", { class: "label" }, "Ingredients ", el("span", { class: "req" }, "*")),
        el("div", { class: "bulk-issue-picker" }, ...recipeOptions.map((r) => el("label", { class: "bulk-issue-picker-row" },
          el("input", {
            type: "checkbox", checked: state.bulkIssueSelected.includes(r.ingredientId) || undefined, disabled: state.busy || undefined,
            onchange: () => {
              if (state.bulkIssueSelected.includes(r.ingredientId)) state.bulkIssueSelected = state.bulkIssueSelected.filter((x) => x !== r.ingredientId);
              else { state.bulkIssueSelected.push(r.ingredientId); if (!state.bulkIssueLines[r.ingredientId]) state.bulkIssueLines[r.ingredientId] = { quantity: "", warehouseId: "", remarks: "" }; }
              render();
            },
          }),
          el("span", { class: "bulk-issue-picker-name" }, r.ingredientName),
          el("span", { class: "muted small" }, `Remaining ${r.remainingRecommended.toFixed(2)} ${r.uom}`))))),
      selectedRows.length > 0 ? el("div", { class: "ws-table-scroll", style: "margin-top:14px" },
        el("table", { class: "bm-table" },
          el("thead", {}, el("tr", {}, el("th", {}, "Ingredient"), el("th", { class: "num" }, "Quantity"), el("th", {}, "UOM"), el("th", {}, "Warehouse"), el("th", {}, "Remarks"))),
          el("tbody", {}, ...selectedRows.map((r) => {
            const l = state.bulkIssueLines[r.ingredientId] || {};
            return el("tr", {},
              el("td", {}, r.ingredientName),
              el("td", { class: "num" }, el("input", { class: "input qty-input", type: "number", min: "0", step: "0.01", value: l.quantity ?? "", disabled: state.busy || undefined, oninput: (e) => { l.quantity = e.target.value; render(); } })),
              el("td", {}, r.uom),
              el("td", {}, el("input", { class: "input", value: l.warehouseId ?? "", disabled: state.busy || undefined, oninput: (e) => { l.warehouseId = e.target.value; render(); } })),
              el("td", {}, el("input", { class: "input", value: l.remarks ?? "", disabled: state.busy || undefined, oninput: (e) => { l.remarks = e.target.value; render(); } }), l.error ? el("div", { role: "alert", class: "error small" }, l.error) : null));
          })))) : null,
      state.error ? el("div", { role: "alert", class: "error small", style: "margin-top:12px" }, state.error) : null,
      el("div", { class: "ws-modal-footer" },
        el("button", { type: "button", class: "btn", disabled: state.busy || undefined, onclick: closeBulkIssue }, "Cancel"),
        el("button", { type: "button", class: "btn btn-primary", disabled: !canSubmit, onclick: submitBulkIssue }, state.busy ? "Issuing…" : selectedRows.length > 0 ? `Issue ${selectedRows.length} Ingredient${selectedRows.length === 1 ? "" : "s"}` : "Issue Ingredients")));
  }
  function closeBulkIssue() { if (state.busy) return; state.bulkIssueOpen = false; state.error = null; render(); }
  async function submitBulkIssue() {
    state.busy = true; state.error = null; render();
    try {
      const b = state.batch;
      const recipeOptions = (b.ingredientSummary || []).filter((r) => r.recipeIngredient);
      const selectedRows = recipeOptions.filter((r) => state.bulkIssueSelected.includes(r.ingredientId));
      const items = selectedRows.map((r) => { const l = state.bulkIssueLines[r.ingredientId]; return { ingredientId: r.ingredientId, quantity: Number(l.quantity), uom: r.uom, warehouseId: l.warehouseId.trim(), remarks: l.remarks.trim() || undefined }; });
      const { results } = await MockApi.bulkIssueIngredient(b.id, { items });
      const failed = results.filter((r) => !r.ok);
      state.batch = await MockApi.getBatch(b.id);
      if (failed.length === 0) { state.bulkIssueOpen = false; }
      else { state.bulkIssueSelected = failed.map((f) => f.ingredientId); }
    } catch (e) { state.error = e.message; } finally { state.busy = false; render(); }
  }

  function returnDrawer() {
    const b = state.batch;
    const row = state.returnFor;
    const d = state.returnDraft;
    const availableToReturn = row.issuedQty - row.returnedQty;
    const qtyOk = Number(d.quantity) > 0 && Number(d.quantity) <= availableToReturn;
    const canSubmit = !state.busy && qtyOk && d.warehouseId.trim() !== "";
    return el("div", { class: "ws-modal", role: "dialog", "aria-modal": "true", "aria-label": "Return ingredient" },
      el("div", { class: "ws-modal-head" },
        el("div", {}, el("div", { class: "ws-modal-title" }, "Return Ingredient"), el("div", { class: "ws-modal-sub" }, `${row.ingredientName} — available to return: ${availableToReturn.toFixed(2)} ${row.uom}`)),
        el("button", { type: "button", class: "ws-modal-close", "aria-label": "Close", disabled: state.busy || undefined, onclick: closeReturnDrawer }, "✕")),
      el("div", { class: "fld", style: "margin-top:14px" }, el("label", { class: "label" }, "Quantity ", el("span", { class: "req" }, "*")), el("input", { class: "input", type: "number", min: "0", step: "0.01", max: availableToReturn, value: d.quantity, disabled: state.busy || undefined, oninput: (e) => { d.quantity = e.target.value; render(); } })),
      d.quantity !== "" && !qtyOk ? el("div", { class: "nb nb-bad" }, `Enter a quantity greater than 0 and no more than ${availableToReturn.toFixed(2)} ${row.uom}.`) : null,
      el("div", { class: "fld", style: "margin-top:10px" }, el("label", { class: "label" }, "Warehouse ", el("span", { class: "req" }, "*")), el("input", { class: "input", value: d.warehouseId, disabled: state.busy || undefined, oninput: (e) => { d.warehouseId = e.target.value; render(); } })),
      el("div", { class: "ws-comment-field", style: "margin-top:10px" },
        el("label", { class: "ws-su-label", style: "display:block;margin-bottom:6px" }, "Reason (optional)"),
        el("textarea", { placeholder: "Why is this being returned?", maxlength: "250", value: d.remarks, disabled: state.busy || undefined, oninput: (e) => { d.remarks = e.target.value; render(); } }),
        el("div", { class: "ws-comment-count" }, `${d.remarks.length}/250`)),
      state.error ? el("div", { role: "alert", class: "error small", style: "margin-top:12px" }, state.error) : null,
      el("div", { class: "ws-modal-footer" },
        el("button", { type: "button", class: "btn", disabled: state.busy || undefined, onclick: closeReturnDrawer }, "Cancel"),
        el("button", { type: "button", class: "btn btn-primary", disabled: !canSubmit, onclick: submitReturn }, state.busy ? "Returning…" : "Return Ingredient")));
  }
  function closeReturnDrawer() { if (state.busy) return; state.returnFor = null; state.error = null; render(); }
  async function submitReturn() {
    state.busy = true; state.error = null; render();
    try {
      const row = state.returnFor, d = state.returnDraft;
      const updated = await MockApi.returnIngredient(state.batch.id, { ingredientId: row.ingredientId, quantity: Number(d.quantity), warehouseId: d.warehouseId.trim(), remarks: d.remarks.trim() || undefined });
      state.batch = updated; state.returnFor = null;
    } catch (e) { state.error = e.message; } finally { state.busy = false; render(); }
  }

  function historyDrawer() {
    const row = state.historyFor;
    const txns = state.historyData;
    const sorted = txns ? txns.slice().sort((a, b) => (a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0)) : null;
    return el("div", { class: "ws-modal", role: "dialog", "aria-modal": "true", "aria-label": "Ingredient history" },
      el("div", { class: "ws-modal-head" },
        el("div", {}, el("div", { class: "ws-modal-title" }, `History — ${row.ingredientName}`), el("div", { class: "ws-modal-sub" }, `Every issue/return transaction for this ingredient on ${state.batch.batchNumber}.`)),
        el("button", { type: "button", class: "ws-modal-close", "aria-label": "Close", onclick: () => { state.historyFor = null; render(); } }, "✕")),
      !sorted ? el("div", { class: "ws-note", style: "margin-top:14px" }, "Loading…")
        : !sorted.length ? el("div", { class: "ws-note", style: "margin-top:14px" }, "No transactions recorded yet.")
        : el("div", { class: "ws-timeline", style: "margin-top:14px" }, ...sorted.map((t) =>
            el("div", { class: "ws-tl-item" },
              el("div", { class: "ws-tl-node " + (t.transactionType === "issue" ? "complete" : "reject"), "aria-hidden": "true" }, t.transactionType === "issue" ? "↦" : "↩"),
              el("div", { class: "ws-tl-content" },
                el("div", { class: "ws-tl-title" }, `${t.transactionType === "issue" ? "Issued" : "Returned"} — ${t.quantity} ${t.uom} — ${t.warehouseId}`),
                el("div", { class: "ws-tl-meta" }, `${fmtDateNice(t.timestamp)} at ${fmtTime(t.timestamp)} · by ${t.actor}`),
                t.remarks ? el("div", { class: "ws-tl-comment" }, `"${t.remarks}"`) : null)))),
      el("div", { class: "ws-modal-footer" }, el("button", { type: "button", class: "btn", onclick: () => { state.historyFor = null; render(); } }, "Close")));
  }

  // ── Activity tab — 5-source merged timeline ──
  function dateEditTitle(entry) {
    const planned = !!entry.plannedDate;
    const expected = !!entry.expectedFinishDate;
    if (planned && expected) return "Dates updated";
    if (planned) return "Planned date updated";
    if (!entry.expectedFinishDate.from) return "Expected finish date added";
    if (!entry.expectedFinishDate.to) return "Expected finish date cleared";
    return "Expected finish date updated";
  }
  function activityTab() {
    const b = state.batch;
    const items = [
      ...(b.statusHistory || []).map((entry) => ({ kind: "transition", key: "t-" + entry.timestamp, timestamp: entry.timestamp, entry })),
      ...(b.dateEditHistory || []).map((entry) => ({ kind: "date-edit", key: "d-" + entry.timestamp, timestamp: entry.timestamp, entry })),
      ...((b.inventorySync && b.inventorySync.events) || []).map((entry, i) => ({ kind: "inventory-sync", key: `i-${entry.timestamp}-${i}`, timestamp: entry.timestamp, entry })),
      ...(b.operatorHandoverHistory || []).map((entry) => ({ kind: "handover", key: "h-" + entry.timestamp, timestamp: entry.timestamp, entry })),
      ...(b.ingredientTransactions || []).map((entry, i) => ({ kind: "ingredient-transaction", key: `g-${entry.timestamp}-${i}`, timestamp: entry.timestamp, entry })),
    ].sort((a, c) => (a.timestamp > c.timestamp ? -1 : a.timestamp < c.timestamp ? 1 : 0));

    if (!items.length) return el("div", { class: "ws-note" }, "No activity recorded yet.");

    const nodes = items.map((item) => {
      const ago = elapsedStr(item.timestamp);
      const when = `${fmtDateNice(item.timestamp)} at ${fmtTime(item.timestamp)}${ago ? ` · ${ago} ago` : ""} · by ${item.entry.actor}`;
      if (item.kind === "transition") {
        const h = item.entry;
        const meta = ACTIVITY_META[h.triggerLabel] || { icon: "•", cls: "", phrase: h.triggerLabel };
        const mismatchLines = h.triggerLabel === "Complete" && h.comment && b.actualOutcome && b.actualOutcome.settlementRequired ? describeOutcomeMismatch(b.actualOutcome, b.batchUnit ?? "kg") : [];
        return el("div", { class: "ws-tl-item" },
          el("div", { class: "ws-tl-node " + meta.cls, "aria-hidden": "true" }, meta.icon),
          el("div", { class: "ws-tl-content" },
            el("div", { class: "ws-tl-title" }, meta.phrase),
            el("div", { class: "ws-tl-meta" }, when),
            h.comment ? el("div", { class: "ws-tl-comment" }, `"${h.comment}"`) : null,
            mismatchLines.length ? el("div", { class: "ws-tl-variance-note" }, `⚠ Recorded because actual output differed from expected: ${mismatchLines.join("; ")}`) : null));
      }
      if (item.kind === "date-edit") {
        const d = item.entry;
        return el("div", { class: "ws-tl-item" },
          el("div", { class: "ws-tl-node", "aria-hidden": "true" }, "🗓"),
          el("div", { class: "ws-tl-content" },
            el("div", { class: "ws-tl-title" }, dateEditTitle(d)),
            el("div", { class: "ws-tl-meta" }, when),
            d.plannedDate ? el("div", { class: "ws-tl-comment" }, `Planned: ${fmtDateNice(d.plannedDate.from)} → ${fmtDateNice(d.plannedDate.to)}`) : null,
            d.expectedFinishDate ? el("div", { class: "ws-tl-comment" }, `Expected Finish: ${fmtDateNice(d.expectedFinishDate.from)} → ${fmtDateNice(d.expectedFinishDate.to)}`) : null,
            d.note ? el("div", { class: "ws-tl-comment" }, `"${d.note}"`) : null));
      }
      if (item.kind === "inventory-sync") {
        const e = item.entry;
        const lineName = inventorySyncLineName(b, e.lineRef);
        const syncLine = b.inventorySync ? b.inventorySync.lines.find((l) => l.lineRef === e.lineRef) : null;
        const showsVariance = e.status === "ok" && (e.action === "post" || e.action === "retry") && syncLine && syncLine.actualQty != null && syncLine.actualQty !== syncLine.expectedQty;
        return el("div", { class: "ws-tl-item" },
          el("div", { class: "ws-tl-node " + (e.status === "ok" ? "complete" : "reject"), "aria-hidden": "true" }, e.status === "ok" ? "✓" : "✗"),
          el("div", { class: "ws-tl-content" },
            el("div", { class: "ws-tl-title" }, `${lineName} — ${INVENTORY_SYNC_ACTION_LABEL[e.action]}`),
            el("div", { class: "ws-tl-meta" }, when),
            e.message ? el("div", { class: "ws-tl-comment" }, `"${e.message}"`) : null,
            showsVariance ? el("div", { class: "ws-tl-variance-note" }, `⚠ Differs from expected: ${describeInventorySyncVariance(lineName, syncLine.expectedQty, syncLine.actualQty)}`) : null));
      }
      if (item.kind === "handover") {
        const h = item.entry;
        return el("div", { class: "ws-tl-item" },
          el("div", { class: "ws-tl-node", "aria-hidden": "true" }, "🤝"),
          el("div", { class: "ws-tl-content" },
            el("div", { class: "ws-tl-title" }, "Batch handed over"),
            el("div", { class: "ws-tl-meta" }, when),
            el("div", { class: "ws-tl-comment" }, `${h.fromOperator ?? "Unassigned"} → ${h.toOperator}`),
            h.comment ? el("div", { class: "ws-tl-comment" }, `"${h.comment}"`) : null));
      }
      const t = item.entry;
      return el("div", { class: "ws-tl-item" },
        el("div", { class: "ws-tl-node " + (t.transactionType === "issue" ? "complete" : "reject"), "aria-hidden": "true" }, t.transactionType === "issue" ? "↦" : "↩"),
        el("div", { class: "ws-tl-content" },
          el("div", { class: "ws-tl-title" }, `${t.ingredientName} ${t.transactionType === "issue" ? "issued" : "returned"} — ${t.quantity} ${t.uom} — ${t.warehouseId}`),
          el("div", { class: "ws-tl-meta" }, when),
          t.remarks ? el("div", { class: "ws-tl-comment" }, `"${t.remarks}"`) : null));
    });

    return el("div", { class: "ws-section" }, el("div", { class: "ws-section-title" }, "Activity Log"), el("div", { class: "ws-timeline" }, ...nodes));
  }

  function printLabel() {
    const b = state.batch;
    return el("div", { class: "print-label" },
      el("div", { class: "pl-box" },
        el("div", { class: "pl-brand" }, "Batch Label"),
        el("div", { class: "pl-product" }, b.displayName),
        el("div", { class: "pl-row" }, el("span", {}, "Batch No."), el("b", {}, b.batchNumber)),
        el("div", { class: "pl-row" }, el("span", {}, "Batch Size"), el("b", {}, `${b.batchSize ?? "—"} ${b.batchUnit ?? "kg"}`)),
        el("div", { class: "pl-row" }, el("span", {}, "Planned Date"), el("b", {}, fmtDateNice(b.plannedDate))),
        el("div", { class: "pl-row" }, el("span", {}, "Expected Finish"), el("b", {}, fmtDateNice(b.expectedFinishDate))),
        el("div", { class: "pl-row" }, el("span", {}, "Operator"), el("b", {}, b.operator ?? "—"))));
  }

  // ── modal mount (generic — swaps content by state) ──
  function mountModal() {
    if (modalScrimEl) return;
    modalBodyEl = el("div", { style: "display:contents" });
    modalScrimEl = el("div", { class: "ws-modal-scrim", onclick: (e) => { if (e.target === modalScrimEl) closeAnyModal(); } }, modalBodyEl);
    document.querySelector(".fbp-root").appendChild(modalScrimEl);
    document.addEventListener("keydown", onModalKeydown);
  }
  function closeAnyModal() {
    if (state.confirmingUpdate) closeConfirmModal();
    else if (state.editingDates) closeEditDates();
    else if (state.issueFor) closeIssueDrawer();
    else if (state.bulkIssueOpen) closeBulkIssue();
    else if (state.returnFor) closeReturnDrawer();
    else if (state.historyFor) { state.historyFor = null; render(); }
  }
  function focusableEls(root) {
    return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
  }
  function onModalKeydown(e) {
    // InventorySyncDrawer manages its own scrim/focus independently (shared with
    // inventory-sync.js) — this generic modal only tracks the ones it itself mounts.
    const anyOpen = state.confirmingUpdate || state.editingDates || state.issueFor || state.bulkIssueOpen || state.returnFor || state.historyFor;
    if (!anyOpen) return;
    if (e.key === "Escape") { e.preventDefault(); closeAnyModal(); return; }
    if (e.key !== "Tab") return;
    const items = focusableEls(modalBodyEl);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function render() {
    const root = document.getElementById("detail-root");
    root.innerHTML = "";

    if (!state.batch) { root.appendChild(LoadingOverlay()); return; }
    const b = state.batch;

    root.appendChild(el("div", { class: "ds-header" },
      el("div", { class: "ds-topline" }, el("span", { class: "ds-batchno" }, b.batchNumber), el("span", { class: "ds-close", onclick: goClose }, "✕")),
      el("div", { class: "ds-title" }, b.displayName),
      el("div", { class: "ds-header-meta" }, el("span", { class: "badge " + statusBadgeClass(b.statusLabel) }, el("span", { class: "dot" }), b.statusLabel))));

    root.appendChild(el("div", { class: "ds-tabs seg block" }, ...["overview", "ingredients", "activity"].map((t) =>
      el("button", { type: "button", class: state.tab === t ? "on" : "", onclick: () => { state.tab = t; render(); } }, t[0].toUpperCase() + t.slice(1)))));

    root.appendChild(el("div", { class: "ds-tabcontent" },
      state.tab === "overview" ? overviewTab() : state.tab === "ingredients" ? ingredientsTab() : activityTab()));

    const printRoot = document.getElementById("print-label-root");
    printRoot.innerHTML = "";
    printRoot.appendChild(printLabel());

    mountModal();
    modalBodyEl.innerHTML = "";
    let content = null;
    if (state.confirmingUpdate) content = state.selectedTrigger === "complete" ? confirmCompleteModal() : confirmUpdateModal();
    else if (state.editingDates) content = editDatesModal();
    else if (state.issueFor) content = issueDrawer();
    else if (state.bulkIssueOpen) content = bulkIssueDrawer();
    else if (state.returnFor) content = returnDrawer();
    else if (state.historyFor) content = historyDrawer();

    if (content) {
      modalBodyEl.appendChild(content);
      modalScrimEl.classList.add("in");
      if (pendingModalFocus) { pendingModalFocus = false; modalBodyEl.querySelector(".ws-modal-close")?.focus(); }
    } else {
      modalScrimEl.classList.remove("in");
    }
  }

  if (!batchId) {
    document.getElementById("detail-root").appendChild(el("p", { class: "muted small", style: "padding:20px" }, "No batch id in the URL."));
  } else {
    MockApi.getBatch(batchId).then((b) => { state.batch = b; render(); });
  }
})();
