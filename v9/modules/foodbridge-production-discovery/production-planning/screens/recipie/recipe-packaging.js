/* ============================================================
   recipe-packaging.js — the recipe's Packaging tab (28 Sep 2026).

   Owner's call: packaging was spread over the store's pack list,
   Batch Management's own copy of it, the Cost tab's typed-in
   cookie pouches and the Production tab's cookie split names.
   Now a product's packs are added, changed and retired here, and
   only here; every other screen reads the one record
   (production-api.js: D.savePack / D.retirePack).

   A pack: size, per carton, pouch, price, and its split — its share
   of a batch in the Production tab — and when it's packed (29 Sep):
   in the same run, as a batch step before the rest goes into bags,
   or later, by a packing order from the bags. A saved pack reloads the page on
   this tab, so the header, Cost and Production show it at once.

   The shared packing steps are drawn below the packs, into
   #pack-steps, by recipe-steps.js.

   Row classes are .pkr: recipe-v4.js binds .ing, recipe-steps.js .stp.
   ============================================================ */
(function () {
  'use strict';
  if (!window.FB_PRODUCTION || !window.FB_RECIPE) return;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = (n) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const size = (g) => (g >= 1000 && g % 1000 === 0 ? g / 1000 + ' kg' : g + ' g');
  const RID = FB_RECIPE.id;

  const data = FB_PRODUCTION.read((D, d) => {
    const bk = D.book(RID), carton = D.material('rm-k11');
    return {
      bk, perKg: D.costPerKg(RID), cartonPrice: carton ? carton.price : 0,
      packs: D.packs(RID, true).map((s) => Object.assign({}, s, { cost: D.packCost(s), used: D.packUsed(s.id), pouchName: s.pouchId ? D.material(s.pouchId).name : '' })),
      pouches: d.materials.filter((m) => m.kind === 'packaging' && /^(Pouch|Bag) /.test(m.name)).map((m) => ({ id: m.id, name: m.name, price: m.price })),
      /* a semi-finished good is not packed: it goes into the cold store and is mixed into these */
      into: bk.kind === 'semi' ? d.recipeOrder.filter((rid) => D.book(rid).ingredients.some((i) => i.sfId === RID)).map((rid) => D.book(rid).name) : [],
    };
  });
  const onSale = data.packs.filter((s) => !s.retired), offSale = data.packs.filter((s) => s.retired);
  let open = null;   // a pack id, or 'new'

  /* ---------- view ---------- */
  function form(s) {
    const f = s || { grams: '', perCarton: '', price: '', split: 0, pouchId: '', sameRun: true };
    const pouchOpts = data.pouches.map((p) => `<option value="${esc(p.id)}"${p.id === f.pouchId ? ' selected' : ''}>${esc(p.name)} · ${money(p.price)}</option>`).join('');
    return `<div class="pkr-edit">
      <div class="grid">
        <div class="fld"><label class="label">Size (g)</label><input class="input" data-pf="grams" type="number" min="1" step="1" value="${f.grams}"${s && s.used ? ' readonly title="Made already: a new size is a new pack"' : ''}></div>
        <div class="fld"><label class="label">Per carton</label><input class="input" data-pf="perCarton" type="number" min="1" step="1" value="${f.perCarton}"></div>
        <div class="fld pkr-wide"><label class="label">Pouch</label><select class="input" data-pf="pouchId">${s ? '' : '<option value="" selected>Pick a pouch</option>'}${pouchOpts}<option value="new">New pouch…</option></select></div>
        <div class="fld pkr-newpouch" hidden><label class="label">New pouch ₹</label><input class="input" data-pf="newPouchPrice" type="number" min="0" step="0.1" placeholder="2.50"></div>
        <div class="fld"><label class="label">Price ₹</label><input class="input" data-pf="price" type="number" min="1" step="0.5" value="${f.price}"></div>
        <div class="fld"><label class="label">Split %</label><input class="input" data-pf="split" type="number" min="0" max="100" step="1" value="${f.split}"></div>
        <div class="fld pkr-wide"><label class="label">Packed</label><select class="input" data-pf="sameRun"><option value="1" selected>In the same run, as the batch is mixed</option></select></div>
      </div>
      <div class="pkr-note">${s && s.used ? 'Made already, so its size stays: a new size is a new pack. ' : ''}The other packs' split makes room.</div>
      <div class="pkr-cost" data-pkr-cost></div>
      <div class="pkr-foot">
        ${s && !s.retired ? '<button class="btn btn-sm stp-del" data-pkr-retire>Retire pack</button>' : '<span></span>'}
        <span class="pkr-foot-r"><button class="btn btn-sm" data-pkr-cancel>Cancel</button><button class="btn btn-sm btn-primary" data-pkr-save>✓ ${s ? 'Save' : 'Add pack'}</button></span>
      </div>
    </div>`;
  }
  function row(s) {
    const isOpen = open === s.id;
    return `<li class="pkr${isOpen ? ' open' : ''}${s.retired ? ' off' : ''}" data-pkr="${esc(s.id)}">
      <div class="pkr-row">
        <b>${size(s.grams)}</b>
        <span class="pkr-sub">${s.perCarton > 1 ? 'Carton of ' + s.perCarton + ' (' + Math.round(s.perCarton * s.grams / 1000) + ' kg)' : 'Its own bag, no carton'} · ${esc(s.pouchName || 'no pouch')} · MSQ ${s.msq || 0} · ${esc(s.article)}<small>Costs ${money(s.cost.total)} a packet · margin ${s.cost.marginPct}%</small></span>
        <span class="pkr-split">${s.retired ? '' : s.split + '%'}</span>
        <span class="pkr-price">${money(s.price)}</span>
        ${s.retired ? '<button class="btn btn-sm" data-pkr-back>Put back on sale</button>' : '<span class="muted">✎</span>'}
      </div>
      ${isOpen ? form(s) : ''}
    </li>`;
  }
  function render() {
    const host = $('[data-packs]');
    if (!host) return;
    if (data.bk.kind === 'semi') {
      host.innerHTML = `<div class="section-eyebrow mb8">Not packed</div><div class="muted">${esc(data.bk.name)} is semi-finished: its batches fill ${esc(String(data.bk.bagKg))} kg bags into the cold store, and it is mixed into ${esc(data.into.join(', ') || 'no finished product yet')} by their recipes. Packs belong to the finished products.</div>`;
      return;
    }
    const total = onSale.reduce((t, s) => t + s.split, 0);
    host.innerHTML = `
      <div class="section-eyebrow mb8">Packs on sale · ${onSale.length} · split ${total}%</div>
      <div class="pkr-head"><span>Pack</span><span></span><span>Split</span><span>Price</span><span></span></div>
      <ol class="pkr-list">${onSale.map(row).join('')}${open === 'new' ? `<li class="pkr open" data-pkr="new"><div class="pkr-row"><b>New pack</b><span></span><span></span><span></span><span></span></div>${form(null)}</li>` : ''}</ol>
      ${open === 'new' ? '' : '<div class="add-ing"><button class="add-btn" data-pkr-add>＋ Add pack</button></div>'}
      ${offSale.length ? `<div class="section-eyebrow mb8 mt16">Off sale · ${offSale.length}</div><ol class="pkr-list">${offSale.map(row).join('')}</ol>` : ''}
      <div class="muted small mt8">Every screen uses these packs: the Production split, Cost, the Production Plan, Batches, the Worker App and Finished Goods.</div>`;
    const li = host.querySelector('.pkr.open');
    if (li) preview(li);
  }

  /* what a packet will cost, as the fields are typed */
  function preview(li) {
    const v = (k) => { const el = li.querySelector(`[data-pf="${k}"]`); return el ? el.value : ''; };
    const out = li.querySelector('[data-pkr-cost]');
    const np = li.querySelector('.pkr-newpouch');
    if (np) np.hidden = v('pouchId') !== 'new';
    const g = Number(v('grams')), per = Number(v('perCarton')), price = Number(v('price'));
    const p = v('pouchId') === 'new' ? Number(v('newPouchPrice')) || 0 : ((data.pouches.find((x) => x.id === v('pouchId')) || {}).price || 0);
    if (!(g > 0 && per > 0)) { out.textContent = ''; return; }
    const product = data.perKg * g / 1000, carton = per > 1 ? data.cartonPrice / per : 0, total = product + p + carton;
    out.innerHTML = `${size(g)} of ${esc(data.bk.name)} ${money(product)} + pouch ${money(p)} + carton share ${money(carton)} = <b>${money(total)} a packet</b>`
      + (price > 0 ? ` · margin ${money(price - total)} (${Math.round((price - total) / price * 100)}%)` : '');
  }

  /* ---------- actions ---------- */
  const reload = () => { location.replace('?recipe=' + encodeURIComponent(RID) + '&tab=packaging'); };
  function fail(li, err) {
    const msg = (err && err.body && err.body.error) || (err && err.message) || 'That did not save. Try again.';
    let box = li.querySelector('.stp-err');
    if (!box) { box = document.createElement('div'); box.className = 'stp-err'; const foot = li.querySelector('.pkr-foot'); if (foot) foot.before(box); else li.appendChild(box); }
    box.textContent = msg;
  }
  function save(li) {
    const id = li.getAttribute('data-pkr'), v = (k) => { const el = li.querySelector(`[data-pf="${k}"]`); return el ? el.value : ''; };
    const o = { perCarton: v('perCarton'), price: v('price'), split: v('split'), sameRun: v('sameRun') === '1' };
    if (id === 'new') { o.recipeId = RID; o.grams = v('grams'); } else { o.id = id; if (!li.querySelector('[data-pf="grams"]').readOnly) o.grams = v('grams'); }
    if (v('pouchId') === 'new') { if (!(Number(v('newPouchPrice')) > 0)) return fail(li, { message: 'Enter the new pouch\'s price.' }); o.newPouchPrice = v('newPouchPrice'); }
    else if (v('pouchId')) o.pouchId = v('pouchId');
    else return fail(li, { message: 'Pick a pouch.' });
    ['grams', 'perCarton', 'price', 'split'].forEach((k) => { if (o[k] !== undefined) o[k] = o[k] === '' ? undefined : Number(o[k]); });
    try { FB_PRODUCTION.savePack(o); reload(); } catch (err) { fail(li, err); }
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t.closest('[data-packs]')) return;
    const li = t.closest('.pkr');
    if (t.closest('[data-pkr-add]')) { e.preventDefault(); open = 'new'; render(); const g = $('[data-packs] .pkr.open [data-pf="grams"]'); if (g) g.focus(); return; }
    if (!li) return;
    if (t.closest('[data-pkr-cancel]')) { e.preventDefault(); open = null; render(); return; }
    if (t.closest('[data-pkr-save]')) { e.preventDefault(); save(li); return; }
    if (t.closest('[data-pkr-retire]')) { e.preventDefault(); try { FB_PRODUCTION.retirePack(li.getAttribute('data-pkr')); reload(); } catch (err) { fail(li, err); } return; }
    if (t.closest('[data-pkr-back]')) { e.preventDefault(); try { FB_PRODUCTION.savePack({ id: li.getAttribute('data-pkr'), retired: false }); reload(); } catch (err) { fail(li, err); } return; }
    if (t.closest('.pkr-row') && !li.classList.contains('off') && li.getAttribute('data-pkr') !== 'new') {
      e.preventDefault();
      open = open === li.getAttribute('data-pkr') ? null : li.getAttribute('data-pkr');
      render();
    }
  });
  document.addEventListener('input', (e) => { const li = e.target.closest('[data-packs] .pkr.open'); if (li) preview(li); });
  document.addEventListener('change', (e) => { const li = e.target.closest('[data-packs] .pkr.open'); if (li) preview(li); });

  render();
})();
