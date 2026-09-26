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
  const r2 = (n) => Math.round(n * 100) / 100;

  const data = FB_PRODUCTION.read((D, d) => {
    const want = new URLSearchParams(location.search).get('recipe');
    const id = d.recipeOrder.indexOf(want) !== -1 ? want : d.recipeOrder[0];
    const bk = D.book(id);
    return {
      id, bk,
      rail: d.recipeOrder.map((rid) => { const b = D.book(rid); return { id: rid, name: b.name, sub: b.line + ' · ' + b.ingredients.length + ' ingredients', emoji: b.emoji }; }),
      skus: d.skus.filter((s) => s.recipeId === id),
      demand: d.demand,
      mats: d.materials,
      supervisors: d.operators,
      header: d.recipeHeaders[id],
      hasSteps: d.workflows.some((w) => w.recipeId === id),
    };
  });
  const bk = data.bk;
  const priceOf = (i) => { const m = i.rmId && data.mats.find((x) => x.id === i.rmId); return m ? m.price : 0; };

  /* recipe-v4.js reads these instead of its cookie constants */
  window.FB_RECIPE = {
    id: data.id, name: bk.name, nominal: bk.base, sizes: bk.sizes,
    variants: data.skus.map((s) => ({ id: s.id, name: s.name.replace(bk.name + ' ', ''), sku: s.name, net: s.grams / 1000, multiple: s.perCarton, demand: (data.demand[s.id] || {}).open || 0 })),
    strategies: {
      default: bk.strategy,
      festive: Object.fromEntries(data.skus.map((s, i, all) => [s.id, i === all.length - 1 ? 100 - Math.round(100 / all.length) * (all.length - 1) : Math.round(100 / all.length)])),
      bulk: Object.fromEntries(data.skus.map((s) => [s.id, s.grams >= 1000 ? Math.round(100 / Math.max(1, data.skus.filter((x) => x.grams >= 1000).length)) : 0])),
    },
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
    if (rail) rail.innerHTML = data.rail.map((r) =>
      `<a class="rl-item${r.id === data.id ? ' active' : ''}" data-recipe="${esc(r.name)}" data-rid="${esc(r.id)}" href="?recipe=${encodeURIComponent(r.id)}"><span class="rl-nm">${esc(r.emoji + ' ' + r.name)}</span><span class="rl-sub">${esc(r.sub)}</span></a>`).join('');

    /* header */
    const h1 = $('.v4-head h1'); if (h1) h1.textContent = bk.name;
    document.title = bk.name + ' — Recipes';
    const linked = $('.v4-head .linked');
    if (linked) linked.innerHTML = data.skus.map((s) => `<span class="v4-chip">${bk.emoji} ${esc(s.name.replace(bk.name + ' ', ''))}</span>`).join('');
    const ver = $('.v4-ver select');
    if (ver) ver.innerHTML = `<option>${esc(bk.label)} — ${esc(bk.name)} (Latest)</option>`;
    const meta = $('.v4-head .meta');
    if (meta) meta.innerHTML = `<span class="m">Line <b>${esc(bk.line)}</b></span><span class="m">Batch sizes <b>${bk.sizes.join(' / ')} kg</b></span><span class="m">Best before <b>${bk.bestBeforeDays} days</b></span><span class="m">Big bags <b>${bk.bagKg} kg</b></span><span class="m">Process <b style="color:var(--fb-green-700)">${data.hasSteps ? 'Steps set' : 'No steps yet'}</b></span>`;
    const bs = $('#batch-size');
    if (bs) bs.innerHTML = bk.sizes.map((z) => `<option value="${z}"${z === bk.base ? ' selected' : ''}>${z} kg</option>`).join('');
    const hint = $('.batch-prev .bp-hint'); if (hint) hint.textContent = `Base = ${bk.base} kg · quantities & costs scale for preview only; edits change the base recipe.`;

    /* ingredients — the markup recipe-v4.js reads (data-qty / data-unit / data-yield) */
    const list = $('.ing-list');
    if (list) list.innerHTML = bk.ingredients.map((i) => `
            <div class="ing" data-qty="${i.qty}" data-unit="${esc(i.unit)}" data-yield="${i.yield}">
              <div class="ing-row"><div class="nm">${esc(i.name)}<small>${esc(i.brand)} · ${esc(i.unit)} · Yield ${i.yield}%${i.rmId ? '' : ' · not stocked'}</small></div><div class="ing-track"><div class="ing-fill"></div></div><div class="ing-qty">${i.qty} ${esc(i.unit)}</div></div>
              <div class="ing-edit"><div class="grid">
                <div class="fld"><label class="label">Brand</label><input class="input" data-f="brand" value="${esc(i.brand)}"></div>
                <div class="fld"><label class="label">Quality</label><input class="input" data-f="quality" value="Grade A"></div>
                <div class="fld"><label class="label">Quantity</label><input class="input" data-f="qty" type="number" value="${i.qty}"></div>
                <div class="fld"><label class="label">Unit</label><select class="input" data-f="unit">${['kg', 'g', 'litre', 'ml', 'pcs'].map((u) => `<option${u === i.unit ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
                <div class="fld"><label class="label">Yield %</label><input class="input" data-f="yield" type="number" value="${i.yield}"></div>
              </div><div class="save-row"><button class="btn btn-sm btn-primary" data-ing-save>✓ Save</button></div></div>
            </div>`).join('');
    const stocked = bk.ingredients.filter((i) => i.unit === 'kg' || i.unit === 'litre');
    const yieldPct = Math.round(stocked.reduce((s, i) => s + i.qty * i.yield / 100, 0) / stocked.reduce((s, i) => s + i.qty, 0) * 100);
    const yv = $('#yield-value'); if (yv) yv.textContent = yieldPct + '%';

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

    /* target sheet: one product, this recipe */
    const tp = $('#ti-prod'); if (tp) tp.innerHTML = `<button class="chip sel" data-ti-prod="store">${bk.emoji} ${esc(bk.name)}</button>`;

    /* production tab: the floor's words */
    const pv = $('#pb-ver'); if (pv) pv.innerHTML = `<option>${esc(bk.label)} — ${esc(bk.name)}</option>`;
    const sub = $('[data-prodpanel="batch"] .stage-sub');
    if (sub) sub.innerHTML = `Made on the floor by its <b>Process Steps</b> — ${esc(bk.line.toLowerCase())} line, into ${bk.bagKg} kg bags in the freezer. Planned in <b>kg</b>, never in pieces.`;
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
    const note = $('#pb-actnote'); if (note) note.textContent = 'Creates a Planned batch in Batch Management and a packing order for each pack. Add it to a shift to put it on the floor.';
  }

  /* a rail click opens that recipe (the page is built for one recipe at a time) */
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.rl-item[data-rid]');
    if (!item) return;
    e.preventDefault(); e.stopImmediatePropagation();
    location.search = '?recipe=' + encodeURIComponent(item.getAttribute('data-rid'));
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rewrite);
  else rewrite();
})();
