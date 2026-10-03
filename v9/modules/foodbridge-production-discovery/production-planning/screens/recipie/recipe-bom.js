/* ============================================================
   recipe-bom.js — recipes as a bill of materials (v9, 3 Oct 2026).

   The owner: "one recipe can be of a finished good or a semi-finished
   good, or a finished good as well as an ingredient to some other
   finished good as its semi-finished". So any product made here can go
   into any other recipe — cut → dough → finished → another finished —
   never in a loop (the engine refuses one: D.saveIngredient).

   Runs after recipe-v4.js and takes over, in the capture phase, the
   parts that only drew on screen before:
     · the rail: filter (All · Finished · Semi-finished · Goes into
       others), sort, and a search that also matches ingredients
     · an ingredient's Save and Remove, kept in the store
     · Add Ingredient: a picker over everything in the store — raw
       materials, semi-finished and finished goods — that says why a
       pick isn't possible (already in, this recipe, would loop)
     · Goes into: the recipes this one is an ingredient of
     · Create New Recipe: a real recipe, finished or semi-finished
   A change saves, then the page redraws on the same tab with one line
   saying what was saved. Nothing animates.
   ============================================================ */
(function () {
  'use strict';
  if (!window.FB_PRODUCTION || !window.FB_RECIPE) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = (v) => (Math.round(v * 100) / 100).toLocaleString('en-IN');
  const RID = FB_RECIPE.id;
  const FLASH = 'fb.v9.recipes.flash', RAIL = 'fb.v9.recipes.rail';
  const who = () => { try { const a = (window.parent.FBContext || window.FBContext).account(); if (a && a.name && !a.guest) return a.name; } catch (e) { /* standalone */ } return 'Owner'; };

  function tabNow() { const t = $('.v4-tabs .t.on'); return t ? t.getAttribute('data-v4tab') : 'ingredients'; }
  function go(id, tab, flash) {
    try { if (flash) sessionStorage.setItem(FLASH, flash); } catch (e) { /* this visit only */ }
    location.search = '?recipe=' + encodeURIComponent(id) + (tab && tab !== 'ingredients' ? '&tab=' + tab : '');
  }
  /* the store's own refusal, word for word */
  function save(fn) {
    try { FB_PRODUCTION.write(fn); return ''; } catch (e) { return (e && e.body && e.body.error) || e.message || "That didn't save."; }
  }
  const ref = (key) => { const i = key.indexOf(':'); return { kind: key.slice(0, i), id: key.slice(i + 1) }; };

  /* ── the rail: one search, one switch (owner, 3 Oct 2026: the chips, counts
     and sort were "cluttered, very high cognitive load"). The search still
     finds a recipe by what goes into it. ── */
  const rs = { f: 'all', q: '' };
  try { Object.assign(rs, JSON.parse(sessionStorage.getItem(RAIL) || '{}')); } catch (e) { /* defaults */ }
  if (['all', 'finished', 'semi'].indexOf(rs.f) === -1) rs.f = 'all';
  const KIND = [['all', 'All'], ['finished', 'Finished'], ['semi', 'Semi-finished']];
  function railTools() {
    const search = $('#rail-search');
    if (!search || $('.rl-seg')) return;
    search.placeholder = 'Search recipes';
    search.value = rs.q;
    search.insertAdjacentHTML('afterend', `<div class="rl-seg" role="tablist" aria-label="Show">${KIND.map(([k, l]) => `<button type="button" role="tab" data-rf="${k}" aria-selected="${rs.f === k}">${l}</button>`).join('')}</div>`);
    drawRail();
  }
  function drawRail() {
    const list = $('#rail-list');
    if (!list) return;
    const q = rs.q.trim().toLowerCase();
    let any = false;
    $$('.rl-item[data-rid]', list).forEach((it) => {
      it.hidden = !((rs.f === 'all' || it.dataset.kind === rs.f) && (!q || (it.dataset.find || '').indexOf(q) !== -1));
      if (!it.hidden) any = true;
    });
    /* a group's heading only over what it shows, and only when both show */
    $$('.rl-group', list).forEach((g) => {
      let el = g.nextElementSibling, has = false;
      while (el && !el.classList.contains('rl-group')) { if (el.matches('.rl-item') && !el.hidden) has = true; el = el.nextElementSibling; }
      g.hidden = !has || rs.f !== 'all';
    });
    const none = $('.rl-none', list);
    if (!any && !none) list.insertAdjacentHTML('beforeend', '<div class="rl-none">No recipe found. <button type="button" class="rl-clear" data-rclear>Show all</button></div>');
    if (any && none) none.remove();
    $$('[data-rf]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.rf === rs.f)));
    try { sessionStorage.setItem(RAIL, JSON.stringify(rs)); } catch (e) { /* this visit only */ }
  }
  document.addEventListener('input', (e) => {
    if (e.target.id === 'rail-search') { e.stopImmediatePropagation(); rs.q = e.target.value; drawRail(); }
  }, true);
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-rf]');
    if (c) { e.preventDefault(); rs.f = c.dataset.rf; drawRail(); return; }
    if (e.target.closest('[data-rclear]')) { e.preventDefault(); rs.f = 'all'; rs.q = ''; const s2 = $('#rail-search'); if (s2) s2.value = ''; drawRail(); }
  });

  /* ── what the picker and the rows need from the store ──────────── */
  const store = FB_PRODUCTION.read((D, d) => {
    const bk = D.book(RID);
    const mine = bk.ingredients.map((i) => D.ingKey(i));
    const loop = (id) => { const p = D.wouldLoop(RID, id); return p ? p.join(' ← ') : ''; };
    return {
      name: bk.name, base: bk.base,
      ings: bk.ingredients.map((i) => ({ key: D.ingKey(i), name: i.name, sfId: i.sfId || null, rmId: i.rmId || null, unit: i.unit })),
      usedIn: D.usedIn(RID),
      options: [].concat(
        d.materials.map((m) => ({ key: 'rm:' + m.id, type: 'raw', name: m.name, unit: m.unit,
          info: (m.kind === 'packaging' ? 'Packaging' : 'Raw material') + (m.grade ? ' · ' + m.grade : '') + ' · ' + n(D.onHand(m.id)) + ' ' + m.unit + ' in store · ₹' + n(m.price) + ' / ' + m.unit,
          off: mine.indexOf('rm:' + m.id) !== -1 ? 'Already in this recipe' : '' })),
        D.recipes().map((r) => {
          const fin = r.kind === 'finished', why = r.id === RID ? 'This recipe' : mine.indexOf('sf:' + r.id) !== -1 ? 'Already in this recipe' : loop(r.id) ? 'Made from this recipe (' + loop(r.id) + ')' : '';
          return { key: 'sf:' + r.id, type: fin ? 'finished' : 'semi', name: r.name, emoji: r.emoji, unit: 'kg',
            info: (fin ? 'Finished good · ' + D.packs(r.id).length + (D.packs(r.id).length === 1 ? ' pack · ' : ' packs · ') + n(D.inFreezer(r.id)) + ' kg bulk' : 'Semi-finished · ' + n(D.inFreezer(r.id)) + ' kg in the cold store') + ' · ₹' + n(D.costPerKg(r.id)) + ' / kg',
            off: why };
        })),
    };
  });

  /* ── an ingredient's row: Save and Remove, kept in the store ────── */
  const ingOf = (row) => store.ings.find((x) => x.key === row.getAttribute('data-ref'));
  function rowErr(row, msg) {
    let box = $('.ing-err', row);
    if (!box) { box = document.createElement('div'); box.className = 'ing-err'; $('.save-row', row).insertAdjacentElement('beforebegin', box); }
    box.textContent = msg; box.hidden = !msg;
  }
  const val = (row, f) => { const el = $(`[data-f="${f}"]`, row); return el ? el.value : undefined; };
  function rowSave(row) {
    const ing = ingOf(row);
    if (!ing) return;
    const o = { qty: val(row, 'qty'), yield: val(row, 'yield'), brand: val(row, 'brand'), unit: val(row, 'unit'), wastage: val(row, 'wastage') };
    if (ing.sfId) o.sfId = ing.sfId; else if (ing.rmId) o.rmId = ing.rmId; else o.name = ing.name;
    const err = save((D) => D.saveIngredient(RID, o, who()));
    if (err) return rowErr(row, err);
    go(RID, 'ingredients', `Saved ${ing.name}: ${n(Number(o.qty))} ${ing.sfId ? 'kg' : o.unit || ing.unit} per ${store.base} kg of ${store.name}.`);
  }
  function rowAsk(row) {
    const ing = ingOf(row), bar = $('.save-row', row);
    if (!ing || !bar) return;
    bar.dataset.was = bar.innerHTML;
    bar.classList.add('is-ask');
    bar.innerHTML = `<span class="ing-ask">Remove <b>${esc(ing.name)}</b> from ${esc(store.name)}?</span><button class="btn btn-sm" data-ing-rm-no>Keep it</button><button class="btn btn-sm btn-danger" data-ing-rm-yes>Remove</button>`;
    const y = $('[data-ing-rm-yes]', bar); if (y) y.focus();
  }
  function rowUnask(row) {
    const bar = $('.save-row', row);
    if (bar && bar.dataset.was != null) { bar.innerHTML = bar.dataset.was; delete bar.dataset.was; bar.classList.remove('is-ask'); }
  }
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.ing[data-ref]');
    if (!row) return;
    if (e.target.closest('[data-ing-save]')) { e.preventDefault(); e.stopImmediatePropagation(); rowSave(row); return; }
    if (e.target.closest('[data-ing-rm]')) { e.preventDefault(); e.stopImmediatePropagation(); rowAsk(row); return; }
    if (e.target.closest('[data-ing-rm-no]')) { e.preventDefault(); e.stopImmediatePropagation(); rowUnask(row); return; }
    if (e.target.closest('[data-ing-rm-yes]')) {
      e.preventDefault(); e.stopImmediatePropagation();
      const ing = ingOf(row), err = save((D) => D.removeIngredient(RID, ing.key, who()));
      if (err) { rowUnask(row); return rowErr(row, err); }
      go(RID, 'ingredients', `Removed ${ing.name} from ${store.name}.`);
    }
  }, true);
  /* Enter in a row's field saves it, Esc closes it */
  document.addEventListener('keydown', (e) => {
    const row = e.target.closest && e.target.closest('.ing[data-ref] .ing-edit');
    if (!row) return;
    if (e.key === 'Enter') { e.preventDefault(); rowSave(row.closest('.ing')); }
    else if (e.key === 'Escape') row.closest('.ing').classList.remove('open');
  });

  /* ── Add Ingredient: everything in the store, by kind ───────────── */
  const KINDS = [['all', 'All'], ['raw', 'Raw materials'], ['semi', 'Semi-finished'], ['finished', 'Finished goods']];
  const ps = { f: 'all', q: '', pick: null, err: '' };
  function pickerHtml() {
    const q = ps.q.trim().toLowerCase();
    const shown = store.options.filter((o) => (ps.f === 'all' || o.type === ps.f) && (!q || o.name.toLowerCase().indexOf(q) !== -1));
    const groups = KINDS.slice(1).map(([k, label]) => {
      const mine = shown.filter((o) => o.type === k);
      return mine.length ? `<div class="pick-g">${label}</div>` + mine.map((o) => `<button type="button" class="opt pick-o" data-pick="${esc(o.key)}"${o.off ? ' disabled' : ''}>
        <span class="pick-n">${o.emoji ? esc(o.emoji) + ' ' : ''}${esc(o.name)}</span><small>${esc(o.off || o.info)}</small></button>`).join('') : '';
    }).join('');
    const exact = store.options.some((o) => o.name.toLowerCase() === q);
    return `<div class="pick-top"><input class="input" data-pick-q value="${esc(ps.q)}" placeholder="Search raw materials, semi-finished and finished goods…" aria-label="Search ingredients" autocomplete="off">
        <button type="button" class="btn btn-sm" data-pick-close>Close</button></div>
      <div class="rl-seg pick-seg" role="tablist" aria-label="Kind">${KINDS.map(([k, l]) => `<button type="button" role="tab" data-pick-f="${k}" aria-selected="${ps.f === k}">${l}</button>`).join('')}</div>
      <div class="pick-list">${groups || '<div class="pick-none">Nothing matches.</div>'}</div>
      ${q && !exact ? `<button type="button" class="opt create" data-pick-plain>＋ Add “${esc(ps.q.trim())}” as an input that isn't stocked (water, steam…)</button>` : ''}`;
  }
  function qtyHtml(o) {
    const unitSel = o.type === 'raw' || o.type === 'plain'
      ? `<select class="input" data-pq-unit>${['kg', 'g', 'litre', 'ml', 'pcs'].map((u) => `<option${u === (o.unit || 'kg') ? ' selected' : ''}>${u}</option>`).join('')}</select>`
      : '<output class="input" style="display:block;background:#FAFBFC">kg</output>';
    return `<div class="pick-qty">
      <div class="pick-qh"><b>${esc(o.name)}</b> <span class="ing-type" data-t="${o.type}">${{ raw: 'Raw material', semi: 'Semi-finished', finished: 'Finished good', plain: 'Not stocked' }[o.type]}</span></div>
      ${o.type === 'finished' ? `<div class="muted small mb8">Taken from its bulk bags — what a ${esc(o.name)} run does not pack. Its process gets a step that bags the rest.</div>` : ''}
      <div class="grid"><div class="fld"><label class="label">Quantity <span class="muted">per ${store.base} kg of ${esc(store.name)}</span></label><input class="input" data-pq-qty type="number" min="0" step="0.01" placeholder="e.g. 20"></div>
        <div class="fld"><label class="label">Unit</label>${unitSel}</div></div>
      ${ps.err ? `<div class="ing-err">${esc(ps.err)}</div>` : ''}
      <div class="save-row"><button type="button" class="btn btn-sm" data-pq-back>Back</button><button type="button" class="btn btn-sm btn-primary" data-pq-add>Add to recipe</button></div>
    </div>`;
  }
  function drawPicker(focus) {
    const box = $('#add-search');
    if (!box) return;
    box.innerHTML = ps.pick ? qtyHtml(ps.pick) : pickerHtml();
    const f = ps.pick ? $('[data-pq-qty]', box) : $('[data-pick-q]', box);
    if (f && focus !== false) { f.focus(); if (!ps.pick) f.setSelectionRange(f.value.length, f.value.length); }
  }
  function openPicker() {
    const box = $('#add-search'), btn = $('[data-add-open]');
    if (!box) return;
    box.hidden = false; box.classList.add('pick'); if (btn) btn.hidden = true;
    ps.pick = null; ps.err = '';
    drawPicker();
  }
  function closePicker() {
    const box = $('#add-search'), btn = $('[data-add-open]');
    if (box) box.hidden = true; if (btn) btn.hidden = false;
    ps.pick = null; ps.err = '';
  }
  function addPicked() {
    const o = ps.pick, qty = Number(($('[data-pq-qty]') || {}).value), unit = ($('[data-pq-unit]') || {}).value;
    const body = { qty: qty };
    if (o.type === 'plain') { body.name = o.name; body.unit = unit; }
    else { const r = ref(o.key); if (r.kind === 'sf') body.sfId = r.id; else { body.rmId = r.id; body.unit = unit; } }
    const err = save((D) => D.saveIngredient(RID, body, who()));
    if (err) { ps.err = err; drawPicker(); return; }
    go(RID, 'ingredients', `Added ${o.name} to ${store.name}: ${n(qty)} ${body.unit || 'kg'} per ${store.base} kg.`);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-open]')) { e.preventDefault(); e.stopImmediatePropagation(); openPicker(); return; }
    const box = e.target.closest('#add-search');
    if (!box) return;
    e.stopImmediatePropagation();                                 /* recipe-v4.js's demo options stay out of it */
    if (e.target.closest('[data-pick-close]')) { e.preventDefault(); closePicker(); return; }
    const f = e.target.closest('[data-pick-f]');
    if (f) { ps.f = f.dataset.pickF; drawPicker(); return; }
    const o = e.target.closest('[data-pick]');
    if (o && !o.disabled) { ps.pick = store.options.find((x) => x.key === o.dataset.pick); ps.err = ''; drawPicker(); return; }
    if (e.target.closest('[data-pick-plain]')) { ps.pick = { key: 'nm:' + ps.q.trim(), type: 'plain', name: ps.q.trim(), unit: 'litre' }; ps.err = ''; drawPicker(); return; }
    if (e.target.closest('[data-pq-back]')) { ps.pick = null; ps.err = ''; drawPicker(); return; }
    if (e.target.closest('[data-pq-add]')) { e.preventDefault(); addPicked(); }
  }, true);
  document.addEventListener('input', (e) => {
    if (!e.target.matches('#add-search [data-pick-q]')) return;
    e.stopImmediatePropagation();
    ps.q = e.target.value;
    const list = $('#add-search'); const pos = e.target.selectionStart;
    drawPicker(); const f = $('[data-pick-q]', list); if (f) f.setSelectionRange(pos, pos);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!e.target.closest || !e.target.closest('#add-search')) return;
    if (e.key === 'Escape') { e.preventDefault(); if (ps.pick) { ps.pick = null; drawPicker(); } else closePicker(); }
    else if (e.key === 'Enter' && e.target.matches('[data-pq-qty]')) { e.preventDefault(); addPicked(); }
    else if (e.key === 'Enter' && e.target.matches('[data-pick-q]')) {
      e.preventDefault();
      const first = $('#add-search [data-pick]:not([disabled])');
      if (first) first.click(); else { const p = $('#add-search [data-pick-plain]'); if (p) p.click(); }
    }
  });

  /* ── Goes into: what this recipe is an ingredient of ─────────────── */
  function goesInto() {
    const at = $('.add-ing');
    if (!at || $('.ing-usedin')) return;
    const u = store.usedIn;
    at.insertAdjacentHTML('afterend', `<div class="ing-usedin"><div class="section-eyebrow mb8">Goes into · ${u.length}</div>${u.length
      ? u.map((x) => `<a class="ui-row" href="?recipe=${encodeURIComponent(x.id)}"><span>${esc((x.emoji || '') + ' ' + x.name)}<small>${x.kind === 'semi' ? 'Semi-finished' : 'Finished good'} recipe</small></span><b>${n(x.qty)} ${esc(x.unit)} <small>per ${x.base} kg</small></b><span class="ui-go">›</span></a>`).join('')
      : `<div class="muted small">Not an ingredient of any other recipe yet. Any recipe can take ${esc(store.name)} through its own Add Ingredient.</div>`}</div>`);
  }

  /* ── Create New Recipe: a real one ──────────────────────────────── */
  const nr = { kind: 'finished', err: '' };
  function newRecipeForm() {
    const d = $('#drawer-newrecipe');
    if (!d) return;
    const semi = nr.kind === 'semi';
    $('.dbody', d).innerHTML = `
      <div class="form-row"><span class="label">What it makes <span class="req">*</span></span>
        <div class="seg" role="radiogroup" aria-label="What it makes">
          <button type="button" class="seg-b" role="radio" data-nr-kind="finished" aria-checked="${!semi}"><b>Finished good</b><small>Sold in packs. Can also go into another recipe.</small></button>
          <button type="button" class="seg-b" role="radio" data-nr-kind="semi" aria-checked="${semi}"><b>Semi-finished good</b><small>Made to go into other recipes; kept in bags.</small></button>
        </div></div>
      <div class="form-row"><label class="label" for="nr-name">Recipe name <span class="req">*</span></label><input class="input" id="nr-name" data-nr="name" placeholder="${semi ? 'e.g. Chaap Pieces' : 'e.g. Veg Pulao Mix'}"></div>
      <div class="form-row"><label class="label" for="nr-line">Line</label><input class="input" id="nr-line" data-nr="line" placeholder="${semi ? 'Cutting · IQF' : 'Mixing · packing'}"></div>
      <div class="form-row"><label class="label" for="nr-sizes">Batch sizes (kg) <span class="muted">· comma separated</span></label><input class="input" id="nr-sizes" data-nr="sizes" placeholder="${semi ? '500, 1000, 5000' : '1000, 5000'}"></div>
      <div class="form-row"><label class="label" for="nr-best">Best before (days)</label><input class="input" id="nr-best" data-nr="best" type="number" min="1" placeholder="${semi ? '30' : '180'}"></div>
      ${semi ? `<div class="form-row"><label class="label" for="nr-bag">Fills bags of (kg)</label><input class="input" id="nr-bag" data-nr="bag" type="number" min="1" placeholder="50"></div>
        <div class="form-row"><label class="label" for="nr-msq">Minimum stock (MSQ, kg)</label><input class="input" id="nr-msq" data-nr="msq" type="number" min="0" placeholder="0"></div>`
        : `<div class="form-row"><label class="label" for="nr-cat">Category</label><input class="input" id="nr-cat" data-nr="category" placeholder="Frozen Vegetables"></div>`}
      <div class="muted small">Next: add its ingredients — raw materials, semi-finished goods, or another finished good. ${semi ? '' : 'Packs are added in Packaging.'}</div>
      ${nr.err ? `<div class="ing-err">${esc(nr.err)}</div>` : ''}`;
    $('.dfoot', d).innerHTML = '<button class="btn" data-drawer-close>Cancel</button><button class="btn btn-primary" data-nr-create>Create recipe</button>';
  }
  function createRecipe() {
    const d = $('#drawer-newrecipe'), v = (k) => { const el = $(`[data-nr="${k}"]`, d); return el ? el.value : ''; };
    let made = null;
    nr.err = save((D) => {
      made = D.createRecipe({ kind: nr.kind, name: v('name'), line: v('line'), sizes: v('sizes').split(/[,\s/]+/).filter(Boolean), bestBeforeDays: v('best'), bagKg: v('bag'), msq: v('msq'), category: v('category') }, who()).id;
    });
    if (nr.err) { const keep = Object.fromEntries($$('[data-nr]', d).map((x) => [x.dataset.nr, x.value])); newRecipeForm(); $$('[data-nr]', d).forEach((x) => { x.value = keep[x.dataset.nr] || ''; }); return; }
    go(made, 'ingredients', `Created ${v('name').trim()}. Add what goes into it.`);
  }
  document.addEventListener('click', (e) => {
    const k = e.target.closest('[data-nr-kind]');
    if (k) { e.preventDefault(); const name = ($('[data-nr="name"]') || {}).value || ''; nr.kind = k.dataset.nrKind; nr.err = ''; newRecipeForm(); $('[data-nr="name"]').value = name; return; }
    if (e.target.closest('[data-nr-create]')) { e.preventDefault(); e.stopImmediatePropagation(); createRecipe(); return; }
    if (e.target.closest('[data-drawer-open="drawer-newrecipe"]')) { nr.err = ''; newRecipeForm(); setTimeout(() => { const f = $('[data-nr="name"]'); if (f) f.focus(); }, 0); }
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('#drawer-newrecipe [data-nr]')) { e.preventDefault(); createRecipe(); }
  });

  /* ── boot ───────────────────────────────────────────────────────── */
  function boot() {
    /* the quantities say what the header says: for the batch size it shows (they
       showed the 100 kg base under "5,000 kg" until the size was changed) */
    const bs = $('#batch-size');
    if (bs) bs.dispatchEvent(new Event('change', { bubbles: true }));
    railTools();
    goesInto();
    newRecipeForm();
    /* Save saved nothing: every change now saves as it is made */
    const sv = $('.v4-actions .btn:not(.btn-primary)');
    if (sv) sv.outerHTML = '<span class="muted small v4-saved">Ingredient changes save as you make them.</span>';
    let flash = '';
    try { flash = sessionStorage.getItem(FLASH) || ''; sessionStorage.removeItem(FLASH); } catch (e) { /* none */ }
    if (flash) { const p = $('[data-v4panel="ingredients"]'); if (p) p.insertAdjacentHTML('afterbegin', `<div class="v4-flash" role="status">${esc(flash)}</div>`); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
