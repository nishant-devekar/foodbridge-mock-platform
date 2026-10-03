/* ============================================================
   recipe-steps.js — the recipe's Process tab (28 Sep 2026).

   Process Steps used to be its own Production leaf: JobFlow's
   Workflow Editor, listing the same recipes as this rail. The owner
   moved it here — a recipe is what goes in AND how it is made — and
   retired the leaf. Packing is one set of steps for every product;
   since the Packaging tab (same day) it is drawn there, as a closed
   shared section, into #pack-steps — Process only points to it.

   Same store, same routes: this talks to the JobFlow API in
   production-api.js (getWorkflow / addStep / updateStep /
   deleteStep / reorderSteps / createWorkflow), signed in as the
   seeded admin the way the JobFlow admin signs in inside the
   platform. The floor reads the same workflows, so a step saved
   here is what the next shift's batches get.

   Row classes are .stp, not .ing: recipe-v4.js binds every .ing
   (bars, inline edit), and a step is not an ingredient.
   ============================================================ */
(function () {
  'use strict';
  if (!window.FB_PRODUCTION || !window.JobFlowAPI || !window.FB_RECIPE) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());
  const STICKS = 'rm-p07';
  const ADMIN_EMAIL = 'admin@jobflow.local', ADMIN_PASSWORD = 'admin1234';

  const api = JobFlowAPI.createClient({ server: FB_PRODUCTION.server, sessionKey: 'fb.v7.recipes.session' });
  const ROLES = FB_PRODUCTION.FACTORY_ROLES || ['washer', 'blancher', 'dough maker', 'packer'];
  const recipe = FB_PRODUCTION.read((D) => D.book(FB_RECIPE.id));
  const stocked = recipe.ingredients.filter((i) => i.rmId);
  /* what a weighed step can take from the store: the materials weighed in kg (sticks are counted) */
  const stockedKg = stocked.filter((i) => i.unit === 'kg' || i.unit === 'litre');
  /* the products made here that it takes: semi-finished goods, or a finished good's bulk (v9) */
  const made = recipe.ingredients.filter((i) => i.sfId);
  const goesInto = FB_PRODUCTION.read((D) => (D.usedIn ? D.usedIn(FB_RECIPE.id) : []).map((x) => x.name));

  const s = { wf: null, packing: null, names: {}, open: null, packOpen: false, busy: false, error: '', loading: true };

  /* ---------- load ---------- */
  function signIn() {
    return api.adminLogin(ADMIN_EMAIL, ADMIN_PASSWORD).then((d) => api.saveSession({ admin: d.worker, accessToken: d.accessToken, refreshToken: d.refreshToken }));
  }
  function load() {
    return Promise.all([api.listWorkflows(), api.listMaterials()]).then(([wfs, mats]) => {
      s.wf = wfs.find((w) => w.recipeId === FB_RECIPE.id) || null;
      s.packing = wfs.find((w) => w.kind === 'packing') || null;
      mats.forEach((m) => { s.names[m.id] = m.name; });
    });
  }
  /* A change in flight only disables the buttons: redrawing would wipe a
     form the save may hand back with an error. A step's error shows in
     its own form (li), anything else above the list. */
  const AREAS = '[data-v4panel="process"], #pack-steps';
  function run(fn, li) {
    const panel = $$(AREAS);
    s.busy = true; s.error = '';
    panel.forEach((p) => $$('button', p).forEach((b) => { b.disabled = true; }));
    return fn().then(() => { s.open = null; return load(); }).then(() => { s.busy = false; render(); }, (err) => {
      s.busy = false;
      if (li && li.isConnected) { showErr(li, err.message); panel.forEach((p) => $$('button', p).forEach((b) => { b.disabled = false; })); }
      else { s.error = err.message; render(); }
    });
  }
  function showErr(li, msg) {
    const box = $('.stp-err', li) || $('.stp-foot', li).insertAdjacentElement('beforebegin', document.createElement('div'));
    box.className = 'stp-err'; box.textContent = msg;
  }

  /* ---------- view ---------- */
  function mins(n) { const h = Math.floor(n / 60), m = n % 60; return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min'; }
  /* The fill step: what it fills, how big, and where they are kept — what
     Inventory › Semi-Finished Inventory reads for this product. A step saved
     before these existed reads as big bags in kg in the freezer. */
  const CONTAINERS = ['Big bags', 'Drums', 'Crates', 'Tanks', 'Trays', 'Barrels'];
  const STORES = ['Freezer', 'Cold room', 'Chiller', 'Dry store', 'Tank room'];
  const fillOf = (st) => ({ container: (st && st.container) || 'Big bags', unit: (st && st.unit) || 'kg', store: (st && st.store) || 'Freezer' });
  const opts = (list, on) => list.concat(list.indexOf(on) === -1 ? [on] : []).map((x) => `<option${x === on ? ' selected' : ''}>${esc(x)}</option>`).join('');
  function flags(st) {
    const out = [];
    if (st.weigh) out.push(`<span class="stp-flag">kg in → out${st.loss != null ? ' · ≤' + st.loss + '% loss' : ''}</span>`);
    if (st.mixes) out.push('<span class="stp-flag store">takes the products made here by the recipe\'s %</span>');
    if (st.takes && st.takes.length) out.push(`<span class="stp-flag store">takes ${esc(st.takes.map((id) => s.names[id] || id).join(', '))}</span>`);
    if (st.sticks) out.push('<span class="stp-flag store">counts sticks</span>');
    if (st.bags) { const f = fillOf(st); out.push(`<span class="stp-flag bag">fills ${st.bags} ${esc(f.unit)} ${esc(f.container.toLowerCase())} · ${esc(f.store)}</span>`); }
    if (st.pack) out.push('<span class="stp-flag bag">packs from oldest bags</span>');
    if (st.cartons) out.push('<span class="stp-flag bag">cartons → finished goods</span>');
    return out.length ? `<span class="stp-flags">${out.join('')}</span>` : '';
  }
  const check = (on, attr, label) => `<label class="stp-check"><input type="checkbox" ${attr}${on ? ' checked' : ''}>${label}</label>`;
  function form(st, packing) {
    const f = st || { name: '', role: packing ? 'packer' : ROLES[0], expectedMinutes: 45, instructions: '', unlocksNext: true, weigh: false, loss: null, takes: [], sticks: false, bags: null, pack: false, cartons: false };
    const sticks = f.sticks || stocked.some((i) => i.rmId === STICKS);
    const records = packing
      ? check(f.pack, 'data-sf="pack"', 'Packs packets from the oldest bags in the freezer')
        + check(f.cartons, 'data-sf="cartons"', 'Packets into cartons, into Finished Goods')
      : check(f.weigh, 'data-sf="weigh"', 'Weight before and after (kg)')
        + `<div class="stp-weigh"${f.weigh ? '' : ' hidden'}>
            <div class="fld"><label class="label">Loss allowed (%)</label><input class="input" data-sf="loss" type="number" min="0" max="50" step="0.5" value="${f.loss == null ? '' : f.loss}" placeholder="10"></div>
            ${/* v9: either kind can take products made here and materials from the store */ ''}
            ${made.length ? `<div class="fld"><span class="label">Takes from the cold store</span>${check(!!f.mixes, 'data-sf="mixes"', 'The products made here, by the recipe\'s % (' + esc(made.map((i) => i.name + ' ' + i.qty + '%').join(', ')) + ')')}</div>` : ''}
            ${stockedKg.length || !made.length ? `<div class="fld"><span class="label">Takes from the store</span>${stockedKg.length
              ? stockedKg.map((i) => check(f.takes.indexOf(i.rmId) !== -1, `data-take="${esc(i.rmId)}"`, esc(i.name))).join('')
              : '<span class="muted small">This recipe lists no stocked materials.</span>'}</div>` : ''}
          </div>`
        + (sticks ? check(f.sticks, 'data-sf="sticks"', 'Sticks used (taken from the store)') : '')
        + (() => { const fl = fillOf(f); return `<div class="fld stp-fill"><label class="label">Fills <span class="muted">· leave the size empty if it doesn't; Semi-Finished Inventory shows what it fills</span></label>
            <div class="stp-fill-line"><select class="input" data-sf="container">${opts(CONTAINERS, fl.container)}</select><span>of</span><input class="input" data-sf="bags" type="number" min="1" value="${f.bags || ''}" placeholder="30"><select class="input" data-sf="unit">${opts(['kg', 'litre'], fl.unit)}</select><span>into</span><select class="input" data-sf="store">${opts(STORES, fl.store)}</select></div></div>`; })();
    return `<div class="stp-edit">
      <div class="grid">
        <div class="fld stp-wide"><label class="label">Step name</label><input class="input" data-sf="name" value="${esc(f.name)}" placeholder="${packing ? 'Pack small packets' : 'Peel · cut · wash'}"></div>
        <div class="fld"><label class="label">Done by</label><select class="input" data-sf="role">${ROLES.map((r) => `<option value="${esc(r)}"${r === f.role ? ' selected' : ''}>${esc(cap(r))}</option>`).join('')}</select></div>
        <div class="fld"><label class="label">Time (min)</label><input class="input" data-sf="minutes" type="number" min="1" step="1" value="${f.expectedMinutes}"></div>
        <div class="fld stp-wide"><label class="label">Instructions <span class="muted">· optional</span></label><textarea class="input" data-sf="instructions" rows="2" placeholder="${packing ? 'Oldest bags first…' : 'Weigh the crates before you start…'}">${esc(f.instructions)}</textarea></div>
      </div>
      <div class="stp-records"><span class="label">What the worker records</span>${records}</div>
      ${check(f.unlocksNext, 'data-sf="unlocksNext"', 'Finishing this step unlocks the next one')}
      <div class="stp-foot">
        ${st ? `<button class="btn btn-sm stp-del" data-stp-del${s.busy ? ' disabled' : ''}>Delete step</button>` : '<span></span>'}
        <span class="stp-foot-r"><button class="btn btn-sm" data-stp-cancel>Cancel</button><button class="btn btn-sm btn-primary" data-stp-save${s.busy ? ' disabled' : ''}>✓ ${st ? 'Save' : 'Add step'}</button></span>
      </div>
    </div>`;
  }
  function list(wf, packing) {
    const steps = wf ? wf.steps : [];
    const key = packing ? 'packing' : 'recipe';
    const rows = steps.map((st, i) => {
      const open = s.open && s.open.wf === key && s.open.id === st._id;
      return `<li class="stp${open ? ' open' : ''}" data-stp="${esc(st._id)}" data-wf="${key}">
        <div class="stp-row">
          <span class="stp-move"><button data-stp-up aria-label="Move step up"${s.busy || i === 0 ? ' disabled' : ''}>▲</button><button data-stp-down aria-label="Move step down"${s.busy || i === steps.length - 1 ? ' disabled' : ''}>▼</button></span>
          <span class="stp-no">${st.order}</span>
          <span class="stp-nm">${esc(st.name)}<small>${esc(cap(st.role))} · ${st.expectedMinutes} min${st.unlocksNext ? '' : ' · doesn\'t unlock the next'}</small>${flags(st)}</span>
          <span class="muted">✎</span>
        </div>
        ${open ? form(st, packing) : ''}
      </li>`;
    }).join('');
    const adding = s.open && s.open.wf === key && s.open.id === 'new';
    return `<ol class="stp-list">${rows}${adding ? `<li class="stp open" data-stp="new" data-wf="${key}"><div class="stp-row"><span class="stp-move"></span><span class="stp-no">${steps.length + 1}</span><span class="stp-nm">New step</span><span></span></div>${form(null, packing)}</li>` : ''}</ol>
      ${adding ? '' : `<div class="add-ing"><button class="add-btn" data-stp-add="${key}"${s.busy ? ' disabled' : ''}>＋ ${steps.length ? 'Add Step' : 'Add first step'}</button></div>`}`;
  }
  function render() {
    const panel = $('[data-v4panel="process"]');
    if (!panel) return;
    if (s.loading) { panel.innerHTML = '<div class="muted small">Loading the steps…</div>'; return; }
    const steps = s.wf ? s.wf.steps : [];
    const total = steps.reduce((t, st) => t + (st.expectedMinutes || 0), 0);
    const pk = s.packing ? s.packing.steps : [];
    const pack = $('#pack-steps');
    panel.innerHTML = `
      <div class="section-eyebrow mb8">How it's made on the floor${steps.length ? ' · ' + steps.length + ' steps · ' + mins(total) + ' a batch' : ''}</div>
      ${steps.length || (s.open && s.open.wf === 'recipe') ? '' : '<div class="stp-empty">No steps yet. Batches of this recipe won\'t reach the floor until it has them.</div>'}
      ${s.error ? `<div class="stp-err">${esc(s.error)}</div>` : ''}
      ${list(s.wf, false)}
      ${recipe.kind === 'semi' ? `<div class="stp-next">Then goes into ${esc(goesInto.join(', ') || 'no other recipe yet')} by their recipes</div>`
        : `<a class="stp-next" href="#" data-v4tab="packaging">Then packed in the same run into its packs · <b>Packaging ›</b></a>${goesInto.length ? `<div class="stp-next">What a run does not pack is bagged and goes into ${esc(goesInto.join(', '))}</div>` : ''}`}
      <div class="muted small mt16">Changes apply to batches put on a shift after you save. Batches already on the floor keep their steps.</div>`;
    if (pack && s.packing) {
      pack.className = 'stp-shared' + (s.packOpen ? ' open' : '');
      pack.innerHTML = `<button class="stp-shared-h" data-stp-pack aria-expanded="${s.packOpen}"><span class="stp-caret">▸</span><span><b>How it's packed</b><small>${pk.length} step${pk.length === 1 ? '' : 's'}, same for every product · ${esc(pk.map((st) => st.name).join(' → '))}</small></span></button>
        ${s.packOpen ? `<div class="stp-shared-b"><div class="muted small mb8">Changing these changes packing for every product. Packing orders put on a shift after you save get them.</div>${list(s.packing, true)}</div>` : ''}`;
    }
    sync(steps);
  }

  /* The header and the Production tab say what the Process tab holds. */
  function sync(steps) {
    const n = $('[data-steps-count]');
    if (n) { n.textContent = steps.length ? steps.length + ' step' + (steps.length === 1 ? '' : 's') : 'No steps yet'; n.style.color = steps.length ? 'var(--fb-green-700)' : 'var(--fb-red-700,#B91C1C)'; }
    const fill = steps.filter((st) => st.bags).pop();
    $$('[data-bag-kg]').forEach((el) => { el.textContent = (fill ? fill.bags : recipe.bagKg) + ' kg'; });
    /* its own line over Create: #pb-actnote is recipe-v4.js's batch-size alert */
    let warn = $('#stp-prodwarn');
    const acts = $('#create-batch') && $('#create-batch').closest('.v4-actions');
    if (!warn && acts) {
      acts.insertAdjacentHTML('beforebegin', '<div class="nb nb-bad stp-prodwarn" id="stp-prodwarn" hidden>No process steps yet: this batch won\'t reach the floor until you add them in <a href="#" data-v4tab="process">Process</a>.</div>');
      warn = $('#stp-prodwarn');
    }
    if (warn) warn.hidden = !!steps.length;
  }

  /* ---------- actions ---------- */
  function wfOf(key) { return key === 'packing' ? s.packing : s.wf; }
  function payload(li, packing) {
    const v = (k) => { const el = $(`[data-sf="${k}"]`, li); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
    const name = String(v('name') || '').trim(), minutes = Number(v('minutes'));
    if (!name) throw new Error('Give the step a name.');
    if (!Number.isInteger(minutes) || minutes < 1) throw new Error('Time is whole minutes, 1 or more.');
    const p = { name, role: v('role'), expectedMinutes: minutes, instructions: String(v('instructions') || '').trim(), unlocksNext: !!v('unlocksNext') };
    if (packing) return Object.assign(p, { pack: !!v('pack'), cartons: !!v('cartons') });
    const weigh = !!v('weigh'), loss = v('loss'), bags = v('bags'), fill = bags ? { container: v('container'), unit: v('unit'), store: v('store') } : { container: null, unit: null, store: null };
    return Object.assign(p, {
      weigh, loss: weigh && loss !== '' ? Number(loss) : null,
      takes: weigh ? $$('[data-take]', li).filter((c) => c.checked).map((c) => c.getAttribute('data-take')) : [],
      mixes: weigh && !!v('mixes'),
      sticks: !!v('sticks'), bags: bags ? Number(bags) : null,
    }, fill);
  }
  function save(li) {
    const key = li.getAttribute('data-wf'), id = li.getAttribute('data-stp');
    let p;
    try { p = payload(li, key === 'packing'); } catch (err) { showErr(li, err.message); return; }
    run(() => {
      if (id !== 'new') return api.updateStep(wfOf(key)._id, id, p);
      const wf = wfOf(key);
      return (wf ? Promise.resolve(wf) : api.createWorkflow({ recipeId: FB_RECIPE.id })).then((w) => api.addStep(w._id, p));
    }, li);
  }
  /* The floor unlocks step n+1 when step n is done, so the steps left
     are renumbered 1…n: a gap would stall every batch at it. */
  function remove(li) {
    const wf = wfOf(li.getAttribute('data-wf')), id = li.getAttribute('data-stp');
    const rest = wf.steps.filter((x) => x._id !== id).map((x) => x._id);
    run(() => api.deleteStep(wf._id, id).then(() => rest.length && api.reorderSteps(wf._id, rest)), li);
  }
  function move(li, dir) {
    const wf = wfOf(li.getAttribute('data-wf')), ids = wf.steps.map((x) => x._id);
    const i = ids.indexOf(li.getAttribute('data-stp')), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.reorderSteps(wf._id, ids));
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t.closest(AREAS)) return;
    const li = t.closest('.stp');
    if (t.closest('[data-stp-pack]')) { e.preventDefault(); s.packOpen = !s.packOpen; if (!s.packOpen && s.open && s.open.wf === 'packing') s.open = null; render(); return; }
    const add = t.closest('[data-stp-add]');
    if (add) { e.preventDefault(); s.error = ''; s.open = { wf: add.getAttribute('data-stp-add'), id: 'new' }; render(); const n = $('.stp.open [data-sf="name"]'); if (n) n.focus(); return; }
    if (!li || s.busy) return;
    if (t.closest('[data-stp-up]')) { e.preventDefault(); move(li, -1); return; }
    if (t.closest('[data-stp-down]')) { e.preventDefault(); move(li, +1); return; }
    if (t.closest('[data-stp-cancel]')) { e.preventDefault(); s.open = null; s.error = ''; render(); return; }
    if (t.closest('[data-stp-save]')) { e.preventDefault(); save(li); return; }
    if (t.closest('[data-stp-del]')) { e.preventDefault(); remove(li); return; }
    if (t.closest('.stp-row') && li.getAttribute('data-stp') !== 'new') {
      const id = li.getAttribute('data-stp'), key = li.getAttribute('data-wf');
      s.error = '';
      s.open = s.open && s.open.id === id ? null : { wf: key, id };
      render();
    }
  });
  /* weight on/off shows what goes with it, without redrawing the form */
  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-v4panel="process"] [data-sf="weigh"]')) return;
    const box = e.target.closest('.stp-edit').querySelector('.stp-weigh');
    if (box) box.hidden = !e.target.checked;
  });

  /* ---------- boot ---------- */
  render();
  signIn().then(load).catch((err) => { s.error = err.message; }).then(() => { s.loading = false; render(); });

  /* a recipe switch keeps the tab you were on (recipe-store.js passes it) */
  const tab = new URLSearchParams(location.search).get('tab');
  const tabEl = tab && $(`.v4-tabs [data-v4tab="${tab}"]`);
  if (tabEl) tabEl.click();
})();
