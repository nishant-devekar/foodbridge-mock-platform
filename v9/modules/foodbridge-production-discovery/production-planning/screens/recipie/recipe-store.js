/* ============================================================
   recipe-store.js — Configure Recipe, from the production store
   (Production integration, owner's call, 26 Sep 2026).

   This screen was written for one recipe, Premium Butter Cookies,
   with its rail, header, ingredients and costs in the markup. The
   business is now the owner's reference: frozen green peas, mixed
   vegetables and soya chaap, kept in ONE store with Batch
   Management, the shop floor and the inventories
   (v7/assets/production/production-api.js).

   Runs before recipe.js / recipe-v4.js (all three are deferred, in
   order) and rewrites the recipe-specific markup for the recipe
   in ?recipe= (default: the first), in the exact classes and data
   attributes recipe-v4.js reads — so its bars, cost totals, preview
   scaler and Stage A/B planner work unchanged. It also hands
   recipe-v4.js the numbers it used to hard-code, as window.FB_RECIPE.
   ============================================================ */
(function () {
  'use strict';
  if (!window.FB_PRODUCTION) return;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = (n) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const rupees = (n) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const r2 = (n) => Math.round(n * 100) / 100;

  const data = FB_PRODUCTION.read((D, d) => {
    /* two levels (3 Oct 2026): the finished products, then the semi-finished
       goods they are mixed from — each with its own recipe */
    const all = d.recipeOrder.concat(d.semiOrder || []);
    /* ?recipe= on the page, or on the platform's address: the Production board's recipe
       versions open #/production/configure-recipe?recipe=… (3 Oct 2026) */
    let want = new URLSearchParams(location.search).get('recipe');
    if (!want) {
      try {
        const h = window.parent !== window ? window.parent.location.hash : '', i = h.indexOf('?');
        if (i !== -1 && /configure-recipe\?/.test(h)) {
          want = new URLSearchParams(h.slice(i + 1)).get('recipe');
          window.parent.history.replaceState(null, '', window.parent.location.pathname + window.parent.location.search + h.slice(0, i));
        }
      } catch (e) { /* not inside the platform */ }
    }
    const id = all.indexOf(want) !== -1 ? want : all[0];
    const bk = D.book(id);
    /* v9 (3 Oct 2026): a recipe's line says what it is made from and what it goes into —
       any product made here can be an ingredient, at any level */
    const from = (b) => b.ingredients.length ? b.ingredients.map((i) => i.name + (i.rmId && i.wastage ? ' (' + i.wastage + '% wastage)' : '')).join(', ') : 'no ingredients yet';
    const subOf = (b) => (b.kind === 'semi' ? 'Semi-finished' : 'Finished') + ' · ' + b.label + ' · ' + from(b);
    const typeOf = (i) => i.sfId ? (D.book(i.sfId) && D.book(i.sfId).kind === 'finished' ? 'finished' : 'semi') : i.rmId ? 'raw' : 'plain';
    return {
      id, bk,
      rail: all.map((rid, n) => { const b = D.book(rid); return { id: rid, name: b.name, sub: subOf(b), emoji: b.emoji, kind: b.kind, order: n,
        made: b.ingredients.filter((i) => i.sfId).length, inputs: b.ingredients.length, usedIn: D.usedIn(rid).length,
        /* one short line under the name (owner, 3 Oct 2026: less to read): a finished good's
           ingredient count, a semi-finished good's raw material */
        short: !b.ingredients.length ? 'No ingredients yet' : b.kind === 'semi'
          ? 'From ' + b.ingredients.filter((i) => i.rmId || i.sfId).slice(0, 2).map((i) => i.name).join(', ') + (b.ingredients.filter((i) => i.rmId || i.sfId).length > 2 ? '…' : '')
          : b.ingredients.length + ' ingredient' + (b.ingredients.length === 1 ? '' : 's'),
        find: (b.name + ' ' + b.label + ' ' + b.ingredients.map((i) => i.name).join(' ')).toLowerCase() }; }),
      /* a product made here costs what its own recipe costs, at any level */
      sfCost: Object.fromEntries(all.map((sid) => [sid, Math.round(D.costPerKg(sid) * 100) / 100])),
      types: Object.fromEntries(bk.ingredients.map((i) => [D.ingKey(i), typeOf(i)])),
      keys: bk.ingredients.map((i) => D.ingKey(i)),
      usedIn: D.usedIn(id),
      madeFrom: bk.ingredients.filter((i) => i.sfId).map((i) => ({ id: i.sfId, name: i.name, qty: i.qty, kind: (D.book(i.sfId) || {}).kind })),
      /* the packs on sale, as Recipes › Packaging keeps them, with what a packet costs */
      skus: D.packs(id).map((s) => Object.assign({}, s, { cost: D.packCost(s), pouchName: s.pouchId ? D.material(s.pouchId).name : '' })),
      demand: d.demand,
      mats: d.materials,
      supervisors: d.operators,
      header: d.recipeHeaders[id],
      steps: ((d.workflows.find((w) => w.recipeId === id) || {}).steps || []).slice().sort((a, b) => a.order - b.order),
    };
  });
  const bk = data.bk;
  /* the floor fills bags by the fill step; the header shows that, not a second copy */
  const fillStep = data.steps.filter((st) => st.bags).pop();
  const bagKg = fillStep ? fillStep.bags : bk.bagKg;
  const stepsLabel = data.steps.length ? data.steps.length + ' step' + (data.steps.length === 1 ? '' : 's') : 'No steps yet';
  const priceOf = (i) => { if (i.sfId) return data.sfCost[i.sfId] || 0; const m = i.rmId && data.mats.find((x) => x.id === i.rmId); return m ? m.price : 0; };

  /* recipe-v4.js reads these instead of its cookie constants */
  window.FB_RECIPE = {
    id: data.id, name: bk.name, nominal: bk.base, sizes: bk.sizes,
    variants: data.skus.map((s) => ({ id: s.id, name: s.name.replace(bk.name + ' ', ''), sku: s.name, net: s.grams / 1000, multiple: s.perCarton, demand: (data.demand[s.id] || {}).open || 0 })),
    /* one split, set per pack in Packaging */
    strategies: { default: Object.fromEntries(data.skus.map((s) => [s.id, s.split])) },
    sheet: {
      name: bk.name, basis: 'batch', batchKg: bk.base, markup: 25, target: Math.round((data.skus[0] ? data.skus[0].price / (data.skus[0].grams / 1000) : 100) * 0.9),
      ing: bk.ingredients.map((i) => ({ name: i.name, rate: priceOf(i), qty: i.qty, unit: i.unit })),
      making: bk.making.map((m) => ({ name: m.name, amount: m.amount })),
    },
    supervisors: data.supervisors,
  };

  function rewrite() {
    /* rail */
    const rail = $('#rail-list');
    if (rail) rail.innerHTML = data.rail.map((r, i) =>
      (i === 0 || data.rail[i - 1].kind !== r.kind ? `<div class="rl-group" style="padding:10px 12px 4px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--fb-text-muted,#6B7280)">${r.kind === 'semi' ? 'Semi-finished goods' : 'Finished goods'}</div>` : '') +
      `<a class="rl-item${r.id === data.id ? ' active' : ''}" data-recipe="${esc(r.name)}" data-rid="${esc(r.id)}" data-kind="${r.kind}" data-order="${r.order}" data-used="${r.usedIn}" data-inputs="${r.inputs}" data-find="${esc(r.find)}" href="?recipe=${encodeURIComponent(r.id)}"><span class="rl-nm">${esc(r.emoji + ' ' + r.name)}</span><span class="rl-sub">${esc(r.short)}</span></a>`).join('');
    window.FB_RECIPE_RAIL = data.rail;

    /* header (owner, 3 Oct 2026: "redesign this section"): two lines. The name and
       the one control that changes what you see — quantities for a batch size —
       then one quiet line of what the product is. Everything else lives in its
       tab: ingredients in Ingredients, steps in Process, packs in Packaging,
       MSQ on the Production board. */
    document.title = bk.name + ' — Recipes';
    const semi = bk.kind === 'semi';
    const head = $('.v4-head');
    if (head) {
      const kg = (v) => Number(v).toLocaleString('en-IN') + ' kg';
      const fill = ((fillStep && fillStep.container) || 'Big bags').toLowerCase() + ', ' + ((fillStep && fillStep.store) || 'Cold store').toLowerCase();
      const facts = [
        `<b>${semi ? 'Semi-finished' : 'Finished good'}</b>`,
        esc(bk.label),
        'Keeps ' + bk.bestBeforeDays + ' day' + (bk.bestBeforeDays === 1 ? '' : 's'),
        semi ? `<span data-bag-kg>${bagKg} kg</span> ${esc(fill)}`
          : `<a href="#" class="vh-link" data-v4tab="packaging">${data.skus.length ? 'Sold in ' + data.skus.length + ' pack' + (data.skus.length === 1 ? '' : 's') : 'No packs yet'}</a>`,
        data.usedIn.length ? 'Goes into ' + data.usedIn.map((x) => `<a class="vh-link" href="?recipe=${encodeURIComponent(x.id)}">${esc(x.name)}</a>`).join(', ') : '',
      ].filter(Boolean);
      head.innerHTML = `
        <div class="vh-top">
          <h1>${esc(bk.name)}</h1>
          <label class="vh-qty" title="Quantities and costs are shown for this batch size. The recipe itself is written per ${bk.base} kg, and edits change it.">
            <span>Quantities for</span>
            <select id="batch-size" aria-label="Show quantities for a batch of">${bk.sizes.map((z) => `<option value="${z}"${z === bk.base ? ' selected' : ''}>${kg(z)}</option>`).join('')}</select>
          </label>
        </div>
        <p class="vh-facts">${facts.join('<i aria-hidden="true">·</i>')}</p>`;
    }

    /* ingredients — the markup recipe-v4.js reads (data-qty / data-unit / data-yield) */
    const list = $('.ing-list');
    /* v9: every row says what kind of input it is — bought in, or made here (and
       which level) — and a made one opens its own recipe */
    const TYPE = { raw: 'Raw material', semi: 'Semi-finished', finished: 'Finished good', plain: 'Not stocked' };
    if (list) list.innerHTML = (bk.ingredients.length ? '' : '<div class="ing-empty">No ingredients yet. Add what goes in: raw materials, semi-finished goods, or another finished good.</div>') + bk.ingredients.map((i, n) => {
      const key = data.keys[n], type = data.types[key], m = i.rmId && data.mats.find((x) => x.id === i.rmId);
      const made = type === 'semi' || type === 'finished';
      /* one line: what kind of input, and the one figure that matters for it (owner, 3 Oct 2026: less to read) */
      const sub = TYPE[type] + ' · ' + (made ? i.qty + (bk.base === 100 ? '% of the mix' : ' kg per ' + bk.base + ' kg') + (type === 'finished' ? ' · from its bulk' : '')
        : type === 'plain' ? esc(i.unit) : esc(i.brand) + (i.wastage ? ' · ' + i.wastage + '% wastage' : ''));
      const nm = made ? `<a class="ing-link" href="?recipe=${encodeURIComponent(i.sfId)}" title="Open its recipe">${esc(i.name)}</a>` : esc(i.name);
      return `
            <div class="ing" data-qty="${i.qty}" data-unit="${esc(i.unit)}" data-yield="${i.yield}" data-ref="${esc(key)}" data-type="${type}">
              <div class="ing-row"><div class="nm"><span class="ing-name">${nm}</span><small>${sub}</small></div><div class="ing-track"><div class="ing-fill"></div></div><div class="ing-qty">${i.qty} ${esc(i.unit)}</div></div>
              <div class="ing-edit"><div class="grid">
                ${made ? '' : `<div class="fld"><label class="label">Brand</label><input class="input" data-f="brand" value="${esc(i.brand)}"></div>`}
                <div class="fld"><label class="label">Quantity <span class="muted">per ${bk.base} kg</span></label><input class="input" data-f="qty" type="number" min="0" step="0.01" value="${i.qty}"></div>
                ${made ? '<div class="fld"><label class="label">Unit</label><output class="input" style="display:block;background:#FAFBFC">kg</output></div>' : `<div class="fld"><label class="label">Unit</label><select class="input" data-f="unit">${['kg', 'g', 'litre', 'ml', 'pcs'].map((u) => `<option${u === i.unit ? ' selected' : ''}>${u}</option>`).join('')}</select></div>`}
                <div class="fld"><label class="label">Yield %</label><input class="input" data-f="yield" type="number" min="1" max="100" value="${i.yield}"></div>
                ${type === 'raw' ? `<div class="fld"><label class="label">Wastage %</label><input class="input" data-f="wastage" type="number" min="0" max="99" value="${i.wastage == null ? '' : i.wastage}" placeholder="0"></div>` : ''}
              </div><div class="save-row"><button class="btn btn-sm ing-rm" data-ing-rm>Remove</button><button class="btn btn-sm btn-primary" data-ing-save>✓ Save</button></div></div>
            </div>`;
    }).join('');
    const stocked = bk.ingredients.filter((i) => i.unit === 'kg' || i.unit === 'litre');
    const yieldPct = stocked.length ? Math.round(stocked.reduce((s, i) => s + i.qty * i.yield / 100, 0) / stocked.reduce((s, i) => s + i.qty, 0) * 100) : 0;
    const yv = $('#yield-value'); if (yv) yv.textContent = stocked.length ? yieldPct + '%' : '—';

    /* cost — ingredient rows and making lines (data-* read by renderCost) */
    const cl = $('#ing-cost-list');
    if (cl) cl.innerHTML = bk.ingredients.map((i) => {
      const p = priceOf(i), amt = r2(p * i.qty);
      return `
              <div class="cost-line editable" data-name="${esc(i.name)}" data-price="${p}" data-qtyv="${i.qty}" data-unit="${esc(i.unit)}" data-amount="${amt}">
                <div class="cl-row"><div class="cn">${esc(i.name)}<small>${p ? money(p) + ' / ' + esc(i.unit) : 'no cost'}</small></div><div class="cv">${money(amt)}</div><span class="muted">✎</span></div>
                <div class="cl-edit"><div class="grid">
                  <div class="fld"><label class="label">Unit Price (₹)</label><input class="input" data-cf="price" type="number" value="${p}"></div>
                  <div class="fld"><label class="label">Quantity</label><input class="input" data-cf="qty" type="number" value="${i.qty}"></div>
                  <div class="fld"><label class="label">Unit</label><select class="input" data-cf="unit">${['kg', 'g', 'litre', 'ml', 'pcs'].map((u) => `<option${u === i.unit ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
                  <div class="fld"><label class="label">Effective Cost</label><output class="input" data-cf="eff" style="display:block;background:#FAFBFC">${money(amt)}</output></div>
                </div><div class="save-row"><button class="btn btn-sm btn-primary" data-cost-save>✓ Save</button></div></div>
              </div>`;
    }).join('');
    const ml = $('#making-list');
    if (ml) ml.innerHTML = bk.making.map((m) => `<div class="cost-line" data-amount="${m.amount}"><div class="cn">${esc(m.name)}</div><input class="input" type="number" value="${m.amount}" style="width:110px" data-cost-amt><button class="btn btn-sm" data-cost-del>✕</button></div>`).join('');
    const mlNote = ml && ml.nextElementSibling; if (mlNote && mlNote.classList.contains('muted')) mlNote.textContent = `Line inputs are per the ${bk.base} kg base; the total below scales for the previewed batch size.`;

    /* cost › packaging: per packet, from the packs (edited in Packaging). Not a
       batch cost, so it stays out of the grand total. */
    const pc = $('[data-costpanel="pack"]');
    if (pc) {
      pc.removeAttribute('data-cost-sec');
      pc.innerHTML = `<div class="h"><span class="section-eyebrow">Packaging Cost</span><span class="muted small">Per packet · pouch + its share of a carton</span></div>`
        + data.skus.map((s) => `<div class="cost-line"><div class="cn">${esc(s.name.replace(bk.name + ' ', ''))}<small>${esc(s.pouchName || 'no pouch')} ${rupees(s.cost.pouch)} + carton ${rupees(s.cost.carton)} · packet ${rupees(s.cost.total)} · margin ${s.cost.marginPct}%</small></div><div class="cv">${rupees(s.cost.packaging)}</div><span></span></div>`).join('')
        + `<div class="muted small mt8">Packs, pouches and prices are set in <a href="#" data-v4tab="packaging">Packaging</a>. The grand total below is the batch: ingredients and making.</div>`;
    }

    /* target sheet: one product, this recipe */
    const tp = $('#ti-prod'); if (tp) tp.innerHTML = `<button class="chip sel" data-ti-prod="store">${bk.emoji} ${esc(bk.name)}</button>`;

    /* production tab: the floor's words */
    const pv = $('#pb-ver'); if (pv) pv.innerHTML = `<option>${esc(bk.label)} — ${esc(bk.name)}</option>`;
    const sub = $('[data-prodpanel="batch"] .stage-sub');
    if (sub) sub.innerHTML = bk.kind === 'semi'
      ? `Made on the floor by its <b>Process</b> steps — ${esc(bk.line.toLowerCase())} line, into <span data-bag-kg>${bagKg} kg</span> ${esc(((fillStep && fillStep.container) || 'Big bags').toLowerCase())} in the ${esc(((fillStep && fillStep.store) || 'Cold store').toLowerCase())}. Planned in <b>kg</b>, never in pieces.`
      : `Mixed on the floor from the semi-finished goods by the recipe's %, then packed in the same run into its packs. Planned in <b>kg</b>.`;
    const band = $('#pb-band .band-row span');
    if (band) band.innerHTML = `Quality band <b>${r2(bk.base * 0.9)}–${r2(bk.base * 1.1)} kg</b> · nominal ${bk.base} (±10%)`;
    const size = $('#pb-size'); if (size) size.value = bk.base;
    const sizeSku = $('#pb-size-sku'); if (sizeSku) sizeSku.value = bk.base;
    const op = $('#pb-op');
    if (op) {
      op.placeholder = 'Search supervisors…';
      op.value = data.supervisors[0] ? data.supervisors[0].name : '';
      op.setAttribute('list', 'pb-op-list');
      op.insertAdjacentHTML('afterend', `<datalist id="pb-op-list">${data.supervisors.map((s) => `<option value="${esc(s.name)}"></option>`).join('')}</datalist>`);
      const lab = op.closest('.fld') && op.closest('.fld').querySelector('.label'); if (lab) lab.textContent = 'Supervisor';
    }
    const today = new Date(), iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const tmr = new Date(today.getTime() + 86400000);
    const pd = $('#pb-date'); if (pd && !pd.value) pd.value = iso(tmr);
    const pf = $('#pb-finish'); if (pf && !pf.value) pf.value = iso(tmr);
    /* SKU planning: the one split from Packaging */
    const ms = $('#mix-strategy');
    if (ms) {
      ms.innerHTML = `<option value="default" selected>Split from Packaging · ${data.skus.map((s) => s.split).join(' / ')}</option>`;
      const lab = ms.closest('.fld') && ms.closest('.fld').querySelector('.label'); if (lab) lab.textContent = 'Split';
      const h = ms.closest('.fld') && ms.closest('.fld').querySelector('.hint'); if (h) h.innerHTML = 'Each pack\'s share, set in <a href="#" data-v4tab="packaging">Packaging</a>. Editing a row here rebalances the others for this order; lock a row to hold it.';
    }
    const note = $('#pb-actnote'); if (note) note.textContent = bk.kind === 'semi' ? 'Creates a Planned batch in Batch Management; it fills bags into the cold store. Add it to a shift to put it on the floor.' : 'Creates a Planned batch in Batch Management that mixes and packs its packs in the same run. Add it to a shift to put it on the floor.';
  }

  /* a rail click opens that recipe (the page is built for one recipe at a time),
     on the tab you were on: walking the recipes' Process tabs stays on Process */
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.rl-item[data-rid]');
    if (!item) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const tab = document.querySelector('.v4-tabs .t.on');
    const on = tab ? tab.getAttribute('data-v4tab') : 'ingredients';
    location.search = '?recipe=' + encodeURIComponent(item.getAttribute('data-rid')) + (on !== 'ingredients' ? '&tab=' + on : '');
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rewrite);
  else rewrite();
})();
